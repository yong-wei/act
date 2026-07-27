import { randomUUID } from 'node:crypto';

import {
  assembleAssignmentAnswerEvidence,
  assignmentAttachmentRoute,
  type AssignmentAttachmentUnderstanding,
} from './assignment-attachment-understanding';
import {
  enqueueDocumentConversion,
  enqueueGradingRun,
  materializeAssignmentAnswerEvidence,
  materializeTextAnswerEvidence,
} from './math-document-grading-persistence';

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
      attempt: { include: { answer: { include: { assets: { where: { attemptId: claim.attemptId, state: 'FINALIZED' }, orderBy: [{ orderIndex: 'asc' }, { version: 'asc' }] } } } } },
      grant: true,
      sourceGradingRun: { include: { answerEvidence: { include: { conversion: true } } } },
    },
  });
  if (!intake || intake.claimToken !== claim.claimToken || intake.state !== 'PROCESSING') throw new Error('resubmission-intake-claim-lost');
  if (intake.grant.state !== 'CONSUMED' || intake.grant.consumedAttemptId !== intake.attemptId) throw new Error('resubmission-intake-lineage-invalid');
  const actor = { id: 'teacher-assignment-resubmission-intake', role: 'SERVICE' as const };
  const assets = intake.attempt.answer.assets;
  let evidence = await db.answerEvidence.findFirst({
    where: {
      attemptId: intake.attemptId,
      ...(assets.length > 0
        ? { anchorVersion: 'assignment-answer-evidence.v2' }
        : {}),
    },
    orderBy: { version: 'desc' },
  });
  const hasText = Boolean(intake.attempt.textSnapshot?.trim());
  if (!evidence && hasText && assets.length === 0) {
    evidence = (await materializeTextAnswerEvidence({ db, attemptId: intake.attemptId, actor, operation: 'resubmission-answer-evidence', idempotencyKey: `resubmission-evidence:${intake.attemptId}`, now })).evidence;
  }
  if (!evidence && assets.length > 0) {
    const understood: AssignmentAttachmentUnderstanding[] = [];
    let waitingForConversion = false;
    for (const [assetIndex, asset] of assets.entries()) {
      const route = assignmentAttachmentRoute(
        asset.mimeType,
        asset.originalName ?? asset.displayName ?? '',
      );
      const existing = await db.documentConversion.findFirst({
        where: {
          attemptId: intake.attemptId,
          assetId: asset.id,
          adapterVersion: 'assignment-understanding.v1',
        },
        orderBy: { version: 'desc' },
      });
      if (!existing) {
        await enqueueDocumentConversion({
          db,
          assetId: asset.id,
          attemptId: intake.attemptId,
          actor,
          adapterVersion: 'assignment-understanding.v1',
          allowDefaultPolicyDiscovery: false,
          idempotencyKey: `resubmission-conversion:${intake.attemptId}:${asset.id}`,
          reason: `teacher-return:${intake.grant.sourceReviewId}`,
          now,
        });
        waitingForConversion = true;
        continue;
      }
      if (['QUEUED', 'RUNNING', 'RETRYABLE'].includes(existing.state)) {
        waitingForConversion = true;
        continue;
      }
      const legacyLocal = ['local-fallback', 'local-markitdown']
        .includes(existing.adapter);
      const ready = !legacyLocal && existing.state === 'SUCCEEDED'
        && Boolean(existing.canonicalMarkdown?.trim());
      const limitations = [
        ...(existing.warningCodes ?? []),
        ...(existing.failureCode ? [existing.failureCode] : []),
        ...(legacyLocal ? ['legacy-local-binary-ineligible'] : []),
      ];
      understood.push({
        assetId: asset.id,
        displayName: asset.originalName ?? asset.displayName ?? '未命名附件',
        mimeType: asset.mimeType,
        checksum: asset.checksum ?? '',
        role: asset.assetRole === 'EMBEDDED_IMAGE'
          ? 'EMBEDDED_IMAGE'
          : 'ATTACHMENT',
        orderIndex: asset.orderIndex ?? assetIndex,
        embeddedPosition: asset.embeddedPosition,
        route,
        state: ready
          ? 'READY'
          : limitations.includes('understanding-unavailable-policy')
            ? 'UNDERSTANDING_UNAVAILABLE_POLICY'
            : 'UNDERSTANDING_FAILED',
        canonicalMarkdown: existing.canonicalMarkdown,
        blocks: ready && Array.isArray(existing.normalizedBlocks)
          ? existing.normalizedBlocks.map((block: any) => ({
              id: block.id,
              blockIndex: block.blockIndex,
              pageNumber: block.pageNumber,
              text: block.text,
              markdown: block.markdown,
              spanStart: block.spanStart,
              spanEnd: block.spanEnd,
              bbox: block.bbox,
              coordinateProvenance: block.coordinateProvenance,
              precision: String(block.precision ?? 'BLOCK').toLowerCase() as 'span' | 'block' | 'page',
              confidence: block.confidence,
            }))
          : [],
        limitations,
      });
    }
    if (waitingForConversion) {
      return settle(db, claim, 'WAITING_EVIDENCE', now);
    }
    const assembled = assembleAssignmentAnswerEvidence({
      attemptId: intake.attemptId,
      answerVersion: intake.attempt.answerVersion,
      textSnapshot: intake.attempt.textSnapshot ?? '',
      attachments: understood,
    });
    evidence = (await materializeAssignmentAnswerEvidence({
      db,
      attemptId: intake.attemptId,
      answerVersion: intake.attempt.answerVersion,
      normalized: assembled.evidence,
      sourceManifest: assembled.manifest,
      actor,
      now,
    })).evidence;
  }
  if (!evidence && !hasText && assets.length === 0) throw new Error('resubmission-intake-answer-evidence-missing');
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
function isBlocked(code: string) { return /lineage-invalid|policy-missing|adapter-missing|evidence-blocked|answer-evidence-missing|content-unavailable|cancelled|conversion-blocked|conversion-failed/.test(code); }
function retryDelay(attempt: number) { return Math.min(15 * 60_000, 5_000 * 2 ** Math.max(0, attempt - 1)); }
