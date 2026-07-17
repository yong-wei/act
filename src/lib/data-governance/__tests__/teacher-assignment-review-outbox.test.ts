import { describe, expect, it, vi } from 'vitest';

import {
  claimTeacherAssignmentReviewOutbox,
  processClaimedTeacherAssignmentReviewOutbox,
  settleTeacherAssignmentReviewOutboxFailure,
} from '../teacher-assignment-review-outbox';
import { runTeacherAssignmentReviewOutboxWorkerTick } from '../../../../scripts/workers/teacher-assignment-review-outbox-worker';

const now = new Date('2026-07-17T02:00:00Z');

function memoryOutbox(row: any) {
  const matches = (where: any) => (!where.id || row.id === where.id)
    && (!where.claimToken || row.claimToken === where.claimToken)
    && (!where.state || (where.state.in ? where.state.in.includes(row.state) : row.state === where.state))
    && (!where.leaseExpiresAt?.gt || row.leaseExpiresAt > where.leaseExpiresAt.gt)
    && (!where.leaseExpiresAt?.lte || row.leaseExpiresAt <= where.leaseExpiresAt.lte);
  return {
    row,
    teacherAssignmentReviewOutbox: {
      findFirst: vi.fn(async () => ({ ...row })),
      findUnique: vi.fn(async () => ({ ...row })),
      updateMany: vi.fn(async ({ where, data }: any) => {
        if (!matches(where)) return { count: 0 };
        Object.assign(row, data, data.attemptCount?.increment ? { attemptCount: row.attemptCount + data.attemptCount.increment } : {});
        return { count: 1 };
      }),
    },
  };
}

describe('teacher assignment review outbox', () => {
  it('waits to release feedback until the whole submission is approved', async () => {
    const row = { id: 'release-incomplete', snapshotId: 'snapshot-incomplete', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = { findUnique: vi.fn().mockResolvedValue({
      id: 'snapshot-incomplete', submissionId: 'submission-1', submission: { frozenStudentId: 'student-1', reviewState: 'REVIEWING' },
      authorizationSnapshot: {}, answerEvidence: { sourceHash: 'sha256:aaaaaaaa', sourceAsset: { checksum: 'sha256:aaaaaaaa' } },
    }) };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn() };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn() };

    await expect(processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now }))
      .rejects.toMatchObject({ code: 'teacher-review-submission-incomplete', retryable: true });
    expect(db.teacherAssignmentReviewedDerivative.findFirst).not.toHaveBeenCalled();
    expect(db.teacherAssignmentFeedbackRelease.upsert).not.toHaveBeenCalled();
  });

  it('claims pending work with a lease and fences an old token after recovery', async () => {
    const db: any = memoryOutbox({ id: 'outbox-1', state: 'PENDING', attemptCount: 0, availableAt: now, claimToken: null, leaseExpiresAt: null });
    const first = await claimTeacherAssignmentReviewOutbox({ db, claimToken: 'worker-a', now, leaseMs: 1_000 });
    expect(first).toMatchObject({ claimToken: 'worker-a', state: 'PROCESSING', attemptCount: 1 });
    db.row.leaseExpiresAt = new Date(now.getTime() - 1);
    const second = await claimTeacherAssignmentReviewOutbox({ db, claimToken: 'worker-b', now, leaseMs: 1_000 });
    expect(second).toMatchObject({ claimToken: 'worker-b', attemptCount: 2 });
    await expect(processClaimedTeacherAssignmentReviewOutbox({ db, claim: first!, handlers: {}, now })).rejects.toThrow('teacher-review-outbox-claim-lost');
  });

  it('does not release feedback before a derivative is ready unless structured-only fallback is explicit', async () => {
    const row = { id: 'release-1', snapshotId: 'snapshot-1', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = { findUnique: vi.fn().mockResolvedValue({ id: 'snapshot-1', submissionId: 'submission-1', submission: { frozenStudentId: 'student-1', reviewState: 'APPROVED_PENDING_RELEASE' }, authorizationSnapshot: {}, answerEvidence: { sourceHash: 'sha256:aaaaaaaa', sourceAsset: { checksum: 'sha256:aaaaaaaa' } } }) };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn().mockResolvedValue(null) };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn() };
    db.assignmentSubmission = { findUnique: vi.fn().mockResolvedValue({ id: 'submission-1', answers: [] }), updateMany: vi.fn() };
    db.teacherAssignmentApprovalSnapshot.findMany = vi.fn().mockResolvedValue([]);
    await expect(processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now })).rejects.toMatchObject({ code: 'reviewed-derivative-not-ready', retryable: true });
    row.payload = { structuredOnlyFallback: true };
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(db.teacherAssignmentFeedbackRelease.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ mode: 'STRUCTURED_ONLY' }) }));
  });

  it('releases a ready source-free TEXT_NATIVE Markdown derivative without requiring a source asset', async () => {
    const row = { id: 'release-text-native', snapshotId: 'snapshot-text-native', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = {
      findUnique: vi.fn().mockResolvedValue({ id: 'snapshot-text-native', submissionId: 'submission-text', submission: { frozenStudentId: 'student-1', reviewState: 'APPROVED_PENDING_RELEASE' }, authorizationSnapshot: {}, answerEvidence: { sourceKind: 'TEXT_NATIVE', sourceHash: 'sha256:aaaaaaaa', sourceAsset: null } }),
      findMany: vi.fn().mockResolvedValue([{ id: 'snapshot-text-native', attemptId: 'attempt-text', approvedAt: now, feedbackRelease: { id: 'release-text' } }]),
    };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn().mockResolvedValue({ id: 'derivative-text', state: 'READY', outputKind: 'ANNOTATED_MARKDOWN' }) };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn().mockResolvedValue({ id: 'release-text' }) };
    db.assignmentSubmission = {
      findUnique: vi.fn().mockResolvedValue({ answers: [{ currentAttemptNumber: 1, attempts: [{ id: 'attempt-text', attemptNumber: 1 }] }] }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(db.teacherAssignmentFeedbackRelease.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ derivativeId: 'derivative-text', mode: 'DERIVATIVE' }) }));
    expect(row.state).toBe('SUCCEEDED');
  });

  it('marks a submission REVIEWED only after every current attempt feedback release exists', async () => {
    const row = { id: 'release-all', snapshotId: 'snapshot-2', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = {
      findUnique: vi.fn().mockResolvedValue({ id: 'snapshot-2', submissionId: 'submission-1', submission: { frozenStudentId: 'student-1', reviewState: 'APPROVED_PENDING_RELEASE' }, authorizationSnapshot: {}, answerEvidence: { sourceHash: 'sha256:aaaaaaaa', sourceAsset: { checksum: 'sha256:aaaaaaaa' } } }),
      findMany: vi.fn().mockResolvedValue([
        { attemptId: 'attempt-1', feedbackRelease: { id: 'release-1' }, outboxCommands: [{ state: 'SUCCEEDED' }] },
        { attemptId: 'attempt-2', feedbackRelease: { id: 'release-2' }, outboxCommands: [{ state: 'SUCCEEDED' }] },
      ]),
    };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn().mockResolvedValue({ id: 'derivative-1', state: 'READY' }) };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn().mockResolvedValue({ id: 'release-2' }) };
    db.assignmentSubmission = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'submission-1',
        reviewState: 'APPROVED_PENDING_RELEASE',
        answers: [
          { currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] },
          { currentAttemptNumber: 2, attempts: [{ id: 'attempt-old', attemptNumber: 1 }, { id: 'attempt-2', attemptNumber: 2 }] },
        ],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(db.assignmentSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: 'submission-1', reviewState: { in: ['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED'] } },
      data: { reviewState: 'REVIEWED', reviewedAt: now, updatedAt: now },
    });
  });

  it('keeps APPROVED_PENDING_RELEASE while any current attempt is unreleased', async () => {
    const row = { id: 'release-partial', snapshotId: 'snapshot-2', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = {
      findUnique: vi.fn().mockResolvedValue({ id: 'snapshot-2', submissionId: 'submission-1', submission: { frozenStudentId: 'student-1', reviewState: 'APPROVED_PENDING_RELEASE' }, authorizationSnapshot: {}, answerEvidence: { sourceHash: 'sha256:aaaaaaaa', sourceAsset: { checksum: 'sha256:aaaaaaaa' } } }),
      findMany: vi.fn().mockResolvedValue([{ attemptId: 'attempt-1', feedbackRelease: { id: 'release-1' } }]),
    };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn().mockResolvedValue({ id: 'derivative-1', state: 'READY' }) };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn().mockResolvedValue({ id: 'release-1' }) };
    db.assignmentSubmission = {
      findUnique: vi.fn().mockResolvedValue({ answers: [
        { currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] },
        { currentAttemptNumber: 1, attempts: [{ id: 'attempt-2', attemptNumber: 1 }] },
      ] }),
      updateMany: vi.fn(),
    };
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(db.assignmentSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('surfaces an earlier question terminal release failure when the final question settles', async () => {
    const row = { id: 'release-final', snapshotId: 'snapshot-final', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = {
      findUnique: vi.fn().mockResolvedValue({ id: 'snapshot-final', submissionId: 'submission-1', submission: { frozenStudentId: 'student-1', reviewState: 'APPROVED_PENDING_RELEASE' }, authorizationSnapshot: {}, answerEvidence: { sourceHash: 'sha256:aaaaaaaa', sourceAsset: { checksum: 'sha256:aaaaaaaa' } } }),
      findMany: vi.fn().mockResolvedValue([
        { attemptId: 'attempt-1', feedbackRelease: null, outboxCommands: [{ state: 'FAILED' }] },
        { attemptId: 'attempt-2', feedbackRelease: { id: 'release-2' }, outboxCommands: [{ state: 'SUCCEEDED' }] },
      ]),
    };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn().mockResolvedValue({ id: 'derivative-2', state: 'READY' }) };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn().mockResolvedValue({ id: 'release-2' }) };
    db.assignmentSubmission = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'submission-1', reviewState: 'APPROVED_PENDING_RELEASE',
        answers: [
          { currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] },
          { currentAttemptNumber: 1, attempts: [{ id: 'attempt-2', attemptNumber: 1 }] },
        ],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };

    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });

    expect(db.assignmentSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reviewState: 'RELEASE_BLOCKED', reviewedAt: null }),
    }));
  });

  it('does not let an older released approval satisfy a newer approval for the same current attempt', async () => {
    const row = { id: 'release-reapproved', snapshotId: 'snapshot-attempt-2', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = {
      findUnique: vi.fn().mockResolvedValue({ id: 'snapshot-attempt-2', submissionId: 'submission-1', submission: { frozenStudentId: 'student-1', reviewState: 'APPROVED_PENDING_RELEASE' }, authorizationSnapshot: {}, answerEvidence: { sourceHash: 'sha256:aaaaaaaa', sourceAsset: { checksum: 'sha256:aaaaaaaa' } } }),
      findMany: vi.fn().mockResolvedValue([
        { id: 'snapshot-new', attemptId: 'attempt-1', approvedAt: new Date('2026-07-17T01:00:00Z'), feedbackRelease: null },
        { id: 'snapshot-attempt-2', attemptId: 'attempt-2', approvedAt: new Date('2026-07-17T00:00:00Z'), feedbackRelease: { id: 'release-new' } },
        { id: 'snapshot-old', attemptId: 'attempt-1', approvedAt: new Date('2026-07-16T01:00:00Z'), feedbackRelease: { id: 'release-old' } },
      ]),
    };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn().mockResolvedValue({ id: 'derivative-new', state: 'READY' }) };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn().mockResolvedValue({ id: 'release-new' }) };
    db.assignmentSubmission = {
      findUnique: vi.fn().mockResolvedValue({ answers: [
        { currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] },
        { currentAttemptNumber: 1, attempts: [{ id: 'attempt-2', attemptNumber: 1 }] },
      ] }),
      updateMany: vi.fn(),
    };
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(db.assignmentSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('marks only pending current submission release as RELEASE_BLOCKED on terminal release failure', async () => {
    const row = { id: 'release-failed', snapshotId: 'snapshot-3', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 8, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = { findUnique: vi.fn().mockResolvedValue({ submissionId: 'submission-3' }) };
    db.assignmentSubmission = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'submission-3', reviewState: 'APPROVED_PENDING_RELEASE',
        answers: [{ currentAttemptNumber: 1, attempts: [{ id: 'attempt-3', attemptNumber: 1 }] }],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    db.teacherAssignmentApprovalSnapshot.findMany = vi.fn().mockResolvedValue([
      { attemptId: 'attempt-3', feedbackRelease: null, outboxCommands: [{ state: 'BLOCKED' }] },
    ]);
    await settleTeacherAssignmentReviewOutboxFailure({ db, claim: { ...row }, error: Object.assign(new Error('permanent'), { code: 'release-policy-blocked', blocked: true }), now });
    expect(db.assignmentSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: 'submission-3', reviewState: { in: ['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED'] } },
      data: { reviewState: 'RELEASE_BLOCKED', reviewedAt: null, updatedAt: now },
    });
  });

  it('blocks release on source checksum mismatch even with structured-only fallback', async () => {
    const row = { id: 'release-mismatch', snapshotId: 'snapshot-mismatch', command: 'RELEASE_STUDENT_FEEDBACK', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: { structuredOnlyFallback: true } };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = { findUnique: vi.fn().mockResolvedValue({
      id: 'snapshot-mismatch', submissionId: 'submission-1', submission: { frozenStudentId: 'student-1', reviewState: 'APPROVED_PENDING_RELEASE' }, authorizationSnapshot: {},
      answerEvidence: { sourceHash: 'sha256:aaaaaaaa', sourceAsset: { checksum: 'sha256:bbbbbbbb' } },
    }) };
    db.teacherAssignmentReviewedDerivative = { findFirst: vi.fn() };
    db.teacherAssignmentFeedbackRelease = { upsert: vi.fn() };
    db.assignmentSubmission = {
      findUnique: vi.fn().mockResolvedValue({
        id: 'submission-1', reviewState: 'APPROVED_PENDING_RELEASE',
        answers: [{ currentAttemptNumber: 1, attempts: [{ id: 'attempt-1', attemptNumber: 1 }] }],
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    db.teacherAssignmentApprovalSnapshot.findMany = vi.fn().mockResolvedValue([
      { attemptId: 'attempt-1', feedbackRelease: null, outboxCommands: [{ state: 'BLOCKED' }] },
    ]);
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(row).toMatchObject({ state: 'BLOCKED', limitationCode: 'reviewed-derivative-source-checksum-mismatch' });
    expect(db.teacherAssignmentReviewedDerivative.findFirst).not.toHaveBeenCalled();
    expect(db.teacherAssignmentFeedbackRelease.upsert).not.toHaveBeenCalled();
  });

  it('blocks governed evidence explicitly when criterion mapping is missing', async () => {
    const row = { id: 'evidence-1', snapshotId: 'snapshot-1', command: 'PROCESS_GOVERNED_EVIDENCE', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = { findUnique: vi.fn().mockResolvedValue({ id: 'snapshot-1', submission: { frozenStudentId: 'student-1' }, criterionSnapshot: [], gradingRun: { questionSnapshot: {} } }) };
    db.evidenceOutbox = { upsert: vi.fn() };
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(row).toMatchObject({ state: 'BLOCKED', limitationCode: 'governed-evidence-mapping-missing', claimToken: null });
    expect(db.evidenceOutbox.upsert).not.toHaveBeenCalled();
  });

  it('writes only an idempotent governed evidence candidate with complete lineage', async () => {
    const row = { id: 'evidence-2', snapshotId: 'snapshot-2', command: 'PROCESS_GOVERNED_EVIDENCE', state: 'PROCESSING', attemptCount: 1, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000), payload: {} };
    const db: any = memoryOutbox(row);
    db.teacherAssignmentApprovalSnapshot = { findUnique: vi.fn().mockResolvedValue({
      id: 'snapshot-2', reviewVersion: 4, assignmentId: 'assignment-1', submissionId: 'submission-1', questionId: 'question-1', attemptId: 'attempt-1', answerEvidenceId: 'evidence-source',
      reviewerId: 'teacher-1', rubricVersion: 'rubric-v2', evaluatorVersion: 'eval-v3', lifecyclePolicyVersion: 'lifecycle-v1', machineSnapshotHash: 'sha256:machine',
      criterionSnapshot: [{ criterionId: 'criterion-1', score: 4 }], annotationSnapshot: [], authorizationSnapshot: { mode: 'current-class' },
      submission: { frozenStudentId: 'student-1' },
      answerEvidence: { sourceHash: 'sha256:aaaaaaaa', canonicalMarkdown: 'answer', blocks: [], sourceAsset: { checksum: 'sha256:aaaaaaaa' } },
      gradingRun: { assessments: [{ criterionId: 'criterion-1', levelId: 'ai-level', score: 3, confidence: 0.8 }], questionSnapshot: { evidenceMapping: { 'criterion-1': { capability: 'modeling' } } } },
    }) };
    db.evidenceOutbox = { upsert: vi.fn().mockResolvedValue({ id: 'governed-1' }) };
    await processClaimedTeacherAssignmentReviewOutbox({ db, claim: { ...row }, handlers: {}, now });
    expect(db.evidenceOutbox.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { dedupeKey: 'teacher-assignment-review:snapshot-2:4:rubric-v2' },
      create: expect.objectContaining({ ownerUserId: 'student-1', payload: expect.objectContaining({ sourceChecksum: 'sha256:aaaaaaaa', reviewerId: 'teacher-1', machineCriterionSnapshot: [expect.objectContaining({ score: 3 })] }) }),
    }));
    expect(row.state).toBe('SUCCEEDED');
  });

  it('retries transient failures with token-fenced exponential availability', async () => {
    const row: any = { id: 'outbox-1', state: 'PROCESSING', attemptCount: 2, claimToken: 'worker', leaseExpiresAt: new Date(now.getTime() + 60_000) };
    const db: any = memoryOutbox(row);
    await settleTeacherAssignmentReviewOutboxFailure({ db, claim: { ...row }, error: Object.assign(new Error('temporary'), { retryable: true, code: 'renderer-unavailable' }), now });
    expect(row).toMatchObject({ state: 'RETRYABLE', lastErrorCode: 'renderer-unavailable', claimToken: null });
    expect(row.availableAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it('runs an empty durable worker tick without inventing queue work', async () => {
    const db: any = {
      teacherAssignmentReviewOutbox: { findFirst: vi.fn().mockResolvedValue(null) },
      teacherAssignmentResubmissionIntake: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    await expect(runTeacherAssignmentReviewOutboxWorkerTick({ db, handlers: {}, limit: 10 })).resolves.toEqual({
      reviewOutbox: { claimed: 0, succeeded: 0, retryable: 0, blocked: 0, failed: 0 },
      resubmissionIntakes: { claimed: 0, queued: 0, waiting: 0, retryable: 0, blocked: 0 },
    });
  });
});
