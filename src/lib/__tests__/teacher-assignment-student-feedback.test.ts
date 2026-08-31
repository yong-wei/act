import { describe, expect, it, vi } from 'vitest';

import { listStudentAssignments, presentRevision, presentStudentAssignmentFeedback, presentStudentAssignmentResult, submitQuestionAnswer } from '@/lib/assignments/submission-service';
import { submissionHash } from '@/lib/assignments/submission-integrity';

const question = { id: 'question-1', promptSnapshot: { prompt: '解释闭环稳定性' } };
const snapshot = {
  id: 'snapshot-1',
  assignmentId: 'assignment-1',
  questionId: 'question-1',
  questionTotal: 8,
  criterionSnapshot: [{ criterionId: 'criterion-1', score: 8, comment: '证据充分' }],
  annotationSnapshot: [{ id: 'annotation-1', status: 'ACTIVE', comment: '这里需要说明裕度', anchor: { precision: 'BLOCK', blockId: 'block-1' } }],
  overallComment: '继续完善工程解释。',
  approvedAt: new Date('2026-07-17T00:00:00Z'),
  outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }],
  feedbackRelease: {
    ownerStudentId: 'student-1',
    mode: 'DERIVATIVE',
    derivative: {
      id: 'derivative-1',
      state: 'READY',
      outputKind: 'ANNOTATED_MARKDOWN',
      outputObjectKey: 'reviewed/snapshot-1.md',
      outputMimeType: 'text/markdown',
      anchorPrecision: 'BLOCK',
      limitations: ['native-docx-annotation-unavailable'],
    },
  },
};

describe('student assignment approved feedback projection', () => {
  it('includes active resubmission grants in assignment list presentation', async () => {
    const now = new Date('2026-07-17T01:00:00Z');
    const findMany = vi.fn(async () => [{
      id: 'revision-1', assignmentId: 'assignment-1', title: '作业', instructions: '', latePolicy: { mode: 'CLOSED' },
      publishedAt: now,
      audiences: [{ classId: 'class-1', availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }],
      questions: [{ ...question, stableQuestionId: 'stable-1', orderIndex: 0, responseType: 'SUBJECTIVE_TEXT', points: 10 }],
      submissions: [{
        id: 'submission-1', state: 'SUBMITTED', reviewState: 'RETURNED', studentId: 'student-1', frozenStudentId: 'student-1',
        answers: [], approvalSnapshots: [],
        resubmissionGrants: [{ questionId: 'question-1', state: 'ACTIVE', reason: '请修正符号', allowedResponseType: 'SUBJECTIVE_TEXT', newDeadlineAt: new Date('2026-07-20T00:00:00Z'), expiresAt: new Date('2026-07-20T00:00:00Z') }],
      }],
    }]);
    const prisma: any = {
      studentProfile: { findUnique: async () => ({ classId: 'class-1' }) },
      assignmentRevision: { findMany },
      assignmentSubmission: { findMany: async () => [] },
    };

    const [item] = await listStudentAssignments(prisma, 'student-1', now);
    expect(item).toMatchObject({ state: 'RESUBMISSION_REQUIRED', canMutate: true, nextAction: 'resubmit-question' });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: expect.objectContaining({
        submissions: expect.objectContaining({ include: expect.objectContaining({ resubmissionGrants: expect.any(Object) }) }),
      }),
    }));
  });

  it('does not advertise resubmission after the return grant expires', () => {
    const now = new Date('2026-07-21T01:00:00Z');
    const detail = presentRevision({
      assignmentId: 'assignment-1', id: 'revision-1', title: '作业', instructions: '', latePolicy: { mode: 'CLOSED' },
      questions: [{ ...question, stableQuestionId: 'stable-1', orderIndex: 0, responseType: 'SUBJECTIVE_TEXT', points: 10 }],
    }, { availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }, {
      id: 'submission-1', state: 'SUBMITTED', reviewState: 'RETURNED', studentId: 'student-1', frozenStudentId: 'student-1',
      answers: [], approvalSnapshots: [],
      resubmissionGrants: [{ questionId: 'question-1', state: 'ACTIVE', reason: '已过期', allowedResponseType: 'SUBJECTIVE_TEXT', newDeadlineAt: new Date('2026-07-20T00:00:00Z'), expiresAt: new Date('2026-07-20T00:00:00Z') }],
    }, true, now);

    expect(detail).toMatchObject({ state: 'SUBMITTED', canMutate: false });
    expect(detail.nextAction).not.toBe('resubmit-question');
    expect(detail.questions[0].resubmission).toBeNull();
  });

  it('replays a consumed resubmission before checking mutable delivery state', async () => {
    const attempt = {
      id: 'attempt-2',
      answerId: 'answer-1',
      attemptNumber: 2,
      answerVersion: 3,
      answer: {
        id: 'answer-1',
        assignmentQuestionId: 'question-1',
        submissionId: 'submission-1',
        submission: { revision: { assignmentId: 'assignment-1' } },
      },
    };
    const tx: any = {
      submissionIdempotency: { findMany: async () => [{ scope: 'submit:answer-1', requestHash: submissionHash({ answerVersion: 3 }), attempt }] },
      submissionAnswer: { findMany: async () => [{ state: 'SUBMITTED' }] },
      assignmentSubmission: {
        findUniqueOrThrow: async () => ({ requiredQuestionCount: 1 }),
        update: async () => ({}),
      },
    };
    const prisma: any = { $transaction: (callback: (client: any) => Promise<any>) => callback(tx) };

    const result = await submitQuestionAnswer(prisma, {
      studentId: 'student-1', assignmentId: 'assignment-1', questionId: 'question-1',
      answerVersion: 3, idempotencyKey: 'resubmit-key', now: new Date('2026-08-01T00:00:00Z'),
    });

    expect(result.attempt).toMatchObject({ id: 'attempt-2', attemptNumber: 2 });
    expect(result.attempt).not.toHaveProperty('answer');
  });

  it('publishes only a successful release owned by the frozen student', () => {
    const feedback = presentStudentAssignmentFeedback({
      studentId: 'student-1', frozenStudentId: 'student-1', approvalSnapshots: [snapshot], resubmissionGrants: [],
    }, [question], new Date('2026-07-17T01:00:00Z'));
    expect(feedback).toEqual([expect.objectContaining({
      snapshotId: 'snapshot-1',
      questionTitle: '解释闭环稳定性',
      questionTotal: 8,
      reviewedAssets: [expect.objectContaining({ href: '/api/student/assignments/assignment-1/feedback/snapshot-1/asset', precision: 'BLOCK' })],
      limitations: ['native-docx-annotation-unavailable'],
    })]);
  });

  it('shows only the latest published feedback for the current attempt', () => {
    const old = { ...snapshot, id: 'snapshot-old', attemptId: 'attempt-1', questionTotal: 4, approvedAt: new Date('2026-07-16T00:00:00Z') };
    const latest = { ...snapshot, id: 'snapshot-latest', attemptId: 'attempt-1', questionTotal: 9, approvedAt: new Date('2026-07-17T00:00:00Z') };
    const feedback = presentStudentAssignmentFeedback({
      studentId: 'student-1', frozenStudentId: 'student-1', approvalSnapshots: [old, latest], resubmissionGrants: [],
      answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }],
    }, [question], new Date('2026-07-17T01:00:00Z'));

    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ snapshotId: 'snapshot-latest', questionTotal: 9 });
  });

  it('keeps feedback hidden before release and on owner mismatch', () => {
    expect(presentStudentAssignmentFeedback({ studentId: 'student-1', frozenStudentId: 'student-1', approvalSnapshots: [{ ...snapshot, outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'PENDING' }] }] }, [question], new Date())).toEqual([]);
    expect(presentStudentAssignmentFeedback({ studentId: 'student-1', frozenStudentId: 'student-2', approvalSnapshots: [snapshot] }, [question], new Date())).toEqual([]);
  });

  it('returns the released result package together with its reviewed asset for the confirmation release policy', () => {
    const detail = presentRevision({
      assignmentId: 'assignment-1', id: 'revision-1', title: '作业', instructions: '', latePolicy: { mode: 'CLOSED' }, solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' },
      questions: [{ ...question, stableQuestionId: 'stable-1', orderIndex: 0, responseType: 'SUBJECTIVE_TEXT', points: 10 }],
    }, { availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }, {
      id: 'submission-1', state: 'SUBMITTED', reviewState: 'REVIEWED', reviewedAt: new Date('2026-08-14T13:30:00Z'), studentId: 'student-1', frozenStudentId: 'student-1', submittedRequiredCount: 1,
      answers: [], approvalSnapshots: [snapshot], resubmissionGrants: [], gradingSnapshots: [{ createdAt: new Date('2026-08-14T12:00:00Z'), items: [{ questionId: 'question-1', attemptId: null }] }],
    }, true, new Date('2026-08-14T14:00:00Z'));

    expect(detail).toMatchObject({ approvedTotal: 8, feedbackStatus: 'PUBLISHED', feedback: [expect.objectContaining({ snapshotId: 'snapshot-1', reviewedAssets: [expect.objectContaining({ label: '下载批注说明' })] })], resultPackage: { totalScore: 8, overallComment: '第 1 题：继续完善工程解释。', questions: [{ questionId: 'question-1', score: 8, comment: '继续完善工程解释。' }] } });
    expect(detail.resultPackage?.questions[0]).not.toHaveProperty('source');
  });

  it('hides all result content before a confirmation release package exists', () => {
    const detail = presentRevision({
      assignmentId: 'assignment-1', id: 'revision-1', title: '作业', instructions: '', latePolicy: { mode: 'CLOSED' }, solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' },
      questions: [{ ...question, stableQuestionId: 'stable-1', orderIndex: 0, responseType: 'SUBJECTIVE_TEXT', points: 10 }],
    }, { availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }, {
      id: 'submission-1', state: 'SUBMITTED', reviewState: 'REVIEWED', approvedTotal: 8, studentId: 'student-1', frozenStudentId: 'student-1', submittedRequiredCount: 1,
      answers: [], approvalSnapshots: [snapshot], resubmissionGrants: [], gradingSnapshots: [],
    }, true, new Date('2026-08-14T14:00:00Z'));

    expect(detail).toMatchObject({ approvedTotal: null, feedbackStatus: 'HIDDEN', feedback: [], resultPackage: null });
  });

  it('projects the current grading snapshot state without exposing internal grading records', () => {
    const revision = {
      assignmentId: 'assignment-1', id: 'revision-1', title: '作业', instructions: '', latePolicy: { mode: 'CLOSED' }, solutionReleasePolicy: { mode: 'TEACHER_CONFIRMED_RESULT' },
      questions: [{ ...question, stableQuestionId: 'stable-1', orderIndex: 0, responseType: 'SUBJECTIVE_TEXT', points: 10 }],
    };
    const base = {
      id: 'submission-1', state: 'SUBMITTED', reviewState: 'PENDING', studentId: 'student-1', frozenStudentId: 'student-1', submittedRequiredCount: 1,
      answers: [{ assignmentQuestionId: 'question-1', state: 'SUBMITTED', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }], assets: [] }], approvalSnapshots: [], resubmissionGrants: [],
    };
    const running = presentRevision(revision, { availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }, {
      ...base, gradingSnapshots: [{ createdAt: new Date('2026-07-11T00:00:00Z'), operation: { state: 'RUNNING' }, items: [{ questionId: 'question-1', attemptId: 'attempt-1' }], grade: { state: 'PENDING_GRADING' } }],
    }, true, new Date('2026-07-11T01:00:00Z'));
    const failed = presentRevision(revision, { availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }, {
      ...base, gradingSnapshots: [{ createdAt: new Date('2026-07-11T00:00:00Z'), operation: { state: 'PARTIAL' }, items: [{ questionId: 'question-1', attemptId: 'attempt-1' }], grade: { state: 'PARTIAL_FAILURE' } }],
    }, true, new Date('2026-07-11T01:00:00Z'));

    expect(running).toMatchObject({ state: 'IN_REVIEW', feedback: [], resultPackage: null });
    expect(failed).toMatchObject({ state: 'PARTIAL_GRADING_FAILURE', feedback: [], resultPackage: null });
  });

  it('hides an old released package after a resubmission changes the current attempt vector', () => {
    const result = presentStudentAssignmentResult({
      studentId: 'student-1', frozenStudentId: 'student-1',
      answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 2, attempts: [{ id: 'attempt-1', attemptNumber: 1 }, { id: 'attempt-2', attemptNumber: 2 }] }],
      approvalSnapshots: [{
        questionId: 'question-1',
        attemptId: 'attempt-1',
        questionTotal: 8,
        criterionSnapshot: [],
        annotationSnapshot: [],
        outboxCommands: [{ command: 'RELEASE_STUDENT_FEEDBACK', state: 'SUCCEEDED' }],
        feedbackRelease: { ownerStudentId: 'student-1', releasedAt: new Date('2026-08-14T13:00:00Z') },
      }],
      gradingSnapshots: [{ createdAt: new Date('2026-08-14T12:00:00Z'), items: [{ questionId: 'question-1', attemptId: 'attempt-1' }] }],
    }, [{ id: 'question-1', answerSnapshot: null, rubricSnapshot: null }]);

    expect(result).toBeNull();
  });

  it('keeps a returned submitted question editable from its active grant without requiring published feedback', () => {
    const now = new Date('2026-07-17T01:00:00Z');
    const detail = presentRevision({
      assignmentId: 'assignment-1', id: 'revision-1', title: '作业', instructions: '', latePolicy: { mode: 'CLOSED' },
      questions: [{ ...question, stableQuestionId: 'stable-1', orderIndex: 0, responseType: 'SUBJECTIVE_TEXT', points: 10 }],
    }, { availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }, {
      id: 'submission-1', state: 'SUBMITTED', reviewState: 'RETURNED', studentId: 'student-1', frozenStudentId: 'student-1',
      submittedRequiredCount: 1, approvalSnapshots: [],
      answers: [{ assignmentQuestionId: 'question-1', state: 'SUBMITTED', version: 2, currentAttemptNumber: 1, attempts: [], assets: [] }],
      resubmissionGrants: [{ questionId: 'question-1', state: 'ACTIVE', reason: '请修正符号', allowedResponseType: 'SUBJECTIVE_TEXT', newDeadlineAt: new Date('2026-07-20T00:00:00Z'), expiresAt: new Date('2026-07-20T00:00:00Z') }],
    }, true, now);

    expect(detail).toMatchObject({ state: 'RESUBMISSION_REQUIRED', nextAction: 'resubmit-question', canMutate: true });
    expect(detail.questions[0]).toMatchObject({
      state: 'NOT_STARTED',
      resubmission: { reason: '请修正符号', deadlineAt: new Date('2026-07-20T00:00:00Z') },
    });
    expect(detail.feedback).toEqual([]);
  });

  it('exposes only new unbound uploads when a file question is returned', () => {
    const now = new Date('2026-07-17T01:00:00Z');
    const detail = presentRevision({
      assignmentId: 'assignment-1', id: 'revision-1', title: '作业', instructions: '', latePolicy: { mode: 'CLOSED' },
      questions: [{ ...question, stableQuestionId: 'stable-1', orderIndex: 0, responseType: 'SUBJECTIVE_FILE', points: 10 }],
    }, { availableAt: new Date('2026-07-01T00:00:00Z'), dueAt: new Date('2026-07-10T00:00:00Z') }, {
      id: 'submission-1', state: 'SUBMITTED', reviewState: 'RETURNED', studentId: 'student-1', frozenStudentId: 'student-1',
      submittedRequiredCount: 1, approvalSnapshots: [],
      answers: [{
        assignmentQuestionId: 'question-1', state: 'SUBMITTED', version: 2, currentAttemptNumber: 1, attempts: [],
        assets: [
          { id: 'historical-asset', attemptId: 'attempt-1', originalName: 'old.pdf', mimeType: 'application/pdf', sizeBytes: 10, state: 'FINALIZED' },
          { id: 'new-asset', attemptId: null, originalName: 'new.pdf', mimeType: 'application/pdf', sizeBytes: 20, state: 'FINALIZED' },
          { id: 'removed-asset', attemptId: null, originalName: 'removed.pdf', mimeType: 'application/pdf', sizeBytes: 30, state: 'REVOKED' },
        ],
      }],
      resubmissionGrants: [{ questionId: 'question-1', state: 'ACTIVE', reason: '请重新上传文档', allowedResponseType: 'SUBJECTIVE_FILE', newDeadlineAt: new Date('2026-07-20T00:00:00Z'), expiresAt: new Date('2026-07-20T00:00:00Z') }],
    }, true, now);

    expect(detail.questions[0].assets).toEqual([
      expect.objectContaining({ id: 'new-asset', displayName: 'new.pdf' }),
    ]);
  });
});
