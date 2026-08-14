import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { buildGitRuntimeBlobReleaseSnapshot, openGitRuntimeBlobReleaseSnapshot, verifyGitRuntimeSnapshotFile } from '../runtime-release-git-snapshot';
import { buildRuntimeBlobReleaseManifestFromFiles } from '../runtime-release';
import {
  buildExternalInputBundle,
  EXTERNAL_INPUT_BUNDLE_PREFIXES,
  EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES,
  serializeExternalInputBundle,
  serializeExternalInputBundleDeclaration,
} from '../runtime-external-input-bundle';
import { stableStringify } from '../aggregate-governance/hash';

const execFile = promisify(execFileCallback);
const roots: string[] = [];

async function git(root: string, ...args: string[]) {
  const result = await execFile('git', args, { cwd: root });
  return result.stdout.trim();
}

async function runtimeTreeDigest(root: string, revision: string) {
  const result = await execFile('git', ['ls-tree', '-r', '--full-tree', revision, '--', 'course-content/runtime'], { cwd: root });
  const entries = result.stdout.split('\n').filter(Boolean).map((entry) => {
    const tab = entry.indexOf('\t');
    const header = entry.slice(0, tab).split(' ');
    return { path: entry.slice(tab + 1).slice('course-content/runtime/'.length), objectId: header[2] };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return createHash('sha256').update(stableStringify(entries)).digest('hex');
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-git-snapshot-'));
  roots.push(root);
  const runtimeRoot = path.join(root, 'course-content', 'runtime', 'lessons');
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(path.join(runtimeRoot, 'lesson.json'), '{"id":"commit-source"}\n');
  await mkdir(path.join(root, 'course-content', 'authoring'), { recursive: true });
  await writeFile(path.join(root, 'course-content', 'authoring', 'runtime-external-inputs.v1.json'), `${JSON.stringify({
    schemaVersion: 'act-runtime-external-inputs.v1',
    inputs: [{
      pathPrefix: 'resources/textbooks-v2/',
      externalInputId: 'textbook-runtime-v2-generated-v1',
    }],
  }, null, 2)}\n`);
  await git(root, 'init', '-b', 'integration');
  await git(root, 'config', 'user.email', 'test@example.invalid');
  await git(root, 'config', 'user.name', 'Test');
  await git(root, 'add', '.');
  await git(root, 'commit', '-m', 'fixture');
  const sourceRevision = await git(root, 'rev-parse', 'HEAD');
  return { root, sourceRevision };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('Git-backed runtime release snapshots', () => {
  it('ignores dirty and untracked worktree state and is deterministic for one commit', async () => {
    const { root, sourceRevision } = await fixture();
    const runtimeRoot = path.join(root, 'course-content', 'runtime', 'lessons');
    await writeFile(path.join(runtimeRoot, 'lesson.json'), '{"id":"dirty-worktree"}\n');
    await writeFile(path.join(runtimeRoot, 'untracked.json'), 'must-not-be-read\n');
    const first = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    const second = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    expect(second.manifest).toEqual(first.manifest);
    expect(first.manifest.files.map((file) => file.path)).toEqual(['lessons/lesson.json']);
    const firstSource = first.filesByPath.get('lessons/lesson.json');
    expect(first.manifest.files[0]?.source).toEqual({ gitObjectId: firstSource && 'blobObjectId' in firstSource ? firstSource.blobObjectId : undefined });
    expect(first.stats).toEqual({ reusedFileCount: 0, reusedBytes: 0, hashedFileCount: 1, hashedBytes: 23 });
    const source = await first.openFile('lessons/lesson.json');
    const chunks: Buffer[] = [];
    for await (const chunk of source) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString('utf8')).toBe('{"id":"commit-source"}\n');
    await expect(first.openFile('lessons/untracked.json')).rejects.toThrow(/absent from the snapshot/);
  });

  it('reuses a parent Git object identity without rereading its blob body', async () => {
    const { root, sourceRevision } = await fixture();
    const parent = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    const target = await buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision,
      integrationRef: 'integration',
      parentManifest: parent.manifest,
    });

    expect(target.manifest).toEqual(parent.manifest);
    expect(target.parentManifest).toEqual(parent.manifest);
    expect(target.stats).toEqual({ reusedFileCount: 1, reusedBytes: 23, hashedFileCount: 0, hashedBytes: 0 });
  });

  it('reopens a planned manifest from Git tree metadata without another body-hash pass', async () => {
    const { root, sourceRevision } = await fixture();
    const planned = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    const reopened = await openGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision,
      integrationRef: 'integration',
      manifest: planned.manifest,
    });

    expect(reopened.manifest).toEqual(planned.manifest);
    expect(reopened.stats).toEqual({ reusedFileCount: 0, reusedBytes: 0, hashedFileCount: 0, hashedBytes: 0 });
    const reopenedSource = reopened.filesByPath.get('lessons/lesson.json');
    const plannedSource = planned.filesByPath.get('lessons/lesson.json');
    expect(reopenedSource && 'blobObjectId' in reopenedSource ? reopenedSource.blobObjectId : undefined).toBe(plannedSource && 'blobObjectId' in plannedSource ? plannedSource.blobObjectId : undefined);
  });

  it('hashes only target Git objects absent from the parent manifest', async () => {
    const { root, sourceRevision } = await fixture();
    const parent = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    await writeFile(path.join(root, 'course-content', 'runtime', 'lessons', 'changed.json'), 'changed\n');
    await git(root, 'add', '.');
    await git(root, 'commit', '-m', 'one runtime delta');
    const targetRevision = await git(root, 'rev-parse', 'HEAD');
    const target = await buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision: targetRevision,
      integrationRef: 'integration',
      parentManifest: parent.manifest,
    });

    expect(target.stats).toEqual({
      reusedFileCount: 1,
      reusedBytes: 23,
      hashedFileCount: 1,
      hashedBytes: Buffer.byteLength('changed\n'),
    });
  });

  it('streams one new Git object once when multiple logical paths reference it', async () => {
    const { root } = await fixture();
    const runtimeRoot = path.join(root, 'course-content', 'runtime', 'lessons');
    await writeFile(path.join(runtimeRoot, 'copy.json'), '{"id":"commit-source"}\n');
    await git(root, 'add', '.');
    await git(root, 'commit', '-m', 'duplicate runtime blob');
    const sourceRevision = await git(root, 'rev-parse', 'HEAD');

    const target = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });

    expect(target.manifest.files).toHaveLength(2);
    expect(target.manifest.files[0]?.sha256).toBe(target.manifest.files[1]?.sha256);
    expect(target.stats).toEqual({ reusedFileCount: 0, reusedBytes: 0, hashedFileCount: 1, hashedBytes: 23 });
  });

  it('keeps a three-file delta proportional to the three new source objects', async () => {
    const { root, sourceRevision } = await fixture();
    const parent = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    const runtimeRoot = path.join(root, 'course-content', 'runtime', 'lessons');
    await Promise.all([
      writeFile(path.join(runtimeRoot, 'delta-one.json'), 'one\n'),
      writeFile(path.join(runtimeRoot, 'delta-two.json'), 'two\n'),
      writeFile(path.join(runtimeRoot, 'delta-three.json'), 'three\n'),
    ]);
    await git(root, 'add', '.');
    await git(root, 'commit', '-m', 'three runtime delta files');
    const targetRevision = await git(root, 'rev-parse', 'HEAD');

    const target = await buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision: targetRevision,
      integrationRef: 'integration',
      parentManifest: parent.manifest,
    });

    expect(target.stats).toEqual({
      reusedFileCount: 1,
      reusedBytes: 23,
      hashedFileCount: 3,
      hashedBytes: Buffer.byteLength('one\n') + Buffer.byteLength('two\n') + Buffer.byteLength('three\n'),
    });
  });

  it('reuses a parent Git object after a logical path rename without rereading it', async () => {
    const { root, sourceRevision } = await fixture();
    const parent = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    await git(root, 'mv', 'course-content/runtime/lessons/lesson.json', 'course-content/runtime/lessons/renamed.json');
    await git(root, 'commit', '-m', 'rename runtime blob');
    const sourceRevisionAfterRename = await git(root, 'rev-parse', 'HEAD');

    const target = await buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision: sourceRevisionAfterRename,
      integrationRef: 'integration',
      parentManifest: parent.manifest,
    });

    expect(target.manifest.files.map((file) => file.path)).toEqual(['lessons/renamed.json']);
    expect(target.stats).toEqual({ reusedFileCount: 1, reusedBytes: 23, hashedFileCount: 0, hashedBytes: 0 });
  });

  it('preserves declared external parent entries while rejecting undeclared parent entries', async () => {
    const { root, sourceRevision } = await fixture();
    const gitSnapshot = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    const externalBytes = Buffer.from('{"generated":true}\n');
    const parent = buildRuntimeBlobReleaseManifestFromFiles(sourceRevision, [
      ...gitSnapshot.manifest.files,
      {
        path: 'resources/textbooks-v2/manifest.json',
        sizeBytes: externalBytes.byteLength,
        sha256: createHash('sha256').update(externalBytes).digest('hex'),
      },
    ]);

    const target = await buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision,
      integrationRef: 'integration',
      parentManifest: parent,
    });
    expect(target.manifest.files).toHaveLength(2);
    expect(target.manifest.files.find((file) => file.path === 'resources/textbooks-v2/manifest.json')?.source).toMatchObject({
      externalInputId: 'textbook-runtime-v2-generated-v1',
    });
    expect(target.stats).toEqual({ reusedFileCount: 2, reusedBytes: 23 + externalBytes.byteLength, hashedFileCount: 0, hashedBytes: 0 });

    const reopened = await openGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision,
      integrationRef: 'integration',
      parentManifest: parent,
      manifest: target.manifest,
    });
    expect(reopened.manifest).toEqual(target.manifest);

    const undeclaredParent = buildRuntimeBlobReleaseManifestFromFiles(sourceRevision, [
      ...gitSnapshot.manifest.files,
      {
        path: 'resources/untracked-generated.json',
        sizeBytes: externalBytes.byteLength,
        sha256: createHash('sha256').update(externalBytes).digest('hex'),
      },
    ]);
    await expect(buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision,
      integrationRef: 'integration',
      parentManifest: undeclaredParent,
    })).rejects.toMatchObject({ code: 'runtime-release-external-source-missing' });
  });

  it('rejects an external declaration identity change until its generated source is revalidated', async () => {
    const { root, sourceRevision } = await fixture();
    const gitSnapshot = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration' });
    const externalBytes = Buffer.from('{"generated":true}\n');
    const parent = buildRuntimeBlobReleaseManifestFromFiles(sourceRevision, [
      ...gitSnapshot.manifest.files,
      {
        path: 'resources/textbooks-v2/manifest.json',
        sizeBytes: externalBytes.byteLength,
        sha256: createHash('sha256').update(externalBytes).digest('hex'),
      },
    ]);
    const first = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: 'integration', parentManifest: parent });
    await writeFile(path.join(root, 'course-content', 'authoring', 'runtime-external-inputs.v1.json'), `${JSON.stringify({
      schemaVersion: 'act-runtime-external-inputs.v1',
      inputs: [{
        pathPrefix: 'resources/textbooks-v2/',
        externalInputId: 'textbook-runtime-v2-generated-v2',
      }],
    }, null, 2)}\n`);
    await git(root, 'add', '.');
    await git(root, 'commit', '-m', 'change external generated source identity');
    const changedRevision = await git(root, 'rev-parse', 'HEAD');
    await expect(buildGitRuntimeBlobReleaseSnapshot({
      repoRoot: root,
      sourceRevision: changedRevision,
      integrationRef: 'integration',
      parentManifest: first.manifest,
    })).rejects.toMatchObject({ code: 'runtime-release-external-source-changed' });
  });

  it('rejects symlink entries from the Git runtime tree', async () => {
    const { root } = await fixture();
    const runtimeRoot = path.join(root, 'course-content', 'runtime');
    await symlink('lessons/lesson.json', path.join(runtimeRoot, 'link.json'));
    await git(root, 'add', 'course-content/runtime/link.json');
    await git(root, 'commit', '-m', 'symlink');
    const sourceRevision = await git(root, 'rev-parse', 'HEAD');
    await expect(buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: sourceRevision })).rejects.toThrow(/unsupported entry|entry/);
  });

  it('combines the exact external bundle with an unchanged Git capture and rejects source drift', async () => {
    const { root, sourceRevision: baseRevision } = await fixture();
    const runtimeRoot = path.join(root, 'course-content', 'runtime');
    const externalPath = path.join(runtimeRoot, 'knowledge', 'infographs', 'authority', 'a.svg');
    await mkdir(path.dirname(externalPath), { recursive: true });
    const externalBytes = Buffer.from('external bytes\n');
    await writeFile(externalPath, externalBytes);
    const bundle = buildExternalInputBundle({
      externalInputId: 'current-production-runtime-v1',
      sourceRevision: baseRevision,
      baseSourceRevision: baseRevision,
      provenance: {
        schemaVersion: 'act.textbook-runtime-input-provenance.v1',
        sourceRevision: baseRevision,
        inputDigest: 'b'.repeat(64),
        inputFileCount: 1,
      },
      generator: { id: 'test-generator', version: '1' },
      overlay: {
        baseSourceRevision: baseRevision,
        baseRuntimeTreeSha256: await runtimeTreeDigest(root, baseRevision),
        replacedPrefixes: [...EXTERNAL_INPUT_BUNDLE_REPLACED_PREFIXES],
        generatedPrefixes: [...EXTERNAL_INPUT_BUNDLE_PREFIXES],
        generatedTreeSha256: 'c'.repeat(64),
      },
      files: [{
        path: 'knowledge/infographs/authority/a.svg',
        sizeBytes: externalBytes.byteLength,
        sha256: createHash('sha256').update(externalBytes).digest('hex'),
        absolutePath: externalPath,
      }],
      root: runtimeRoot,
    });
    await writeFile(path.join(root, 'course-content', 'authoring', 'runtime-external-input-bundles.v1.json'), serializeExternalInputBundleDeclaration({
      schemaVersion: 'act-runtime-external-input-bundles.v1',
      inputs: [{
        externalInputId: bundle.externalInputId,
        prefixes: bundle.prefixes,
        bundleSemanticSha256: bundle.manifestSha256,
        bundleWireSha256: bundle.wireSha256,
        sourceRevision: bundle.sourceRevision,
        baseSourceRevision: bundle.baseSourceRevision,
        overlaySha256: bundle.overlaySha256,
        inputDigest: bundle.provenance.inputDigest,
        inputFileCount: bundle.provenance.inputFileCount,
      }],
    }));
    await git(root, 'add', 'course-content/authoring/runtime-external-input-bundles.v1.json');
    await git(root, 'commit', '-m', 'bind external runtime bundle');
    const targetRevision = await git(root, 'rev-parse', 'HEAD');

    const snapshot = await buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision: targetRevision, integrationRef: 'integration', externalBundle: bundle });
    expect(snapshot.manifest.files).toHaveLength(2);
    expect(snapshot.manifest.files.find((file) => file.path === 'knowledge/infographs/authority/a.svg')?.source).toMatchObject({
      externalInputId: bundle.externalInputId,
      bundleSemanticSha256: bundle.manifestSha256,
      bundleWireSha256: bundle.wireSha256,
    });
    expect(snapshot.stats.reusedFileCount).toBe(1);
    const externalFile = snapshot.manifest.files.find((file) => file.path === 'knowledge/infographs/authority/a.svg');
    if (!externalFile) throw new Error('external fixture missing');
    await verifyGitRuntimeSnapshotFile({ snapshot, file: externalFile });
    await writeFile(externalPath, 'drifted bytes\n');
    await expect(verifyGitRuntimeSnapshotFile({ snapshot, file: externalFile })).rejects.toMatchObject({ code: 'runtime-release-external-source-changed' });
    expect(serializeExternalInputBundle(bundle)).not.toContain(runtimeRoot);
  });

  it('rejects gitlink entries from the Git runtime tree', async () => {
    const { root, sourceRevision: baseRevision } = await fixture();
    await git(root, 'update-index', '--add', '--cacheinfo', `160000,${baseRevision},course-content/runtime/submodule`);
    await git(root, 'commit', '-m', 'gitlink');
    const sourceRevision = await git(root, 'rev-parse', 'HEAD');
    await expect(buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: sourceRevision })).rejects.toThrow(/unsupported entry|entry/);
  });

  it('rejects a source commit that is not an integration ancestor', async () => {
    const { root } = await fixture();
    await writeFile(path.join(root, 'course-content', 'runtime', 'lessons', 'other.json'), 'other\n');
    await git(root, 'checkout', '-b', 'unpublished');
    await git(root, 'add', '.');
    await git(root, 'commit', '-m', 'unpublished');
    const unpublished = await git(root, 'rev-parse', 'HEAD');
    await git(root, 'checkout', 'integration');
    await expect(buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision: unpublished, integrationRef: 'integration' })).rejects.toMatchObject({
      code: 'runtime-release-git-not-integration',
    });
  });
});
