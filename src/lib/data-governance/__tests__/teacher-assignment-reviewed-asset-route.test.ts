import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireStudentActor: vi.fn(),
  readFeedback: vi.fn(),
}));

vi.mock('@/lib/assignments/submission-route-guards', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assignments/submission-route-guards')>();
  return {
    ...actual,
    requireStudentActor: mocks.requireStudentActor,
  };
});
vi.mock('@/lib/assignments/public-api', () => ({
  studentReadFeedbackAsset: mocks.readFeedback,
}));

import { GET } from '../../../app/api/student/assignments/[assignmentId]/feedback/[snapshotId]/asset/route';
import { SubmissionError } from '@/lib/assignments/submission-domain';

const context = { params: Promise.resolve({ assignmentId: 'assignment-1', snapshotId: 'snapshot-1' }) };

describe('student reviewed derivative asset route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireStudentActor.mockResolvedValue({ actor: { id: 'student-1' } });
  });

  it('hides a ready release until its release outbox command has succeeded', async () => {
    mocks.readFeedback.mockRejectedValue(new SubmissionError('reviewed-asset-not-found', 404));

    const response = await GET(new Request('https://act.example/asset'), context);

    expect(response).toBeDefined();
    expect(response!.status).toBe(404);
  });

  it('serves the checksum-verified derivative after release settlement', async () => {
    const bytes = new TextEncoder().encode('reviewed feedback');
    mocks.readFeedback.mockResolvedValue({
      bytes,
      mimeType: 'text/markdown',
      filename: 'reviewed-assignment-question-1.md',
    });

    const response = await GET(new Request('https://act.example/asset'), context);

    expect(response).toBeDefined();
    expect(response!.status).toBe(200);
    expect(response!.headers.get('cache-control')).toBe('private, no-store');
    await expect(response!.text()).resolves.toBe('reviewed feedback');
  });
});
