import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { verifyBoundRuntimeObject } from '@/lib/runtime-bound-object-read';
import { publicTeachingMediaUrlForBuffer, publicTeachingMediaUrlForDigest, publicTeachingMediaUrlForPath } from '@/lib/public-teaching-media';
import { buildRuntimeBlobReleaseManifestFromFiles, serializeRuntimeBlobReleaseManifest } from '@/lib/runtime-release';
import { createEcsRamRoleOssClient } from '@/lib/runtime-release-store';
import { canonicalRuntimeMediaLocation, parseRuntimeMediaDirectory, type RuntimePublicMediaDirectory } from '@/lib/runtime-media-storage';

const BODY = Buffer.from('canonical teaching media');
const HASH = createHash('sha256').update(BODY).digest('hex');
const MEDIA_PATH = 'lessons/1-1/media/intro.mp4';
const OBJECT_KEY = `teaching-media/sha256/${HASH}/asset.mp4`;
let root: string;

function directory(): RuntimePublicMediaDirectory {
  return { schemaVersion: 'act-public-teaching-media/v2', verified: true, legacyCopiesAvailable: false,
    objects: [{ sha256: HASH, sizeBytes: BODY.length, mediaType: 'video/mp4', objectKey: OBJECT_KEY, publicEligible: true }] };
}

function install(value: unknown) {
  writeFileSync(path.join(root, 'next.json'), JSON.stringify(value));
  renameSync(path.join(root, 'next.json'), path.join(root, 'directory.json'));
}

function select(mediaDigest = HASH, note = 'first') {
  const manifest = buildRuntimeBlobReleaseManifestFromFiles('a'.repeat(40), [
    { path: MEDIA_PATH, sha256: mediaDigest, sizeBytes: BODY.length },
    { path: 'lessons/1-1/lesson.json', sha256: createHash('sha256').update(note).digest('hex'), sizeBytes: note.length },
  ]);
  writeFileSync(path.join(root, '.act-runtime-release.v2.json'), serializeRuntimeBlobReleaseManifest(manifest));
  writeFileSync(path.join(root, 'active.json'), JSON.stringify({ schemaVersion: 'runtime-release-active-receipt.v1',
    selection: { schemaVersion: 'runtime-release-selection.v1', generation: 1,
      releaseId: manifest.releaseId, manifestSha256: manifest.manifestSha256, treeSha256: manifest.treeSha256 },
    healthCheck: 'readyz' }));
  return manifest;
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'canonical-runtime-media-'));
  vi.stubEnv('ACT_PUBLIC_TEACHING_MEDIA_INDEX_PATH', path.join(root, 'directory.json'));
  vi.stubEnv('ACT_RUNTIME_ROOT', root);
  vi.stubEnv('ACT_RUNTIME_ACTIVE_RECEIPT_PATH', path.join(root, 'active.json'));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('canonical media directory and release reads', () => {
  it('rejects a directory symlink even when it points to valid media metadata', () => {
    writeFileSync(path.join(root, 'target.json'), JSON.stringify(directory()));
    symlinkSync(path.join(root, 'target.json'), path.join(root, 'directory.json'));
    expect(canonicalRuntimeMediaLocation(`runtime/blobs/sha256/${HASH}`)).toBeNull();
  });
  it('rejects unqualified objects, unsafe locations, conflicting digests and wrong sizes or types', () => {
    expect(parseRuntimeMediaDirectory(directory())?.canonical).toBe(true);
    const badObjects = [
      { ...directory().objects[0], publicEligible: false },
      { ...directory().objects[0], objectKey: `runtime/blobs/sha256/${HASH}` },
      { ...directory().objects[0], objectKey: `teaching-media/sha256/${HASH}/../asset.mp4` },
      { ...directory().objects[0], sizeBytes: true },
      { ...directory().objects[0], sizeBytes: Number.MAX_SAFE_INTEGER + 1 },
      { ...directory().objects[0], mediaType: 'text/html' },
    ];
    for (const row of badObjects) expect(parseRuntimeMediaDirectory({ ...directory(), objects: [row] })).toBeNull();
    expect(parseRuntimeMediaDirectory({ ...directory(), objects: [directory().objects[0], directory().objects[0]] })).toBeNull();
  });

  it('accepts a legacy delivery index without treating its original body as relocated', async () => {
    install({ schemaVersion: 'act-public-teaching-media/v1', verified: true,
      sourceRuntime: { releaseId: `runtime-${'b'.repeat(55)}`, manifestSha256: 'c'.repeat(64) },
      objects: [{ path: MEDIA_PATH, sha256: HASH, sizeBytes: BODY.length, mediaType: 'video/mp4', publicEligible: true }] });
    expect(canonicalRuntimeMediaLocation(`runtime/blobs/sha256/${HASH}`)).toBeNull();
    expect(await publicTeachingMediaUrlForDigest(HASH)).toContain(OBJECT_KEY);
  });

  it('keeps an unchanged digest after a different Runtime file changes and fences same-path replacements', async () => {
    install(directory());
    const first = select();
    expect(await publicTeachingMediaUrlForPath(MEDIA_PATH)).toContain(OBJECT_KEY);
    const second = select(HASH, 'unrelated update');
    expect(second.releaseId).not.toBe(first.releaseId);
    expect(await publicTeachingMediaUrlForPath(MEDIA_PATH)).toContain(OBJECT_KEY);
    select('d'.repeat(64), 'new media');
    expect(await publicTeachingMediaUrlForPath(MEDIA_PATH)).toBeNull();
    expect(await publicTeachingMediaUrlForDigest(HASH)).toContain(OBJECT_KEY);
    expect(await publicTeachingMediaUrlForPath('.act-runtime-public-media/secret.mp4')).toBeNull();
  });

  it('rejects a manifest/receipt mismatch and a directory size mismatch', async () => {
    install(directory());
    select();
    const active = JSON.parse(readFileSync(path.join(root, 'active.json'), 'utf8'));
    active.selection.manifestSha256 = 'f'.repeat(64);
    writeFileSync(path.join(root, 'active.json'), JSON.stringify(active));
    expect(await publicTeachingMediaUrlForPath(MEDIA_PATH)).toBeNull();
    select();
    install({ ...directory(), objects: [{ ...directory().objects[0], sizeBytes: BODY.length + 1 }] });
    expect(await publicTeachingMediaUrlForPath(MEDIA_PATH)).toBeNull();
    expect(await publicTeachingMediaUrlForBuffer(BODY, 'video/mp4')).toBeNull();
  });

  it('reads a relocated body after the old copy is absent even with ESA disabled', async () => {
    install(directory());
    vi.stubEnv('ACT_PUBLIC_TEACHING_MEDIA_ESA_ENABLED', '0');
    const leaf = path.join(root, '.act-runtime-public-media', HASH, 'asset.mp4');
    mkdirSync(path.dirname(leaf), { recursive: true });
    writeFileSync(leaf, BODY);
    const logical = path.join(root, MEDIA_PATH);
    mkdirSync(path.dirname(logical), { recursive: true });
    symlinkSync(path.relative(path.dirname(logical), leaf), logical);
    expect(await publicTeachingMediaUrlForDigest(HASH)).toBeNull();
    await expect(verifyBoundRuntimeObject(root, MEDIA_PATH, HASH)).resolves.toMatchObject({ state: 'verified', contentSha256: HASH });
    await expect(verifyBoundRuntimeObject(root, MEDIA_PATH)).resolves.toMatchObject({ state: 'verified', contentSha256: HASH });
    await expect(verifyBoundRuntimeObject(root, MEDIA_PATH, 'e'.repeat(64))).resolves.toMatchObject({ state: 'checksum-mismatch', contentSha256: HASH });
    await expect(verifyBoundRuntimeObject(root, `blob:${HASH}`, HASH)).resolves.toMatchObject({ state: 'verified', contentSha256: HASH });
    writeFileSync(leaf, Buffer.from('corrupted canonical body'));
    await expect(verifyBoundRuntimeObject(root, `blob:${HASH}`, HASH)).resolves.toMatchObject({ state: 'checksum-mismatch' });
  });

  it('uses the real SDK adapter to stream and sign the canonical bucket, preserving manifest reads', async () => {
    install(directory());
    vi.stubEnv('ACT_PUBLIC_TEACHING_MEDIA_ESA_ENABLED', '0');
    const require = createRequire(import.meta.url);
    const credentials = require('@alicloud/credentials') as {
      default: { prototype: { getCredential(): Promise<{ accessKeyId: string; accessKeySecret: string; securityToken: string }> } };
    };
    vi.spyOn(credentials.default.prototype, 'getCredential').mockResolvedValue({
      accessKeyId: 'fixture-id', accessKeySecret: 'fixture-secret', securityToken: 'fixture-token',
    });
    type OssClient = { options: { bucket: string }; getStream(key: string): Promise<{ stream: Readable }>;
      asyncSignatureUrl(key: string, options: { expires: number; method: 'GET' }): Promise<string> };
    const oss = require('ali-oss') as { prototype: OssClient };
    const seen: Array<{ bucket: string; key: string }> = [];
    vi.spyOn(oss.prototype, 'getStream').mockImplementation(async function (this: OssClient, key) {
      seen.push({ bucket: this.options.bucket, key });
      return { stream: Readable.from([BODY]) };
    });
    vi.spyOn(oss.prototype, 'asyncSignatureUrl').mockImplementation(async function (this: OssClient, key) {
      seen.push({ bucket: this.options.bucket, key });
      return 'https://fixture.invalid/signed-media';
    });
    const client = createEcsRamRoleOssClient({ bucket: 'act-course-assets', region: 'oss-cn-hangzhou', roleName: 'fixture-reader' });
    const body = await client.getStream(`runtime/blobs/sha256/${HASH}`);
    const chunks: Buffer[] = [];
    for await (const chunk of body.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(BODY);
    await client.asyncSignatureUrl(`runtime/blobs/sha256/${HASH}`, { expires: 300, method: 'GET' });
    await client.getStream('runtime/blob-releases/fixed-release/manifest.json');
    expect(seen).toEqual([
      { bucket: 'act-course-models', key: OBJECT_KEY },
      { bucket: 'act-course-models', key: OBJECT_KEY },
      { bucket: 'act-course-assets', key: 'runtime/blob-releases/fixed-release/manifest.json' },
    ]);
  });
});
