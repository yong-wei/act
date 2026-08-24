import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAssignmentActor: vi.fn(),
  requireAssignmentMutation: vi.fn(),
  readBoundedAssignmentJson: vi.fn(),
  createAssignmentAiGradingBatches: vi.fn(),
  createManualQuestionGradingReview: vi.fn(),
  buildTeacherAssignmentReviewApiProjection: vi.fn(),
  retryQuestionGradingBatchItem: vi.fn(),
  retryDocumentConversion: vi.fn(),
  enqueueMathDocumentGradingJob: vi.fn(),
  findBatch: vi.fn(),
}));

vi.mock('@/lib/assignments/assignment-route-guards', () => ({
  requireAssignmentActor: mocks.requireAssignmentActor,
  requireAssignmentMutation: mocks.requireAssignmentMutation,
  readBoundedAssignmentJson: mocks.readBoundedAssignmentJson,
}));
vi.mock('@/lib/data-governance/assignment-grading-orchestration', () => ({
  createAssignmentAiGradingBatches: mocks.createAssignmentAiGradingBatches,
  createManualQuestionGradingReview: mocks.createManualQuestionGradingReview,
}));
vi.mock('@/lib/data-governance/math-document-grading-batch', () => ({
  retryQuestionGradingBatchItem: mocks.retryQuestionGradingBatchItem,
}));
vi.mock('@/lib/data-governance/math-document-grading-persistence', () => ({
  retryDocumentConversion: mocks.retryDocumentConversion,
}));
vi.mock('@/lib/data-governance/math-document-grading-queue', () => ({
  enqueueMathDocumentGradingJob: mocks.enqueueMathDocumentGradingJob,
}));
vi.mock('@/lib/data-governance/teacher-assignment-review', () => ({
  buildTeacherAssignmentReviewApiProjection: mocks.buildTeacherAssignmentReviewApiProjection,
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    gradingBatch: { findUnique: mocks.findBatch },
  },
}));

import { POST as startGrading } from '../route';
import { POST as createManualGrading } from '../manual/route';
import { POST as retryGradingItem } from '../batches/[batchId]/items/[itemId]/retry/route';

const actor = { id: 'teacher-1', role: 'TEACHER' as const };
const gradingContext = { params: Promise.resolve({ assignmentId: 'assignment-1' }) };
const retryContext = {
  params: Promise.resolve({ assignmentId: 'assignment-1', batchId: 'batch-1', itemId: 'item-1' }),
};

function request(body: unknown) {
  return new Request('https://act.example/api/teacher/assignments/assignment-1/grading', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

describe('teacher assignment grading routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAssignmentActor.mockResolvedValue({ actor });
    mocks.requireAssignmentMutation.mockReturnValue(undefined);
    mocks.readBoundedAssignmentJson.mockImplementation((input: Request) => input.json());
    mocks.buildTeacherAssignmentReviewApiProjection.mockReturnValue({ id: 'review-1' });
  });

  it('returns the authentication response before starting an AI operation', async () => {
    const response = new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    mocks.requireAssignmentActor.mockResolvedValue({ response });

    const result = await startGrading(request({ idempotencyKey: 'grading-key-1' }), gradingContext);

    expect(result).toBe(response);
    expect(mocks.createAssignmentAiGradingBatches).not.toHaveBeenCalled();
  });

  it('starts one-click AI grading with the frozen selection options', async () => {
    mocks.createAssignmentAiGradingBatches.mockResolvedValue({ id: 'operation-1', replay: false });

    const result = await startGrading(request({
      revisionId: 'revision-1',
      idempotencyKey: 'grading-key-1',
      studentIds: ['student-1', 'student-2'],
      excludedStudentIds: ['student-2'],
      evaluatorId: 'qwen',
      evaluatorVersion: 'phase7',
    }), gradingContext);

    expect(result!.status).toBe(202);
    expect(mocks.createAssignmentAiGradingBatches).toHaveBeenCalledWith(expect.objectContaining({
      assignmentId: 'assignment-1',
      revisionId: 'revision-1',
      actor,
      idempotencyKey: 'grading-key-1',
      studentIds: ['student-1', 'student-2'],
      excludedStudentIds: ['student-2'],
      batchOptions: expect.objectContaining({ evaluatorId: 'qwen', evaluatorVersion: 'phase7' }),
    }));
  });

  it('maps a pre-deadline AI grading rejection to conflict', async () => {
    mocks.createAssignmentAiGradingBatches.mockRejectedValue(new Error('assignment-grading-before-deadline'));

    const result = await startGrading(request({ idempotencyKey: 'grading-key-1' }), gradingContext);

    expect(result!.status).toBe(409);
    await expect(result!.json()).resolves.toEqual({ error: 'assignment-grading-before-deadline' });
  });

  it('creates a durable MANUAL question result without a Provider route', async () => {
    mocks.createManualQuestionGradingReview.mockResolvedValue({
      run: { id: 'run-1', source: 'MANUAL', state: 'AWAITING_REVIEW' },
      review: { id: 'review-1' },
      replay: false,
    });

    const result = await createManualGrading(request({
      submissionId: 'submission-1',
      questionId: 'question-1',
      idempotencyKey: 'manual-key-1',
    }), gradingContext);

    expect(result!.status).toBe(201);
    expect(mocks.createManualQuestionGradingReview).toHaveBeenCalledWith(expect.objectContaining({
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      questionId: 'question-1',
      actor,
    }));
    await expect(result!.json()).resolves.toEqual({
      run: { id: 'run-1', source: 'MANUAL', state: 'AWAITING_REVIEW' },
      review: { id: 'review-1' },
      replay: false,
    });
  });

  it('rejects retrying a batch that belongs to another assignment', async () => {
    mocks.findBatch.mockResolvedValue({ revision: { assignmentId: 'assignment-2' } });

    const result = await retryGradingItem(request({
      idempotencyKey: 'retry-key-1',
      reason: '教师显式重试失败题目',
    }), retryContext);

    expect(result!.status).toBe(404);
    expect(mocks.retryQuestionGradingBatchItem).not.toHaveBeenCalled();
  });

  it('returns the existing job for an idempotent failed-item retry', async () => {
    mocks.findBatch.mockResolvedValue({ revision: { assignmentId: 'assignment-1' }, items: [] });
    mocks.retryQuestionGradingBatchItem.mockResolvedValue({ job: { id: 'job-1' }, replay: true });

    const result = await retryGradingItem(request({
      idempotencyKey: 'retry-key-1',
      reason: '教师显式重试失败题目',
    }), retryContext);

    expect(result!.status).toBe(200);
    expect(mocks.retryQuestionGradingBatchItem).toHaveBeenCalledWith(expect.objectContaining({
      batchId: 'batch-1',
      itemId: 'item-1',
      actor,
      idempotencyKey: 'retry-key-1',
    }));
    await expect(result!.json()).resolves.toEqual({ job: { id: 'job-1' }, replay: true });
  });

  it('retries a blocked document conversion before retrying its dependent grading item', async () => {
    mocks.findBatch.mockResolvedValue({
      revision: { assignmentId: 'assignment-1' },
      items: [{ conversionId: 'conversion-1', conversion: { state: 'BLOCKED' } }],
    });
    mocks.retryDocumentConversion.mockResolvedValue({ conversion: { id: 'conversion-1' }, job: { id: 'conversion-job-1' }, replay: false });
    mocks.enqueueMathDocumentGradingJob.mockResolvedValue({ queued: true });

    const result = await retryGradingItem(request({
      idempotencyKey: 'retry-key-1',
      reason: '教师显式重试失败题目',
    }), retryContext);

    expect(result!.status).toBe(202);
    expect(mocks.retryDocumentConversion).toHaveBeenCalledWith(expect.objectContaining({ conversionId: 'conversion-1', actor }));
    expect(mocks.enqueueMathDocumentGradingJob).toHaveBeenCalledWith({ kind: 'conversion', jobId: 'conversion-job-1', conversionId: 'conversion-1' }, expect.anything());
    expect(mocks.retryQuestionGradingBatchItem).not.toHaveBeenCalled();
    await expect(result!.json()).resolves.toEqual({ job: { id: 'conversion-job-1' }, replay: false, stage: 'conversion' });
  });
});
