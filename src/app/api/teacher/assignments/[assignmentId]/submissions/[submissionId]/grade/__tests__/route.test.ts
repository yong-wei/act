import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  requireAssignmentMutation: vi.fn(),
  readBoundedAssignmentJson: vi.fn(),
  getAssignmentSubmissionGrade: vi.fn(),
  refreshAssignmentSubmissionGrade: vi.fn(),
  confirmAssignmentSubmissionGrade: vi.fn(),
  releaseAssignmentSubmissionGrade: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', () => ({
  requireAssignmentActor: mocks.requireAssignmentActor,
  requireAssignmentMutation: mocks.requireAssignmentMutation,
  readBoundedAssignmentJson: mocks.readBoundedAssignmentJson,
}));
vi.mock('@/lib/data-governance/assignment-submission-grade', () => {
  class AssignmentSubmissionGradeError extends Error {
    constructor(public code: string, public status: number, public details?: unknown) {
      super(code);
    }
  }

  return {
    AssignmentSubmissionGradeError,
    confirmAssignmentSubmissionGrade: mocks.confirmAssignmentSubmissionGrade,
    getAssignmentSubmissionGrade: mocks.getAssignmentSubmissionGrade,
    recordAssignmentQuestionConclusion: vi.fn(),
    releaseAssignmentSubmissionGrade: mocks.releaseAssignmentSubmissionGrade,
    refreshAssignmentSubmissionGrade: mocks.refreshAssignmentSubmissionGrade,
  };
});
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { POST } from '../route';
import { AssignmentSubmissionGradeError } from '@/lib/data-governance/assignment-submission-grade';

const context = {
  params: Promise.resolve({ assignmentId: 'assignment-1', submissionId: 'submission-1' }),
};

function request(body: unknown) {
  return new Request('https://act.example/api/grade', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('teacher assignment grade route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAssignmentActor.mockResolvedValue({ actor: { id: 'teacher-1', role: 'TEACHER' } });
    mocks.requireAssignmentMutation.mockReturnValue(undefined);
    mocks.readBoundedAssignmentJson.mockImplementation((input: Request) => input.json());
  });

  it('returns the authentication response when unauthenticated', async () => {
    const response = new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    mocks.requireAssignmentActor.mockResolvedValue({ response });

    const result = await POST(request({ action: 'REFRESH', snapshotId: 'snapshot-1' }), context);

    expect(result).toBe(response);
    expect(mocks.refreshAssignmentSubmissionGrade).not.toHaveBeenCalled();
  });

  it('refreshes with the path submission id', async () => {
    mocks.refreshAssignmentSubmissionGrade.mockResolvedValue({ state: 'AWAITING_CONFIRMATION' });

    const result = await POST(request({ action: 'REFRESH', snapshotId: 'snapshot-1' }), context);

    expect(result.status).toBe(201);
    expect(mocks.refreshAssignmentSubmissionGrade).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      snapshotId: 'snapshot-1',
    }));
    await expect(result.json()).resolves.toMatchObject({ submissionId: 'submission-1' });
  });

  it('returns 200 when CONFIRM replays an idempotent request', async () => {
    mocks.confirmAssignmentSubmissionGrade.mockResolvedValue({ replay: true, state: 'CONFIRMED' });

    const result = await POST(request({
      action: 'CONFIRM',
      snapshotId: 'snapshot-1',
      expectedVersion: 1,
      idempotencyKey: 'confirm-1',
    }), context);

    expect(result.status).toBe(200);
  });

  it('projects AssignmentSubmissionGradeError status and code', async () => {
    mocks.refreshAssignmentSubmissionGrade.mockRejectedValue(
      new AssignmentSubmissionGradeError('assignment-result-conflict', 409),
    );

    const result = await POST(request({ action: 'REFRESH', snapshotId: 'snapshot-1' }), context);

    expect(result.status).toBe(409);
    await expect(result.json()).resolves.toEqual({ error: 'assignment-result-conflict' });
  });

  it('returns unresolved question blockers for incomplete confirmations', async () => {
    mocks.confirmAssignmentSubmissionGrade.mockRejectedValue(
      new AssignmentSubmissionGradeError('assignment-result-incomplete', 409, { blockers: [{ questionId: 'question-2', reason: 'missing-attempt' }] }),
    );

    const result = await POST(request({ action: 'CONFIRM', snapshotId: 'snapshot-1', expectedVersion: 1, idempotencyKey: 'confirm-grade-1' }), context);

    expect(result.status).toBe(409);
    await expect(result.json()).resolves.toEqual({ error: 'assignment-result-incomplete', details: { blockers: [{ questionId: 'question-2', reason: 'missing-attempt' }] } });
  });

  it('releases through the submission-bound grade route', async () => {
    mocks.releaseAssignmentSubmissionGrade.mockResolvedValue({ release: { id: 'release-1' }, replay: false });

    const result = await POST(request({ action: 'RELEASE', snapshotId: 'snapshot-1', confirmationId: 'confirmation-1', idempotencyKey: 'release-grade-1' }), context);

    expect(result.status).toBe(201);
    expect(mocks.releaseAssignmentSubmissionGrade).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ assignmentId: 'assignment-1', submissionId: 'submission-1', snapshotId: 'snapshot-1', confirmationId: 'confirmation-1' }));
  });
});
