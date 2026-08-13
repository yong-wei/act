import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

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
    expect(runtimeBlobReleaseManifestObjectKey(first.releaseId)).toBe(`runtime/releases/${first.releaseId}/manifest.json`);
    expect(runtimeBlobReleaseManifestWireSha256(first)).toMatch(/^[a-f0-9]{64}$/);
    expect(parseRuntimeBlobReleaseManifest(JSON.parse(serializeRuntimeBlobReleaseManifest(first)))).toEqual(first);
    const receipt = buildRuntimeBlobReleaseReceipt(first);
    expect(runtimeBlobReleaseReceiptObjectKey(first.releaseId)).toBe(`runtime/releases/${first.releaseId}/receipt.json`);
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
});
