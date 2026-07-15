import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';

import { buildPipelineDedupeKey, pseudonymousAuditId } from './math-document-grading-contracts';
import type { SubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { revokeDerivedLearningMaterializations } from './derived-learning-materialization';

type MathGradingDb = Record<string, any>;

export const GRADING_TOMBSTONE_LEASE_MS = 5 * 60_000;
export const GRADING_TOMBSTONE_HEARTBEAT_MS = 60_000;

export interface ProviderRetentionAdapter {
  /** requestKey is local idempotency/audit context; deletion MUST use the frozen provider locator fields. */
  delete(input: {
    resourceType: string;
    requestKey: string;
    provider: string;
    providerRequestId: string | null;
    deletionHandle: string | null;
    deadline: Date;
    providerRetentionSeconds: number;
    signal?: AbortSignal;
  }): Promise<{ deleted: boolean; reason?: string }>;
}

export interface LifecyclePolicyInput {
  id?: string | null;
  dataClass: string;
  version: string;
  retentionSeconds?: number | null;
  governedRecordRule?: string | null;
  deleteStrategy: 'delete-content' | 'pseudonymize-lineage' | 'retain-governed-record';
  providerRetentionSeconds?: number | null;
  enabled?: boolean;
}

export interface FrozenLifecycleFields {
  lifecyclePolicyId: string;
  lifecyclePolicyVersion: string;
  lifecycleDeleteStrategy: LifecyclePolicyInput['deleteStrategy'];
  lifecycleRetentionSeconds: number | null;
  lifecycleGovernedRecordRule: string | null;
  lifecycleProviderRetentionSeconds: number | null;
  retentionExpiresAt: Date | null;
}

export function validateLifecyclePolicy(policy: LifecyclePolicyInput | null | undefined): string[] {
  if (!policy) return ['lifecycle-policy-missing'];
  const reasons: string[] = [];
  if (!policy.version.trim()) reasons.push('lifecycle-version-missing');
  if (!policy.deleteStrategy) reasons.push('delete-strategy-missing');
  else if (!['delete-content', 'pseudonymize-lineage', 'retain-governed-record'].includes(policy.deleteStrategy)) reasons.push('delete-strategy-invalid');
  const governedRecordRule = policy.governedRecordRule?.trim() ?? '';
  if (policy.retentionSeconds === null || policy.retentionSeconds === undefined) {
    if (policy.deleteStrategy !== 'retain-governed-record') reasons.push('governed-record-strategy-required');
    if (!governedRecordRule) reasons.push('finite-retention-or-record-rule-required');
  } else {
    if (!Number.isInteger(policy.retentionSeconds) || policy.retentionSeconds < 1) reasons.push('retention-seconds-invalid');
    if (policy.deleteStrategy === 'retain-governed-record') reasons.push('retain-governed-record-requires-no-finite-retention');
    if (governedRecordRule) reasons.push('governed-record-rule-forbidden-with-finite-retention');
  }
  if (policy.providerRetentionSeconds !== null && policy.providerRetentionSeconds !== undefined && (!Number.isInteger(policy.providerRetentionSeconds) || policy.providerRetentionSeconds < 0)) reasons.push('provider-retention-invalid');
  if (policy.enabled === false) reasons.push('lifecycle-policy-disabled');
  return reasons;
}

export function assertLifecyclePolicy(policy: LifecyclePolicyInput | null | undefined): LifecyclePolicyInput {
  const reasons = validateLifecyclePolicy(policy);
  if (reasons.length > 0) throw new Error(`lifecycle-policy-blocked:${reasons.join(',')}`);
  return policy!;
}

export function freezeLifecyclePolicy(policy: LifecyclePolicyInput & { id?: string | null }, now: Date): FrozenLifecycleFields {
  assertLifecyclePolicy(policy);
  if (!policy.id?.trim()) throw new Error(`lifecycle-policy-id-missing:${policy.dataClass}`);
  return {
    lifecyclePolicyId: policy.id,
    lifecyclePolicyVersion: policy.version,
    lifecycleDeleteStrategy: policy.deleteStrategy,
    lifecycleRetentionSeconds: policy.retentionSeconds ?? null,
    lifecycleGovernedRecordRule: policy.governedRecordRule?.trim() || null,
    lifecycleProviderRetentionSeconds: policy.providerRetentionSeconds ?? 0,
    retentionExpiresAt: Number.isInteger(policy.retentionSeconds) && (policy.retentionSeconds ?? 0) > 0
      ? new Date(now.getTime() + (policy.retentionSeconds as number) * 1000)
      : null,
  };
}

export function frozenLifecyclePolicyFromRecord(row: any, dataClass: string): (LifecyclePolicyInput & { id: string }) | null {
  if (!row?.lifecyclePolicyId || !row?.lifecyclePolicyVersion || !row?.lifecycleDeleteStrategy) return null;
  if (['lifecycleRetentionSeconds', 'lifecycleGovernedRecordRule', 'lifecycleProviderRetentionSeconds'].some((field) => !Object.prototype.hasOwnProperty.call(row, field))) return null;
  if (row.lifecycleProviderRetentionSeconds === null || row.lifecycleProviderRetentionSeconds === undefined) return null;
  const policy = {
    id: String(row.lifecyclePolicyId),
    dataClass,
    version: String(row.lifecyclePolicyVersion),
    retentionSeconds: row.lifecycleRetentionSeconds ?? null,
    governedRecordRule: row.governedRecordRule ?? row.lifecycleGovernedRecordRule ?? null,
    deleteStrategy: row.lifecycleDeleteStrategy,
    providerRetentionSeconds: row.lifecycleProviderRetentionSeconds,
    enabled: true,
  } as LifecyclePolicyInput & { id: string };
  return validateLifecyclePolicy(policy).length === 0 ? policy : null;
}

function frozenPolicyForRecord(row: any, dataClass: string): (LifecyclePolicyInput & { id: string }) | null {
  return frozenLifecyclePolicyFromRecord(row, dataClass);
}

function legacyLifecycleExpiryBlocked(row: any, policy: LifecyclePolicyInput | null): boolean {
  if (!policy || validateLifecyclePolicy(policy).length > 0) return true;
  if (policy.deleteStrategy === 'retain-governed-record') {
    return row?.retentionExpiresAt !== null
      && row?.retentionExpiresAt !== undefined;
  }
  return policy.retentionSeconds === null
    || !Number.isInteger(policy.retentionSeconds)
    || (row?.retentionExpiresAt === null || row?.retentionExpiresAt === undefined);
}

export async function requireConfiguredLifecyclePolicies(db: MathGradingDb, dataClasses: string[]): Promise<any[]> {
  const repository = db.gradingLifecyclePolicy;
  if (!repository?.findMany) throw new Error('lifecycle-policy-repository-unavailable');
  const rows = await repository.findMany({ where: { enabled: true, dataClass: { in: dataClasses } }, orderBy: { createdAt: 'desc' } });
  const selected = dataClasses.map((dataClass) => rows.find((row: any) => row.dataClass === dataClass)).filter(Boolean);
  const missing = dataClasses.filter((dataClass) => !selected.some((row: any) => row.dataClass === dataClass));
  if (missing.length > 0) throw new Error(`lifecycle-policy-blocked:missing:${missing.join(',')}`);
  for (const row of selected) assertLifecyclePolicy({ dataClass: row.dataClass, version: row.version, retentionSeconds: row.retentionSeconds, governedRecordRule: row.governedRecordRule, deleteStrategy: row.deleteStrategy, providerRetentionSeconds: row.providerRetentionSeconds, enabled: row.enabled });
  return selected;
}

export async function requireSourceAssetLifecyclePolicy(db: MathGradingDb): Promise<LifecyclePolicyInput> {
  const rows = await db.gradingLifecyclePolicy?.findMany?.({ where: { enabled: true, dataClass: 'source-asset' }, orderBy: { createdAt: 'desc' } });
  const row = rows?.[0];
  if (!row) throw new Error('lifecycle-policy-blocked:missing:source-asset');
  return assertLifecyclePolicy({ id: row.id, dataClass: 'source-asset', version: row.version, retentionSeconds: row.retentionSeconds, governedRecordRule: row.governedRecordRule, deleteStrategy: row.deleteStrategy, providerRetentionSeconds: row.providerRetentionSeconds, enabled: row.enabled });
}

export function buildSourceAssetLifecycleFields(policy: LifecyclePolicyInput & { id?: string | null }, now: Date): { retentionPolicyId: string | null; retentionPolicyVersion: string; retentionDeleteStrategy: LifecyclePolicyInput['deleteStrategy']; retentionSeconds: number | null; retentionExpiresAt: Date | null; governedRecordRule: string | null } {
  assertLifecyclePolicy(policy);
  return {
    retentionPolicyId: policy.id ?? null,
    retentionPolicyVersion: policy.version,
    retentionDeleteStrategy: policy.deleteStrategy,
    retentionSeconds: policy.retentionSeconds ?? null,
    retentionExpiresAt: Number.isInteger(policy.retentionSeconds) && (policy.retentionSeconds ?? 0) > 0 ? new Date(now.getTime() + (policy.retentionSeconds as number) * 1000) : null,
    governedRecordRule: policy.governedRecordRule ?? null,
  };
}

export async function placeGradingHold(input: {
  db: MathGradingDb;
  scopeType: 'asset' | 'attempt' | 'answer' | 'evidence' | 'run' | 'batch' | 'class' | 'assignment-revision' | 'assignment';
  scopeId: string;
  reason: string;
  actorId: string;
  actorRole: 'TEACHER' | 'ADMIN' | 'SERVICE';
  expiresAt?: Date | null;
  now?: Date;
}) {
  if (!['TEACHER', 'ADMIN', 'SERVICE'].includes(input.actorRole)) throw new Error('hold-forbidden');
  if (!input.reason.trim()) throw new Error('hold-reason-required');
  const now = input.now ?? new Date();
  const execute = async (db: MathGradingDb) => {
    const hold = await db.gradingLegalHold.create({ data: { id: `grading-hold:${input.scopeType}:${input.scopeId}:${now.getTime()}`, scopeType: input.scopeType, scopeId: input.scopeId, reason: input.reason.trim(), placedByPseudoId: pseudonymousAuditId(input.actorId, 'hold'), expiresAt: input.expiresAt ?? null, createdAt: now, updatedAt: now } });
    await writeLifecycleAudit(db, { action: 'grading-hold.placed', resourceType: 'GradingLegalHold', resourceId: hold.id, actorId: input.actorId, actorRole: input.actorRole, metadata: { scopeType: input.scopeType, scopeId: input.scopeId, reason: input.reason.trim() } });
    return hold;
  };
  return input.db.$transaction ? input.db.$transaction(execute) : execute(input.db);
}

export async function releaseGradingHold(input: { db: MathGradingDb; holdId: string; actorId: string; actorRole: 'TEACHER' | 'ADMIN' | 'SERVICE'; now?: Date }) {
  if (!['TEACHER', 'ADMIN', 'SERVICE'].includes(input.actorRole)) throw new Error('hold-forbidden');
  const now = input.now ?? new Date();
  const execute = async (db: MathGradingDb) => {
    const hold = await db.gradingLegalHold.update({ where: { id: input.holdId }, data: { releasedAt: now, releasedByPseudoId: pseudonymousAuditId(input.actorId, 'hold'), updatedAt: now } });
    await writeLifecycleAudit(db, { action: 'grading-hold.released', resourceType: 'GradingLegalHold', resourceId: input.holdId, actorId: input.actorId, actorRole: input.actorRole, metadata: {} });
    return hold;
  };
  return input.db.$transaction ? input.db.$transaction(execute) : execute(input.db);
}

export interface ResolvedGradingLineage {
  scopes: Array<[string, string]>;
  assetId?: string;
  attemptId?: string;
  answerId?: string;
  assignmentRevisionId?: string;
  assignmentId?: string;
  classId?: string;
}

export function pseudonymizeGradingLineage(value: string, field = 'resource'): string {
  return pseudonymousAuditId(`${field}:${value}`, `grading-lineage:${field}`);
}

function gradingTombstoneLookupSecret(): string {
  const dedicated = process.env.GRADING_LIFECYCLE_LOOKUP_SECRET?.trim();
  if (dedicated) return dedicated;
  const auditSecret = process.env.GRADING_AUDIT_SECRET?.trim();
  if (auditSecret) return auditSecret;
  if (process.env.NODE_ENV === 'production') throw new Error('grading-lifecycle-lookup-secret-missing');
  return 'test-grading-audit-secret';
}

function gradingTombstoneLookupKeyWithSecret(resourceKey: string, secret: string): string {
  return `redacted:grading-lookup:${pseudonymousAuditId('lookup-key:' + resourceKey, 'grading-lineage:lookup-key', secret)}`;
}

export function gradingTombstoneLookupKey(resourceKey: string): string {
  return gradingTombstoneLookupKeyWithSecret(resourceKey, gradingTombstoneLookupSecret());
}

function previousGradingTombstoneLookupKey(resourceKey: string): string | null {
  const previous = process.env.GRADING_LIFECYCLE_LOOKUP_SECRET_PREVIOUS?.trim();
  if (!previous || previous === gradingTombstoneLookupSecret()) return null;
  return gradingTombstoneLookupKeyWithSecret(resourceKey, previous);
}

function legacyGradingTombstoneLookupKey(resourceKey: string): string | null {
  try {
    return `redacted:grading-lookup:${createHash('md5').update(resourceKey).digest('hex')}`;
  } catch {
    return null;
  }
}

function legacyPhaseFourGradingTombstoneLookupKey(resourceKey: string): string {
  const phaseFourResourceKey = `redacted:grading-resource:${createHash('md5').update(resourceKey).digest('hex')}`;
  return `redacted:grading-lookup:${createHash('md5').update(phaseFourResourceKey).digest('hex')}`;
}

function gradingTombstoneOperationKey(resourceKey: string): string {
  return `redacted:grading-operation:${pseudonymizeGradingLineage(resourceKey, 'operation-key')}`;
}

function isExplicitMissingLineageError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; name?: unknown; status?: unknown; statusCode?: unknown };
  return ['P2025', 'NOT_FOUND', 'RECORD_NOT_FOUND'].includes(String(candidate.code))
    || ['NotFound', 'RecordNotFound'].includes(String(candidate.name));
}

function isOptionalTombstoneLookupError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  const code = String(candidate.code ?? '');
  const message = String(candidate.message ?? '');
  return ['P2021', 'P2022'].includes(code)
    || /(?:unknown argument|column|field|property).*lookupKey|lookupKey.*(?:does not exist|unknown)/i.test(message);
}

async function loadOptionalLineageRecord<T>(loader: () => Promise<T | null>): Promise<T | null> {
  try {
    return await loader();
  } catch (error) {
    if (isExplicitMissingLineageError(error)) return null;
    throw error;
  }
}

export async function resolveGradingLineage(input: { db: MathGradingDb; resourceType: string; resource: any }): Promise<ResolvedGradingLineage> {
  const resource = input.resource ?? {};
  const scopes = new Map<string, [string, string]>();
  const add = (type: string, id: unknown) => {
    if (typeof id === 'string' && id.trim()) scopes.set(`${type}:${id}`, [type, id]);
  };
  const typeMap: Record<string, string> = {
    AnswerEvidence: 'evidence',
    DocumentConversion: 'conversion',
    GradingRun: 'run',
    GradingBatch: 'batch',
    SubmissionAsset: 'asset',
    GradingBatchItem: 'batch-item',
  };
  const resourceScopeType = typeMap[input.resourceType] ?? input.resourceType.toLowerCase();
  add(resourceScopeType, resource.id);

  const batchItem = resource.batchItem ?? resource.item ?? resource.items?.[0] ?? resource.batchItems?.[0];
  let evidence = resource.evidence ?? resource.answerEvidence;
  let asset = resource.asset ?? resource.sourceAsset ?? evidence?.sourceAsset ?? batchItem?.asset;
  let attempt = resource.attempt ?? resource.answerAttempt ?? evidence?.attempt ?? batchItem?.attempt;
  let answer = resource.answer ?? attempt?.answer ?? asset?.answer ?? evidence?.answer ?? batchItem?.answer;
  let submission = answer?.submission ?? attempt?.answer?.submission ?? resource.submission;
  let revision = submission?.revision ?? answer?.question?.revision ?? resource.revision;

  let assetId = String(resource.assetId ?? asset?.id ?? evidence?.sourceAssetId ?? batchItem?.assetId ?? '') || undefined;
  let attemptId = String(resource.attemptId ?? resource.answerAttemptId ?? attempt?.id ?? evidence?.attemptId ?? batchItem?.attemptId ?? '') || undefined;
  let answerId = String(resource.answerId ?? answer?.id ?? attempt?.answerId ?? asset?.answerId ?? evidence?.answerId ?? batchItem?.answerId ?? '') || undefined;
  const evidenceId = String(resource.answerEvidenceId ?? resource.evidenceId ?? evidence?.id ?? batchItem?.evidenceId ?? '') || undefined;
  let assignmentRevisionId = String(resource.assignmentRevisionId ?? submission?.assignmentRevisionId ?? answer?.question?.assignmentRevisionId ?? revision?.id ?? '') || undefined;
  let assignmentId = String(revision?.assignmentId ?? revision?.assignment?.id ?? '') || undefined;
  let classId = String(resource.classId ?? submission?.frozenAudienceClassId ?? submission?.audience?.classId ?? resource.class?.id ?? '') || undefined;

  const loadAttempt = async () => {
    if (!attemptId || attempt?.answer || !input.db.submissionAttempt?.findUnique) return;
    attempt = await loadOptionalLineageRecord(() => input.db.submissionAttempt.findUnique({
      where: { id: attemptId },
      include: {
        answer: {
          include: {
            submission: {
              include: {
                revision: { select: { id: true, assignmentId: true } },
                audience: { select: { classId: true } },
              },
            },
            question: { select: { assignmentRevisionId: true } },
          },
        },
      },
    }));
    answer = attempt?.answer ?? answer;
    submission = answer?.submission ?? submission;
    revision = submission?.revision ?? revision;
    assignmentRevisionId ||= String(answer?.question?.assignmentRevisionId ?? revision?.id ?? '') || undefined;
    assignmentId ||= String(revision?.assignmentId ?? '') || undefined;
    classId ||= String(submission?.frozenAudienceClassId ?? submission?.audience?.classId ?? '') || undefined;
  };
  await loadAttempt();
  if (evidenceId && !attempt && input.db.answerEvidence?.findUnique) {
    const loadedEvidence = await loadOptionalLineageRecord(() => input.db.answerEvidence.findUnique({
      where: { id: evidenceId },
      include: {
        attempt: { include: { answer: { include: { submission: { include: { revision: true, audience: true } }, question: true } } } },
        sourceAsset: { include: { answer: { include: { submission: { include: { revision: true, audience: true } } } } } },
      },
    }));
    evidence = loadedEvidence ?? evidence;
    attempt = evidence?.attempt ?? attempt;
    asset = evidence?.sourceAsset ?? asset;
    answer = attempt?.answer ?? asset?.answer ?? answer;
    submission = answer?.submission ?? submission;
    revision = submission?.revision ?? revision;
  }
  if (answerId && !answer && input.db.submissionAnswer?.findUnique) {
    answer = await loadOptionalLineageRecord(() => input.db.submissionAnswer.findUnique({ where: { id: answerId }, include: { submission: { include: { revision: { select: { id: true, assignmentId: true } }, audience: { select: { classId: true } } } }, question: { select: { assignmentRevisionId: true } } } }));
    submission = answer?.submission ?? submission;
    revision = submission?.revision ?? revision;
  }
  assetId ||= String(asset?.id ?? evidence?.sourceAssetId ?? batchItem?.assetId ?? '') || undefined;
  attemptId ||= String(attempt?.id ?? evidence?.attemptId ?? batchItem?.attemptId ?? '') || undefined;
  answerId ||= String(answer?.id ?? attempt?.answerId ?? asset?.answerId ?? evidence?.answerId ?? batchItem?.answerId ?? '') || undefined;
  assignmentRevisionId ||= String(submission?.assignmentRevisionId ?? answer?.question?.assignmentRevisionId ?? revision?.id ?? '') || undefined;
  assignmentId ||= String(revision?.assignmentId ?? revision?.assignment?.id ?? '') || undefined;
  classId ||= String(submission?.frozenAudienceClassId ?? submission?.audience?.classId ?? resource.class?.id ?? '') || undefined;
  if (assignmentRevisionId && (!assignmentId || !revision?.assignmentId) && input.db.assignmentRevision?.findUnique) {
    revision = await loadOptionalLineageRecord(() => input.db.assignmentRevision.findUnique({ where: { id: assignmentRevisionId }, select: { id: true, assignmentId: true } })) ?? revision;
    assignmentId ||= String(revision?.assignmentId ?? '') || undefined;
  }

  add('asset', assetId);
  add('attempt', attemptId);
  add('answer', answerId);
  add('assignment-revision', assignmentRevisionId);
  add('assignment', assignmentId);
  add('class', classId);
  return { scopes: [...scopes.values()], assetId, attemptId, answerId, assignmentRevisionId, assignmentId, classId };
}

export async function runGradingRetentionGc(input: {
  db: MathGradingDb;
  store: SubmissionObjectStore;
  policies: LifecyclePolicyInput[];
  providerRetentionAdapter?: ProviderRetentionAdapter;
  now?: Date;
}): Promise<{ scanned: number; deleted: number; held: number; blocked: number; tombstones: number }> {
  const now = await readRetentionDatabaseNow(input.db, input.now ?? new Date());
  await input.db.gradingRequestIdempotency?.deleteMany?.({ where: { expiresAt: { lte: now } } });
  for (const policy of input.policies) assertLifecyclePolicy(policy);
  if (!input.policies.some((policy) => policy.dataClass === 'document-conversion')) throw new Error('lifecycle-policy-blocked:missing:document-conversion');
  const evidence = await input.db.answerEvidence.findMany({ where: { tombstonedAt: null, OR: [{ retentionExpiresAt: { lte: now } }, { retentionExpiresAt: null }] }, include: { attempt: true, sourceAsset: true, conversion: { select: { renderedObjectKey: true, providerRequestId: true, providerRequestedAt: true, providerProcessedAt: true, policy: { select: { provider: true } } } }, blocks: true } });
  let deleted = 0;
  let held = 0;
  let blocked = 0;
  let tombstones = 0;
  for (const row of evidence) {
    try {
    const lineage = await resolveGradingLineage({ db: input.db, resourceType: 'AnswerEvidence', resource: row });
    const hold = await findActiveHold(input.db, lineage.scopes, now);
    if (hold) {
      held += 1;
      continue;
    }
    const policy = frozenPolicyForRecord(row, 'answer-evidence');
    if (!policy) {
      blocked += 1;
      await auditLegacyLifecycleBlocked(input.db, 'AnswerEvidence', row.id, 'missing-or-invalid-lifecycle-policy', now);
      continue;
    }
    if (legacyLifecycleExpiryBlocked(row, policy)) {
      blocked += 1;
      await auditLegacyLifecycleBlocked(input.db, 'AnswerEvidence', row.id, 'missing-retention-expiry', now);
      continue;
    }
    const resourceKey = `evidence:${row.id}`;
    const existingTombstone = await findGradingTombstone(input.db, resourceKey);
    if (isGradingTombstoneTerminal(existingTombstone)) continue;
    const objectKeys = sourceDerivedObjectKeys(row);
    if (policy.deleteStrategy === 'retain-governed-record') {
      await input.db.$transaction(async (tx: any) => {
        await ensureGradingTombstone(tx, {
          ...frozenLifecycleTombstoneFields(policy),
          id: `grading-tombstone:${resourceKey}`,
          resourceType: 'AnswerEvidence',
          resourceId: row.id,
          resourceKey,
          reason: 'retention-expired',
          checksum: row.sourceHash,
          lifecyclePolicyId: policy.id,
          lifecyclePolicyVersion: policy.version,
          lifecycleDeleteStrategy: policy.deleteStrategy,
          lifecycleRetentionSeconds: policy.retentionSeconds ?? null,
          providerRetentionSeconds: policy.providerRetentionSeconds ?? 0,
          contentDeletedAt: null,
          lineageRetained: true,
          createdAt: now,
          provider: row.conversion?.policy?.provider ?? null,
          providerRequestId: row.conversion?.providerRequestId ?? null,
        });
      });
      const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey, resourceType: 'AnswerEvidence', resourceId: row.id, scopes: lineage.scopes, now });
      if (!claimToken) { blocked += 1; continue; }
      await input.db.$transaction(async (tx: any) => {
      await completeGradingTombstone(tx, resourceKey, now, { contentDeleted: false, workerClaimToken: claimToken, holdScopes: lineage.scopes });
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.evidence-retained', resourceType: 'AnswerEvidence', resourceId: row.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', deleteStrategy: policy.deleteStrategy, lifecyclePolicyVersion: policy.version } });
      });
      if (!existingTombstone) tombstones += 1;
      continue;
    }
    await input.db.$transaction(async (tx: any) => {
      await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'AnswerEvidence', resourceId: row.id, resourceKey, reason: 'retention-expired', checksum: row.sourceHash, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: row.conversion?.policy?.provider ?? null, providerRequestId: row.conversion?.providerRequestId ?? null, providerRetentionStartedAt: row.conversion?.providerProcessedAt ?? row.conversion?.providerRequestedAt ?? null, contentDeletedAt: existingTombstone?.contentDeletedAt ?? null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
    });
    const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey, resourceType: 'AnswerEvidence', resourceId: row.id, scopes: lineage.scopes, now });
    if (!claimToken) { blocked += 1; continue; }
    await ensureGradingTombstoneObjects({ db: input.db, resourceKey, objectKeys, claimToken, now });
    try { await runRetentionControlTransaction(input.db, async (tx: any) => {
      await assertRetentionCleanupClaim(tx, resourceKey, claimToken, lineage.scopes, now, { model: 'answerEvidence', id: row.id, expiresAtField: 'retentionExpiresAt' });
      await transitionParentRunsContentUnavailable(tx, { answerEvidenceId: row.id }, 'evidence-content-unavailable', now);
      await blockActiveBatchAssociations({ db: tx, where: { evidenceId: row.id }, jobWhere: row.attemptId ? { attemptId: row.attemptId, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } } : undefined, reason: 'evidence-content-unavailable', now });
      await tx.gradingJob.updateMany({ where: { attemptId: row.attemptId, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, data: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: 'retention-expired', updatedAt: now } });
      await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'AnswerEvidence', resourceId: row.id, resourceKey, reason: 'retention-expired', checksum: row.sourceHash, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: row.conversion?.policy?.provider ?? null, providerRequestId: row.conversion?.providerRequestId ?? null, providerRetentionStartedAt: row.conversion?.providerProcessedAt ?? row.conversion?.providerRequestedAt ?? null, contentDeletedAt: existingTombstone?.contentDeletedAt ?? null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
      await writeLifecycleAudit(tx as never, { action: 'grading-retention.evidence-delete-intent', resourceType: 'AnswerEvidence', resourceId: row.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', tombstonePending: !existingTombstone?.contentDeletedAt } });
    }); } catch (error) {
      if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
      if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
      throw error;
    }
    if (!existingTombstone) tombstones += 1;
    const providerRetention = await handleProviderRetention({ db: input.db, adapter: input.providerRetentionAdapter, resourceKey, resourceType: 'AnswerEvidence', resourceId: row.id, claimToken, policy, holdScopes: lineage.scopes, now, preserveClaimOnFailure: true });
    const providerRetentionReady = providerRetention === 'ready';
    if (!providerRetentionReady) blocked += 1;
    let finalizationNow = await readRetentionDatabaseNow(input.db, now);
    if (!existingTombstone?.contentDeletedAt) {
      try {
        finalizationNow = await deleteGradingObjectsWithLease({ db: input.db, store: input.store, resourceKey, resourceType: 'AnswerEvidence', resourceId: row.id, reason: 'evidence-content-unavailable', claimToken, objectKeys, holdScopes: lineage.scopes, now });
      } catch (error) {
        if (isGradingPhysicalDeleteReconciledError(error)) { blocked += 1; continue; }
        if (!isObjectAlreadyGone(error)) {
          blocked += 1;
          await input.db.$transaction(async (tx: any) => {
            await markGradingTombstoneRetryable(tx, resourceKey, retentionErrorCode(error), claimToken);
            await writeLifecycleAudit(tx as never, { action: 'grading-retention.evidence-delete-failed', resourceType: 'AnswerEvidence', resourceId: row.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', error: retentionErrorCode(error) } });
          });
          continue;
        }
      }
    }
    try {
      await input.db.$transaction(async (tx: any) => {
        await completeGradingTombstone(tx, resourceKey, finalizationNow, { pseudonymized: policy.deleteStrategy === 'pseudonymize-lineage', providerRetentionReady, workerClaimToken: claimToken, holdScopes: lineage.scopes });
        await clearReverseGradingLineage({ db: tx, resourceType: 'AnswerEvidence', resourceId: row.id, reason: 'evidence-content-unavailable', now: finalizationNow });
        await tx.answerEvidenceBlock.updateMany({ where: { evidenceId: row.id }, data: { text: '[deleted-by-retention-policy]', markdown: '[deleted-by-retention-policy]', spanStart: null, spanEnd: null, bbox: null, precision: 'PAGE', confidence: 0 } });
        const redacted = await tx.answerEvidence.updateMany({ where: { id: row.id, tombstonedAt: null }, data: { readiness: 'DELETED', canonicalMarkdown: '[deleted-by-retention-policy]', sourceHash: `redacted:grading-evidence:${pseudonymizeGradingLineage(row.id, 'source-hash')}`, limitations: [...(row.limitations ?? []), 'content-deleted'], attemptId: null, sourceAssetId: null, conversionId: null, tombstonedAt: finalizationNow, updatedAt: finalizationNow } });
        if (redacted.count !== 1) throw new Error('answer-evidence-redaction-fenced');
        if (tx.submissionAttempt?.updateMany) {
          await tx.submissionAttempt.updateMany({ where: { id: row.attemptId, textSnapshot: { not: null }, textSnapshotExpiresAt: { lte: finalizationNow }, textSnapshotPolicyId: { not: null }, textSnapshotPolicyVersion: { not: null }, textSnapshotDeleteStrategy: { in: ['delete-content', 'pseudonymize-lineage'] }, textSnapshotRetentionSeconds: { not: null }, OR: [{ textSnapshotGovernedRecordRule: null }, { textSnapshotGovernedRecordRule: '' }] }, data: { textSnapshot: null } });
        } else if (row.attemptId) {
          await tx.submissionAttempt?.update?.({ where: { id: row.attemptId }, data: { textSnapshot: null } });
        }
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.evidence-deleted', resourceType: 'AnswerEvidence', resourceId: row.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired' } });
      });
    } catch (error) {
      blocked += 1;
      await input.db.$transaction(async (tx: any) => {
        await markGradingTombstoneRetryable(tx, resourceKey, retentionErrorCode(error), claimToken);
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.evidence-delete-finalize-failed', resourceType: 'AnswerEvidence', resourceId: row.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', error: retentionErrorCode(error) } });
      });
      continue;
    }
    deleted += 1;
    } catch (error) {
      if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
      if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
      throw error;
    }
  }
  const conversions = await input.db.documentConversion.findMany({ where: { state: { not: 'DELETED' }, OR: [{ retentionExpiresAt: { lte: now } }, { retentionExpiresAt: null }] }, select: { id: true, renderedObjectKey: true, providerRequestId: true, providerRequestedAt: true, providerProcessedAt: true, assetId: true, attemptId: true, lifecyclePolicyId: true, lifecyclePolicyVersion: true, lifecycleDeleteStrategy: true, lifecycleRetentionSeconds: true, lifecycleGovernedRecordRule: true, lifecycleProviderRetentionSeconds: true, retentionExpiresAt: true, policy: { select: { provider: true } }, asset: { select: { objectKey: true, checksum: true } } } });
  for (const conversion of conversions) {
    try {
    const lineage = await resolveGradingLineage({ db: input.db, resourceType: 'DocumentConversion', resource: conversion });
    const hold = await findActiveHold(input.db, lineage.scopes, now);
    if (hold) {
      held += 1;
      continue;
    }
    const policy = frozenPolicyForRecord(conversion, 'document-conversion');
    if (!policy) {
      blocked += 1;
      await auditLegacyLifecycleBlocked(input.db, 'DocumentConversion', conversion.id, 'missing-or-invalid-lifecycle-policy', now);
      continue;
    }
    if (legacyLifecycleExpiryBlocked(conversion, policy)) {
      blocked += 1;
      await auditLegacyLifecycleBlocked(input.db, 'DocumentConversion', conversion.id, 'missing-retention-expiry', now);
      continue;
    }
    const resourceKey = `conversion:${conversion.id}`;
    const existingTombstone = await findGradingTombstone(input.db, resourceKey);
    if (isGradingTombstoneTerminal(existingTombstone)) continue;
    const objectKeys = [...new Set([conversion.renderedObjectKey].filter((value): value is string => Boolean(value)))];
    if (policy.deleteStrategy === 'retain-governed-record') {
      await input.db.$transaction(async (tx: any) => {
          await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'DocumentConversion', resourceId: conversion.id, resourceKey, reason: 'retention-expired', checksum: null, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: conversion.policy?.provider ?? null, providerRequestId: conversion.providerRequestId ?? null, providerRetentionStartedAt: conversion.providerProcessedAt ?? conversion.providerRequestedAt ?? null, contentDeletedAt: null, lineageRetained: true, createdAt: now });
      });
      const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey, resourceType: 'DocumentConversion', resourceId: conversion.id, scopes: lineage.scopes, now });
      if (!claimToken) { blocked += 1; continue; }
      await input.db.$transaction(async (tx: any) => {
        await completeGradingTombstone(tx, resourceKey, now, { contentDeleted: false, workerClaimToken: claimToken, holdScopes: lineage.scopes });
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.conversion-retained', resourceType: 'DocumentConversion', resourceId: conversion.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', deleteStrategy: policy.deleteStrategy, lifecyclePolicyVersion: policy.version } });
      });
      if (!existingTombstone) tombstones += 1;
      continue;
    }
    await input.db.$transaction(async (tx: any) => {
      await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'DocumentConversion', resourceId: conversion.id, resourceKey, reason: 'retention-expired', checksum: null, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: conversion.policy?.provider ?? null, providerRequestId: conversion.providerRequestId ?? null, providerRetentionStartedAt: conversion.providerProcessedAt ?? conversion.providerRequestedAt ?? null, contentDeletedAt: existingTombstone?.contentDeletedAt ?? null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
    });
    const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey, resourceType: 'DocumentConversion', resourceId: conversion.id, scopes: lineage.scopes, now });
    if (!claimToken) { blocked += 1; continue; }
    await ensureGradingTombstoneObjects({ db: input.db, resourceKey, objectKeys, claimToken, now });
    try { await runRetentionControlTransaction(input.db, async (tx: any) => {
      await assertRetentionCleanupClaim(tx, resourceKey, claimToken, lineage.scopes, now, { model: 'documentConversion', id: conversion.id, expiresAtField: 'retentionExpiresAt' });
      await transitionParentRunsContentUnavailable(tx, { answerEvidence: { conversionId: conversion.id } }, 'conversion-content-unavailable', now);
      await blockActiveBatchAssociations({ db: tx, where: { conversionId: conversion.id }, jobWhere: { conversionId: conversion.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, reason: 'conversion-content-unavailable', now });
      await clearReverseGradingLineage({ db: tx, resourceType: 'DocumentConversion', resourceId: conversion.id, reason: 'conversion-content-unavailable', now });
      await tx.gradingJob.updateMany({ where: { conversionId: conversion.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, data: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: 'retention-expired', updatedAt: now } });
      if (tx.documentConversion?.updateMany) {
        await tx.documentConversion.updateMany({ where: { id: conversion.id, state: { not: 'DELETED' } }, data: { state: 'CONTENT_UNAVAILABLE', failureCode: 'retention-delete-pending', updatedAt: now } });
      } else if (tx.documentConversion?.update) {
        await tx.documentConversion.update({ where: { id: conversion.id }, data: { state: 'CONTENT_UNAVAILABLE', failureCode: 'retention-delete-pending', updatedAt: now } });
      }
      await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'DocumentConversion', resourceId: conversion.id, resourceKey, reason: 'retention-expired', checksum: null, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: conversion.policy?.provider ?? null, providerRequestId: conversion.providerRequestId ?? null, providerRetentionStartedAt: conversion.providerProcessedAt ?? conversion.providerRequestedAt ?? null, contentDeletedAt: existingTombstone?.contentDeletedAt ?? null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
      await writeLifecycleAudit(tx as never, { action: 'grading-retention.conversion-delete-intent', resourceType: 'DocumentConversion', resourceId: conversion.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', tombstonePending: !existingTombstone?.contentDeletedAt } });
    }); } catch (error) {
      if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
      if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
      throw error;
    }
    if (!existingTombstone) tombstones += 1;
    const providerRetention = await handleProviderRetention({ db: input.db, adapter: input.providerRetentionAdapter, resourceKey, resourceType: 'DocumentConversion', resourceId: conversion.id, claimToken, policy, holdScopes: lineage.scopes, now, preserveClaimOnFailure: true });
    const providerRetentionReady = providerRetention === 'ready';
    if (!providerRetentionReady) blocked += 1;
    let conversionFinalizationNow = await readRetentionDatabaseNow(input.db, now);
    if (!existingTombstone?.contentDeletedAt) {
      try {
        conversionFinalizationNow = await deleteGradingObjectsWithLease({ db: input.db, store: input.store, resourceKey, resourceType: 'DocumentConversion', resourceId: conversion.id, reason: 'conversion-content-unavailable', claimToken, objectKeys, holdScopes: lineage.scopes, now });
      } catch (error) {
        if (isGradingPhysicalDeleteReconciledError(error)) { blocked += 1; continue; }
        if (!isObjectAlreadyGone(error)) {
          blocked += 1;
          await input.db.$transaction(async (tx: any) => {
            await markGradingTombstoneRetryable(tx, resourceKey, retentionErrorCode(error), claimToken);
            await writeLifecycleAudit(tx as never, { action: 'grading-retention.conversion-delete-failed', resourceType: 'DocumentConversion', resourceId: conversion.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', error: retentionErrorCode(error) } });
          });
          continue;
        }
      }
    }
    try {
      await input.db.$transaction(async (tx: any) => {
        await completeGradingTombstone(tx, resourceKey, conversionFinalizationNow, { pseudonymized: policy.deleteStrategy === 'pseudonymize-lineage', providerRetentionReady, workerClaimToken: claimToken, holdScopes: lineage.scopes });
        await tx.documentConversion.update({ where: { id: conversion.id }, data: { state: 'DELETED', canonicalMarkdown: null, sourceChecksum: `redacted:conversion-source:${pseudonymizeGradingLineage(conversion.id, 'source-checksum')}`, outputChecksum: null, renderedObjectKey: null, renderedChecksum: null, dedupeKey: `redacted:conversion:${pseudonymizeGradingLineage(conversion.id, 'dedupe-key')}`, policySnapshot: null, policySnapshotHash: null, providerRequestId: null, assetId: null, attemptId: null, updatedAt: conversionFinalizationNow } });
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.conversion-deleted', resourceType: 'DocumentConversion', resourceId: conversion.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired' } });
      });
    } catch (error) {
      blocked += 1;
      await input.db.$transaction(async (tx: any) => {
        await markGradingTombstoneRetryable(tx, resourceKey, retentionErrorCode(error), claimToken);
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.conversion-delete-finalize-failed', resourceType: 'DocumentConversion', resourceId: conversion.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', error: retentionErrorCode(error) } });
      });
      continue;
    }
    deleted += 1;
    } catch (error) {
      if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
      if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
      throw error;
    }
  }
  const runs = await input.db.gradingRun.findMany({ where: { tombstonedAt: null, state: { in: ['QUEUED', 'RUNNING', 'AWAITING_REVIEW', 'APPROVED', 'BLOCKED', 'RETRYABLE', 'CONTENT_UNAVAILABLE'] }, OR: [{ retentionExpiresAt: { lte: now } }, { retentionExpiresAt: null }] }, select: { id: true, batchId: true, answerAttemptId: true, answerEvidenceId: true, inputHash: true, modelInputObjectKey: true, modelOutputObjectKey: true, limitations: true, provider: true, providerRequestId: true, providerRequestedAt: true, providerProcessedAt: true, providerDeletionHandle: true, lifecyclePolicyId: true, lifecyclePolicyVersion: true, lifecycleDeleteStrategy: true, lifecycleRetentionSeconds: true, lifecycleGovernedRecordRule: true, lifecycleProviderRetentionSeconds: true, retentionExpiresAt: true, policy: { select: { provider: true } } } });
  for (const run of runs) {
    try {
    const lineage = await resolveGradingLineage({ db: input.db, resourceType: 'GradingRun', resource: run });
    const hold = await findActiveHold(input.db, lineage.scopes, now);
    if (hold) {
      held += 1;
      continue;
    }
    const policy = frozenPolicyForRecord(run, 'grading-run');
    if (!policy) {
      blocked += 1;
      await auditLegacyLifecycleBlocked(input.db, 'GradingRun', run.id, 'missing-or-invalid-lifecycle-policy', now);
      continue;
    }
    if (legacyLifecycleExpiryBlocked(run, policy)) {
      blocked += 1;
      await auditLegacyLifecycleBlocked(input.db, 'GradingRun', run.id, 'missing-retention-expiry', now);
      continue;
    }
    const resourceKey = `run:${run.id}`;
    const existingTombstone = await findGradingTombstone(input.db, resourceKey);
    if (isGradingTombstoneTerminal(existingTombstone)) continue;
    const modelObjectKeys = [...new Set([run.modelInputObjectKey, run.modelOutputObjectKey].filter((value): value is string => Boolean(value)))];
    if (policy.deleteStrategy === 'retain-governed-record') {
      await input.db.$transaction(async (tx: any) => {
          await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'GradingRun', resourceId: run.id, resourceKey, reason: 'retention-expired', checksum: run.inputHash, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: run.provider ?? run.policy?.provider ?? null, providerRequestId: run.providerRequestId ?? null, providerDeletionHandle: run.providerDeletionHandle ?? null, providerRetentionStartedAt: run.providerProcessedAt ?? run.providerRequestedAt ?? null, contentDeletedAt: null, lineageRetained: true, createdAt: now });
      });
      const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey, resourceType: 'GradingRun', resourceId: run.id, scopes: lineage.scopes, now });
      if (!claimToken) { blocked += 1; continue; }
      await input.db.$transaction(async (tx: any) => {
        await completeGradingTombstone(tx, resourceKey, now, { contentDeleted: false, workerClaimToken: claimToken, holdScopes: lineage.scopes });
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.run-retained', resourceType: 'GradingRun', resourceId: run.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', deleteStrategy: policy.deleteStrategy, lifecyclePolicyVersion: policy.version } });
      });
      if (!existingTombstone) tombstones += 1;
      continue;
    }
    await input.db.$transaction(async (tx: any) => {
      await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'GradingRun', resourceId: run.id, resourceKey, reason: 'retention-expired', checksum: run.inputHash, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: run.provider ?? run.policy?.provider ?? null, providerRequestId: run.providerRequestId ?? null, providerDeletionHandle: run.providerDeletionHandle ?? null, providerRetentionStartedAt: run.providerProcessedAt ?? run.providerRequestedAt ?? null, contentDeletedAt: existingTombstone?.contentDeletedAt ?? null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
    });
    const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey, resourceType: 'GradingRun', resourceId: run.id, scopes: lineage.scopes, now });
    if (!claimToken) { blocked += 1; continue; }
    await ensureGradingTombstoneObjects({ db: input.db, resourceKey, objectKeys: modelObjectKeys, claimToken, now });
    try { await runRetentionControlTransaction(input.db, async (tx: any) => {
      await assertRetentionCleanupClaim(tx, resourceKey, claimToken, lineage.scopes, now, { model: 'gradingRun', id: run.id, expiresAtField: 'retentionExpiresAt' });
      if (!(await casGradingRunContentUnavailable(tx, run.id, 'run-content-unavailable', now, run.state))) throw new Error('grading-run-content-unavailable-cas-lost');
      await tx.gradingCriterionAssessment.updateMany({ where: { gradingRunId: run.id }, data: { rationale: '[deleted-by-retention-policy]', teacherComment: null, teacherLevelId: null, teacherScore: null, teacherReviewedAt: null, confidence: 0, limitationState: 'content-deleted', updatedAt: now } });
      await tx.gradingAnnotation.updateMany({ where: { gradingRunId: run.id }, data: { excerpt: '[deleted-by-retention-policy]', comment: '[deleted-by-retention-policy]', pageNumber: null, spanStart: null, spanEnd: null, bbox: null } });
      await deleteDocumentRubricFactsForRuns(tx, [run.id]);
      await tx.gradingJob.updateMany({ where: { gradingRunId: run.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, data: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: 'retention-expired', updatedAt: now } });
      await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'GradingRun', resourceId: run.id, resourceKey, reason: 'retention-expired', checksum: run.inputHash, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: run.provider ?? run.policy?.provider ?? null, providerRequestId: run.providerRequestId ?? null, providerDeletionHandle: run.providerDeletionHandle ?? null, providerRetentionStartedAt: run.providerProcessedAt ?? run.providerRequestedAt ?? null, contentDeletedAt: existingTombstone?.contentDeletedAt ?? null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
      await writeLifecycleAudit(tx as never, { action: 'grading-retention.run-delete-intent', resourceType: 'GradingRun', resourceId: run.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', tombstonePending: !existingTombstone?.contentDeletedAt } });
    }); } catch (error) {
      if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
      if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
      throw error;
    }
    if (!existingTombstone) tombstones += 1;
    const providerRetention = await handleProviderRetention({ db: input.db, adapter: input.providerRetentionAdapter, resourceKey, resourceType: 'GradingRun', resourceId: run.id, claimToken, policy, holdScopes: lineage.scopes, now, preserveClaimOnFailure: true });
    const providerRetentionReady = providerRetention === 'ready';
    if (!providerRetentionReady) blocked += 1;
    let runFinalizationNow = await readRetentionDatabaseNow(input.db, now);
    if (!existingTombstone?.contentDeletedAt) {
      try {
        runFinalizationNow = await deleteGradingObjectsWithLease({ db: input.db, store: input.store, resourceKey, resourceType: 'GradingRun', resourceId: run.id, reason: 'run-content-unavailable', claimToken, objectKeys: modelObjectKeys, holdScopes: lineage.scopes, now });
      } catch (error) {
        if (isGradingPhysicalDeleteReconciledError(error)) { blocked += 1; continue; }
        if (!isObjectAlreadyGone(error)) {
          blocked += 1;
          await input.db.$transaction(async (tx: any) => {
            await markGradingTombstoneRetryable(tx, resourceKey, retentionErrorCode(error), claimToken);
            await writeLifecycleAudit(tx as never, { action: 'grading-retention.run-delete-failed', resourceType: 'GradingRun', resourceId: run.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', error: retentionErrorCode(error) } });
          });
          continue;
        }
      }
    }
    try {
      await input.db.$transaction(async (tx: any) => {
        await blockActiveBatchAssociations({ db: tx, where: { gradingRunId: run.id }, jobWhere: { gradingRunId: run.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, reason: 'run-content-unavailable', now: runFinalizationNow });
        await clearReverseGradingLineage({ db: tx, resourceType: 'GradingRun', resourceId: run.id, reason: 'run-content-unavailable', now: runFinalizationNow });
        await completeGradingTombstone(tx, resourceKey, runFinalizationNow, { pseudonymized: policy.deleteStrategy === 'pseudonymize-lineage', providerRetentionReady, workerClaimToken: claimToken, holdScopes: lineage.scopes });
        await tx.gradingRun.update({ where: { id: run.id }, data: { authorizationSnapshot: { version: 'grading-authorization.v1', classId: lineage.classId, assignmentId: lineage.assignmentId, assignmentRevisionId: lineage.assignmentRevisionId }, overallComment: '[deleted-by-retention-policy]', questionSnapshot: null, rubricSnapshot: null, referenceAnswer: null, policySnapshot: null, policySnapshotHash: null, answerAttemptId: null, answerEvidenceId: null, questionId: null, rubricId: null, batchId: null, limitations: [...new Set([...(run.limitations ?? []), 'content-deleted'])], modelInputObjectKey: null, modelOutputObjectKey: null, tombstonedAt: runFinalizationNow, updatedAt: runFinalizationNow } });
        await tx.gradingBatchItem?.updateMany?.({ where: { gradingRunId: run.id }, data: { answerId: null, attemptId: null, evidenceId: null, conversionId: null, gradingRunId: null, updatedAt: runFinalizationNow } });
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.run-redacted', resourceType: 'GradingRun', resourceId: run.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired' } });
      });
    } catch (error) {
      blocked += 1;
      await input.db.$transaction(async (tx: any) => {
        await markGradingTombstoneRetryable(tx, resourceKey, retentionErrorCode(error), claimToken);
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.run-delete-finalize-failed', resourceType: 'GradingRun', resourceId: run.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', error: retentionErrorCode(error) } });
      });
      continue;
    }
    deleted += 1;
    } catch (error) {
      if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
      if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
      throw error;
    }
  }
  let batches: any[] = [];
  if (input.db.gradingBatch?.findMany) {
    batches = await input.db.gradingBatch.findMany({ where: { tombstonedAt: null, OR: [{ retentionExpiresAt: { lte: now } }, { retentionExpiresAt: null }] }, select: { id: true, classId: true, assignmentRevisionId: true, questionId: true, lifecyclePolicyId: true, lifecyclePolicyVersion: true, lifecycleDeleteStrategy: true, lifecycleRetentionSeconds: true, lifecycleGovernedRecordRule: true, lifecycleProviderRetentionSeconds: true, retentionExpiresAt: true, policy: { select: { provider: true } } } });
    for (const batch of batches) {
      try {
      const lineage = await resolveGradingLineage({ db: input.db, resourceType: 'GradingBatch', resource: batch });
      const hold = await findActiveHold(input.db, lineage.scopes, now);
      if (hold) {
        held += 1;
        continue;
      }
      const policy = frozenPolicyForRecord(batch, 'ai-draft');
      if (!policy) {
        blocked += 1;
        await auditLegacyLifecycleBlocked(input.db, 'GradingBatch', batch.id, 'missing-or-invalid-lifecycle-policy', now);
        continue;
      }
      if (legacyLifecycleExpiryBlocked(batch, policy)) {
        blocked += 1;
        await auditLegacyLifecycleBlocked(input.db, 'GradingBatch', batch.id, 'missing-retention-expiry', now);
        continue;
      }
      const batchResourceKey = `batch:${batch.id}`;
      const existingTombstone = await findGradingTombstone(input.db, batchResourceKey);
      if (isGradingTombstoneTerminal(existingTombstone)) continue;
      if (policy.deleteStrategy === 'retain-governed-record') {
        await input.db.$transaction(async (tx: any) => {
          await tx.gradingBatch.update({ where: { id: batch.id }, data: { tombstonedAt: now, updatedAt: now } });
          await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${batchResourceKey}`, resourceType: 'GradingBatch', resourceId: batch.id, resourceKey: batchResourceKey, reason: 'retention-expired', checksum: null, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: batch.policy?.provider ?? null, providerRequestId: null, contentDeletedAt: null, lineageRetained: true, createdAt: now });
        });
        const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey: batchResourceKey, resourceType: 'GradingBatch', resourceId: batch.id, scopes: lineage.scopes, now });
        if (!claimToken) { blocked += 1; continue; }
        await input.db.$transaction(async (tx: any) => {
          await completeGradingTombstone(tx, batchResourceKey, now, { contentDeleted: false, workerClaimToken: claimToken, holdScopes: lineage.scopes });
          await writeLifecycleAudit(tx as never, { action: 'grading-retention.batch-retained', resourceType: 'GradingBatch', resourceId: batch.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired', deleteStrategy: policy.deleteStrategy, lifecyclePolicyVersion: policy.version } });
        });
        tombstones += 1;
        continue;
      }
      await input.db.$transaction(async (tx: any) => {
        await blockActiveBatchAssociations({ db: tx, where: { batchId: batch.id }, reason: 'batch-content-unavailable', now });
        await tx.gradingJob.updateMany({ where: { batchId: batch.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, data: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: 'retention-expired', updatedAt: now } });
        await tx.gradingBatchItem?.updateMany?.({ where: { batchId: batch.id, state: { not: 'SUCCEEDED' } }, data: { state: 'BLOCKED', failureCode: 'retention-expired', answerId: null, attemptId: null, evidenceId: null, conversionId: null, workerClaimToken: null, workerClaimedAt: null, updatedAt: now } });
        await tx.gradingBatch.update({ where: { id: batch.id }, data: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: 'retention-expired', tombstonedAt: now, updatedAt: now } });
        await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:batch:${batch.id}`, resourceType: 'GradingBatch', resourceId: batch.id, resourceKey: `batch:${batch.id}`, reason: 'retention-expired', checksum: null, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, provider: batch.policy?.provider ?? null, providerRequestId: null, contentDeletedAt: null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
        await writeLifecycleAudit(tx as never, { action: 'grading-retention.batch-deleted', resourceType: 'GradingBatch', resourceId: batch.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'retention-expired' } });
      });
      tombstones += existingTombstone ? 0 : 1;
      const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey: batchResourceKey, resourceType: 'GradingBatch', resourceId: batch.id, scopes: lineage.scopes, now });
      if (!claimToken) { blocked += 1; continue; }
      const providerRetention = await handleProviderRetention({ db: input.db, adapter: input.providerRetentionAdapter, resourceKey: batchResourceKey, resourceType: 'GradingBatch', resourceId: batch.id, claimToken, policy, holdScopes: lineage.scopes, now, preserveClaimOnFailure: true });
      const providerRetentionReady = providerRetention === 'ready';
      if (!providerRetentionReady) blocked += 1;
      const batchFinalizationNow = await readRetentionDatabaseNow(input.db, now);
      try {
        await input.db.$transaction(async (tx: any) => {
        await completeGradingTombstone(tx, batchResourceKey, batchFinalizationNow, { pseudonymized: policy.deleteStrategy === 'pseudonymize-lineage', providerRetentionReady, workerClaimToken: claimToken, holdScopes: lineage.scopes });
          await transitionParentRunsContentUnavailable(tx, { batchId: batch.id }, 'batch-content-unavailable', batchFinalizationNow);
          await clearReverseGradingLineage({ db: tx, resourceType: 'GradingBatch', resourceId: batch.id, reason: 'batch-content-unavailable', now: batchFinalizationNow });
          await tx.gradingBatch.update({ where: { id: batch.id }, data: { assignmentRevisionId: null, classId: null, questionSnapshot: null, rubricSnapshot: null, referenceAnswer: null, policySnapshot: null, conversionPolicySnapshot: null, policyId: null, conversionPolicyId: null, questionId: null, requesterUserId: null, state: 'CONTENT_UNAVAILABLE', lastErrorCode: 'batch-content-unavailable', tombstonedAt: batchFinalizationNow, updatedAt: batchFinalizationNow, questionSnapshotHash: `redacted:grading-question:${pseudonymizeGradingLineage(batch.id, 'question-hash')}`, dedupeKey: `redacted:grading-batch:${pseudonymizeGradingLineage(batch.id, 'dedupe-key')}`, idempotencyKey: `redacted:grading-request:${pseudonymizeGradingLineage(batch.id, 'request-key')}` } });
        });
      } catch (error) {
        blocked += 1;
        await markGradingTombstoneRetryable(input.db, batchResourceKey, retentionErrorCode(error), claimToken);
        continue;
      }
      deleted += 1;
      } catch (error) {
        if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
        if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
        throw error;
      }
    }
  }
  let textSnapshots: any[] = [];
  if (input.db.submissionAttempt?.findMany) {
    textSnapshots = await input.db.submissionAttempt.findMany({
      where: { textSnapshot: { not: null }, OR: [{ textSnapshotExpiresAt: { lte: now } }, { textSnapshotExpiresAt: null }] },
      select: { id: true, answerId: true, textSnapshot: true, textSnapshotPolicyId: true, textSnapshotPolicyVersion: true, textSnapshotDeleteStrategy: true, textSnapshotRetentionSeconds: true, textSnapshotGovernedRecordRule: true, textSnapshotProviderRetentionSeconds: true, textSnapshotExpiresAt: true },
    });
    for (const snapshot of textSnapshots) {
      try {
      const policy = frozenLifecyclePolicyFromRecord({
        lifecyclePolicyId: snapshot.textSnapshotPolicyId,
        lifecyclePolicyVersion: snapshot.textSnapshotPolicyVersion,
        lifecycleDeleteStrategy: snapshot.textSnapshotDeleteStrategy,
        lifecycleRetentionSeconds: snapshot.textSnapshotRetentionSeconds,
        lifecycleGovernedRecordRule: snapshot.textSnapshotGovernedRecordRule,
        lifecycleProviderRetentionSeconds: snapshot.textSnapshotProviderRetentionSeconds,
      }, 'answer-evidence');
      if (!policy || validateLifecyclePolicy(policy).length > 0) {
        blocked += 1;
        await auditLegacyLifecycleBlocked(input.db, 'SubmissionAttempt', snapshot.id, 'missing-or-invalid-text-snapshot-policy', now);
        continue;
      }
      if (legacyLifecycleExpiryBlocked({ retentionExpiresAt: snapshot.textSnapshotExpiresAt, lifecyclePolicyId: snapshot.textSnapshotPolicyId, lifecyclePolicyVersion: snapshot.textSnapshotPolicyVersion }, policy)) {
        blocked += 1;
        await auditLegacyLifecycleBlocked(input.db, 'SubmissionAttempt', snapshot.id, 'missing-text-snapshot-expiry', now);
        continue;
      }
      const lineage = await resolveGradingLineage({ db: input.db, resourceType: 'SubmissionAttempt', resource: { id: snapshot.id, attemptId: snapshot.id, answerId: snapshot.answerId } });
      if (await findActiveHold(input.db, lineage.scopes, now)) {
        held += 1;
        continue;
      }
      const resourceKey = `text-snapshot:${snapshot.id}`;
      const existingTombstone = await findGradingTombstone(input.db, resourceKey);
      if (isGradingTombstoneTerminal(existingTombstone)) continue;
      await runRetentionControlTransaction(input.db, async (tx: any) => {
        await ensureGradingTombstone(tx, { ...frozenLifecycleTombstoneFields(policy), id: `grading-tombstone:${resourceKey}`, resourceType: 'SubmissionAttempt', resourceId: snapshot.id, resourceKey, reason: 'text-snapshot-retention-expired', checksum: null, lifecyclePolicyId: policy.id, lifecyclePolicyVersion: policy.version, lifecycleDeleteStrategy: policy.deleteStrategy, lifecycleRetentionSeconds: policy.retentionSeconds ?? null, providerRetentionSeconds: policy.providerRetentionSeconds ?? 0, contentDeletedAt: null, lineageRetained: policy.deleteStrategy !== 'delete-content', createdAt: now });
      });
      const claimToken = await claimRetentionTombstone({ db: input.db, resourceKey, resourceType: 'SubmissionAttempt', resourceId: snapshot.id, scopes: lineage.scopes, now });
      if (!claimToken) { blocked += 1; continue; }
      if (policy.deleteStrategy === 'retain-governed-record') {
        await runRetentionControlTransaction(input.db, async (tx: any) => {
          await completeGradingTombstone(tx, resourceKey, now, { contentDeleted: false, workerClaimToken: claimToken, holdScopes: lineage.scopes });
          await writeLifecycleAudit(tx as never, { action: 'grading-retention.text-snapshot-retained', resourceType: 'SubmissionAttempt', resourceId: snapshot.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'text-snapshot-retention-expired', deleteStrategy: policy.deleteStrategy, lifecyclePolicyVersion: policy.version } });
        });
      } else {
        try { await runRetentionControlTransaction(input.db, async (tx: any) => {
          await assertRetentionCleanupClaim(tx, resourceKey, claimToken, lineage.scopes, now, { model: 'submissionAttempt', id: snapshot.id, expiresAtField: 'textSnapshotExpiresAt' });
          await transitionParentRunsContentUnavailable(tx, { answerAttemptId: snapshot.id }, 'text-snapshot-content-unavailable', now);
          await blockActiveBatchAssociations({ db: tx, where: { attemptId: snapshot.id }, jobWhere: { attemptId: snapshot.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, reason: 'text-snapshot-content-unavailable', now });
          await redactTextNativeEvidenceForAttempt(tx, snapshot.id, now);
          if (tx.submissionAttempt?.updateMany) {
            await tx.submissionAttempt.updateMany({ where: { id: snapshot.id, textSnapshot: { not: null }, textSnapshotExpiresAt: { lte: now }, textSnapshotPolicyId: { not: null }, textSnapshotPolicyVersion: { not: null }, textSnapshotDeleteStrategy: { in: ['delete-content', 'pseudonymize-lineage'] }, textSnapshotRetentionSeconds: { not: null }, OR: [{ textSnapshotGovernedRecordRule: null }, { textSnapshotGovernedRecordRule: '' }] }, data: { textSnapshot: null } });
          } else {
            await tx.submissionAttempt?.update?.({ where: { id: snapshot.id }, data: { textSnapshot: null } });
          }
          await completeGradingTombstone(tx, resourceKey, now, { pseudonymized: policy.deleteStrategy === 'pseudonymize-lineage', workerClaimToken: claimToken, holdScopes: lineage.scopes });
          await writeLifecycleAudit(tx as never, { action: 'grading-retention.text-snapshot-deleted', resourceType: 'SubmissionAttempt', resourceId: snapshot.id, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'text-snapshot-retention-expired', deleteStrategy: policy.deleteStrategy, lifecyclePolicyVersion: policy.version } });
        }); } catch (error) {
          if (isExpectedRetentionRace(error)) { if ((error as Error).message === 'grading-tombstone-hold') held += 1; else blocked += 1; continue; }
          if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') { blocked += 1; continue; }
          throw error;
        }
      }
      if (!existingTombstone) tombstones += 1;
      if (policy.deleteStrategy !== 'retain-governed-record') deleted += 1;
      } catch (error) {
        if (isExpectedRetentionRace(error)) {
          if ((error as Error).message === 'grading-tombstone-hold') held += 1;
          else blocked += 1;
          continue;
        }
        if (error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') {
          blocked += 1;
          continue;
        }
        throw error;
      }
    }
  }
  return { scanned: evidence.length + conversions.length + runs.length + batches.length + textSnapshots.length, deleted, held, blocked, tombstones };
}

export async function redactTextNativeEvidenceForAttempt(db: any, attemptId: string, now: Date): Promise<void> {
  const evidence = await db.answerEvidence?.findMany?.({ where: { attemptId, sourceKind: 'TEXT_NATIVE' }, select: { id: true, limitations: true } }) ?? [];
  const evidenceIds = evidence.map((row: any) => row.id);
  if (evidenceIds.length === 0) return;
  await db.answerEvidenceBlock?.updateMany?.({ where: { evidenceId: { in: evidenceIds } }, data: { text: '[deleted-by-retention-policy]', markdown: '[deleted-by-retention-policy]', spanStart: null, spanEnd: null, bbox: null, precision: 'PAGE', confidence: 0 } });
  for (const row of evidence) {
    await db.answerEvidence?.updateMany?.({ where: { id: row.id, attemptId, sourceKind: 'TEXT_NATIVE' }, data: { readiness: 'BLOCKED', lifecycleBlockedAt: now, lifecycleBlockReason: 'text-snapshot-content-unavailable', canonicalMarkdown: '[deleted-by-retention-policy]', sourceHash: `redacted:grading-evidence:${pseudonymizeGradingLineage(row.id, 'source-hash')}`, limitations: [...new Set([...(row.limitations ?? []), 'content-deleted'])], updatedAt: now } });
  }
}

async function deleteDocumentRubricFactsForRuns(db: any, runIds: string[]): Promise<void> {
  for (const runId of [...new Set(runIds.filter(Boolean))]) {
    const prefix = `adaptive-assessment:document-rubric-grading:${encodeURIComponent(runId)}:`;
    const facts = await db.learningFact?.findMany?.({ where: { factType: 'document_rubric_grading', sourceEventId: { startsWith: prefix } }, select: { userId: true, contextJson: true } }) ?? [];
    await db.learningFact?.deleteMany?.({ where: { factType: 'document_rubric_grading', sourceEventId: { startsWith: prefix } } });
    const users = [...new Set<string>(facts.map((fact: any) => fact.userId).filter((value: unknown): value is string => typeof value === 'string' && value.length > 0))];
    const classIds = [...new Set(facts.map((fact: any) => fact.contextJson?.classId).filter(Boolean))] as string[];
    await revokeDerivedLearningMaterializations(db, { userIds: users, classIds });
  }
}

export async function transitionParentRunsContentUnavailable(db: any, where: any, reason: string, now: Date): Promise<void> {
  const runs = await db.gradingRun?.findMany?.({ where, select: { id: true, state: true, answerEvidenceId: true, modelInputObjectKey: true, modelOutputObjectKey: true, lifecyclePolicyId: true, lifecyclePolicyVersion: true, lifecycleDeleteStrategy: true, lifecycleRetentionSeconds: true, lifecycleGovernedRecordRule: true, lifecycleProviderRetentionSeconds: true } }) ?? [];
  const runIds: string[] = [];
  for (const run of runs) {
    if (await casGradingRunContentUnavailable(db, run.id, reason, now, run.state, true)) runIds.push(run.id);
  }
  if (runIds.length === 0) return;
  await db.gradingRequestIdempotency?.deleteMany?.({ where: { resourceType: 'GradingRun', resourceId: { in: runIds } } });
}

const GRADING_RUN_CONTENT_STATES = ['AWAITING_REVIEW', 'APPROVED', 'QUEUED', 'RUNNING', 'BLOCKED', 'RETRYABLE'];
async function casGradingRunContentUnavailable(db: any, runId: string, reason: string, now: Date, knownState?: string, preserveContent = false): Promise<boolean> {
  if (knownState === 'CONTENT_UNAVAILABLE') {
    const current = db.gradingRun?.findUnique ? await db.gradingRun.findUnique({ where: { id: runId }, select: { state: true } }) : { state: knownState };
    return current?.state === 'CONTENT_UNAVAILABLE';
  }
  if (knownState && !GRADING_RUN_CONTENT_STATES.includes(knownState)) return false;
  if (!db.gradingRun?.updateMany) {
    if (!db.gradingRun?.update) return false;
    await db.gradingRun.update({ where: { id: runId }, data: contentUnavailableRunData(reason, now, preserveContent) });
    return true;
  }
  const result = await db.gradingRun.updateMany({ where: { id: runId, state: { in: GRADING_RUN_CONTENT_STATES } }, data: contentUnavailableRunData(reason, now, preserveContent) });
  return result.count === 1;
}

function contentUnavailableRunData(reason: string, now: Date, preserveContent: boolean) {
  if (preserveContent) {
    return {
      state: 'CONTENT_UNAVAILABLE',
      lifecycleBlockedAt: now,
      lifecycleBlockReason: reason,
      ...(reason.includes('evidence') || reason.includes('conversion') ? { answerEvidenceId: null } : {}),
      ...(reason.includes('batch') ? { batchId: null } : {}),
      updatedAt: now,
    };
  }
  return { state: 'CONTENT_UNAVAILABLE', lifecycleBlockedAt: now, lifecycleBlockReason: reason, overallComment: '[deleted-by-retention-policy]', questionSnapshot: null, rubricSnapshot: null, referenceAnswer: null, policySnapshot: null, modelInputObjectKey: null, modelOutputObjectKey: null, updatedAt: now };
}

async function blockActiveBatchAssociations(input: {
  db: MathGradingDb;
  where: Record<string, unknown>;
  jobWhere?: Record<string, unknown>;
  reason: string;
  now: Date;
}): Promise<void> {
  const activeStates = ['CONVERTING', 'GRADING'];
  const items = input.db.gradingBatchItem?.findMany
    ? await input.db.gradingBatchItem.findMany({ where: { ...input.where, state: { in: activeStates } }, select: { id: true, batchId: true } })
    : [];
  if (input.db.gradingBatchItem?.updateMany) {
    await input.db.gradingBatchItem.updateMany({
      where: { ...input.where, state: { in: activeStates } },
      data: { state: 'BLOCKED', failureCode: input.reason, workerClaimToken: null, workerClaimedAt: null, updatedAt: input.now },
    });
  }
  const batchIds = [...new Set(items.map((item: any) => item.batchId).filter((value: unknown): value is string => typeof value === 'string' && value.length > 0))];
  if (input.db.gradingJob?.updateMany) {
    const jobWhere = input.jobWhere ?? (input.where.batchId
      ? { batchId: input.where.batchId, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }
        : items.length > 0
          ? { batchItemId: { in: items.map((item: any) => item.id) }, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }
          : null);
    if (jobWhere) {
      await input.db.gradingJob.updateMany({
        where: jobWhere,
        data: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: input.reason, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: input.now },
      });
    }
  }
  if (batchIds.length > 0 && input.db.gradingBatch?.updateMany) {
    await input.db.gradingBatch.updateMany({
      where: { id: { in: batchIds }, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } },
      data: { state: 'BLOCKED', lastErrorCode: input.reason, updatedAt: input.now },
    });
  }
}

export async function enforceGradingQuota(input: {
  db: MathGradingDb;
  subjectType: 'user' | 'class' | 'provider';
  subjectId: string;
  scope: string;
  maxRequests: number;
  windowSeconds?: number;
  now?: Date;
}): Promise<{ allowed: boolean; requestCount: number; retryAfterSeconds: number | null }> {
  const now = input.now ?? new Date();
  const key = `grading-quota:${input.subjectType}:${input.subjectId}:${input.scope}`;
  const windowSeconds = input.windowSeconds ?? 60;
  if (!input.db.$transaction) throw new Error('grading-quota-transaction-required');
  return withSerializableTransaction(input.db, async (db) => {
    const row = await db.gradingQuota.findUnique({ where: { key } });
    if (row?.blockedUntil && row.blockedUntil > now) return { allowed: false, requestCount: row.requestCount, retryAfterSeconds: Math.ceil((row.blockedUntil.getTime() - now.getTime()) / 1000) };
    const fresh = !row || now.getTime() - row.windowStart.getTime() >= windowSeconds * 1000;
    const requestCount = fresh ? 1 : row.requestCount + 1;
    const allowed = requestCount <= input.maxRequests;
    const blockedUntil = allowed ? null : new Date(now.getTime() + windowSeconds * 1000);
    await db.gradingQuota.upsert({ where: { key }, create: { key, subjectType: input.subjectType, subjectId: input.subjectId, scope: input.scope, windowStart: now, requestCount, blockedUntil, updatedAt: now }, update: { windowStart: fresh ? now : row!.windowStart, requestCount, blockedUntil, updatedAt: now } });
    return { allowed, requestCount, retryAfterSeconds: allowed ? null : windowSeconds };
  });
}

export function canReadGradingArtifact(input: {
  actor: { id: string; role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SERVICE' };
  ownerStudentId: string;
  ownerClassId: string;
  requestedClassId?: string | null;
  classTeacherId?: string | null;
  assignmentAuthorId?: string | null;
  hasAssignmentReviewGrant?: boolean;
  artifactState: string;
  purpose: 'student-own' | 'teacher-review' | 'service';
}): boolean {
  if (input.purpose === 'service') return input.actor.role === 'SERVICE' || input.actor.role === 'ADMIN';
  if (input.actor.role === 'ADMIN') return true;
  if (input.purpose === 'student-own') return input.actor.role === 'STUDENT' && input.actor.id === input.ownerStudentId && input.artifactState === 'APPROVED';
  return input.actor.role === 'TEACHER'
    && Boolean(input.ownerClassId)
    && (input.requestedClassId ?? input.ownerClassId) === input.ownerClassId
    && (input.classTeacherId === input.actor.id || input.assignmentAuthorId === input.actor.id || input.hasAssignmentReviewGrant === true);
}

export function buildGradingOperationalMetrics(rows: Array<{ state: string; precision?: string | null; warningCodes?: string[]; latencyMs?: number | null; pseudonymized?: boolean; contentDeleted?: boolean; providerBlocked?: boolean }>) {
  const total = rows.length;
  const count = (state: string) => rows.filter((row) => row.state === state).length;
  return {
    total,
    queued: count('QUEUED'),
    running: count('RUNNING'),
    completed: count('SUCCEEDED'),
    awaitingReview: count('AWAITING_REVIEW'),
    blocked: count('BLOCKED'),
    failed: count('FAILED'),
    retryable: count('RETRYABLE'),
    governedRetained: count('RETAINED'),
    contentDeleted: rows.filter((row) => row.contentDeleted === true || row.state === 'DELETED').length,
    pseudonymized: rows.filter((row) => row.pseudonymized === true).length,
    providerBlocked: rows.filter((row) => row.providerBlocked === true || row.state === 'PROVIDER_BLOCKED').length,
    precision: {
      span: rows.filter((row) => row.precision === 'SPAN').length,
      block: rows.filter((row) => row.precision === 'BLOCK').length,
      page: rows.filter((row) => row.precision === 'PAGE').length,
    },
    warningCount: rows.reduce((sum, row) => sum + (row.warningCodes?.length ?? 0), 0),
    averageLatencyMs: average(rows.map((row) => row.latencyMs).filter((value): value is number => typeof value === 'number')),
  };
}

function findActiveHold(db: MathGradingDb, scopes: Array<[string, string]>, now: Date) {
  if (!db.gradingLegalHold?.findFirst || scopes.length === 0) return null;
  return db.gradingLegalHold.findFirst({ where: { OR: scopes.map(([scopeType, scopeId]) => ({ scopeType, scopeId })), releasedAt: null, AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }] } });
}

export async function hasActiveGradingHold(db: MathGradingDb, scopes: Array<[string, string]>, now: Date): Promise<boolean> {
  return Boolean(await findActiveHold(db, scopes, now));
}

async function persistLifecycleBlocked(db: MathGradingDb, resourceType: string, resourceId: string, reason: string, now: Date): Promise<void> {
  const modelByResource: Record<string, { model: any; data: Record<string, unknown> }> = {
    AnswerEvidence: { model: db.answerEvidence, data: { readiness: 'BLOCKED' } },
    DocumentConversion: { model: db.documentConversion, data: { state: 'BLOCKED' } },
    GradingRun: { model: db.gradingRun, data: { state: 'BLOCKED' } },
    GradingBatch: { model: db.gradingBatch, data: { state: 'BLOCKED' } },
    SubmissionAttempt: { model: db.submissionAttempt, data: {} },
  };
  const target = modelByResource[resourceType];
  if (!target?.model) throw new Error(`lifecycle-blocked-repository-unavailable:${resourceType}`);
  const data = { ...target.data, lifecycleBlockedAt: now, lifecycleBlockReason: reason, ...(resourceType === 'SubmissionAttempt' ? {} : { updatedAt: now }) };
  if (target.model.updateMany) {
    await target.model.updateMany({ where: { id: resourceId }, data });
    return;
  }
  if (target.model.update) {
    await target.model.update({ where: { id: resourceId }, data });
    return;
  }
  throw new Error(`lifecycle-blocked-repository-unavailable:${resourceType}`);
}

async function auditLegacyLifecycleBlocked(db: MathGradingDb, resourceType: string, resourceId: string, reason: string, now: Date): Promise<void> {
  const execute = async (tx: MathGradingDb) => {
    await persistLifecycleBlocked(tx, resourceType, resourceId, reason, now);
    await blockLifecycleAssociationsForResource({ db: tx, resourceType, resourceId, reason, now });
    await writeLifecycleAudit(tx, {
      action: 'grading-retention.legacy-blocked',
      resourceType,
      resourceId,
      actorId: 'grading-gc',
      actorRole: 'SERVICE',
      metadata: { reason },
    });
  };
  if (db.$transaction) {
    await db.$transaction(execute);
  } else {
    await execute(db);
  }
}

export async function blockLifecycleAssociationsForResource(input: {
  db: MathGradingDb;
  resourceType: string;
  resourceId: string;
  reason: string;
  now: Date;
}): Promise<void> {
  const itemModel = input.db.gradingBatchItem;
  const jobModel = input.db.gradingJob;
  const batchModel = input.db.gradingBatch;
  const itemStates = ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE'];
  const jobStates = ['QUEUED', 'RUNNING', 'RETRYABLE'];
  const itemRelation = {
    SubmissionAttempt: { attemptId: input.resourceId },
    AnswerEvidence: { evidenceId: input.resourceId },
    DocumentConversion: { conversionId: input.resourceId },
    GradingRun: { gradingRunId: input.resourceId },
    GradingBatch: { batchId: input.resourceId },
  }[input.resourceType];
  let relatedConversionIds: string[] = [];
  let relatedEvidenceIds: string[] = [];
  let relatedRunIds: string[] = [];
  let assetConversionIds: string[] = [];
  let assetEvidenceIds: string[] = [];
  if (input.resourceType === 'SubmissionAttempt') {
    relatedConversionIds = input.db.documentConversion?.findMany
      ? (await input.db.documentConversion.findMany({ where: { attemptId: input.resourceId }, select: { id: true } })).map((row: any) => row.id)
      : [];
    relatedEvidenceIds = input.db.answerEvidence?.findMany
      ? (await input.db.answerEvidence.findMany({ where: { attemptId: input.resourceId }, select: { id: true } })).map((row: any) => row.id)
      : [];
    relatedRunIds = input.db.gradingRun?.findMany
      ? (await input.db.gradingRun.findMany({ where: { answerAttemptId: input.resourceId }, select: { id: true } })).map((row: any) => row.id)
      : [];
  }
  if (input.resourceType === 'SubmissionAsset') {
    assetConversionIds = input.db.documentConversion?.findMany
      ? (await input.db.documentConversion.findMany({ where: { assetId: input.resourceId }, select: { id: true } })).map((row: any) => row.id)
      : [];
    assetEvidenceIds = input.db.answerEvidence?.findMany
      ? (await input.db.answerEvidence.findMany({ where: { sourceAssetId: input.resourceId }, select: { id: true } })).map((row: any) => row.id)
      : [];
    relatedConversionIds = assetConversionIds;
    relatedEvidenceIds = assetEvidenceIds;
    relatedRunIds = assetEvidenceIds.length > 0 && input.db.gradingRun?.findMany
      ? (await input.db.gradingRun.findMany({ where: { answerEvidenceId: { in: assetEvidenceIds } }, select: { id: true } })).map((row: any) => row.id)
      : [];
  }
  if (!itemRelation && input.resourceType !== 'SubmissionAsset') return;
  const itemRelations: Array<Record<string, unknown>> = [];
  if (itemRelation) itemRelations.push(itemRelation);
  if (relatedConversionIds.length > 0) itemRelations.push({ conversionId: { in: relatedConversionIds } });
  if (relatedEvidenceIds.length > 0) itemRelations.push({ evidenceId: { in: relatedEvidenceIds } });
  if (relatedRunIds.length > 0) itemRelations.push({ gradingRunId: { in: relatedRunIds } });
  const itemWhere = itemRelations.length === 1
    ? { ...itemRelations[0], state: { in: itemStates } }
    : { OR: itemRelations, state: { in: itemStates } };
  const items = itemWhere && itemModel?.findMany
    ? await itemModel.findMany({ where: itemWhere, select: { id: true, batchId: true } })
    : [];
  if (itemWhere && itemModel?.updateMany) {
    await itemModel.updateMany({ where: itemWhere, data: { state: 'BLOCKED', failureCode: input.reason, workerClaimToken: null, workerClaimedAt: null, updatedAt: input.now } });
  }
  if (input.resourceType === 'AnswerEvidence' && input.db.gradingRun?.findMany) {
    relatedRunIds = (await input.db.gradingRun.findMany({ where: { answerEvidenceId: input.resourceId }, select: { id: true } })).map((row: any) => row.id);
  }
  const itemIds = items.map((item: any) => item.id).filter(Boolean);
  const jobOr: Array<Record<string, unknown>> = [];
  if (input.resourceType === 'SubmissionAttempt') jobOr.push({ attemptId: input.resourceId });
  if (input.resourceType === 'DocumentConversion') jobOr.push({ conversionId: input.resourceId });
  if (input.resourceType === 'GradingRun') jobOr.push({ gradingRunId: input.resourceId });
  if (input.resourceType === 'GradingBatch') jobOr.push({ batchId: input.resourceId });
  if (input.resourceType === 'SubmissionAsset') {
    if (assetConversionIds.length > 0) jobOr.push({ conversionId: { in: assetConversionIds } });
  }
  if (relatedConversionIds.length > 0 && input.resourceType !== 'SubmissionAsset') jobOr.push({ conversionId: { in: relatedConversionIds } });
  if (relatedRunIds.length > 0) jobOr.push({ gradingRunId: { in: relatedRunIds } });
  if (itemIds.length > 0) jobOr.push({ batchItemId: { in: itemIds } });
  if (jobModel?.updateMany && jobOr.length > 0) {
    await jobModel.updateMany({ where: { OR: jobOr, state: { in: jobStates } }, data: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: input.reason, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, completedAt: input.now, updatedAt: input.now } });
  }
  const batchIds = [...new Set(items.map((item: any) => item.batchId).filter(Boolean))];
  if (input.resourceType === 'GradingBatch') batchIds.push(input.resourceId);
  if (batchIds.length > 0 && batchModel?.updateMany) {
    await batchModel.updateMany({ where: { id: { in: [...new Set(batchIds)] }, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, data: { state: 'BLOCKED', lastErrorCode: input.reason, updatedAt: input.now } });
  }
}

export async function clearReverseGradingLineage(input: { db: MathGradingDb; resourceType: string; resourceId: string; reason: string; now: Date }): Promise<void> {
  const addIds = (target: Set<string>, rows: any[]) => rows.forEach((row) => { if (typeof row?.id === 'string' && row.id) target.add(row.id); });
  const parentCascade = input.resourceType !== 'GradingRun';
  const runIds = new Set<string>();
  const itemIds = new Set<string>();
  const relationOr: Array<Record<string, unknown>> = [];
  const itemModel = input.db.gradingBatchItem;
  const runModel = input.db.gradingRun;
  const jobModel = input.db.gradingJob;
  const rerunModel = input.db.gradingRerun;

  if (input.resourceType === 'GradingRun') runIds.add(input.resourceId);
  if (input.resourceType === 'AnswerEvidence') relationOr.push({ evidenceId: input.resourceId });
  if (input.resourceType === 'DocumentConversion') relationOr.push({ conversionId: input.resourceId });
  if (input.resourceType === 'GradingRun') relationOr.push({ gradingRunId: input.resourceId });
  if (input.resourceType === 'GradingBatch') relationOr.push({ batchId: input.resourceId });
  if (input.resourceType === 'GradingBatch' && runModel?.findMany) addIds(runIds, await runModel.findMany({ where: { batchId: input.resourceId }, select: { id: true } }));
  if (input.resourceType === 'AnswerEvidence' && runModel?.findMany) addIds(runIds, await runModel.findMany({ where: { answerEvidenceId: input.resourceId }, select: { id: true } }));
  if (input.resourceType === 'AnswerEvidence' && input.db.answerEvidence?.updateMany) {
    await input.db.answerEvidence.updateMany({
      where: { id: input.resourceId },
      data: {
        sourceHash: `redacted:grading-evidence:${pseudonymizeGradingLineage(input.resourceId, 'source-hash')}`,
        attemptId: null,
        sourceAssetId: null,
        conversionId: null,
        lifecycleBlockedAt: input.now,
        lifecycleBlockReason: input.reason,
        canonicalMarkdown: '[deleted-by-retention-policy]',
        updatedAt: input.now,
      },
    });
  }
  if (input.resourceType === 'DocumentConversion' && input.db.answerEvidence?.findMany) {
    const evidenceRows = await input.db.answerEvidence.findMany({ where: { conversionId: input.resourceId }, select: { id: true } });
    const evidenceIds = evidenceRows.map((row: any) => row.id).filter(Boolean);
    if (evidenceIds.length > 0 && runModel?.findMany) addIds(runIds, await runModel.findMany({ where: { answerEvidenceId: { in: evidenceIds } }, select: { id: true } }));
    if (input.db.answerEvidence.updateMany) await input.db.answerEvidence.updateMany({ where: { conversionId: input.resourceId }, data: { sourceHash: `redacted:grading-evidence:${pseudonymizeGradingLineage(input.resourceId, 'conversion-evidence-hash')}`, attemptId: null, sourceAssetId: null, conversionId: null, readiness: 'BLOCKED', lifecycleBlockedAt: input.now, lifecycleBlockReason: input.reason, canonicalMarkdown: '[deleted-by-retention-policy]', updatedAt: input.now } });
  }
  if (input.resourceType === 'DocumentConversion' && input.db.documentConversion) {
    const data = {
      state: 'CONTENT_UNAVAILABLE',
      canonicalMarkdown: null,
      sourceChecksum: `redacted:conversion-source:${pseudonymizeGradingLineage(input.resourceId, 'source-checksum')}`,
      outputChecksum: null,
      renderedObjectKey: null,
      renderedChecksum: null,
      dedupeKey: `redacted:conversion:${pseudonymizeGradingLineage(input.resourceId, 'dedupe-key')}`,
      policySnapshot: null,
      policySnapshotHash: null,
      providerRequestId: null,
      assetId: null,
      attemptId: null,
      lifecycleBlockedAt: input.now,
      lifecycleBlockReason: input.reason,
      updatedAt: input.now,
    };
    if (input.db.documentConversion.updateMany) await input.db.documentConversion.updateMany({ where: { id: input.resourceId }, data });
    else await input.db.documentConversion.update?.({ where: { id: input.resourceId }, data });
  }

  if (itemModel?.findMany) {
    const itemRows = relationOr.length > 0 ? await itemModel.findMany({ where: { OR: relationOr }, select: { id: true } }) : [];
    addIds(itemIds, itemRows);
  }
  const itemWhere = relationOr.length > 0 || itemIds.size > 0
    ? { OR: [...relationOr, ...(itemIds.size > 0 ? [{ id: { in: [...itemIds] } }] : [])] }
    : null;
  if (itemWhere && itemModel?.updateMany) {
    const itemContentData = parentCascade
      ? { answerId: null, attemptId: null, evidenceId: null, conversionId: null, workerClaimToken: null, workerClaimedAt: null, updatedAt: input.now }
      : { answerId: null, attemptId: null, evidenceId: null, conversionId: null, gradingRunId: null, evidenceHash: null, inputHash: null, questionSnapshotHash: `redacted:grading-question:${pseudonymizeGradingLineage(input.resourceId, 'batch-question-hash')}`, workerClaimToken: null, workerClaimedAt: null, updatedAt: input.now };
    await itemModel.updateMany({ where: { ...itemWhere, state: { in: ['QUEUED', 'CONVERTING', 'GRADING', 'RETRYABLE'] } }, data: { ...(parentCascade ? { state: 'BLOCKED', failureCode: input.reason } : {}), ...itemContentData } });
    await itemModel.updateMany({ where: itemWhere, data: itemContentData });
  }

  if (runIds.size > 0 && runModel?.findMany) {
    const runs = await runModel.findMany({ where: { id: { in: [...runIds] } }, select: { id: true, state: true, inputHash: true, questionSnapshotHash: true, limitations: true } });
    for (const run of runs) {
      const runData = parentCascade
        ? {
          answerAttemptId: null,
          answerEvidenceId: null,
          batchId: null,
          lifecycleBlockedAt: input.now,
          lifecycleBlockReason: input.reason,
          updatedAt: input.now,
        }
        : {
          answerAttemptId: null,
          answerEvidenceId: null,
          batchId: null,
          questionId: null,
          rubricId: null,
          policyId: null,
          questionSnapshot: null,
          rubricSnapshot: null,
          referenceAnswer: null,
          policySnapshot: null,
          policySnapshotHash: null,
          modelInputObjectKey: null,
          modelOutputObjectKey: null,
          inputHash: `redacted:grading-input:${pseudonymizeGradingLineage(String(run.inputHash ?? run.id), 'input-hash')}`,
          questionSnapshotHash: `redacted:grading-question:${pseudonymizeGradingLineage(String(run.questionSnapshotHash ?? run.id), 'question-hash')}`,
          idempotencyKey: `redacted:grading-request:${pseudonymizeGradingLineage(String(run.id), 'request-key')}`,
          dedupeKey: `redacted:grading-run:${pseudonymizeGradingLineage(String(run.id), 'dedupe-key')}`,
          rerunIdentity: null,
          rerunReason: 'content-unavailable',
          limitations: [...new Set([...(run.limitations ?? []), 'content-deleted'])],
          tombstonedAt: input.now,
          updatedAt: input.now,
        };
      if (runModel.update) await runModel.update({ where: { id: run.id }, data: runData });
      else if (runModel.updateMany) await runModel.updateMany({ where: { id: run.id }, data: runData });
      await input.db.gradingCriterionAssessment?.updateMany?.({ where: { gradingRunId: run.id }, data: { rationale: '[deleted-by-retention-policy]', confidence: 0, limitationState: 'content-deleted', updatedAt: input.now } });
      await input.db.gradingAnnotation?.updateMany?.({ where: { gradingRunId: run.id }, data: { excerpt: '[deleted-by-retention-policy]', comment: '[deleted-by-retention-policy]', blockId: null, pageNumber: null, spanStart: null, spanEnd: null, bbox: null } });
    }
  }

  const jobOr: Array<Record<string, unknown>> = [];
  if (input.resourceType === 'DocumentConversion') jobOr.push({ conversionId: input.resourceId });
  if (input.resourceType === 'GradingRun') jobOr.push({ gradingRunId: input.resourceId });
  if (input.resourceType === 'GradingBatch') jobOr.push({ batchId: input.resourceId });
  if (runIds.size > 0) jobOr.push({ gradingRunId: { in: [...runIds] } });
  if (itemIds.size > 0) jobOr.push({ batchItemId: { in: [...itemIds] } });
  const relatedJobIds = jobModel?.findMany && jobOr.length > 0
    ? (await jobModel.findMany({ where: { OR: jobOr }, select: { id: true } })).map((row: any) => row.id).filter(Boolean)
    : [];
  const jobWhere = jobOr.length > 0 ? { OR: jobOr } : null;
  if (jobWhere && jobModel?.updateMany) {
    const jobContentData = parentCascade
      ? { state: 'CONTENT_UNAVAILABLE', lastErrorCode: input.reason, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, attemptId: null, conversionId: null, batchId: null, batchItemId: null, gradingRunId: null, policyId: null, updatedAt: input.now }
      : { state: 'CONTENT_UNAVAILABLE', lastErrorCode: input.reason, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, attemptId: null, conversionId: null, batchId: null, batchItemId: null, gradingRunId: null, policyId: null, idempotencyKey: null, rerunIdentity: null, updatedAt: input.now };
    await jobModel.updateMany({ where: { ...jobWhere, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, data: jobContentData });
    const jobDetachedData = parentCascade
      ? { attemptId: null, conversionId: null, batchId: null, batchItemId: null, gradingRunId: null, policyId: null, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: input.now }
      : { attemptId: null, conversionId: null, batchId: null, batchItemId: null, gradingRunId: null, policyId: null, idempotencyKey: null, rerunIdentity: null, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: input.now };
    await jobModel.updateMany({ where: jobWhere, data: jobDetachedData });
    if (jobModel.update && !parentCascade) {
      for (const jobId of relatedJobIds) {
        await jobModel.update({ where: { id: jobId }, data: { dedupeKey: `redacted:grading-job:${pseudonymizeGradingLineage(String(jobId), 'job-dedupe')}`, updatedAt: input.now } });
      }
    }
  }

  if (rerunModel?.findMany && jobWhere) {
    const rerunOr: Array<Record<string, unknown>> = [];
    if (input.resourceType === 'GradingBatch') rerunOr.push({ batchId: input.resourceId });
    if (runIds.size > 0) rerunOr.push({ gradingRunId: { in: [...runIds] } });
    if (relatedJobIds.length > 0) rerunOr.push({ gradingJobId: { in: relatedJobIds } });
    if (rerunOr.length > 0) {
      const reruns = await rerunModel.findMany({ where: { OR: rerunOr }, select: { id: true } });
      for (const rerun of reruns) {
        await rerunModel.update?.({ where: { id: rerun.id }, data: parentCascade
          ? { batchId: null, gradingRunId: null, gradingJobId: null, reason: 'content-unavailable', updatedAt: input.now }
          : { batchId: null, gradingRunId: null, gradingJobId: null, rerunIdentity: `redacted:grading-rerun:${pseudonymizeGradingLineage(String(rerun.id), 'rerun')}`, idempotencyKey: `redacted:grading-rerun-request:${pseudonymizeGradingLineage(String(rerun.id), 'request-key')}`, reason: 'content-unavailable', updatedAt: input.now } });
      }
    }
  }

  if (input.resourceType === 'GradingBatch' && input.db.gradingBatch) {
    const data = {
      assignmentRevisionId: null,
      classId: null,
      questionId: null,
      requesterUserId: null,
      policyId: null,
      conversionPolicyId: null,
      questionSnapshot: null,
      rubricSnapshot: null,
      referenceAnswer: null,
      policySnapshot: null,
      conversionPolicySnapshot: null,
      questionSnapshotHash: `redacted:grading-question:${pseudonymizeGradingLineage(input.resourceId, 'batch-question-hash')}`,
      dedupeKey: `redacted:grading-batch:${pseudonymizeGradingLineage(input.resourceId, 'batch-dedupe-key')}`,
      idempotencyKey: `redacted:grading-request:${pseudonymizeGradingLineage(input.resourceId, 'batch-request-key')}`,
      state: 'CONTENT_UNAVAILABLE',
      lastErrorCode: input.reason,
      lifecycleBlockedAt: input.now,
      lifecycleBlockReason: input.reason,
      tombstonedAt: input.now,
      updatedAt: input.now,
    };
    if (input.db.gradingBatch.updateMany) await input.db.gradingBatch.updateMany({ where: { id: input.resourceId }, data });
    else await input.db.gradingBatch.update?.({ where: { id: input.resourceId }, data });
  }
}

function sourceDerivedObjectKeys(row: any): string[] {
  return [...new Set([
    row.conversion?.renderedObjectKey,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function isGradingTombstoneTerminal(tombstone: any): boolean {
  return tombstone?.status === 'DELETED'
    || tombstone?.status === 'RETAINED'
    || (tombstone?.status === 'DELETED_WITH_HOLD' && tombstone?.contentDeletedAt);
}

async function listGradingTombstoneObjects(db: MathGradingDb, resourceKey: string): Promise<any[]> {
  if (!db.gradingTombstoneObject?.findMany) return [];
  const tombstone = await findGradingTombstone(db, resourceKey);
  if (!tombstone?.id) return [];
  return db.gradingTombstoneObject.findMany({ where: { tombstoneId: tombstone.id } });
}

async function ensureGradingTombstoneObjects(input: { db: MathGradingDb; resourceKey: string; objectKeys: string[]; claimToken: string; now: Date }): Promise<void> {
  const model = input.db.gradingTombstoneObject;
  if (!model?.findMany || !model?.create) return;
  const tombstone = await findGradingTombstone(input.db, input.resourceKey);
  if (!tombstone?.id) throw new Error('grading-tombstone-object-parent-missing');
  const objectKeys = [...new Set(input.objectKeys)];
  const existingRows = objectKeys.length === 0
    ? await model.findMany({ where: { tombstoneId: tombstone.id } })
    : await model.findMany({ where: { tombstoneId: tombstone.id, objectKey: { in: objectKeys } } });
  if (objectKeys.length === 0) {
    for (const existing of existingRows) {
      if (!['DELETED', 'DELETED_WITH_HOLD'].includes(String(existing.status))) await model.updateMany?.({ where: { tombstoneId: tombstone.id, objectKey: existing.objectKey, status: { in: ['PENDING', 'RETRYABLE'] } }, data: { status: 'PENDING', deletionClaimToken: input.claimToken, lastErrorCode: null, updatedAt: input.now } });
    }
    return;
  }
  for (const objectKey of objectKeys) {
    const existing = existingRows.find((row: any) => row.objectKey === objectKey);
    if (!existing) {
      await model.create({ data: { tombstoneId: tombstone.id, objectKey, status: 'PENDING', deletionClaimToken: input.claimToken, createdAt: input.now, updatedAt: input.now } });
      continue;
    }
    if (['DELETED', 'DELETED_WITH_HOLD'].includes(String(existing.status))) continue;
    if (model.updateMany) {
      await model.updateMany({ where: { tombstoneId: tombstone.id, objectKey, status: { in: ['PENDING', 'RETRYABLE'] } }, data: { status: 'PENDING', deletionClaimToken: input.claimToken, lastErrorCode: null, updatedAt: input.now } });
    }
  }
}

async function pendingGradingTombstoneObjectKeys(input: { db: MathGradingDb; resourceKey: string; objectKeys: string[] }): Promise<string[]> {
  const rows = await listGradingTombstoneObjects(input.db, input.resourceKey);
  if (rows.length === 0) return [...new Set(input.objectKeys)];
  if (input.objectKeys.length === 0) return rows.filter((row) => !['DELETED', 'DELETED_WITH_HOLD'].includes(String(row.status))).map((row) => row.objectKey);
  const completed = new Set(rows.filter((row) => ['DELETED', 'DELETED_WITH_HOLD'].includes(String(row.status))).map((row) => row.objectKey));
  return [...new Set(input.objectKeys)].filter((objectKey) => !completed.has(objectKey));
}

async function markGradingTombstoneObjectDeleted(input: { db: MathGradingDb; resourceKey: string; objectKey: string; claimToken: string; now: Date }): Promise<boolean> {
  const model = input.db.gradingTombstoneObject;
  if (!model?.updateMany) return true;
  const tombstone = await findGradingTombstone(input.db, input.resourceKey);
  if (!tombstone?.id) return false;
  const existing = (await model.findMany?.({ where: { tombstoneId: tombstone.id, objectKey: input.objectKey } }))?.[0];
  if (existing && ['DELETED', 'DELETED_WITH_HOLD'].includes(String(existing.status))) return true;
  const result = await model.updateMany({
    where: { tombstoneId: tombstone.id, objectKey: input.objectKey, status: { in: ['PENDING', 'RETRYABLE'] }, deletionClaimToken: input.claimToken },
    data: { status: 'DELETED', physicalDeletedAt: input.now, deletedAt: input.now, deletionClaimToken: null, lastErrorCode: null, updatedAt: input.now },
  });
  return result?.count === undefined ? Boolean(result) : result.count === 1;
}

async function markGradingTombstoneObjectRetryable(input: { db: MathGradingDb; resourceKey: string; objectKey: string; claimToken: string; errorCode: string; now: Date }): Promise<void> {
  const model = input.db.gradingTombstoneObject;
  if (!model?.updateMany) return;
  const tombstone = await findGradingTombstone(input.db, input.resourceKey);
  if (!tombstone?.id) throw new Error('grading-tombstone-object-parent-missing');
  await model.updateMany({
    where: { tombstoneId: tombstone.id, objectKey: input.objectKey, status: { in: ['PENDING', 'RETRYABLE'] }, deletionClaimToken: input.claimToken },
    data: { status: 'RETRYABLE', retryCount: { increment: 1 }, deletionClaimToken: null, lastErrorCode: input.errorCode, updatedAt: input.now },
  });
}

async function updateGradingResourceContentUnavailable(input: { db: MathGradingDb; resourceType: string; resourceId: string; reason: string; now: Date }): Promise<void> {
  await blockLifecycleAssociationsForResource({ db: input.db, resourceType: input.resourceType, resourceId: input.resourceId, reason: input.reason, now: input.now });
  const dataByType: Record<string, Record<string, unknown>> = {
    AnswerEvidence: { readiness: 'BLOCKED', lifecycleBlockedAt: input.now, lifecycleBlockReason: input.reason, updatedAt: input.now },
    DocumentConversion: { state: 'CONTENT_UNAVAILABLE', failureCode: input.reason, lifecycleBlockedAt: input.now, lifecycleBlockReason: input.reason, updatedAt: input.now },
    GradingRun: { state: 'CONTENT_UNAVAILABLE', lifecycleBlockedAt: input.now, lifecycleBlockReason: input.reason, updatedAt: input.now },
    GradingBatch: { state: 'CONTENT_UNAVAILABLE', lastErrorCode: input.reason, lifecycleBlockedAt: input.now, lifecycleBlockReason: input.reason, updatedAt: input.now },
  };
  const data = dataByType[input.resourceType];
  const model = input.db[resourceModelName(input.resourceType)];
  if (!data || !model) return;
  if (model.updateMany) await model.updateMany({ where: { id: input.resourceId }, data });
  else if (model.update) await model.update({ where: { id: input.resourceId }, data });
}

function resourceModelName(resourceType: string): string {
  return ({ AnswerEvidence: 'answerEvidence', DocumentConversion: 'documentConversion', GradingRun: 'gradingRun', GradingBatch: 'gradingBatch' } as Record<string, string>)[resourceType] ?? '';
}

export async function reconcileGradingPhysicalDelete(input: {
  db: MathGradingDb;
  resourceKey: string;
  resourceType: string;
  resourceId: string;
  objectKey: string;
  physicalDeletedAt: Date;
  reason: string;
  now?: Date;
}): Promise<void> {
  const now = input.now ?? input.physicalDeletedAt;
  const tombstone = await findGradingTombstone(input.db, input.resourceKey);
  if (!tombstone) throw new Error('grading-tombstone-reconciliation-parent-missing');
  const storageResourceKey = typeof tombstone.resourceKey === 'string' ? tombstone.resourceKey : input.resourceKey;
  const aggregatePhysicalDeletedAt = tombstone.physicalDeletedAt ?? input.physicalDeletedAt;
  const data = {
    status: 'DELETED_WITH_HOLD',
    physicalDeletedAt: aggregatePhysicalDeletedAt,
    deletionClaimToken: null,
    deletionClaimedAt: null,
    deletionLeaseExpiresAt: null,
    lastErrorCode: 'deleted-with-hold',
  };
  if (input.db.gradingTombstone?.updateMany) {
    const result = await input.db.gradingTombstone.updateMany({ where: { resourceKey: storageResourceKey, status: { in: ['PENDING', 'RETRYABLE', 'BLOCKED', 'DELETED_WITH_HOLD'] } }, data });
    if (result?.count === 0) {
      const latest = await findGradingTombstone(input.db, input.resourceKey);
      if (!latest || !['DELETED', 'DELETED_WITH_HOLD'].includes(String(latest.status))) throw new Error('grading-tombstone-reconciliation-fenced');
    }
  } else if (input.db.gradingTombstone?.update) {
    await input.db.gradingTombstone.update({ where: { resourceKey: storageResourceKey }, data });
  } else {
    throw new Error('grading-tombstone-repository-unavailable');
  }
  const objectModel = input.db.gradingTombstoneObject;
  if (objectModel?.updateMany && tombstone.id) {
    await objectModel.updateMany({
      where: { tombstoneId: tombstone.id, objectKey: input.objectKey, status: { in: ['PENDING', 'RETRYABLE', 'DELETED', 'DELETED_WITH_HOLD'] } },
      data: { status: 'DELETED_WITH_HOLD', physicalDeletedAt: input.physicalDeletedAt, deletedAt: input.physicalDeletedAt, deletionClaimToken: null, lastErrorCode: 'deleted-with-hold', updatedAt: now },
    });
  }
  await updateGradingResourceContentUnavailable({ db: input.db, resourceType: input.resourceType, resourceId: input.resourceId, reason: input.reason, now });
  await writeLifecycleAudit(input.db, {
    action: 'grading-retention.physical-delete-with-hold',
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    actorId: 'grading-gc',
    actorRole: 'SERVICE',
    metadata: { objectKey: input.objectKey, outcome: 'DELETED_WITH_HOLD', errorCode: 'deleted-with-hold', reason: input.reason },
  });
}

class GradingPhysicalDeleteReconciledError extends Error {
  constructor() {
    super('grading-physical-delete-reconciled');
    this.name = 'GradingPhysicalDeleteReconciledError';
  }
}

function isGradingPhysicalDeleteReconciledError(error: unknown): boolean {
  return error instanceof GradingPhysicalDeleteReconciledError || (error instanceof Error && error.message === 'grading-physical-delete-reconciled');
}

async function claimRetentionTombstone(input: {
  db: MathGradingDb;
  resourceKey: string;
  resourceType: string;
  resourceId: string;
  scopes: Array<[string, string]>;
  now: Date;
}): Promise<string | null> {
  const claimToken = randomUUID();
  const claimed = await claimGradingTombstone({
    db: input.db,
    resourceKey: input.resourceKey,
    claimToken,
    now: input.now,
    holdScopes: input.scopes,
  });
  if (!claimed) {
    await writeLifecycleAudit(input.db, {
      action: 'grading-retention.claim-blocked',
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      actorId: 'grading-gc',
      actorRole: 'SERVICE',
      metadata: { reason: 'lease-or-hold' },
    }).catch(() => undefined);
    return null;
  }
  return claimToken;
}

export async function assertRetentionCleanupClaim(db: MathGradingDb, resourceKey: string, claimToken: string, scopes: Array<[string, string]>, now: Date, eligibility?: { model: string; id: string; expiresAtField: string }): Promise<void> {
  const transactionNow = await readRetentionDatabaseNow(db, now);
  if (eligibility) {
    const model = (db as any)[eligibility.model];
    if (typeof model?.findUnique === 'function') {
      const current = await model.findUnique({ where: { id: eligibility.id }, select: { [eligibility.expiresAtField]: true } });
      const expiresAt = current?.[eligibility.expiresAtField];
      if (!current || !expiresAt || new Date(expiresAt) > transactionNow) throw new Error('grading-retention-not-expired');
    }
  }
  if (await findActiveHold(db, scopes, transactionNow)) throw new Error('grading-tombstone-hold');
  if (!(await renewGradingTombstoneLease({ db, resourceKey, claimToken, now: transactionNow, holdScopes: scopes }))) throw new Error('grading-tombstone-claim-lost');
  const postRenewNow = await readRetentionDatabaseNow(db, transactionNow);
  if (!(await renewGradingTombstoneLease({ db, resourceKey, claimToken, now: postRenewNow, holdScopes: scopes }))) throw new Error('grading-tombstone-claim-lost');
  if (await findActiveHold(db, scopes, postRenewNow)) throw new Error('grading-tombstone-hold');
}

async function readRetentionDatabaseNow(db: MathGradingDb, fallback: Date): Promise<Date> {
  if (typeof (db as any).$queryRaw !== 'function') return fallback;
  const rows = await (db as any).$queryRaw(Prisma.sql`SELECT clock_timestamp() AS "now"`);
  const value = Array.isArray(rows) ? rows[0]?.now : null;
  const parsed = value instanceof Date ? value : new Date(value ?? fallback);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export async function hasActiveGradingHoldAtDatabaseNow(
  db: MathGradingDb,
  scopes: Array<[string, string]>,
  fallback: Date,
): Promise<boolean> {
  const databaseNow = await readRetentionDatabaseNow(db, fallback);
  return hasActiveGradingHold(db, scopes, databaseNow);
}

export function isExpectedRetentionRace(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return message === 'grading-tombstone-hold' || message === 'grading-tombstone-claim-lost' || message === 'grading-retention-not-expired';
}

export async function runRetentionControlTransaction<T>(db: MathGradingDb, callback: (tx: MathGradingDb) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.$transaction(callback, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!(error && typeof error === 'object' && (error as { code?: unknown }).code === 'P2034') || attempt === 1) throw error;
    }
  }
  throw new Error('retention-control-transaction-unreachable');
}

async function deleteGradingObjectsWithLease(input: { db: MathGradingDb; store: SubmissionObjectStore; resourceKey: string; resourceType: string; resourceId: string; reason: string; claimToken: string; objectKeys: string[]; holdScopes?: Array<[string, string]>; now: Date }): Promise<Date> {
  await ensureGradingTombstoneObjects({ db: input.db, resourceKey: input.resourceKey, objectKeys: input.objectKeys, claimToken: input.claimToken, now: input.now });
  const objectKeys = await pendingGradingTombstoneObjectKeys({ db: input.db, resourceKey: input.resourceKey, objectKeys: input.objectKeys });
  if (objectKeys.length === 0) return readRetentionDatabaseNow(input.db, input.now);
  const heartbeat = startGradingTombstoneLeaseHeartbeat({ db: input.db, resourceKey: input.resourceKey, claimToken: input.claimToken, holdScopes: input.holdScopes });
  let reconciled = false;
  let completedAt: Date | null = null;
  try {
    await deleteGradingObjectsIndependently({
      store: input.store,
      objectKeys,
      readDeletedAt: () => readRetentionDatabaseNow(input.db, input.now),
      assertOwnership: async () => !heartbeat.isLost() && await renewGradingTombstoneLease({ db: input.db, resourceKey: input.resourceKey, claimToken: input.claimToken, holdScopes: input.holdScopes }),
      onObjectDeleted: async ({ objectKey, physicalDeletedAt }) => {
        completedAt = physicalDeletedAt;
        const recorded = await markGradingTombstoneObjectDeleted({ db: input.db, resourceKey: input.resourceKey, objectKey, claimToken: input.claimToken, now: physicalDeletedAt });
        if (!recorded) {
          await reconcileGradingPhysicalDelete({ db: input.db, resourceKey: input.resourceKey, resourceType: input.resourceType, resourceId: input.resourceId, objectKey, physicalDeletedAt, reason: 'claim-lost-after-physical-delete', now: physicalDeletedAt });
          reconciled = true;
          throw new GradingPhysicalDeleteReconciledError();
        }
      },
      onObjectError: async ({ objectKey, error }) => {
        await markGradingTombstoneObjectRetryable({ db: input.db, resourceKey: input.resourceKey, objectKey, claimToken: input.claimToken, errorCode: retentionErrorCode(error), now: input.now });
      },
      onOwnershipLost: async ({ objectKey, physicalDeletedAt }) => {
        let hold = false;
        if (input.holdScopes) {
          try {
            hold = await hasActiveGradingHoldAtDatabaseNow(input.db, input.holdScopes, input.now);
          } catch {
            hold = false;
          }
        }
        await reconcileGradingPhysicalDelete({ db: input.db, resourceKey: input.resourceKey, resourceType: input.resourceType, resourceId: input.resourceId, objectKey, physicalDeletedAt, reason: hold ? 'legal-hold-observed-after-physical-delete' : 'claim-lost-after-physical-delete', now: physicalDeletedAt });
        reconciled = true;
      },
    });
  } catch (error) {
    if (reconciled) throw new GradingPhysicalDeleteReconciledError();
    throw error;
  } finally {
    heartbeat.stop();
  }
  return completedAt ?? readRetentionDatabaseNow(input.db, input.now);
}

function frozenLifecycleTombstoneFields(policy: LifecyclePolicyInput): Record<string, unknown> {
  return {
    lifecycleGovernedRecordRule: policy.governedRecordRule?.trim() || null,
    providerRetentionSeconds: policy.providerRetentionSeconds ?? 0,
  };
}

async function handleProviderRetention(input: {
  db: MathGradingDb;
  adapter?: ProviderRetentionAdapter;
  resourceKey: string;
  resourceType: string;
  resourceId: string;
  claimToken: string;
  policy: LifecyclePolicyInput;
  holdScopes?: Array<[string, string]>;
  now: Date;
  preserveClaimOnFailure?: boolean;
}): Promise<'ready' | 'blocked' | 'retryable'> {
  const failureData = (status: 'BLOCKED' | 'RETRYABLE', data: Record<string, unknown>) => ({
    status: input.preserveClaimOnFailure ? 'PENDING' : status,
    ...data,
    ...(input.preserveClaimOnFailure ? {} : { deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null }),
  });
  const tombstone = await findGradingTombstone(input.db, input.resourceKey);
  const seconds = tombstone?.providerRetentionSeconds;
  if (!Number.isInteger(seconds) || seconds < 0) {
    await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, failureData('BLOCKED', {
      providerDeletionState: 'BLOCKED',
      providerDeletionReason: 'provider-retention-not-frozen',
      providerDeletionRequestedAt: null,
      lastErrorCode: 'provider-retention-not-frozen',
    }));
    await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-blocked', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'provider-retention-not-frozen' } });
    return 'blocked';
  }
  if (seconds <= 0) return 'ready';
  const provider = typeof tombstone?.provider === 'string' ? tombstone.provider.trim() : '';
  const providerRequestId = typeof tombstone?.providerRequestId === 'string' ? tombstone.providerRequestId.trim() : '';
  const deletionHandle = typeof tombstone?.providerDeletionHandle === 'string' ? tombstone.providerDeletionHandle.trim() : '';
  if (!provider || (!providerRequestId && !deletionHandle)) {
    await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, failureData('BLOCKED', {
      providerDeletionState: 'BLOCKED',
      providerDeletionReason: 'provider-deletion-handle-unavailable',
      providerDeletionRequestedAt: null,
      lastErrorCode: 'provider-deletion-handle-unavailable',
    }));
    await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-blocked', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'provider-deletion-handle-unavailable' } });
    return 'blocked';
  }
  const providerRetentionStartedAt = tombstone?.providerRetentionStartedAt ? new Date(tombstone.providerRetentionStartedAt) : null;
  if (!providerRetentionStartedAt || Number.isNaN(providerRetentionStartedAt.getTime())) {
    await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, failureData('BLOCKED', {
      providerDeletionState: 'BLOCKED',
      providerDeletionReason: 'provider-retention-start-time-missing',
      providerDeletionRequestedAt: null,
      lastErrorCode: 'provider-retention-start-time-missing',
    }));
    await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-blocked', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'provider-retention-start-time-missing' } });
    return 'blocked';
  }
  const deadline = new Date(providerRetentionStartedAt.getTime() + seconds * 1000);
  const persistedDeadline = tombstone?.providerRetentionDeadlineAt ? new Date(tombstone.providerRetentionDeadlineAt) : deadline;
  if (tombstone?.providerRetentionDeadlineAt && (Number.isNaN(persistedDeadline.getTime()) || persistedDeadline.getTime() !== deadline.getTime())) {
    await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, failureData('BLOCKED', {
      providerRetentionDeadlineAt: deadline,
      providerDeletionState: 'BLOCKED',
      providerDeletionReason: 'provider-retention-deadline-mismatch',
      providerDeletionRequestedAt: null,
      lastErrorCode: 'provider-retention-deadline-mismatch',
    }));
    await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-blocked', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'provider-retention-deadline-mismatch' } });
    return 'blocked';
  }
  if (!input.adapter) {
    await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, failureData('BLOCKED', {
      providerRetentionDeadlineAt: persistedDeadline,
      providerDeletionState: 'BLOCKED',
      providerDeletionReason: 'provider-deletion-api-unavailable',
      providerDeletionRequestedAt: null,
      lastErrorCode: 'provider-deletion-api-unavailable',
    }));
    await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-blocked', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'provider-deletion-api-unavailable' } });
    return 'blocked';
  }
  if (input.now < persistedDeadline) {
    await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, failureData('BLOCKED', {
      providerRetentionDeadlineAt: persistedDeadline,
      providerDeletionState: 'WAITING',
      providerDeletionReason: 'provider-retention-deadline-not-reached',
      providerDeletionRequestedAt: null,
      lastErrorCode: 'provider-retention-deadline-not-reached',
    }));
    await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-blocked', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: 'provider-retention-deadline-not-reached' } });
    return 'blocked';
  }
  const leaseAbortController = new AbortController();
  const leaseHeartbeat = startGradingTombstoneLeaseHeartbeat({ db: input.db, resourceKey: input.resourceKey, claimToken: input.claimToken, holdScopes: input.holdScopes, onLost: () => leaseAbortController.abort() });
  const assertOwnership = async () => {
    if (leaseAbortController.signal.aborted || leaseHeartbeat.isLost()) return false;
    const renewed = await renewGradingTombstoneLease({ db: input.db, resourceKey: input.resourceKey, claimToken: input.claimToken, holdScopes: input.holdScopes });
    if (!renewed) leaseAbortController.abort();
    return renewed;
  };
  try {
    if (!(await assertOwnership())) throw new Error('grading-tombstone-lease-lost');
    const result = await input.adapter.delete({ resourceType: input.resourceType, requestKey: `grading-provider-retention:${input.resourceKey}`, provider, providerRequestId: providerRequestId || null, deletionHandle: deletionHandle || null, deadline: persistedDeadline, providerRetentionSeconds: seconds, signal: leaseAbortController.signal });
    if (!(await assertOwnership())) throw new Error('grading-tombstone-lease-lost');
    if (!result.deleted) {
      await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, failureData('BLOCKED', { providerRetentionDeadlineAt: persistedDeadline, providerDeletionState: 'BLOCKED', providerDeletionReason: result.reason ?? 'provider-deletion-not-confirmed', providerDeletionRequestedAt: input.now, lastErrorCode: result.reason ?? 'provider-deletion-not-confirmed' }));
      await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-blocked', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { reason: result.reason ?? 'provider-deletion-not-confirmed' } });
      return 'blocked';
    }
    await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, { providerRetentionDeadlineAt: persistedDeadline, providerDeletionState: 'DELETED', providerDeletionReason: null, providerDeletionRequestedAt: input.now });
    return 'ready';
  } catch (error) {
    if (error instanceof Error && error.message === 'grading-tombstone-lease-lost') throw error;
    const errorCode = retentionErrorCode(error);
    if (input.preserveClaimOnFailure) {
      await updateOwnedGradingTombstone(input.db, input.resourceKey, input.claimToken, { status: 'PENDING', providerDeletionState: 'RETRYABLE', providerDeletionReason: errorCode, providerDeletionRequestedAt: input.now, lastErrorCode: errorCode });
    } else {
      await markGradingTombstoneRetryable(input.db, input.resourceKey, errorCode, input.claimToken);
    }
    await writeLifecycleAudit(input.db, { action: 'grading-retention.provider-delete-failed', resourceType: input.resourceType, resourceId: input.resourceId, actorId: 'grading-gc', actorRole: 'SERVICE', metadata: { error: errorCode } });
    return 'retryable';
  } finally {
    leaseHeartbeat.stop();
  }
}

async function updateOwnedGradingTombstone(db: MathGradingDb, resourceKey: string, claimToken: string, data: Record<string, unknown>): Promise<void> {
  const current = await findGradingTombstone(db, resourceKey);
  const storageResourceKey = typeof current?.resourceKey === 'string' ? current.resourceKey : resourceKey;
  if (db.gradingTombstone?.updateMany) {
    const result = await db.gradingTombstone.updateMany({ where: { resourceKey: storageResourceKey, status: { in: ['PENDING', 'BLOCKED', 'RETRYABLE'] }, deletionClaimToken: claimToken }, data });
    if (result?.count === 0) throw new Error('grading-tombstone-update-fenced');
    return;
  }
  const existing = current;
  const hasReadRepository = Boolean(db.gradingTombstone?.findUnique || db.gradingTombstone?.findFirst);
  if ((!existing && hasReadRepository) || (existing && existing.deletionClaimToken !== claimToken) || !db.gradingTombstone?.update) throw new Error('grading-tombstone-update-fenced');
  await db.gradingTombstone.update({ where: { resourceKey: storageResourceKey }, data });
}

async function findGradingTombstone(db: MathGradingDb, resourceKey: string): Promise<any | null> {
  const pseudonymousKey = pseudonymizeGradingLineage(resourceKey, 'resource-key');
  const lookupKey = gradingTombstoneLookupKey(resourceKey);
  const previousLookupKey = previousGradingTombstoneLookupKey(resourceKey);
  const legacyLookupKey = legacyGradingTombstoneLookupKey(resourceKey);
  const legacyPhaseFourLookupKey = legacyPhaseFourGradingTombstoneLookupKey(resourceKey);
  if (db.gradingTombstone?.findUnique) {
    const raw = await db.gradingTombstone.findUnique({ where: { resourceKey } });
    if (raw) return raw;
    try {
      const pseudonymous = await db.gradingTombstone.findUnique({ where: { resourceKey: pseudonymousKey } });
      if (pseudonymous) return pseudonymous;
      const current = await db.gradingTombstone.findUnique({ where: { lookupKey } });
      if (current) return current;
      if (previousLookupKey) {
        const previous = await db.gradingTombstone.findUnique({ where: { lookupKey: previousLookupKey } });
        if (previous) return previous;
      }
      if (legacyLookupKey) {
        const legacy = await db.gradingTombstone.findUnique({ where: { lookupKey: legacyLookupKey } });
        if (legacy) return legacy;
      }
      return db.gradingTombstone.findUnique({ where: { lookupKey: legacyPhaseFourLookupKey } });
    } catch (error) {
      if (isOptionalTombstoneLookupError(error)) return null;
      throw error;
    }
  }
  if (db.gradingTombstone?.findFirst) return db.gradingTombstone.findFirst({ where: { OR: [{ resourceKey }, { resourceKey: pseudonymousKey }, { lookupKey }, ...(previousLookupKey ? [{ lookupKey: previousLookupKey }] : []), ...(legacyLookupKey ? [{ lookupKey: legacyLookupKey }] : []), { lookupKey: legacyPhaseFourLookupKey }, { lineageReference: pseudonymizeGradingLineage(resourceKey, 'lineage') }] } });
  return null;
}

export async function claimGradingTombstone(input: {
  db: MathGradingDb;
  resourceKey: string;
  claimToken: string;
  now?: Date;
  leaseMs?: number;
  holdScopes?: Array<[string, string]>;
}): Promise<boolean> {
  const now = await readRetentionDatabaseNow(input.db, input.now ?? new Date());
  const tombstone = await findGradingTombstone(input.db, input.resourceKey);
  const hasReadRepository = Boolean(input.db.gradingTombstone?.findUnique || input.db.gradingTombstone?.findFirst);
  if ((hasReadRepository && !tombstone) || isGradingTombstoneTerminal(tombstone)) return false;
  const hold = await findActiveHold(input.db, input.holdScopes ?? tombstoneScopes(tombstone), now);
  if (hold) return false;
  const leaseExpiresAt = new Date(now.getTime() + (input.leaseMs ?? GRADING_TOMBSTONE_LEASE_MS));
  const storageResourceKey = typeof tombstone?.resourceKey === 'string' ? tombstone.resourceKey : input.resourceKey;
  const where = {
    resourceKey: storageResourceKey,
    status: { in: ['PENDING', 'RETRYABLE', 'BLOCKED', 'DELETED_WITH_HOLD'] },
    OR: [
      { deletionClaimToken: null },
      { deletionLeaseExpiresAt: { lt: now } },
    ],
  };
  const data = {
    deletionClaimToken: input.claimToken,
    deletionClaimedAt: now,
    deletionLeaseExpiresAt: leaseExpiresAt,
    status: 'PENDING',
    lastErrorCode: null,
  };
  if (input.db.gradingTombstone?.updateMany) {
    const result = await input.db.gradingTombstone.updateMany({ where, data });
    return result?.count === undefined ? true : result.count === 1;
  }
  if (input.db.gradingTombstone?.update) {
    const current = await findGradingTombstone(input.db, input.resourceKey);
    if ((hasReadRepository && (!current || isGradingTombstoneTerminal(current))) || (!hasReadRepository && current && isGradingTombstoneTerminal(current))) return false;
    if (current?.deletionClaimToken && current.deletionLeaseExpiresAt && current.deletionLeaseExpiresAt >= now) return false;
    await input.db.gradingTombstone.update({ where: { resourceKey: storageResourceKey }, data });
    return true;
  }
  return false;
}

export async function renewGradingTombstoneLease(input: { db: MathGradingDb; resourceKey: string; claimToken: string; now?: Date; leaseMs?: number; holdScopes?: Array<[string, string]> }): Promise<boolean> {
  const requestedNow = await readRetentionDatabaseNow(input.db, input.now ?? new Date());
  const model = input.db.gradingTombstone;
  if (!model) return false;
  if (input.holdScopes && await hasActiveGradingHold(input.db, input.holdScopes, requestedNow)) return false;
  let current: any = null;
  try {
    current = await findGradingTombstone(input.db, input.resourceKey);
  } catch {
    return false;
  }
  if (current && (current.status !== 'PENDING' || current.deletionClaimToken !== input.claimToken)) return false;
  const currentExpiry = current?.deletionLeaseExpiresAt ? new Date(current.deletionLeaseExpiresAt) : null;
  if (currentExpiry && currentExpiry <= requestedNow) return false;
  const currentClaimedAt = current?.deletionClaimedAt ? new Date(current.deletionClaimedAt) : null;
  const proposedClaimedAt = currentClaimedAt && currentClaimedAt > requestedNow ? currentClaimedAt : requestedNow;
  const proposedExpiry = new Date(Math.max(currentExpiry?.getTime() ?? 0, proposedClaimedAt.getTime() + (input.leaseMs ?? GRADING_TOMBSTONE_LEASE_MS)));
  const storageResourceKey = typeof current?.resourceKey === 'string' ? current.resourceKey : input.resourceKey;
  const where = { resourceKey: storageResourceKey, status: 'PENDING', deletionClaimToken: input.claimToken };
  if (model.updateMany) {
    const result = await model.updateMany({ where: { ...where, OR: [{ deletionLeaseExpiresAt: null }, { deletionLeaseExpiresAt: { gt: requestedNow } }], AND: [{ OR: [{ deletionLeaseExpiresAt: null }, { deletionLeaseExpiresAt: { lt: proposedExpiry } }] }, { OR: [{ deletionClaimedAt: null }, { deletionClaimedAt: { lt: proposedClaimedAt } }] }] }, data: { deletionClaimedAt: proposedClaimedAt, deletionLeaseExpiresAt: proposedExpiry } });
    const renewed = result?.count === undefined ? true : result.count === 1;
    if (!renewed) {
      try {
        const latest = await findGradingTombstone(input.db, input.resourceKey);
        if (!latest || latest.status !== 'PENDING' || latest.deletionClaimToken !== input.claimToken || !latest.deletionLeaseExpiresAt || new Date(latest.deletionLeaseExpiresAt) < proposedExpiry || (latest.deletionClaimedAt && new Date(latest.deletionClaimedAt) < proposedClaimedAt)) return false;
      } catch {
        return false;
      }
    }
    const verifiedNow = await readRetentionDatabaseNow(input.db, requestedNow);
    const latest = await findGradingTombstone(input.db, input.resourceKey);
    if (!latest || latest.status !== 'PENDING' || latest.deletionClaimToken !== input.claimToken || !latest.deletionLeaseExpiresAt || new Date(latest.deletionLeaseExpiresAt) <= verifiedNow) return false;
    return !(input.holdScopes && await hasActiveGradingHold(input.db, input.holdScopes, verifiedNow));
  }
  return false;
}

export function startGradingTombstoneLeaseHeartbeat(input: { db: MathGradingDb; resourceKey: string; claimToken: string; intervalMs?: number; now?: () => Date; holdScopes?: Array<[string, string]>; onLost?: () => void }) {
  let lost = false;
  const timer = setInterval(() => {
    void renewGradingTombstoneLease({ db: input.db, resourceKey: input.resourceKey, claimToken: input.claimToken, now: input.now?.(), holdScopes: input.holdScopes }).then((renewed) => {
      if (!renewed) { lost = true; input.onLost?.(); }
    }).catch(() => { lost = true; input.onLost?.(); });
  }, input.intervalMs ?? GRADING_TOMBSTONE_HEARTBEAT_MS);
  return { stop: () => clearInterval(timer), isLost: () => lost };
}

export async function deleteGradingObjectsIndependently(input: {
  store: SubmissionObjectStore;
  objectKeys: string[];
  assertOwnership?: () => Promise<boolean> | boolean;
  readDeletedAt?: () => Promise<Date> | Date;
  onObjectDeleted?: (input: { objectKey: string; physicalDeletedAt: Date }) => Promise<void> | void;
  onObjectError?: (input: { objectKey: string; error: unknown }) => Promise<void> | void;
  onOwnershipLost?: (input: { objectKey: string; physicalDeletedAt: Date; deletedObjectKeys: string[] }) => Promise<void> | void;
}): Promise<void> {
  let firstError: unknown = null;
  const deletedObjectKeys: string[] = [];
  for (const objectKey of [...new Set(input.objectKeys)]) {
    if (input.assertOwnership && !(await input.assertOwnership())) throw new Error('grading-tombstone-lease-lost');
    let physicalDeletedAt: Date;
    try {
      await input.store.delete(objectKey);
      physicalDeletedAt = input.readDeletedAt ? await input.readDeletedAt() : new Date();
    } catch (error) {
      if (!isObjectAlreadyGone(error)) {
        firstError ??= error;
        await input.onObjectError?.({ objectKey, error });
        continue;
      }
      physicalDeletedAt = input.readDeletedAt ? await input.readDeletedAt() : new Date();
    }
    deletedObjectKeys.push(objectKey);
    await input.onObjectDeleted?.({ objectKey, physicalDeletedAt });
    if (input.assertOwnership && !(await input.assertOwnership())) {
      await input.onOwnershipLost?.({ objectKey, physicalDeletedAt, deletedObjectKeys: [...deletedObjectKeys] });
      throw new Error('grading-tombstone-lease-lost');
    }
  }
  if (firstError) throw firstError;
}

function tombstoneScopes(tombstone: any): Array<[string, string]> {
  const scopeType = {
    AnswerEvidence: 'evidence',
    DocumentConversion: 'conversion',
    GradingRun: 'run',
    GradingBatch: 'batch',
    SubmissionAttempt: 'attempt',
  }[String(tombstone.resourceType)] ?? String(tombstone.resourceType ?? '').toLowerCase();
  return tombstone.resourceId ? [[scopeType, String(tombstone.resourceId)]] : [];
}

async function ensureGradingTombstone(db: MathGradingDb, data: Record<string, unknown>): Promise<any> {
  const pendingData: Record<string, unknown> = {
    ...data,
    lookupKey: data.lookupKey ?? gradingTombstoneLookupKey(String(data.resourceKey)),
    status: 'PENDING',
    deletionIntentAt: data.deletionIntentAt ?? data.createdAt ?? new Date(),
    lastErrorCode: null,
  };
  const existing = await findGradingTombstone(db, String(pendingData.resourceKey));
  if (isGradingTombstoneTerminal(existing)) return existing;
  if (existing?.deletionClaimToken && existing.deletionLeaseExpiresAt && new Date(existing.deletionLeaseExpiresAt) > new Date(String(pendingData.deletionIntentAt))) return existing;
  const storageResourceKey = typeof existing?.resourceKey === 'string' ? existing.resourceKey : pendingData.resourceKey;
  if (db.gradingTombstone?.upsert) {
    return db.gradingTombstone.upsert({
      where: { resourceKey: storageResourceKey },
      create: pendingData,
      update: {
        reason: pendingData.reason,
        checksum: pendingData.checksum,
        lineageRetained: pendingData.lineageRetained,
        lifecyclePolicyId: pendingData.lifecyclePolicyId,
        lifecyclePolicyVersion: pendingData.lifecyclePolicyVersion,
        lifecycleDeleteStrategy: pendingData.lifecycleDeleteStrategy,
        lifecycleRetentionSeconds: pendingData.lifecycleRetentionSeconds,
        lifecycleGovernedRecordRule: pendingData.lifecycleGovernedRecordRule,
        providerRetentionSeconds: pendingData.providerRetentionSeconds,
        providerRetentionStartedAt: existing?.providerRetentionStartedAt ?? pendingData.providerRetentionStartedAt,
        provider: existing?.provider ?? pendingData.provider,
        providerRequestId: existing?.providerRequestId ?? pendingData.providerRequestId,
        providerDeletionHandle: existing?.providerDeletionHandle ?? pendingData.providerDeletionHandle,
        status: existing?.status === 'BLOCKED' ? 'BLOCKED' : existing?.status === 'RETRYABLE' ? 'RETRYABLE' : existing?.status === 'DELETED_WITH_HOLD' ? 'DELETED_WITH_HOLD' : 'PENDING',
        deletionIntentAt: pendingData.deletionIntentAt,
        lastErrorCode: null,
      },
    });
  }
  if (existing && db.gradingTombstone?.update) {
    return db.gradingTombstone.update({ where: { resourceKey: storageResourceKey }, data: {
      status: existing.status === 'BLOCKED' ? 'BLOCKED' : existing.status === 'RETRYABLE' ? 'RETRYABLE' : existing.status === 'DELETED_WITH_HOLD' ? 'DELETED_WITH_HOLD' : 'PENDING',
      deletionIntentAt: pendingData.deletionIntentAt,
      lastErrorCode: null,
      lifecyclePolicyId: pendingData.lifecyclePolicyId,
      lifecyclePolicyVersion: pendingData.lifecyclePolicyVersion,
      lifecycleDeleteStrategy: pendingData.lifecycleDeleteStrategy,
      lifecycleRetentionSeconds: pendingData.lifecycleRetentionSeconds,
      lifecycleGovernedRecordRule: pendingData.lifecycleGovernedRecordRule,
      providerRetentionSeconds: pendingData.providerRetentionSeconds,
      providerRetentionStartedAt: existing?.providerRetentionStartedAt ?? pendingData.providerRetentionStartedAt,
      provider: existing?.provider ?? pendingData.provider,
      providerRequestId: existing?.providerRequestId ?? pendingData.providerRequestId,
      providerDeletionHandle: existing?.providerDeletionHandle ?? pendingData.providerDeletionHandle,
    } });
  }
  if (existing) return existing;
  if (db.gradingTombstone?.create) return db.gradingTombstone.create({ data: pendingData });
  throw new Error('grading-tombstone-repository-unavailable');
}

export async function completeGradingTombstone(db: MathGradingDb, resourceKey: string, now: Date, options: { contentDeleted?: boolean; pseudonymized?: boolean; providerRetentionReady?: boolean; workerClaimToken?: string; holdScopes?: Array<[string, string]> } = {}): Promise<void> {
  now = await readRetentionDatabaseNow(db, now);
  const contentDeleted = options.contentDeleted !== false;
  if (options.holdScopes && await hasActiveGradingHold(db, options.holdScopes, now)) throw new Error('grading-tombstone-hold');
  const current = await findGradingTombstone(db, resourceKey);
  if (options.workerClaimToken && current?.deletionLeaseExpiresAt && new Date(current.deletionLeaseExpiresAt) <= now) throw new Error('grading-tombstone-complete-fenced');
  const storageResourceKey = typeof current?.resourceKey === 'string' ? current.resourceKey : resourceKey;
  const objectRows = contentDeleted ? await listGradingTombstoneObjects(db, resourceKey) : [];
  if (contentDeleted && objectRows.some((row) => !['DELETED', 'DELETED_WITH_HOLD'].includes(String(row.status)))) throw new Error('grading-tombstone-objects-incomplete');
  const holdOutcome = current?.status === 'DELETED_WITH_HOLD' || objectRows.some((row) => row.status === 'DELETED_WITH_HOLD');
  const providerRetentionPending = contentDeleted && options.providerRetentionReady === false;
  const pendingStatus = current?.status === 'RETRYABLE' ? 'RETRYABLE' : 'BLOCKED';
  const terminalOperationKey = contentDeleted ? gradingTombstoneOperationKey(resourceKey) : undefined;
  const data = {
    status: providerRetentionPending ? pendingStatus : holdOutcome ? 'DELETED_WITH_HOLD' : contentDeleted ? 'DELETED' : 'RETAINED',
    physicalDeletedAt: contentDeleted ? (current?.physicalDeletedAt ?? now) : null,
    contentDeletedAt: contentDeleted ? now : null,
    pseudonymizedAt: options.pseudonymized ? now : null,
    lineageRetained: options.pseudonymized || !contentDeleted,
    lineageReference: contentDeleted ? pseudonymizeGradingLineage(resourceKey, 'lineage') : null,
    lookupKey: current?.lookupKey ?? gradingTombstoneLookupKey(resourceKey),
    ...(contentDeleted ? { checksum: null } : {}),
    ...(contentDeleted ? {
      resourceKey: terminalOperationKey,
      resourceId: `redacted:grading-operation-id:${pseudonymizeGradingLineage(String(current?.resourceId ?? resourceKey), 'resource-id')}`,
      ...(providerRetentionPending ? {} : { providerRequestId: null, providerDeletionHandle: null }),
    } : {}),
    deletionClaimToken: null,
    deletionClaimedAt: null,
    deletionLeaseExpiresAt: null,
    lastErrorCode: holdOutcome ? 'deleted-with-hold' : null,
    ...(contentDeleted ? { redactionCount: { increment: 1 } } : {}),
  };
  const claimWhere = options.workerClaimToken ? { deletionClaimToken: options.workerClaimToken, deletionLeaseExpiresAt: { gt: now } } : {};
  if (db.gradingTombstone?.updateMany) {
    const result = await db.gradingTombstone.updateMany({ where: { resourceKey: storageResourceKey, status: { in: ['PENDING', 'RETRYABLE', 'BLOCKED', 'DELETED_WITH_HOLD'] }, ...claimWhere }, data });
    if (result?.count === 0) {
      const existing = await findGradingTombstone(db, resourceKey);
      if (existing?.status === data.status) return;
      throw new Error('grading-tombstone-complete-fenced');
    }
    if (contentDeleted && db.gradingTombstoneObject?.findMany && db.gradingTombstoneObject.updateMany) {
      const objects = await db.gradingTombstoneObject.findMany({ where: { tombstoneId: current?.id } });
      for (const object of objects) {
        await db.gradingTombstoneObject.updateMany({ where: { id: object.id }, data: { objectKey: `redacted:grading-object:${pseudonymizeGradingLineage(object.objectKey, 'object-key')}`, updatedAt: now } });
      }
    }
    return;
  }
  if (db.gradingTombstone?.update) {
    const existing = await findGradingTombstone(db, resourceKey);
    if (existing?.status === data.status && existing?.contentDeletedAt) return;
    if (options.workerClaimToken && ((existing && existing.deletionClaimToken !== options.workerClaimToken) || (!existing && (db.gradingTombstone.findUnique || db.gradingTombstone.findFirst)))) throw new Error('grading-tombstone-complete-fenced');
    if (!existing && (db.gradingTombstone.findUnique || db.gradingTombstone.findFirst)) throw new Error('grading-tombstone-complete-fenced');
    await db.gradingTombstone.update({ where: { resourceKey: storageResourceKey }, data });
    if (contentDeleted && db.gradingTombstoneObject?.findMany && db.gradingTombstoneObject.updateMany && existing?.id) {
      const objects = await db.gradingTombstoneObject.findMany({ where: { tombstoneId: existing.id } });
      for (const object of objects) {
        await db.gradingTombstoneObject.updateMany({ where: { id: object.id }, data: { objectKey: `redacted:grading-object:${pseudonymizeGradingLineage(object.objectKey, 'object-key')}`, updatedAt: now } });
      }
    }
    return;
  }
  throw new Error('grading-tombstone-repository-unavailable');
}

async function markGradingTombstoneRetryable(db: MathGradingDb, resourceKey: string, errorCode: string, workerClaimToken?: string): Promise<void> {
  const objectRows = await listGradingTombstoneObjects(db, resourceKey);
  const current = await findGradingTombstone(db, resourceKey);
  const storageResourceKey = typeof current?.resourceKey === 'string' ? current.resourceKey : resourceKey;
  const holdOutcome = objectRows.some((row) => row.status === 'DELETED_WITH_HOLD');
  const data = { status: holdOutcome ? 'DELETED_WITH_HOLD' : 'RETRYABLE', lastErrorCode: holdOutcome ? 'deleted-with-hold' : errorCode, retryCount: { increment: 1 }, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null };
  const claimWhere = workerClaimToken ? { deletionClaimToken: workerClaimToken } : {};
  if (db.gradingTombstone?.updateMany) {
    const result = await db.gradingTombstone.updateMany({ where: { resourceKey: storageResourceKey, status: { in: ['PENDING', 'BLOCKED', 'RETRYABLE'] }, ...claimWhere }, data });
    if (result?.count === 0) {
      const existing = await findGradingTombstone(db, resourceKey);
      if (isGradingTombstoneTerminal(existing) || existing?.status === 'DELETED_WITH_HOLD') return;
      throw new Error('grading-tombstone-retry-fenced');
    }
    return;
  }
  if (db.gradingTombstone?.update) {
    const existing = await findGradingTombstone(db, resourceKey);
    if (isGradingTombstoneTerminal(existing) || existing?.status === 'DELETED_WITH_HOLD') return;
    if (!existing && (db.gradingTombstone.findUnique || db.gradingTombstone.findFirst)) throw new Error('grading-tombstone-not-found');
    if (workerClaimToken && ((existing && existing.deletionClaimToken !== workerClaimToken) || (!existing && (db.gradingTombstone.findUnique || db.gradingTombstone.findFirst)))) throw new Error('grading-tombstone-retry-fenced');
    await db.gradingTombstone.update({ where: { resourceKey: storageResourceKey }, data });
    return;
  }
  throw new Error('grading-tombstone-repository-unavailable');
}

function retentionErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 120) || 'retention-delete-failed';
}

function isObjectAlreadyGone(error: unknown): boolean {
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

async function withSerializableTransaction<T>(db: MathGradingDb, callback: (tx: MathGradingDb) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await db.$transaction(callback, { isolationLevel: 'Serializable' });
    } catch (error) {
      if (!isSerializationConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error('grading-quota-transaction-failed');
}

function isSerializationConflict(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2034' || /serialization|deadlock|could not serialize|write conflict/i.test(message);
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export async function writeLifecycleAudit(db: MathGradingDb, input: { action: string; resourceType: string; resourceId: string; actorId: string; actorRole: 'TEACHER' | 'ADMIN' | 'SERVICE'; metadata: Record<string, unknown> }) {
  if (!db.gradingAuditEvent?.create) throw new Error('grading-audit-repository-unavailable');
  const purpose = 'lifecycle';
  const resourceId = auditPseudo(input.resourceId, purpose, 'resource');
  const metadata = redactAuditIdentifiers(input.metadata, purpose);
  const eventKey = buildPipelineDedupeKey('grading-audit-event', {
    action: input.action,
    purpose,
    resourceType: input.resourceType,
    resourceId,
    attempt: metadata.attempt ?? null,
    errorCode: metadata.errorCode ?? null,
    auditIdentity: randomUUID(),
  });
  try {
    await db.gradingAuditEvent.create({ data: {
      eventKey,
      actorPseudoId: pseudonymousAuditId(input.actorId, purpose),
      actorRole: input.actorRole,
      action: input.action,
      purpose,
      resourceType: input.resourceType,
      resourceId,
      metadata,
    } });
  } catch (error) {
    if (isUniqueConstraintError(error)) return;
    throw error;
  }
}

function auditPseudo(value: string, purpose: string, field: string): string {
  return pseudonymousAuditId(`${field}:${value}`, `${purpose}:${field}`);
}

function redactAuditIdentifiers(value: Record<string, unknown>, purpose: string): Record<string, unknown> {
  const transform = (current: unknown, key?: string): unknown => {
    if (Array.isArray(current)) return current.map((item) => transform(item));
    if (!current || typeof current !== 'object') return current;
    const result: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(current as Record<string, unknown>)) {
      if (childKey === 'error' || childKey === 'errorCode') {
        const safeCode = boundedLifecycleAuditCode(childValue);
        if (safeCode) result.errorCode = safeCode;
      } else if (/^(?:resource|answer|class|assignment|question|attempt|asset|conversion|evidence|run|batch|item|hold|scope|student|providerRequest|actor)(?:Id|ID)?$/i.test(childKey) && typeof childValue === 'string') {
        result[childKey] = auditPseudo(childValue, purpose, childKey);
      } else if (/answer|content|markdown|text|prompt|reference|payload|bytes|signed|url|secret|token|authorization|api.?key|email|reason|error|excerpt|comment|rationale|overallComment|idempotency|requestHash|correlation/i.test(childKey)) {
        result[childKey] = '[redacted]';
      } else {
        result[childKey] = transform(childValue, childKey);
      }
    }
    return result;
  };
  const transformed = transform(value);
  return transformed && typeof transformed === 'object' && !Array.isArray(transformed) ? transformed as Record<string, unknown> : {};
}

function boundedLifecycleAuditCode(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength && /^[A-Za-z0-9:_-]+$/.test(normalized) ? normalized : null;
}

function isUniqueConstraintError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' || /unique constraint|duplicate key/i.test(message);
}
