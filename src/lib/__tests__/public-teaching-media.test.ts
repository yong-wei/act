import { createHash } from 'node:crypto';
import { mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  isPublicTeachingMediaPath,
  parsePublicTeachingMediaIndex,
  publicTeachingMediaUrlForBuffer,
  publicTeachingMediaUrlForDigest,
  publicTeachingMediaUrlForPath,
  type PublicTeachingMediaIndex,
} from '@/lib/public-teaching-media';

const HASH = 'a'.repeat(64);
const MANIFEST = 'b'.repeat(64);
const RELEASE = `runtime-${'c'.repeat(56)}`;
let root: string;

function index(): PublicTeachingMediaIndex {
  return {
    schemaVersion: 'act-public-teaching-media/v1', verified: true,
    sourceRuntime: { releaseId: RELEASE, manifestSha256: MANIFEST },
    objects: [{ path: 'lessons/1-1/media/intro.mp4', sha256: HASH, sizeBytes: 12, mediaType: 'video/mp4', publicEligible: true }],
  };
}

function install(value: unknown) {
  const temporary = path.join(root, 'next.json');
  writeFileSync(temporary, JSON.stringify(value));
  renameSync(temporary, path.join(root, 'index.json'));
}

describe('public teaching media qualification and identity', () => {
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'public-teaching-media-'));
    vi.stubEnv('ACT_PUBLIC_TEACHING_MEDIA_INDEX_PATH', path.join(root, 'index.json'));
    vi.stubEnv('ACT_RUNTIME_ACTIVE_RECEIPT_PATH', path.join(root, 'active.json'));
    writeFileSync(path.join(root, 'active.json'), JSON.stringify({
      schemaVersion: 'runtime-release-active-receipt.v1',
      selection: { releaseId: RELEASE, manifestSha256: MANIFEST },
    }));
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it('rejects governance, retrieval indexes, helper paths and traversal', () => {
    for (const p of ['resource-governance/report.png', 'resources/textbook-retrieval/vectors.f32',
      'knowledge/projection/private.json', '.act-runtime-blobs/file.png', 'lessons/1-1/media/../answer.pdf',
      'lessons/1-1/media/file\0.png', 'lessons/1-1/media/private.json']) {
      expect(isPublicTeachingMediaPath(p), p).toBe(false);
    }
    expect(isPublicTeachingMediaPath('resources/textbooks/dorf/assets/A/figure.png')).toBe(true);
  });

  it('rejects unverified, duplicate and incorrectly classified publication indexes', () => {
    expect(parsePublicTeachingMediaIndex({ ...index(), verified: false })).toBeNull();
    const duplicate = index();
    duplicate.objects.push({ ...duplicate.objects[0] });
    expect(parsePublicTeachingMediaIndex(duplicate)).toBeNull();
    const bad = index();
    bad.objects[0].mediaType = 'text/html';
    expect(parsePublicTeachingMediaIndex(bad)).toBeNull();
  });

  it('uses only an exact published digest and never invents an object URL', async () => {
    install(index());
    expect(await publicTeachingMediaUrlForDigest(HASH)).toBe(`https://static.adapt-learn.online/teaching-media/sha256/${HASH}/asset.mp4`);
    expect(await publicTeachingMediaUrlForDigest('d'.repeat(64))).toBeNull();
    expect(await publicTeachingMediaUrlForDigest(HASH, 'image/png')).toBeNull();
  });

  it('fences path reads after a Runtime switch while preserving captured digest reads', async () => {
    install(index());
    expect(await publicTeachingMediaUrlForPath('lessons/1-1/media/intro.mp4')).not.toBeNull();
    writeFileSync(path.join(root, 'active.json'), JSON.stringify({
      schemaVersion: 'runtime-release-active-receipt.v1',
      selection: { releaseId: `runtime-${'e'.repeat(56)}`, manifestSha256: MANIFEST },
    }));
    expect(await publicTeachingMediaUrlForPath('lessons/1-1/media/intro.mp4')).toBeNull();
    expect(await publicTeachingMediaUrlForDigest(HASH)).not.toBeNull();
  });

  it('refreshes after atomic index replacement and restores fallback when disabled', async () => {
    install(index());
    expect(await publicTeachingMediaUrlForDigest(HASH)).not.toBeNull();
    install({ ...index(), verified: false });
    expect(await publicTeachingMediaUrlForDigest(HASH)).toBeNull();
    install(index());
    expect(await publicTeachingMediaUrlForDigest(HASH)).not.toBeNull();
  });

  it('binds an infograph redirect to the actual verified image bytes', async () => {
    const body = Buffer.from('accepted-infograph');
    const digest = createHash('sha256').update(body).digest('hex');
    const imageIndex = index();
    imageIndex.objects = [{ path: 'knowledge/infographs/authority/nodes/ctc_example.png',
      sha256: digest, sizeBytes: body.length, mediaType: 'image/png', publicEligible: true }];
    install(imageIndex);
    expect(await publicTeachingMediaUrlForBuffer(body, 'image/png')).toContain(digest);
    expect(await publicTeachingMediaUrlForBuffer(Buffer.from('changed'), 'image/png')).toBeNull();
  });
});
