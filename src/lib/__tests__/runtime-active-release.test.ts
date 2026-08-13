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
  return { root, manifest };
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

  it('uses the materialized v2 manifest as the only blob media allowlist', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-active-blob-release-'));
    roots.push(root);
    await mkdir(path.join(root, 'lessons', '1-1', 'media'), { recursive: true });
    await writeFile(path.join(root, 'lessons', '1-1', 'media', 'intro.mp4'), Buffer.from([1, 2, 3]));
    const manifest = await buildRuntimeBlobReleaseManifest(root, { sourceRevision: 'b'.repeat(40) });
    await writeFile(path.join(root, ACT_RUNTIME_BLOB_MATERIALIZED_MANIFEST_FILENAME), serializeRuntimeBlobReleaseManifest(manifest));

    const active = await readActiveRuntimeReleaseManifest(root);
    expect(active).toEqual(manifest);
    expect(findRuntimeMediaReleaseObject(active!, 'lessons/1-1/media/intro.mp4')).toMatchObject({
      objectKey: `runtime/blobs/sha256/${manifest.files[0].sha256}`,
    });
  });
});
