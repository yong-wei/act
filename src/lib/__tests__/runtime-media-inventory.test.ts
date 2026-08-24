import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildRuntimeMediaInventory, serializeRuntimeMediaInventory } from '../runtime-media-inventory';
import type { ActRuntimeBlobReleaseManifest } from '../runtime-release';

const roots: string[] = [];
const revision = 'b'.repeat(40);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'act-runtime-media-'));
  roots.push(root);
  const runtime = path.join(root, 'runtime');
  const authoring = path.join(root, 'authoring');
  await mkdir(path.join(runtime, 'lessons', '1-1', 'media'), { recursive: true });
  await mkdir(path.join(authoring, '1-1', 'media', 'processed'), { recursive: true });
  await writeFile(path.join(runtime, 'lessons', '1-1', 'media', 'local.mp4'), Buffer.from([1, 2, 3]));
  await writeFile(path.join(authoring, '1-1', 'media', 'processed', 'processed.pdf'), '%PDF');
  await writeFile(path.join(runtime, 'lessons', '1-1', 'media', '1-1-media.md'), [
    '# local.mp4', '- local', 'https://legacy.example/video', '',
    '# processed.pdf', '- processed', '',
    '# external.mp3', '- external', 'https://legacy.example/audio', '',
    '# missing.m4a', '- missing', '',
    '# ../escape.mp4', '- traversal', 'https://legacy.example/escape', '',
  ].join('\n'));
  return { runtime, authoring };
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('runtime media inventory', () => {
  it('reports local, processed, legacy and unresolved states without URL query data', async () => {
    const { runtime, authoring } = await fixture();
    const inventory = await buildRuntimeMediaInventory({ runtimeRoot: runtime, authoringLessonsRoot: authoring, sourceRevision: revision });

    expect(inventory.runtimeMediaFiles).toBe(1);
    expect(inventory.declaredMediaEntries).toBe(5);
    expect(inventory.runtimePresent).toBe(1);
    expect(inventory.processedPresent).toBe(1);
    expect(inventory.legacyUrlPresent).toBe(3);
    expect(inventory.unresolved).toBe(1);
    expect(inventory.entries.find((entry) => entry.filename === 'external.mp3')).toMatchObject({ legacyUrlHost: 'legacy.example', runtimePresent: false, processedPresent: false, unresolved: false });
    expect(inventory.entries.find((entry) => entry.filename === '../escape.mp4')).toMatchObject({ runtimePresent: false, processedPresent: false, unresolved: false });
    expect(serializeRuntimeMediaInventory(inventory)).not.toContain('https://legacy.example');
  });

  it('accepts only manifest-bound leaf symlinks contained by the declared blob root', async () => {
    const { runtime, authoring } = await fixture();
    const media = path.join(runtime, 'lessons', '1-1', 'media', 'local.mp4');
    const bytes = Buffer.from([1, 2, 3]);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const blobRoot = path.join(runtime, '.act-runtime-blobs');
    await mkdir(blobRoot);
    await writeFile(path.join(blobRoot, sha256), bytes);
    await rm(media);
    await symlink(path.join('..', '..', '..', '.act-runtime-blobs', sha256), media);
    const blobManifest: ActRuntimeBlobReleaseManifest = {
      schemaVersion: 'act-runtime-release.v2',
      releaseId: 'runtime-a',
      sourceRevision: revision,
      fileCount: 1,
      totalBytes: bytes.byteLength,
      treeSha256: 'a'.repeat(64),
      manifestSha256: 'b'.repeat(64),
      files: [{ path: 'lessons/1-1/media/local.mp4', objectKey: `runtime/blobs/sha256/${sha256}`, sizeBytes: bytes.byteLength, sha256 }],
    };
    const inventory = await buildRuntimeMediaInventory({ runtimeRoot: runtime, authoringLessonsRoot: authoring, sourceRevision: revision, blobManifest, blobRoot });
    expect(inventory.runtimePresent).toBe(1);
    expect(inventory.runtimeMediaFiles).toBe(1);

    await rm(media);
    await symlink(path.join(path.dirname(runtime), 'outside.mp4'), media);
    await expect(buildRuntimeMediaInventory({ runtimeRoot: runtime, authoringLessonsRoot: authoring, sourceRevision: revision, blobManifest, blobRoot }))
      .rejects.toMatchObject({ code: 'runtime-media-inventory-symlink' });
  });

  it('prunes the reserved helper directory and rejects it as a logical input', async () => {
    const { runtime, authoring } = await fixture();
    const helper = path.join(runtime, '.act-runtime-blobs');
    await mkdir(helper);
    await writeFile(path.join(helper, 'hidden.mp4'), Buffer.from([9, 9, 9]));
    const inventory = await buildRuntimeMediaInventory({ runtimeRoot: runtime, authoringLessonsRoot: authoring, sourceRevision: revision });
    expect(inventory.runtimeMediaFiles).toBe(1);

    const sha256 = 'c'.repeat(64);
    const reservedManifest: ActRuntimeBlobReleaseManifest = {
      schemaVersion: 'act-runtime-release.v2',
      releaseId: 'runtime-a',
      sourceRevision: revision,
      fileCount: 1,
      totalBytes: 3,
      treeSha256: 'a'.repeat(64),
      manifestSha256: 'b'.repeat(64),
      files: [{ path: '.act-runtime-blobs/hidden.mp4', objectKey: `runtime/blobs/sha256/${sha256}`, sizeBytes: 3, sha256 }],
    };
    await expect(buildRuntimeMediaInventory({
      runtimeRoot: runtime,
      authoringLessonsRoot: authoring,
      sourceRevision: revision,
      blobManifest: reservedManifest,
      blobRoot: helper,
    })).rejects.toMatchObject({ code: 'runtime-media-inventory-reserved-path' });
  });
});
