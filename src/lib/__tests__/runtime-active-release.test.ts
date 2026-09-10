import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  findRuntimeMediaReleaseObject,
  isRuntimeMediaPath,
  readActiveRuntimeReleaseManifest,
} from '../runtime-active-release';
import {
  ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME,
  ACT_RUNTIME_RELEASE_MANIFEST_FILENAME,
  buildRuntimeBlobReleaseManifest,
  buildRuntimeReleaseManifest,
  serializeRuntimeBlobReleaseManifest,
  serializeRuntimeReleaseManifest,
} from '../runtime-release';

const roots: string[] = [];

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-active-release-'));
  roots.push(root);
  await mkdir(path.join(root, 'lessons', '1-1', 'media'), { recursive: true });
  await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([1, 2, 3]));
  const manifest = await buildRuntimeReleaseManifest(root, {
    releaseId: 'runtime-20260811-a',
    sourceRevision: 'a'.repeat(40),
  });
  await writeFile(path.join(root, ACT_RUNTIME_RELEASE_MANIFEST_FILENAME), serializeRuntimeReleaseManifest(manifest));
  await writeActiveReceipt(root, manifest);
  return { root, manifest };
}

async function blobFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-active-blob-receipt-'));
  roots.push(root);
  await mkdir(path.join(root, 'lessons', '1-1', 'media'), { recursive: true });
  await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([1, 2, 3]));
  const manifest = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: 'b'.repeat(40) });
  await writeFile(path.join(root, ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME), serializeRuntimeBlobReleaseManifest(manifest));
  await writeActiveReceipt(root, manifest);
  return { root, manifest };
}

async function writeActiveReceipt(
  root: string,
  manifest: { releaseId: string; manifestSha256: string; treeSha256: string },
  receiptRoot = root,
  compatibility?: Record<string, unknown>,
) {
  const receipt: Record<string, unknown> = {
    schemaVersion: 'runtime-release-active-receipt.v1',
    selection: {
      schemaVersion: 'runtime-release-selection.v1',
      generation: 1,
      releaseId: manifest.releaseId,
      manifestSha256: manifest.manifestSha256,
      treeSha256: manifest.treeSha256,
    },
    healthCheck: 'readyz',
  };
  if (compatibility) receipt.compatibility = compatibility;
  await writeFile(path.join(receiptRoot, 'act-runtime-active-receipt.json'), JSON.stringify(receipt));
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('active runtime release manifest', () => {
  it('uses the mounted manifest only for exact media objects', async () => {
    const { root, manifest } = await fixture();

    await expect(readActiveRuntimeReleaseManifest(root)).resolves.toMatchObject({
      manifestSha256: manifest.manifestSha256,
      releaseId: manifest.releaseId,
    });
    const media = findRuntimeMediaReleaseObject(manifest, 'lessons/1-1/media/intro.mp4');
    expect(media).toMatchObject({
      objectKey: 'runtime/releases/runtime-20260811-a/lessons/1-1/media/intro.mp4',
      sizeBytes: 3,
    });
    expect(findRuntimeMediaReleaseObject(manifest, 'lessons/1-1/lesson.json')).toBeNull();
    expect(isRuntimeMediaPath('../secret.mp4')).toBe(false);
  });

  it('keeps legacy filesystem delivery when the mounted release manifest is absent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-active-release-empty-'));
    roots.push(root);
    await expect(readActiveRuntimeReleaseManifest(root)).resolves.toBeNull();
  });

  it('preserves the activated v1 manifest fallback when no v2 receipt is mounted', async () => {
    const { root, manifest } = await fixture();
    await rm(path.join(root, 'act-runtime-active-receipt.json'));
    await expect(readActiveRuntimeReleaseManifest(root)).resolves.toMatchObject({
      schemaVersion: 'act-runtime-release.v1',
      releaseId: manifest.releaseId,
    });
  });

  it('uses the materialized v2 manifest as the only blob media allowlist', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-active-blob-release-'));
    roots.push(root);
    await mkdir(path.join(root, 'lessons', '1-1', 'media'), { recursive: true });
    await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([1, 2, 3]));
    const manifest = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: 'b'.repeat(40) });
    await writeFile(path.join(root, ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME), serializeRuntimeBlobReleaseManifest(manifest));
    await writeActiveReceipt(root, manifest);

    const active = await readActiveRuntimeReleaseManifest(root);
    expect(active).toEqual(manifest);
    expect(findRuntimeMediaReleaseObject(active!, 'lessons/1-1/media/intro.mp4')).toMatchObject({
      objectKey: `runtime/blobs/sha256/${manifest.files[0].sha256}`,
    });
  });

  it('fails closed when a mounted manifest has no active receipt', async () => {
    const { root } = await blobFixture();
    await rm(path.join(root, 'act-runtime-active-receipt.json'));
    await expect(readActiveRuntimeReleaseManifest(root)).rejects.toMatchObject({
      code: 'runtime-active-release-receipt-unreadable',
    });
  });

  it('fails closed for a damaged or mismatched active receipt', async () => {
    const { root, manifest } = await blobFixture();
    const receipt = path.join(root, 'act-runtime-active-receipt.json');
    await writeFile(receipt, '{');
    await expect(readActiveRuntimeReleaseManifest(root)).rejects.toMatchObject({
      code: 'runtime-active-release-receipt-invalid',
    });
    await writeActiveReceipt(root, { ...manifest, manifestSha256: 'f'.repeat(64) });
    await expect(readActiveRuntimeReleaseManifest(root)).rejects.toMatchObject({
      code: 'runtime-active-release-receipt-mismatch',
    });
  });

  it('supports a separately mounted receipt directory for atomic host projection updates', async () => {
    const { root, manifest } = await blobFixture();
    const receiptRoot = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-active-receipt-'));
    roots.push(receiptRoot);
    await rm(path.join(root, 'act-runtime-active-receipt.json'));
    await writeActiveReceipt(root, manifest, receiptRoot);
    await expect(readActiveRuntimeReleaseManifest(root, path.join(receiptRoot, 'act-runtime-active-receipt.json'))).resolves.toMatchObject({
      releaseId: manifest.releaseId,
    });
  });

  it('ignores a historical compatibility projection for a blob-backed receipt', async () => {
    const { root, manifest } = await blobFixture();
    const compatibility = {
      schemaVersion: 'runtime-app-compatibility.v1',
      proofSha256: 'a'.repeat(64),
      runtimeSourceRevision: 'b'.repeat(40),
      appRevision: 'c'.repeat(40),
      imageDigest: `sha256:${'d'.repeat(64)}`,
      migrationSetSha256: 'e'.repeat(64),
      consumerContract: 'runtime-app-candidate-consumers.v1',
    };
    await writeActiveReceipt(root, manifest, root, compatibility);
    await expect(readActiveRuntimeReleaseManifest(root)).resolves.toEqual(manifest);

    await writeActiveReceipt(root, manifest, root, { ...compatibility, unexpected: 'field' });
    await expect(readActiveRuntimeReleaseManifest(root)).resolves.toEqual(manifest);
  });
});
