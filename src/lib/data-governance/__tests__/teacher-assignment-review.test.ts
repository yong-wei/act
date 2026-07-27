import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

import {
  approveTeacherAssignmentReview,
  buildTeacherAssignmentReviewApiProjection,
  consumeTeacherAssignmentOriginalAssetRead,
  createTeacherAssignmentReview,
  deriveTeacherAssignmentReviewTotal,
  deriveTeacherReviewQueueStatus,
  evaluateAssignmentReviewCompleteness,
  getTeacherAssignmentReview,
  resolveTeacherAssignmentReviewAuthorization,
  requestTeacherAssignmentFeedbackRelease,
  returnTeacherAssignmentReview,
  saveTeacherAssignmentReview,
  signTeacherAssignmentOriginalAssetRead,
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
  it('projects only the sealed attempt text and safe current-attempt original assets', () => {
    const review: any = reviewFixture();
    review.gradingRun.answerAttempt = {
      id: 'attempt-1',
      textSnapshot: '# 原始答案\n\n$x^2$',
      answerSnapshot: {
        schemaVersion: 'assignment-response.v2',
        attachmentOrderProvenance: 'legacy-fallback',
      },
      answer: {
        id: 'answer-1',
        attachmentOrderProvenance: 'student-arranged',
      },
      assets: [
        {
          id: 'asset-other-attempt',
          answerId: 'answer-1',
          attemptId: 'attempt-0',
          state: 'FINALIZED',
          originalName: 'old.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          assetRole: 'ATTACHMENT',
          orderIndex: 0,
          objectKey: 'private/old',
          checksum: 'sha256:old',
        },
        {
          id: 'asset-image',
          answerId: 'answer-1',
          attemptId: 'attempt-1',
          state: 'FINALIZED',
          originalName: '..\\private\\diagram.png',
          mimeType: 'image/png',
          sizeBytes: 20,
          assetRole: 'EMBEDDED_IMAGE',
          orderIndex: null,
          embeddedPosition: 'md:diagram',
          objectKey: 'private/image',
          checksum: 'sha256:image',
        },
        {
          id: 'asset-office',
          answerId: 'answer-1',
          attemptId: 'attempt-1',
          state: 'FINALIZED',
          originalName: '/Users/student/\u00ad\u061c\u180e\u202a\u206a\u206f\u2060\u200b\ufeffreport\ufff9.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          sizeBytes: 30,
          assetRole: 'ATTACHMENT',
          orderIndex: 2,
          objectKey: 'private/office',
          checksum: 'sha256:office',
        },
        {
          id: 'asset-pending',
          answerId: 'answer-1',
          attemptId: 'attempt-1',
          state: 'QUARANTINED',
          originalName: 'pending.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 40,
          assetRole: 'ATTACHMENT',
          orderIndex: 1,
        },
      ],
    };
    review.gradingRun.answerEvidence = {
      limitationState: 'evidence-incomplete',
      sourceManifest: {
        sources: [{
          assetId: 'asset-office',
          displayName: '/private/provider/report.docx',
          state: 'UNDERSTANDING_FAILED',
          provider: 'private-provider',
          errorCode: 'private-error',
        }],
      },
      conversion: { canonicalMarkdown: 'converted private answer' },
    };

    const projection = buildTeacherAssignmentReviewApiProjection(review);

    expect(projection.originalResponse).toEqual({
      textSnapshot: '# 原始答案\n\n$x^2$',
      attachmentOrderProvenance: 'legacy-fallback',
      assets: [
        expect.objectContaining({
          id: 'asset-image',
          displayName: 'diagram.png',
          embeddedPosition: 'md:diagram',
        }),
        expect.objectContaining({
          id: 'asset-office',
          displayName: 'report.docx',
          orderIndex: 2,
        }),
      ],
    });
    expect(projection.omittedEvidence).toEqual([{
      assetId: 'asset-office',
      displayName: 'report.docx',
    }]);
    expect(JSON.stringify(projection.originalResponse)).not.toMatch(
      /objectKey|checksum|conversion|provider|errorCode|QUARANTINED/,
    );
    expect(JSON.stringify(projection)).not.toContain('converted private answer');
  });

  it('uses a distinct one-time teacher purpose and rechecks the current attempt before reading', async () => {
    const review = reviewFixture();
    const tokenCreate = vi.fn().mockResolvedValue({ id: 'token-1' });
    const tokenClaim = vi.fn().mockResolvedValue({ count: 1 });
    const asset = {
      id: 'asset-1',
      answerId: review.answerId,
      attemptId: review.attemptId,
      state: 'FINALIZED',
      objectKey: 'private/original',
      originalName: '/private/report.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12,
      checksum: `sha256:${'1'.repeat(64)}`,
    };
    const db: any = {
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review) },
      submissionAsset: { findUnique: vi.fn().mockResolvedValue(asset) },
      submissionAssetAccessToken: {
        create: tokenCreate,
        updateMany: tokenClaim,
      },
    };

    const signed = await signTeacherAssignmentOriginalAssetRead(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: review.assignmentId,
      submissionId: review.submissionId,
      reviewId: review.id,
      assetId: asset.id,
      now,
    });
    expect(signed.url).toContain('/api/teacher/assignments/');
    expect(tokenCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assetId: asset.id,
        studentId: 'teacher-1',
        purpose: 'teacher-assignment-original-read',
      }),
    });

    await expect(consumeTeacherAssignmentOriginalAssetRead(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: review.assignmentId,
      submissionId: review.submissionId,
      reviewId: review.id,
      assetId: asset.id,
      token: 'one-time-token',
      now,
    })).resolves.toMatchObject({
      objectKey: 'private/original',
      displayName: 'report.pdf',
    });
    expect(tokenClaim).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        studentId: 'teacher-1',
        purpose: 'teacher-assignment-original-read',
        usedAt: null,
      }),
      data: { usedAt: now },
    }));

    db.submissionAsset.findUnique.mockResolvedValue({
      ...asset,
      attemptId: 'attempt-old',
    });
    await expect(signTeacherAssignmentOriginalAssetRead(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: review.assignmentId,
      submissionId: review.submissionId,
      reviewId: review.id,
      assetId: asset.id,
      now,
    })).rejects.toMatchObject({
      code: 'teacher-review-original-asset-forbidden',
      status: 403,
    });
  });

  it('requires explicit confirmation before approving incomplete evidence', async () => {
    const review = reviewFixture();
    review.gradingRun = {
      ...review.gradingRun,
      evidenceState: 'EVIDENCE_INCOMPLETE',
      answerEvidence: {
        ...review.gradingRun.answerEvidence,
        limitationState: 'evidence-incomplete',
        sourceManifest: {
          sources: [
            { assetId: 'asset-ready', state: 'READY' },
            { assetId: 'asset-truncated', state: 'READY', limitations: ['blocks-truncated'] },
            { assetId: 'asset-missing', state: 'UNDERSTANDING_FAILED' },
          ],
        },
      },
    } as any;
    const db: any = {
      $transaction: (callback: (tx: any) => Promise<any>) => callback(db),
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review) },
      teacherAssignmentApprovalSnapshot: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    await expect(approveTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: review.assignmentId,
      submissionId: review.submissionId,
      reviewId: review.id,
      expectedVersion: review.version,
      idempotencyKey: 'approve-incomplete',
      now,
    })).rejects.toMatchObject({
      code: 'teacher-review-incomplete-evidence-confirmation-required',
      details: { omittedAssetIds: ['asset-truncated', 'asset-missing'] },
    });
    await expect(approveTeacherAssignmentReview(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: review.assignmentId,
      submissionId: review.submissionId,
      reviewId: review.id,
      expectedVersion: review.version,
      idempotencyKey: 'approve-stale-omitted-assets',
      confirmIncompleteEvidence: true,
      omittedAssetIds: ['asset-missing'],
      now,
    })).rejects.toMatchObject({
      code: 'teacher-review-version-conflict',
      status: 409,
    });
  });

  it('resets a terminal reviewed derivative before retrying its outbox command', async () => {
    const review: any = {
      ...reviewFixture(),
      state: 'APPROVED',
      approvalSnapshot: { id: 'snapshot-1' },
      submission: { ...reviewFixture().submission, reviewState: 'RELEASE_BLOCKED' },
    };
    const resetDerivative = vi.fn().mockResolvedValue({ count: 1 });
    const db: any = {
      $transaction: (callback: (tx: any) => Promise<any>) => callback(db),
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review) },
      teacherAssignmentReviewedDerivative: { updateMany: resetDerivative },
      teacherAssignmentReviewOutbox: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'derivative-command', command: 'GENERATE_DERIVATIVE', state: 'FAILED' },
          { id: 'release-command', command: 'RELEASE_STUDENT_FEEDBACK', state: 'BLOCKED', payload: {} },
        ]),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      assignmentSubmission: { update: vi.fn() },
    };

    await requestTeacherAssignmentFeedbackRelease(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' },
      assignmentId: 'assignment-1',
      submissionId: 'submission-1',
      reviewId: 'review-1',
      mode: 'RETRY_DERIVATIVE',
      now,
    });

    expect(resetDerivative).toHaveBeenCalledWith(expect.objectContaining({
      where: { snapshotId: 'snapshot-1', state: { in: ['BLOCKED', 'FAILED'] } },
      data: expect.objectContaining({ state: 'RETRYABLE', lastErrorCode: null }),
    }));
  });

  it('does not release one question before the whole submission is complete', async () => {
    const review: any = {
      ...reviewFixture(),
      state: 'APPROVED',
      approvalSnapshot: { id: 'snapshot-1' },
      submission: { ...reviewFixture().submission, reviewState: 'REVIEWING' },
    };
    const resetDerivative = vi.fn();
    const db: any = {
      $transaction: (callback: (tx: any) => Promise<any>) => callback(db),
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review) },
      teacherAssignmentReviewedDerivative: { updateMany: resetDerivative },
      teacherAssignmentReviewOutbox: { findMany: vi.fn().mockResolvedValue([
        { id: 'derivative-command', command: 'GENERATE_DERIVATIVE', state: 'FAILED' },
        { id: 'release-command', command: 'RELEASE_STUDENT_FEEDBACK', state: 'BLOCKED', payload: {} },
      ]) },
    };

    await expect(requestTeacherAssignmentFeedbackRelease(db, {
      actor: { id: 'teacher-1', role: 'TEACHER' }, assignmentId: 'assignment-1', submissionId: 'submission-1',
      reviewId: 'review-1', mode: 'RETRY_DERIVATIVE', now,
    })).rejects.toMatchObject({ code: 'teacher-review-release-incomplete', status: 409 });
    expect(resetDerivative).not.toHaveBeenCalled();
  });

  it.each(['BLOCKED', 'FAILED', 'CONTENT_UNAVAILABLE'])(
    'exposes terminal grading state %s as a blocked teacher queue item',
    (state) => {
      expect(deriveTeacherReviewQueueStatus({ state })).toBe('BLOCKED');
    },
  );

  it('rejects detail lookup without an exact review locator', async () => {
    const findUnique = vi.fn();
    await expect(getTeacherAssignmentReview(
      { teacherAssignmentReview: { findUnique } },
      {
        actor: { id: 'teacher-1', role: 'TEACHER' },
        assignmentId: 'assignment-1',
        submissionId: 'submission-1',
        now,
      },
    )).rejects.toMatchObject({ code: 'teacher-review-not-found', status: 404 });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('derives totals only from a complete bounded criterion set', () => {
    expect(deriveTeacherAssignmentReviewTotal(rubric(), criteria())).toBe(9);
    expect(() => deriveTeacherAssignmentReviewTotal(rubric(), criteria().slice(0, 1))).toThrow('teacher-review-criteria-incomplete');
    expect(() => deriveTeacherAssignmentReviewTotal(rubric(), [{ ...criteria()[0], score: 5 }, criteria()[1]])).toThrow('teacher-review-score-out-of-range');
    expect(() => deriveTeacherAssignmentReviewTotal(rubric(), [{ ...criteria()[0], levelId: 'c1-low', score: 4 }, criteria()[1]])).toThrow('teacher-review-level-score-mismatch');
  });

  it('derives a one-decimal total for a standard v2 rubric without level identities', () => {
    expect(deriveTeacherAssignmentReviewTotal({
      schemaVersion: 'assignment-scoring-rubric.v2',
      maxScore: 10,
      criteria: [{
        id: 'criterion-1',
        maxPoints: 10,
        detailedRubricEnabled: false,
        levels: [],
      }],
    }, [{
      criterionId: 'criterion-1',
      levelId: null,
      score: 8.5,
      comment: '证据完整',
    }])).toBe(8.5);
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

  it('uses the latest approval when a current attempt is regraded', () => {
    expect(evaluateAssignmentReviewCompleteness({
      questions: [{ id: 'question-1' }],
      answers: [{ assignmentQuestionId: 'question-1', currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }],
      approvalSnapshots: [
        { questionId: 'question-1', attemptId: 'attempt-1', questionTotal: 4, approvedAt: new Date('2026-07-16T00:00:00Z') },
        { questionId: 'question-1', attemptId: 'attempt-1', questionTotal: 9, approvedAt: new Date('2026-07-17T00:00:00Z') },
      ],
      activeGrants: [],
      exemptions: [],
    })).toEqual({ complete: true, total: 9, blockers: [] });
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
    review.gradingRun = {
      ...review.gradingRun,
      evidenceState: 'EVIDENCE_INCOMPLETE',
      answerEvidence: {
        ...review.gradingRun.answerEvidence,
        limitationState: 'evidence-incomplete',
        sourceManifest: {
          sources: [{ assetId: 'asset-missing', state: 'UNDERSTANDING_FAILED' }],
        },
      },
    } as any;
    const snapshotCreate = vi.fn(async ({ data }: any) => ({ ...data, id: 'snapshot-1' }));
    const auditCreate = vi.fn().mockResolvedValue({});
    const outboxCreateMany = vi.fn().mockResolvedValue({ count: 3 });
    const outboxUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const reviewUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const runUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const assessmentUpdateMany = vi.fn().mockResolvedValue({ count: 1 });
    const submissionUpdate = vi.fn().mockResolvedValue({});
    const db: any = {
      $transaction: (callback: (tx: any) => Promise<any>) => callback(db),
      teacherAssignmentReview: { findUnique: vi.fn().mockResolvedValue(review), updateMany: reviewUpdateMany },
      teacherAssignmentApprovalSnapshot: { create: snapshotCreate, findMany: vi.fn().mockResolvedValue([
        { id: 'snapshot-old', questionId: 'question-1', attemptId: 'attempt-1', questionTotal: 4, approvedAt: new Date('2026-07-16T00:00:00Z') },
      ]) },
      teacherAssignmentReviewOutbox: { createMany: outboxCreateMany, updateMany: outboxUpdateMany },
      gradingRun: { updateMany: runUpdateMany },
      gradingCriterionAssessment: { updateMany: assessmentUpdateMany },
      gradingAuditEvent: { create: auditCreate },
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
      reviewId: review.id, expectedVersion: 2, idempotencyKey: 'approve-review-1',
      confirmIncompleteEvidence: true, now,
    });
    expect(result).toMatchObject({ snapshot: { id: 'snapshot-1', questionTotal: 9 }, replay: false, assignment: { complete: true, total: 9 } });
    expect(snapshotCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      reviewVersion: 2,
      criterionSnapshot: criteria(),
      questionTotal: 9,
      incompleteEvidenceConfirmed: true,
      omittedAssetIds: ['asset-missing'],
    }) }));
    expect(JSON.stringify(auditCreate.mock.calls)).not.toContain('asset-missing');
    expect(outboxCreateMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ command: 'GENERATE_DERIVATIVE', dedupeKey: 'teacher-review:snapshot-1:generate-derivative' }),
        expect.objectContaining({ command: 'RELEASE_STUDENT_FEEDBACK', dedupeKey: 'teacher-review:snapshot-1:release-student-feedback' }),
        expect.objectContaining({ command: 'PROCESS_GOVERNED_EVIDENCE', dedupeKey: 'teacher-review:snapshot-1:process-governed-evidence' }),
      ]),
      skipDuplicates: true,
    });
    expect(outboxUpdateMany).toHaveBeenCalledWith({
      where: {
        snapshotId: { in: ['snapshot-old', 'snapshot-1'] },
        command: 'RELEASE_STUDENT_FEEDBACK',
        state: { in: ['RETRYABLE', 'BLOCKED', 'FAILED'] },
      },
      data: expect.objectContaining({ state: 'PENDING', attemptCount: 0, availableAt: now, lastErrorCode: null }),
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
    expect(db.gradingRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run-1', state: 'AWAITING_REVIEW', teacherReviewedAt: null },
      data: { state: 'CANCELLED', teacherReviewedAt: now, updatedAt: now },
    });
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
