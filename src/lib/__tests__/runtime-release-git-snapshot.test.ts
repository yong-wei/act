import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import { afterEach, describe, expect, it } from 'vitest';

import { buildGitRuntimeBlobReleaseSnapshot } from '../runtime-release-git-snapshot';

const execFile = promisify(execFileCallback);
const roots: string[] = [];

async function git(root: string, ...args: string[]) {
  const result = await execFile('git', args, { cwd: root });
  return result.stdout.trim();
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-git-snapshot-'));
  roots.push(root);
  const runtimeRoot = path.join(root, 'course-content', 'runtime', 'lessons');
  await mkdir(runtimeRoot, { recursive: true });
  await writeFile(path.join(runtimeRoot, 'lesson.json'), '{"id":"commit-source"}\n');
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
    expect(first.manifest.files[0]?.source).toEqual({ gitObjectId: first.filesByPath.get('lessons/lesson.json')?.blobObjectId });
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
    expect(target.stats).toEqual({ reusedFileCount: 1, reusedBytes: 23, hashedFileCount: 0, hashedBytes: 0 });
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

  it('rejects symlink entries from the Git runtime tree', async () => {
    const { root } = await fixture();
    const runtimeRoot = path.join(root, 'course-content', 'runtime');
    await symlink('lessons/lesson.json', path.join(runtimeRoot, 'link.json'));
    await git(root, 'add', 'course-content/runtime/link.json');
    await git(root, 'commit', '-m', 'symlink');
    const sourceRevision = await git(root, 'rev-parse', 'HEAD');
    await expect(buildGitRuntimeBlobReleaseSnapshot({ repoRoot: root, sourceRevision, integrationRef: sourceRevision })).rejects.toThrow(/unsupported entry|entry/);
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
