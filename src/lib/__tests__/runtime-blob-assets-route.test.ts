import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  asyncSignatureUrl: vi.fn(),
  createEcsRamRoleOssClient: vi.fn(),
}));

vi.mock('@/lib/runtime-release-store', () => ({
  createEcsRamRoleOssClient: mocks.createEcsRamRoleOssClient,
}));

import { GET } from '@/app/api/course-runtime/blob-assets/[sha256]/route';

const originalEnvironment = { ...process.env };

function invoke(sha256: string) {
  return GET(
    new Request(`https://act.example/api/course-runtime/blob-assets/${sha256}`),
    { params: Promise.resolve({ sha256 }) },
  );
}

describe('runtime blob assets route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnvironment, ACT_RUNTIME_OSS_RAM_ROLE: 'act-runtime-ecs-role' };
    mocks.createEcsRamRoleOssClient.mockReturnValue({ asyncSignatureUrl: mocks.asyncSignatureUrl });
  });

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it('signs the content-addressed blob for a captured sha256', async () => {
    mocks.asyncSignatureUrl.mockResolvedValue('https://act-course-assets.oss-cn-hangzhou.aliyuncs.com/signed?Expires=777');
    const sha = 'a'.repeat(64);

    const response = await invoke(sha);

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('Expires=777');
    expect(mocks.asyncSignatureUrl).toHaveBeenCalledWith(
      `runtime/blobs/sha256/${sha}`,
      { expires: 300, method: 'GET' },
    );
  });

  it('rejects non-sha256 identifiers without touching OSS', async () => {
    const response = await invoke('not-a-sha');
    expect(response.status).toBe(404);
    expect(mocks.createEcsRamRoleOssClient).not.toHaveBeenCalled();
  });

  it('does not emit a public OSS URL when the workstation has no RAM role', async () => {
    delete process.env.ACT_RUNTIME_OSS_RAM_ROLE;
    const response = await invoke('b'.repeat(64));
    expect(response.status).toBe(404);
    expect(response.headers.get('location')).toBeNull();
    expect(mocks.createEcsRamRoleOssClient).not.toHaveBeenCalled();
  });
});
