import { randomUUID } from 'node:crypto';

import { generateReviewedDerivative, type ReviewedDerivativeOptions, type ReviewedDerivativeRenderer } from './teacher-assignment-review-derivative';

const DEFAULT_LEASE_MS = 60_000;
const DEFAULT_MAX_ATTEMPTS = 8;

export class TeacherAssignmentReviewOutboxError extends Error {
  readonly retryable: boolean;
  readonly blocked: boolean;
  constructor(public readonly code: string, options?: { retryable?: boolean; blocked?: boolean }) {
    super(code);
    this.retryable = options?.retryable ?? false;
    this.blocked = options?.blocked ?? false;
  }
}

export type TeacherAssignmentReviewOutboxHandlers = {
  derivativeRenderer?: ReviewedDerivativeRenderer;
  derivativeOptions?: ReviewedDerivativeOptions;
  resolveEvidenceMapping?: (snapshot: any) => Promise<Record<string, unknown> | null> | Record<string, unknown> | null;
};

export async function claimTeacherAssignmentReviewOutbox(input: { db: any; claimToken?: string; now?: Date; leaseMs?: number }) {
  const now = input.now ?? new Date();
  const claimToken = input.claimToken ?? randomUUID();
  const row = await input.db.teacherAssignmentReviewOutbox.findFirst({
    where: {
      OR: [
        { state: { in: ['PENDING', 'RETRYABLE'] }, availableAt: { lte: now } },
        { state: 'PROCESSING', leaseExpiresAt: { lte: now } },
      ],
    },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!row) return null;
  const claimed = await input.db.teacherAssignmentReviewOutbox.updateMany({
    where: row.state === 'PROCESSING'
      ? { id: row.id, state: 'PROCESSING', claimToken: row.claimToken, leaseExpiresAt: { lte: now } }
      : { id: row.id, state: row.state, availableAt: { lte: now } },
    data: {
      state: 'PROCESSING',
      claimToken,
      claimedAt: now,
      leaseExpiresAt: new Date(now.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS)),
      attemptCount: { increment: 1 },
      lastErrorCode: null,
      limitationCode: null,
      updatedAt: now,
    },
  });
  if (claimed?.count !== 1) return null;
  return {
    ...row,
    state: 'PROCESSING',
    claimToken,
    claimedAt: now,
    leaseExpiresAt: new Date(now.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS)),
    attemptCount: Number(row.attemptCount ?? 0) + 1,
  };
}

export async function renewTeacherAssignmentReviewOutboxLease(input: { db: any; claim: any; now?: Date; leaseMs?: number }) {
  const now = input.now ?? new Date();
  const renewed = await input.db.teacherAssignmentReviewOutbox.updateMany({
    where: { id: input.claim.id, state: 'PROCESSING', claimToken: input.claim.claimToken, leaseExpiresAt: { gt: now } },
    data: { leaseExpiresAt: new Date(now.getTime() + (input.leaseMs ?? DEFAULT_LEASE_MS)), updatedAt: now },
  });
  return renewed?.count === 1;
}

export async function processClaimedTeacherAssignmentReviewOutbox(input: {
  db: any;
  claim: any;
  handlers: TeacherAssignmentReviewOutboxHandlers;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  await assertOwnedClaim(input.db, input.claim, now);
  const heartbeat = startOutboxLeaseHeartbeat({ db: input.db, claim: input.claim });
  try {
    const result = input.claim.command === 'GENERATE_DERIVATIVE'
      ? await processDerivative(input.db, input.claim, input.handlers)
      : input.claim.command === 'RELEASE_STUDENT_FEEDBACK'
        ? await processRelease(input.db, input.claim, now)
        : input.claim.command === 'PROCESS_GOVERNED_EVIDENCE'
          ? await processGovernedEvidence(input.db, input.claim, input.handlers, now)
          : (() => { throw new TeacherAssignmentReviewOutboxError('teacher-review-outbox-command-unsupported', { blocked: true }); })();
    const completionNow = input.now ?? new Date();
    await assertOwnedClaim(input.db, input.claim, completionNow);
    const completed = await input.db.teacherAssignmentReviewOutbox.updateMany({
      where: { id: input.claim.id, state: 'PROCESSING', claimToken: input.claim.claimToken, leaseExpiresAt: { gt: completionNow } },
      data: { state: 'SUCCEEDED', resultJson: jsonValue(result), processedAt: completionNow, claimToken: null, claimedAt: null, leaseExpiresAt: null, lastErrorCode: null, limitationCode: null, updatedAt: completionNow },
    });
    if (completed?.count !== 1) throw claimLost();
    if (input.claim.command === 'RELEASE_STUDENT_FEEDBACK') {
      const snapshot = await input.db.teacherAssignmentApprovalSnapshot.findUnique({ where: { id: input.claim.snapshotId }, select: { submissionId: true } });
      if (snapshot) await reconcileSubmissionFeedbackState(input.db, snapshot.submissionId, completionNow);
    }
    return result;
  } catch (error) {
    if (isBlocked(error)) {
      await settleTeacherAssignmentReviewOutboxFailure({ db: input.db, claim: input.claim, error, now: input.now ?? new Date() });
      return { state: 'BLOCKED', limitationCode: errorCode(error) };
    }
    throw error;
  } finally {
    heartbeat.stop();
  }
}

export async function settleTeacherAssignmentReviewOutboxFailure(input: { db: any; claim: any; error: unknown; now?: Date; maxAttempts?: number }) {
  const now = input.now ?? new Date();
  const code = errorCode(input.error);
  const blocked = isBlocked(input.error);
  const retryable = isRetryable(input.error);
  const attempts = Number(input.claim.attemptCount ?? 1);
  const state = blocked ? 'BLOCKED' : retryable && attempts < (input.maxAttempts ?? DEFAULT_MAX_ATTEMPTS) ? 'RETRYABLE' : 'FAILED';
  return runTransaction(input.db, async (tx) => {
    const settled = await tx.teacherAssignmentReviewOutbox.updateMany({
      where: { id: input.claim.id, state: 'PROCESSING', claimToken: input.claim.claimToken, leaseExpiresAt: { gt: now } },
      data: {
        state,
        ...(state === 'RETRYABLE' ? { availableAt: new Date(now.getTime() + retryDelayMs(attempts)) } : {}),
        lastErrorCode: code,
        limitationCode: blocked ? code : null,
        resultJson: blocked ? { limitation: code } : null,
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        processedAt: blocked || state === 'FAILED' ? now : null,
        updatedAt: now,
      },
    });
    if (settled?.count !== 1) throw claimLost();
    if (input.claim.command === 'RELEASE_STUDENT_FEEDBACK' && (state === 'BLOCKED' || state === 'FAILED')) {
      const snapshot = await tx.teacherAssignmentApprovalSnapshot.findUnique({ where: { id: input.claim.snapshotId }, select: { submissionId: true } });
      if (snapshot) await reconcileSubmissionFeedbackState(tx, snapshot.submissionId, now);
    }
    return { state, code };
  });
}

export async function drainTeacherAssignmentReviewOutbox(input: { db: any; handlers: TeacherAssignmentReviewOutboxHandlers; limit?: number; now?: () => Date }) {
  const result = { claimed: 0, succeeded: 0, retryable: 0, blocked: 0, failed: 0 };
  for (let index = 0; index < (input.limit ?? 25); index += 1) {
    const now = input.now?.() ?? new Date();
    const claim = await claimTeacherAssignmentReviewOutbox({ db: input.db, now });
    if (!claim) break;
    result.claimed += 1;
    try {
      const outcome = await processClaimedTeacherAssignmentReviewOutbox({ db: input.db, claim, handlers: input.handlers, ...(input.now ? { now: input.now() } : {}) });
      if ((outcome as any)?.state === 'BLOCKED') result.blocked += 1;
      else result.succeeded += 1;
    } catch (error) {
      const settlement = await settleTeacherAssignmentReviewOutboxFailure({ db: input.db, claim, error, now: input.now?.() ?? new Date() });
      result[settlement.state.toLowerCase() as 'retryable' | 'blocked' | 'failed'] += 1;
    }
  }
  return result;
}

async function processDerivative(db: any, claim: any, handlers: TeacherAssignmentReviewOutboxHandlers) {
  if (!handlers.derivativeRenderer || !handlers.derivativeOptions) throw new TeacherAssignmentReviewOutboxError('reviewed-derivative-renderer-unavailable', { retryable: true });
  const snapshot = await loadSnapshot(db, claim.snapshotId);
  return generateReviewedDerivative({ db, snapshot, renderer: handlers.derivativeRenderer, options: handlers.derivativeOptions });
}

async function processRelease(db: any, claim: any, now: Date) {
  const snapshot = await loadSnapshot(db, claim.snapshotId);
  assertSnapshotSourceLineage(snapshot, 'reviewed-derivative-source-lineage-invalid');
  if (!['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED'].includes(snapshot.submission.reviewState)) {
    throw new TeacherAssignmentReviewOutboxError('teacher-review-submission-incomplete', { retryable: true });
  }
  const derivative = await db.teacherAssignmentReviewedDerivative.findFirst({ where: { snapshotId: snapshot.id, state: 'READY' }, orderBy: { readyAt: 'desc' } });
  const structuredOnly = readBoolean(claim.payload, 'structuredOnlyFallback');
  if (!derivative && !structuredOnly) throw new TeacherAssignmentReviewOutboxError('reviewed-derivative-not-ready', { retryable: true });
  const mode = derivative ? 'DERIVATIVE' : 'STRUCTURED_ONLY';
  return runTransaction(db, async (tx) => {
    const release = await tx.teacherAssignmentFeedbackRelease.upsert({
      where: { snapshotId: snapshot.id },
      create: {
        snapshotId: snapshot.id,
        derivativeId: derivative?.id ?? null,
        mode,
        ownerStudentId: snapshot.submission.frozenStudentId,
        idempotencyKey: `teacher-review-release:${snapshot.id}:${mode}:${derivative?.id ?? 'structured'}`,
        authorizationSnapshot: snapshot.authorizationSnapshot,
        releasedAt: now,
      },
      update: {},
    });
    return release;
  });
}

async function reconcileSubmissionFeedbackState(db: any, submissionId: string, now: Date) {
  const submission = await db.assignmentSubmission.findUnique({
    where: { id: submissionId },
    include: { answers: { include: { attempts: true } } },
  });
  if (!submission || !['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED'].includes(submission.reviewState)) return;
  const currentAttemptIds = submission.answers.flatMap((answer: any) => {
    const current = answer.attempts.find((attempt: any) => attempt.attemptNumber === answer.currentAttemptNumber);
    return current ? [current.id] : [];
  });
  if (currentAttemptIds.length === 0) return;
  const snapshots = await db.teacherAssignmentApprovalSnapshot.findMany({
    where: { submissionId, attemptId: { in: currentAttemptIds } },
    include: { feedbackRelease: true, outboxCommands: { where: { command: 'RELEASE_STUDENT_FEEDBACK' } } },
    orderBy: [{ approvedAt: 'desc' }, { id: 'desc' }],
  });
  const currentSnapshots = new Map<string, any>();
  for (const snapshot of snapshots) {
    if (!currentSnapshots.has(snapshot.attemptId)) currentSnapshots.set(snapshot.attemptId, snapshot);
  }
  if (currentSnapshots.size !== currentAttemptIds.length) return;
  const current = currentAttemptIds.map((attemptId: string) => currentSnapshots.get(attemptId));
  const hasTerminalFailure = current.some((snapshot: any) => snapshot.outboxCommands?.some((command: any) => ['BLOCKED', 'FAILED'].includes(command.state)));
  const allReleased = current.every((snapshot: any) => snapshot.feedbackRelease
    && snapshot.outboxCommands?.some((command: any) => command.state === 'SUCCEEDED'));
  const nextState = allReleased ? 'REVIEWED' : hasTerminalFailure ? 'RELEASE_BLOCKED' : 'APPROVED_PENDING_RELEASE';
  await db.assignmentSubmission.updateMany({
    where: { id: submissionId, reviewState: { in: ['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED'] } },
    data: { reviewState: nextState, reviewedAt: nextState === 'REVIEWED' ? now : null, updatedAt: now },
  });
}

function startOutboxLeaseHeartbeat(input: { db: any; claim: any }) {
  let stopped = false;
  let active = false;
  const timer = setInterval(() => {
    if (stopped || active) return;
    active = true;
    void renewTeacherAssignmentReviewOutboxLease({ db: input.db, claim: input.claim })
      .catch(() => false)
      .finally(() => { active = false; });
  }, Math.max(1_000, Math.floor(DEFAULT_LEASE_MS / 3)));
  timer.unref?.();
  return { stop() { stopped = true; clearInterval(timer); } };
}

async function processGovernedEvidence(db: any, claim: any, handlers: TeacherAssignmentReviewOutboxHandlers, now: Date) {
  const snapshot = await loadSnapshot(db, claim.snapshotId);
  const mapping = handlers.resolveEvidenceMapping
    ? await handlers.resolveEvidenceMapping(snapshot)
    : defaultEvidenceMapping(snapshot);
  if (!mapping || Object.keys(mapping).length === 0) {
    throw new TeacherAssignmentReviewOutboxError('governed-evidence-mapping-missing', { blocked: true });
  }
  if (!hasCompleteAnchorIntegrity(snapshot)) {
    throw new TeacherAssignmentReviewOutboxError('governed-evidence-anchor-integrity-incomplete', { blocked: true });
  }
  const sourceChecksum = assertSnapshotSourceLineage(snapshot, 'governed-evidence-source-lineage-invalid');
  const dedupeKey = `teacher-assignment-review:${snapshot.id}:${snapshot.reviewVersion}:${snapshot.rubricVersion}`;
  return db.evidenceOutbox.upsert({
    where: { dedupeKey },
    create: {
      eventType: 'teacher_assignment_review.approved',
      correlationId: `assignment-submission:${snapshot.submissionId}`,
      causationId: `teacher-review-snapshot:${snapshot.id}`,
      ownerUserId: snapshot.submission.frozenStudentId,
      dedupeKey,
      status: 'pending',
      availableAt: now,
      payload: {
        version: 'teacher-assignment-review-evidence.v1',
        snapshotId: snapshot.id,
        assignmentId: snapshot.assignmentId,
        submissionId: snapshot.submissionId,
        questionId: snapshot.questionId,
        attemptId: snapshot.attemptId,
        answerEvidenceId: snapshot.answerEvidenceId,
        sourceChecksum,
        reviewSnapshotChecksum: snapshot.machineSnapshotHash,
        reviewerId: snapshot.reviewerId,
        rubricVersion: snapshot.rubricVersion,
        evaluatorVersion: snapshot.evaluatorVersion,
        criterionSnapshot: snapshot.criterionSnapshot,
        annotationSnapshot: snapshot.annotationSnapshot,
        machineCriterionSnapshot: (snapshot.gradingRun.assessments ?? []).map((assessment: any) => ({
          criterionId: assessment.criterionId,
          levelId: assessment.levelId,
          score: assessment.score,
          rationale: assessment.rationale,
          confidence: assessment.confidence,
          limitationState: assessment.limitationState,
        })),
        mapping,
        authorizationSnapshot: snapshot.authorizationSnapshot,
        lifecyclePolicyVersion: snapshot.lifecyclePolicyVersion,
      },
    },
    update: {},
  });
}

function assertSnapshotSourceLineage(snapshot: any, invalidCode: string) {
  const sourceChecksum = String(snapshot.answerEvidence?.sourceHash ?? '');
  if (!/^sha256:[a-f0-9]{6,}$/i.test(sourceChecksum)) {
    throw new TeacherAssignmentReviewOutboxError(invalidCode, { blocked: true });
  }
  const assetChecksum = snapshot.answerEvidence?.sourceAsset?.checksum;
  if (assetChecksum != null && assetChecksum !== sourceChecksum) {
    throw new TeacherAssignmentReviewOutboxError('reviewed-derivative-source-checksum-mismatch', { blocked: true });
  }
  return sourceChecksum;
}

async function loadSnapshot(db: any, snapshotId: string) {
  const snapshot = await db.teacherAssignmentApprovalSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      submission: true,
      answerEvidence: { include: { sourceAsset: true, blocks: true } },
      gradingRun: { include: { question: true, assessments: true } },
    },
  });
  if (!snapshot) throw new TeacherAssignmentReviewOutboxError('teacher-review-approval-snapshot-missing', { blocked: true });
  return snapshot;
}

function defaultEvidenceMapping(snapshot: any): Record<string, unknown> | null {
  const mapping = snapshot?.gradingRun?.questionSnapshot?.evidenceMapping
    ?? snapshot?.gradingRun?.questionSnapshot?.competencyMapping
    ?? snapshot?.gradingRun?.question?.sourceLineage?.evidenceMapping;
  return mapping && typeof mapping === 'object' && !Array.isArray(mapping) ? mapping : null;
}

function hasCompleteAnchorIntegrity(snapshot: any) {
  const evidence = snapshot?.answerEvidence;
  const annotations = Array.isArray(snapshot?.annotationSnapshot)
    ? snapshot.annotationSnapshot.filter((row: any) => row?.status !== 'SUPPRESSED')
    : [];
  return annotations.every((row: any) => {
    const anchor = row?.anchor;
    const precision = String(anchor?.precision ?? '').toUpperCase();
    if (precision === 'SPAN') return Number.isInteger(anchor.spanStart) && Number.isInteger(anchor.spanEnd)
      && anchor.spanStart >= 0 && anchor.spanEnd >= anchor.spanStart && anchor.spanEnd <= String(evidence?.canonicalMarkdown ?? '').length;
    if (precision === 'BLOCK') return typeof anchor.blockId === 'string' && Array.isArray(evidence?.blocks)
      && evidence.blocks.some((block: any) => block.id === anchor.blockId);
    if (precision === 'PAGE') return Number.isInteger(anchor.pageNumber) && anchor.pageNumber > 0 && Array.isArray(evidence?.blocks)
      && evidence.blocks.some((block: any) => block.pageNumber === anchor.pageNumber);
    return false;
  });
}

async function assertOwnedClaim(db: any, claim: any, now: Date) {
  const current = await db.teacherAssignmentReviewOutbox.findUnique({ where: { id: claim.id } });
  if (!current || current.state !== 'PROCESSING' || current.claimToken !== claim.claimToken || !current.leaseExpiresAt || new Date(current.leaseExpiresAt) <= now) throw claimLost();
}

function claimLost() {
  return new TeacherAssignmentReviewOutboxError('teacher-review-outbox-claim-lost');
}

function isRetryable(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'retryable' in error && (error as { retryable?: unknown }).retryable === true);
}

function isBlocked(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'blocked' in error && (error as { blocked?: unknown }).blocked === true);
}

function errorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) return String((error as { code?: unknown }).code);
  return 'teacher-review-outbox-processing-failed';
}

function retryDelayMs(attempt: number) {
  return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1));
}

function readBoolean(value: unknown, key: string) {
  return Boolean(value && typeof value === 'object' && (value as Record<string, unknown>)[key] === true);
}

function jsonValue<T>(value: T): T {
  if (value === undefined) return null as T;
  return JSON.parse(JSON.stringify(value)) as T;
}

async function runTransaction<T>(db: any, callback: (tx: any) => Promise<T>): Promise<T> {
  return typeof db.$transaction === 'function' ? db.$transaction(callback) : callback(db);
}
