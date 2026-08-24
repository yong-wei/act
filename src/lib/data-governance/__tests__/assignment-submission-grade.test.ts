import { describe, expect, it, vi } from 'vitest';

import {
  AssignmentSubmissionGradeError,
  confirmAssignmentSubmissionGrade,
  releaseAssignmentSubmissionGrade,
  recordAssignmentQuestionConclusion,
  refreshAssignmentSubmissionGrade,
  returnAssignmentQuestionForResubmission,
} from '../assignment-submission-grade';
import { sha256, stableStringify } from '../math-document-grading-contracts';

const now = new Date('2026-08-14T12:00:00.000Z');

function snapshotFixture() {
  return {
    id: 'snapshot-1', assignmentRevisionId: 'revision-1', submissionId: 'submission-1', frozenAudienceClassId: 'class-1', originalDueAt: new Date('2026-08-13T12:00:00.000Z'), attemptVectorHash: 'sha256:vector',
    revision: { assignmentId: 'assignment-1', solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' }, assignment: { authorId: 'teacher-1', reviewGrants: [] } },
    submission: { assignmentRevisionId: 'revision-1', studentId: 'student-1', frozenStudentId: 'student-1', audience: { class: { teacherId: 'teacher-1', isActive: true } }, student: { profile: { classId: 'class-1' } } },
    items: [
      { id: 'item-1', questionId: 'question-1', answerId: 'answer-1', attemptId: 'attempt-1', questionSnapshotHash: 'sha256:q1', question: { points: 5, responseType: 'SUBJECTIVE_TEXT', promptSnapshot: { text: 'q1' }, answerSnapshot: { text: 'a1' }, rubricSnapshot: { criteria: [] } }, attempt: { gradingRuns: [], approvalSnapshots: [{ reviewId: 'review-1', gradingRunId: 'run-1', approvedAt: now, questionTotal: 4, overallComment: 'good', gradingRun: { source: 'AI' } }] } },
      { id: 'item-2', questionId: 'question-2', attemptId: null, questionSnapshotHash: 'sha256:q2', question: { points: 5, promptSnapshot: { text: 'q2' }, answerSnapshot: { text: 'a2' }, rubricSnapshot: { criteria: [] } }, attempt: null },
    ],
  };
}

function dbFor(snapshot: any, grade: any) {
  const db: any = {
    assignmentSubmissionSnapshot: { findUnique: vi.fn().mockResolvedValue(snapshot) },
    assignmentSubmissionGrade: {
      findUnique: vi.fn().mockResolvedValue(grade),
      create: vi.fn().mockResolvedValue(grade),
      update: vi.fn(async ({ data }: any) => ({ ...grade, ...data, confirmations: [], conclusions: grade.conclusions ?? [] })),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    assignmentQuestionConclusion: { upsert: vi.fn().mockResolvedValue({}) },
    assignmentSubmissionGradeConfirmation: { findUnique: vi.fn().mockResolvedValue(null), findFirst: vi.fn().mockResolvedValue(null), create: vi.fn(async ({ data }: any) => data) },
    assignmentSubmissionGradeRelease: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(async ({ data }: any) => data) },
    teacherAssignmentApprovalSnapshot: { findMany: vi.fn().mockResolvedValue([]) },
    teacherAssignmentFeedbackRelease: { upsert: vi.fn().mockResolvedValue({}) },
    teacherAssignmentResubmissionGrant: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn(async ({ data }: any) => ({ id: 'grant-1', ...data })) },
    submissionAnswer: { update: vi.fn().mockResolvedValue({}) },
    assignmentSubmission: { update: vi.fn().mockResolvedValue({}) },
  };
  db.$transaction = vi.fn(async (callback: any) => callback(db));
  return db;
}

describe('assignment submission grade', () => {
  it('keeps a missing frozen question unresolved without assigning zero', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [] };
    const db: any = dbFor(snapshot, grade);
    db.$transaction = async (callback: any) => callback(db);
    const result = await refreshAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', now });
    expect(result.aggregate).toMatchObject({ complete: false, total: null, blockers: [{ questionId: 'question-2', reason: 'missing-attempt' }] });
  });

  it('loads frozen snapshot items in question order', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [] };
    const db: any = dbFor(snapshot, grade);

    await refreshAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', now });

    expect(db.assignmentSubmissionSnapshot.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({ items: expect.objectContaining({ orderBy: [{ question: { orderIndex: 'asc' } }, { id: 'asc' }] }) }),
    }));
  });

  it('uses an explicit conclusion to complete and confirm the frozen vector', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [{ snapshotItemId: 'item-2', kind: 'UNANSWERED', scoreEffect: 0, reason: 'not answered' }] };
    const db: any = dbFor(snapshot, grade);
    db.$transaction = async (callback: any) => callback(db);
    const confirmation = await confirmAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', expectedVersion: 1, idempotencyKey: 'confirm-grade-1', now });
    expect(confirmation).toMatchObject({ replay: false, confirmation: { attemptVectorHash: 'sha256:vector', totalScore: 4 } });
  });

  it('freezes approved criterion and annotation comments in the confirmation', async () => {
    const snapshot = snapshotFixture();
    snapshot.items[0].attempt!.approvalSnapshots[0] = {
      approvedAt: now,
      questionTotal: 4,
      overallComment: '',
      criterionSnapshot: [{ criterionId: 'criterion-1', comment: 'specific feedback' }],
      annotationSnapshot: [{ id: 'annotation-1', comment: 'document feedback' }],
      gradingRun: { source: 'AI' },
    } as any;
    const grade = { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [{ snapshotItemId: 'item-2', kind: 'UNANSWERED', scoreEffect: 0, reason: 'not answered' }] };
    const db: any = dbFor(snapshot, grade);
    db.$transaction = async (callback: any) => callback(db);

    const result = await confirmAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', expectedVersion: 1, idempotencyKey: 'confirm-comments-1', now });

    expect(result.confirmation.questionProjection).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'question-1', criteria: [{ criterionId: 'criterion-1', comment: 'specific feedback' }], annotations: [{ id: 'annotation-1', comment: 'document feedback' }] }),
    ]));
  });

  it('rejects confirmation when the aggregate remains incomplete', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [] };
    const db: any = dbFor(snapshot, grade);
    db.$transaction = async (callback: any) => callback(db);
    await expect(confirmAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', expectedVersion: 1, idempotencyKey: 'confirm-grade-2', now }))
      .rejects.toMatchObject({ code: 'assignment-result-incomplete' } satisfies Partial<AssignmentSubmissionGradeError>);
  });

  it('records a conclusion only after the original deadline', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [] };
    const db: any = dbFor(snapshot, grade);
    db.$transaction = async (callback: any) => callback(db);
    await recordAssignmentQuestionConclusion(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', snapshotItemId: 'item-2', kind: 'UNANSWERED', scoreEffect: 0, reason: 'not answered', now });
    expect(db.assignmentQuestionConclusion.upsert).toHaveBeenCalled();
  });

  it('does not let later question runs overwrite a confirmed aggregate', async () => {
    const snapshot = snapshotFixture();
    snapshot.items[0].attempt!.approvalSnapshots = [{ reviewId: 'review-later', gradingRunId: 'run-later', approvedAt: now, questionTotal: 1, overallComment: 'later draft', gradingRun: { source: 'AI' } }];
    const grade = { id: 'grade-1', version: 2, state: 'CONFIRMED', totalScore: 4, questionProjection: [{ questionId: 'question-1', score: 4 }], conclusions: [] };
    const db: any = dbFor(snapshot, grade);
    const result = await refreshAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', now });
    expect(result.aggregate).toMatchObject({ state: 'CONFIRMED', total: 4, questions: [{ questionId: 'question-1', score: 4 }] });
    expect(db.assignmentSubmissionGrade.update).not.toHaveBeenCalled();
  });

  it('preserves a confirmation that wins a concurrent refresh', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [] };
    const confirmed = { id: 'grade-1', version: 2, state: 'CONFIRMED', totalScore: 4, questionProjection: [{ questionId: 'question-1', score: 4 }], conclusions: [] };
    const db: any = dbFor(snapshot, grade);
    db.assignmentSubmissionGrade.updateMany.mockResolvedValue({ count: 0 });
    db.assignmentSubmissionGrade.findUnique.mockResolvedValueOnce(grade).mockResolvedValueOnce(confirmed);

    const result = await refreshAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', now });

    expect(result.aggregate).toMatchObject({ state: 'CONFIRMED', total: 4, questions: [{ questionId: 'question-1', score: 4 }] });
  });

  it('prioritizes a manual approval over a later AI approval before confirmation', async () => {
    const snapshot = snapshotFixture();
    snapshot.items[0].attempt!.approvalSnapshots = [
      { reviewId: 'review-manual', gradingRunId: 'run-manual', approvedAt: new Date('2026-08-14T11:00:00.000Z'), questionTotal: 4, overallComment: 'manual', gradingRun: { source: 'MANUAL' } },
      { reviewId: 'review-later', gradingRunId: 'run-later', approvedAt: now, questionTotal: 1, overallComment: 'later AI', gradingRun: { source: 'AI' } },
    ];
    const db: any = dbFor(snapshot, { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [] });
    const result = await refreshAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', now });
    expect(result.aggregate.questions[0]).toMatchObject({ source: 'MANUAL', score: 4, comment: 'manual' });
  });

  it('rejects a snapshot addressed through another submission path', async () => {
    const snapshot = snapshotFixture();
    const db: any = dbFor(snapshot, { id: 'grade-1', version: 1, state: 'PENDING_GRADING', conclusions: [] });
    await expect(refreshAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', submissionId: 'submission-2', snapshotId: 'snapshot-1', now }))
      .rejects.toMatchObject({ code: 'assignment-result-access-forbidden' });
  });

  it('replays a matching confirmation without another aggregate write', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'AWAITING_CONFIRMATION', conclusions: [{ snapshotItemId: 'item-2', kind: 'UNANSWERED', scoreEffect: 0, reason: 'not answered' }] };
    const db: any = dbFor(snapshot, grade);
    const request = { actor: { id: 'teacher-1', role: 'TEACHER' as const }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', expectedVersion: 1, idempotencyKey: 'confirm-replay', now };
    db.assignmentSubmissionGradeConfirmation.findUnique.mockResolvedValue({ id: 'confirmation-1', requestHash: sha256(stableStringify({ actorId: 'teacher-1', expectedVersion: 1, snapshotId: 'snapshot-1' })) });
    db.$transaction = async (callback: any) => callback(db);
    await expect(confirmAssignmentSubmissionGrade(db, request)).resolves.toMatchObject({ replay: true, confirmation: { id: 'confirmation-1' } });
    expect(db.assignmentSubmissionGrade.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a concurrent confirmation that loses the version compare-and-swap', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 1, state: 'AWAITING_CONFIRMATION', conclusions: [{ snapshotItemId: 'item-2', kind: 'UNANSWERED', scoreEffect: 0, reason: 'not answered' }] };
    const db: any = dbFor(snapshot, grade);
    db.assignmentSubmissionGrade.updateMany.mockResolvedValue({ count: 0 });
    db.$transaction = async (callback: any) => callback(db);
    await expect(confirmAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', expectedVersion: 1, idempotencyKey: 'confirm-cas', now }))
      .rejects.toMatchObject({ code: 'assignment-result-confirmation-conflict' });
  });

  it('releases only a confirmed aggregate as a sanitized student package', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 2, state: 'CONFIRMED', conclusions: [] };
    const confirmation = { id: 'confirmation-1', gradeId: 'grade-1', version: 2, totalScore: 4, questionProjection: [{ questionId: 'question-1', score: 4, comment: 'good', source: 'AI', failureReason: 'internal', criteria: [{ criterionId: 'criterion-1', comment: 'specific feedback', origin: 'AI_DRAFT' }], annotations: [{ id: 'annotation-1', comment: 'document feedback', origin: 'AI_DRAFT', authorRole: 'AI', anchor: { blockId: 'block-1', precision: 'BLOCK', excerpt: 'internal excerpt' } }], question: { answerSnapshot: { text: 'a1' }, rubricSnapshot: { criteria: [] } } }] };
    const db: any = dbFor(snapshot, grade);
    db.assignmentSubmissionGradeConfirmation.findFirst.mockResolvedValue(confirmation);
    db.$transaction = async (callback: any) => callback(db);

    const result = await releaseAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', submissionId: 'submission-1', snapshotId: 'snapshot-1', confirmationId: 'confirmation-1', idempotencyKey: 'release-grade-1', now });

    expect(result).toMatchObject({ replay: false, release: { ownerStudentId: 'student-1', packageSnapshot: { totalScore: 4, questions: [{ questionId: 'question-1', score: 4, comment: 'good', criteria: [{ criterionId: 'criterion-1', comment: 'specific feedback' }], annotations: [{ comment: 'document feedback' }], referenceAnswer: { text: 'a1' }, scoringStandard: { criteria: [] } }] } } });
    expect(result.release.packageSnapshot.questions[0]).not.toHaveProperty('source');
    expect(result.release.packageSnapshot.questions[0]).not.toHaveProperty('failureReason');
    expect(result.release.packageSnapshot.questions[0].criteria[0]).not.toHaveProperty('origin');
    expect(result.release.packageSnapshot.questions[0].annotations[0]).not.toHaveProperty('origin');
    expect(result.release.packageSnapshot.questions[0].annotations[0]).not.toHaveProperty('authorRole');
    expect(result.release.packageSnapshot.questions[0].annotations[0].anchor).not.toHaveProperty('excerpt');
  });

  it('releases a ready reviewed PDF together with the final result package', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 2, state: 'CONFIRMED', conclusions: [] };
    const confirmation = { id: 'confirmation-1', gradeId: 'grade-1', version: 2, totalScore: 4, questionProjection: [] };
    const db: any = dbFor(snapshot, grade);
    db.assignmentSubmissionGradeConfirmation.findFirst.mockResolvedValue(confirmation);
    db.teacherAssignmentApprovalSnapshot.findMany.mockResolvedValue([{
      id: 'approval-1', authorizationSnapshot: { teacherId: 'teacher-1' }, reviewedDerivatives: [{ id: 'reviewed-pdf-1', outputObjectKey: 'teacher-reviewed/1.pdf', outputChecksum: 'sha256:abcdef' }],
    }]);

    await releaseAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', submissionId: 'submission-1', snapshotId: 'snapshot-1', confirmationId: 'confirmation-1', idempotencyKey: 'release-grade-with-pdf', now });

    expect(db.teacherAssignmentFeedbackRelease.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { snapshotId: 'approval-1' },
      create: expect.objectContaining({ derivativeId: 'reviewed-pdf-1', ownerStudentId: 'student-1', mode: 'DERIVATIVE' }),
    }));
  });

  it('rejects release when the grade has not been confirmed', async () => {
    const snapshot = snapshotFixture();
    const db: any = dbFor(snapshot, { id: 'grade-1', version: 1, state: 'AWAITING_CONFIRMATION', conclusions: [] });
    db.$transaction = async (callback: any) => callback(db);

    await expect(releaseAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', confirmationId: 'confirmation-1', idempotencyKey: 'release-grade-2', now }))
      .rejects.toMatchObject({ code: 'assignment-result-unconfirmed' });
  });

  it('replays an already released confirmation without another write', async () => {
    const snapshot = snapshotFixture();
    const grade = { id: 'grade-1', version: 2, state: 'RELEASED', conclusions: [] };
    const db: any = dbFor(snapshot, grade);
    const requestHash = sha256(stableStringify({ actorId: 'teacher-1', snapshotId: 'snapshot-1', confirmationId: 'confirmation-1' }));
    db.assignmentSubmissionGradeRelease.findUnique.mockResolvedValue({ id: 'release-1', confirmationId: 'confirmation-1', idempotencyKey: 'release-grade-3', requestHash });
    db.$transaction = async (callback: any) => callback(db);

    await expect(releaseAssignmentSubmissionGrade(db, { actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', confirmationId: 'confirmation-1', idempotencyKey: 'release-grade-3', now }))
      .resolves.toMatchObject({ replay: true, release: { id: 'release-1' } });
    expect(db.assignmentSubmissionGrade.updateMany).not.toHaveBeenCalled();
  });

  it('returns a released question through a snapshot-bound resubmission grant', async () => {
    const snapshot = snapshotFixture();
    const db: any = dbFor(snapshot, { id: 'grade-1', version: 2, state: 'RELEASED', conclusions: [] });

    const result = await returnAssignmentQuestionForResubmission(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', submissionId: 'submission-1', snapshotId: 'snapshot-1', snapshotItemId: 'item-1',
      reason: 'Please revise the stability condition analysis.', newDeadlineAt: new Date('2026-08-16T12:00:00.000Z'), idempotencyKey: 'return-grade-question-1', now,
    });

    expect(result).toMatchObject({ replay: false, grant: { sourceReviewId: 'review-1', sourceGradingRunId: 'run-1', allowedResponseType: 'SUBJECTIVE_TEXT' } });
    expect(db.submissionAnswer.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'answer-1' } }));
    expect(db.assignmentSubmission.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'submission-1' } }));
  });

});
