import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findRuntimeMediaReleaseObject: vi.fn(),
  readActiveRuntimeReleaseManifest: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/runtime-active-release', () => ({
  findRuntimeMediaReleaseObject: mocks.findRuntimeMediaReleaseObject,
  readActiveRuntimeReleaseManifest: mocks.readActiveRuntimeReleaseManifest,
}));

import { projectRuntimeMediaResources } from '../course-runtime';

describe('projectRuntimeMediaResources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('replaces an indexed source URL with the active Runtime asset path without returning the source URL', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-current' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue({
      objectKey: 'runtime/blobs/sha256/asset',
      sha256: 'a'.repeat(64),
      sizeBytes: 1024,
    });

    const [resource] = await projectRuntimeMediaResources('lessons/1-1', [{
      id: '1-1-course',
      title: '课程视频',
      filename: '1-1-course.mp4',
      kind: 'video',
      url: 'https://external.example/signed-source',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
      featured: true,
    }]);

    expect(resource).toMatchObject({
      url: '/api/course-runtime/assets/lessons/1-1/media/1-1-course.mp4',
      status: 'ready',
    });
    expect(resource).not.toHaveProperty('legacyUrl');
    expect(JSON.stringify(resource)).not.toContain('external.example');
  });

  it('fails closed instead of returning an unmounted external media URL', async () => {
    mocks.readActiveRuntimeReleaseManifest.mockResolvedValue({ releaseId: 'runtime-current' });
    mocks.findRuntimeMediaReleaseObject.mockReturnValue(null);

    const [resource] = await projectRuntimeMediaResources('lessons/1-4', [{
      id: '1-4-course',
      title: '课程视频',
      filename: '1-4-course.mp4',
      kind: 'video',
      url: 'https://external.example/signed-source',
      accessMode: 'dialog',
      embedMode: 'iframe',
      status: 'ready',
      featured: true,
    }]);

    expect(resource).toMatchObject({ url: null, status: 'pending' });
    expect(JSON.stringify(resource)).not.toContain('external.example');
  });
});
