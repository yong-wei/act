import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  requireAssignmentMutation: vi.fn(),
  readBoundedAssignmentJson: vi.fn(),
  teacherGetAssignmentGradingClosure: vi.fn(),
  teacherRefreshAssignmentGradingClosure: vi.fn(),
  teacherConfirmAssignmentResult: vi.fn(),
  teacherReleaseAssignmentResult: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', () => ({
  requireAssignmentActor: mocks.requireAssignmentActor,
  requireAssignmentMutation: mocks.requireAssignmentMutation,
  readBoundedAssignmentJson: mocks.readBoundedAssignmentJson,
}));
vi.mock('@/lib/assignments/public-api', () => {
  class AssignmentSubmissionGradeError extends Error {
    constructor(public code: string, public status: number, public details?: unknown) {
      super(code);
    }
  }

  return {
    AssignmentSubmissionGradeError,
    teacherGetAssignmentGradingClosure: mocks.teacherGetAssignmentGradingClosure,
    teacherRefreshAssignmentGradingClosure: mocks.teacherRefreshAssignmentGradingClosure,
    teacherConfirmAssignmentResult: mocks.teacherConfirmAssignmentResult,
    teacherConcludeAssignmentQuestion: vi.fn(),
    teacherReleaseAssignmentResult: mocks.teacherReleaseAssignmentResult,
    teacherReturnAssignmentQuestion: vi.fn(),
  };
});

import { GET, POST } from '@/app/api/teacher/assignments/[assignmentId]/submissions/[submissionId]/grade/route';
import { AssignmentSubmissionGradeError } from '@/lib/assignments/public-api';

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
    expect(mocks.teacherRefreshAssignmentGradingClosure).not.toHaveBeenCalled();
  });

  it('refreshes with the path submission id', async () => {
    mocks.teacherRefreshAssignmentGradingClosure.mockResolvedValue({ grade: { state: 'AWAITING_CONFIRMATION' } });

    const result = await POST(request({ action: 'REFRESH', snapshotId: 'snapshot-1' }), context);

    expect(result.status).toBe(201);
    expect(mocks.teacherRefreshAssignmentGradingClosure).toHaveBeenCalledWith(expect.objectContaining({
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      snapshotId: 'snapshot-1',
    }));
    await expect(result.json()).resolves.toMatchObject({ submissionId: 'submission-1' });
  });

  it('returns 200 when CONFIRM replays an idempotent request', async () => {
    mocks.teacherConfirmAssignmentResult.mockResolvedValue({ replay: true, confirmation: { totalScore: 6 } });

    const result = await POST(request({ action: 'CONFIRM', snapshotId: 'snapshot-1' }), context);

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toMatchObject({ confirmation: { totalScore: 6 } });
  });

  it('projects AssignmentSubmissionGradeError status and code', async () => {
    mocks.teacherRefreshAssignmentGradingClosure.mockRejectedValue(
      new AssignmentSubmissionGradeError('assignment-result-conflict', 409),
    );

    const result = await POST(request({ action: 'REFRESH', snapshotId: 'snapshot-1' }), context);

    expect(result.status).toBe(409);
    await expect(result.json()).resolves.toEqual({ error: 'assignment-result-conflict' });
  });

  it('returns unresolved question blockers for incomplete confirmations', async () => {
    mocks.teacherConfirmAssignmentResult.mockRejectedValue(
      new AssignmentSubmissionGradeError('assignment-result-incomplete', 409, { blockers: [{ questionId: 'question-2', reason: 'missing-attempt' }] }),
    );

    const result = await POST(request({ action: 'CONFIRM', snapshotId: 'snapshot-1' }), context);

    expect(result.status).toBe(409);
    await expect(result.json()).resolves.toEqual({ error: 'assignment-result-incomplete', details: { blockers: [{ questionId: 'question-2', reason: 'missing-attempt' }] } });
  });

  it('releases through the submission-bound grade route without a persisted confirmation id', async () => {
    mocks.teacherReleaseAssignmentResult.mockResolvedValue({ release: { state: 'AWAITING_CONFIRMATION', publishing: true }, replay: false });

    const result = await POST(request({ action: 'RELEASE', snapshotId: 'snapshot-1' }), context);

    expect(result.status).toBe(201);
    expect(mocks.teacherReleaseAssignmentResult).toHaveBeenCalledWith(expect.objectContaining({
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      snapshotId: 'snapshot-1',
    }));
    expect(mocks.teacherReleaseAssignmentResult).toHaveBeenCalledWith(expect.not.objectContaining({ confirmationId: expect.anything() }));
  });

  it('rejects legacy confirm bodies that still carry a materialized version fence', async () => {
    const result = await POST(request({ action: 'CONFIRM', snapshotId: 'snapshot-1', expectedVersion: 1, idempotencyKey: 'confirm-1' }), context);

    expect(result.status).toBe(422);
    expect(mocks.teacherConfirmAssignmentResult).not.toHaveBeenCalled();
  });

  it('serves the closure view over GET with the snapshot query', async () => {
    mocks.teacherGetAssignmentGradingClosure.mockResolvedValue({ grade: { state: 'AWAITING_CONFIRMATION', totalScore: 6 } });
    const getRequest = new Request('https://act.example/api/grade?snapshotId=snapshot-1');

    const result = await GET(getRequest, context);

    expect(result.status).toBe(200);
    await expect(result.json()).resolves.toMatchObject({ grade: { state: 'AWAITING_CONFIRMATION' } });
  });
});
