import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  approveTeacherAssignmentReview,
  createTeacherAssignmentReview,
  deriveTeacherAssignmentReviewTotal,
  evaluateAssignmentReviewCompleteness,
  resolveTeacherAssignmentReviewAuthorization,
  returnTeacherAssignmentReview,
  saveTeacherAssignmentReview,
  TeacherAssignmentReviewError,
} from '../teacher-assignment-review';

const now = new Date('2026-07-17T01:00:00.000Z');

function rubric() {
  return {
    id: 'rubric-1',
    version: 'rubric-v1',
    maxScore: 10,
    criteria: [
      { id: 'criterion-1', maxPoints: 4, levels: [{ id: 'c1-low', minPoints: 0, maxPoints: 2 }, { id: 'c1-high', minPoints: 2, maxPoints: 4 }] },
      { id: 'criterion-2', maxPoints: 6, levels: [{ id: 'c2-low', minPoints: 0, maxPoints: 3 }, { id: 'c2-high', minPoints: 3, maxPoints: 6 }] },
    ],
  };
}

function criteria() {
  return [
    { criterionId: 'criterion-1', levelId: 'c1-high', score: 4, comment: 'clear model' },
    { criterionId: 'criterion-2', levelId: 'c2-high', score: 5, comment: 'minor arithmetic issue' },
  ];
}

function reviewFixture() {
  const submission = {
    id: 'submission-1',
    assignmentRevisionId: 'revision-1',
    studentId: 'student-1',
    frozenStudentId: 'student-1',
    frozenAudienceClassId: 'class-1',
    audience: { id: 'audience-1', classId: 'class-1', archivedAt: null, class: { id: 'class-1', teacherId: 'teacher-1', isActive: true } },
    student: { profile: { classId: 'class-1' } },
  };
  return {
    id: 'review-1',
    assignmentId: 'assignment-1',
    assignmentRevisionId: 'revision-1',
    submissionId: submission.id,
    answerId: 'answer-1',
    attemptId: 'attempt-1',
    questionId: 'question-1',
    gradingRunId: 'run-1',
    answerEvidenceId: 'evidence-1',
    reviewerId: 'teacher-1',
    state: 'WORKING',
    version: 2,
    criterionValues: criteria(),
    annotationValues: [],
    derivedTotal: 9,
    overallComment: 'good',
    machineSnapshotHash: 'sha256:machine',
    assignment: { id: 'assignment-1', authorId: 'author-1', reviewGrants: [] },
    submission,
    gradingRun: {
      id: 'run-1',
      state: 'AWAITING_REVIEW',
      teacherReviewedAt: null,
      answerAttemptId: 'attempt-1',
      answerEvidenceId: 'evidence-1',
      questionId: 'question-1',
      answerAttempt: { id: 'attempt-1', answerId: 'answer-1', answer: { id: 'answer-1', submissionId: 'submission-1', assignmentQuestionId: 'question-1' } },
      answerEvidence: { id: 'evidence-1', attemptId: 'attempt-1' },
      question: { id: 'question-1', assignmentRevisionId: 'revision-1', responseType: 'SUBJECTIVE_TEXT' },
      rubricId: 'rubric-1',
      rubricVersion: 'rubric-v1',
      questionSnapshot: { rubric: rubric() },
      assessments: [
        { id: 'assessment-1', criterionId: 'criterion-1', levelId: 'c1-low', score: 2, teacherReviewedAt: null },
        { id: 'assessment-2', criterionId: 'criterion-2', levelId: 'c2-low', score: 3, teacherReviewedAt: null },
      ],
    },
  };
}

describe('teacher assignment review persistence', () => {
  it('derives totals only from a complete bounded criterion set', () => {
    expect(deriveTeacherAssignmentReviewTotal(rubric(), criteria())).toBe(9);
    expect(() => deriveTeacherAssignmentReviewTotal(rubric(), criteria().slice(0, 1))).toThrow('teacher-review-criteria-incomplete');
    expect(() => deriveTeacherAssignmentReviewTotal(rubric(), [{ ...criteria()[0], score: 5 }, criteria()[1]])).toThrow('teacher-review-score-out-of-range');
    expect(() => deriveTeacherAssignmentReviewTotal(rubric(), [{ ...criteria()[0], levelId: 'c1-low', score: 4 }, criteria()[1]])).toThrow('teacher-review-level-score-mismatch');
  });

  it('withholds the assignment total until every latest required attempt is approved or exempted', () => {
    const base = {
      questions: [{ id: 'question-1' }, { id: 'question-2' }],
      answers: [
        { assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] },
        { assignmentQuestionId: 'question-2', currentAttemptNumber: 1, attempts: [{ id: 'attempt-2', attemptNumber: 1 }] },
      ],
      approvalSnapshots: [{ questionId: 'question-1', attemptId: 'attempt-1', questionTotal: 4 }],
      activeGrants: [],
      exemptions: [],
    };
    expect(evaluateAssignmentReviewCompleteness(base)).toEqual({ complete: false, total: null, blockers: [{ questionId: 'question-2', reason: 'unapproved-current-attempt' }] });
    expect(evaluateAssignmentReviewCompleteness({ ...base, activeGrants: [{ answerId: 'answer-2', questionId: 'question-2' }] }).blockers).toContainEqual({ questionId: 'question-2', reason: 'returned-awaiting-resubmission' });
    expect(evaluateAssignmentReviewCompleteness({ ...base, exemptions: [{ questionId: 'question-2', scoreEffect: 1 }] })).toEqual({ complete: true, total: 5, blockers: [] });
  });

  it('uses current class authority only for current ownership and explicit grants for historical access', () => {
    const review: any = reviewFixture();
    expect(resolveTeacherAssignmentReviewAuthorization({ actor: { id: 'teacher-1', role: 'TEACHER' }, review, now }).mode).toBe('current-class');
    review.submission.student.profile = { classId: 'class-other' };
    review.submission.audience.class.teacherId = 'teacher-new';
    expect(() => resolveTeacherAssignmentReviewAuthorization({ actor: { id: 'teacher-new', role: 'TEACHER' }, review, now })).toThrow('teacher-review-forbidden');
    review.assignment.reviewGrants = [{ teacherId: 'teacher-new', revokedAt: null, expiresAt: new Date('2026-07-18T00:00:00.000Z') }];
    expect(resolveTeacherAssignmentReviewAuthorization({ actor: { id: 'teacher-new', role: 'TEACHER' }, review, now }).mode).toBe('review-grant');
  });

  it('saves working criteria with version CAS and a derived total', async () => {
    const review = reviewFixture();
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const db: any = { teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review), updateMany } };
    const saved = await saveTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: review.assignmentId, submissionId: review.submissionId,
      reviewId: review.id, expectedVersion: 2, criteria: criteria(), annotations: [], overallComment: 'saved', now,
    });
    expect(saved).toMatchObject({ version: 3, derivedTotal: 9 });
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: review.id, assignmentId: review.assignmentId, submissionId: review.submissionId, state: 'WORKING', version: 2 },
      data: expect.objectContaining({ version: { increment: 1 }, derivedTotal: 9, overallComment: 'saved' }),
    }));
    updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(saveTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: review.assignmentId, submissionId: review.submissionId,
      reviewId: review.id, expectedVersion: 2, criteria: criteria(), annotations: [], overallComment: 'stale', now,
    })).rejects.toMatchObject({ code: 'teacher-review-version-conflict', status: 409 });
  });

  it('rejects opening a working review when run, evidence, and submission lineage disagree', async () => {
    const review = reviewFixture();
    const run: any = {
      ...review.gradingRun,
      inputHash: 'sha256:input',
      evaluatorVersion: 'evaluator-v1',
      lifecyclePolicyVersion: 'lifecycle-v1',
      annotations: [],
      answerEvidence: { ...review.gradingRun.answerEvidence, readiness: 'READY', attemptId: 'foreign-attempt' },
      answerAttempt: {
        ...review.gradingRun.answerAttempt,
        answer: {
          ...review.gradingRun.answerAttempt.answer,
          submission: { ...review.submission, revision: { assignment: review.assignment } },
        },
      },
    };
    const db: any = {
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
      gradingRun: { findUnique: vi.fn().mockResolvedValue(run) },
    };

    await expect(createTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: review.assignmentId, submissionId: review.submissionId, gradingRunId: run.id, now,
    })).rejects.toMatchObject({ code: 'teacher-review-run-lineage-invalid', status: 409 });
    expect(db.teacherAssignmentReview.create).not.toHaveBeenCalled();
  });

  it('atomically freezes approval and appends exactly three deterministic outbox commands', async () => {
    const review = reviewFixture();
    const snapshotCreate = vi.fn(async ({ data }: any) => ({ ...data, id: 'snapshot-1' }));
    const outboxCreateMany = vi.fn().mockResolvedValue({ count: 3 });
    const reviewUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const runUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const assessmentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const submissionUpdate = vi.fn().mockResolvedValue({});
    const db: any = {
      $transaction: (callback: (tx: any) => Promise<any>) => callback(db),
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review), updateMany: reviewUpdateMany },
      teacherAssignmentApprovalSnapshot: { create: snapshotCreate, findMany: vi.fn().mockResolvedValue([]) },
      teacherAssignmentReviewOutbox: { createMany: outboxCreateMany },
      gradingRun: { updateMany: runUpdateMany },
      gradingCriterionAssessment: { updateMany: assessmentUpdateMany },
      assignmentSubmission: {
        findUnique: vi.fn().mockResolvedValue({
          revision: { questions: [{ id: 'question-1' }] },
          answers: [{ id: 'answer-1', assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }],
          resubmissionGrants: [],
          questionExemptions: [],
        }),
        update: submissionUpdate,
      },
    };
    const result = await approveTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: review.assignmentId, submissionId: review.submissionId,
      reviewId: review.id, expectedVersion: 2, idempotencyKey: 'approve-review-1', now,
    });
    expect(result).toMatchObject({ snapshot: { id: 'snapshot-1', questionTotal: 9 }, replay: false, assignment: { complete: true, total: 9 } });
    expect(snapshotCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewVersion: 2, criterionSnapshot: criteria(), questionTotal: 9 }) }));
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ command: 'GENERATE_DERIVATIVE', dedupeKey: 'teacher-review:snapshot-1:generate-derivative' }),
        expect.objectContaining({ command: 'RELEASE_STUDENT_FEEDBACK', dedupeKey: 'teacher-review:snapshot-1:release-student-feedback' }),
        expect.objectContaining({ command: 'PROCESS_GOVERNED_EVIDENCE', dedupeKey: 'teacher-review:snapshot-1:process-governed-evidence' }),
      ]),
      skipDuplicates: true,
    });
    expect(assessmentUpdateMany).toHaveBeenCalledTimes(2);
    expect(submissionUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ reviewState: 'APPROVED_PENDING_RELEASE', approvedTotal: 9, reviewedAt: null }) }));
  });

  it('creates no visible approval when an outbox append aborts the transaction', async () => {
    const liveReview = reviewFixture();
    const live = { state: liveReview.state, version: liveReview.version, snapshots: 0 };
    const db: any = {
      $transaction: async (callback: (tx: any) => Promise<any>) => {
        const draft = structuredClone(live);
        const tx = {
          teacherAssignmentReview: {
            findUnique: vi.fn().mockResolvedValue(liveReview),
            updateMany: vi.fn(async () => { draft.state = 'APPROVED'; draft.version += 1; return { count: 1 }; }),
          },
          teacherAssignmentApprovalSnapshot: {
            create: vi.fn(async ({ data }: any) => { draft.snapshots += 1; return { id: 'snapshot-rollback', ...data }; }),
            findMany: vi.fn().mockResolvedValue([]),
          },
          teacherAssignmentReviewOutbox: { createMany: vi.fn().mockRejectedValue(new Error('outbox-write-failed')) },
          gradingRun: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          gradingCriterionAssessment: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          assignmentSubmission: { findUnique: vi.fn(), update: vi.fn() },
        };
        const value = await callback(tx);
        Object.assign(live, draft);
        return value;
      },
    };
    await expect(approveTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: liveReview.assignmentId, submissionId: liveReview.submissionId,
      reviewId: liveReview.id, expectedVersion: 2, idempotencyKey: 'approve-rollback', now,
    })).rejects.toThrow('outbox-write-failed');
    expect(live).toEqual({ state: 'WORKING', version: 2, snapshots: 0 });
  });

  it('replays approval with grading completeness independent of feedback publication state', async () => {
    const review = reviewFixture();
    const replay = {
      id: 'snapshot-replay', reviewId: review.id, attemptId: review.attemptId,
      questionId: review.questionId, questionTotal: 9,
      requestHash: expect.anything(),
    } as any;
    const db: any = {
      $transaction: (callback: (tx: any) => Promise<any>) => callback(db),
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review) },
      teacherAssignmentApprovalSnapshot: {
        findUnique: vi.fn(async () => replay),
        findMany: vi.fn(async () => [replay]),
      },
      assignmentSubmission: {
        findUnique: vi.fn().mockResolvedValue({
          reviewState: 'APPROVED_PENDING_RELEASE',
          revision: { questions: [{ id: 'question-1' }] },
          answers: [{ id: 'answer-1', assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1, gradingRuns: [{ state: 'APPROVED' }] }] }],
          resubmissionGrants: [], questionExemptions: [],
        }),
      },
    };
    const input = {
      actor: { id: 'teacher-1', role: 'TEACHER' as const }, assignmentId: review.assignmentId,
      submissionId: review.submissionId, reviewId: review.id, expectedVersion: 2,
      idempotencyKey: 'approve-review-replay', now,
    };
    replay.requestHash = `sha256:${createHash('sha256').update(JSON.stringify({
      actorId: input.actor.id,
      expectedVersion: input.expectedVersion,
      reviewId: review.id,
    })).digest('hex')}`;

    await expect(approveTeacherAssignmentReview(db, input)).resolves.toMatchObject({
      replay: true,
      assignment: { complete: true, total: 9, blockers: [] },
    });
  });

  it('returns only the selected answer and creates an audited resubmission grant', async () => {
    const review = reviewFixture();
    const grantCreate = vi.fn(async ({ data }: any) => ({ id: 'grant-1', ...data }));
    const db: any = {
      $transaction: (callback: (tx: any) => Promise<any>) => callback(db),
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      teacherAssignmentResubmissionGrant: { findUnique: vi.fn().mockResolvedValue(null), create: grantCreate },
      gradingRun: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      submissionAnswer: { update: vi.fn().mockResolvedValue({}) },
      assignmentSubmission: { update: vi.fn().mockResolvedValue({}) },
    };
    const result = await returnTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: review.assignmentId, submissionId: review.submissionId,
      reviewId: review.id, expectedVersion: 2, idempotencyKey: 'return-review-1', reason: 'Please correct the sign error',
      allowedResponseType: 'SUBJECTIVE_TEXT', newDeadlineAt: new Date('2026-07-20T00:00:00.000Z'), now,
    });
    expect(result).toMatchObject({ grant: { id: 'grant-1', answerId: 'answer-1', questionId: 'question-1', attemptId: 'attempt-1' }, replay: false });
    expect(grantCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      submissionId: 'submission-1', answerId: 'answer-1', questionId: 'question-1', sourceReviewId: 'review-1', sourceGradingRunId: 'run-1',
      state: 'ACTIVE', reason: 'Please correct the sign error', allowedResponseType: 'SUBJECTIVE_TEXT',
    }) }));
    db.teacherAssignmentResubmissionGrant.findUnique.mockResolvedValueOnce(result.grant);
    await expect(returnTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: review.assignmentId, submissionId: review.submissionId,
      reviewId: review.id, expectedVersion: 2, idempotencyKey: 'return-review-1', reason: 'Different request content',
      allowedResponseType: 'SUBJECTIVE_TEXT', newDeadlineAt: new Date('2026-07-20T00:00:00.000Z'), now,
    })).rejects.toMatchObject({ code: 'teacher-review-idempotency-conflict', status: 409 });
  });

  it('exposes structured review errors for API conflict mapping', () => {
    expect(new TeacherAssignmentReviewError('teacher-review-version-conflict', 409)).toMatchObject({ code: 'teacher-review-version-conflict', status: 409 });
  });
});
