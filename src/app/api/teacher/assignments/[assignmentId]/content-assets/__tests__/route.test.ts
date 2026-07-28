import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getServerAuthSession,
  signAssignmentContentAssetUpload,
  completeAssignmentContentAssetUpload,
  readAssignmentContentAsset,
} = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  signAssignmentContentAssetUpload: vi.fn(),
  completeAssignmentContentAssetUpload: vi.fn(),
  readAssignmentContentAsset: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));
vi.mock('@/lib/assignments/assignment-content-assets', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/assignments/assignment-content-assets')>(),
  signAssignmentContentAssetUpload,
  completeAssignmentContentAssetUpload,
  readAssignmentContentAsset,
}));

import { POST as SIGN } from '../upload-sign/route';
import { POST as COMPLETE } from '../[assetId]/complete/route';
import { GET as READ } from '@/app/api/assignments/[assignmentId]/content-assets/[assetId]/route';

const context = { params: Promise.resolve({ assignmentId: 'assignment-1' }) };

describe('assignment content asset routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerAuthSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    signAssignmentContentAssetUpload.mockResolvedValue({
      assetId: 'asset-1',
      upload: { url: 'https://private.example/upload', requiredHeaders: {} },
    });
    completeAssignmentContentAssetUpload.mockResolvedValue({
      assetId: 'asset-1',
      href: '/api/assignments/assignment-1/content-assets/asset-1',
    });
    readAssignmentContentAsset.mockResolvedValue({
      bytes: Uint8Array.from([137, 80, 78, 71]),
      mimeType: 'image/png',
    });
  });

  it('rejects cross-origin upload mutations', async () => {
    const response = await SIGN(new Request(
      'https://act.example/api/teacher/assignments/assignment-1/content-assets/upload-sign',
      {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
        body: '{}',
      },
    ), context) as Response;
    expect(response.status).toBe(400);
    expect(signAssignmentContentAssetUpload).not.toHaveBeenCalled();
  });

  it('accepts only bounded PNG/JPEG upload intents', async () => {
    const request = (body: unknown) => new Request(
      'https://act.example/api/teacher/assignments/assignment-1/content-assets/upload-sign',
      {
        method: 'POST',
        headers: { origin: 'https://act.example' },
        body: JSON.stringify(body),
      },
    );
    const base = {
      fileName: 'figure.png',
      mimeType: 'image/png',
      sizeBytes: 100,
      checksum: `sha256:${'a'.repeat(64)}`,
    };
    expect(((await SIGN(request(base), context)) as Response).status).toBe(200);
    expect(((await SIGN(request({ ...base, mimeType: 'image/svg+xml' }), context)) as Response).status)
      .toBe(400);
    expect(((await SIGN(request({ ...base, sizeBytes: 25 * 1024 * 1024 + 1 }), context)) as Response).status)
      .toBe(400);
  });

  it('protects completion with authentication and same-origin mutation checks', async () => {
    getServerAuthSession.mockResolvedValueOnce(null);
    const request = () => new Request(
      'https://act.example/api/teacher/assignments/assignment-1/content-assets/asset-1/complete',
      { method: 'POST', headers: { origin: 'https://act.example' } },
    );
    expect(((await COMPLETE(request(), {
      params: Promise.resolve({ assignmentId: 'assignment-1', assetId: 'asset-1' }),
    })) as Response).status).toBe(401);
    expect(((await COMPLETE(request(), {
      params: Promise.resolve({ assignmentId: 'assignment-1', assetId: 'asset-1' }),
    })) as Response).status).toBe(200);
  });

  it('serves authorized private bytes without object metadata', async () => {
    const response = await READ(new Request(
      'https://act.example/api/assignments/assignment-1/content-assets/asset-1',
    ), {
      params: Promise.resolve({ assignmentId: 'assignment-1', assetId: 'asset-1' }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(readAssignmentContentAsset).toHaveBeenCalledWith(
      expect.anything(),
      {
        actorId: 'teacher-1',
        actorRole: 'TEACHER',
        assignmentId: 'assignment-1',
        assetId: 'asset-1',
      },
    );
  });
});
