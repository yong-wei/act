import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  getGrade: vi.fn(),
  findFirst: vi.fn(),
  readObject: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', () => ({ requireAssignmentActor: mocks.requireAssignmentActor }));
vi.mock('@/lib/assignments/assignment-grading-closure', () => ({
  AssignmentSubmissionGradeError: class AssignmentSubmissionGradeError extends Error {
    constructor(public readonly code: string, public readonly status: number) { super(code); }
  },
  getAssignmentSubmissionGrade: mocks.getGrade,
}));
vi.mock('@/lib/prisma', () => ({ prisma: { teacherAssignmentApprovalSnapshot: { findFirst: mocks.findFirst } } }));
vi.mock('@/lib/data-governance/teacher-assignment-review-derivative-storage', () => ({ readReviewedDerivativeObject: mocks.readObject }));

import { GET } from '../../../app/api/teacher/assignments/[assignmentId]/submissions/[submissionId]/reviews/[approvalId]/asset/route';

const context = { params: Promise.resolve({ assignmentId: 'assignment-1', submissionId: 'submission-1', approvalId: 'approval-1' }) };

describe('teacher reviewed PDF asset route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAssignmentActor.mockResolvedValue({ actor: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.getGrade.mockResolvedValue({});
  });

  it('requires the authorized grade snapshot before reading a derivative', async () => {
    const response = await GET(new Request('https://act.example/asset'), context);

    expect(response?.status).toBe(400);
    expect(mocks.getGrade).not.toHaveBeenCalled();
    expect(mocks.readObject).not.toHaveBeenCalled();
  });

  it('serves a checksum-verified PDF only after the grade scope authorizes the teacher', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.7\nreviewed');
    const checksum = `sha256:${Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex')}`;
    mocks.findFirst.mockResolvedValue({
      questionId: 'question-1',
      reviewedDerivatives: [{ outputObjectKey: 'teacher-reviewed/approval-1.pdf', outputChecksum: checksum, outputMimeType: 'application/pdf' }],
    });
    mocks.readObject.mockResolvedValue(bytes);

    const response = await GET(new Request('https://act.example/asset?snapshotId=grade-snapshot-1'), context);

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toBe('application/pdf');
    expect(response?.headers.get('content-disposition')).toContain('inline');
    expect(response?.headers.get('cache-control')).toBe('private, no-store');
    expect(mocks.getGrade).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ snapshotId: 'grade-snapshot-1', assignmentId: 'assignment-1', submissionId: 'submission-1' }));
  });

  it('does not expose bytes when the derivative checksum differs', async () => {
    mocks.findFirst.mockResolvedValue({
      questionId: 'question-1',
      reviewedDerivatives: [{ outputObjectKey: 'teacher-reviewed/approval-1.pdf', outputChecksum: 'sha256:wrong', outputMimeType: 'application/pdf' }],
    });
    mocks.readObject.mockResolvedValue(new TextEncoder().encode('%PDF-1.7\nreviewed'));

    const response = await GET(new Request('https://act.example/asset?snapshotId=grade-snapshot-1'), context);

    expect(response?.status).toBe(409);
  });
});
