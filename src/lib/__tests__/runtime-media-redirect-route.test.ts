import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  asyncSignatureUrl: vi.fn(),
  createEcsRamRoleOssClient: vi.fn(),
  findRuntimeMediaReleaseObject: vi.fn(),
  isRuntimeMediaPath: vi.fn(),
  readActiveRuntimeReleaseManifest: vi.fn(),
  getStream: vi.fn(),
}));

vi.mock('@/lib/runtime-release', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/runtime-release')>();
  return {
    ...actual,
    // The canonical manifest digests are covered by runtime-release tests;
    // this route test only needs a parseable pinned manifest shape.
    parseAnyRuntimeReleaseManifest: vi.fn((value: unknown) => value),
  };
});

vi.mock('@/lib/runtime-active-release', () => ({
  findRuntimeMediaReleaseObject: mocks.findRuntimeMediaReleaseObject,
  isRuntimeMediaPath: mocks.isRuntimeMediaPath,
  readActiveRuntimeReleaseManifest: mocks.readActiveRuntimeReleaseManifest,
}));

vi.mock('@/lib/runtime-release-store', () => ({
  createEcsRamRoleOssClient: mocks.createEcsRamRoleOssClient,
}));

import { GET } from '@/app/api/course-runtime/assets/[...assetPath]/route';

const originalEnvironment = { ...process.env };

function invoke(assetPath: string[], search = '') {
  return GET(
    new Request(`https://act.example/api/course-runtime/assets/${assetPath.map(encodeURIComponent).join('/')}${search}`),
    { params: Promise.resolve({ assetPath }) },
  );
}

describe('runtime media signed redirect route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnvironment, ACT_RUNTIME_OSS_RAM_ROLE: 'act-runtime-ecs-role' };
    mocks.isRuntimeMediaPath.mockReturnValue(true);
    mocks.createEcsRamRoleOssClient.mockReturnValue({
      asyncSignatureUrl: mocks.asyncSignatureUrl,
      getStream: mocks.getStream,
    });
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('falls back to the legacy filesystem route before an OSS release is active', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue(null);

    const response = await invoke(['lessons', '1-1', 'media', '课程视频.mp4']);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://act.example/course-runtime/lessons/1-1/media/%E8%AF%BE%E7%A8%8B%E8%A7%86%E9%A2%91.mp4');
    expect(mocks.createEcsRamRoleOssClient).not.toHaveBeenCalled();
  });

  it('serves a pinned release manifest after the active release has switched', async () => {
    mocks.getStream.mockResolvedValue({
      stream: Readable.from([JSON.stringify({
        schemaVersion: 'act-runtime-release.v1',
        releaseId: 'runtime-captured',
        sourceRevision: 'rev-1',
        fileCount: 0,
        totalBytes: 10,
        treeSha256: 't'.repeat(64),
        manifestSha256: 'm'.repeat(64),
        files: [],
      })]),
    });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue({ objectKey: 'runtime/releases/runtime-captured/lessons/1-1/media/intro.mp4' });
    mocks.asyncSignatureUrl.mockResolvedValue('https://act-course-assets.oss-cn-hangzhou.aliyuncs.com/signed?Expires=321');

    const response = await GET(
      new Request('https://act.example/api/course-runtime/assets/lessons/1-1/media/intro.mp4?releaseId=runtime-captured'),
      { params: Promise.resolve({ assetPath: ['lessons', '1-1', 'media', 'intro.mp4'] }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('Expires=321');
    expect(mocks.readActiveRuntimeReleaseManifest).not.toHaveBeenCalled();
    expect(mocks.getStream).toHaveBeenCalledWith('runtime/releases/runtime-captured/.act-runtime-release.v1.json');
  });

  it('falls back to the filesystem route for a captured unreleased worktree locator', async () => {
    const response = await GET(
      new Request('https://act.example/api/course-runtime/assets/lessons/1-1/media/intro.mp4?releaseId=unreleased-worktree'),
      { params: Promise.resolve({ assetPath: ['lessons', '1-1', 'media', 'intro.mp4'] }) },
    );

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://act.example/course-runtime/lessons/1-1/media/intro.mp4');
    expect(mocks.createEcsRamRoleOssClient).not.toHaveBeenCalled();
  });

  it('redirects only an active-manifest media object through a short-lived OSS URL', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-1' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue({ objectKey: 'runtime/releases/runtime-1/lessons/1-1/media/intro.mp4' });
    mocks.asyncSignatureUrl.mockResolvedValue('https://act-course-assets.oss-cn-hangzhou.aliyuncs.com/signed?Expires=123');

    const response = await invoke(['lessons', '1-1', 'media', 'intro.mp4']);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('Expires=123');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.createEcsRamRoleOssClient).toHaveBeenCalledWith({
      bucket: 'act-course-assets',
      region: 'oss-cn-hangzhou',
      roleName: 'act-runtime-ecs-role',
    });
    expect(mocks.asyncSignatureUrl).toHaveBeenCalledWith(
      'runtime/releases/runtime-1/lessons/1-1/media/intro.mp4',
      { expires: 300, method: 'GET' },
    );
  });

  it('signs only the active v2 manifest blob key without exposing a permanent OSS URL', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-v2' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue({ objectKey: `runtime/blobs/sha256/${'a'.repeat(64)}` });
    mocks.asyncSignatureUrl.mockResolvedValue('https://act-course-assets.oss-cn-hangzhou.aliyuncs.com/signed?Expires=123');

    const response = await invoke(['lessons', '1-1', 'media', 'intro.mp4']);

    expect(response.status).toBe(307);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.asyncSignatureUrl).toHaveBeenCalledWith(
      `runtime/blobs/sha256/${'a'.repeat(64)}`,
      { expires: 300, method: 'GET' },
    );
  });

  it('fails closed for traversal and inactive objects', async () => {
    mocks.isRuntimeMediaPath.mockReturnValueOnce(false);
    expect((await invoke(['..', 'secret.mp4'])).status).toBe(404);

    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-1' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue(null);
    expect((await invoke(['lessons', '1-1', 'media', 'missing.mp4'])).status).toBe(404);
  });

  it('serves bound release bytes when the workstation has no RAM role', async () => {
    const body = Buffer.from('bound-media');
    const sha256 = createHash('sha256').update(body).digest('hex');
    const runtimeRoot = mkdtempSync(path.join(tmpdir(), 'runtime-media-bound-'));
    mkdirSync(path.join(runtimeRoot, 'lessons/1-1/media'), { recursive: true });
    writeFileSync(path.join(runtimeRoot, 'lessons/1-1/media/intro.mp4'), body);
    process.env.ACT_RUNTIME_ROOT = runtimeRoot;
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-1' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue({
      objectKey: `runtime/blobs/sha256/${sha256}`,
      sha256,
    });
    delete process.env.ACT_RUNTIME_OSS_RAM_ROLE;
    try {
      const local = await invoke(['lessons', '1-1', 'media', 'intro.mp4']);
      expect(local.status).toBe(200);
      expect(local.headers.get('x-act-runtime-read')).toBe('bound-release');
      expect(Buffer.from(await local.arrayBuffer()).toString()).toBe('bound-media');
      expect(mocks.createEcsRamRoleOssClient).not.toHaveBeenCalled();
    } finally {
      rmSync(runtimeRoot, { recursive: true, force: true });
    }
  });

  it('classifies pinned-release read failures instead of falling back to local fixtures', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-1' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue({
      objectKey: `runtime/blobs/sha256/${'a'.repeat(64)}`,
      sha256: 'a'.repeat(64),
    });
    delete process.env.ACT_RUNTIME_OSS_RAM_ROLE;
    const missing = await invoke(['lessons', '1-1', 'media', 'intro.mp4']);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      error: 'Runtime media asset was not found.',
      code: 'missing',
    });
    expect(missing.headers.get('location')).toBeNull();
  });

  it('does not serve a mismatched pinned release from the local view', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-1' });
    delete process.env.ACT_RUNTIME_OSS_RAM_ROLE;
    const mismatched = await invoke(['lessons', '1-1', 'media', 'intro.mp4'], '?releaseId=runtime-old');
    expect(mismatched.status).toBe(404);
    expect(await mismatched.json()).toEqual({
      error: 'Runtime media asset does not match the pinned release.',
      code: 'release-mismatch',
    });
    expect(mocks.createEcsRamRoleOssClient).not.toHaveBeenCalled();
  });

  it('declares unpinned local fallback when no release is mounted', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue(null);
    delete process.env.ACT_RUNTIME_OSS_RAM_ROLE;
    const local = await invoke(['lessons', '1-1', 'media', 'intro.mp4']);
    expect(local.status).toBe(307);
    expect(local.headers.get('x-act-runtime-fallback')).toBe('local-unpinned');
    expect(local.headers.get('location')).toBe('https://act.example/course-runtime/lessons/1-1/media/intro.mp4');
  });
});
