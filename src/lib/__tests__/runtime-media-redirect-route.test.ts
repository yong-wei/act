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

function invoke(assetPath: string[]) {
  return GET(
    new Request(`https://act.example/api/course-runtime/assets/${assetPath.map(encodeURIComponent).join('/')}`),
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

  it('fails closed for traversal, inactive objects, and missing runtime role configuration', async () => {
    mocks.isRuntimeMediaPath.mockReturnValueOnce(false);
    expect((await invoke(['..', 'secret.mp4'])).status).toBe(404);

    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-1' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue(null);
    expect((await invoke(['lessons', '1-1', 'media', 'missing.mp4'])).status).toBe(404);

    mocks.findRuntimeMediaReleaseObject.mockReturnValue({ objectKey: 'runtime/releases/runtime-1/lessons/1-1/media/intro.mp4' });
    delete process.env.ACT_RUNTIME_OSS_RAM_ROLE;
    expect((await invoke(['lessons', '1-1', 'media', 'intro.mp4'])).status).toBe(503);
  });
});
