import { createHash, randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import { createSubmissionObjectStore, type SubmissionObjectStore } from '@/lib/assignments/submission-object-store';
import { deriveRubricLevelRanges } from '@/lib/assignments/assignment-rubric-contract';
import {
  authorizeGradingScope,
  buildGradingRequestHash,
  buildPipelineDedupeKey,
  buildRerunIdentity,
  externalProcessingPolicyHash,
  gradingMathpixPolicyId,
  normalizeDocumentEvidence,
  gradingRequestScope,
  normalizeTextAnswerEvidence,
  normalizeExternalProcessingPolicy,
  pseudonymousAuditId,
  sha256,
  stableStringify,
  GradingMutationError,
  type ExternalProcessingPolicy,
  type FrozenQuestionContract,
  type NormalizedAnswerEvidence,
} from './math-document-grading-contracts';
import {
  convertProtectedSubmission,
  ConversionCancelledError,
  ConversionLeaseLostError,
  renderPdfPagesToPng,
  type LocalDocumentConverter,
  type MathpixClient,
  type ProtectedSubmissionSource,
} from './math-document-conversion';
import {
  evaluateFrozenQuestionEvidence,
  type GradingEvidenceAttachment,
  type GradingProviderRuntime,
  type ValidatedGradingDraft,
} from './math-document-grading-evaluator';
import { ASSIGNMENT_ATTACHMENT_MANIFEST_VERSION } from './assignment-attachment-understanding';
import { freezeLifecyclePolicy, gradingTombstoneLookupKey, requireConfiguredLifecyclePolicies } from './math-document-grading-lifecycle';
import { normalizeVisualEvidence, projectVisualEvidenceIntoDocument, type VisualEvidence, type VisualEvidenceSourceKind } from './visual-evidence-contract';
import { describeVisualEvidence, type VisualDescriptionResult } from './visual-evidence-description';

type MathGradingDb = PrismaClient | Record<string, any>;

export const GRADING_JOB_LEASE_MS = 5 * 60_000;
export const GRADING_JOB_HEARTBEAT_MS = 60_000;

export interface PipelineActor {
  id: string;
  role: 'STUDENT' | 'TEACHER' | 'ADMIN' | 'SERVICE';
}

export interface EvidencePersistenceResult {
  evidence: any;
  replay: boolean;
}

export function assertActiveGradingRunContract(run: any): void {
  const missing = ['answerAttemptId', 'answerEvidenceId', 'questionId', 'rubricId', 'questionSnapshot', 'rubricSnapshot', 'referenceAnswer']
    .filter((field) => run?.[field] === null || run?.[field] === undefined);
  if (missing.length > 0) throw new Error(`active-grading-run-lineage-missing:${missing.join(',')}`);
  if (!run?.answerAttempt?.answer || !run?.answerEvidence) throw new Error('grading-content-unavailable:association-missing');
}

export async function writeRenderedObjectToSubmissionStore(input: {
  store: SubmissionObjectStore;
  key: string;
  bytes: Uint8Array;
  mimeType: string;
  checksum: string;
  ownerId: string;
  answerId: string;
  attemptId?: string;
  workerClaimToken?: string;
  signal?: AbortSignal;
}): Promise<string> {
  if (!input.ownerId.trim() || !input.answerId.trim()) throw new Error('rendered-object-ownership-metadata-missing');
  const signed = await input.store.signUpload({ ownerId: input.ownerId, answerId: input.answerId, sizeBytes: input.bytes.byteLength, mimeType: input.mimeType, checksum: input.checksum, ...(input.attemptId ? { attemptId: input.attemptId } : {}), ...(input.workerClaimToken ? { workerClaimFingerprint: sha256(input.workerClaimToken) } : {}) }, 600, input.key);
  if (signed.key !== input.key) throw new Error('rendered-object-key-not-stable');
  const response = await fetch(signed.url, { method: 'PUT', headers: signed.requiredHeaders, body: Buffer.from(input.bytes), signal: input.signal });
  if (!response.ok) throw new Error(`rendered-object-write-http-${response.status}`);
  const metadata = await input.store.head(signed.key);
  if (!metadata || metadata.ownerId !== input.ownerId || metadata.answerId !== input.answerId || metadata.sizeBytes !== input.bytes.byteLength || metadata.checksum !== input.checksum || (input.attemptId && metadata.attemptId !== input.attemptId) || (input.workerClaimToken && metadata.workerClaimFingerprint !== sha256(input.workerClaimToken))) throw new Error('rendered-object-ownership-verification-failed');
  return signed.key;
}

type PreparedVisualEvidence = VisualEvidence & {
  bytes: Uint8Array;
  mediaType: string;
  descriptionAudit?: VisualDescriptionResult;
};

const MAX_VISUAL_EVIDENCE_ITEMS = 24;
const MAX_VISUAL_EVIDENCE_BYTES = 32 * 1024 * 1024;

async function prepareConversionVisualEvidence(input: {
  conversionId: string;
  attemptId: string;
  questionId: string | null;
  source: ProtectedSubmissionSource;
  result: Awaited<ReturnType<typeof convertProtectedSubmission>>;
  store: SubmissionObjectStore;
  classId: string;
  renderPdfPages?: typeof renderPdfPagesToPng;
  now: Date;
}): Promise<{ items: PreparedVisualEvidence[]; limitations: string[] }> {
  const build = (entry: {
    id: string;
    sourceKind: VisualEvidenceSourceKind;
    bytes: Uint8Array;
    mediaType: string;
    pageNumber: number | null;
    limitations?: string[];
    processorVersion: string;
  }) => {
    const visual = normalizeVisualEvidence({
      id: entry.id,
      sourceKind: entry.sourceKind,
      sourceChecksum: input.source.checksum,
      imageChecksum: sha256(entry.bytes),
      questionId: input.questionId,
      pageNumber: entry.pageNumber,
      bbox: null,
      description: null,
      confidence: null,
      processorVersion: entry.processorVersion,
      limitations: [
        ...(entry.limitations ?? []),
        ...(/^image\/(?:png|jpeg|webp)$/u.test(entry.mediaType) ? [] : ['visual-evidence-media-type-unsupported']),
      ],
      createdAt: input.now.toISOString(),
    });
    return { ...visual, bytes: entry.bytes, mediaType: entry.mediaType };
  };
  const bounded = (items: PreparedVisualEvidence[]) => {
    const totalBytes = items.reduce((sum, item) => sum + item.bytes.byteLength, 0);
    if (items.length > MAX_VISUAL_EVIDENCE_ITEMS || totalBytes > MAX_VISUAL_EVIDENCE_BYTES) {
      return { items: [], limitations: ['visual-evidence-limits-exceeded'] };
    }
    return { items, limitations: [] };
  };
  const word = input.result.wordRepresentation;
  if (word?.images.length) {
    return bounded(word.images.map((image, index) => {
        const anchor = word.anchors.find((candidate) => candidate.paragraphId === image.paragraphId);
        return build({
          id: `visual:${input.conversionId}:word:${index + 1}`,
          sourceKind: 'word-embedded-image',
          bytes: image.bytes,
          mediaType: image.mediaType,
          pageNumber: anchor?.pdfPageNumber ?? null,
          limitations: anchor?.pdfPageNumber ? [] : ['visual-evidence-page-unresolved'],
          processorVersion: word.extractorVersion,
        });
      }));
  }
  const mimeType = input.source.mimeType.toLowerCase();
  if (mimeType !== 'application/pdf' && !mimeType.startsWith('image/')) return { items: [], limitations: [] };
  const bytes = await input.store.readObject(input.source.objectKey);
  if (bytes.byteLength !== input.source.sizeBytes || sha256(bytes) !== input.source.checksum) {
    return { items: [], limitations: ['visual-evidence-source-integrity-failed'] };
  }
  if (mimeType.startsWith('image/')) {
    return bounded([build({
        id: `visual:${input.conversionId}:attachment:1`,
        sourceKind: 'image-attachment',
        bytes,
        mediaType: mimeType,
        pageNumber: 1,
        processorVersion: 'submission-image.v1',
      })]);
  }
  try {
    const pages = await (input.renderPdfPages ?? renderPdfPagesToPng)({ pdfBytes: bytes });
    const boundedPages = bounded(pages.map((page) => build({
        id: `visual:${input.conversionId}:pdf:${page.pageNumber}`,
        sourceKind: 'pdf-page-image',
        bytes: page.bytes,
        mediaType: 'image/png',
        pageNumber: page.pageNumber,
        processorVersion: 'pdftoppm.v1',
      })));
    return pages.length === 0 ? { items: [], limitations: ['visual-evidence-pdf-pages-empty'] } : boundedPages;
  } catch {
    return { items: [], limitations: ['visual-evidence-pdf-render-failed'] };
  }
}

function visualEvidencePersistenceData(input: {
  conversionId: string;
  attemptId: string;
  visual: PreparedVisualEvidence;
  objectKey: string;
  mediaType: string;
  sizeBytes: number;
  now: Date;
}) {
  const descriptionAudit = input.visual.descriptionAudit;
  return {
    id: input.visual.id,
    conversionId: input.conversionId,
    attemptId: input.attemptId,
    questionId: input.visual.questionId,
    sourceKind: input.visual.sourceKind,
    sourceChecksum: input.visual.sourceChecksum,
    imageChecksum: input.visual.imageChecksum,
    objectKey: input.objectKey,
    mediaType: input.mediaType,
    sizeBytes: input.sizeBytes,
    pageNumber: input.visual.pageNumber,
    bbox: input.visual.bbox,
    description: input.visual.description,
    confidence: input.visual.confidence,
    processorVersion: input.visual.processorVersion,
    provider: descriptionAudit?.provider ?? null,
    model: descriptionAudit?.model ?? null,
    policyVersion: descriptionAudit?.policyVersion ?? null,
    providerRequestId: descriptionAudit?.providerRequestId ?? null,
    providerDeletionHandle: descriptionAudit?.deletionHandle ?? null,
    providerRequestedAt: descriptionAudit?.providerRequestedAt ?? null,
    providerProcessedAt: descriptionAudit?.providerProcessedAt ?? null,
    limitations: input.visual.limitations,
    readiness: input.visual.readiness,
    contentHash: input.visual.contentHash,
    updatedAt: input.now,
  };
}

type FrozenVisualAttachment = {
  id: string;
  questionId: string | null;
  objectKey: string;
  checksum: string;
  mediaType: string;
  sizeBytes: number;
  readiness: string;
  contentHash: string;
};

function normalizeFrozenVisualAttachmentManifest(value: unknown): FrozenVisualAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const source = entry as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    const objectKey = typeof source.objectKey === 'string' ? source.objectKey.trim() : '';
    const checksum = typeof source.checksum === 'string' ? source.checksum.trim() : '';
    const mediaType = typeof source.mediaType === 'string' ? source.mediaType.trim() : '';
    const contentHash = typeof source.contentHash === 'string' ? source.contentHash.trim() : '';
    const sizeBytes = Number(source.sizeBytes);
    const readiness = typeof source.readiness === 'string' ? source.readiness.trim() : '';
    const questionId = typeof source.questionId === 'string' && source.questionId.trim() ? source.questionId.trim() : null;
    if (!id || !objectKey || !/^sha256:[a-f0-9]{64}$/u.test(checksum) || !mediaType || !contentHash || !Number.isInteger(sizeBytes) || sizeBytes < 1 || !readiness) return [];
    return [{ id, questionId, objectKey, checksum, mediaType, sizeBytes, readiness, contentHash }];
  });
}

async function loadFrozenVisualAttachments(input: {
  store: SubmissionObjectStore;
  manifest: unknown;
  questionId: string;
  ownerId: string;
  answerId: string;
  attemptId: string;
}): Promise<{ attachments: GradingEvidenceAttachment[]; error: string | null }> {
  const manifest = normalizeFrozenVisualAttachmentManifest(input.manifest);
  if (Array.isArray(input.manifest) && input.manifest.length !== manifest.length) {
    return { attachments: [], error: 'visual-evidence-manifest-invalid' };
  }
  if (manifest.length === 0) return { attachments: [], error: null };
  if (manifest.some((item) => item.questionId !== input.questionId || item.readiness !== 'ready')) {
    return { attachments: [], error: 'visual-evidence-incomplete' };
  }
  const attachments: GradingEvidenceAttachment[] = [];
  for (const item of manifest) {
    const metadata = await input.store.head(item.objectKey);
    if (!metadata
      || metadata.ownerId !== input.ownerId
      || metadata.answerId !== input.answerId
      || metadata.attemptId !== input.attemptId
      || metadata.sizeBytes !== item.sizeBytes
      || metadata.mimeType !== item.mediaType
      || metadata.checksum !== item.checksum) {
      return { attachments: [], error: 'visual-evidence-object-integrity-failed' };
    }
    const bytes = await input.store.readObject(item.objectKey);
    if (bytes.byteLength !== item.sizeBytes || sha256(bytes) !== item.checksum) {
      return { attachments: [], error: 'visual-evidence-object-integrity-failed' };
    }
    attachments.push({
      kind: 'image',
      data: bytes,
      mediaType: item.mediaType,
      checksum: item.checksum,
      questionId: item.questionId,
    });
  }
  return { attachments, error: null };
}

async function deleteOwnedRenderedObject(input: { store: SubmissionObjectStore; key: string; ownerId: string; answerId: string; checksum: string | null; attemptId?: string; workerClaimToken?: string }): Promise<'deleted' | 'missing'> {
  if (!input.ownerId || !input.answerId || !input.checksum) throw new Error('rendered-orphan-ownership-metadata-missing');
  const metadata = await input.store.head(input.key);
  if (!metadata) return 'missing';
  if (metadata.ownerId !== input.ownerId || metadata.answerId !== input.answerId || metadata.checksum !== input.checksum || (input.attemptId && metadata.attemptId !== input.attemptId) || (input.workerClaimToken && metadata.workerClaimFingerprint !== sha256(input.workerClaimToken))) throw new Error('rendered-orphan-owner-mismatch');
  await input.store.delete(input.key, new AbortController().signal);
  return 'deleted';
}

async function recordRenderedOrphanCleanupFailure(input: { db: MathGradingDb; conversion: any; key: string; checksum: string | null; attemptId: string; workerClaimToken: string; error: unknown; now: Date }): Promise<void> {
  const errorCode = input.error instanceof Error ? input.error.message.replace(/[^a-zA-Z0-9:_-]/g, '-').slice(0, 120) : 'rendered-orphan-cleanup-failed';
  const resourceKey = buildPipelineDedupeKey('rendered-orphan', { conversionId: input.conversion.id, attemptId: input.attemptId, workerClaimToken: input.workerClaimToken });
  if (!input.db.gradingTombstone?.upsert || !input.db.gradingAuditEvent?.create) throw new Error('rendered-orphan-cleanup-persistence-unavailable');
  {
    await input.db.gradingTombstone.upsert({
      where: { resourceKey },
      create: {
        id: `grading-tombstone:${resourceKey}`,
        resourceType: 'DocumentConversion',
        resourceId: input.conversion.id,
        resourceKey,
        lookupKey: gradingTombstoneLookupKey(resourceKey),
        reason: 'rendered-orphan-cleanup',
        checksum: input.checksum,
        status: 'RETRYABLE',
        deletionIntentAt: input.now,
        lastErrorCode: 'rendered-orphan-cleanup-failed',
        lifecyclePolicyId: input.conversion.lifecyclePolicyId ?? null,
        lifecyclePolicyVersion: input.conversion.lifecyclePolicyVersion ?? null,
        lifecycleDeleteStrategy: input.conversion.lifecycleDeleteStrategy ?? null,
        lifecycleRetentionSeconds: input.conversion.lifecycleRetentionSeconds ?? null,
        lifecycleGovernedRecordRule: input.conversion.lifecycleGovernedRecordRule ?? null,
        providerRetentionSeconds: input.conversion.lifecycleProviderRetentionSeconds ?? 0,
        providerRetentionStartedAt: input.conversion.providerProcessedAt ?? input.conversion.providerRequestedAt ?? null,
      },
      update: { status: 'RETRYABLE', lastErrorCode: 'rendered-orphan-cleanup-failed', retryCount: { increment: 1 }, deletionClaimToken: null, deletionClaimedAt: null, deletionLeaseExpiresAt: null },
    });
  }
  {
    await writeGradingAudit(input.db, {
      actor: { id: 'grading-worker', role: 'SERVICE' },
      action: 'document-conversion.rendered-orphan-cleanup-failed',
      purpose: 'conversion',
      resourceType: 'DocumentConversion',
      resourceId: input.conversion.id,
      answerId: input.conversion.asset?.answerId,
      classId: input.conversion.asset?.answer?.submission?.frozenAudienceClassId,
      metadata: { state: 'RETRYABLE', errorCode, attemptId: input.attemptId, workerClaimFingerprint: sha256(input.workerClaimToken) },
    });
  }
}

export const GRADING_PROVIDER_POLICY_SELECT = {
  id: true,
  provider: true,
  version: true,
  model: true,
  endpoint: true,
  purpose: true,
  dataCategories: true,
  minimizedScope: true,
  institutionScope: true,
  classScope: true,
  processingRegion: true,
  agreementVersion: true,
  noTraining: true,
  providerRetentionSeconds: true,
  deletionCapability: true,
  rateLimitPerMinute: true,
  enabled: true,
  disabledAt: true,
  credentialRef: true,
} as const;

export async function renewGradingJobLease(input: { db: MathGradingDb; jobId: string; workerClaimToken: string; now?: Date }): Promise<boolean> {
  const requestedNow = input.now ?? new Date();
  const model = (input.db as any).gradingJob;
  if (!model) return false;
  let current: any = null;
  try {
    current = model.findUnique ? await model.findUnique({ where: { id: input.jobId } }) : null;
  } catch {
    return false;
  }
  if (current && current.state !== undefined && !['RUNNING', 'QUEUED', 'RETRYABLE'].includes(String(current.state))) return false;
  if (current?.state === 'RUNNING' && current.workerClaimToken !== input.workerClaimToken) return false;
  const currentExpiry = current?.workerLeaseExpiresAt ? new Date(current.workerLeaseExpiresAt) : null;
  if (currentExpiry && currentExpiry <= requestedNow) return false;
  const currentClaimedAt = current?.workerClaimedAt ? new Date(current.workerClaimedAt) : null;
  const proposedClaimedAt = currentClaimedAt && currentClaimedAt > requestedNow ? currentClaimedAt : requestedNow;
  const proposedExpiry = new Date(Math.max(currentExpiry?.getTime() ?? 0, proposedClaimedAt.getTime() + GRADING_JOB_LEASE_MS));
  if (model.updateMany) {
    const result = await model.updateMany({
      where: {
        id: input.jobId,
        state: { in: ['RUNNING'] },
        workerClaimToken: input.workerClaimToken,
        OR: [{ workerLeaseExpiresAt: null }, { workerLeaseExpiresAt: { gt: requestedNow } }],
        AND: [
          { OR: [{ workerLeaseExpiresAt: null }, { workerLeaseExpiresAt: { lt: proposedExpiry } }] },
          { OR: [{ workerClaimedAt: null }, { workerClaimedAt: { lt: proposedClaimedAt } }] },
        ],
      },
      data: { workerClaimedAt: proposedClaimedAt, workerLeaseExpiresAt: proposedExpiry, updatedAt: proposedClaimedAt },
    });
    const renewed = result?.count === undefined ? true : result.count === 1;
    if (renewed) return true;
    try {
      const latest = model.findUnique ? await model.findUnique({ where: { id: input.jobId } }) : null;
      return Boolean(latest && latest.state === 'RUNNING' && latest.workerClaimToken === input.workerClaimToken && latest.workerLeaseExpiresAt && new Date(latest.workerLeaseExpiresAt) >= proposedExpiry && (!latest.workerClaimedAt || new Date(latest.workerClaimedAt) >= proposedClaimedAt));
    } catch {
      return false;
    }
  }
  return false;
}

export function startGradingJobLeaseHeartbeat(input: { db: MathGradingDb; jobId: string; workerClaimToken: string; intervalMs?: number; now?: () => Date; onLost?: () => void }) {
  let lost = false;
  const timer = setInterval(() => {
    void renewGradingJobLease({ db: input.db, jobId: input.jobId, workerClaimToken: input.workerClaimToken, now: input.now?.() }).then((renewed) => {
      if (!renewed) { lost = true; input.onLost?.(); }
    }).catch(() => { lost = true; input.onLost?.(); });
  }, input.intervalMs ?? GRADING_JOB_HEARTBEAT_MS);
  return {
    stop: () => clearInterval(timer),
    isLost: () => lost,
  };
}

export async function assertGradingJobLease(input: { db: MathGradingDb; jobId: string; workerClaimToken: string; heartbeat?: { isLost: () => boolean }; now?: Date; fencedCode?: string }): Promise<void> {
  if (input.heartbeat?.isLost()) throw new Error('grading-worker-fenced');
  const renewed = await renewGradingJobLease({ db: input.db, jobId: input.jobId, workerClaimToken: input.workerClaimToken });
  if (!renewed) throw new Error(input.fencedCode ?? 'grading-worker-fenced');
}

function gradingJobLeaseData(workerClaimToken: string, now: Date) {
  return { workerClaimToken, workerClaimedAt: now, workerLeaseExpiresAt: new Date(now.getTime() + GRADING_JOB_LEASE_MS) };
}

interface RequestIdempotencyCreation<T> {
  resourceId: string;
  value: T;
  replay?: boolean;
}

export async function withGradingRequestIdempotency<T>(input: {
  db: MathGradingDb;
  actor: PipelineActor;
  operation: string;
  idempotencyKey: string;
  requestHash: string;
  resourceType: string;
  now: Date;
  load: (db: MathGradingDb, resourceId: string) => Promise<T | null>;
  create: (db: MathGradingDb) => Promise<RequestIdempotencyCreation<T>>;
  recoverUniqueConstraint?: (db: MathGradingDb) => Promise<RequestIdempotencyCreation<T> | null>;
}): Promise<{ value: T; replay: boolean }> {
  const repository = (input.db as any).gradingRequestIdempotency;
  if (!repository?.findFirst || !repository?.create) {
    const created = input.db.$transaction
      ? await input.db.$transaction((tx: MathGradingDb) => input.create(tx))
      : await input.create(input.db);
    return { value: created.value, replay: Boolean(created.replay) };
  }
  if (!input.db.$transaction) {
    const created = await input.create(input.db);
    return { value: created.value, replay: Boolean(created.replay) };
  }
  const actorPseudoId = pseudonymousAuditId(input.actor.id, 'idempotency');
  const protectedKey = pseudonymousAuditId(input.idempotencyKey, `idempotency-key:${input.operation}`);
  await repository.deleteMany?.({ where: { expiresAt: { lte: input.now } } });
  const scope = gradingRequestScope(input.actor.role);
  const where = { operation: input.operation, scope, actorPseudoId, idempotencyKey: protectedKey };
  const legacyWhere = { ...where, idempotencyKey: `legacy-md5:${createHash('md5').update(`${input.operation}:${input.idempotencyKey}`).digest('hex')}` };
  const read = async (db: MathGradingDb) => await (db as any).gradingRequestIdempotency.findFirst({ where })
    ?? (db as any).gradingRequestIdempotency.findFirst({ where: legacyWhere });
  const resolve = async (row: any): Promise<{ value: T; replay: true }> => {
    if (row.requestHash !== input.requestHash) throw new GradingMutationError('idempotency-key-conflict', 409);
    if (!row.resourceId) throw new GradingMutationError('idempotency-request-in-progress', 409);
    const value = await input.load(input.db, row.resourceId);
    if (!value) throw new Error('idempotency-resource-not-found');
    return { value, replay: true };
  };
  const existing = await read(input.db);
  if (existing) return resolve(existing);
  try {
    const transactionResult: any = await input.db.$transaction(async (tx: MathGradingDb) => {
      const concurrent = await read(tx);
      if (concurrent) {
        if (concurrent.requestHash !== input.requestHash) throw new GradingMutationError('idempotency-key-conflict', 409);
        return { replay: true, row: concurrent };
      }
      const reservation = await (tx as any).gradingRequestIdempotency.create({
        data: {
          id: `grading-request:${sha256(stableStringify(where)).slice(-32)}`,
          ...where,
          requestHash: input.requestHash,
          resourceType: input.resourceType,
          resourceId: null,
          expiresAt: new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
      const created = await input.create(tx);
      await (tx as any).gradingRequestIdempotency.update({ where: { id: reservation.id }, data: { resourceId: created.resourceId, updatedAt: input.now } });
      return { replay: false, created };
    });
    if (transactionResult.replay) return resolve(transactionResult.row);
    return { value: transactionResult.created.value, replay: Boolean(transactionResult.created.replay) };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    const winner = await read(input.db);
    if (winner) return resolve(winner);
    const recovered = await input.recoverUniqueConstraint?.(input.db);
    if (!recovered) throw error;
    try {
      await repository.create({
        data: {
          id: `grading-request:${sha256(stableStringify(where)).slice(-32)}`,
          ...where,
          requestHash: input.requestHash,
          resourceType: input.resourceType,
          resourceId: recovered.resourceId,
          expiresAt: new Date(input.now.getTime() + 24 * 60 * 60 * 1000),
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
    } catch (reservationError) {
      if (!isUniqueConstraintError(reservationError)) throw reservationError;
      const concurrent = await read(input.db);
      if (!concurrent) throw reservationError;
      return resolve(concurrent);
    }
    return { value: recovered.value, replay: true };
  }
}

export function toGradingProviderPolicySnapshot(row: any): ExternalProcessingPolicy | null {
  if (!row) return null;
  return normalizeExternalProcessingPolicy({
    provider: row.provider,
    version: row.version,
    model: row.model,
    endpoint: row.endpoint,
    purpose: row.purpose,
    dataCategories: row.dataCategories,
    minimizedScope: row.minimizedScope,
    institutionScope: row.institutionScope,
    classScope: row.classScope,
    processingRegion: row.processingRegion,
    agreementVersion: row.agreementVersion,
    noTraining: row.noTraining,
    providerRetentionSeconds: row.providerRetentionSeconds,
    deletionCapability: row.deletionCapability,
    rateLimitPerMinute: row.rateLimitPerMinute,
    enabled: row.enabled,
    disabledAt: row.disabledAt,
    credentialRef: row.credentialRef,
  });
}

export function assertCurrentGradingProviderPolicy(input: {
  policyId?: string | null;
  snapshot?: unknown;
  snapshotHash?: string | null;
  currentPolicy?: unknown;
  expectedPurpose?: ExternalProcessingPolicy['purpose'];
}): ExternalProcessingPolicy | null {
  if (!input.policyId) {
    const snapshot = normalizeExternalProcessingPolicy(input.snapshot as Record<string, unknown> | null | undefined);
    if (input.expectedPurpose && snapshot && snapshot.purpose !== input.expectedPurpose) throw new Error('provider-policy-purpose-mismatch');
    return snapshot;
  }
  const snapshot = normalizeExternalProcessingPolicy(input.snapshot as Record<string, unknown> | null | undefined);
  if (!snapshot || !input.snapshotHash || externalProcessingPolicyHash(snapshot) !== input.snapshotHash) throw new Error('provider-policy-snapshot-missing');
  const current = toGradingProviderPolicySnapshot(input.currentPolicy);
  if (!current || externalProcessingPolicyHash(current) !== input.snapshotHash) throw new Error('provider-policy-snapshot-mismatch');
  if (!current.enabled || current.disabledAt) throw new Error('provider-policy-disabled');
  if (input.expectedPurpose && (snapshot.purpose !== input.expectedPurpose || current.purpose !== input.expectedPurpose)) throw new Error('provider-policy-purpose-mismatch');
  return snapshot;
}

async function resolveWorkerGradingProviderPolicy(input: {
  db: MathGradingDb;
  policyId?: string | null;
  snapshot?: unknown;
  snapshotHash?: string | null;
  fallbackPolicy?: unknown;
  expectedPurpose?: ExternalProcessingPolicy['purpose'];
}): Promise<ExternalProcessingPolicy | null> {
  if (!input.policyId) {
    const fallback = normalizeExternalProcessingPolicy(input.fallbackPolicy as Record<string, unknown> | null | undefined);
    if (input.expectedPurpose && fallback && fallback.purpose !== input.expectedPurpose) throw new Error('provider-policy-purpose-mismatch');
    return fallback;
  }
  const repository = (input.db as any).gradingProviderPolicy;
  const currentPolicy = repository?.findUnique
    ? await repository.findUnique({ where: { id: input.policyId }, select: GRADING_PROVIDER_POLICY_SELECT })
    : input.fallbackPolicy;
  return assertCurrentGradingProviderPolicy({ policyId: input.policyId, snapshot: input.snapshot, snapshotHash: input.snapshotHash, currentPolicy, expectedPurpose: input.expectedPurpose });
}

function isUniqueConstraintError(error: unknown): boolean {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
  const message = error instanceof Error ? error.message : String(error);
  return code === 'P2002' || /unique constraint|duplicate key/i.test(message);
}

export async function materializeTextAnswerEvidence(input: {
  db: MathGradingDb;
  attemptId: string;
  actor: PipelineActor;
  operation?: string;
  idempotencyKey?: string;
  requestHash?: string;
  retentionExpiresAt?: Date | null;
  now?: Date;
}): Promise<EvidencePersistenceResult> {
  const now = input.now ?? new Date();
  const attempt = await input.db.submissionAttempt.findUnique({
    where: { id: input.attemptId },
    include: {
      answer: {
        include: {
          submission: {
            include: {
              audience: { select: { classId: true, class: { select: { teacherId: true } } } },
            },
          },
          question: true,
          assets: { where: { attemptId: input.attemptId, state: 'FINALIZED' }, orderBy: { version: 'desc' }, take: 1 },
        },
      },
    },
  });
  if (!attempt) throw new Error('answer-attempt-not-found');
  if (!attempt.answer?.submission || !attempt.answer.question || !attempt.answer.submission.audience?.class || !attempt.answer.submission.frozenAudienceClassId || !attempt.answer.question.assignmentRevisionId) {
    throw new Error('grading-content-unavailable:association-missing');
  }
  const classId = attempt.answer.submission.frozenAudienceClassId;
  if (attempt.answer.submission.audience.classId !== classId) throw new Error('answer-class-binding-invalid');
  const purpose = input.actor.role === 'STUDENT'
    ? 'submit'
    : input.actor.role === 'TEACHER'
      ? 'teacher-review'
      : 'service';
  await assertPipelineActorScope({
    db: input.db,
    actor: input.actor,
    assignmentRevisionId: attempt.answer.question.assignmentRevisionId,
    classId,
    classTeacherId: attempt.answer.submission.audience.class.teacherId,
    ownerStudentId: attempt.answer.submission.frozenStudentId,
    requestedStudentId: attempt.answer.submission.studentId,
    purpose,
    now,
  });
  const lifecyclePolicies = await requireConfiguredLifecyclePolicies(input.db, ['answer-evidence']);
  const evidenceLifecycle = freezeLifecyclePolicy(lifecyclePolicies.find((policy: any) => policy.dataClass === 'answer-evidence'), now);
  const normalized = normalizeTextAnswerEvidence(attempt.textSnapshot ?? '');
  const version = attempt.answerVersion;
  const evidenceId = `evidence:${attempt.id}:${version}`;
  const operation = input.operation ?? 'answer-evidence';
  const requestHash = buildGradingRequestHash(operation, {
    attemptId: attempt.id,
    answerVersion: version,
    sourceHash: normalized.sourceHash,
    callerRequestHash: input.requestHash ?? null,
  });
  const createEvidence = async (db: MathGradingDb): Promise<{ evidence: any; replay: boolean }> => {
    const existing = await db.answerEvidence.findFirst({ where: { attemptId: attempt.id, version }, include: { blocks: true } });
    if (existing) return { evidence: existing, replay: true };
    const evidence = await db.answerEvidence.create({
      data: {
        id: evidenceId,
        attemptId: attempt.id,
        sourceAssetId: attempt.answer.assets[0]?.id ?? null,
        version,
        sourceKind: 'TEXT_NATIVE',
        sourceHash: normalized.sourceHash,
        canonicalMarkdown: normalized.canonicalMarkdown,
        anchorVersion: normalized.anchorVersion,
        precision: normalized.precision.toUpperCase(),
        readiness: normalized.readiness === 'ready' ? 'READY' : 'BLOCKED',
        limitationState: normalized.limitationState,
        limitations: normalized.limitations,
        ...evidenceLifecycle,
        createdAt: now,
        updatedAt: now,
        blocks: {
          create: normalized.blocks.map((block) => ({
            id: `${evidenceId}:${block.id}`,
            blockIndex: block.blockIndex,
            pageNumber: block.pageNumber ?? null,
            text: block.text,
            markdown: block.markdown ?? block.text,
            spanStart: block.spanStart ?? null,
            spanEnd: block.spanEnd ?? null,
            bbox: block.bbox ?? undefined,
            precision: (block.precision ?? normalized.precision).toUpperCase(),
            confidence: block.confidence ?? 1,
            sourceHash: normalized.sourceHash,
          })),
        },
      },
      include: { blocks: true },
    });
    return { evidence, replay: false };
  };
  const requestResult: { value: any; replay: boolean } = input.idempotencyKey
    ? await withGradingRequestIdempotency({
      db: input.db,
      actor: input.actor,
      operation,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      resourceType: 'AnswerEvidence',
      now,
      load: async (db, resourceId) => {
        if (db.answerEvidence.findUnique) return db.answerEvidence.findUnique({ where: { id: resourceId }, include: { blocks: true } });
        return db.answerEvidence.findFirst({ where: { id: resourceId }, include: { blocks: true } });
      },
      recoverUniqueConstraint: async (db) => {
        const evidence = await db.answerEvidence.findFirst({ where: { attemptId: input.attemptId, version }, include: { blocks: true } });
        return evidence ? { resourceId: evidence.id, value: evidence, replay: true } : null;
      },
      create: async (db) => {
        const created = await createEvidence(db);
        if (!created.replay) {
          await writeGradingAudit(db, {
            actor: input.actor,
            action: 'answer-evidence.materialized',
            purpose: 'answer-conversion',
            resourceType: 'AnswerEvidence',
            resourceId: created.evidence.id,
            answerId: attempt.answerId,
            classId: attempt.answer.submission.frozenAudienceClassId,
            metadata: { sourceKind: 'TEXT_NATIVE', readiness: created.evidence.readiness, version },
          });
        }
        return { resourceId: created.evidence.id, value: created.evidence, replay: created.replay };
      },
    })
    : await (async () => {
      const execute = async (db: MathGradingDb) => {
        const created = await createEvidence(db);
        if (!created.replay) {
          await writeGradingAudit(db, {
            actor: input.actor,
            action: 'answer-evidence.materialized',
            purpose: 'answer-conversion',
            resourceType: 'AnswerEvidence',
            resourceId: created.evidence.id,
            answerId: attempt.answerId,
            classId: attempt.answer.submission.frozenAudienceClassId,
            metadata: { sourceKind: 'TEXT_NATIVE', readiness: created.evidence.readiness, version },
          });
        }
        return { value: created.evidence, replay: created.replay };
      };
      return input.db.$transaction ? input.db.$transaction(execute) : execute(input.db);
    })();
  return { evidence: requestResult.value, replay: requestResult.replay };
}

export async function materializeAssignmentAnswerEvidence(input: {
  db: MathGradingDb;
  attemptId: string;
  answerVersion: number;
  normalized: NormalizedAnswerEvidence;
  sourceManifest: Record<string, unknown>;
  actor: PipelineActor;
  now?: Date;
}): Promise<EvidencePersistenceResult> {
  const now = input.now ?? new Date();
  const lifecycle = freezeLifecyclePolicy(
    (await requireConfiguredLifecyclePolicies(input.db, ['answer-evidence']))
      .find((policy: any) => policy.dataClass === 'answer-evidence'),
    now,
  );
  const persist = async (db: MathGradingDb) => {
    if (typeof db.$queryRawUnsafe === 'function') {
      await db.$queryRawUnsafe(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))::text AS "lock"',
        `assignment-answer-evidence:${input.attemptId}`,
      );
    }
    const existing = await db.answerEvidence.findFirst({
      where: {
        attemptId: input.attemptId,
        sourceHash: input.normalized.sourceHash,
        anchorVersion: input.normalized.anchorVersion,
      },
      include: { blocks: true },
    });
    if (existing) return { evidence: existing, replay: true };
    const latest = await db.answerEvidence.findFirst({
      where: { attemptId: input.attemptId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = Math.max(
      input.answerVersion,
      (latest?.version ?? 0) + 1,
    );
    const evidenceId = `evidence:${input.attemptId}:${version}`;
    const data = {
      attemptId: input.attemptId,
      sourceAssetId: null,
      conversionId: null,
      version,
      sourceKind: input.normalized.sourceKind === 'text-native'
        ? 'TEXT_NATIVE'
        : 'DOCUMENT',
      sourceHash: input.normalized.sourceHash,
      canonicalMarkdown: input.normalized.canonicalMarkdown,
      anchorVersion: input.normalized.anchorVersion,
      precision: input.normalized.precision.toUpperCase(),
      readiness: input.normalized.readiness === 'ready' ? 'READY' : 'BLOCKED',
      limitationState: input.normalized.limitationState,
      limitations: input.normalized.limitations,
      sourceManifest: input.sourceManifest,
      ...lifecycle,
      updatedAt: now,
    };
    const blocks = buildPersistedAnswerEvidenceBlocks({
      normalized: input.normalized,
      conversionId: evidenceId,
      evidenceId,
      sourceHash: input.normalized.sourceHash,
      now,
    });
    const evidence = await db.answerEvidence.create({
      data: {
        id: evidenceId,
        ...data,
        createdAt: now,
        blocks: { create: nestedAnswerEvidenceBlocks(blocks) },
      },
      include: { blocks: true },
    });
    await writeGradingAudit(db, {
      actor: input.actor,
      action: 'answer-evidence.assignment-manifest-materialized',
      purpose: 'answer-conversion',
      resourceType: 'AnswerEvidence',
      resourceId: evidence.id,
      metadata: {
        manifestVersion: input.sourceManifest.version,
        limitationState: input.normalized.limitationState,
        sourceCount: Array.isArray(input.sourceManifest.sources)
          ? input.sourceManifest.sources.length
          : 0,
      },
    });
    return { evidence, replay: false };
  };
  const result = input.db.$transaction
    ? await input.db.$transaction(persist)
    : await persist(input.db);
  return result;
}

export async function enqueueDocumentConversion(input: {
  db: MathGradingDb;
  assetId: string;
  attemptId: string;
  actor: PipelineActor;
  adapterVersion: string;
  policyId?: string | null;
  policySnapshot?: ExternalProcessingPolicy | null;
  policySnapshotHash?: string | null;
  visualPolicyId?: string | null;
  visualPolicySnapshot?: ExternalProcessingPolicy | null;
  visualPolicySnapshotHash?: string | null;
  allowDefaultPolicyDiscovery?: boolean;
  idempotencyKey: string;
  reason?: string;
  rerunIdentity?: string | null;
  retentionExpiresAt?: Date | null;
  now?: Date;
}): Promise<{ conversion: any; job: any; replay: boolean }> {
  const now = input.now ?? new Date();
  const asset = await input.db.submissionAsset.findUnique({
    where: { id: input.assetId },
    include: {
      answer: {
        include: {
          submission: {
            include: {
              audience: { select: { classId: true, class: { select: { teacherId: true } } } },
            },
          },
          question: true,
        },
      },
      attempt: true,
    },
  });
  if (!asset) throw new Error('conversion-content-unavailable:asset-missing');
  if (asset.answerId === null || asset.attemptId === null || !asset.answer || !asset.attempt) throw new Error('conversion-content-unavailable:association-missing');
  if (asset.attemptId !== input.attemptId || asset.attempt.id !== input.attemptId || asset.attempt.answerId !== asset.answerId) throw new Error('conversion-asset-binding-invalid');
  if (!asset.answer.submission || !asset.answer.question || !asset.answer.submission.audience?.class || !asset.answer.submission.frozenAudienceClassId || !asset.answer.question.assignmentRevisionId) throw new Error('conversion-content-unavailable:association-missing');
  if (asset.state !== 'FINALIZED' || asset.scanState !== 'CLEAN') throw new Error('conversion-source-not-finalized-clean');
  const classId = asset.answer.submission.frozenAudienceClassId;
  if (asset.answer.submission.audience.classId !== classId) throw new Error('conversion-class-binding-invalid');
  await assertPipelineActorScope({
    db: input.db,
    actor: input.actor,
    assignmentRevisionId: asset.answer.question.assignmentRevisionId,
    classId,
    classTeacherId: asset.answer.submission.audience.class.teacherId,
    ownerStudentId: asset.answer.submission.frozenStudentId,
    purpose: input.actor.role === 'SERVICE' || input.actor.role === 'ADMIN' ? 'service' : 'teacher-review',
    now,
  });
  const lifecyclePolicies = await requireConfiguredLifecyclePolicies(input.db, ['answer-evidence', 'document-conversion']);
  const conversionLifecycle = freezeLifecyclePolicy(lifecyclePolicies.find((policy: any) => policy.dataClass === 'document-conversion'), now);
  const mathpixEnabled = ['1', 'true', 'yes'].includes((process.env.GRADING_MATHPIX_ENABLED ?? '').trim().toLowerCase());
  const seededVersion = (process.env.GRADING_MATHPIX_POLICY_VERSION ?? process.env.MATHPIX_VERSION ?? '').trim();
  const resolvedPolicyId = input.policyId ?? (input.allowDefaultPolicyDiscovery !== false && !input.policySnapshot && mathpixEnabled && seededVersion
    ? gradingMathpixPolicyId(seededVersion, asset.mimeType.trim().toLowerCase().startsWith('image/') ? 'image' : 'document')
    : null);
  const policyRow = resolvedPolicyId
    ? await input.db.gradingProviderPolicy.findUnique({ where: { id: resolvedPolicyId }, select: GRADING_PROVIDER_POLICY_SELECT })
    : null;
  if (resolvedPolicyId && !policyRow) throw new Error('grading-provider-policy-not-found');
  const currentPolicy = toGradingProviderPolicySnapshot(policyRow);
  const policySnapshot = normalizeExternalProcessingPolicy(input.policySnapshot ?? currentPolicy);
  const policySnapshotHash = input.policySnapshotHash ?? externalProcessingPolicyHash(policySnapshot);
  if (resolvedPolicyId && input.policySnapshotHash && externalProcessingPolicyHash(currentPolicy) !== input.policySnapshotHash) throw new Error('provider-policy-snapshot-mismatch');
  assertAnswerConversionPolicyMatchesMime(policySnapshot, asset.mimeType);
  const visualPolicyRow = input.visualPolicyId
    ? await input.db.gradingProviderPolicy.findUnique({ where: { id: input.visualPolicyId }, select: GRADING_PROVIDER_POLICY_SELECT })
    : null;
  if (input.visualPolicyId && !visualPolicyRow) throw new Error('grading-provider-policy-not-found');
  const currentVisualPolicy = toGradingProviderPolicySnapshot(visualPolicyRow);
  const visualPolicySnapshot = normalizeExternalProcessingPolicy(input.visualPolicySnapshot ?? currentVisualPolicy);
  const visualPolicySnapshotHash = input.visualPolicySnapshotHash ?? externalProcessingPolicyHash(visualPolicySnapshot);
  if (input.visualPolicyId && input.visualPolicySnapshotHash && externalProcessingPolicyHash(currentVisualPolicy) !== input.visualPolicySnapshotHash) throw new Error('provider-policy-snapshot-mismatch');
  if (visualPolicySnapshot && visualPolicySnapshot.purpose !== 'visual-description') throw new Error('provider-policy-purpose-mismatch');
  const requestHash = buildGradingRequestHash('document-conversion', {
    assetId: input.assetId.trim(),
    attemptId: input.attemptId.trim(),
    adapterVersion: input.adapterVersion.trim(),
    policyId: resolvedPolicyId,
    visualPolicyId: input.visualPolicyId ?? null,
    reason: input.reason?.trim() || null,
  });
  const dedupeKey = buildPipelineDedupeKey('document-conversion', {
    assetId: asset.id,
    checksum: asset.checksum,
    adapterVersion: input.adapterVersion,
    policySnapshotHash,
    visualPolicySnapshotHash,
    rerunIdentity: input.rerunIdentity ?? null,
  });
  const requestResult = await withGradingRequestIdempotency({
    db: input.db,
    actor: input.actor,
    operation: 'document-conversion',
    idempotencyKey: input.idempotencyKey,
    requestHash,
    resourceType: 'DocumentConversion',
    now,
    load: async (db, resourceId) => {
      const row = await db.documentConversion.findUnique({ where: { id: resourceId }, include: { jobs: true } });
      return row ? { conversion: row, job: row.jobs?.[0] ?? null } : null;
    },
    recoverUniqueConstraint: async (db) => {
      const row = await db.documentConversion.findUnique({ where: { dedupeKey }, include: { jobs: true } });
      return row ? { resourceId: row.id, value: { conversion: row, job: row.jobs?.[0] ?? null }, replay: true } : null;
    },
    create: async (db) => {
      const existing = await db.documentConversion.findUnique({ where: { dedupeKey }, include: { jobs: true } });
      if (existing) return { resourceId: existing.id, value: { conversion: existing, job: existing.jobs?.[0] ?? null }, replay: true };
      const lockedAsset = await lockAndLoadConversionAsset(db, input.assetId, input.attemptId);
      const versionRow = await db.documentConversion.findFirst({ where: { assetId: lockedAsset.id }, orderBy: { version: 'desc' }, select: { version: true } });
      const conversion = await db.documentConversion.create({
        data: {
          id: `conversion:${lockedAsset.id}:${(versionRow?.version ?? 0) + 1}`,
          assetId: lockedAsset.id,
          attemptId: input.attemptId,
          policyId: resolvedPolicyId,
          policySnapshot: policySnapshot ?? null,
          policySnapshotHash,
          visualPolicyId: input.visualPolicyId ?? null,
          visualPolicySnapshot: visualPolicySnapshot ?? null,
          visualPolicySnapshotHash,
          ...conversionLifecycle,
          version: (versionRow?.version ?? 0) + 1,
          dedupeKey,
          adapter: 'pending-router',
          adapterVersion: input.adapterVersion,
          sourceChecksum: lockedAsset.checksum,
          state: 'QUEUED',
          progress: 0,
          createdAt: now,
          updatedAt: now,
        },
      });
      const job = await createJob(db, {
        kind: 'CONVERSION',
        dedupeKey: buildPipelineDedupeKey('conversion-job', { conversionId: conversion.id, idempotencyKey: input.idempotencyKey }),
        idempotencyKey: input.idempotencyKey,
        reason: input.reason ?? null,
        rerunIdentity: input.rerunIdentity ?? null,
        attemptId: input.attemptId,
        conversionId: conversion.id,
        policyId: resolvedPolicyId,
        correlationId: randomUUID(),
        now,
      });
      await writeGradingAudit(db, {
        actor: input.actor,
        action: 'document-conversion.enqueued',
        purpose: 'answer-conversion',
        resourceType: 'DocumentConversion',
        resourceId: conversion.id,
        answerId: asset.answerId,
        classId: asset.answer.submission.frozenAudienceClassId,
        metadata: { dedupeKey, idempotencyKey: input.idempotencyKey, sourceChecksum: lockedAsset.checksum },
      });
      return { resourceId: conversion.id, value: { conversion, job } };
    },
  });
  return { ...requestResult.value, replay: requestResult.replay };
}

function assertAnswerConversionPolicyMatchesMime(policy: ExternalProcessingPolicy | null, mimeType: string): void {
  if (!policy) return;
  if (policy.purpose !== 'answer-conversion') throw new Error('provider-policy-purpose-mismatch');
  if (!policy.enabled || policy.disabledAt) throw new Error('provider-policy-disabled');
  if (policy.provider !== 'mathpix') return;
  let path: string;
  try {
    path = new URL(policy.endpoint ?? '').pathname.replace(/\/+$/, '');
  } catch {
    throw new Error('provider-policy-endpoint-invalid');
  }
  const expectedPath = mimeType.trim().toLowerCase().startsWith('image/') ? '/v3/text' : '/v3/pdf';
  if (path !== expectedPath) throw new Error('provider-policy-mime-endpoint-mismatch');
}

async function lockAndLoadConversionAsset(db: MathGradingDb, assetId: string, attemptId: string): Promise<any> {
  if (typeof (db as any).$queryRawUnsafe === 'function') {
    await (db as any).$queryRawUnsafe('SELECT "id" FROM "SubmissionAsset" WHERE "id" = $1 FOR UPDATE', assetId);
  }
  const locked = await db.submissionAsset.findUnique({
    where: { id: assetId },
    include: {
      answer: {
        include: {
          submission: { include: { audience: { select: { classId: true, class: { select: { teacherId: true } } } } } },
          question: true,
        },
      },
      attempt: true,
    },
  });
  if (!locked) throw new Error('conversion-content-unavailable:asset-missing');
  if (locked.answerId === null || locked.attemptId === null || !locked.answer || !locked.attempt) throw new Error('conversion-content-unavailable:association-missing');
  if (locked.attemptId !== attemptId || locked.attempt.id !== attemptId || locked.attempt.answerId !== locked.answerId) throw new Error('conversion-asset-binding-invalid');
  if (!locked.answer.submission || !locked.answer.question || !locked.answer.submission.audience?.class || !locked.answer.submission.frozenAudienceClassId || !locked.answer.question.assignmentRevisionId) throw new Error('conversion-content-unavailable:association-missing');
  if (locked.state !== 'FINALIZED' || locked.scanState !== 'CLEAN') throw new Error('conversion-source-not-finalized-clean');
  return locked;
}

export async function cancelDocumentConversion(input: {
  db: MathGradingDb;
  conversionId: string;
  actor: PipelineActor;
  idempotencyKey?: string;
  requestHash?: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const conversion = await input.db.documentConversion.findUnique({
    where: { id: input.conversionId },
    include: {
      asset: { include: { answer: { include: { question: true, submission: { include: { audience: { select: { classId: true, class: { select: { teacherId: true } } } } } } } } } },
    },
  });
  if (!conversion) throw new Error('conversion-not-found');
  if (conversion.assetId === null || conversion.attemptId === null || !conversion.asset?.answer || !conversion.asset.answer.submission || !conversion.asset.answer.question || !conversion.asset.answer.submission.audience?.class || !conversion.asset.answer.submission.frozenAudienceClassId || !conversion.asset.answer.question.assignmentRevisionId) throw new Error('conversion-content-unavailable:association-missing');
  await assertConversionTeacherScope(conversion.asset.answer.submission, input.actor, conversion.asset.answer.question.assignmentRevisionId, now, input.db);
  const cancel = async (db: MathGradingDb) => {
    const write = { cancellationRequestedAt: now, updatedAt: now };
    let updated;
    if (db.documentConversion?.updateMany) {
      const result = await db.documentConversion.updateMany({ where: { id: conversion.id, state: { not: 'DELETED' } }, data: write });
      if (result?.count === 0 && db.documentConversion.findUnique) updated = await db.documentConversion.findUnique({ where: { id: conversion.id } });
      else if (db.documentConversion.findUnique) updated = await db.documentConversion.findUnique({ where: { id: conversion.id } });
    }
    if (!updated) updated = await db.documentConversion.update({ where: { id: conversion.id }, data: write });
    await db.gradingJob?.updateMany?.({ where: { conversionId: conversion.id, state: { in: ['QUEUED', 'RUNNING', 'RETRYABLE'] } }, data: { cancelRequestedAt: now, updatedAt: now } });
    await writeGradingAudit(db, {
      actor: input.actor,
      action: 'document-conversion.cancellation-requested',
      purpose: 'answer-conversion',
      resourceType: 'DocumentConversion',
      resourceId: conversion.id,
      answerId: conversion.asset.answerId,
      classId: conversion.asset.answer.submission.frozenAudienceClassId,
      metadata: { idempotencyKey: input.idempotencyKey ?? null },
    });
    return updated;
  };
  const result = input.idempotencyKey
    ? await withGradingRequestIdempotency({
      db: input.db,
      actor: input.actor,
      operation: 'document-conversion-cancel',
      idempotencyKey: input.idempotencyKey,
      requestHash: input.requestHash ?? buildGradingRequestHash('document-conversion-cancel', { conversionId: conversion.id }),
      resourceType: 'DocumentConversion',
      now,
      load: async (db, resourceId) => db.documentConversion.findUnique({ where: { id: resourceId } }),
      create: async (db) => ({ resourceId: conversion.id, value: await cancel(db) }),
    })
    : { value: await (input.db.$transaction ? input.db.$transaction(cancel) : cancel(input.db)), replay: false };
  return { ...result.value, replay: result.replay };
}

export async function retryDocumentConversion(input: {
  db: MathGradingDb;
  conversionId: string;
  actor: PipelineActor;
  idempotencyKey: string;
  reason: string;
  now?: Date;
}) {
  const conversion = await input.db.documentConversion.findUnique({
    where: { id: input.conversionId },
    include: {
      asset: { include: { answer: { include: { question: true, submission: { include: { audience: { select: { classId: true, class: { select: { teacherId: true } } } } } } } } } },
    },
  });
  if (!conversion) throw new Error('conversion-not-found');
  if (conversion.assetId === null || conversion.attemptId === null || !conversion.asset?.answer || !conversion.asset.answer.submission || !conversion.asset.answer.question || !conversion.asset.answer.submission.audience?.class || !conversion.asset.answer.submission.frozenAudienceClassId || !conversion.asset.answer.question.assignmentRevisionId) throw new Error('conversion-content-unavailable:association-missing');
  await assertConversionTeacherScope(conversion.asset.answer.submission, input.actor, conversion.asset.answer.question.assignmentRevisionId, input.now ?? new Date(), input.db);
  if (!input.reason.trim()) throw new Error('conversion-retry-reason-required');
  if (!['FAILED', 'RETRYABLE', 'BLOCKED'].includes(conversion.state)) throw new Error('conversion-not-retryable');
  const rerunReason = input.reason.trim();
  const rerunIdentity = buildRerunIdentity({ kind: 'conversion', sourceId: conversion.id, reason: rerunReason, inputHash: conversion.sourceChecksum, versionBoundary: conversion.adapterVersion, idempotencyKey: input.idempotencyKey });
  return enqueueDocumentConversion({
    db: input.db,
    assetId: conversion.assetId,
    attemptId: conversion.attemptId,
    actor: input.actor,
    adapterVersion: conversion.adapterVersion,
    policyId: conversion.policyId,
    policySnapshot: conversion.policySnapshot ?? null,
    policySnapshotHash: conversion.policySnapshotHash ?? null,
    allowDefaultPolicyDiscovery: conversion.adapterVersion !== 'assignment-understanding.v1',
    idempotencyKey: input.idempotencyKey,
    rerunIdentity,
    reason: `conversion-rerun:${rerunReason}`,
    now: input.now,
  });
}

export async function processDocumentConversionJob(input: {
  db: MathGradingDb;
  jobId: string;
  workerClaimToken?: string;
  store?: SubmissionObjectStore;
  mathpix?: MathpixClient;
  local?: LocalDocumentConverter;
  visualProvider?: GradingProviderRuntime;
  persistEvidence?: boolean;
  writeRendered?: (input: { key: string; bytes: Uint8Array; mimeType: string; checksum: string; ownerId: string; answerId: string; attemptId: string; workerClaimToken: string; signal?: AbortSignal }) => Promise<string>;
  renderPdfPages?: typeof renderPdfPagesToPng;
  signal?: AbortSignal;
  parentLeaseLost?: () => Promise<boolean> | boolean;
  now?: Date;
}): Promise<{ conversion: any; evidence: any | null }> {
  const now = input.now ?? new Date();
  const job = await input.db.gradingJob.findUnique({ where: { id: input.jobId }, include: { conversion: { include: { answerEvidence: { include: { blocks: true } }, asset: { include: { answer: { include: { submission: true, question: true } } } }, attempt: true, policy: true, visualPolicy: true } } } });
  if (!job?.conversion) throw new Error('conversion-job-not-found');
  const terminalConversion = ['SUCCEEDED', 'FALLBACK', 'BLOCKED', 'FAILED', 'CANCELLED', 'CONTENT_UNAVAILABLE', 'DELETED'].includes(job.conversion.state);
  const terminalJob = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(job.state);
  if (terminalConversion || terminalJob) {
    if (terminalConversion && !terminalJob && input.db.gradingJob?.update) {
      await input.db.gradingJob.update({
        where: { id: job.id },
        data: {
          state: conversionTerminalJobState(job.conversion.state),
          progress: 100,
          completedAt: now,
          updatedAt: now,
        },
      }).catch(() => undefined);
    }
    return { conversion: job.conversion, evidence: job.conversion.answerEvidence ?? null };
  }
  if (job.cancelRequestedAt || job.conversion.cancellationRequestedAt) {
    return settleCancelledConversion(input.db, job, job.conversion, now);
  }
  const policy = await resolveWorkerGradingProviderPolicy({ db: input.db, policyId: job.conversion.policyId, snapshot: job.conversion.policySnapshot, snapshotHash: job.conversion.policySnapshotHash, fallbackPolicy: job.conversion.policy, expectedPurpose: 'answer-conversion' });
  const visualPolicy = job.conversion.visualPolicyId || job.conversion.visualPolicySnapshot
    ? await resolveWorkerGradingProviderPolicy({ db: input.db, policyId: job.conversion.visualPolicyId, snapshot: job.conversion.visualPolicySnapshot, snapshotHash: job.conversion.visualPolicySnapshotHash, fallbackPolicy: job.conversion.visualPolicy, expectedPurpose: 'visual-description' })
    : null;
  const workerClaimToken = input.workerClaimToken ?? randomUUID();
  const store = input.store ?? createSubmissionObjectStore();
  const renderedCandidateKey = `grading-rendered/${job.conversion.id}/${job.conversion.attemptId}/${sha256(workerClaimToken).slice(0, 32)}`;
  let renderedObjectKey: string | null = null;
  let renderedChecksum: string | null = null;
  const visualObjectKeys: Array<{ key: string; checksum: string }> = [];
  let leaseHeartbeat: ReturnType<typeof startGradingJobLeaseHeartbeat> | null = null;
  const leaseAbortController = new AbortController();
  if (input.signal?.aborted) leaseAbortController.abort();
  else input.signal?.addEventListener('abort', () => leaseAbortController.abort(), { once: true });
  try {
    await input.db.$transaction(async (tx: any) => {
      await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['QUEUED', 'RETRYABLE'], fencedCode: 'conversion-worker-fenced', fallback: job, where: { cancelRequestedAt: null }, data: { state: 'RUNNING', startedAt: now, attemptCount: { increment: 1 }, ...gradingJobLeaseData(workerClaimToken, now), updatedAt: now } });
      await updateActivePersistedRecord({ model: tx.documentConversion, id: job.conversion.id, activeStates: ['QUEUED', 'RETRYABLE'], fencedCode: 'conversion-worker-fenced', fallback: job.conversion, where: { cancellationRequestedAt: null }, data: { state: 'RUNNING', progress: 10, startedAt: now, updatedAt: now } });
      await writeGradingAudit(tx, {
        actor: { id: 'grading-worker', role: 'SERVICE' },
        action: 'document-conversion.started',
        purpose: 'answer-conversion',
        resourceType: 'DocumentConversion',
        resourceId: job.conversion.id,
        answerId: job.conversion.asset?.answerId,
        classId: job.conversion.asset?.answer?.submission?.frozenAudienceClassId,
        policyVersion: job.conversion.policy?.version,
        metadata: { state: 'RUNNING' },
      });
    });
    leaseHeartbeat = startGradingJobLeaseHeartbeat({ db: input.db, jobId: job.id, workerClaimToken, onLost: () => leaseAbortController.abort() });
    if (input.parentLeaseLost && await input.parentLeaseLost()) throw new Error('conversion-worker-fenced');
    await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, now, fencedCode: 'conversion-worker-fenced' });
    if (!job.conversion.asset || !job.conversion.asset.answerId || !job.conversion.attemptId || job.conversion.asset.answer === null || job.conversion.asset.answer?.submission === null || job.conversion.asset.answer?.question === null || job.conversion.asset.answer?.submission?.audience === null || job.conversion.asset.answer?.submission?.frozenAudienceClassId === null || job.conversion.asset.answer?.question?.assignmentRevisionId === null) throw new Error('conversion-content-unavailable:association-missing');
    if (await isConversionCancellationRequested(input.db, job.id, job.conversion.id, job, job.conversion)) return settleCancelledConversion(input.db, job, job.conversion, now, workerClaimToken);
  const source: ProtectedSubmissionSource = {
    assetId: job.conversion.asset.id,
    attemptId: job.conversion.attemptId,
    answerId: job.conversion.asset.answerId,
    ownerId: job.conversion.asset.answer?.submission?.frozenStudentId ?? '',
    objectKey: job.conversion.asset.objectKey,
    originalName: job.conversion.asset.originalName,
    mimeType: job.conversion.asset.mimeType,
    sizeBytes: job.conversion.asset.sizeBytes,
    checksum: job.conversion.asset.checksum,
    classId: job.conversion.asset.answer?.submission?.frozenAudienceClassId ?? '',
  };
  const providerPolicy = await resolveWorkerGradingProviderPolicy({ db: input.db, policyId: job.conversion.policyId, snapshot: job.conversion.policySnapshot, snapshotHash: job.conversion.policySnapshotHash, fallbackPolicy: job.conversion.policy, expectedPurpose: 'answer-conversion' });
  const result = await convertProtectedSubmission({
    source,
    store,
    policy: providerPolicy ?? policy,
    mathpix: input.mathpix,
    local: input.local,
    assignmentResponse: job.conversion.adapterVersion === 'assignment-understanding.v1',
    expectedQuestionIds: job.conversion.asset?.answer?.question?.stableQuestionId
      ? [job.conversion.asset.answer.question.stableQuestionId]
      : undefined,
    now,
    isCancellationRequested: () => isConversionCancellationRequested(input.db, job.id, job.conversion.id, job, job.conversion),
    isLeaseLost: async () => {
      if (input.parentLeaseLost && await input.parentLeaseLost()) {
        leaseAbortController.abort();
        return true;
      }
      const renewed = await renewGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken });
      if (!renewed) leaseAbortController.abort();
      return !renewed || Boolean(leaseHeartbeat?.isLost());
    },
    idempotencyKey: sha256(`conversion:${job.conversion.id}:${job.conversion.version ?? job.id}`),
    signal: leaseAbortController.signal,
  });
  await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, now, fencedCode: 'conversion-worker-fenced' });
  if (await isConversionCancellationRequested(input.db, job.id, job.conversion.id, job, job.conversion)) return settleCancelledConversion(input.db, job, job.conversion, now, workerClaimToken);
  const visualPreparation = await prepareConversionVisualEvidence({
    conversionId: job.conversion.id,
    attemptId: source.attemptId,
    questionId: job.conversion.asset?.answer?.assignmentQuestionId ?? null,
    source,
    result,
    store,
    classId: source.classId,
    renderPdfPages: input.renderPdfPages,
    now,
  });
  if (visualPreparation.items.length > 0 && !input.writeRendered) throw new Error('visual-evidence-object-writer-unavailable');
  for (const [index, visual] of visualPreparation.items.entries()) {
    await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, fencedCode: 'conversion-worker-fenced' });
    const candidateKey = `grading-visual/${job.conversion.id}/${source.attemptId}/${sha256(`${workerClaimToken}:${index}:${visual.contentHash}`).slice(7, 39)}`;
    const objectKey = await input.writeRendered!({
      key: candidateKey,
      bytes: visual.bytes,
      mimeType: visual.mediaType,
      checksum: visual.imageChecksum,
      ownerId: source.ownerId,
      answerId: source.answerId,
      attemptId: source.attemptId,
      workerClaimToken,
      signal: leaseAbortController.signal,
    });
    visualObjectKeys.push({ key: objectKey, checksum: visual.imageChecksum });
    if (visualPolicy) {
      const description = await describeVisualEvidence({
        attachment: { kind: 'image', data: visual.bytes, mediaType: visual.mediaType, checksum: visual.imageChecksum, questionId: visual.questionId },
        questionId: visual.questionId ?? '',
        pageNumber: visual.pageNumber,
        classId: source.classId,
        policy: visualPolicy,
        provider: input.visualProvider,
        idempotencyKey: `visual-description:${job.conversion.id}:${visual.id}`,
        signal: leaseAbortController.signal,
      });
      const described = normalizeVisualEvidence({
        ...visual,
        description: description.description,
        confidence: description.confidence,
        pageNumber: description.pageNumber ?? visual.pageNumber,
        bbox: description.bbox ?? visual.bbox,
        limitations: description.limitations,
        processorVersion: `${visual.processorVersion}+${description.model}`,
      });
      visualPreparation.items[index] = { ...described, bytes: visual.bytes, mediaType: visual.mediaType, descriptionAudit: description };
    }
  }
  if (result.renderedBytes) {
    if (!input.writeRendered) throw new Error('rendered-object-writer-unavailable');
    await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, fencedCode: 'conversion-worker-fenced' });
    if (await isConversionCancellationRequested(input.db, job.id, job.conversion.id, job, job.conversion)) return settleCancelledConversion(input.db, job, job.conversion, now, workerClaimToken);
    renderedChecksum = sha256(result.renderedBytes);
    renderedObjectKey = renderedCandidateKey;
    renderedObjectKey = await input.writeRendered({ key: renderedCandidateKey, bytes: result.renderedBytes, mimeType: result.renderedMimeType ?? 'application/octet-stream', checksum: renderedChecksum, ownerId: source.ownerId, answerId: source.answerId, attemptId: source.attemptId, workerClaimToken, signal: leaseAbortController.signal });
    await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, fencedCode: 'conversion-worker-fenced' });
    if (await isConversionCancellationRequested(input.db, job.id, job.conversion.id, job, job.conversion)) {
      await deleteOwnedRenderedObject({ store, key: renderedObjectKey, ownerId: source.ownerId, answerId: source.answerId, checksum: renderedChecksum, attemptId: source.attemptId, workerClaimToken });
      return settleCancelledConversion(input.db, job, job.conversion, now, workerClaimToken);
    }
  }
  const visualEvidenceIncomplete = visualPreparation.items.some((item) => item.readiness !== 'ready')
    || visualPreparation.limitations.length > 0;
  const visualProjection = projectVisualEvidenceIntoDocument({
    markdown: result.markdown,
    blocks: result.blocks,
    visualEvidence: visualPreparation.items,
  });
  const normalized = visualEvidenceIncomplete
    ? normalizeDocumentEvidence({
        sourceHash: result.sourceChecksum,
        markdown: visualProjection.markdown,
        blocks: visualProjection.blocks,
        limitations: [...result.warnings, ...result.limitations, ...visualPreparation.limitations, ...visualProjection.limitations],
        anchorVersion: `${result.adapterVersion}:anchors`,
      })
    : normalizeDocumentEvidence({
        sourceHash: result.sourceChecksum,
        markdown: visualProjection.markdown,
        blocks: visualProjection.blocks,
        limitations: [...result.warnings, ...result.limitations, ...visualProjection.limitations],
        anchorVersion: `${result.adapterVersion}:anchors`,
      });
  await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, fencedCode: 'conversion-worker-fenced' });
  const configuredAnswerEvidenceLifecycle = freezeLifecyclePolicy((await requireConfiguredLifecyclePolicies(input.db, ['answer-evidence'])).find((policy: any) => policy.dataClass === 'answer-evidence'), now);
  const conversion = await input.db.$transaction(async (tx: any) => {
    await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['RUNNING'], fencedCode: 'conversion-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { updatedAt: now } });
    const warningCodes = [...new Set([
      ...result.warnings,
      ...result.limitations,
      ...visualPreparation.limitations,
      ...(visualEvidenceIncomplete ? ['visual-evidence-not-delivered'] : []),
    ])];
    const updated = await updateActivePersistedRecord({
      model: tx.documentConversion,
      id: job.conversion.id,
      activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'],
      fencedCode: 'conversion-worker-fenced',
      fallback: job.conversion,
      where: { cancellationRequestedAt: null },
      data: {
        adapter: result.adapter,
        adapterVersion: result.adapterVersion,
        state: result.state === 'succeeded' ? 'SUCCEEDED' : result.state === 'fallback' ? 'FALLBACK' : result.state === 'blocked' ? 'BLOCKED' : 'RETRYABLE',
        sourceChecksum: result.sourceChecksum,
        outputChecksum: result.outputChecksum,
        canonicalMarkdown: result.markdown || null,
        normalizedBlocks: normalized.blocks,
        renderedObjectKey,
        renderedChecksum,
        renderedPageCount: result.wordRepresentation?.renderedPdfPageCount ?? physicalPageCount(normalized.blocks),
        layoutRepresentation: buildConversionLayoutRepresentation(result),
        precision: result.precision.toUpperCase(),
        confidence: result.confidence,
        warningCodes,
        limitationState: normalized.limitationState,
        providerRequestId: result.providerRequestId,
        providerRequestedAt: result.providerRequestedAt,
        providerProcessedAt: result.providerProcessedAt,
        progress: 100,
        failureCode: result.state === 'failed' || result.state === 'blocked' ? result.limitations[0] ?? 'conversion-failed' : null,
        completedAt: now,
        updatedAt: now,
      },
    });
    await tx.gradingConversionWarning.createMany({
      data: warningCodes.map((code) => ({ conversionId: updated.id, code, detail: null, severity: result.state === 'blocked' ? 'blocked' : 'warning' })),
      skipDuplicates: true,
    });
    if (tx.documentConversionVisualEvidence) {
      await tx.documentConversionVisualEvidence.deleteMany({ where: { conversionId: updated.id } });
      if (visualPreparation.items.length > 0) {
        await tx.documentConversionVisualEvidence.createMany({
          data: visualPreparation.items.map((visual, index) => visualEvidencePersistenceData({
            conversionId: updated.id,
            attemptId: source.attemptId,
            visual,
            objectKey: visualObjectKeys[index]!.key,
            mediaType: visual.mediaType,
            sizeBytes: visual.bytes.byteLength,
            now,
          })),
        });
      }
    }
    const existingEvidence = input.persistEvidence === false
      ? null
      : await tx.answerEvidence.findFirst({ where: { conversionId: updated.id } });
    const answerEvidenceLifecycle = existingEvidence?.lifecyclePolicyId && existingEvidence.lifecyclePolicyVersion && existingEvidence.lifecycleDeleteStrategy
      ? {
        lifecyclePolicyId: existingEvidence.lifecyclePolicyId,
        lifecyclePolicyVersion: existingEvidence.lifecyclePolicyVersion,
        lifecycleDeleteStrategy: existingEvidence.lifecycleDeleteStrategy,
        lifecycleRetentionSeconds: existingEvidence.lifecycleRetentionSeconds ?? null,
        lifecycleGovernedRecordRule: existingEvidence.lifecycleGovernedRecordRule ?? null,
        lifecycleProviderRetentionSeconds: existingEvidence.lifecycleProviderRetentionSeconds ?? null,
        retentionExpiresAt: existingEvidence.retentionExpiresAt ?? null,
      }
      : configuredAnswerEvidenceLifecycle;
    const evidenceData = {
      attemptId: updated.attemptId,
      sourceAssetId: updated.assetId,
      conversionId: updated.id,
      version: updated.version,
      sourceKind: 'DOCUMENT',
      sourceHash: result.sourceChecksum,
      canonicalMarkdown: normalized.canonicalMarkdown,
      anchorVersion: normalized.anchorVersion,
      precision: normalized.precision.toUpperCase(),
      readiness: normalized.readiness === 'ready' && ['succeeded', 'fallback'].includes(result.state) ? 'READY' : 'BLOCKED',
      limitationState: normalized.limitationState,
      limitations: normalized.limitations,
      ...answerEvidenceLifecycle,
      updatedAt: now,
    };
    const evidenceId = existingEvidence?.id ?? `evidence:${updated.attemptId}:conversion:${updated.version}`;
    const persistedBlocks = buildPersistedAnswerEvidenceBlocks({ normalized, conversionId: updated.id, evidenceId, sourceHash: result.sourceChecksum, now });
    let evidence = null;
    if (input.persistEvidence === false) {
      evidence = null;
    } else if (existingEvidence) {
      const refreshed = await tx.answerEvidence.update({ where: { id: existingEvidence.id }, data: evidenceData });
      if (tx.answerEvidenceBlock?.deleteMany && tx.answerEvidenceBlock?.createMany) {
        await tx.answerEvidenceBlock.deleteMany({ where: { evidenceId: existingEvidence.id } });
        if (persistedBlocks.length > 0) await tx.answerEvidenceBlock.createMany({ data: persistedBlocks });
      }
      evidence = { ...refreshed, blocks: persistedBlocks };
    } else {
      evidence = await tx.answerEvidence.create({
        data: {
          id: evidenceId,
          ...evidenceData,
          createdAt: now,
          blocks: { create: nestedAnswerEvidenceBlocks(persistedBlocks) },
        },
        include: { blocks: true },
      });
    }
      await updateActivePersistedRecord({
        model: tx.gradingJob,
        id: job.id,
        activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'],
        fencedCode: 'conversion-worker-fenced',
        fallback: job,
        where: { cancelRequestedAt: null },
        leaseToken: workerClaimToken,
        data: { state: result.state === 'blocked' ? 'BLOCKED' : result.state === 'failed' ? 'RETRYABLE' : 'SUCCEEDED', progress: 100, completedAt: now, lastErrorCode: result.limitations[0] ?? null, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now },
      });
      await writeGradingAudit(tx, {
        actor: { id: 'grading-worker', role: 'SERVICE' },
        action: 'document-conversion.completed',
        purpose: 'answer-conversion',
        resourceType: 'DocumentConversion',
        resourceId: updated.id,
        answerId: job.conversion.asset?.answerId,
        classId: source.classId,
        provider: result.adapter === 'mathpix' ? 'mathpix' : undefined,
        providerRequestId: result.providerRequestId ?? undefined,
        policyVersion: job.conversion.policy?.version,
        metadata: { adapter: result.adapter, adapterVersion: result.adapterVersion, state: result.state, precision: result.precision, warningCount: result.warnings.length, providerRequestId: result.providerRequestId },
      });
    return { updated, evidence };
  });
  return { conversion: conversion.updated, evidence: conversion.evidence };
  } catch (error) {
    let orphanCleanupError: unknown = null;
    const recordCleanupFailure = async (key: string, checksum: string | null, cleanupError: unknown) => {
      try {
        await recordRenderedOrphanCleanupFailure({ db: input.db, conversion: job.conversion, key, checksum, attemptId: job.conversion.attemptId ?? '', workerClaimToken, error: cleanupError, now });
      } catch (auditError) {
        orphanCleanupError ??= auditError;
      }
    };
    for (const visual of visualObjectKeys) {
      try {
        await deleteOwnedRenderedObject({
          store,
          key: visual.key,
          ownerId: job.conversion.asset?.answer?.submission?.frozenStudentId ?? '',
          answerId: job.conversion.asset?.answerId ?? '',
          checksum: visual.checksum,
          attemptId: job.conversion.attemptId ?? '',
          workerClaimToken,
        });
      } catch (cleanupError) {
        orphanCleanupError ??= cleanupError;
        await recordCleanupFailure(visual.key, visual.checksum, cleanupError);
      }
    }
    if (renderedObjectKey) {
      try {
        await deleteOwnedRenderedObject({
          store,
          key: renderedObjectKey,
          ownerId: job.conversion.asset?.answer?.submission?.frozenStudentId ?? '',
          answerId: job.conversion.asset?.answerId ?? '',
          checksum: renderedChecksum,
          attemptId: job.conversion.attemptId ?? '',
          workerClaimToken,
        });
      } catch (cleanupError) {
        orphanCleanupError ??= cleanupError;
        await recordCleanupFailure(renderedObjectKey, renderedChecksum, cleanupError);
      }
    }
    if (orphanCleanupError) throw new Error('rendered-orphan-cleanup-failed');
    if (error instanceof Error && /worker-fenced/.test(error.message)) throw error;
    const leaseLost = error instanceof ConversionLeaseLostError
      || Boolean(input.parentLeaseLost && await input.parentLeaseLost())
      || leaseHeartbeat?.isLost()
      || !(await renewGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken }).catch(() => false));
    if (leaseLost) throw new Error('grading-worker-fenced');
    if (error instanceof ConversionCancelledError || await isConversionCancellationRequested(input.db, job.id, job.conversion.id, job, job.conversion)) return settleCancelledConversion(input.db, job, job.conversion, now, workerClaimToken);
    const code = error instanceof Error ? error.message.slice(0, 160) : 'conversion-worker-failed';
    const blocked = /policy|credential|blocked|not-configured|content-unavailable|association-missing|asset-missing|rendered-object-(?:writer-unavailable|ownership-verification-failed|key-not-stable)/i.test(code);
    const settleFailure = async (tx: MathGradingDb) => {
      await updateActivePersistedRecord({ model: (tx as any).gradingJob, id: job.id, activeStates: ['RUNNING'], fencedCode: 'conversion-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { updatedAt: now } });
      await updateActivePersistedRecord({ model: (tx as any).documentConversion, id: job.conversion.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'conversion-worker-fenced', fallback: job.conversion, data: { state: blocked ? 'BLOCKED' : 'RETRYABLE', failureCode: code, retryCount: { increment: 1 }, updatedAt: now } });
      await updateActivePersistedRecord({ model: (tx as any).gradingJob, id: job.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'conversion-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { state: blocked ? 'BLOCKED' : 'RETRYABLE', lastErrorCode: code, nextRunAt: blocked ? null : new Date(now.getTime() + 5_000), workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now } });
      await writeGradingAudit(tx, {
        actor: { id: 'grading-worker', role: 'SERVICE' },
        action: blocked ? 'document-conversion.blocked' : 'document-conversion.retryable',
        purpose: 'answer-conversion',
        resourceType: 'DocumentConversion',
        resourceId: job.conversion.id,
        answerId: job.conversion.asset?.answerId,
        classId: job.conversion.asset?.answer?.submission?.frozenAudienceClassId,
        metadata: { state: blocked ? 'BLOCKED' : 'RETRYABLE', errorCode: code },
      });
    };
    if (input.db.$transaction) await input.db.$transaction(settleFailure);
    else await settleFailure(input.db);
    throw error;
  } finally {
    leaseHeartbeat?.stop();
  }
}

export async function enqueueGradingRun(input: {
  db: MathGradingDb;
  attemptId: string;
  evidenceId: string;
  actor: PipelineActor;
  idempotencyKey: string;
  policyId?: string | null;
  policySnapshot?: ExternalProcessingPolicy | null;
  policySnapshotHash?: string | null;
  batchId?: string | null;
  evaluatorId?: string;
  evaluatorVersion?: string;
  frozenQuestion?: FrozenQuestionContract;
  batchItemId?: string | null;
  rerunReason?: string;
  retentionExpiresAt?: Date | null;
  now?: Date;
}): Promise<{ run: any; job: any; replay: boolean }> {
  const now = input.now ?? new Date();
  const row = await input.db.answerEvidence.findUnique({ where: { id: input.evidenceId }, include: { blocks: true, conversion: { select: { adapter: true, renderedObjectKey: true } }, attempt: { include: { answer: { include: { assets: { select: { id: true, mimeType: true, originalName: true } }, submission: { include: { audience: { select: { classId: true, class: { select: { teacherId: true } } } } } }, question: true } } } } } });
  if (!row || row.attemptId !== input.attemptId) throw new Error('grading-evidence-not-found');
  if (row.attemptId === null || !row.attempt?.answer || !row.attempt.answer.submission || !row.attempt.answer.question || !row.attempt.answer.submission.audience?.class || !row.attempt.answer.submission.frozenAudienceClassId || !row.attempt.answer.question.assignmentRevisionId) throw new Error('grading-content-unavailable:association-missing');
  if (row.readiness !== 'READY') throw new Error('grading-evidence-not-ready');
  if (row.conversion
    && ['local-fallback', 'local-markitdown'].includes(row.conversion.adapter)
    && !isTrustedWordDualRepresentation(row)) {
    throw new Error('grading-evidence-legacy-local-binary-ineligible');
  }
  if (row.attempt.answer.assets.length > 0
    && row.anchorVersion !== ASSIGNMENT_ATTACHMENT_MANIFEST_VERSION) {
    throw new Error('grading-evidence-assignment-aggregate-required');
  }
  const classId = row.attempt.answer.submission.frozenAudienceClassId;
  if (row.attempt.answer.submission.audience.classId !== classId) throw new Error('grading-class-binding-invalid');
  await assertPipelineActorScope({
    db: input.db,
    actor: input.actor,
    assignmentRevisionId: row.attempt.answer.question.assignmentRevisionId,
    classId,
    classTeacherId: row.attempt.answer.submission.audience.class.teacherId,
    ownerStudentId: row.attempt.answer.submission.frozenStudentId,
    purpose: input.actor.role === 'SERVICE' || input.actor.role === 'ADMIN' ? 'service' : 'teacher-review',
    now,
  });
  const assignmentRevision = await input.db.assignmentRevision.findUnique({
    where: { id: row.attempt.answer.question.assignmentRevisionId },
    select: { assignment: { select: { courseContext: true } } },
  });
  if (!assignmentRevision?.assignment?.courseContext) throw new Error('grading-content-unavailable:course-context-missing');
  const lifecyclePolicies = await requireConfiguredLifecyclePolicies(input.db, ['answer-evidence', 'grading-run']);
  const runLifecycle = freezeLifecyclePolicy(lifecyclePolicies.find((policy: any) => policy.dataClass === 'grading-run'), now);
  const question = input.frozenQuestion ?? questionContractFromRow(row.attempt.answer.question);
  const visualEvidenceStore = (input.db as any).documentConversionVisualEvidence;
  const visualRows = visualEvidenceStore?.findMany
    ? await visualEvidenceStore.findMany({
        where: { attemptId: input.attemptId, questionId: question.questionId },
        orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
      })
    : [];
  const attachmentManifest = visualRows.map((visual: any): FrozenVisualAttachment => ({
    id: String(visual.id),
    questionId: typeof visual.questionId === 'string' ? visual.questionId : null,
    objectKey: String(visual.objectKey),
    checksum: String(visual.imageChecksum),
    mediaType: String(visual.mediaType),
    sizeBytes: Number(visual.sizeBytes),
    readiness: String(visual.readiness),
    contentHash: String(visual.contentHash),
  }));
  const attachmentManifestHash = sha256(stableStringify(attachmentManifest));
  const providerPolicy = input.policyId
    ? await input.db.gradingProviderPolicy.findUnique({ where: { id: input.policyId }, select: GRADING_PROVIDER_POLICY_SELECT })
    : null;
  if (input.policyId && !providerPolicy) throw new Error('grading-provider-policy-not-found');
  const currentPolicy = toGradingProviderPolicySnapshot(providerPolicy);
  const policySnapshot = normalizeExternalProcessingPolicy(input.policySnapshot ?? currentPolicy);
  const policySnapshotHash = input.policySnapshotHash ?? externalProcessingPolicyHash(policySnapshot);
  if (input.policyId && input.policySnapshotHash && externalProcessingPolicyHash(currentPolicy) !== input.policySnapshotHash) throw new Error('provider-policy-snapshot-mismatch');
  const evaluatorIdentity = {
    provider: providerPolicy?.provider ?? 'configured-provider',
    version: providerPolicy?.model ?? providerPolicy?.version ?? 'runtime-resolved',
  };
  const inputHash = sha256(stableStringify({
    questionSnapshot: question,
    evidence: { id: row.id, version: row.version, sourceHash: row.sourceHash, anchorVersion: row.anchorVersion },
    attachmentManifestHash,
    evaluator: evaluatorIdentity,
  }));
  const rerunIdentity = input.rerunReason
    ? buildRerunIdentity({ kind: 'run', sourceId: input.attemptId, reason: input.rerunReason, inputHash, versionBoundary: evaluatorIdentity.version, idempotencyKey: input.idempotencyKey })
    : null;
  const requestHash = buildGradingRequestHash('grading-run', {
    attemptId: input.attemptId.trim(),
    evidenceId: input.evidenceId.trim(),
    policyId: input.policyId ?? null,
    batchId: input.batchId ?? null,
    batchItemId: input.batchItemId ?? null,
    evaluatorId: input.evaluatorId?.trim() || null,
    evaluatorVersion: input.evaluatorVersion?.trim() || null,
    frozenQuestion: input.frozenQuestion ?? null,
    attachmentManifestHash,
    rerunReason: input.rerunReason?.trim() || null,
  });
  const dedupeKey = buildPipelineDedupeKey('grading-run', { attemptId: input.attemptId, evidenceId: input.evidenceId, inputHash, evaluator: evaluatorIdentity, policySnapshotHash, rubricVersion: question.rubric.version, rerunIdentity });
  const requestResult = await withGradingRequestIdempotency({
    db: input.db,
    actor: input.actor,
    operation: 'grading-run',
    idempotencyKey: input.idempotencyKey,
    requestHash,
    resourceType: 'GradingRun',
    now,
    load: async (db, resourceId) => {
      const loaded = await db.gradingRun.findUnique({ where: { id: resourceId }, include: { jobs: true } });
      return loaded ? { run: loaded, job: loaded.jobs?.[0] ?? null } : null;
    },
    recoverUniqueConstraint: async (db) => {
      const loaded = await db.gradingRun.findUnique({ where: { dedupeKey }, include: { jobs: true } });
      return loaded ? { resourceId: loaded.id, value: { run: loaded, job: loaded.jobs?.[0] ?? null }, replay: true } : null;
    },
    create: async (db) => {
      const existing = await db.gradingRun.findUnique({ where: { dedupeKey }, include: { jobs: true } });
      if (existing) return { resourceId: existing.id, value: { run: existing, job: existing.jobs?.[0] ?? null }, replay: true };
      const run = await db.gradingRun.create({
        data: {
          id: `grading-run:${sha256(dedupeKey).slice(-32)}`,
          batchId: input.batchId ?? null,
          answerAttemptId: input.attemptId,
          answerEvidenceId: row.id,
          questionId: question.questionId,
          policyId: input.policyId ?? null,
          policySnapshot: policySnapshot ?? null,
          policySnapshotHash,
          rerunIdentity,
          rerunReason: input.rerunReason ?? null,
          idempotencyKey: input.idempotencyKey,
          dedupeKey,
          inputHash,
          attachmentManifest,
          attachmentManifestHash,
          questionSnapshotHash: question.contentHash,
          rubricId: question.rubric.id,
          rubricVersion: question.rubric.version,
          evaluatorId: evaluatorIdentity.provider,
          evaluatorVersion: evaluatorIdentity.version,
          questionSnapshot: question,
          rubricSnapshot: question.rubric,
          referenceAnswer: question.referenceAnswer,
          evidenceState: row.limitationState === 'evidence-incomplete' || attachmentManifest.some((item: FrozenVisualAttachment) => item.readiness !== 'ready')
            ? 'EVIDENCE_INCOMPLETE'
            : 'COMPLETE',
          source: 'AI',
          limitations: row.limitations,
          state: 'QUEUED',
          ...runLifecycle,
          createdAt: now,
          updatedAt: now,
        },
      });
      const job = await createJob(db, { kind: input.rerunReason ? 'RERUN' : 'GRADING', dedupeKey: buildPipelineDedupeKey('grading-job', { runId: run.id, idempotencyKey: input.idempotencyKey }), idempotencyKey: input.idempotencyKey, reason: input.rerunReason ?? null, rerunIdentity, attemptId: input.attemptId, batchId: input.batchId ?? undefined, batchItemId: input.batchItemId ?? undefined, gradingRunId: run.id, policyId: input.policyId ?? null, correlationId: randomUUID(), now });
      if (rerunIdentity && db.gradingRerun?.create) {
        const pending = db.gradingRerun.findFirst
          ? await db.gradingRerun.findFirst({ where: { rerunIdentity, gradingRunId: null } })
          : null;
        if (pending && db.gradingRerun.update) {
          await db.gradingRerun.update({ where: { id: pending.id }, data: { gradingRunId: run.id, gradingJobId: job.id } });
        } else {
          await db.gradingRerun.create({ data: { id: `grading-rerun:${rerunIdentity.slice(-24)}:${run.id}`, kind: 'RERUN', rerunIdentity, gradingRunId: run.id, gradingJobId: job.id, batchId: input.batchId ?? null, reason: input.rerunReason!, createdByPseudoId: pseudonymousAuditId(input.actor.id, 'grading'), versionBoundary: evaluatorIdentity.version, idempotencyKey: `run:${run.id}`, createdAt: now } });
        }
      }
      await writeGradingAudit(db, {
        actor: input.actor,
        action: 'grading-run.enqueued',
        purpose: 'rubric-grading',
        resourceType: 'GradingRun',
        resourceId: run.id,
        answerId: row.attempt.answerId,
        classId,
        metadata: { dedupeKey, idempotencyKey: input.idempotencyKey, evaluatorId: run.evaluatorId, evaluatorVersion: run.evaluatorVersion, rerun: Boolean(input.rerunReason) },
      });
      return { resourceId: run.id, value: { run, job } };
    },
  });
  return { ...requestResult.value, replay: requestResult.replay };
}

function isTrustedWordDualRepresentation(row: { sourceAssetId?: string | null; conversion?: { adapter?: string | null; renderedObjectKey?: string | null } | null; attempt?: { answer?: { assets?: Array<{ id?: string | null; mimeType?: string | null; originalName?: string | null }> | null } | null } | null }): boolean {
  if (row.conversion?.adapter !== 'local-markitdown' || !row.conversion.renderedObjectKey || !row.sourceAssetId) return false;
  const asset = row.attempt?.answer?.assets?.find((candidate) => candidate.id === row.sourceAssetId);
  if (!asset) return false;
  const mimeType = asset.mimeType?.trim().toLowerCase();
  return mimeType === 'application/msword'
    || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || /\.docx?$/iu.test(asset.originalName ?? '');
}

export async function processGradingRunJob(input: {
  db: MathGradingDb;
  jobId: string;
  workerClaimToken?: string;
  store?: SubmissionObjectStore;
  provider?: GradingProviderRuntime;
  policy?: ExternalProcessingPolicy | null;
  signal?: AbortSignal;
  parentLeaseLost?: () => Promise<boolean> | boolean;
  now?: Date;
}): Promise<{ run: any; draft: ValidatedGradingDraft }> {
  const now = input.now ?? new Date();
  const job = await input.db.gradingJob.findUnique({ where: { id: input.jobId }, include: { gradingRun: { include: { answerEvidence: { include: { blocks: true } }, question: true, policy: true, answerAttempt: { include: { answer: { include: { submission: true } } } } } } } });
  if (!job?.gradingRun) throw new Error('grading-job-not-found');
  await requireConfiguredLifecyclePolicies(input.db, ['answer-evidence', 'grading-run']);
  const run = job.gradingRun;
  const terminalRun = ['AWAITING_REVIEW', 'FAILED', 'BLOCKED', 'CANCELLED', 'CONTENT_UNAVAILABLE'].includes(run.state);
  const terminalJob = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'BLOCKED', 'CONTENT_UNAVAILABLE'].includes(job.state);
  if (terminalRun || terminalJob) {
    if (terminalRun && !terminalJob && input.db.gradingJob?.update) {
      await input.db.gradingJob.update({
        where: { id: job.id },
        data: {
          state: gradingTerminalJobState(run.state),
          progress: 100,
          completedAt: now,
          updatedAt: now,
        },
      }).catch(() => undefined);
    }
    return { run, draft: terminalRunDraft(run) };
  }
  const policy = run.policyId
    ? await resolveWorkerGradingProviderPolicy({ db: input.db, policyId: run.policyId, snapshot: run.policySnapshot, snapshotHash: run.policySnapshotHash, fallbackPolicy: run.policy, expectedPurpose: 'rubric-grading' })
    : input.policy ?? (run.policy ? toGradingProviderPolicySnapshot(run.policy) : null);
  const workerClaimToken = input.workerClaimToken ?? randomUUID();
  let leaseHeartbeat: ReturnType<typeof startGradingJobLeaseHeartbeat> | null = null;
  const leaseAbortController = new AbortController();
  if (input.signal?.aborted) leaseAbortController.abort();
  else input.signal?.addEventListener('abort', () => leaseAbortController.abort(), { once: true });
  await input.db.$transaction(async (tx: any) => {
    await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['QUEUED', 'RETRYABLE'], fencedCode: 'grading-worker-fenced', fallback: job, data: { state: 'RUNNING', progress: 10, startedAt: now, attemptCount: { increment: 1 }, ...gradingJobLeaseData(workerClaimToken, now), updatedAt: now } });
    await updateActivePersistedRecord({ model: tx.gradingRun, id: run.id, activeStates: ['QUEUED', 'RETRYABLE'], fencedCode: 'grading-worker-fenced', fallback: run, data: { state: 'RUNNING', updatedAt: now } });
    await writeGradingAudit(tx, {
      actor: { id: 'grading-worker', role: 'SERVICE' },
      action: 'grading-run.started',
      purpose: 'rubric-grading',
      resourceType: 'GradingRun',
      resourceId: run.id,
      answerId: run.answerAttempt?.answerId,
      classId: run.answerAttempt?.answer?.submission?.frozenAudienceClassId,
      policyVersion: run.policy?.version,
      metadata: { state: 'RUNNING' },
    });
  });
  leaseHeartbeat = startGradingJobLeaseHeartbeat({ db: input.db, jobId: job.id, workerClaimToken, onLost: () => leaseAbortController.abort() });
  try {
  if (input.parentLeaseLost && await input.parentLeaseLost()) throw new Error('grading-worker-fenced');
  await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, now });
  assertActiveGradingRunContract(run);
  const question = questionContractFromSnapshot(run);
  const evidence = evidenceFromRow(run.answerEvidence);
  const frozenInputError = validateFrozenRunInput(run, question, run.answerEvidence);
  let visualInputError: string | null = null;
  let visualAttachments: GradingEvidenceAttachment[] = [];
  if (!frozenInputError && Array.isArray(run.attachmentManifest) && run.attachmentManifest.length > 0) {
    try {
      const loadedVisual = await loadFrozenVisualAttachments({
        store: input.store ?? createSubmissionObjectStore(),
        manifest: run.attachmentManifest,
        questionId: question.questionId,
        ownerId: run.answerAttempt.answer.submission.frozenStudentId,
        answerId: run.answerAttempt.answerId,
        attemptId: run.answerAttemptId,
      });
      visualAttachments = loadedVisual.attachments;
      visualInputError = loadedVisual.error;
    } catch {
      visualInputError = 'visual-evidence-object-read-failed';
    }
  }
  const inputError = frozenInputError ?? visualInputError;
  if (inputError) {
    const draft = persistenceBlockedDraft(question, evidence, [inputError]);
    const updated = await input.db.$transaction(async (tx: any) => {
      await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { state: 'BLOCKED', progress: 100, completedAt: now, lastErrorCode: inputError, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now } });
      const blocked = await updateActivePersistedRecord({ model: tx.gradingRun, id: run.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: run, data: { state: 'BLOCKED', provider: draft.provider, providerRequestId: draft.providerRequestId, providerDeletionHandle: draft.deletionHandle, providerRequestedAt: draft.providerRequestedAt, providerProcessedAt: draft.providerProcessedAt, providerInputTokens: draft.inputTokens ?? null, providerOutputTokens: draft.outputTokens ?? null, providerTelemetryComplete: draft.telemetryComplete === true, blockedReasons: draft.blockedReasons, limitations: draft.limitations, updatedAt: now } });
      await writeGradingAudit(tx, {
        actor: { id: 'grading-worker', role: 'SERVICE' },
        action: 'grading-run.blocked',
        purpose: 'rubric-grading',
        resourceType: 'GradingRun',
        resourceId: run.id,
        answerId: run.answerAttempt.answerId,
        classId: run.answerAttempt.answer.submission.frozenAudienceClassId,
        metadata: { state: 'BLOCKED', reason: inputError },
      });
      return blocked;
    });
    return { run: updated, draft };
  }
  const providerPolicy = run.policyId
    ? await resolveWorkerGradingProviderPolicy({ db: input.db, policyId: run.policyId, snapshot: run.policySnapshot, snapshotHash: run.policySnapshotHash, fallbackPolicy: run.policy, expectedPurpose: 'rubric-grading' })
    : policy;
  const providerDraft = await evaluateFrozenQuestionEvidence({ question, evidence, classId: run.answerAttempt.answer.submission.frozenAudienceClassId, policy: providerPolicy, provider: input.provider, attachments: visualAttachments, idempotencyKey: buildGradingRunEvaluationIdentity(run), signal: leaseAbortController.signal });
  const draft = {
    ...providerDraft,
    limitations: [...new Set([
      ...evidence.limitations,
      ...providerDraft.limitations,
      ...(run.evidenceState === 'EVIDENCE_INCOMPLETE'
        ? ['evidence-incomplete']
        : []),
    ])],
  };
  if (input.parentLeaseLost && await input.parentLeaseLost()) throw new Error('grading-worker-fenced');
  await assertGradingJobLease({ db: input.db, jobId: job.id, workerClaimToken, heartbeat: leaseHeartbeat, now });
  const updated = await input.db.$transaction(async (tx: any) => {
    await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { updatedAt: now } });
    if (await isGradingCancellationRequested(tx, job, run)) {
      return settleCancelledGradingRun(tx, job, run, now, workerClaimToken);
    }
    if (draft.state === 'retryable') {
      const retryAt = new Date(now.getTime() + 5_000);
      await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { state: 'RETRYABLE', progress: 0, nextRunAt: retryAt, lastErrorCode: draft.blockedReasons[0] ?? 'provider-retryable', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now } });
      const retryable = await updateActivePersistedRecord({ model: tx.gradingRun, id: run.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: run, data: { state: 'RETRYABLE', provider: draft.provider, providerRequestId: draft.providerRequestId, providerDeletionHandle: draft.deletionHandle, providerRequestedAt: draft.providerRequestedAt, providerProcessedAt: draft.providerProcessedAt, providerInputTokens: draft.inputTokens ?? null, providerOutputTokens: draft.outputTokens ?? null, providerTelemetryComplete: draft.telemetryComplete === true, limitations: draft.limitations, blockedReasons: [], updatedAt: now } });
      await writeGradingAudit(tx, {
        actor: { id: 'grading-worker', role: 'SERVICE' },
        action: 'grading-run.retryable',
        purpose: 'rubric-grading',
        resourceType: 'GradingRun',
        resourceId: run.id,
        answerId: run.answerAttempt.answerId,
        classId: run.answerAttempt.answer.submission.frozenAudienceClassId,
        provider: draft.provider,
        metadata: { state: draft.state, reason: draft.blockedReasons[0] ?? 'provider-retryable' },
      });
      return retryable;
    }
    if (draft.state === 'blocked') {
      await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { state: 'BLOCKED', progress: 100, completedAt: now, lastErrorCode: draft.blockedReasons[0] ?? 'blocked-evaluator', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now } });
      const blocked = await updateActivePersistedRecord({ model: tx.gradingRun, id: run.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: run, data: { state: 'BLOCKED', provider: draft.provider, providerRequestId: draft.providerRequestId, providerDeletionHandle: draft.deletionHandle, providerRequestedAt: draft.providerRequestedAt, providerProcessedAt: draft.providerProcessedAt, providerInputTokens: draft.inputTokens ?? null, providerOutputTokens: draft.outputTokens ?? null, providerTelemetryComplete: draft.telemetryComplete === true, blockedReasons: draft.blockedReasons, limitations: draft.limitations, updatedAt: now } });
      await writeGradingAudit(tx, {
        actor: { id: 'grading-worker', role: 'SERVICE' },
        action: 'grading-run.blocked',
        purpose: 'rubric-grading',
        resourceType: 'GradingRun',
        resourceId: run.id,
        answerId: run.answerAttempt.answerId,
        classId: run.answerAttempt.answer.submission.frozenAudienceClassId,
        provider: draft.provider,
        metadata: { state: draft.state, blockedReasonCount: draft.blockedReasons.length },
      });
      return blocked;
    }
    await updateActivePersistedRecord({ model: tx.gradingJob, id: job.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: job, leaseToken: workerClaimToken, data: { state: 'SUCCEEDED', progress: 100, completedAt: now, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now } });
    const updatedRun = await writeValidatedGradingDraftTransaction({
      db: tx,
      run,
      evidenceBlocks: run.answerEvidence.blocks,
      draft,
      now,
      updateRun: (data) => updateActivePersistedRecord({ model: tx.gradingRun, id: run.id, activeStates: ['RUNNING'], fencedCode: 'grading-worker-fenced', fallback: run, data }),
    });
    await writeGradingAudit(tx, {
      actor: { id: 'grading-worker', role: 'SERVICE' },
      action: 'grading-run.completed',
      purpose: 'rubric-grading',
      resourceType: 'GradingRun',
      resourceId: run.id,
      answerId: run.answerAttempt.answerId,
      classId: run.answerAttempt.answer.submission.frozenAudienceClassId,
      provider: draft.provider,
      policyVersion: run.policy?.version,
      metadata: { state: draft.state, evaluatorId: draft.evaluatorId, evaluatorVersion: draft.evaluatorVersion, blockedReasonCount: draft.blockedReasons.length, promptInjectionDetected: draft.promptInjectionDetected },
    });
    return updatedRun;
  });
  if (updated?.state === 'CANCELLED') return { run: updated, draft: gradingCancelledDraft(question, evidence) };
  return { run: updated, draft };
  } finally {
    leaseHeartbeat?.stop();
  }
}

export async function persistValidatedGradingDraft(input: {
  db: MathGradingDb;
  run: any;
  evidenceBlocks: readonly any[];
  draft: ValidatedGradingDraft;
  afterPersist?: (db: MathGradingDb, run: any) => Promise<void>;
  now?: Date;
}): Promise<any> {
  if (!input.db.$transaction) throw new Error('grading-transaction-repository-unavailable');
  return input.db.$transaction(async (tx: MathGradingDb) => {
    if (!tx.gradingRun?.findUnique || !tx.gradingRun?.updateMany) throw new Error('grading-run-fence-unavailable');
    const current = await tx.gradingRun.findUnique({ where: { id: input.run?.id } });
    if (!current) throw new Error('grading-run-not-found');
    assertDraftMatchesFrozenRun(current, input.draft);
    assertDraftAnnotationsMatchScores(input.draft, questionContractFromSnapshot(current));
    const persisted = await writeValidatedGradingDraftTransaction({
      db: tx,
      run: current,
      evidenceBlocks: input.evidenceBlocks,
      draft: input.draft,
      now: input.now ?? new Date(),
      updateRun: async (data) => {
        const fenced = await tx.gradingRun.updateMany({
          where: {
            id: current.id,
            state: 'RUNNING',
            inputHash: current.inputHash,
            evaluatorId: current.evaluatorId,
            evaluatorVersion: current.evaluatorVersion,
          },
          data,
        });
        if (fenced.count !== 1) throw new Error('grading-run-fenced');
        return tx.gradingRun.findUnique({ where: { id: current.id } });
      },
    });
    await input.afterPersist?.(tx, persisted);
    return persisted;
  });
}

function assertDraftMatchesFrozenRun(run: any, draft: ValidatedGradingDraft): void {
  if (run.state !== 'RUNNING') throw new Error('grading-run-not-running');
  assertDraftIdentityMatchesFrozenRun(run, draft);
}

function assertDraftIdentityMatchesFrozenRun(run: any, draft: ValidatedGradingDraft): void {
  if (draft.inputHash !== run.inputHash) throw new Error('grading-draft-input-hash-mismatch');
  if (draft.evaluatorId !== run.evaluatorId) throw new Error('grading-draft-evaluator-id-mismatch');
  if (draft.evaluatorVersion !== run.evaluatorVersion) throw new Error('grading-draft-evaluator-version-mismatch');
  assertDraftEvaluationIdentity(run, draft);
}

function assertDraftEvaluationIdentity(run: any, draft: ValidatedGradingDraft): void {
  if (draft.evaluationIdentity !== buildGradingRunEvaluationIdentity(run)) throw new Error('grading-draft-evaluation-identity-mismatch');
}

function assertDraftAnnotationsMatchScores(draft: ValidatedGradingDraft, question: FrozenQuestionContract): void {
  const criteria = new Map(question.rubric.criteria.map((criterion) => [criterion.id, criterion.maxPoints]));
  const seen = new Set<string>();
  if (draft.assessments.length !== criteria.size) throw new Error('grading-draft-criterion-count-mismatch');
  for (const assessment of draft.assessments) {
    const maxScore = criteria.get(assessment.criterionId);
    if (maxScore === undefined || seen.has(assessment.criterionId)
      || assessment.maxScore !== maxScore || !Number.isFinite(assessment.score)
      || assessment.score < 0 || assessment.score > maxScore) {
      throw new Error('grading-draft-score-invalid');
    }
    seen.add(assessment.criterionId);
    const annotations = assessment.annotations ?? [];
    if (assessment.score < maxScore && annotations.length === 0) {
      throw new Error('grading-draft-deduction-annotation-missing');
    }
    if (assessment.score >= maxScore && annotations.length > 0) {
      throw new Error('grading-draft-annotation-without-deduction');
    }
    for (const annotation of annotations) {
      if (!annotation.reason?.trim()) throw new Error('grading-draft-deduction-reason-missing');
      if (!annotation.comment?.trim()) throw new Error('grading-draft-annotation-comment-missing');
    }
  }
  if (seen.size !== criteria.size) throw new Error('grading-draft-criterion-mismatch');
}

export function buildGradingRunEvaluationIdentity(run: { id: string; evaluatorVersion: string }): string {
  return sha256(`grading:${run.id}:${run.evaluatorVersion}`);
}

async function writeValidatedGradingDraftTransaction(input: {
  db: MathGradingDb;
  run: any;
  evidenceBlocks: readonly any[];
  draft: ValidatedGradingDraft;
  now: Date;
  updateRun?: (data: Record<string, unknown>) => Promise<any>;
}): Promise<any> {
  if (input.draft.state !== 'awaiting-review') throw new Error('grading-draft-not-awaiting-review');
  if (!input.run?.id) throw new Error('grading-run-id-missing');
  assertDraftEvaluationIdentity(input.run, input.draft);
  if (!input.db.gradingRun?.update || !input.db.gradingCriterionAssessment?.create || !input.db.gradingAnnotation?.create) {
    throw new Error('grading-draft-persistence-unavailable');
  }

  const runData = {
    state: 'AWAITING_REVIEW',
    provider: input.draft.provider,
    providerRequestId: input.draft.providerRequestId,
    providerDeletionHandle: input.draft.deletionHandle,
    providerRequestedAt: input.draft.providerRequestedAt,
    providerProcessedAt: input.draft.providerProcessedAt,
    providerInputTokens: input.draft.inputTokens ?? null,
    providerOutputTokens: input.draft.outputTokens ?? null,
    providerTelemetryComplete: input.draft.telemetryComplete === true,
    evaluatorId: input.draft.evaluatorId,
    evaluatorVersion: input.draft.evaluatorVersion,
    draftTotalScore: input.draft.assessments.reduce((sum, assessment) => sum + assessment.score, 0),
    overallComment: input.draft.overallComment,
    overallFeedback: input.draft.overallFeedback ?? null,
    limitations: input.draft.limitations,
    blockedReasons: [],
    updatedAt: input.now,
  };
  const updatedRun = input.updateRun
    ? await input.updateRun(runData)
    : await input.db.gradingRun.update({ where: { id: input.run.id }, data: runData });

  for (const assessment of input.draft.assessments) {
    const persisted = await input.db.gradingCriterionAssessment.create({
      data: {
        gradingRunId: input.run.id,
        criterionId: assessment.criterionId,
        levelId: assessment.levelId,
        score: assessment.score,
        rationale: assessment.rationale,
        confidence: assessment.confidence,
        limitationState: assessment.limitationState,
        createdAt: input.now,
        updatedAt: input.now,
      },
    });
    const annotations = assessment.annotations ?? [];
    for (const annotation of annotations) {
      const block = resolvePersistedEvidenceBlock(input.evidenceBlocks, annotation.anchor.blockId);
      if (!block) throw new Error('frozen-evidence-anchor-unresolved');
      await input.db.gradingAnnotation.create({
        data: {
          gradingRunId: input.run.id,
          assessmentId: persisted.id,
          blockId: block.id,
          criterionId: assessment.criterionId,
          pageNumber: annotation.anchor.pageNumber ?? block.pageNumber ?? null,
          spanStart: annotation.anchor.spanStart ?? null,
          spanEnd: annotation.anchor.spanEnd ?? null,
          bbox: annotation.anchor.bbox ?? undefined,
          precision: annotation.anchor.precision.toUpperCase(),
          excerpt: annotation.anchor.excerpt,
          reason: annotation.reason,
          comment: annotation.comment,
          authorRole: 'AI_DRAFT',
          createdAt: input.now,
        },
      });
    }
  }
  return updatedRun;
}

export function questionContractFromRow(row: any): FrozenQuestionContract {
  const prompt = readSnapshotText(row.promptSnapshot, 'prompt');
  const referenceAnswer = readSnapshotText(row.answerSnapshot, 'text');
  const rawRubric = row.rubricSnapshot && typeof row.rubricSnapshot === 'object' ? row.rubricSnapshot : {};
  const rawCriteria = Array.isArray(rawRubric.criteria) ? rawRubric.criteria : [];
  const schemaVersion = String(rawRubric.schemaVersion ?? 'assignment-analytic-rubric.v1');
  const criteria = rawCriteria.map((criterion: any) => {
    const maxPoints = Number(criterion.maxPoints ?? 0);
    const rawLevels = Array.isArray(criterion.levels) ? criterion.levels : [];
    const levels = schemaVersion === 'assignment-scoring-rubric.v2'
      ? deriveRubricLevelRanges(rawLevels.map((level: any) => ({
          id: String(level.id),
          label: String(level.label ?? level.id),
          maxPoints: Number(level.maxPoints ?? 0),
          guideline: String(level.guideline ?? ''),
        })), maxPoints).map((level) => ({
          id: level.id,
          label: level.label,
          minPoints: level.minPoints,
          maxPoints: level.maxInclusivePoints,
          description: level.guideline,
        }))
      : rawLevels.map((level: any) => ({
          id: String(level.id),
          label: String(level.label ?? level.id),
          minPoints: Number(level.minPoints ?? 0),
          maxPoints: Number(level.maxPoints ?? 0),
          description: String(level.description ?? ''),
        }));
    return {
      id: String(criterion.id),
      label: String(criterion.label ?? criterion.id),
      goalDimension: String(criterion.goalDimension
        ?? (schemaVersion === 'assignment-scoring-rubric.v2' ? 'engineeringDecision' : '')),
      maxPoints,
      ...(schemaVersion === 'assignment-scoring-rubric.v2' ? {
        scoringStandard: String(criterion.scoringStandard ?? ''),
        detailedRubricEnabled: criterion.detailedRubricEnabled === true,
      } : {}),
      evidenceDescription: String(criterion.evidenceDescription ?? criterion.scoringStandard ?? ''),
      feedbackGuidance: String(criterion.feedbackGuidance ?? criterion.scoringStandard ?? ''),
      levels,
    };
  });
  const rubric = {
    schemaVersion,
    id: `rubric:${row.id}`,
    version: String(row.contentHash ?? row.sourceVersion ?? 'snapshot.v1'),
    maxScore: criteria.reduce((sum: number, criterion: any) => sum + criterion.maxPoints, 0),
    criteria,
  };
  return { assignmentRevisionId: row.assignmentRevisionId, questionId: row.id, stableQuestionId: row.stableQuestionId, responseType: row.responseType, prompt, referenceAnswer, rubric, contentHash: row.contentHash };
}

export function questionContractFromSnapshot(run: any): FrozenQuestionContract {
  const snapshot = run.questionSnapshot;
  if (snapshot && typeof snapshot === 'object' && typeof snapshot.prompt === 'string' && snapshot.rubric && Array.isArray(snapshot.rubric.criteria)) {
    return {
      assignmentRevisionId: String(snapshot.assignmentRevisionId ?? run.assignmentRevisionId ?? ''),
      questionId: String(snapshot.questionId ?? run.questionId ?? ''),
      stableQuestionId: String(snapshot.stableQuestionId ?? snapshot.questionId ?? run.questionId ?? ''),
      responseType: snapshot.responseType === 'SUBJECTIVE_FILE' ? 'SUBJECTIVE_FILE' : 'SUBJECTIVE_TEXT',
      prompt: snapshot.prompt,
      referenceAnswer: typeof run.referenceAnswer === 'string' ? run.referenceAnswer : String(snapshot.referenceAnswer ?? ''),
      rubric: normalizeFrozenRubricSnapshot(snapshot.rubric),
      contentHash: String(snapshot.contentHash ?? run.questionSnapshotHash ?? ''),
    };
  }
  const fallback = questionContractFromRow({
    ...(snapshot && typeof snapshot === 'object' ? snapshot : {}),
    id: snapshot?.id ?? snapshot?.questionId ?? run.questionId,
    assignmentRevisionId: snapshot?.assignmentRevisionId ?? run.assignmentRevisionId ?? '',
    stableQuestionId: snapshot?.stableQuestionId ?? snapshot?.questionId ?? run.questionId ?? '',
    responseType: snapshot?.responseType ?? 'SUBJECTIVE_TEXT',
    promptSnapshot: snapshot?.promptSnapshot ?? { text: snapshot?.prompt ?? '' },
    answerSnapshot: snapshot?.answerSnapshot ?? { text: snapshot?.referenceAnswer ?? run.referenceAnswer ?? '' },
    rubricSnapshot: snapshot?.rubricSnapshot ?? run.rubricSnapshot ?? {},
    contentHash: snapshot?.contentHash ?? run.questionSnapshotHash ?? '',
  });
  return {
    ...fallback,
    referenceAnswer: typeof run.referenceAnswer === 'string' ? run.referenceAnswer : fallback.referenceAnswer,
    contentHash: String(run.questionSnapshotHash ?? fallback.contentHash),
  };
}

function normalizeFrozenRubricSnapshot(rubric: any): FrozenQuestionContract['rubric'] {
  if (rubric.schemaVersion !== 'assignment-scoring-rubric.v2') return rubric;
  return {
    ...rubric,
    criteria: rubric.criteria.map((criterion: any) => {
      const rawLevels = Array.isArray(criterion.levels) ? criterion.levels : [];
      const levels = rawLevels.every((level: any) => Number.isFinite(level.minPoints))
        ? rawLevels
        : deriveRubricLevelRanges(rawLevels.map((level: any) => ({
            id: String(level.id),
            label: String(level.label ?? level.id),
            maxPoints: Number(level.maxPoints ?? 0),
            guideline: String(level.guideline ?? level.description ?? ''),
          })), Number(criterion.maxPoints ?? 0)).map((level) => ({
            id: level.id,
            label: level.label,
            minPoints: level.minPoints,
            maxPoints: level.maxInclusivePoints,
            description: level.guideline,
          }));
      return {
        ...criterion,
        scoringStandard: String(criterion.scoringStandard ?? ''),
        detailedRubricEnabled: criterion.detailedRubricEnabled === true,
        evidenceDescription: String(criterion.evidenceDescription ?? criterion.scoringStandard ?? ''),
        feedbackGuidance: String(criterion.feedbackGuidance ?? criterion.scoringStandard ?? ''),
        levels,
      };
    }),
  };
}

export function evidenceFromRow(row: any): NormalizedAnswerEvidence {
  return {
    sourceKind: row.sourceKind === 'TEXT_NATIVE' ? 'text-native' : 'document',
    sourceHash: row.sourceHash,
    canonicalMarkdown: row.canonicalMarkdown,
    anchorVersion: row.anchorVersion,
    precision: String(row.precision).toLowerCase() as NormalizedAnswerEvidence['precision'],
    readiness: row.readiness === 'READY' ? 'ready' : 'blocked',
    limitationState: row.limitationState,
    limitations: row.limitations,
    blocks: row.blocks.map((block: any) => ({
      id: row.anchorVersion === ASSIGNMENT_ATTACHMENT_MANIFEST_VERSION
        && block.id.startsWith(`${row.id}:`)
        ? block.id.slice(row.id.length + 1)
        : block.id.includes(':')
          ? block.id.split(':').pop()
          : block.id,
      blockIndex: block.blockIndex,
      pageNumber: block.pageNumber,
      text: block.text,
      markdown: block.markdown,
      spanStart: block.spanStart,
      spanEnd: block.spanEnd,
      bbox: block.bbox,
      coordinateProvenance: block.coordinateProvenance ?? null,
      precision: String(block.precision).toLowerCase(),
      confidence: block.confidence,
    })),
  };
}

export function buildPersistedAnswerEvidenceBlocks(input: { normalized: NormalizedAnswerEvidence; conversionId: string; evidenceId: string; sourceHash: string; now: Date }) {
  return input.normalized.blocks.map((block) => ({
    id: `${input.conversionId}:${block.id}`,
    evidenceId: input.evidenceId,
    blockIndex: block.blockIndex,
    questionId: block.questionId ?? null,
    pageNumber: block.pageNumber ?? null,
    text: block.text,
    markdown: block.markdown ?? block.text,
    spanStart: block.spanStart ?? null,
    spanEnd: block.spanEnd ?? null,
    bbox: block.bbox ?? undefined,
    coordinateProvenance: block.coordinateProvenance ?? undefined,
    precision: (block.precision ?? input.normalized.precision).toUpperCase(),
    confidence: block.confidence ?? 0,
    sourceHash: input.sourceHash,
    createdAt: input.now,
  }));
}

function physicalPageCount(blocks: readonly { pageNumber?: number | null }[]): number | null {
  const pageNumbers = blocks.map((block) => block.pageNumber).filter((page): page is number => typeof page === 'number' && Number.isInteger(page) && page > 0);
  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;
}

export function buildConversionLayoutRepresentation(result: Pick<Awaited<ReturnType<typeof convertProtectedSubmission>>, 'wordRepresentation'>): Record<string, unknown> | null {
  const representation = result.wordRepresentation;
  if (!representation) return null;
  const blocksById = new Map(representation.blocks.map((block) => [block.id, block]));
  return {
    schemaVersion: 'document-layout-representation.v1',
    sourceFormat: representation.sourceFormat,
    renderedPdfChecksum: representation.renderedPdfChecksum,
    renderedPdfPageCount: representation.renderedPdfPageCount,
    extractorVersion: representation.extractorVersion,
    rendererVersion: representation.rendererVersion,
    paragraphs: representation.paragraphs.map(({ id, paragraphIndex, questionId, introducesQuestion }) => ({ id, paragraphIndex, questionId, introducesQuestion })),
    formulas: representation.formulas.map(({ id, paragraphId, questionId, text, omml }) => ({ id, paragraphId, questionId, text, ommlChecksum: sha256(omml) })),
    images: representation.images.map(({ id, paragraphId, questionId, mediaType, checksum }) => ({ id, paragraphId, questionId, mediaType, checksum })),
    anchors: representation.anchors.map((anchor) => ({ ...anchor })),
    questionRegions: representation.questionStates.map((state) => ({
      ...state,
      candidates: state.candidateBlockIds.map((blockId) => {
        const block = blocksById.get(blockId);
        return block ? { blockId, pageNumber: block.pageNumber ?? null, bbox: block.bbox ?? null, confidence: block.confidence ?? 0 } : { blockId, pageNumber: null, bbox: null, confidence: 0 };
      }),
    })),
  };
}

function nestedAnswerEvidenceBlocks(
  blocks: ReturnType<typeof buildPersistedAnswerEvidenceBlocks>,
) {
  return blocks.map(({ evidenceId: _evidenceId, ...block }) => block);
}

async function createJob(db: MathGradingDb, input: { kind: 'CONVERSION' | 'GRADING' | 'BATCH' | 'RETRY' | 'RERUN'; dedupeKey: string; idempotencyKey?: string | null; reason?: string | null; rerunIdentity?: string | null; attemptId?: string; conversionId?: string; batchId?: string; batchItemId?: string; gradingRunId?: string; policyId?: string | null; correlationId: string; now: Date }) {
  const existing = await db.gradingJob.findUnique({ where: { dedupeKey: input.dedupeKey } });
  if (existing) return existing;
  return db.gradingJob.create({ data: { id: `grading-job:${sha256(input.dedupeKey).slice(-24)}`, kind: input.kind, state: 'QUEUED', dedupeKey: input.dedupeKey, idempotencyKey: input.idempotencyKey ?? null, reason: input.reason ?? null, rerunIdentity: input.rerunIdentity ?? null, attemptId: input.attemptId ?? null, conversionId: input.conversionId ?? null, batchId: input.batchId ?? null, batchItemId: input.batchItemId ?? null, gradingRunId: input.gradingRunId ?? null, policyId: input.policyId ?? null, correlationId: input.correlationId, createdAt: input.now, updatedAt: input.now } });
}

async function updateActivePersistedRecord(input: { model: any; id: string; activeStates: string[]; fencedCode: string; fallback: any; data: Record<string, unknown>; where?: Record<string, unknown>; leaseToken?: string }): Promise<any> {
  if (!input.model) throw new Error(input.fencedCode);
  if (input.model.updateMany) {
    const result = await input.model.updateMany({ where: { id: input.id, state: { in: input.activeStates }, ...(input.where ?? {}), ...(input.leaseToken ? { workerClaimToken: input.leaseToken } : {}) }, data: input.data });
    if (result?.count !== undefined && result.count !== 1) throw new Error(input.fencedCode);
    if (input.model.findUnique) return input.model.findUnique({ where: { id: input.id } });
    return { ...input.fallback, ...input.data };
  }
  if (input.model.update) {
    if (input.leaseToken) {
      if (!input.model.findUnique) throw new Error(input.fencedCode);
      const current = await input.model.findUnique({ where: { id: input.id } });
      if (!current || (current.workerClaimToken && (!input.activeStates.includes(current.state) || current.workerClaimToken !== input.leaseToken))) throw new Error(input.fencedCode);
    }
    return input.model.update({ where: { id: input.id }, data: input.data });
  }
  throw new Error(input.fencedCode);
}

async function isConversionCancellationRequested(db: MathGradingDb, jobId: string, conversionId: string, fallbackJob: any, fallbackConversion: any): Promise<boolean> {
  const currentJob = db.gradingJob?.findUnique
    ? await db.gradingJob.findUnique({ where: { id: jobId }, select: { cancelRequestedAt: true } }).catch(() => null)
    : null;
  const currentConversion = db.documentConversion?.findUnique
    ? await db.documentConversion.findUnique({ where: { id: conversionId }, select: { cancellationRequestedAt: true } }).catch(() => null)
    : null;
  return Boolean(currentJob?.cancelRequestedAt ?? fallbackJob?.cancelRequestedAt ?? currentConversion?.cancellationRequestedAt ?? fallbackConversion?.cancellationRequestedAt);
}

async function isGradingCancellationRequested(db: MathGradingDb, job: any, run: any): Promise<boolean> {
  const currentJob = db.gradingJob?.findUnique
    ? await db.gradingJob.findUnique({ where: { id: job.id }, select: { cancelRequestedAt: true, state: true } })
    : null;
  const currentRun = db.gradingRun?.findUnique
    ? await db.gradingRun.findUnique({ where: { id: run.id }, select: { state: true } })
    : null;
  const batchId = run.batchId ?? job.batchId;
  const currentBatch = batchId && db.gradingBatch?.findUnique
    ? await db.gradingBatch.findUnique({ where: { id: batchId }, select: { cancellationRequestedAt: true } })
    : null;
  return Boolean(
    job.cancelRequestedAt
      || job.state === 'CANCELLED'
      || job.cancellationRequestedAt
      || run.state === 'CANCELLED'
      || run.cancellationRequestedAt
      || currentJob?.cancelRequestedAt
      || currentJob?.state === 'CANCELLED'
      || currentRun?.state === 'CANCELLED'
      || currentBatch?.cancellationRequestedAt,
  );
}

async function settleCancelledGradingRun(db: MathGradingDb, job: any, run: any, now: Date, leaseToken?: string): Promise<any> {
  const runData = {
    state: 'CANCELLED',
    draftTotalScore: null,
    overallComment: null,
    blockedReasons: [...new Set([...(run.blockedReasons ?? []), 'grading-cancelled'])],
    limitations: [...new Set([...(run.limitations ?? []), 'grading-cancelled'])],
    updatedAt: now,
  };
  const jobData = { state: 'CANCELLED', progress: 100, nextRunAt: null, completedAt: now, lastErrorCode: 'grading-cancelled', workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now };
  await updateActivePersistedRecord({ model: db.gradingJob, id: job.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'grading-worker-fenced', fallback: job, leaseToken, data: { updatedAt: now } });
  const updatedJob = await updateActivePersistedRecord({ model: db.gradingJob, id: job.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'grading-worker-fenced', fallback: job, leaseToken, data: jobData });
  const updatedRun = await updateActivePersistedRecord({ model: db.gradingRun, id: run.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'grading-worker-fenced', fallback: run, data: runData });
  await writeGradingAudit(db, {
    actor: { id: 'grading-worker', role: 'SERVICE' },
    action: 'grading-run.cancelled',
    purpose: 'rubric-grading',
    resourceType: 'GradingRun',
    resourceId: run.id,
    answerId: run.answerAttempt?.answerId,
    classId: run.answerAttempt?.answer?.submission?.frozenAudienceClassId,
    metadata: { state: 'CANCELLED', reason: 'cancellation-requested-during-provider-call' },
  });
  return { ...updatedRun, state: updatedRun?.state ?? 'CANCELLED', job: updatedJob };
}

async function settleCancelledConversion(db: MathGradingDb, job: any, conversion: any, now: Date, leaseToken?: string): Promise<{ conversion: any; evidence: null }> {
  const execute = async (tx: MathGradingDb) => {
    const conversionData = { state: 'CANCELLED', progress: 100, completedAt: now, updatedAt: now };
    const jobData = { state: 'CANCELLED', progress: 100, completedAt: now, workerClaimToken: null, workerClaimedAt: null, workerLeaseExpiresAt: null, updatedAt: now };
    await updateActivePersistedRecord({ model: (tx as any).gradingJob, id: job.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'conversion-worker-fenced', fallback: job, leaseToken, data: { updatedAt: now } });
    const updatedConversion = await updateActivePersistedRecord({ model: (tx as any).documentConversion, id: conversion.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'conversion-worker-fenced', fallback: conversion, data: conversionData });
    const updatedJob = await updateActivePersistedRecord({ model: (tx as any).gradingJob, id: job.id, activeStates: ['QUEUED', 'RUNNING', 'RETRYABLE'], fencedCode: 'conversion-worker-fenced', fallback: job, leaseToken, data: jobData });
    await writeGradingAudit(tx, {
      actor: { id: 'grading-worker', role: 'SERVICE' },
      action: 'document-conversion.cancelled',
      purpose: 'answer-conversion',
      resourceType: 'DocumentConversion',
      resourceId: conversion.id,
      answerId: conversion.asset?.answerId,
      classId: conversion.asset?.answer?.submission?.frozenAudienceClassId,
      metadata: { state: 'CANCELLED', reason: 'cancellation-requested' },
    });
    return { conversion: updatedConversion ?? { ...conversion, ...conversionData }, evidence: null, job: updatedJob };
  };
  return db.$transaction ? db.$transaction(execute) : execute(db);
}

export async function writeGradingAudit(db: MathGradingDb, input: { actor: PipelineActor; action: string; purpose: string; resourceType: string; resourceId: string; assignmentId?: string; answerId?: string; classId?: string; provider?: string; providerRequestId?: string; policyVersion?: string; metadata: Record<string, unknown> }) {
  if (!db.gradingAuditEvent?.create) throw new Error('grading-audit-repository-unavailable');
  const resourceId = auditPseudoId(input.resourceId, input.purpose, 'resource');
  const assignmentId = input.assignmentId ? auditPseudoId(input.assignmentId, input.purpose, 'assignment') : null;
  const answerId = input.answerId ? auditPseudoId(input.answerId, input.purpose, 'answer') : null;
  const classId = input.classId ? auditPseudoId(input.classId, input.purpose, 'class') : null;
  const providerRequestId = input.providerRequestId ? auditPseudoId(input.providerRequestId, input.purpose, 'provider-request') : null;
  const eventKey = buildPipelineDedupeKey('grading-audit-event', {
    action: input.action,
    purpose: input.purpose,
    resourceType: input.resourceType,
    resourceId,
    assignmentId,
    answerId,
    classId,
    providerRequestId,
    attempt: input.metadata.attempt ?? null,
    errorCode: input.metadata.errorCode ?? null,
    auditIdentity: randomUUID(),
  });
  const audit = await db.gradingAuditEvent.create({ data: { eventKey, actorPseudoId: pseudonymousAuditId(input.actor.id, input.purpose), actorRole: input.actor.role, action: input.action, purpose: input.purpose, resourceType: input.resourceType, resourceId, assignmentId, answerId, classId, provider: input.provider ?? null, providerRequestId, policyVersion: input.policyVersion ?? null, metadata: redactAuditMetadata(input.metadata, input.purpose) } });
  if (!audit || typeof audit.id !== 'string' || !audit.id.trim()) {
    throw new Error('grading-audit-id-required');
  }
  return { id: audit.id };
}

function readSnapshotText(value: unknown, key: string): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (key in record) return String(record[key] ?? '');
    if (key === 'prompt' && 'text' in record) return String(record.text ?? '');
    if (key === 'text' && 'value' in record) return String(record.value ?? '');
  }
  return '';
}

function redactAuditMetadata(value: Record<string, unknown>, purpose: string): Record<string, unknown> {
  const safeRuntime = buildSafeAuditRuntime(value);
  const transform = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(transform);
    if (!current || typeof current !== 'object') return current;
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (key === 'error') {
        continue;
      } else if (key === 'errorCode') {
        const safeCode = boundedAuditCode(child);
        result[key] = safeCode ?? '[redacted]';
      } else if (['policyVersion', 'deleteStrategy', 'blockedReason', 'provider'].includes(key)) {
        const safeCode = boundedAuditCode(child, key === 'provider' ? 64 : 120);
        result[key] = safeCode ?? '[redacted]';
      } else if (/^(?:resource|answer|class|assignment|question|attempt|asset|conversion|evidence|run|batch|item|hold|scope|student|providerRequest|actor)(?:Id|ID)?$/i.test(key) && typeof child === 'string') {
        result[key] = auditPseudoId(child, purpose, key);
      } else if (/answer|content|markdown|text|prompt|reference|payload|bytes|signed|url|secret|token|authorization|api.?key|email|reason|error|excerpt|comment|rationale|overallComment|idempotency|requestHash|correlation/i.test(key)) {
        result[key] = '[redacted]';
      } else {
        result[key] = transform(child);
      }
    }
    return result;
  };
  const transformed = transform(value);
  if (!transformed || typeof transformed !== 'object' || Array.isArray(transformed)) return {};
  const result = transformed as Record<string, unknown>;
  if (Object.keys(safeRuntime).length > 0) result.safeRuntime = safeRuntime;
  return result;
}

function boundedAuditCode(value: unknown, maxLength = 120): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength && /^[A-Za-z0-9:_-]+$/.test(normalized) ? normalized : null;
}

function boundedAuditInteger(value: unknown, maxDigits = 6): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && String(value).length <= maxDigits) return value;
  if (typeof value === 'string' && new RegExp(`^[0-9]{1,${maxDigits}}$`).test(value)) return Number(value);
  return null;
}

function buildSafeAuditRuntime(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of ['attempt', 'attemptNumber', 'attempts', 'retryCount']) {
    const bounded = boundedAuditInteger(value[key]);
    if (bounded !== null) result[key] = bounded;
  }
  if (typeof value.retryable === 'boolean') result.retryable = value.retryable;
  const errorCode = boundedAuditCode(value.errorCode) ?? boundedAuditCode(value.error);
  if (errorCode) result.errorCode = errorCode;
  for (const key of ['state', 'status', 'outcome', 'stage', 'policyVersion', 'deleteStrategy', 'blockedReason']) {
    const bounded = boundedAuditCode(value[key]);
    if (bounded) result[key] = bounded;
  }
  const provider = boundedAuditCode(value.provider, 64);
  if (provider) result.provider = provider;
  for (const key of ['durationMs', 'latencyMs']) {
    const bounded = boundedAuditInteger(value[key], 9);
    if (bounded !== null) result[key] = bounded;
  }
  return result;
}

function auditPseudoId(value: string, purpose: string, field: string): string {
  return pseudonymousAuditId(`${field}:${value}`, `${purpose}:${field}`);
}

export function validateFrozenRunInput(run: any, question: FrozenQuestionContract, evidence: any): string | null {
  if (!run.questionSnapshot || !run.questionSnapshotHash) return 'frozen-question-snapshot-missing';
  if (question.contentHash !== run.questionSnapshotHash) return 'frozen-question-hash-mismatch';
  const snapshotReferenceAnswer = typeof run.questionSnapshot.referenceAnswer === 'string'
    ? run.questionSnapshot.referenceAnswer
    : readSnapshotText(run.questionSnapshot.answerSnapshot, 'text');
  if (typeof run.referenceAnswer === 'string' && snapshotReferenceAnswer && run.referenceAnswer !== snapshotReferenceAnswer) return 'frozen-reference-answer-mismatch';
  const snapshotRubricVersion = typeof run.questionSnapshot.rubric?.version === 'string'
    ? run.questionSnapshot.rubric.version
    : typeof run.questionSnapshot.rubricSnapshot?.version === 'string'
      ? run.questionSnapshot.rubricSnapshot.version
      : null;
  if (run.rubricVersion && snapshotRubricVersion && snapshotRubricVersion !== run.rubricVersion) return 'frozen-rubric-version-mismatch';
  if (run.rubricVersion && question.rubric.version !== run.rubricVersion) return 'frozen-rubric-version-mismatch';
  if (run.inputHash && run.evaluatorVersion) {
    const payload = {
      questionSnapshot: question,
      evidence: { id: evidence.id, version: evidence.version, sourceHash: evidence.sourceHash, anchorVersion: evidence.anchorVersion },
      evaluator: { provider: run.evaluatorId ?? 'configured-provider', version: run.evaluatorVersion },
      ...(run.attachmentManifestHash ? { attachmentManifestHash: run.attachmentManifestHash } : {}),
    };
    const expected = sha256(stableStringify(payload));
    if (expected !== run.inputHash) return 'frozen-input-hash-mismatch';
  }
  return null;
}

function resolvePersistedEvidenceBlock(blocks: readonly any[], anchorId: string): any | null {
  return blocks.find((candidate) => candidate.id === anchorId || candidate.id.endsWith(`:${anchorId}`)) ?? null;
}

function conversionTerminalJobState(state: string): 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'BLOCKED' | 'CONTENT_UNAVAILABLE' {
  if (state === 'BLOCKED') return 'BLOCKED';
  if (state === 'FAILED') return 'FAILED';
  if (state === 'CANCELLED') return 'CANCELLED';
  if (state === 'CONTENT_UNAVAILABLE' || state === 'DELETED') return 'CONTENT_UNAVAILABLE';
  return 'SUCCEEDED';
}

function gradingTerminalJobState(state: string): 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'BLOCKED' | 'CONTENT_UNAVAILABLE' {
  if (state === 'FAILED') return 'FAILED';
  if (state === 'CANCELLED') return 'CANCELLED';
  if (state === 'BLOCKED') return 'BLOCKED';
  if (state === 'CONTENT_UNAVAILABLE') return 'CONTENT_UNAVAILABLE';
  return 'SUCCEEDED';
}

function persistenceBlockedDraft(question: FrozenQuestionContract, evidence: NormalizedAnswerEvidence, reasons: string[]): ValidatedGradingDraft {
  return {
    evaluatorId: 'blocked-provider',
    evaluatorVersion: 'blocked',
    assessments: [],
    limitations: evidence.limitations,
    overallComment: '',
    inputHash: sha256(stableStringify({ questionSnapshot: question, evidence: evidence.sourceHash })),
    dedupeKey: buildPipelineDedupeKey('grading-run', { question: question.questionId, evidence: evidence.sourceHash, frozen: true }),
    state: 'blocked',
    blockedReasons: [...new Set(reasons)],
    promptInjectionDetected: false,
    provider: 'blocked-provider',
    providerRequestId: null,
    deletionHandle: null,
    providerRequestedAt: null,
    providerProcessedAt: null,
    inputTokens: null,
    outputTokens: null,
    telemetryComplete: false,
  };
}

function terminalRunDraft(run: any): ValidatedGradingDraft {
  return {
    evaluatorId: run.evaluatorId ?? 'persisted-provider',
    evaluatorVersion: run.evaluatorVersion ?? 'persisted-version',
    assessments: [],
    limitations: run.limitations ?? [],
    overallComment: run.overallComment ?? '',
    overallFeedback: run.overallFeedback ?? undefined,
    inputHash: run.inputHash ?? 'persisted-input',
    dedupeKey: run.dedupeKey ?? `persisted:${run.id}`,
    state: ['BLOCKED', 'FAILED', 'CANCELLED', 'CONTENT_UNAVAILABLE'].includes(run.state) ? 'blocked' : 'awaiting-review',
    blockedReasons: run.blockedReasons ?? [],
    promptInjectionDetected: false,
    provider: run.provider ?? run.evaluatorId ?? 'persisted-provider',
    providerRequestId: run.providerRequestId ?? null,
    deletionHandle: run.providerDeletionHandle ?? null,
    providerRequestedAt: run.providerRequestedAt ?? null,
    providerProcessedAt: run.providerProcessedAt ?? null,
    inputTokens: run.providerInputTokens ?? null,
    outputTokens: run.providerOutputTokens ?? null,
    telemetryComplete: run.providerTelemetryComplete === true,
  };
}

function gradingCancelledDraft(question: FrozenQuestionContract, evidence: NormalizedAnswerEvidence): ValidatedGradingDraft {
  return persistenceBlockedDraft(question, evidence, ['grading-cancelled']);
}

export async function assertPipelineActorScope(input: {
  db: MathGradingDb;
  actor: PipelineActor;
  assignmentRevisionId?: string | null;
  classId: string;
  classTeacherId?: string | null;
  ownerStudentId?: string | null;
  requestedStudentId?: string | null;
  purpose: 'submit' | 'teacher-review' | 'service';
  now: Date;
}): Promise<void> {
  let assignmentAuthorId: string | null = null;
  let hasAssignmentReviewGrant = false;
  if (input.actor.role === 'TEACHER' && input.classTeacherId !== input.actor.id && input.assignmentRevisionId && input.db.assignmentRevision?.findUnique) {
    const revision = await input.db.assignmentRevision.findUnique({
      where: { id: input.assignmentRevisionId },
      select: {
        assignment: {
          select: {
            authorId: true,
            reviewGrants: {
              where: { teacherId: input.actor.id, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: input.now } }] },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });
    assignmentAuthorId = revision?.assignment?.authorId ?? null;
    hasAssignmentReviewGrant = Boolean(revision?.assignment?.reviewGrants?.length);
  }
  if (!authorizeGradingScope({
    role: input.actor.role,
    actorId: input.actor.id,
    requestedStudentId: input.requestedStudentId ?? undefined,
    requestedClassId: input.classId,
    ownerClassId: input.classId,
    classTeacherId: input.classTeacherId,
    assignmentAuthorId,
    hasAssignmentReviewGrant,
    ownerStudentId: input.ownerStudentId,
    purpose: input.purpose,
  })) throw new Error(input.purpose === 'teacher-review' ? 'grading-forbidden' : 'conversion-forbidden');
}

async function assertConversionTeacherScope(submission: any, actor: PipelineActor, assignmentRevisionId: string, now: Date, db: MathGradingDb): Promise<void> {
  const classId = submission.frozenAudienceClassId;
  if (submission.audience.classId !== classId) throw new Error('conversion-class-binding-invalid');
  await assertPipelineActorScope({
    db,
    actor,
    assignmentRevisionId,
    classId,
    classTeacherId: submission.audience.class.teacherId,
    ownerStudentId: submission.frozenStudentId,
    purpose: actor.role === 'SERVICE' || actor.role === 'ADMIN' ? 'service' : 'teacher-review',
    now,
  });
}
