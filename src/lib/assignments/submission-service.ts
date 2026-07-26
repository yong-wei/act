import { Prisma, type PrismaClient } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

import { assertDeliveryWindow, deriveAggregate, mayReadSubmission, opaqueObjectKey, SubmissionError, submissionHash } from './submission-domain';
import type { SubmissionObjectStore } from './submission-object-store';
import { deriveStudentAssignmentPresentation, safePromptText, type StudentAssignmentDto } from './submission-dto';
import {
  buildSourceAssetLifecycleFields,
  blockLifecycleAssociationsForResource,
  freezeLifecyclePolicy,
  gradingTombstoneLookupKey,
  hasActiveGradingHold,
  pseudonymizeGradingLineage,
  requireConfiguredLifecyclePolicies,
  requireSourceAssetLifecyclePolicy,
  resolveGradingLineage,
  writeLifecycleAudit,
} from '@/lib/data-governance/math-document-grading-lifecycle';

const SUBMISSION_DELETE_LEASE_MS = 5 * 60_000;
const SUBMISSION_DELETE_HEARTBEAT_MS = 60_000;

async function readSubmissionDatabaseNow(db: any, fallback: Date): Promise<Date> {
  if (typeof db.$queryRaw !== 'function') return fallback;
  const rows = await db.$queryRaw(Prisma.sql`SELECT clock_timestamp() AS "now"`);
  const value = Array.isArray(rows) ? rows[0]?.now : null;
  const parsed = value instanceof Date ? value : new Date(value ?? fallback);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function submissionObjectTombstoneLookupKey(objectKey: string): string {
  return gradingTombstoneLookupKey(`submission-object:${objectKey}`);
}

function legacySubmissionObjectTombstoneLookupKey(objectKey: string): string {
  return `redacted:submission-lookup:${createHash('md5').update(objectKey).digest('hex')}`;
}

function legacyPhaseFourSubmissionObjectTombstoneLookupKey(objectKey: string): string {
  const phaseFourObjectKey = `redacted:submission-object:${createHash('md5').update(objectKey).digest('hex')}`;
  return `redacted:submission-lookup:${createHash('md5').update(phaseFourObjectKey).digest('hex')}`;
}

async function findSubmissionObjectTombstone(db: any, objectKey: string): Promise<any | null> {
  const model = db.submissionObjectTombstone;
  if (!model?.findUnique) return null;
  const raw = await model.findUnique({ where: { objectKey } });
  if (raw) return raw;
  try {
    const current = await model.findUnique({ where: { lookupKey: submissionObjectTombstoneLookupKey(objectKey) } });
    if (current) return current;
    const legacy = await model.findUnique({ where: { lookupKey: legacySubmissionObjectTombstoneLookupKey(objectKey) } });
    if (legacy) return legacy;
    return await model.findUnique({ where: { lookupKey: legacyPhaseFourSubmissionObjectTombstoneLookupKey(objectKey) } });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
    const message = error instanceof Error ? error.message : String(error);
    if (['P2021', 'P2022'].includes(code) || /(?:unknown argument|column|field|property).*lookupKey|lookupKey.*(?:does not exist|unknown)/i.test(message)) return null;
    throw error;
  }
}

export async function listStudentAssignments(prisma: PrismaClient, studentId: string, now = new Date()) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { classId: true } });
  const currentClassId = profile?.classId ?? null;
  const publishedRevisions = currentClassId ? await prisma.assignmentRevision.findMany({
    where: { state: 'PUBLISHED', audiences: { some: { classId: currentClassId, archivedAt: null, availableAt: { lte: now }, class: { isActive: true } } } },
    include: { audiences: { where: { classId: currentClassId, archivedAt: null }, take: 1 }, questions: { orderBy: { orderIndex: 'asc' } }, submissions: { where: { studentId }, include: { answers: true, resubmissionGrants: { orderBy: { grantedAt: 'desc' } } }, take: 1 } },
    orderBy: [{ publishedAt: 'desc' }, { revisionNumber: 'desc' }, { id: 'desc' }],
  }) : [];
  const revisions = selectCurrentPublishedRevisions(publishedRevisions);
  const historical = await prisma.assignmentSubmission.findMany({
    where: { studentId, revision: { id: { notIn: revisions.map((revision) => revision.id) }, historicalOwnerships: { some: { studentId, anonymizedAt: null } } } },
    include: { revision: { include: { questions: { orderBy: { orderIndex: 'asc' } } } }, audience: true, answers: true },
  });
  return [...revisions.map((revision) => presentRevision(revision, revision.audiences[0], revision.submissions[0], true, now)), ...historical.map((item) => presentRevision(item.revision, item.audience, item, false, now))];
}

export function selectCurrentPublishedRevisions<T extends { assignmentId: string }>(
  revisions: readonly T[],
): T[] {
  const current = new Map<string, T>();
  for (const revision of revisions) {
    if (!current.has(revision.assignmentId)) current.set(revision.assignmentId, revision);
  }
  return [...current.values()];
}

export async function getStudentAssignment(prisma: PrismaClient, studentId: string, assignmentId: string, now = new Date(), revisionId?: string) {
  const profile = await prisma.studentProfile.findUnique({ where: { userId: studentId }, select: { classId: true } });
  const revision = !revisionId && profile?.classId ? await prisma.assignmentRevision.findFirst({ where: { assignmentId, state: 'PUBLISHED', audiences: { some: { classId: profile.classId, archivedAt: null, class: { isActive: true } } } }, orderBy: { revisionNumber: 'desc' }, include: { audiences: true, questions: { orderBy: { orderIndex: 'asc' } }, submissions: { where: { studentId }, include: { answers: { include: { attempts: { orderBy: { attemptNumber: 'desc' }, include: { assets: true } }, assets: { orderBy: { version: 'desc' } } } }, approvalSnapshots: { include: { outboxCommands: true, feedbackRelease: { include: { derivative: true } } }, orderBy: { approvedAt: 'asc' } }, resubmissionGrants: { orderBy: { grantedAt: 'desc' } } }, take: 1 } } }) : null;
  if (!revision) {
    const historical = await prisma.assignmentSubmission.findFirst({
      where: {
        studentId,
        revision: {
          ...(revisionId ? { id: revisionId } : {}),
          assignmentId,
          historicalOwnerships: { some: { studentId, anonymizedAt: null } },
        },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        audience: true,
        revision: {
          include: {
            questions: { orderBy: { orderIndex: 'asc' } },
            historicalOwnerships: { where: { studentId }, take: 1 },
          },
        },
        answers: {
          include: {
            attempts: {
              orderBy: { attemptNumber: 'desc' },
              include: { assets: true },
            },
            assets: { orderBy: { version: 'desc' } },
          },
        },
        approvalSnapshots: {
          include: {
            outboxCommands: true,
            feedbackRelease: { include: { derivative: true } },
          },
          orderBy: { approvedAt: 'asc' },
        },
        resubmissionGrants: { orderBy: { grantedAt: 'desc' } },
      },
    });
    const ownership = historical?.revision.historicalOwnerships[0];
    if (!historical || !ownership || ownership.anonymizedAt || historical.frozenStudentId !== studentId || historical.frozenAudienceClassId !== historical.audience.classId || ownership.audienceClassId !== historical.frozenAudienceClassId) throw new SubmissionError('assignment-not-found', 404);
    return presentRevision({ ...historical.revision, submissions: [historical] }, historical.audience, historical, false, now);
  }
  const submission = revision.submissions[0];
  const audience = revision.audiences.find((candidate) => candidate.classId === profile?.classId) ?? revision.audiences.find((candidate) => candidate.id === submission?.audienceId);
  if (!audience || !mayReadSubmission({ currentClassId: profile?.classId, audienceClassId: audience.classId, studentId, ownerStudentId: submission?.studentId ?? studentId, hasSubmittedAttempt: submission?.answers.some((answer) => answer.attempts.length > 0) ?? false })) throw new SubmissionError('assignment-forbidden', 403);
  if (!submission) assertDeliveryWindow({ now, availableAt: audience.availableAt, dueAt: audience.dueAt, latePolicy: revision.latePolicy as never });
  return presentRevision(revision, audience, submission, audience.classId === profile?.classId && !audience.archivedAt, now);
}

export async function saveQuestionDraft(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; version: number; text: string; now?: Date }) {
  return prisma.$transaction(async (tx) => {
    const context = await requireMutableQuestion(tx as never, input, input.now ?? new Date());
    const answer = context.answer ?? await tx.submissionAnswer.create({ data: { submissionId: context.submission.id, assignmentQuestionId: context.question.id, responseType: context.question.responseType, textDraft: '', state: 'DRAFT' } });
    if (answer.state === 'SUBMITTED') throw new SubmissionError('answer-already-submitted', 409);
    if (answer.version !== input.version) throw new SubmissionError('answer-version-conflict', 409);
    return tx.submissionAnswer.update({ where: { id: answer.id }, data: { textDraft: input.text, state: input.text.trim() ? 'READY' : 'DRAFT', version: { increment: 1 } } });
  });
}

export async function signQuestionUpload(prisma: PrismaClient, store: SubmissionObjectStore, input: { studentId: string; assignmentId: string; questionId: string; fileName: string; mimeType: string; sizeBytes: number; checksum: string; now?: Date }) {
  const key = opaqueObjectKey();
  const now = input.now ?? new Date();
  const sourceAssetPolicy = await requireSourceAssetLifecyclePolicy(prisma as never);
  const sourceAssetLifecycle = buildSourceAssetLifecycleFields(sourceAssetPolicy, now);
  const { answer } = await withSerializableRetry(() => prisma.$transaction(async (tx) => {
    const context = await requireMutableQuestion(tx as never, input, now);
    if (context.question.responseType !== 'SUBJECTIVE_FILE') throw new SubmissionError('question-does-not-accept-file');
    const answer = await tx.submissionAnswer.upsert({ where: { submissionId_assignmentQuestionId: { submissionId: context.submission.id, assignmentQuestionId: context.question.id } }, create: { submissionId: context.submission.id, assignmentQuestionId: context.question.id, responseType: context.question.responseType, state: 'DRAFT' }, update: {} });
    const version = (await tx.submissionAsset.aggregate({ where: { answerId: answer.id }, _max: { version: true } }))._max.version ?? 0;
    await tx.submissionAsset.create({ data: { answerId: answer.id, version: version + 1, objectKey: key, originalName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes, checksum: input.checksum, state: 'QUARANTINED', scanState: 'PENDING', quarantineExpiresAt: new Date(now.getTime() + 600_000), ...sourceAssetLifecycle } });
    return { answer };
  }, { isolationLevel: 'Serializable' }));
  await store.healthCheck();
  const signed = await store.signUpload({ ownerId: input.studentId, answerId: answer.id, sizeBytes: input.sizeBytes, mimeType: input.mimeType, checksum: input.checksum }, 600, key);
  await prisma.submissionAsset.update({ where: { objectKey: key }, data: { quarantineExpiresAt: new Date(signed.expiresAt) } });
  return { intentId: (await prisma.submissionAsset.findUniqueOrThrow({ where: { objectKey: key }, select: { id: true } })).id, ...signed };
}

export async function finalizeQuestionAsset(prisma: PrismaClient, store: SubmissionObjectStore, input: { studentId: string; assignmentId: string; questionId: string; intentId: string; idempotencyKey: string; now?: Date }) {
  const context = await prisma.$transaction((tx) => requireMutableQuestion(tx as never, input, input.now ?? new Date()));
  if (!context.answer) throw new SubmissionError('answer-not-found', 404);
  const replay = await prisma.submissionAsset.findUnique({ where: { finalizationKey: `${input.studentId}:${input.idempotencyKey}` } });
  if (replay) { if (replay.id !== input.intentId || replay.answerId !== context.answer.id) throw new SubmissionError('idempotency-key-conflict', 409); return { status: 'READY' as const, asset: replay }; }
  const existing = await prisma.submissionAsset.findUnique({ where: { id: input.intentId } });
  if (!existing || existing.answerId !== context.answer.id) throw new SubmissionError('upload-intent-not-found', 404);
  if (existing.state === 'FINALIZED') throw new SubmissionError('asset-already-finalized-with-another-key', 409);
  if (existing.scanState === 'EXPIRED' || !existing.quarantineExpiresAt || existing.quarantineExpiresAt < (input.now ?? new Date())) return { status: 'EXPIRED' as const, intentId: existing.id };
  if (existing.scanState === 'FAILED' || existing.scanState === 'MISSING') return { status: 'FAILED' as const, intentId: existing.id };
  if (existing.state === 'REVOKED' || existing.scanState === 'UNSAFE') return { status: 'UNSAFE' as const, intentId: existing.id };
  if (existing.state !== 'QUARANTINED') throw new SubmissionError('asset-not-finalizable', 409);
  const metadata = await store.head(existing.objectKey);
  if (!metadata || metadata.scanState === 'PENDING') return { status: 'SCANNING' as const, intentId: existing.id };
  if (metadata.scanState === 'UNSAFE') { await prisma.submissionAsset.updateMany({ where: { id: existing.id, state: 'QUARANTINED' }, data: { state: 'REVOKED', scanState: 'UNSAFE' } }); return { status: 'UNSAFE' as const, intentId: existing.id }; }
  if (metadata.ownerId !== input.studentId || metadata.answerId !== context.answer.id || metadata.sizeBytes !== existing.sizeBytes || metadata.mimeType !== existing.mimeType || metadata.checksum !== existing.checksum) throw new SubmissionError('asset-finalization-verification-failed', 409);
  return withSerializableRetry(() => prisma.$transaction(async (tx) => {
    const locked = await tx.submissionAsset.findUniqueOrThrow({ where: { id: existing.id } });
    if (locked.state === 'FINALIZED' && locked.finalizationKey === `${input.studentId}:${input.idempotencyKey}`) return { status: 'READY' as const, asset: locked };
    if (locked.state !== 'QUARANTINED') throw new SubmissionError('asset-not-finalizable', 409);
    await tx.submissionAsset.updateMany({ where: { answerId: context.answer!.id, state: 'FINALIZED', attemptId: null }, data: { state: 'REVOKED' } });
    const finalized = await tx.submissionAsset.update({ where: { id: existing.id }, data: { scanState: metadata.scanState, state: 'FINALIZED', finalizationKey: `${input.studentId}:${input.idempotencyKey}`, finalizedAt: new Date() } });
    await tx.submissionAnswer.update({ where: { id: context.answer!.id }, data: { state: 'READY' } });
    return { status: 'READY' as const, asset: finalized };
  }, { isolationLevel: 'Serializable' }));
}

export async function getQuestionUploadStatus(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; intentId: string; now?: Date }) {
  const context = await requireMutableQuestion(prisma, input, input.now ?? new Date());
  const asset = await prisma.submissionAsset.findUnique({ where: { id: input.intentId } });
  if (!context.answer || !asset || asset.answerId !== context.answer.id) throw new SubmissionError('upload-intent-not-found', 404);
  if (asset.state === 'FINALIZED') return { status: 'READY' as const, intentId: asset.id, asset };
  if (asset.scanState === 'EXPIRED' || !asset.quarantineExpiresAt || asset.quarantineExpiresAt < (input.now ?? new Date())) return { status: 'EXPIRED' as const, intentId: asset.id };
  if (asset.scanState === 'FAILED' || asset.scanState === 'MISSING') return { status: 'FAILED' as const, intentId: asset.id };
  if (asset.state === 'REVOKED' || asset.scanState === 'UNSAFE') return { status: 'UNSAFE' as const, intentId: asset.id };
  if (asset.state === 'QUARANTINED' && asset.scanState === 'CLEAN') return { status: 'CLEAN' as const, intentId: asset.id };
  return { status: 'SCANNING' as const, intentId: asset.id };
}

const SUBMISSION_ASSET_REDACTION_COUNT = 5;

function redactedSubmissionAssetData(assetId: string, state: 'DELETED' | 'CONTENT_UNAVAILABLE' = 'DELETED') {
  const lineage = pseudonymizeGradingLineage(assetId, 'submission-asset');
  return {
    state,
    answerId: null,
    attemptId: null,
    objectKey: `redacted:submission-asset:${lineage}`,
    originalName: '[redacted-submission-asset]',
    checksum: null,
    finalizationKey: null,
    tombstonedAt: new Date(),
    deletionClaimToken: null,
    deletionClaimedAt: null,
    deletionLeaseExpiresAt: null,
    lastDeletionErrorCode: null,
    redactionCount: { increment: SUBMISSION_ASSET_REDACTION_COUNT },
  };
}

async function removeSubmissionAssetAccessTokens(tx: any, assetId: string): Promise<void> {
  await tx.submissionAssetAccessToken?.deleteMany?.({ where: { assetId } });
}

function isSubmissionObjectAlreadyGone(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown; name?: unknown; $metadata?: { httpStatusCode?: unknown } };
    const objectMissingCodes = new Set(['NoSuchKey', 'NoSuchObject', 'NotFound', 'ObjectNotFound', 'object-store-read-missing', 'object-store-delete-missing']);
    if ([candidate.code, candidate.name].some((value) => objectMissingCodes.has(String(value)))) return true;
    if (Number(candidate.status) === 404 || Number(candidate.statusCode) === 404 || Number(candidate.$metadata?.httpStatusCode) === 404) {
      return [candidate.code, candidate.name].some((value) => objectMissingCodes.has(String(value)));
    }
  }
  return false;
}

export function sourceAssetLifecycleDecision(asset: any): { eligible: boolean; strategy?: string; governed: boolean; reason?: string } {
  const missingFrozenFields = ['retentionPolicyId', 'retentionPolicyVersion', 'retentionDeleteStrategy'].filter((field) => !String(asset?.[field] ?? '').trim());
  if (missingFrozenFields.length > 0) return { eligible: false, governed: false, reason: `frozen-retention-field-missing:${missingFrozenFields.join(',')}` };
  const strategy = String(asset.retentionDeleteStrategy);
  if (!['delete-content', 'pseudonymize-lineage', 'retain-governed-record'].includes(strategy)) return { eligible: false, governed: false, reason: 'frozen-delete-strategy-invalid' };
  const hasFiniteExpiry = asset.retentionExpiresAt !== null && asset.retentionExpiresAt !== undefined;
  const finiteRetentionValid = strategy !== 'retain-governed-record'
    && hasFiniteExpiry
    && Number.isInteger(asset.retentionSeconds)
    && asset.retentionSeconds > 0
    && !String(asset.governedRecordRule ?? '').trim();
  const governed = strategy === 'retain-governed-record' && !hasFiniteExpiry && asset.retentionSeconds === null && Boolean(String(asset.governedRecordRule ?? '').trim());
  if (!finiteRetentionValid && !governed) return { eligible: false, governed: false, reason: 'frozen-retention-fields-incomplete' };
  return { eligible: true, strategy, governed };
}

function sameFrozenSourceAssetLifecycle(left: any, right: any): boolean {
  const leftExpiry = left?.retentionExpiresAt ? new Date(left.retentionExpiresAt).getTime() : null;
  const rightExpiry = right?.retentionExpiresAt ? new Date(right.retentionExpiresAt).getTime() : null;
  return left?.retentionPolicyId === right?.retentionPolicyId
    && left?.retentionPolicyVersion === right?.retentionPolicyVersion
    && left?.retentionDeleteStrategy === right?.retentionDeleteStrategy
    && (left?.retentionSeconds ?? null) === (right?.retentionSeconds ?? null)
    && leftExpiry === rightExpiry
    && (left?.governedRecordRule ?? null) === (right?.governedRecordRule ?? null);
}

function sourceAssetClaimDecision(scanned: any, current: any, now: Date): { eligible: boolean; reason?: string } {
  if (!sameFrozenSourceAssetLifecycle(scanned, current)) return { eligible: false, reason: 'frozen-retention-policy-changed-after-scan' };
  const lifecycle = sourceAssetLifecycleDecision(current);
  if (!lifecycle.eligible) return { eligible: false, reason: lifecycle.reason ?? 'frozen-retention-fields-incomplete' };
  const finiteExpiryReached = Boolean(current.retentionExpiresAt && new Date(current.retentionExpiresAt).getTime() <= now.getTime());
  if (!finiteExpiryReached && !lifecycle.governed) return { eligible: false, reason: 'retention-expiry-not-reached-at-claim' };
  return { eligible: true };
}

function sourceAssetClaimWhere(current: any, now: Date, state: string): Record<string, unknown> {
  const retentionEligibility = current.retentionExpiresAt
    ? { retentionExpiresAt: { lte: now } }
    : { retentionExpiresAt: null, retentionDeleteStrategy: 'retain-governed-record' };
  const claimFence = { OR: [{ deletionClaimToken: null }, { deletionLeaseExpiresAt: { lt: now } }] };
  return {
    id: current.id,
    state: { in: state === 'quarantine' ? ['QUARANTINED', 'REVOKED', 'DELETING'] : ['FINALIZED', 'DELETING'] },
    retentionPolicyId: current.retentionPolicyId ?? null,
    retentionPolicyVersion: current.retentionPolicyVersion ?? null,
    retentionDeleteStrategy: current.retentionDeleteStrategy ?? null,
    retentionSeconds: current.retentionSeconds ?? null,
    retentionExpiresAt: current.retentionExpiresAt ?? null,
    governedRecordRule: current.governedRecordRule ?? null,
    AND: [retentionEligibility, claimFence],
  };
}

function quarantineAssetClaimWhere(current: any, now: Date, olderThan: Date): Record<string, unknown> {
  return {
    id: current.id,
    state: { in: ['QUARANTINED', 'REVOKED', 'DELETING'] },
    OR: [
      { quarantineExpiresAt: { lte: now } },
      { createdAt: { lt: olderThan } },
    ],
    AND: [{ OR: [{ deletionClaimToken: null }, { deletionLeaseExpiresAt: { lt: now } }] }],
  };
}

async function markSourceAssetLifecycleBlocked(db: any, asset: any, reason: string, now: Date, restoreState?: string): Promise<void> {
  const execute = async (tx: any) => {
    await persistSourceAssetLifecycleBlocked(tx, asset, reason, now, restoreState);
    await blockLifecycleAssociationsForResource({ db: tx as never, resourceType: 'SubmissionAsset', resourceId: asset.id, reason, now });
    await writeLifecycleAudit(tx as never, { action: 'source-asset.lifecycle-metadata-blocked', resourceType: 'SubmissionAsset', resourceId: asset.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason } });
  };
  if (typeof db.$transaction === 'function') await db.$transaction(execute);
  else await execute(db);
}

async function persistSourceAssetLifecycleBlocked(db: any, asset: any, reason: string, now: Date, restoreState?: string): Promise<void> {
  if (db.submissionObjectTombstone?.upsert && asset.objectKey) {
    await db.submissionObjectTombstone.upsert({
      where: { objectKey: asset.objectKey },
      create: {
        objectKey: asset.objectKey,
        lookupKey: submissionObjectTombstoneLookupKey(asset.objectKey),
        reason: 'source-asset-lifecycle-metadata-missing',
        checksum: null,
        status: 'BLOCKED',
        deletionIntentAt: now,
        retryCount: 0,
        lastErrorCode: reason,
        lifecyclePolicyId: asset.retentionPolicyId ?? null,
        lifecyclePolicyVersion: asset.retentionPolicyVersion ?? null,
        lifecycleDeleteStrategy: asset.retentionDeleteStrategy ?? null,
        lifecycleRetentionSeconds: asset.retentionSeconds ?? null,
        lifecycleGovernedRecordRule: asset.governedRecordRule ?? null,
      },
      update: {
        status: 'BLOCKED',
        lastErrorCode: reason,
        lifecyclePolicyId: asset.retentionPolicyId ?? null,
        lifecyclePolicyVersion: asset.retentionPolicyVersion ?? null,
        lifecycleDeleteStrategy: asset.retentionDeleteStrategy ?? null,
        lifecycleRetentionSeconds: asset.retentionSeconds ?? null,
        lifecycleGovernedRecordRule: asset.governedRecordRule ?? null,
        deletionClaimToken: null,
        deletionClaimedAt: null,
        deletionLeaseExpiresAt: null,
        retryCount: { increment: 1 },
      },
    });
  }
  await db.submissionAsset?.updateMany?.({
    where: { id: asset.id, ...(asset.deletionClaimToken ? { deletionClaimToken: asset.deletionClaimToken } : {}) },
    data: { ...(restoreState ? { state: restoreState } : {}), lifecycleBlockedAt: now, lifecycleBlockReason: reason, lastDeletionErrorCode: reason, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null },
  });
}

function buildSubmissionObjectTombstoneCompletion(objectKey: string, strategy: string, now: Date, outcome: 'DELETED' | 'DELETED_WITH_HOLD' = 'DELETED'): Record<string, unknown> {
  return {
    status: outcome,
    physicalDeletedAt: now,
    deletedAt: now,
    pseudonymizedAt: strategy === 'pseudonymize-lineage' ? now : null,
    objectKey: `redacted:submission-object:${submissionObjectTombstoneLookupKey(objectKey)}`,
    checksum: null,
    lineageReference: pseudonymizeGradingLineage(objectKey, 'lineage'),
    deletionClaimToken: null,
    deletionClaimedAt: null,
    deletionLeaseExpiresAt: null,
    lastErrorCode: outcome === 'DELETED_WITH_HOLD' ? 'deleted-with-hold' : null,
    redactionCount: { increment: SUBMISSION_ASSET_REDACTION_COUNT },
  };
}

async function settleSubmissionDeletionWithHold(tx: any, claim: { objectKey: string; assetId: string; strategy: string; reason: string }, claimToken: string, now: Date, barrierReason = 'hold-or-owner-fence-after-delete', holdObserved = true): Promise<boolean> {
  const outcome = holdObserved ? 'DELETED_WITH_HOLD' : 'DELETED';
  const holdData = buildSubmissionObjectTombstoneCompletion(claim.objectKey, claim.strategy, now, outcome);
  const tombstone = tx.submissionObjectTombstone?.updateMany
    ? await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'RETAINED' }, deletionClaimToken: claimToken }, data: holdData })
    : null;
  if (tombstone?.count === 0) {
    // The physical delete is already true. A new owner may have replaced the
    // lease, so reconcile by the immutable object key instead of ignoring the
    // old owner's failed CAS. Never turn this fact back into RETRYABLE/DELETED.
    const reconciled = tx.submissionObjectTombstone?.updateMany
      ? await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'RETAINED' } }, data: holdData })
      : null;
    if (reconciled?.count === 0) {
      const current = await findSubmissionObjectTombstone(tx, claim.objectKey);
      if (!current || current.status === 'RETAINED') throw new SubmissionError('submission-delete-hold-reconciliation-failed', 409);
    }
  } else if (tombstone?.count === undefined && !tx.submissionObjectTombstone?.update) {
    throw new SubmissionError('submission-delete-hold-reconciliation-failed', 409);
  }
  await removeSubmissionAssetAccessTokens(tx, claim.assetId);
  const finalAssetState = holdObserved ? 'CONTENT_UNAVAILABLE' : 'DELETED';
  const completed = await tx.submissionAsset.updateMany?.({
    where: { id: claim.assetId, state: { not: finalAssetState } },
    data: { ...redactedSubmissionAssetData(claim.assetId, finalAssetState), tombstonedAt: now, lastDeletionErrorCode: holdObserved ? 'deleted-with-hold' : null },
  });
  if (completed?.count === 0) {
    const current = await tx.submissionAsset?.findUnique?.({ where: { id: claim.assetId } });
    if (!current || current.state !== finalAssetState) throw new SubmissionError('submission-delete-hold-reconciliation-failed', 409);
  }
  await writeLifecycleAudit(tx as never, { action: holdObserved ? 'submission-asset.deleted-with-hold' : 'submission-asset.deleted-after-claim-loss', resourceType: 'SubmissionAsset', resourceId: claim.assetId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: claim.reason, barrierReason, outcome, physicalDeletedAt: now.toISOString() } });
  return true;
}

export async function garbageCollectQuarantine(prisma: PrismaClient, store: SubmissionObjectStore, olderThan: Date) {
  const abandoned = await prisma.submissionAsset.findMany({ where: { state: { in: ['QUARANTINED', 'REVOKED', 'DELETING'] }, OR: [{ quarantineExpiresAt: { lte: new Date() } }, { createdAt: { lt: olderThan } }] } });
  let deleted = 0; let failed = 0;
  for (const asset of abandoned) {
    const now = new Date();
    const quarantineExpiryReached = Boolean(asset.quarantineExpiresAt && new Date(asset.quarantineExpiresAt).getTime() <= now.getTime());
    const quarantineAbandoned = Boolean(asset.createdAt && new Date(asset.createdAt).getTime() < olderThan.getTime());
    if (!quarantineExpiryReached && !quarantineAbandoned) continue;
    const claimToken = randomBytes(24).toString('hex');
    const leaseExpiresAt = new Date(now.getTime() + 5 * 60_000);
    const claim = await prisma.$transaction(async (tx) => {
      await lockSubmissionAsset(tx as any, asset.id);
      const current: any = tx.submissionAsset.findUnique ? await tx.submissionAsset.findUnique({ where: { id: asset.id } }) : asset;
      if (!current || current.state === 'DELETED') return { kind: 'skip' as const };
      if (current.state === 'DELETING' && current.deletionClaimToken && current.deletionLeaseExpiresAt && current.deletionLeaseExpiresAt > now) return { kind: 'skip' as const };
      const existing = await findSubmissionObjectTombstone(tx, current.objectKey);
      // A lifecycle-bound tombstone means source-asset retention GC owns this
      // DELETING state. Quarantine GC must not take over an expired/failed
      // source lease and replace its policy, tombstone, or audit semantics.
      if (current.state === 'DELETING' && existing?.lifecyclePolicyId) return { kind: 'skip' as const };
      if (existing?.status === 'DELETED' || existing?.status === 'DELETED_WITH_HOLD') {
        await removeSubmissionAssetAccessTokens(tx, current.id);
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: { in: ['QUARANTINED', 'REVOKED', 'DELETING', 'CONTENT_UNAVAILABLE'] } }, data: { ...redactedSubmissionAssetData(current.id, existing.status === 'DELETED_WITH_HOLD' ? 'CONTENT_UNAVAILABLE' : 'DELETED'), tombstonedAt: existing.physicalDeletedAt ?? now } });
        return { kind: 'already-deleted' as const };
      }
      const claimed = await tx.submissionAsset.updateMany({
        where: quarantineAssetClaimWhere(current, now, olderThan),
        data: { state: 'DELETING', deletionIntentAt: now, deletionAttemptCount: { increment: 1 }, deletionClaimToken: claimToken, deletionClaimedAt: now, deletionLeaseExpiresAt: leaseExpiresAt, lastDeletionErrorCode: null },
      });
      if (claimed.count !== 1) return { kind: 'skip' as const };
      const reason = current.state === 'REVOKED' ? 'draft-replaced' : 'quarantine-expired';
      const lineage = await resolveGradingLineage({ db: tx as never, resourceType: 'SubmissionAsset', resource: current });
      const holdScopes = lineage.scopes;
      if (await hasActiveGradingHold(tx as never, holdScopes, now)) {
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: 'DELETING', deletionClaimToken: claimToken }, data: { state: current.state, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
        return { kind: 'held' as const };
      }
      await tx.submissionObjectTombstone.upsert({
        where: { objectKey: current.objectKey },
        create: { objectKey: current.objectKey, lookupKey: submissionObjectTombstoneLookupKey(current.objectKey), reason, checksum: current.checksum, status: 'PENDING', deletionIntentAt: now, retryCount: 0, lastErrorCode: null, lifecyclePolicyId: null, lifecyclePolicyVersion: null, lifecycleDeleteStrategy: 'delete-content', lifecycleRetentionSeconds: null, lifecycleGovernedRecordRule: null, deletionClaimToken: claimToken, deletionClaimedAt: now, deletionLeaseExpiresAt: leaseExpiresAt },
        update: { reason, checksum: current.checksum, status: 'PENDING', lifecyclePolicyId: null, lifecyclePolicyVersion: null, lifecycleDeleteStrategy: 'delete-content', lifecycleRetentionSeconds: null, lifecycleGovernedRecordRule: null, deletionIntentAt: now, deletionClaimToken: claimToken, deletionClaimedAt: now, deletionLeaseExpiresAt: leaseExpiresAt, lastErrorCode: null },
      });
      await writeLifecycleAudit(tx as never, { action: 'quarantine-asset.delete-intent', resourceType: 'SubmissionAsset', resourceId: current.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason } });
      return { kind: 'claimed' as const, objectKey: current.objectKey, assetId: current.id, reason, strategy: 'delete-content', holdScopes, restoreState: current.state };
    });
    if (claim.kind === 'held') continue;
    if (claim.kind === 'skip') continue;
    if (claim.kind === 'already-deleted') { deleted += 1; continue; }
    const leaseHeartbeat = startSubmissionAssetDeletionLeaseHeartbeat(prisma, claim.assetId, claimToken, claim.holdScopes);
    let physicalDeleteConfirmed = false;
    const assertDeletionOwnership = async () => {
      if (await leaseHeartbeat.assertOwnership(claim.holdScopes)) return;
      throw new SubmissionError(leaseHeartbeat.lossReason() === 'hold' ? 'quarantine-gc-hold' : 'quarantine-gc-claim-lost', 409);
    };
    try {
      await assertDeletionOwnership();
      await store.delete(claim.objectKey, leaseHeartbeat.signal);
      physicalDeleteConfirmed = true;
      await assertDeletionOwnership();
      await prisma.$transaction(async (tx) => {
        const completionNow = await readSubmissionDatabaseNow(tx, now);
        if (await hasActiveGradingHold(tx as never, claim.holdScopes, completionNow)) throw new SubmissionError('quarantine-gc-hold', 409);
        await removeSubmissionAssetAccessTokens(tx, claim.assetId);
        const tombstone = await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'DELETED' }, deletionClaimToken: claimToken }, data: buildSubmissionObjectTombstoneCompletion(claim.objectKey, claim.strategy, completionNow) });
        if (tombstone.count !== 1) {
          throw new SubmissionError('gc-claim-lost', 409);
        }
        const completed = await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { ...redactedSubmissionAssetData(claim.assetId), tombstonedAt: completionNow } });
        if (completed.count !== 1) throw new SubmissionError('gc-claim-lost', 409);
        await writeLifecycleAudit(tx as never, { action: 'quarantine-asset.deleted', resourceType: 'SubmissionAsset', resourceId: claim.assetId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: claim.reason } });
      });
      deleted += 1;
    } catch (error) {
      let effectiveError: unknown = error;
      if (isSubmissionObjectAlreadyGone(error)) {
        physicalDeleteConfirmed = true;
        try {
          await assertDeletionOwnership();
          await prisma.$transaction(async (tx) => {
            const completionNow = await readSubmissionDatabaseNow(tx, now);
            if (await hasActiveGradingHold(tx as never, claim.holdScopes, completionNow)) throw new SubmissionError('quarantine-gc-hold', 409);
            await removeSubmissionAssetAccessTokens(tx, claim.assetId);
            const tombstone = await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'DELETED' }, deletionClaimToken: claimToken }, data: buildSubmissionObjectTombstoneCompletion(claim.objectKey, claim.strategy, completionNow) });
            if (tombstone.count !== 1) throw new SubmissionError('gc-claim-lost', 409);
            const completed = await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { ...redactedSubmissionAssetData(claim.assetId), tombstonedAt: completionNow } });
            if (completed.count !== 1) throw new SubmissionError('gc-claim-lost', 409);
          });
          deleted += 1;
          continue;
        } catch (completionError) {
          effectiveError = completionError;
          // Fall through to the fenced retry path.
        }
      }
      if (physicalDeleteConfirmed && (effectiveError instanceof SubmissionError && (effectiveError.code === 'quarantine-gc-hold' || effectiveError.code === 'quarantine-gc-claim-lost' || effectiveError.code === 'gc-claim-lost'))) {
        await prisma.$transaction(async (tx) => {
          const reconciliationNow = await readSubmissionDatabaseNow(tx, now);
          const holdObserved = await hasActiveGradingHold(tx as never, claim.holdScopes, reconciliationNow);
          await settleSubmissionDeletionWithHold(tx, claim, claimToken, reconciliationNow, effectiveError.code, holdObserved);
        });
        failed += 1;
        continue;
      }
      if (effectiveError instanceof SubmissionError && effectiveError.code === 'quarantine-gc-hold') {
        await prisma.$transaction(async (tx) => {
          await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, deletionClaimToken: claimToken, status: { not: 'DELETED' } }, data: { status: 'RETRYABLE', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastErrorCode: 'legal-hold-observed' } });
          await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { state: claim.restoreState, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastDeletionErrorCode: 'legal-hold-observed' } });
          await writeLifecycleAudit(tx as never, { action: 'quarantine-asset.hold-observed', resourceType: 'SubmissionAsset', resourceId: claim.assetId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: claim.reason, physicalDeleted: false } });
        });
        continue;
      }
      failed += 1;
      await prisma.$transaction(async (tx) => {
        const tombstone = await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'DELETED' }, deletionClaimToken: claimToken }, data: { status: 'RETRYABLE', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastErrorCode: 'object-store-delete-failed', retryCount: { increment: 1 } } });
        if (tombstone.count === 0) {
          const existing = await findSubmissionObjectTombstone(tx, claim.objectKey);
          if (existing?.status === 'DELETED') return;
          throw new SubmissionError('gc-claim-lost', 409);
        }
        await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { lastDeletionErrorCode: 'object-store-delete-failed', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
        await writeLifecycleAudit(tx as never, { action: 'quarantine-asset.delete-failed', resourceType: 'SubmissionAsset', resourceId: claim.assetId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: claim.reason, error: 'object-store-delete-failed' } });
      });
    } finally {
      leaseHeartbeat.stop();
    }
  }
  return { claimed: deleted + failed, deleted, failed };
}

export async function garbageCollectSourceAssets(prisma: PrismaClient, store: SubmissionObjectStore, now = new Date()) {
  const assets = await prisma.submissionAsset.findMany({
    where: {
      state: { in: ['FINALIZED', 'DELETING'] },
      OR: [
        { retentionExpiresAt: { lte: now } },
        { retentionExpiresAt: null },
      ],
    },
    include: {
      answer: { include: { submission: { include: { revision: { select: { id: true, assignmentId: true } }, audience: { select: { classId: true } } } } } },
      attempt: true,
      documentConversions: { select: { id: true, state: true } },
      answerEvidence: { select: { id: true, readiness: true, tombstonedAt: true } },
    },
  });
  let deleted = 0; let held = 0; let blocked = 0; let retained = 0;
  for (const asset of assets) {
    const lifecycle = sourceAssetLifecycleDecision(asset);
    const finiteExpiryReached = Boolean(asset.retentionExpiresAt && new Date(asset.retentionExpiresAt).getTime() <= now.getTime());
    if (!lifecycle.eligible || (!finiteExpiryReached && !lifecycle.governed)) {
      blocked += 1;
      await markSourceAssetLifecycleBlocked(prisma, asset, lifecycle.reason ?? 'finite-retention-or-governed-record-rule-required', now);
      continue;
    }
    const claimToken = randomBytes(24).toString('hex');
    const claimLeaseExpiresAt = new Date(now.getTime() + 5 * 60_000);
    const claim = await prisma.$transaction(async (tx) => {
      await lockSubmissionAsset(tx as any, asset.id);
      const current: any = tx.submissionAsset.findUnique
        ? await tx.submissionAsset.findUnique({ where: { id: asset.id }, include: { answer: { include: { submission: true } } } })
        : asset;
      if (!current || current.state === 'DELETED') return { kind: 'skip' as const };
      if (current.state === 'DELETING' && current.deletionClaimToken && current.deletionLeaseExpiresAt && current.deletionLeaseExpiresAt > now) return { kind: 'skip' as const };
      const currentLifecycle = sourceAssetClaimDecision(asset, current, now);
      if (!currentLifecycle.eligible) return { kind: 'skip' as const };
      const existing = await findSubmissionObjectTombstone(tx, current.objectKey);
      if (existing?.status === 'RETAINED') {
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: { in: ['FINALIZED', 'DELETING'] } }, data: { state: 'FINALIZED', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
        return { kind: 'retained-policy' as const };
      }
      if (existing?.status === 'DELETED') {
        await removeSubmissionAssetAccessTokens(tx, current.id);
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: { in: ['FINALIZED', 'DELETING'] } }, data: { ...redactedSubmissionAssetData(current.id), tombstonedAt: existing.physicalDeletedAt ?? now } });
        return { kind: 'already-deleted' as const };
      }
      const claimed = await tx.submissionAsset.updateMany({
        where: sourceAssetClaimWhere(current, now, 'source'),
        data: { state: 'DELETING', deletionIntentAt: now, deletionAttemptCount: { increment: 1 }, deletionClaimToken: claimToken, deletionClaimedAt: now, deletionLeaseExpiresAt: claimLeaseExpiresAt, lastDeletionErrorCode: null },
      });
      if (claimed.count !== 1) return { kind: 'skip' as const };
      const lineage = await resolveGradingLineage({ db: tx as never, resourceType: 'SubmissionAsset', resource: current });
      if (await hasActiveGradingHold(tx as never, lineage.scopes, now)) {
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: 'DELETING', deletionClaimToken: claimToken }, data: { state: 'FINALIZED', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
        return { kind: 'held' as const };
      }
      const conversions = tx.documentConversion?.findMany
        ? await tx.documentConversion.findMany({ where: { assetId: current.id }, select: { id: true, state: true } })
        : current.documentConversions ?? [];
      const evidence = tx.answerEvidence?.findMany
        ? await tx.answerEvidence.findMany({ where: { sourceAssetId: current.id }, select: { id: true, readiness: true, tombstonedAt: true } })
        : current.answerEvidence ?? [];
      const runs = tx.gradingRun?.findMany
        ? await tx.gradingRun.findMany({ where: { answerEvidence: { sourceAssetId: current.id } }, select: { id: true, tombstonedAt: true } })
        : [];
      const activeConversion = conversions.some((row: any) => row.state !== 'DELETED');
      const activeEvidence = evidence.some((row: any) => !row.tombstonedAt && row.readiness !== 'DELETED');
      const activeRun = runs.some((row: any) => !row.tombstonedAt);
      if (activeConversion || activeEvidence || activeRun) {
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: 'DELETING', deletionClaimToken: claimToken }, data: { state: 'FINALIZED', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
        return { kind: 'retained' as const };
      }
      const strategy = sourceAssetLifecycleDecision(current).strategy!;
      const existingObjectTombstone = await findSubmissionObjectTombstone(tx, current.objectKey);
      if (existingObjectTombstone?.status === 'DELETED' || existingObjectTombstone?.status === 'DELETED_WITH_HOLD') {
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: 'DELETING', deletionClaimToken: claimToken }, data: { ...redactedSubmissionAssetData(current.id, existingObjectTombstone.status === 'DELETED_WITH_HOLD' ? 'CONTENT_UNAVAILABLE' : 'DELETED'), tombstonedAt: existingObjectTombstone.physicalDeletedAt ?? now } });
        return { kind: 'already-deleted' as const };
      }
      const lifecycleTombstoneFields = {
        lifecyclePolicyId: current.retentionPolicyId ?? null,
        lifecyclePolicyVersion: current.retentionPolicyVersion ?? null,
        lifecycleDeleteStrategy: current.retentionDeleteStrategy,
        lifecycleRetentionSeconds: current.retentionSeconds ?? null,
        lifecycleGovernedRecordRule: current.governedRecordRule ?? null,
      };
      await tx.submissionObjectTombstone.upsert({
        where: { objectKey: current.objectKey },
        create: { objectKey: current.objectKey, lookupKey: submissionObjectTombstoneLookupKey(current.objectKey), reason: 'source-asset-retention-expired', checksum: current.checksum, status: 'PENDING', deletionIntentAt: now, retryCount: 0, lastErrorCode: null, ...lifecycleTombstoneFields, deletionClaimToken: claimToken, deletionClaimedAt: now, deletionLeaseExpiresAt: claimLeaseExpiresAt },
        update: { reason: 'source-asset-retention-expired', ...lifecycleTombstoneFields, status: 'PENDING', deletionIntentAt: now, deletionClaimToken: claimToken, deletionClaimedAt: now, deletionLeaseExpiresAt: claimLeaseExpiresAt, lastErrorCode: null },
      });
      if (strategy === 'retain-governed-record') {
        await tx.submissionObjectTombstone.update({ where: { objectKey: current.objectKey }, data: { status: 'RETAINED', physicalDeletedAt: null, deletedAt: null, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastErrorCode: null } });
        await tx.submissionAsset.updateMany({ where: { id: current.id, state: 'DELETING', deletionClaimToken: claimToken }, data: { state: 'FINALIZED', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null } });
        await writeLifecycleAudit(tx as never, { action: 'source-asset.retained', resourceType: 'SubmissionAsset', resourceId: current.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'source-asset-retention-expired', deleteStrategy: strategy, lifecyclePolicyVersion: current.retentionPolicyVersion } });
        return { kind: 'retained-policy' as const };
      }
      await writeLifecycleAudit(tx as never, { action: 'source-asset.delete-intent', resourceType: 'SubmissionAsset', resourceId: current.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'source-asset-retention-expired', deleteStrategy: strategy } });
      return { kind: 'claimed' as const, objectKey: current.objectKey, assetId: current.id, strategy, reason: 'source-asset-retention-expired', holdScopes: lineage.scopes };
    });
    if (claim.kind === 'held') { held += 1; continue; }
    if (claim.kind === 'retained' || claim.kind === 'retained-policy') { retained += 1; continue; }
    if (claim.kind === 'already-deleted') { deleted += 1; continue; }
    if (claim.kind !== 'claimed') continue;
    const leaseHeartbeat = startSubmissionAssetDeletionLeaseHeartbeat(prisma, claim.assetId, claimToken, claim.holdScopes);
    let physicalDeleteConfirmed = false;
    const assertDeletionOwnership = async () => {
      if (await leaseHeartbeat.assertOwnership(claim.holdScopes)) return;
      throw new SubmissionError(leaseHeartbeat.lossReason() === 'hold' ? 'source-asset-gc-hold' : 'source-asset-gc-claim-lost', 409);
    };
    try {
      await assertDeletionOwnership();
      await store.delete(claim.objectKey, leaseHeartbeat.signal);
      physicalDeleteConfirmed = true;
      await assertDeletionOwnership();
      await prisma.$transaction(async (tx) => {
        const completionNow = await readSubmissionDatabaseNow(tx, now);
        if (await hasActiveGradingHold(tx as never, claim.holdScopes, completionNow)) throw new SubmissionError('source-asset-gc-hold', 409);
        await removeSubmissionAssetAccessTokens(tx, claim.assetId);
        const tombstoneData = buildSubmissionObjectTombstoneCompletion(claim.objectKey, claim.strategy, completionNow);
        if (tx.submissionObjectTombstone.updateMany) {
          const tombstone = await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'DELETED' }, deletionClaimToken: claimToken }, data: tombstoneData });
          if (tombstone.count !== undefined && tombstone.count !== 1) throw new SubmissionError('source-asset-gc-claim-lost', 409);
        } else {
          await tx.submissionObjectTombstone.update({ where: { objectKey: claim.objectKey }, data: tombstoneData });
        }
        const completed = await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { ...redactedSubmissionAssetData(claim.assetId), tombstonedAt: completionNow } });
        if (completed.count !== 1) throw new SubmissionError('source-asset-gc-claim-lost', 409);
        await writeLifecycleAudit(tx as never, { action: 'source-asset.deleted', resourceType: 'SubmissionAsset', resourceId: claim.assetId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'source-asset-retention-expired' } });
      });
      deleted += 1;
    } catch (error) {
      let effectiveError: unknown = error;
      if (isSubmissionObjectAlreadyGone(error)) {
        physicalDeleteConfirmed = true;
        try {
          await assertDeletionOwnership();
          await prisma.$transaction(async (tx) => {
            const completionNow = await readSubmissionDatabaseNow(tx, now);
            if (await hasActiveGradingHold(tx as never, claim.holdScopes, completionNow)) throw new SubmissionError('source-asset-gc-hold', 409);
            await removeSubmissionAssetAccessTokens(tx, claim.assetId);
            const tombstone = await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'DELETED' }, deletionClaimToken: claimToken }, data: buildSubmissionObjectTombstoneCompletion(claim.objectKey, claim.strategy, completionNow) });
            if (tombstone.count !== 1) throw new SubmissionError('source-asset-gc-claim-lost', 409);
            const completed = await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { ...redactedSubmissionAssetData(claim.assetId), tombstonedAt: completionNow } });
            if (completed.count !== 1) throw new SubmissionError('source-asset-gc-claim-lost', 409);
          });
          deleted += 1;
          continue;
        } catch (completionError) {
          effectiveError = completionError;
          // Fall through to the fenced retry path.
        }
      }
      if (physicalDeleteConfirmed && (effectiveError instanceof SubmissionError && (effectiveError.code === 'source-asset-gc-hold' || effectiveError.code === 'source-asset-gc-claim-lost'))) {
        await prisma.$transaction(async (tx) => {
          const reconciliationNow = await readSubmissionDatabaseNow(tx, now);
          const holdObserved = await hasActiveGradingHold(tx as never, claim.holdScopes, reconciliationNow);
          await settleSubmissionDeletionWithHold(tx, claim, claimToken, reconciliationNow, effectiveError.code, holdObserved);
        });
        blocked += 1;
        continue;
      }
      if (effectiveError instanceof SubmissionError && effectiveError.code === 'source-asset-gc-hold') {
        await prisma.$transaction(async (tx) => {
          await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, deletionClaimToken: claimToken, status: { not: 'DELETED' } }, data: { status: 'RETRYABLE', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastErrorCode: 'legal-hold-observed' } });
          await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { state: 'FINALIZED', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastDeletionErrorCode: 'legal-hold-observed' } });
          await writeLifecycleAudit(tx as never, { action: 'source-asset.hold-observed', resourceType: 'SubmissionAsset', resourceId: claim.assetId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'source-asset-retention-expired', physicalDeleted: false } });
        });
        held += 1;
        continue;
      }
      blocked += 1;
      await prisma.$transaction(async (tx) => {
        if (tx.submissionObjectTombstone.updateMany) {
          const result = await tx.submissionObjectTombstone.updateMany({ where: { objectKey: claim.objectKey, status: { not: 'DELETED' }, deletionClaimToken: claimToken }, data: { status: 'RETRYABLE', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastErrorCode: 'object-store-delete-failed', retryCount: { increment: 1 } } });
          if (result?.count === 0) {
            const existing = await findSubmissionObjectTombstone(tx, claim.objectKey);
            if (existing?.status !== 'DELETED') throw new SubmissionError('source-asset-gc-claim-lost', 409);
            return;
          }
        } else {
          await tx.submissionObjectTombstone.update?.({ where: { objectKey: claim.objectKey }, data: { status: 'RETRYABLE', deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastErrorCode: 'object-store-delete-failed', retryCount: { increment: 1 } } });
        }
        await tx.submissionAsset.updateMany({ where: { id: claim.assetId, state: 'DELETING', deletionClaimToken: claimToken }, data: { deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null, lastDeletionErrorCode: 'object-store-delete-failed' } });
        await writeLifecycleAudit(tx as never, { action: 'source-asset.delete-failed', resourceType: 'SubmissionAsset', resourceId: claim.assetId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'source-asset-retention-expired', error: 'object-store-delete-failed' } });
      });
    } finally {
      leaseHeartbeat.stop();
    }
  }
  return { scanned: assets.length, deleted, held, blocked, retained };
}

async function lockSubmissionAsset(tx: any, assetId: string): Promise<void> {
  if (typeof tx.$queryRawUnsafe === 'function') {
    await tx.$queryRawUnsafe('SELECT "id" FROM "SubmissionAsset" WHERE "id" = $1 FOR UPDATE', assetId);
  }
}

export async function renewSubmissionAssetDeletionLease(input: { db: any; assetId: string; claimToken: string; now?: Date; holdScopes?: Array<[string, string]> }): Promise<boolean> {
  const model = input.db.submissionAsset;
  if (!model?.updateMany) return false;
  const requestedNow = input.now ?? await readSubmissionDatabaseNow(input.db, new Date());
  if (input.holdScopes && await hasActiveGradingHold(input.db as never, input.holdScopes, requestedNow)) return false;
  let current: any = null;
  try {
    current = model.findUnique ? await model.findUnique({ where: { id: input.assetId } }) : null;
  } catch {
    return false;
  }
  if (current && (current.state !== 'DELETING' || current.deletionClaimToken !== input.claimToken)) return false;
  const currentExpiry = current?.deletionLeaseExpiresAt ? new Date(current.deletionLeaseExpiresAt) : null;
  if (currentExpiry && currentExpiry <= requestedNow) return false;
  const currentClaimedAt = current?.deletionClaimedAt ? new Date(current.deletionClaimedAt) : null;
  const proposedClaimedAt = currentClaimedAt && currentClaimedAt > requestedNow ? currentClaimedAt : requestedNow;
  const proposedExpiry = new Date(Math.max(currentExpiry?.getTime() ?? 0, proposedClaimedAt.getTime() + SUBMISSION_DELETE_LEASE_MS));
  const result = await model.updateMany({
    where: {
      id: input.assetId,
      state: 'DELETING',
      deletionClaimToken: input.claimToken,
      OR: [{ deletionLeaseExpiresAt: null }, { deletionLeaseExpiresAt: { gt: requestedNow } }],
      AND: [
        { OR: [{ deletionLeaseExpiresAt: null }, { deletionLeaseExpiresAt: { lt: proposedExpiry } }] },
        { OR: [{ deletionClaimedAt: null }, { deletionClaimedAt: { lt: proposedClaimedAt } }] },
      ],
    },
    data: { deletionClaimedAt: proposedClaimedAt, deletionLeaseExpiresAt: proposedExpiry },
  });
  const renewed = result?.count === undefined ? Boolean(result) : result.count === 1;
  if (!renewed) {
    try {
      const latest = model.findUnique ? await model.findUnique({ where: { id: input.assetId } }) : null;
      if (!latest || latest.state !== 'DELETING' || latest.deletionClaimToken !== input.claimToken || !latest.deletionLeaseExpiresAt || new Date(latest.deletionLeaseExpiresAt) < proposedExpiry || (latest.deletionClaimedAt && new Date(latest.deletionClaimedAt) < proposedClaimedAt)) return false;
    } catch {
      return false;
    }
  }
  const postRenewNow = input.now ?? await readSubmissionDatabaseNow(input.db, requestedNow);
  return !(input.holdScopes && await hasActiveGradingHold(input.db as never, input.holdScopes, postRenewNow));
}

function startSubmissionAssetDeletionLeaseHeartbeat(prisma: PrismaClient, assetId: string, claimToken: string, defaultHoldScopes: Array<[string, string]> = [['asset', assetId]]) {
  let lost = false;
  let lossReason: 'hold' | 'claim' | 'unknown' = 'unknown';
  const abortController = new AbortController();
  const renew = async (holdScopes: Array<[string, string]>): Promise<boolean> => {
    if (lost) return false;
    const renewed = await renewSubmissionAssetDeletionLease({ db: prisma, assetId, claimToken, holdScopes });
    if (!renewed) {
      const lossNow = await readSubmissionDatabaseNow(prisma, new Date());
      lossReason = await hasActiveGradingHold(prisma as never, holdScopes, lossNow) ? 'hold' : 'claim';
      lost = true;
      abortController.abort();
    }
    return renewed;
  };
  const assertOwnership = async (holdScopes: Array<[string, string]> = defaultHoldScopes): Promise<boolean> => renew(holdScopes);
  const timer = setInterval(() => {
    void renew(defaultHoldScopes).catch(() => { lossReason = 'unknown'; lost = true; abortController.abort(); });
  }, SUBMISSION_DELETE_HEARTBEAT_MS);
  return { stop: () => clearInterval(timer), isLost: () => lost, lossReason: () => lossReason, signal: abortController.signal, assertOwnership };
}

export async function signSubmissionAssetRead(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; assetId: string }) {
  const asset = await prisma.submissionAsset.findUnique({ where: { id: input.assetId }, include: { answer: { include: { attempts: true, submission: { include: { student: { include: { profile: true } } } }, question: { include: { revision: { select: { assignmentId: true } } } } } } } });
  const answer = asset?.answer;
  if (!asset || !answer || asset.state !== 'FINALIZED' || answer.assignmentQuestionId !== input.questionId || answer.question.assignmentRevisionId !== answer.submission.assignmentRevisionId || answer.question.revision?.assignmentId !== input.assignmentId || answer.submission.studentId !== input.studentId || !mayReadSubmission({ currentClassId: answer.submission.student.profile?.classId, audienceClassId: answer.submission.frozenAudienceClassId, studentId: input.studentId, ownerStudentId: answer.submission.frozenStudentId, hasSubmittedAttempt: answer.attempts.length > 0 })) throw new SubmissionError('asset-read-forbidden', 403);
  const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 5 * 60_000);
  await prisma.submissionAssetAccessToken.create({ data: { tokenHash: createHash('sha256').update(token).digest('hex'), assetId: asset.id, studentId: input.studentId, purpose: 'submission-source-download', expiresAt } });
  const origin = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  return { url: `${origin}/api/student/assignments/${encodeURIComponent(input.assignmentId)}/answers/${encodeURIComponent(input.questionId)}/assets/${encodeURIComponent(input.assetId)}/read?token=${encodeURIComponent(token)}`, expiresAt: expiresAt.toISOString() };
}

export async function consumeSubmissionAssetRead(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; assetId: string; token: string }) {
  const tokenHash = createHash('sha256').update(input.token).digest('hex'); const now = new Date();
  const claimed = await prisma.submissionAssetAccessToken.updateMany({ where: { tokenHash, assetId: input.assetId, studentId: input.studentId, purpose: 'submission-source-download', expiresAt: { gt: now }, usedAt: null }, data: { usedAt: now } });
  if (claimed.count !== 1) throw new SubmissionError('asset-access-token-invalid', 403);
  const asset = await prisma.submissionAsset.findUnique({ where: { id: input.assetId }, include: { answer: { include: { attempts: true, submission: { include: { student: { include: { profile: true } } } }, question: { include: { revision: { select: { assignmentId: true } } } } } } } });
  const answer = asset?.answer;
  if (!asset || !answer || asset.state !== 'FINALIZED' || answer.assignmentQuestionId !== input.questionId || answer.question.revision.assignmentId !== input.assignmentId || answer.submission.studentId !== input.studentId || !mayReadSubmission({ currentClassId: answer.submission.student.profile?.classId, audienceClassId: answer.submission.frozenAudienceClassId, studentId: input.studentId, ownerStudentId: answer.submission.frozenStudentId, hasSubmittedAttempt: answer.attempts.length > 0 })) throw new SubmissionError('asset-read-forbidden', 403);
  return { objectKey: asset.objectKey, displayName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, checksum: asset.checksum };
}

export async function submitQuestionAnswer(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string; answerVersion: number; idempotencyKey: string; now?: Date }) {
  return withSerializableRetry(() => prisma.$transaction(async (tx) => {
    const now = input.now ?? new Date();
    const requestHash = submissionHash({ answerVersion: input.answerVersion });
    const replayCandidates = await tx.submissionIdempotency.findMany({
      where: { studentId: input.studentId, idempotencyKey: input.idempotencyKey, scope: { startsWith: 'submit:' } },
      include: { attempt: { include: { answer: { include: { submission: { include: { revision: { select: { assignmentId: true } } } } } } } } },
    });
    const preflightReplay = replayCandidates.find((row) => row.attempt
      && row.scope === `submit:${row.attempt.answer.id}`
      && row.attempt.answer.assignmentQuestionId === input.questionId
      && row.attempt.answer.submission.revision.assignmentId === input.assignmentId);
    if (preflightReplay?.attempt) {
      if (preflightReplay.requestHash !== requestHash) throw new SubmissionError('idempotency-key-conflict', 409);
      const { answer, ...attempt } = preflightReplay.attempt;
      return { attempt, aggregate: await aggregateAndUpdate(tx as never, answer.submissionId) };
    }
    const context = await requireMutableQuestion(tx as never, input, now);
    if (!context.answer) throw new SubmissionError('answer-not-ready', 409);
    const scope = `submit:${context.answer.id}`;
    const replay = await tx.submissionIdempotency.findUnique({ where: { studentId_scope_idempotencyKey: { studentId: input.studentId, scope, idempotencyKey: input.idempotencyKey } }, include: { attempt: true } });
    if (replay) { if (replay.requestHash !== requestHash) throw new SubmissionError('idempotency-key-conflict', 409); return { attempt: replay.attempt, aggregate: await aggregateAndUpdate(tx as never, context.submission.id) }; }
    if (context.answer.state === 'SUBMITTED' || context.answer.version !== input.answerVersion) throw new SubmissionError('answer-version-conflict', 409);
    if (context.question.responseType === 'SUBJECTIVE_TEXT' && !context.answer.textDraft?.trim()) throw new SubmissionError('text-answer-required', 409);
    const textSnapshotLifecycle = context.question.responseType === 'SUBJECTIVE_TEXT'
      ? freezeLifecyclePolicy((await requireConfiguredLifecyclePolicies(tx as never, ['answer-evidence']))[0], now)
      : null;
    const assets = await tx.submissionAsset.findMany({ where: { answerId: context.answer.id, state: 'FINALIZED', attemptId: null }, orderBy: { version: 'desc' }, take: 1 });
    if (context.question.responseType === 'SUBJECTIVE_FILE' && assets.length === 0) throw new SubmissionError('finalized-asset-required', 409);
    const attemptNumber = context.answer.currentAttemptNumber + 1;
    const attempt = await tx.submissionAttempt.create({ data: {
      answerId: context.answer.id,
      attemptNumber,
      answerVersion: context.answer.version,
      textSnapshot: context.question.responseType === 'SUBJECTIVE_TEXT' ? context.answer.textDraft : null,
      ...(textSnapshotLifecycle ? {
        textSnapshotPolicyId: textSnapshotLifecycle.lifecyclePolicyId,
        textSnapshotPolicyVersion: textSnapshotLifecycle.lifecyclePolicyVersion,
        textSnapshotDeleteStrategy: textSnapshotLifecycle.lifecycleDeleteStrategy,
        textSnapshotRetentionSeconds: textSnapshotLifecycle.lifecycleRetentionSeconds,
        textSnapshotGovernedRecordRule: textSnapshotLifecycle.lifecycleGovernedRecordRule,
        textSnapshotProviderRetentionSeconds: textSnapshotLifecycle.lifecycleProviderRetentionSeconds,
        textSnapshotExpiresAt: textSnapshotLifecycle.retentionExpiresAt,
      } : {}),
    } });
    await tx.submissionAsset.updateMany({ where: { id: { in: assets.map((asset) => asset.id) } }, data: { attemptId: attempt.id } });
    await tx.submissionAnswer.update({ where: { id: context.answer.id }, data: { state: 'SUBMITTED', currentAttemptNumber: attemptNumber } });
    if (context.resubmissionGrant) {
      const consumed = await tx.teacherAssignmentResubmissionGrant.updateMany({
        where: { id: context.resubmissionGrant.id, state: 'ACTIVE', expiresAt: { gt: now } },
        data: { state: 'CONSUMED', consumedAt: now, consumedAttemptId: attempt.id, updatedAt: now },
      });
      if (consumed.count !== 1) throw new SubmissionError('resubmission-grant-conflict', 409);
      await tx.teacherAssignmentResubmissionIntake.create({
        data: {
          grantId: context.resubmissionGrant.id,
          attemptId: attempt.id,
          sourceGradingRunId: context.resubmissionGrant.sourceGradingRunId,
          state: 'PENDING',
          availableAt: now,
        },
      });
      await tx.assignmentSubmission.update({ where: { id: context.submission.id }, data: { reviewState: 'REVIEWING', approvedTotal: null, reviewedAt: null } });
    }
    await tx.submissionIdempotency.create({ data: { studentId: input.studentId, scope, idempotencyKey: input.idempotencyKey, requestHash, attemptId: attempt.id } });
    return { attempt, aggregate: await aggregateAndUpdate(tx as never, context.submission.id) };
  }, { isolationLevel: 'Serializable' }));
}

async function requireMutableQuestion(prisma: PrismaClient, input: { studentId: string; assignmentId: string; questionId: string }, now: Date) {
  const revision = await prisma.assignmentRevision.findFirst({ where: { assignmentId: input.assignmentId, state: 'PUBLISHED', questions: { some: { id: input.questionId } } }, include: { audiences: { include: { class: { select: { isActive: true } } } }, questions: { where: { id: input.questionId } } } });
  const profile = await prisma.studentProfile.findUnique({ where: { userId: input.studentId }, select: { classId: true } });
  const audience = revision?.audiences.find((candidate) => candidate.classId === profile?.classId && candidate.class.isActive && !candidate.archivedAt);
  if (!revision || !audience) throw new SubmissionError('assignment-forbidden', 403);
  const existingSubmission = await prisma.assignmentSubmission.findUnique({
    where: { assignmentRevisionId_studentId: { assignmentRevisionId: revision.id, studentId: input.studentId } },
  });
  const resubmissionGrant = existingSubmission ? await prisma.teacherAssignmentResubmissionGrant.findFirst({
    where: { submissionId: existingSubmission.id, questionId: input.questionId, state: 'ACTIVE', expiresAt: { gt: now } },
    orderBy: { grantedAt: 'desc' },
  }) : null;
  if (!resubmissionGrant) assertDeliveryWindow({ now, availableAt: audience.availableAt, dueAt: audience.dueAt, latePolicy: revision.latePolicy as never });
  const submission = await prisma.assignmentSubmission.upsert({ where: { assignmentRevisionId_studentId: { assignmentRevisionId: revision.id, studentId: input.studentId } }, create: { assignmentRevisionId: revision.id, audienceId: audience.id, studentId: input.studentId, frozenStudentId: input.studentId, frozenAudienceClassId: audience.classId, requiredQuestionCount: await prisma.assignmentQuestion.count({ where: { assignmentRevisionId: revision.id } }) }, update: {} });
  await prisma.assignmentHistoricalOwnership.upsert({ where: { assignmentRevisionId_studentId: { assignmentRevisionId: revision.id, studentId: input.studentId } }, create: { assignmentRevisionId: revision.id, studentId: input.studentId, audienceClassId: audience.classId, assignedAt: now }, update: {} });
  const answer = await prisma.submissionAnswer.findUnique({ where: { submissionId_assignmentQuestionId: { submissionId: submission.id, assignmentQuestionId: input.questionId } } });
  return { revision, audience, submission, question: revision.questions[0], answer, resubmissionGrant };
}

async function aggregateAndUpdate(prisma: PrismaClient, submissionId: string) {
  const answers = await prisma.submissionAnswer.findMany({ where: { submissionId }, select: { state: true } });
  const submission = await prisma.assignmentSubmission.findUniqueOrThrow({ where: { id: submissionId }, select: { requiredQuestionCount: true } });
  const aggregate = deriveAggregate([...answers, ...Array(Math.max(0, submission.requiredQuestionCount - answers.length)).fill({ state: 'NOT_STARTED' })]);
  await prisma.assignmentSubmission.update({ where: { id: submissionId }, data: { state: aggregate.state, submittedRequiredCount: aggregate.submittedRequiredCount } });
  return aggregate;
}

export function presentRevision(revision: any, audience: any, submission: any, currentContext: boolean, now: Date): StudentAssignmentDto {
  const answers = new Map((submission?.answers ?? []).map((answer: any) => [answer.assignmentQuestionId, answer]));
  const historicalOnly = !currentContext;
  const persistedState = submission?.state ?? 'NOT_STARTED';
  const feedback = presentStudentAssignmentFeedback(submission, revision.questions, now);
  const activeGrants = (submission?.resubmissionGrants ?? []).filter((row: any) => row.state === 'ACTIVE' && (!row.expiresAt || new Date(row.expiresAt) > now));
  const activeResubmission = activeGrants.length > 0;
  const downstreamState = submission?.reviewState === 'REVIEWED' ? 'REVIEWED'
    : activeResubmission ? 'RESUBMISSION_REQUIRED'
      : ['APPROVED_PENDING_RELEASE', 'RELEASE_BLOCKED'].includes(submission?.reviewState) ? 'AWAITING_TEACHER_CONFIRMATION'
      : submission?.reviewState === 'REVIEWING' ? 'IN_REVIEW'
        : null;
  const presentation = deriveStudentAssignmentPresentation({ persistedState, dueAt: audience.dueAt, now, lateClosed: (revision.latePolicy as { mode?: string })?.mode === 'CLOSED', downstreamState });
  return {
    id: revision.assignmentId,
    revisionId: revision.id,
    title: revision.title,
    instructions: revision.instructions,
    availableAt: audience.availableAt,
    dueAt: audience.dueAt,
    ...presentation,
    contextStatus: historicalOnly ? 'HISTORICAL' : 'CURRENT',
    historicalOnly,
    canMutate: !historicalOnly && (persistedState !== 'SUBMITTED' || activeResubmission) && presentation.state !== 'OVERDUE',
    submittedRequiredCount: submission?.submittedRequiredCount ?? 0,
    requiredQuestionCount: revision.questions.length,
    approvedTotal: submission?.reviewState === 'REVIEWED' && submission.approvedTotal != null ? Number(submission.approvedTotal) : null,
    feedbackStatus: submission?.reviewState === 'APPROVED_PENDING_RELEASE' ? 'PUBLISHING'
      : submission?.reviewState === 'RELEASE_BLOCKED' ? 'BLOCKED'
        : submission?.reviewState === 'REVIEWED' ? 'PUBLISHED' : 'HIDDEN',
    policyReason: submission?.reviewState === 'APPROVED_PENDING_RELEASE' ? '评分已批准，批阅文档与反馈正在安全发布。'
      : submission?.reviewState === 'RELEASE_BLOCKED' ? '反馈发布暂时受阻，教师可重试派生文件或选择带限制的结构化反馈。'
        : undefined,
    feedback,
    questions: revision.questions.map((question: any) => {
      const answer: any = answers.get(question.id);
      const grant = activeGrants.find((row: any) => row.questionId === question.id);
      return {
        id: question.id,
        stableQuestionId: question.stableQuestionId,
        orderIndex: question.orderIndex,
        responseType: question.responseType,
        points: Number(question.points),
        promptText: safePromptText(question.promptSnapshot),
        state: grant ? (answer?.textDraft ? 'DRAFT' : 'NOT_STARTED') : answer?.state ?? 'NOT_STARTED',
        version: answer?.version ?? 1,
        currentAttemptNumber: answer?.currentAttemptNumber ?? 0,
        textDraft: answer?.textDraft ?? null,
        history: (answer?.attempts ?? []).map((attempt: any) => ({ id: attempt.id, attemptNumber: attempt.attemptNumber, submittedAt: attempt.submittedAt, textSnapshot: attempt.textSnapshot, assets: (attempt.assets ?? []).map((asset: any) => ({ id: asset.id, displayName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, canDownload: true as const })) })),
        assets: (answer?.assets ?? [])
          .filter((asset: any) => !grant || asset.attemptId == null)
          .map((asset: any) => ({ id: asset.id, displayName: asset.originalName, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes, state: asset.state, finalizedAt: asset.finalizedAt })),
        resubmission: grant ? { state: grant.state, reason: grant.reason, allowedResponseType: grant.allowedResponseType, deadlineAt: grant.newDeadlineAt } : null,
      };
    }),
  };
}

export function presentStudentAssignmentFeedback(submission: any, questions: any[], now: Date) {
  if (!submission || submission.studentId !== submission.frozenStudentId) return [];
  const questionById = new Map(questions.map((question: any) => [question.id, question]));
  const currentAttemptByQuestion = new Map((submission.answers ?? []).flatMap((answer: any) => {
    const attempt = (answer.attempts ?? []).find((row: any) => row.attemptNumber === answer.currentAttemptNumber);
    return attempt ? [[answer.assignmentQuestionId, attempt.id] as const] : [];
  }));
  const latestPublished = new Map<string, any>();
  for (const snapshot of submission.approvalSnapshots ?? []) {
    const release = (snapshot.outboxCommands ?? []).find((row: any) => row.command === 'RELEASE_STUDENT_FEEDBACK');
    if (!release || release.state !== 'SUCCEEDED' || !snapshot.feedbackRelease || snapshot.feedbackRelease.ownerStudentId !== submission.frozenStudentId) continue;
    const currentAttemptId = currentAttemptByQuestion.get(snapshot.questionId);
    if (currentAttemptId && snapshot.attemptId !== currentAttemptId) continue;
    const key = currentAttemptId ? String(snapshot.questionId) : `${snapshot.questionId}:${snapshot.attemptId ?? ''}`;
    const previous = latestPublished.get(key);
    const previousAt = previous?.approvedAt ? new Date(previous.approvedAt).getTime() : Number.NEGATIVE_INFINITY;
    const snapshotAt = snapshot.approvedAt ? new Date(snapshot.approvedAt).getTime() : Number.NEGATIVE_INFINITY;
    if (!previous || snapshotAt >= previousAt) latestPublished.set(key, snapshot);
  }
  return [...latestPublished.values()].map((snapshot: any) => {
    const derivative = snapshot.feedbackRelease.derivative;
    const question: any = questionById.get(snapshot.questionId);
    const grant = (submission.resubmissionGrants ?? []).find((row: any) => row.questionId === snapshot.questionId && row.state === 'ACTIVE' && (!row.expiresAt || new Date(row.expiresAt) > now));
    return {
      snapshotId: snapshot.id,
      questionId: snapshot.questionId,
      questionTitle: question ? safePromptText(question.promptSnapshot).slice(0, 160) : '题目反馈',
      questionTotal: Number(snapshot.questionTotal),
      criteria: Array.isArray(snapshot.criterionSnapshot) ? snapshot.criterionSnapshot : [],
      annotations: Array.isArray(snapshot.annotationSnapshot) ? snapshot.annotationSnapshot : [],
      overallComment: snapshot.overallComment ?? '',
      approvedAt: snapshot.approvedAt,
      reviewedAssets: derivative?.state === 'READY' && derivative.outputObjectKey ? [{
        id: derivative.id,
        label: derivative.outputKind === 'REVIEWED_DOCX' ? '下载批阅 DOCX' : derivative.outputKind === 'REVIEWED_PDF' ? '下载批阅 PDF' : '下载批注说明',
        href: `/api/student/assignments/${encodeURIComponent(snapshot.assignmentId)}/feedback/${encodeURIComponent(snapshot.id)}/asset`,
        mimeType: derivative.outputMimeType,
        precision: derivative.anchorPrecision,
      }] : [],
      limitations: derivative?.limitations ?? (snapshot.feedbackRelease.mode === 'STRUCTURED_ONLY' ? ['structured-only-fallback'] : []),
      resubmission: grant ? { state: grant.state, reason: grant.reason, allowedResponseType: grant.allowedResponseType, deadlineAt: grant.newDeadlineAt } : null,
    };
  });
}

async function withSerializableRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try { return await operation(); } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? String((error as { code: unknown }).code) : '';
      if (attempt >= attempts || (code !== 'P2034' && code !== 'P2002')) throw error;
    }
  }
}
