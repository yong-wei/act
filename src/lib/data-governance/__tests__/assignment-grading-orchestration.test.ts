import { describe, expect, it, vi } from 'vitest';

const {
  createQuestionScopedGradingBatch,
  processQuestionGradingBatch,
  assertPipelineActorScope,
  questionContractFromRow,
  createTeacherAssignmentReview,
  resolveTeacherAssignmentReviewAuthorization,
} = vi.hoisted(() => ({
  createQuestionScopedGradingBatch: vi.fn(),
  processQuestionGradingBatch: vi.fn(),
  assertPipelineActorScope: vi.fn().mockResolvedValue(undefined),
  questionContractFromRow: vi.fn(() => ({
    questionId: 'question-1',
    contentHash: 'sha256:question',
    referenceAnswer: 'reference',
    rubric: { id: 'rubric-1', version: 'rubric-v1', maxScore: 10, criteria: [{ id: 'criterion-1', maxPoints: 10 }] },
  })),
  createTeacherAssignmentReview: vi.fn(),
  resolveTeacherAssignmentReviewAuthorization: vi.fn(),
}));

vi.mock('../math-document-grading-batch', () => ({ createQuestionScopedGradingBatch, processQuestionGradingBatch }));
vi.mock('../math-document-grading-persistence', () => ({ assertPipelineActorScope, questionContractFromRow }));
vi.mock('../teacher-assignment-review', () => ({ createTeacherAssignmentReview, resolveTeacherAssignmentReviewAuthorization }));

import {
  createAssignmentAiGradingBatches,
  createManualQuestionGradingReview,
  executeAssignmentAiGradingBatches,
  submissionRequiresIncrementalGrading,
} from '../assignment-grading-orchestration';

const now = new Date('2026-08-14T12:00:00.000Z');

function revisionFixture() {
  return {
    id: 'revision-1',
    assignmentId: 'assignment-1',
    state: 'PUBLISHED',
    assignment: { id: 'assignment-1', authorId: 'teacher-1', reviewGrants: [] },
    questions: [{ id: 'question-1', orderIndex: 0, contentHash: 'sha256:question-1' }, { id: 'question-2', orderIndex: 1, contentHash: 'sha256:question-2' }],
    audiences: [
      { id: 'audience-1', classId: 'class-1', dueAt: new Date('2026-08-13T12:00:00.000Z'), archivedAt: null, class: { id: 'class-1', teacherId: 'teacher-1', isActive: true } },
      { id: 'audience-2', classId: 'class-2', dueAt: new Date('2026-08-15T12:00:00.000Z'), archivedAt: null, class: { id: 'class-2', teacherId: 'teacher-1', isActive: true } },
    ],
  };
}

describe('assignment grading orchestration', () => {
  it('selects a resubmitted attempt but excludes an unchanged released vector', () => {
    const questions = revisionFixture().questions;
    const submission = {
      answers: [
        { assignmentQuestionId: 'question-1', currentAttemptNumber: 2, attempts: [{ id: 'attempt-1', attemptNumber: 1 }, { id: 'attempt-1-resubmitted', attemptNumber: 2 }] },
        { assignmentQuestionId: 'question-2', currentAttemptNumber: 1, attempts: [{ id: 'attempt-2', attemptNumber: 1 }] },
      ],
      gradingSnapshots: [{
        grade: { state: 'RELEASED' },
        items: [{ questionId: 'question-1', attemptId: 'attempt-1' }, { questionId: 'question-2', attemptId: 'attempt-2' }],
      }],
    };

    expect(submissionRequiresIncrementalGrading(submission, questions)).toBe(true);
    submission.answers[0].currentAttemptNumber = 1;
    expect(submissionRequiresIncrementalGrading(submission, questions)).toBe(false);
    submission.gradingSnapshots[0].grade.state = 'PENDING_GRADING';
    expect(submissionRequiresIncrementalGrading(submission, questions)).toBe(false);
  });

  it('freezes selected ended submissions and only batches their captured attempts', async () => {
    const revision = revisionFixture();
    createQuestionScopedGradingBatch.mockResolvedValue({ batch: { id: 'batch-1' }, items: [], replay: false });
    const submissions = [
      { id: 'submission-1', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-1', state: 'SUBMITTED', frozenAudienceClassId: 'class-1', frozenAudienceDueAt: revision.audiences[0].dueAt, answers: [{ id: 'answer-1', assignmentQuestionId: 'question-1', currentAttemptNumber: 2, attempts: [{ id: 'attempt-old', attemptNumber: 1, answerVersion: 1 }, { id: 'attempt-1', attemptNumber: 2, answerVersion: 2 }] }] },
      { id: 'submission-2', assignmentRevisionId: 'revision-1', audienceId: 'audience-2', studentId: 'student-2', state: 'SUBMITTED', frozenAudienceClassId: 'class-2', frozenAudienceDueAt: revision.audiences[1].dueAt, answers: [] },
    ];
    const operations: any[] = [];
    const db: any = {
      assignmentRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
      assignmentGradingOperation: {
        findUnique: vi.fn(async () => operations[0] ?? null),
        create: vi.fn(async ({ data }: any) => {
          const row = {
            ...data,
            snapshots: data.snapshots.create.map((snapshot: any) => ({
              ...snapshot,
              items: snapshot.items.create,
              submission: { studentId: submissions.find((submission) => submission.id === snapshot.submissionId)!.studentId },
            })),
          };
          operations.push(row);
          return row;
        }),
      },
    };

    const result = await createAssignmentAiGradingBatches({
      db,
      assignmentId: 'assignment-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'assignment-batch-1',
      studentIds: ['student-1'],
      excludedStudentIds: ['student-2'],
      now,
    });

    expect(result.submittedStudentIds).toEqual(['student-1']);
    expect(createQuestionScopedGradingBatch).toHaveBeenCalledTimes(2);
    expect(createQuestionScopedGradingBatch).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ classId: 'class-1', studentIds: ['student-1'], attemptIds: ['attempt-1'] }),
    }));
    expect(operations[0].snapshots[0]).toMatchObject({ frozenAudienceId: 'audience-1', originalDueAt: revision.audiences[0].dueAt });
    expect(operations[0].snapshots[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'question-1', attemptId: 'attempt-1', attemptNumber: 2 }),
      expect.objectContaining({ questionId: 'question-2', attemptId: null }),
    ]));
  });

  it('includes a partially submitted student while retaining missing questions in the frozen vector', async () => {
    const revision = revisionFixture();
    createQuestionScopedGradingBatch.mockResolvedValue({ batch: { id: 'batch-1' }, items: [], replay: false });
    const submissions = [{ id: 'submission-partial', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-partial', state: 'IN_PROGRESS', frozenAudienceClassId: 'class-1', frozenAudienceDueAt: revision.audiences[0].dueAt, answers: [{ id: 'answer-1', assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1, answerVersion: 1 }] }] }];
    const db: any = {
      assignmentRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
      assignmentGradingOperation: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }: any) => ({ ...data, snapshots: data.snapshots.create.map((snapshot: any) => ({ ...snapshot, items: snapshot.items.create, submission: { studentId: 'student-partial' } })) })),
      },
    };

    const result = await createAssignmentAiGradingBatches({ db, assignmentId: 'assignment-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'partial-submission', now });

    expect(db.assignmentSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ state: { in: ['SUBMITTED', 'IN_PROGRESS'] } }) }));
    expect(result.submittedStudentIds).toEqual(['student-partial']);
    expect(result.operation.snapshots[0].items).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'question-1', attemptId: 'attempt-1' }),
      expect.objectContaining({ questionId: 'question-2', attemptId: null }),
    ]));
  });

  it('binds the latest enabled class-scoped rubric policy when the teacher leaves it unspecified', async () => {
    const revision = revisionFixture();
    const submissions = [{ id: 'submission-policy', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-policy', state: 'SUBMITTED', frozenAudienceClassId: 'class-1', frozenAudienceDueAt: revision.audiences[0].dueAt, answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-policy', attemptNumber: 1 }] }] }];
    const db: any = {
      assignmentRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
      gradingProviderPolicy: { findMany: vi.fn().mockResolvedValue([{ id: 'policy-default', classScope: ['*'] }]) },
      assignmentGradingOperation: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }: any) => ({ ...data, snapshots: data.snapshots.create.map((snapshot: any) => ({ ...snapshot, items: snapshot.items.create, submission: { studentId: 'student-policy' } })) })),
      },
    };
    createQuestionScopedGradingBatch.mockResolvedValue({ batch: { id: 'batch-policy' }, items: [], replay: false });

    await createAssignmentAiGradingBatches({ db, assignmentId: 'assignment-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'default-policy', now });

    expect(db.gradingProviderPolicy.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { purpose: 'rubric-grading', enabled: true, disabledAt: null },
    }));
    expect(createQuestionScopedGradingBatch).toHaveBeenCalledWith(expect.objectContaining({
      request: expect.objectContaining({ policyId: 'policy-default' }),
    }));
  });

  it('replays the same operation without creating another immutable snapshot', async () => {
    const revision = revisionFixture();
    createQuestionScopedGradingBatch.mockResolvedValue({ batch: { id: 'batch-1' }, items: [], replay: true });
    const submissions = [{ id: 'submission-1', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-1', state: 'SUBMITTED', frozenAudienceClassId: 'class-1', frozenAudienceDueAt: revision.audiences[0].dueAt, answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }] }];
    const operations: any[] = [];
    const db: any = {
      assignmentRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
      assignmentGradingOperation: {
        findUnique: vi.fn(async () => operations[0] ?? null),
        create: vi.fn(async ({ data }: any) => {
          const row = { ...data, snapshots: data.snapshots.create.map((snapshot: any) => ({ ...snapshot, items: snapshot.items.create, submission: { studentId: 'student-1' } })) };
          operations.push(row);
          return row;
        }),
      },
    };
    const input = { db, assignmentId: 'assignment-1', actor: { id: 'teacher-1', role: 'TEACHER' as const }, idempotencyKey: 'repeat-operation', now };
    await createAssignmentAiGradingBatches(input);
    const replay = await createAssignmentAiGradingBatches(input);
    expect(replay.replay).toBe(true);
    expect(db.assignmentGradingOperation.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed operation request under an existing idempotency key', async () => {
    const revision = revisionFixture();
    const submissions = [{ id: 'submission-1', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-1', state: 'SUBMITTED', frozenAudienceClassId: 'class-1', frozenAudienceDueAt: revision.audiences[0].dueAt, answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }] }];
    const operations: any[] = [];
    const db: any = {
      assignmentRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
      assignmentGradingOperation: {
        findUnique: vi.fn(async () => operations[0] ?? null),
        create: vi.fn(async ({ data }: any) => {
          const row = { ...data, snapshots: data.snapshots.create.map((snapshot: any) => ({ ...snapshot, items: snapshot.items.create, submission: { studentId: 'student-1' } })) };
          operations.push(row);
          return row;
        }),
      },
    };
    createQuestionScopedGradingBatch.mockResolvedValue({ batch: { id: 'batch-1' }, items: [], replay: true });
    await createAssignmentAiGradingBatches({ db, assignmentId: 'assignment-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'operation-conflict', studentIds: ['student-1'], now });
    await expect(createAssignmentAiGradingBatches({ db, assignmentId: 'assignment-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'operation-conflict', now }))
      .rejects.toThrow('assignment-grading-operation-conflict');
  });

  it('rejects a concurrent duplicate attempt vector under a different idempotency key', async () => {
    const revision = revisionFixture();
    const submissions = [{ id: 'submission-1', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-1', state: 'SUBMITTED', frozenAudienceClassId: 'class-1', frozenAudienceDueAt: revision.audiences[0].dueAt, answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }] }];
    const db: any = {
      assignmentRevision: { findFirst: vi.fn().mockResolvedValue(revision) },
      assignmentSubmission: { findMany: vi.fn().mockResolvedValue(submissions) },
      assignmentGradingOperation: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };

    await expect(createAssignmentAiGradingBatches({
      db,
      assignmentId: 'assignment-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'concurrent-vector-duplicate',
      now,
    })).rejects.toThrow('assignment-grading-operation-conflict');
  });

  it('rejects one-click grading before every eligible audience deadline', async () => {
    const revision = revisionFixture();
    revision.audiences[0].dueAt = new Date('2026-08-15T12:00:00.000Z');
    const db: any = { assignmentRevision: { findFirst: vi.fn().mockResolvedValue(revision) }, assignmentSubmission: { findMany: vi.fn().mockResolvedValue([]) } };
    await expect(createAssignmentAiGradingBatches({
      db,
      assignmentId: 'assignment-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'before-deadline',
      now,
    })).rejects.toThrow('assignment-grading-before-deadline');
  });

  it('executes each question batch independently', async () => {
    processQuestionGradingBatch.mockResolvedValueOnce({ batch: { id: 'batch-1' }, itemResults: [{ itemId: 'item-1', state: 'SUCCEEDED' }] });
    processQuestionGradingBatch.mockResolvedValueOnce({ batch: { id: 'batch-2' }, itemResults: [{ itemId: 'item-2', state: 'FAILED' }] });
    const result = await executeAssignmentAiGradingBatches({ db: {}, batches: [{ batch: { id: 'batch-1' } }, { batch: { id: 'batch-2' } }], now });
    expect(result).toHaveLength(2);
    expect(processQuestionGradingBatch).toHaveBeenCalledTimes(2);
  });

  it('allows manual grading for a submitted question in an incomplete assignment', async () => {
    const runCreate = vi.fn().mockResolvedValue({ id: 'manual-run-1', source: 'MANUAL', state: 'AWAITING_REVIEW' });
    createTeacherAssignmentReview.mockResolvedValue({ review: { id: 'review-1' }, replay: false });
    const revision = revisionFixture();
    const db: any = {
      assignmentSubmission: { findUnique: vi.fn().mockResolvedValue({
        id: 'submission-1', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-1', frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1',
        frozenAudienceDueAt: new Date('2026-08-13T12:00:00.000Z'), state: 'IN_PROGRESS',
        audience: { class: { teacherId: 'teacher-1', isActive: true } },
        student: { profile: { classId: 'class-1' } },
        revision,
        answers: [{ id: 'answer-1', assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1, answerVersion: 1 }] }],
      }) },
      answerEvidence: { findFirst: vi.fn().mockResolvedValue({ id: 'evidence-1', attemptId: 'attempt-1', readiness: 'READY' }) },
      gradingRun: { findUnique: vi.fn().mockResolvedValue(null), create: runCreate },
      assignmentSubmissionSnapshot: { findUnique: vi.fn().mockResolvedValue(null) },
      assignmentGradingOperation: { create: vi.fn().mockResolvedValue({ snapshots: [{ id: 'snapshot-1' }] }) },
    };

    const result = await createManualQuestionGradingReview({
      db,
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      questionId: 'question-1',
      actor: { id: 'teacher-1', role: 'TEACHER' },
      idempotencyKey: 'manual-1',
      now,
    });

    expect(result.run).toMatchObject({ id: 'manual-run-1', source: 'MANUAL' });
    expect(runCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ source: 'MANUAL', state: 'AWAITING_REVIEW' }) }));
    expect(runCreate.mock.calls[0][0].data).not.toHaveProperty('provider');
    expect(db.assignmentGradingOperation.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state: 'SUCCEEDED',
        snapshots: expect.objectContaining({ create: expect.objectContaining({ submissionId: 'submission-1', attemptVectorHash: expect.any(String) }) }),
      }),
    }));
    expect(createTeacherAssignmentReview).toHaveBeenCalledWith(db, expect.objectContaining({ gradingRunId: 'manual-run-1' }));
  });

  it('creates a distinct manual snapshot operation when another question is resubmitted', async () => {
    const revision = revisionFixture();
    const submission: any = {
      id: 'submission-1', assignmentRevisionId: 'revision-1', audienceId: 'audience-1', studentId: 'student-1', frozenStudentId: 'student-1', frozenAudienceClassId: 'class-1',
      frozenAudienceDueAt: new Date('2026-08-13T12:00:00.000Z'), state: 'IN_PROGRESS',
      audience: { class: { teacherId: 'teacher-1', isActive: true } }, student: { profile: { classId: 'class-1' } }, revision,
      answers: [
        { id: 'answer-1', assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1, answerVersion: 1 }] },
        { id: 'answer-2', assignmentQuestionId: 'question-2', currentAttemptNumber: 1, attempts: [{ id: 'attempt-2', attemptNumber: 1, answerVersion: 1 }] },
      ],
    };
    const operationCreate = vi.fn(async ({ data }: any) => ({ snapshots: [{ id: data.snapshots.create.id }] }));
    const db: any = {
      assignmentSubmission: { findUnique: vi.fn().mockResolvedValue(submission) },
      answerEvidence: { findFirst: vi.fn().mockResolvedValue({ id: 'evidence-1', readiness: 'READY' }) },
      gradingRun: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: 'manual-run-1', source: 'MANUAL', state: 'AWAITING_REVIEW' }) },
      assignmentSubmissionSnapshot: { findUnique: vi.fn().mockResolvedValue(null) },
      assignmentGradingOperation: { create: operationCreate },
    };
    createTeacherAssignmentReview.mockResolvedValue({ review: { id: 'review-1' }, replay: false });

    await createManualQuestionGradingReview({ db, assignmentId: 'assignment-1', submissionId: 'submission-1', questionId: 'question-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'manual-vector-1', now });
    submission.answers[1].currentAttemptNumber = 2;
    submission.answers[1].attempts.push({ id: 'attempt-2-resubmitted', attemptNumber: 2, answerVersion: 2 });
    await createManualQuestionGradingReview({ db, assignmentId: 'assignment-1', submissionId: 'submission-1', questionId: 'question-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'manual-vector-2', now });
    submission.revision.questions.reverse();
    await createManualQuestionGradingReview({ db, assignmentId: 'assignment-1', submissionId: 'submission-1', questionId: 'question-1', actor: { id: 'teacher-1', role: 'TEACHER' }, idempotencyKey: 'manual-vector-3', now });

    expect(operationCreate).toHaveBeenCalledTimes(3);
    expect(operationCreate.mock.calls[0][0].data.id).not.toBe(operationCreate.mock.calls[1][0].data.id);
    expect(operationCreate.mock.calls[0][0].data.dedupeKey).not.toBe(operationCreate.mock.calls[1][0].data.dedupeKey);
    expect(operationCreate.mock.calls[1][0].data.id).toBe(operationCreate.mock.calls[2][0].data.id);
    expect(operationCreate.mock.calls[1][0].data.idempotencyKey).toBe(operationCreate.mock.calls[2][0].data.idempotencyKey);
    expect(operationCreate.mock.calls[1][0].data.dedupeKey).toBe(operationCreate.mock.calls[2][0].data.dedupeKey);
  });
});
