import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  requireMutation: vi.fn(),
  list: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  approve: vi.fn(),
  returnReview: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: { id: 'db' } }));
vi.mock('@/lib/assignments/assignment-route-guards', () => ({
  requireAssignmentActor: mocks.requireActor,
  requireAssignmentMutation: mocks.requireMutation,
  readBoundedAssignmentJson: async (request: Request) => request.json(),
}));
vi.mock('@/lib/data-governance/teacher-assignment-review', () => ({
  TeacherAssignmentReviewError: class TeacherAssignmentReviewError extends Error {
    constructor(public code: string, public status: number, public details?: unknown) { super(code); }
  },
  listTeacherAssignmentSubmissions: mocks.list,
  getTeacherAssignmentReview: mocks.get,
  createTeacherAssignmentReview: mocks.create,
  saveTeacherAssignmentReview: mocks.save,
  approveTeacherAssignmentReview: mocks.approve,
  returnTeacherAssignmentReview: mocks.returnReview,
}));

import { GET as GET_SUBMISSIONS } from '../route';
import { GET as GET_REVIEW, PATCH as PATCH_REVIEW, POST as POST_REVIEW } from '../[submissionId]/review/route';
import { POST as APPROVE_REVIEW } from '../[submissionId]/review/approve/route';
import { POST as RETURN_REVIEW } from '../[submissionId]/review/return/route';

const actor = { id: 'teacher-1', role: 'TEACHER' } as const;
const assignmentContext = { params: Promise.resolve({ assignmentId: 'assignment-1' }) };
const reviewContext = { params: Promise.resolve({ assignmentId: 'assignment-1', submissionId: 'submission-1' }) };

function request(path: string, method: string, body?: unknown) {
  return new Request(`https://act.example${path}`, {
    method,
    headers: { origin: 'https://act.example', 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('teacher assignment submission review API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireActor.mockResolvedValue({ actor });
    mocks.requireMutation.mockReturnValue(null);
  });

  it('returns only the assignment-scoped authorized submission queue', async () => {
    mocks.list.mockResolvedValue([{ submissionId: 'submission-1', pendingReviewCount: 1 }]);
    const response = await GET_SUBMISSIONS(new Request('https://act.example/api/teacher/assignments/assignment-1/submissions'), assignmentContext) as Response;
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ items: [{ submissionId: 'submission-1', pendingReviewCount: 1 }] });
    expect(mocks.list).toHaveBeenCalledWith({ id: 'db' }, { actor, assignmentId: 'assignment-1' });
  });

  it('opens and reads a review only within assignment and submission path identity', async () => {
    mocks.create.mockResolvedValue({ review: { id: 'review-1', version: 1 }, replay: false });
    const opened = await POST_REVIEW(request('/api/teacher/assignments/assignment-1/submissions/submission-1/review', 'POST', { gradingRunId: 'run-1' }), reviewContext) as Response;
    expect(opened.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith({ id: 'db' }, { actor, assignmentId: 'assignment-1', submissionId: 'submission-1', gradingRunId: 'run-1' });

    mocks.get.mockResolvedValue({ id: 'review-1', version: 1 });
    const loaded = await GET_REVIEW(new Request('https://act.example/api/teacher/assignments/assignment-1/submissions/submission-1/review?reviewId=review-1'), reviewContext) as Response;
    expect(loaded.status).toBe(200);
    expect(mocks.get).toHaveBeenCalledWith({ id: 'db' }, { actor, assignmentId: 'assignment-1', submissionId: 'submission-1', reviewId: 'review-1', gradingRunId: undefined });
  });

  it('rejects a direct total override before saving working criteria', async () => {
    const response = await PATCH_REVIEW(request('/api/teacher/assignments/assignment-1/submissions/submission-1/review', 'PATCH', {
      reviewId: 'review-1', expectedVersion: 1, criteria: [], annotations: [], overallComment: '', total: 99,
    }), reviewContext) as Response;
    expect(response.status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it('passes current version and idempotency identity to atomic approval', async () => {
    mocks.approve.mockResolvedValue({ snapshot: { id: 'snapshot-1' }, replay: false, assignment: { complete: false, total: null } });
    const response = await APPROVE_REVIEW(request('/api/teacher/assignments/assignment-1/submissions/submission-1/review/approve', 'POST', {
      reviewId: 'review-1', expectedVersion: 3, idempotencyKey: 'approve-review-1',
    }), reviewContext) as Response;
    expect(response.status).toBe(201);
    expect(mocks.approve).toHaveBeenCalledWith({ id: 'db' }, expect.objectContaining({ actor, assignmentId: 'assignment-1', submissionId: 'submission-1', reviewId: 'review-1', expectedVersion: 3, idempotencyKey: 'approve-review-1' }));
  });

  it('creates a bounded question-scoped return grant', async () => {
    mocks.returnReview.mockResolvedValue({ grant: { id: 'grant-1' }, replay: false });
    const response = await RETURN_REVIEW(request('/api/teacher/assignments/assignment-1/submissions/submission-1/review/return', 'POST', {
      reviewId: 'review-1', expectedVersion: 3, idempotencyKey: 'return-review-1', reason: 'Please correct the sign error',
      allowedResponseType: 'SUBJECTIVE_TEXT', newDeadlineAt: '2026-07-20T00:00:00.000Z',
    }), reviewContext) as Response;
    expect(response.status).toBe(201);
    expect(mocks.returnReview).toHaveBeenCalledWith({ id: 'db' }, expect.objectContaining({
      actor, assignmentId: 'assignment-1', submissionId: 'submission-1', reviewId: 'review-1', expectedVersion: 3,
      newDeadlineAt: new Date('2026-07-20T00:00:00.000Z'),
    }));
  });
});
