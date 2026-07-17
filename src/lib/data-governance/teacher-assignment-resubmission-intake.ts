import { randomUUID } from 'node:crypto';

import { enqueueDocumentConversion, enqueueGradingRun, materializeTextAnswerEvidence } from './math-document-grading-persistence';

const LEASE_MS = 60_000;

export async function drainTeacherAssignmentResubmissionIntakes(input: { db: any; limit?: number; now?: () => Date }) {
  const result = { claimed: 0, queued: 0, waiting: 0, retryable: 0, blocked: 0 };
  for (let index = 0; index < (input.limit ?? 20); index += 1) {
    const now = input.now?.() ?? new Date();
    const claim = await claimIntake(input.db, now);
    if (!claim) break;
    result.claimed += 1;
    try {
      const outcome = await processIntake(input.db, claim, now);
      result[outcome === 'QUEUED' ? 'queued' : 'waiting'] += 1;
    } catch (error) {
      const code = errorCode(error);
      const blocked = isBlocked(code);
      await input.db.teacherAssignmentResubmissionIntake.updateMany({
        where: { id: claim.id, state: 'PROCESSING', claimToken: claim.claimToken },
        data: {
          state: blocked ? 'BLOCKED' : 'RETRYABLE',
          availableAt: blocked ? claim.availableAt : new Date(now.getTime() + retryDelay(claim.attemptCount)),
          lastErrorCode: code,
          claimToken: null,
          claimedAt: null,
          leaseExpiresAt: null,
          updatedAt: now,
        },
      });
      result[blocked ? 'blocked' : 'retryable'] += 1;
    }
  }
  return result;
}

async function claimIntake(db: any, now: Date) {
  const row = await db.teacherAssignmentResubmissionIntake.findFirst({
    where: { OR: [
      { state: { in: ['PENDING', 'WAITING_EVIDENCE', 'RETRYABLE'] }, availableAt: { lte: now } },
      { state: 'PROCESSING', leaseExpiresAt: { lte: now } },
    ] },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  if (!row) return null;
  const claimToken = randomUUID();
  const claimed = await db.teacherAssignmentResubmissionIntake.updateMany({
    where: row.state === 'PROCESSING'
      ? { id: row.id, state: 'PROCESSING', claimToken: row.claimToken, leaseExpiresAt: { lte: now } }
      : { id: row.id, state: row.state, availableAt: { lte: now } },
    data: { state: 'PROCESSING', claimToken, claimedAt: now, leaseExpiresAt: new Date(now.getTime() + LEASE_MS), attemptCount: { increment: 1 }, lastErrorCode: null, updatedAt: now },
  });
  return claimed.count === 1 ? { ...row, state: 'PROCESSING', claimToken, attemptCount: row.attemptCount + 1 } : null;
}

async function processIntake(db: any, claim: any, now: Date): Promise<'WAITING_EVIDENCE' | 'QUEUED'> {
  const intake = await db.teacherAssignmentResubmissionIntake.findUnique({
    where: { id: claim.id },
    include: {
      attempt: { include: { answer: { include: { assets: { where: { attemptId: claim.attemptId, state: 'FINALIZED' }, orderBy: { version: 'desc' }, take: 1 } } } } },
      grant: true,
      sourceGradingRun: { include: { answerEvidence: { include: { conversion: true } } } },
    },
  });
  if (!intake || intake.claimToken !== claim.claimToken || intake.state !== 'PROCESSING') throw new Error('resubmission-intake-claim-lost');
  if (intake.grant.state !== 'CONSUMED' || intake.grant.consumedAttemptId !== intake.attemptId) throw new Error('resubmission-intake-lineage-invalid');
  const actor = { id: 'teacher-assignment-resubmission-intake', role: 'SERVICE' as const };
  let evidence = await db.answerEvidence.findFirst({ where: { attemptId: intake.attemptId }, orderBy: { version: 'desc' } });
  if (!evidence && intake.attempt.answer.responseType === 'SUBJECTIVE_TEXT') {
    evidence = (await materializeTextAnswerEvidence({ db, attemptId: intake.attemptId, actor, operation: 'resubmission-answer-evidence', idempotencyKey: `resubmission-evidence:${intake.attemptId}`, now })).evidence;
  }
  if (!evidence && intake.attempt.answer.responseType === 'SUBJECTIVE_FILE') {
    const asset = intake.attempt.answer.assets[0];
    if (!asset) throw new Error('resubmission-intake-source-asset-missing');
    const existing = await db.documentConversion.findFirst({ where: { attemptId: intake.attemptId }, orderBy: { version: 'desc' } });
    if (!existing) {
      const sourceConversion = intake.sourceGradingRun.answerEvidence?.conversion;
      await enqueueDocumentConversion({
        db,
        assetId: asset.id,
        attemptId: intake.attemptId,
        actor,
        adapterVersion: sourceConversion?.adapterVersion ?? 'router.v1',
        idempotencyKey: `resubmission-conversion:${intake.attemptId}`,
        reason: `teacher-return:${intake.grant.sourceReviewId}`,
        now,
      });
    } else if (['BLOCKED', 'FAILED', 'CONTENT_UNAVAILABLE', 'CANCELLED'].includes(existing.state)) {
      throw new Error(`resubmission-intake-conversion-${String(existing.state).toLowerCase()}`);
    }
    return settle(db, claim, 'WAITING_EVIDENCE', now);
  }
  if (!evidence || evidence.readiness !== 'READY') {
    if (evidence?.readiness === 'BLOCKED') throw new Error('resubmission-intake-evidence-blocked');
    return settle(db, claim, 'WAITING_EVIDENCE', now);
  }
  await enqueueGradingRun({
    db,
    attemptId: intake.attemptId,
    evidenceId: evidence.id,
    actor,
    idempotencyKey: `resubmission-grading:${intake.attemptId}`,
    policyId: intake.sourceGradingRun.policyId ?? null,
    policySnapshot: intake.sourceGradingRun.policySnapshot ?? null,
    policySnapshotHash: intake.sourceGradingRun.policySnapshotHash ?? null,
    rerunReason: `teacher-return:${intake.grant.sourceReviewId}`,
    now,
  });
  return settle(db, claim, 'QUEUED', now);
}

async function settle(db: any, claim: any, state: 'WAITING_EVIDENCE' | 'QUEUED', now: Date) {
  const settled = await db.teacherAssignmentResubmissionIntake.updateMany({
    where: { id: claim.id, state: 'PROCESSING', claimToken: claim.claimToken },
    data: { state, availableAt: state === 'WAITING_EVIDENCE' ? new Date(now.getTime() + 5_000) : claim.availableAt, completedAt: state === 'QUEUED' ? now : null, claimToken: null, claimedAt: null, leaseExpiresAt: null, updatedAt: now },
  });
  if (settled.count !== 1) throw new Error('resubmission-intake-claim-lost');
  return state;
}

function errorCode(error: unknown) { return error instanceof Error ? error.message.slice(0, 200) : 'resubmission-intake-failed'; }
function isBlocked(code: string) { return /lineage-invalid|policy-missing|adapter-missing|evidence-blocked|source-asset-missing|content-unavailable|cancelled|conversion-blocked|conversion-failed/.test(code); }
function retryDelay(attempt: number) { return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1)); }
