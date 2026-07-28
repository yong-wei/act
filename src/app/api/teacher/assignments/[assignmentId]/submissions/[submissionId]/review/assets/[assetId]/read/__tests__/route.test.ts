import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  requireAssignmentMutation: vi.fn(),
  signRead: vi.fn(),
  consumeRead: vi.fn(),
  readObject: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', () => ({
  requireAssignmentActor: mocks.requireAssignmentActor,
  requireAssignmentMutation: mocks.requireAssignmentMutation,
}));
vi.mock('@/lib/data-governance/teacher-assignment-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/data-governance/teacher-assignment-review')>();
  return {
    ...actual,
    signTeacherAssignmentOriginalAssetRead: mocks.signRead,
    consumeTeacherAssignmentOriginalAssetRead: mocks.consumeRead,
  };
});
vi.mock('@/lib/assignments/submission-object-store', () => ({
  createSubmissionObjectStore: () => ({ readObject: mocks.readObject }),
}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { GET, POST } from '../route';

const context = {
  params: Promise.resolve({
    assignmentId: 'assignment-1',
    submissionId: 'submission-1',
    assetId: 'asset-1',
  }),
};

describe('teacher original assignment asset read route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAssignmentActor.mockResolvedValue({
      actor: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.requireAssignmentMutation.mockReturnValue(null);
  });

  it('mints a short purpose-bound access URL only after teacher authorization', async () => {
    mocks.signRead.mockResolvedValue({
      url: '/api/teacher/original?token=one-time',
      expiresAt: '2026-07-27T00:05:00.000Z',
    });

    const response = (await POST(
      new Request('https://act.example/api/read?reviewId=review-1', {
        method: 'POST',
        headers: { origin: 'https://act.example' },
      }),
      context,
    ))!;

    expect(response.status).toBe(200);
    expect(mocks.signRead).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        actor: { id: 'teacher-1', role: 'TEACHER' },
        reviewId: 'review-1',
        assetId: 'asset-1',
      }),
    );
    await expect(response.json()).resolves.toEqual({
      access: {
        url: '/api/teacher/original?token=one-time',
        expiresAt: '2026-07-27T00:05:00.000Z',
      },
    });
  });

  it('serves checksum-verified bytes with private nosniff headers and a safe filename', async () => {
    const bytes = new TextEncoder().encode('original bytes');
    const checksum = `sha256:${Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')}`;
    mocks.consumeRead.mockResolvedValue({
      objectKey: 'private/object-key',
      displayName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: bytes.byteLength,
      checksum,
    });
    mocks.readObject.mockResolvedValue(bytes);

    const response = (await GET(
      new Request('https://act.example/api/read?reviewId=review-1&token=one-time'),
      context,
    ))!;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''report.pdf");
    await expect(response.text()).resolves.toBe('original bytes');
  });

  it('fails closed when persisted size or checksum does not match the object', async () => {
    mocks.consumeRead.mockResolvedValue({
      objectKey: 'private/object-key',
      displayName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 99,
      checksum: `sha256:${'0'.repeat(64)}`,
    });
    mocks.readObject.mockResolvedValue(new TextEncoder().encode('tampered'));

    const response = (await GET(
      new Request('https://act.example/api/read?reviewId=review-1&token=one-time'),
      context,
    ))!;

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private/object-key');
  });
});
