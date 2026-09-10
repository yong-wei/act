import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { stableStringify } from '../aggregate-governance/hash';

import {
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION,
  buildRuntimeBlobReleaseReceipt,
  buildRuntimeBlobReleaseManifest,
  buildRuntimeReleaseManifest,
  deriveRuntimeReleaseId,
  parseAnyRuntimeReleaseManifest,
  parseRuntimeBlobReleaseManifest,
  parseRuntimeBlobReleaseReceipt,
  parseRuntimeReleaseManifest,
  runtimeBlobObjectKey,
  runtimeBlobReleaseManifestObjectKey,
  runtimeBlobReleaseReceiptObjectKey,
  runtimeBlobReleaseManifestWireSha256,
  runtimeReleaseManifestObjectKey,
  RuntimeReleaseValidationError,
  serializeRuntimeBlobReleaseManifest,
  serializeRuntimeBlobReleaseReceipt,
  serializeRuntimeReleaseManifest,
  verifyRuntimeBlobReleaseManifestBlobs,
  verifyRuntimeReleaseDirectory,
} from '../runtime-release';

const roots: string[] = [];
const revision = 'a'.repeat(40);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-'));
  roots.push(root);
  await mkdir(path.join(root, 'lessons', '1-1', 'media'), { recursive: true });
  await writeFile(path.join(root, 'lessons', '1-1', 'lesson.json'), '{"lesson":"1-1"}\n');
  await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([1, 2, 3]));
  await writeFile(path.join(root, '.DS_Store'), 'ignored');
  return root;
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('act runtime release manifest', () => {
  it('is deterministic and binds each runtime object to its immutable release prefix', async () => {
    const root = await fixture();
    const [first, second] = await Promise.all([
      buildRuntimeReleaseManifest(root, { releaseId: 'runtime-20260811-a', sourceRevision: revision }),
      buildRuntimeReleaseManifest(root, { releaseId: 'runtime-20260811-a', sourceRevision: revision }),
    ]);

    expect(serializeRuntimeReleaseManifest(first)).toBe(serializeRuntimeReleaseManifest(second));
    expect(first.fileCount).toBe(2);
    expect(first.files.map((file) => file.path)).toEqual([
      'lessons/1-1/lesson.json',
      'lessons/1-1/media/intro.mp4',
    ]);
    expect(first.files[1].objectKey).toBe('runtime/releases/runtime-20260811-a/lessons/1-1/media/intro.mp4');
    expect(runtimeReleaseManifestObjectKey(first.releaseId)).toBe(`runtime/releases/runtime-20260811-a/${ACT_RUNTIME_RELEASE_MANIFEST_FILENAME}`);
    expect(deriveRuntimeReleaseId(first.sourceRevision, first.treeSha256)).toMatch(/^runtime-[a-f0-9]{55}$/);
    expect(parseAnyRuntimeReleaseManifest(first)).toEqual(first);
  });

  it('rejects symlink source entries and invalid release ids', async () => {
    const root = await fixture();
    await symlink(path.join(root, 'lessons', '1-1', 'lesson.json'), path.join(root, 'lessons', '1-1', 'link.json'));
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'INVALID', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-id-invalid' } satisfies Partial<RuntimeReleaseValidationError>);
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-symlink-forbidden' } satisfies Partial<RuntimeReleaseValidationError>);
  });

  it('rejects control characters in normalized source paths', async () => {
    const root = await fixture();
    await writeFile(path.join(root, 'lessons', '1-1', 'bad\nname.json'), 'unsafe');
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-path-invalid' } satisfies Partial<RuntimeReleaseValidationError>);
  });

  it('rejects an empty runtime source and an empty manifest', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-release-empty-'));
    roots.push(root);
    await expect(buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision }))
      .rejects.toMatchObject({ code: 'runtime-release-empty' } satisfies Partial<RuntimeReleaseValidationError>);

    const populatedRoot = await fixture();
    const manifest = await buildRuntimeReleaseManifest(populatedRoot, { releaseId: 'valid-release', sourceRevision: revision });
    expect(() => parseRuntimeReleaseManifest({ ...manifest, files: [], fileCount: 0, totalBytes: 0 }))
      .toThrow(/must not be empty/);
  });

  it('fails closed when a manifest path, digest, or source bytes diverge', async () => {
    const root = await fixture();
    const manifest = await buildRuntimeReleaseManifest(root, { releaseId: 'valid-release', sourceRevision: revision });
    await expect(verifyRuntimeReleaseDirectory(root, manifest)).resolves.toMatchObject({ treeSha256: manifest.treeSha256 });
    await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([4, 5, 6]));
    await expect(verifyRuntimeReleaseDirectory(root, manifest)).rejects.toMatchObject({ code: 'runtime-release-directory-mismatch' } satisfies Partial<RuntimeReleaseValidationError>);
    expect(() => parseRuntimeReleaseManifest({ ...manifest, files: [{ ...manifest.files[0], path: '../escape' }] }))
      .toThrow(/Invalid runtime release path/);
    expect(() => parseRuntimeReleaseManifest({ ...manifest, files: [{ ...manifest.files[0], path: 'nested\\escape' }] }))
      .toThrow(/Invalid runtime release path/);
  });

  it('builds a deterministic content-addressed blob manifest with independent wire identity', async () => {
    const root = await fixture();
    const [first, second] = await Promise.all([
      buildRuntimeBlobReleaseManifest(root, { sourceRevision: revision }),
      buildRuntimeBlobReleaseManifest(root, { sourceRevision: revision }),
    ]);

    expect(first).toEqual(second);
    expect(first.schemaVersion).toBe(ACT_RUNTIME_BLOB_RELEASE_SCHEMA_VERSION);
    expect(first.releaseId).toBe(deriveRuntimeReleaseId(revision, first.treeSha256));
    expect(first.files.map((file) => file.objectKey)).toEqual(first.files.map((file) => runtimeBlobObjectKey(file.sha256)));
    expect(runtimeBlobReleaseManifestObjectKey(first.releaseId)).toBe(`runtime/blob-releases/${first.releaseId}/manifest.json`);
    expect(runtimeBlobReleaseManifestWireSha256(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(parseRuntimeBlobReleaseManifest(JSON.parse(serializeRuntimeBlobReleaseManifest(first)))).toEqual(first);
    const receipt = buildRuntimeBlobReleaseReceipt(first);
    expect(runtimeBlobReleaseReceiptObjectKey(first.releaseId)).toBe(`runtime/blob-releases/${first.releaseId}/receipt.json`);
    expect(parseRuntimeBlobReleaseReceipt(JSON.parse(serializeRuntimeBlobReleaseReceipt(receipt)))).toEqual(receipt);
    expect(parseAnyRuntimeReleaseManifest(first)).toEqual(first);
  });

  it('keeps blob logical identity stable only for the same tree and source revision', async () => {
    const root = await fixture();
    const same = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: revision });
    const changedRevision = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: 'b'.repeat(40) });
    await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([9, 8, 7]));
    const changedTree = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: revision });

    expect(same.releaseId).not.toBe(changedRevision.releaseId);
    expect(same.treeSha256).toBe(changedRevision.treeSha256);
    expect(same.releaseId).not.toBe(changedTree.releaseId);
    expect(same.treeSha256).not.toBe(changedTree.treeSha256);
  });

  it('rejects unsupported, noncanonical or drifted blob manifests and verifies only their bound blobs', async () => {
    const root = await fixture();
    const manifest = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: revision });
    await expect(verifyRuntimeBlobReleaseManifestBlobs(manifest, async (objectKey) => {
      const file = manifest.files.find((entry) => entry.objectKey === objectKey);
      if (!file) throw new Error('unexpected blob');
      return await readFile(path.join(root, file.path));
    })).resolves.toMatchObject({ releaseId: manifest.releaseId });

    expect(() => parseRuntimeBlobReleaseManifest({ ...manifest, schemaVersion: 'act-runtime-release.v999' }))
      .toThrow(/Unsupported runtime blob release manifest version/);
    expect(() => parseRuntimeBlobReleaseManifest({
      ...manifest,
      files: [{ ...manifest.files[0], objectKey: 'runtime/blobs/sha256/' + '0'.repeat(64) }],
    })).toThrow(/not blob-addressed/);
    expect(() => parseRuntimeBlobReleaseManifest({
      ...manifest,
      files: [{ ...manifest.files[0], path: '../escape' }],
    })).toThrow(/Invalid runtime release path/);
    expect(() => parseRuntimeBlobReleaseManifest({
      ...manifest,
      files: [manifest.files[0], manifest.files[0]],
    })).toThrow(/strictly code-point sorted/);
    expect(() => parseRuntimeBlobReleaseManifest({ ...manifest, treeSha256: '0'.repeat(64) }))
      .toThrow(/file summary is inconsistent/);
    await expect(verifyRuntimeBlobReleaseManifestBlobs(manifest, async () => Buffer.from([0]))).rejects
      .toMatchObject({ code: 'runtime-release-blob-mismatch' } satisfies Partial<RuntimeReleaseValidationError>);
  });

  it('accepts an immutable Git source identity while preserving legacy v2 readability', async () => {
    const root = await fixture();
    const legacy = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: revision });
    const sourced = {
      ...legacy,
      files: legacy.files.map((file, index) => ({
        ...file,
        source: { gitObjectId: `${index === 0 ? 'b' : 'c'}`.repeat(40) },
      })),
    };
    const { manifestSha256: _legacyDigest, ...withoutDigest } = sourced;
    const manifest = {
      ...sourced,
      manifestSha256: createHash('sha256').update(stableStringify(withoutDigest)).digest('hex'),
    };

    expect(parseRuntimeBlobReleaseManifest(legacy)).toEqual(legacy);
    expect(parseRuntimeBlobReleaseManifest(manifest)).toEqual(manifest);
    expect(() => parseRuntimeBlobReleaseManifest({
      ...manifest,
      files: [{ ...manifest.files[0], source: { gitObjectId: 'invalid' } }, ...manifest.files.slice(1)],
    })).toThrow(/source.gitObjectId is invalid/);
  });

  it('accepts the strict external bundle source union and rejects partial identities', async () => {
    const root = await fixture();
    const legacy = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: revision });
    const strict = {
      ...legacy,
      files: legacy.files.map((file, index) => ({
        ...file,
        source: index === 0
          ? {
              externalInputId: 'current-production-runtime-v1',
              externalInputManifestObjectId: 'd'.repeat(40),
              bundleSemanticSha256: 'e'.repeat(64),
              bundleWireSha256: 'f'.repeat(64),
            }
          : { gitObjectId: 'c'.repeat(40) },
      })),
    };
    const { manifestSha256: _ignored, ...withoutDigest } = strict;
    const manifest = { ...strict, manifestSha256: createHash('sha256').update(stableStringify(withoutDigest)).digest('hex') };
    expect(parseRuntimeBlobReleaseManifest(manifest)).toEqual(manifest);
    expect(() => parseRuntimeBlobReleaseManifest({
      ...manifest,
      files: [{ ...manifest.files[0], source: { externalInputId: 'current-production-runtime-v1', externalInputManifestObjectId: 'd'.repeat(40), bundleSemanticSha256: 'e'.repeat(64) } }, ...manifest.files.slice(1)],
    })).toThrow(/source has unsupported or missing fields/);
  });

  it('accepts a v2 manifest written by the daily CAS publisher', async () => {
    const root = await fixture();
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'act-cas-publish-'));
    roots.push(workspace);
    const publisher = path.resolve(process.cwd(), 'scripts/runtime-release/publish-runtime.py');
    const published = spawnSync('python3', [
      publisher,
      '--root',
      root,
      '--index',
      path.join(workspace, 'index.sqlite'),
      '--store-dir',
      path.join(workspace, 'store'),
      '--source-revision',
      revision,
      '--bootstrap',
    ], { encoding: 'utf8' });
    expect(published.status, published.stderr).toBe(0);
    const metrics = JSON.parse(published.stdout) as { releaseId: string };
    const raw = JSON.parse(await readFile(path.join(workspace, 'store', 'runtime', 'blob-releases', metrics.releaseId, 'manifest.json'), 'utf8'));
    const parsed = parseRuntimeBlobReleaseManifest(raw);
    expect(parsed.releaseId).toBe(deriveRuntimeReleaseId(revision, parsed.treeSha256));
    expect(parsed.files.map((file) => file.objectKey)).toEqual(parsed.files.map((file) => runtimeBlobObjectKey(file.sha256)));
    const receiptRaw = JSON.parse(await readFile(path.join(workspace, 'store', 'runtime', 'blob-releases', metrics.releaseId, 'receipt.json'), 'utf8'));
    expect(parseRuntimeBlobReleaseReceipt(receiptRaw).releaseId).toBe(parsed.releaseId);
  });
});
