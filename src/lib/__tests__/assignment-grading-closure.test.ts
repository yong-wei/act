import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AssignmentSubmissionGradeError,
  confirmAssignmentSubmissionGrade,
  getAssignmentSubmissionGrade,
  recordAssignmentQuestionConclusion,
  refreshAssignmentSubmissionGrade,
  releaseAssignmentSubmissionGrade,
  returnAssignmentQuestionForResubmission,
} from '@/lib/assignments/assignment-grading-closure';

const releaseFeedbackMock = vi.hoisted(() => vi.fn());
const returnReviewMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/assignments/assignment-review', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/assignments/assignment-review')>();
  return {
    ...actual,
    requestTeacherAssignmentFeedbackRelease: releaseFeedbackMock,
    returnTeacherAssignmentReview: returnReviewMock,
  };
});

const now = new Date('2026-08-31T12:00:00.000Z');

function approvalFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'approval-1',
    reviewId: 'review-1',
    gradingRunId: 'run-1',
    attemptId: 'attempt-1',
    approvedAt: now,
    questionTotal: 4,
    overallComment: 'good',
    criterionSnapshot: [],
    annotationSnapshot: [],
    gradingRun: { source: 'AI' },
    outboxCommands: [],
    feedbackRelease: null,
    ...overrides,
  };
}

function snapshotFixture(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'snapshot-1',
    assignmentRevisionId: 'revision-1',
    submissionId: 'submission-1',
    frozenAudienceClassId: 'class-1',
    originalDueAt: new Date('2026-08-30T12:00:00.000Z'),
    attemptVectorHash: 'sha256:vector',
    revision: { assignmentId: 'assignment-1', solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' }, assignment: { authorId: 'teacher-1', reviewGrants: [] } },
    submission: {
      assignmentRevisionId: 'revision-1',
      studentId: 'student-1',
      frozenStudentId: 'student-1',
      audience: { class: { teacherId: 'teacher-1', isActive: true } },
      student: { profile: { classId: 'class-1' } },
      questionExemptions: [],
    },
    items: [
      {
        id: 'item-1',
        questionId: 'question-1',
        answerId: 'answer-1',
        attemptId: 'attempt-1',
        questionSnapshotHash: 'sha256:q1',
        question: { points: 5, responseType: 'SUBJECTIVE_TEXT', promptSnapshot: { text: 'q1' }, answerSnapshot: { text: 'a1' }, rubricSnapshot: { criteria: [] } },
        attempt: { gradingRuns: [], approvalSnapshots: [approvalFixture()] },
      },
      {
        id: 'item-2',
        questionId: 'question-2',
        attemptId: null,
        questionSnapshotHash: 'sha256:q2',
        question: { points: 5, promptSnapshot: { text: 'q2' }, answerSnapshot: { text: 'a2' }, rubricSnapshot: { criteria: [] } },
        attempt: null,
      },
    ],
    ...overrides,
  };
}

function dbFor(snapshot: any) {
  const db: any = {
    assignmentSubmissionSnapshot: { findUnique: vi.fn().mockResolvedValue(snapshot) },
    teacherAssignmentQuestionExemption: { upsert: vi.fn().mockResolvedValue({ id: 'exemption-1' }) },
    teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue({ id: 'review-1', version: 3 }) },
  };
  db.$transaction = vi.fn(async (callback: any) => callback(db));
  return db;
}

const actor = { id: 'teacher-1', role: 'TEACHER' as const };
const baseInput = { actor, assignmentId: 'assignment-1', snapshotId: 'snapshot-1', now };

describe('assignment grading closure', () => {
  beforeEach(() => {
    releaseFeedbackMock.mockReset();
    returnReviewMock.mockReset();
  });

  it('keeps a missing frozen question unresolved without assigning zero', async () => {
    const db = dbFor(snapshotFixture());
    const result = await refreshAssignmentSubmissionGrade(db, baseInput);
    expect(result.aggregate).toMatchObject({
      complete: false,
      total: null,
      blockers: [{ questionId: 'question-2', reason: 'missing-attempt' }],
    });
  });

  it('derives awaiting-confirmation state and total from canonical approval snapshots', async () => {
    const snapshot = snapshotFixture();
    snapshot.items[1].attempt = { gradingRuns: [], approvalSnapshots: [approvalFixture({ id: 'approval-2', reviewId: 'review-2', attemptId: null, questionTotal: 5, overallComment: 'ok' })] };
    snapshot.items[1].attemptId = 'attempt-2';
    const db = dbFor(snapshot);
    const result = await refreshAssignmentSubmissionGrade(db, baseInput);
    expect(result.grade).toMatchObject({ state: 'AWAITING_CONFIRMATION', totalScore: 9 });
    expect(result.grade.overallComment).toBe('第 1 题：good\n第 2 题：ok');
  });

  it('derives released state only when every approval feedback release succeeded', async () => {
    const snapshot = snapshotFixture();
    snapshot.items[1].attempt = { gradingRuns: [], approvalSnapshots: [approvalFixture({
      id: 'approval-2',
      attemptId: null,
      questionTotal: 5,
      outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }],
      feedbackRelease: { ownerStudentId: 'student-1', releasedAt: now },
    })] };
    snapshot.items[1].attemptId = 'attempt-2';
    snapshot.items[0].attempt.approvalSnapshots = [approvalFixture({
      outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }],
      feedbackRelease: { ownerStudentId: 'student-1', releasedAt: now },
    })];
    const db = dbFor(snapshot);
    const result = await getAssignmentSubmissionGrade(db, { ...baseInput, submissionId: 'submission-1' });
    expect(result.grade).toMatchObject({ state: 'RELEASED', totalScore: 9 });
  });

  it('derives partial failure when a frozen question has a failed run', async () => {
    const snapshot = snapshotFixture();
    snapshot.items[1].attempt = { gradingRuns: [{ id: 'run-x', state: 'FAILED', updatedAt: now }], approvalSnapshots: [] };
    snapshot.items[1].attemptId = 'attempt-2';
    const db = dbFor(snapshot);
    const result = await refreshAssignmentSubmissionGrade(db, baseInput);
    expect(result.grade.state).toBe('PARTIAL_FAILURE');
    expect(result.grade.totalScore).toBeNull();
  });

  it('counts canonical exemptions toward completeness and total', async () => {
    const snapshot = snapshotFixture();
    snapshot.submission.questionExemptions = [{ questionId: 'question-2', scoreEffect: 2, reason: '[EXEMPT] 缺席' }];
    const db = dbFor(snapshot);
    const result = await refreshAssignmentSubmissionGrade(db, baseInput);
    expect(result.grade).toMatchObject({ state: 'AWAITING_CONFIRMATION', totalScore: 6 });
  });

  it('confirm rejects incomplete submissions with canonical blockers', async () => {
    const db = dbFor(snapshotFixture());
    await expect(confirmAssignmentSubmissionGrade(db, baseInput)).rejects.toMatchObject({
      code: 'assignment-result-incomplete',
      status: 409,
      details: { blockers: [{ questionId: 'question-2', reason: 'missing-attempt' }] },
    });
  });

  it('confirm returns a derived idempotent confirmation without persisting state', async () => {
    const snapshot = snapshotFixture();
    snapshot.submission.questionExemptions = [{ questionId: 'question-2', scoreEffect: 2, reason: '[EXEMPT] 缺席' }];
    const db = dbFor(snapshot);
    const first = await confirmAssignmentSubmissionGrade(db, baseInput);
    const second = await confirmAssignmentSubmissionGrade(db, baseInput);
    expect(first.confirmation).toMatchObject({ totalScore: 6 });
    expect(first.replay).toBe(true);
    expect(second.confirmation.id).toBe(first.confirmation.id);
    expect(db.teacherAssignmentQuestionExemption.upsert).not.toHaveBeenCalled();
  });

  it('refuses grading commands before the frozen audience deadline', async () => {
    const snapshot = snapshotFixture({ originalDueAt: new Date('2026-09-30T12:00:00.000Z') });
    const db = dbFor(snapshot);
    await expect(refreshAssignmentSubmissionGrade(db, baseInput)).rejects.toMatchObject({ code: 'assignment-grading-before-deadline' });
  });

  it('denies teachers outside the assignment scope', async () => {
    const db = dbFor(snapshotFixture());
    await expect(getAssignmentSubmissionGrade(db, { ...baseInput, actor: { id: 'outsider', role: 'TEACHER' } }))
      .rejects.toMatchObject({ code: 'assignment-result-access-forbidden', status: 403 });
  });

  it('release rejects non teacher-confirmed revisions', async () => {
    const snapshot = snapshotFixture();
    snapshot.submission.questionExemptions = [{ questionId: 'question-2', scoreEffect: 0, reason: '[EXEMPT] 缺席' }];
    snapshot.revision.solutionReleasePolicy = { mode: 'AT_TIME' };
    const db = dbFor(snapshot);
    await expect(releaseAssignmentSubmissionGrade(db, baseInput)).rejects.toMatchObject({ code: 'assignment-result-release-policy-invalid' });
  });

  it('release replays fully published submissions without touching canonical commands', async () => {
    const snapshot = snapshotFixture();
    snapshot.submission.questionExemptions = [{ questionId: 'question-2', scoreEffect: 2, reason: '[EXEMPT] 缺席' }];
    snapshot.items[0].attempt.approvalSnapshots = [approvalFixture({
      outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }],
      feedbackRelease: { ownerStudentId: 'student-1', releasedAt: now },
    })];
    const db = dbFor(snapshot);
    const result = await releaseAssignmentSubmissionGrade(db, baseInput);
    expect(result.replay).toBe(true);
    expect(releaseFeedbackMock).not.toHaveBeenCalled();
  });

  it('release delegates pending approvals to the canonical feedback release command', async () => {
    const snapshot = snapshotFixture();
    snapshot.submission.questionExemptions = [{ questionId: 'question-2', scoreEffect: 2, reason: '[EXEMPT] 缺席' }];
    releaseFeedbackMock.mockResolvedValue({ replay: false, mode: 'RETRY_DERIVATIVE' });
    const db = dbFor(snapshot);
    const result = await releaseAssignmentSubmissionGrade(db, baseInput);
    expect(releaseFeedbackMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      reviewId: 'review-1',
      mode: 'RETRY_DERIVATIVE',
    }));
    expect(result.release.retriedApprovals).toEqual(['approval-1']);
  });

  it('conclude writes a canonical question exemption with an audited reason', async () => {
    const db = dbFor(snapshotFixture());
    await recordAssignmentQuestionConclusion(db, {
      ...baseInput,
      snapshotItemId: 'item-2',
      kind: 'UNANSWERED',
      scoreEffect: 0,
      reason: '未提交',
    });
    expect(db.teacherAssignmentQuestionExemption.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { submissionId_questionId: { submissionId: 'submission-1', questionId: 'question-2' } },
      create: expect.objectContaining({ scoreEffect: 0, reason: '[UNANSWERED] 未提交' }),
    }));
  });

  it('return delegates to the canonical review return with optimistic version', async () => {
    returnReviewMock.mockResolvedValue({ id: 'grant-1' });
    const snapshot = snapshotFixture();
    snapshot.submission.questionExemptions = [{ questionId: 'question-2', scoreEffect: 0, reason: '[EXEMPT] 缺席' }];
    const db = dbFor(snapshot);
    const result = await returnAssignmentQuestionForResubmission(db, {
      ...baseInput,
      snapshotItemId: 'item-1',
      reason: '需要补充推导过程',
      newDeadlineAt: new Date('2026-09-02T12:00:00.000Z'),
      idempotencyKey: 'idem-key-0001',
    });
    expect(returnReviewMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      reviewId: 'review-1',
      expectedVersion: 3,
      allowedResponseType: 'SUBJECTIVE_TEXT',
      newDeadlineAt: new Date('2026-09-02T12:00:00.000Z'),
    }));
    expect(result.grant).toMatchObject({ id: 'grant-1' });
  });

  it('return rejects deadlines at or before the original due date', async () => {
    const snapshot = snapshotFixture();
    snapshot.submission.questionExemptions = [{ questionId: 'question-2', scoreEffect: 0, reason: '[EXEMPT] 缺席' }];
    const db = dbFor(snapshot);
    await expect(returnAssignmentQuestionForResubmission(db, {
      ...baseInput,
      snapshotItemId: 'item-1',
      reason: '需要补充推导过程',
      newDeadlineAt: new Date('2026-08-29T12:00:00.000Z'),
      idempotencyKey: 'idem-key-0002',
    })).rejects.toMatchObject({ code: 'assignment-result-return-deadline-invalid' });
  });
});
