import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  requireAssignmentMutation: vi.fn(),
  signRead: vi.fn(),
  readAsset: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assignments/assignment-route-guards')>();
  return {
    ...actual,
    requireAssignmentActor: mocks.requireAssignmentActor,
    requireAssignmentMutation: mocks.requireAssignmentMutation,
  };
});
vi.mock('@/lib/assignments/public-api', () => ({
  teacherSignOriginalAssetRead: mocks.signRead,
  teacherReadOriginalAsset: mocks.readAsset,
}));

import { GET, POST } from '../route';
import { SubmissionError } from '@/lib/assignments/submission-domain';

const actor = { id: 'teacher-1', role: 'TEACHER' } as const;
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
    mocks.requireAssignmentActor.mockResolvedValue({ actor });
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
      actor,
      expect.objectContaining({
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
    mocks.readAsset.mockResolvedValue({
      bytes: new TextEncoder().encode('original bytes'),
      displayName: 'report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 14,
    });

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
    mocks.readAsset.mockRejectedValue(new SubmissionError('asset-integrity-mismatch', 502));

    const response = (await GET(
      new Request('https://act.example/api/read?reviewId=review-1&token=one-time'),
      context,
    ))!;

    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain('private/object-key');
  });
});
