import { createHash, randomUUID } from 'node:crypto';

type NativeFormat = 'DOCX' | 'PDF';

export type ReviewedDerivativeAnchorCapability = {
  anchorVersion: string;
  nativeFormats: readonly NativeFormat[];
};

export type ReviewedDerivativeOptions = {
  generatorId: string;
  generatorVersion: string;
  anchorMapVersion?: string;
  nativeFormats: readonly NativeFormat[];
  anchorCapabilities?: readonly ReviewedDerivativeAnchorCapability[];
};

export type ReviewedDerivativePlan = {
  snapshotId: string;
  sourceAssetId: string | null;
  sourceObjectKey: string | null;
  sourceSizeBytes: number | null;
  sourceChecksum: string;
  sourceRepresentation: 'ORIGINAL_ASSET' | 'CANONICAL_PDF';
  reviewSnapshotChecksum: string;
  generatorId: string;
  generatorVersion: string;
  anchorMapVersion: string;
  lifecyclePolicyVersion: string | null;
  idempotencyKey: string;
  outputKind: 'REVIEWED_DOCX' | 'REVIEWED_PDF' | 'ANNOTATED_MARKDOWN';
  outputMimeType: string;
  nativeCapable: boolean;
  anchorPrecision: 'SPAN' | 'BLOCK' | 'PAGE' | 'GENERAL';
  limitations: string[];
  annotations: Array<Record<string, unknown> & { anchor: Record<string, unknown> }>;
  canonicalMarkdown: string;
  criterionSnapshot: unknown;
  overallComment: string | null;
};

export interface ReviewedDerivativeRenderer {
  render(plan: ReviewedDerivativePlan): Promise<{ objectKey: string; checksum: string; sizeBytes: number; outputKind?: ReviewedDerivativePlan['outputKind']; outputMimeType?: string; nativeCapable?: boolean; anchorPrecision?: ReviewedDerivativePlan['anchorPrecision']; limitations?: string[] }>;
}

export function defaultReviewedDerivativeAnchorCapabilities(env: { markitdownVersion?: string; mathpixVersion?: string } = {}): ReviewedDerivativeAnchorCapability[] {
  return [
    { anchorVersion: `${env.markitdownVersion ?? 'local.v1'}:anchors`, nativeFormats: ['DOCX'] },
    { anchorVersion: `${env.mathpixVersion ?? 'mathpix.v1'}:anchors`, nativeFormats: ['PDF'] },
  ];
}

export function defaultReviewedDerivativeOptions(env: { generatorVersion?: string; markitdownVersion?: string; mathpixVersion?: string } = {}): ReviewedDerivativeOptions {
  return {
    generatorId: 'native-reviewed-derivative-s3',
    generatorVersion: env.generatorVersion ?? '1',
    nativeFormats: ['DOCX', 'PDF'],
    anchorCapabilities: defaultReviewedDerivativeAnchorCapabilities(env),
  };
}

export class ReviewedDerivativeError extends Error {
  readonly retryable: boolean;
  readonly blocked: boolean;
  constructor(public readonly code: string, options?: { retryable?: boolean; blocked?: boolean }) {
    super(code);
    this.retryable = options?.retryable ?? false;
    this.blocked = options?.blocked ?? false;
  }
}

export function buildReviewedDerivativePlan(snapshot: any, options: ReviewedDerivativeOptions): ReviewedDerivativePlan {
  const evidence = snapshot?.answerEvidence;
  const asset = evidence?.sourceAsset ?? null;
  const originalSourceChecksum = requiredChecksum(evidence?.sourceHash, 'reviewed-derivative-source-checksum-missing');
  const aggregateAttachmentEvidence = evidence?.sourceAssetId == null
    && evidence?.sourceManifest?.version === 'assignment-answer-evidence.v2';
  if (asset?.checksum != null && !aggregateAttachmentEvidence) {
    const assetChecksum = requiredChecksum(asset.checksum, 'reviewed-derivative-source-asset-checksum-invalid');
    if (assetChecksum !== originalSourceChecksum) throw new ReviewedDerivativeError('reviewed-derivative-source-checksum-mismatch', { blocked: true });
  }
  const originalFormat = mimeFormat(asset?.mimeType);
  const canonicalPdf = originalFormat === 'DOCX' ? resolveCanonicalPdf(evidence, asset) : null;
  if (originalFormat === 'DOCX' && !canonicalPdf) {
    throw new ReviewedDerivativeError('reviewed-derivative-canonical-pdf-missing', { blocked: true });
  }
  const sourceFormat: NativeFormat | null = canonicalPdf ? 'PDF' : originalFormat;
  const sourceChecksum = canonicalPdf?.checksum ?? originalSourceChecksum;
  const sourceObjectKey = canonicalPdf?.objectKey ?? asset?.objectKey ?? null;
  // A canonical PDF is a distinct object from the submitted Word file.  If its
  // byte size was not persisted, leave it unfrozen rather than applying the
  // Word size and rejecting the otherwise checksum-verified PDF at read time.
  const frozenSourceSize = canonicalPdf
    ? canonicalPdf.sizeBytes
    : (Number.isInteger(asset?.sizeBytes) && asset.sizeBytes >= 0 ? asset.sizeBytes : null);
  const annotations = Array.isArray(snapshot?.annotationSnapshot) ? snapshot.annotationSnapshot.filter((row: any) => row?.status !== 'SUPPRESSED') : [];
  const capabilities = options.anchorCapabilities ?? (options.anchorMapVersion
    ? [{ anchorVersion: options.anchorMapVersion, nativeFormats: options.nativeFormats }]
    : defaultReviewedDerivativeAnchorCapabilities());
  const capability = capabilities.find((entry) => entry.anchorVersion === evidence?.anchorVersion);
  const anchorMapReliable = Boolean(capability)
    && annotations.every((row: any) => isReliableAnchor(row?.anchor, evidence));
  const nativeCapable = Boolean(originalFormat === 'PDF' && sourceFormat && frozenSourceSize != null && options.nativeFormats.includes(sourceFormat) && capability?.nativeFormats.includes(sourceFormat) && anchorMapReliable
    && annotations.every((row: any) => supportsNativeAnchor(sourceFormat, row?.anchor, evidence)));
  const limitations: string[] = [];
  if (!capability) limitations.push('anchor-capability-unregistered');
  if (sourceFormat && frozenSourceSize == null && !canonicalPdf) limitations.push('source-size-not-frozen');
  if (sourceFormat === 'PDF' && capability?.nativeFormats.includes('PDF') && !annotations.every((row: any) => hasFrozenPdfCoordinateProvenance(row?.anchor, evidence))) limitations.push('pdf-coordinate-provenance-missing');
  if (!anchorMapReliable && !limitations.includes('anchor-map-version-mismatch')) limitations.push('anchor-mapping-unreliable');
  if (canonicalPdf) limitations.push('word-review-uses-canonical-pdf');

  let outputKind: ReviewedDerivativePlan['outputKind'] = 'ANNOTATED_MARKDOWN';
  let outputMimeType = 'text/markdown';
  if (sourceFormat === 'PDF' && options.nativeFormats.includes('PDF')) {
    outputKind = 'REVIEWED_PDF';
    outputMimeType = 'application/pdf';
    if (!nativeCapable) limitations.push('reviewed-pdf-summary-only-no-precise-overlay');
  }

  const preserveMappedAnchors = anchorMapReliable && !(outputKind === 'REVIEWED_PDF' && !nativeCapable);
  const safeAnnotations = preserveMappedAnchors
    ? annotations.map((row: any) => ({ ...copyAnnotation(row), anchor: sanitizeReliableAnchor(row.anchor, evidence) }))
    : annotations.map((row: any) => ({ ...copyAnnotation(row), anchor: { precision: 'GENERAL' } }));
  const anchorPrecision = aggregateAnchorPrecision(safeAnnotations);
  const reviewSnapshotChecksum = checksum({
    snapshotId: snapshot.id,
    reviewId: snapshot.reviewId,
    reviewVersion: snapshot.reviewVersion,
    machineSnapshotHash: snapshot.machineSnapshotHash,
    criterionSnapshot: snapshot.criterionSnapshot,
    annotationSnapshot: snapshot.annotationSnapshot,
    overallComment: snapshot.overallComment,
    lifecyclePolicyVersion: snapshot.lifecyclePolicyVersion,
  });
  const anchorMapVersion = capability?.anchorVersion ?? String(evidence?.anchorVersion ?? 'unregistered');
  const idempotencyKey = checksum({ sourceChecksum, reviewSnapshotChecksum, generatorId: options.generatorId, generatorVersion: options.generatorVersion, anchorMapVersion });
  return {
    snapshotId: snapshot.id,
    sourceAssetId: asset?.id ?? null,
    sourceObjectKey,
    sourceSizeBytes: frozenSourceSize,
    sourceChecksum,
    sourceRepresentation: canonicalPdf ? 'CANONICAL_PDF' : 'ORIGINAL_ASSET',
    reviewSnapshotChecksum,
    generatorId: options.generatorId,
    generatorVersion: options.generatorVersion,
    anchorMapVersion,
    lifecyclePolicyVersion: snapshot.lifecyclePolicyVersion ?? null,
    idempotencyKey,
    outputKind,
    outputMimeType,
    nativeCapable,
    anchorPrecision,
    limitations: [...new Set(limitations)],
    annotations: safeAnnotations,
    canonicalMarkdown: String(evidence?.canonicalMarkdown ?? ''),
    criterionSnapshot: snapshot.criterionSnapshot ?? [],
    overallComment: snapshot.overallComment ?? null,
  };
}

export async function generateReviewedDerivative(input: {
  db: any;
  snapshot: any;
  renderer: ReviewedDerivativeRenderer;
  options: ReviewedDerivativeOptions;
  claimToken?: string;
  leaseMs?: number;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const claimToken = input.claimToken ?? cryptoRandomToken();
  const leaseMs = input.leaseMs ?? 60_000;
  const plan = buildReviewedDerivativePlan(input.snapshot, input.options);
  let row = await input.db.teacherAssignmentReviewedDerivative.findUnique({ where: { idempotencyKey: plan.idempotencyKey } });
  if (row?.state === 'READY') return row;
  if (row?.state === 'FAILED' || row?.state === 'BLOCKED') {
    throw new ReviewedDerivativeError(row.lastErrorCode ?? 'reviewed-derivative-terminal', { blocked: row.state === 'BLOCKED' });
  }
  if (row) {
    if (row.state === 'GENERATING' && row.leaseExpiresAt && new Date(row.leaseExpiresAt) > now) {
      throw new ReviewedDerivativeError('reviewed-derivative-generation-in-progress', { retryable: true });
    }
    const claimed = await input.db.teacherAssignmentReviewedDerivative.updateMany({
      where: row.state === 'GENERATING'
        ? {
          id: row.id,
          state: 'GENERATING',
          claimToken: row.claimToken ?? null,
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
          sourceChecksum: plan.sourceChecksum,
          reviewSnapshotChecksum: plan.reviewSnapshotChecksum,
        }
        : { id: row.id, state: 'RETRYABLE', sourceChecksum: plan.sourceChecksum, reviewSnapshotChecksum: plan.reviewSnapshotChecksum },
      data: {
        state: 'GENERATING',
        claimToken,
        claimedAt: now,
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
        attemptCount: { increment: 1 },
        lastErrorCode: null,
        updatedAt: now,
      },
    });
    if (claimed?.count !== 1) throw new ReviewedDerivativeError('reviewed-derivative-generation-in-progress', { retryable: true });
    row = { ...row, state: 'GENERATING', claimToken, claimedAt: now, leaseExpiresAt: new Date(now.getTime() + leaseMs) };
  } else {
    try {
      row = await input.db.teacherAssignmentReviewedDerivative.create({
        data: {
          snapshotId: plan.snapshotId,
          sourceAssetId: plan.sourceAssetId,
          sourceObjectKey: plan.sourceObjectKey,
          sourceChecksum: plan.sourceChecksum,
          reviewSnapshotChecksum: plan.reviewSnapshotChecksum,
          generatorId: plan.generatorId,
          generatorVersion: plan.generatorVersion,
          anchorMapVersion: plan.anchorMapVersion,
          lifecyclePolicyVersion: plan.lifecyclePolicyVersion,
          idempotencyKey: plan.idempotencyKey,
          state: 'GENERATING',
          outputKind: plan.outputKind,
          outputMimeType: plan.outputMimeType,
          nativeCapable: plan.nativeCapable,
          anchorPrecision: plan.anchorPrecision,
          limitations: plan.limitations,
          attemptCount: 1,
          claimToken,
          claimedAt: now,
          leaseExpiresAt: new Date(now.getTime() + leaseMs),
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const winner = await input.db.teacherAssignmentReviewedDerivative.findUnique({ where: { idempotencyKey: plan.idempotencyKey } });
      if (!winner) throw error;
      if (winner.state === 'READY') return winner;
      if (winner.state === 'GENERATING') throw new ReviewedDerivativeError('reviewed-derivative-generation-in-progress', { retryable: true });
      if (winner.state === 'RETRYABLE') throw new ReviewedDerivativeError('reviewed-derivative-generation-race', { retryable: true });
      if (winner.state === 'BLOCKED') throw new ReviewedDerivativeError(String(winner.lastErrorCode ?? 'reviewed-derivative-generation-blocked'), { blocked: true });
      throw new ReviewedDerivativeError(String(winner.lastErrorCode ?? 'reviewed-derivative-generation-failed'));
    }
  }
  const heartbeat = startDerivativeLeaseHeartbeat({ db: input.db, derivativeId: row.id, claimToken, leaseMs });
  try {
    const rendered = await input.renderer.render(plan);
    if (heartbeat.isLost()) throw new ReviewedDerivativeError('reviewed-derivative-generation-fenced', { retryable: true });
    requiredChecksum(rendered.checksum, 'reviewed-derivative-output-checksum-missing');
    if (!rendered.objectKey || !Number.isInteger(rendered.sizeBytes) || rendered.sizeBytes < 0) throw new ReviewedDerivativeError('reviewed-derivative-output-invalid');
    const completedAt = input.now ?? new Date();
    const completed = await input.db.teacherAssignmentReviewedDerivative.updateMany({
      where: {
        id: row.id,
        state: 'GENERATING',
        claimToken,
        leaseExpiresAt: { gt: completedAt },
        sourceChecksum: plan.sourceChecksum,
        reviewSnapshotChecksum: plan.reviewSnapshotChecksum,
      },
      data: {
        state: 'READY',
        outputKind: rendered.outputKind ?? plan.outputKind,
        outputMimeType: rendered.outputMimeType ?? plan.outputMimeType,
        nativeCapable: rendered.nativeCapable ?? plan.nativeCapable,
        anchorPrecision: rendered.anchorPrecision ?? plan.anchorPrecision,
        limitations: rendered.limitations ?? plan.limitations,
        outputObjectKey: rendered.objectKey,
        outputChecksum: rendered.checksum,
        outputSizeBytes: rendered.sizeBytes,
        readyAt: completedAt,
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: null,
        updatedAt: completedAt,
      },
    });
    if (completed?.count !== 1) throw new ReviewedDerivativeError('reviewed-derivative-generation-fenced', { retryable: true });
    return { ...row, state: 'READY', outputKind: rendered.outputKind ?? plan.outputKind, outputMimeType: rendered.outputMimeType ?? plan.outputMimeType, nativeCapable: rendered.nativeCapable ?? plan.nativeCapable, anchorPrecision: rendered.anchorPrecision ?? plan.anchorPrecision, limitations: rendered.limitations ?? plan.limitations, outputObjectKey: rendered.objectKey, outputChecksum: rendered.checksum, outputSizeBytes: rendered.sizeBytes, readyAt: completedAt, claimToken: null, claimedAt: null, leaseExpiresAt: null };
  } catch (error) {
    const normalized = error instanceof ReviewedDerivativeError
      ? error
      : new ReviewedDerivativeError('reviewed-derivative-render-failed', { retryable: true });
    const failedAt = input.now ?? new Date();
    const failed = await input.db.teacherAssignmentReviewedDerivative.updateMany({
      where: { id: row.id, state: 'GENERATING', claimToken, leaseExpiresAt: { gt: failedAt } },
      data: {
        state: normalized.blocked ? 'BLOCKED' : normalized.retryable ? 'RETRYABLE' : 'FAILED',
        claimToken: null,
        claimedAt: null,
        leaseExpiresAt: null,
        lastErrorCode: normalized.code,
        updatedAt: failedAt,
      },
    });
    if (failed?.count !== 1) throw new ReviewedDerivativeError('reviewed-derivative-generation-fenced', { retryable: true });
    throw normalized;
  } finally {
    heartbeat.stop();
  }
}

function mimeFormat(mimeType: unknown): NativeFormat | null {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'DOCX';
  return null;
}

function resolveCanonicalPdf(evidence: any, sourceAsset: any): { objectKey: string; checksum: string; sizeBytes: number | null } | null {
  const conversion = evidence?.conversion;
  const fallbackWordConversion = conversion?.state === 'FALLBACK'
    && conversion.adapter === 'local-markitdown'
    && mimeFormat(sourceAsset?.mimeType) === 'DOCX';
  if ((conversion?.state !== 'SUCCEEDED' && !fallbackWordConversion) || typeof conversion.renderedObjectKey !== 'string' || conversion.renderedObjectKey.length === 0) return null;
  const checksum = requiredChecksum(conversion.renderedChecksum, 'reviewed-derivative-canonical-pdf-checksum-missing');
  return {
    objectKey: conversion.renderedObjectKey,
    checksum,
    sizeBytes: Number.isInteger(conversion.renderedSizeBytes) && conversion.renderedSizeBytes >= 0 ? conversion.renderedSizeBytes : null,
  };
}

function isReliableAnchor(anchor: any, evidence: any): boolean {
  const precision = normalizePrecision(anchor?.precision);
  const allowed = precisionRank(precision) <= precisionRank(normalizePrecision(evidence?.precision));
  if (!allowed) return false;
  if (precision === 'SPAN') return Number.isInteger(anchor?.spanStart) && Number.isInteger(anchor?.spanEnd)
    && anchor.spanStart >= 0 && anchor.spanEnd >= anchor.spanStart && anchor.spanEnd <= String(evidence?.canonicalMarkdown ?? '').length;
  if (precision === 'BLOCK') return typeof anchor?.blockId === 'string'
    && Array.isArray(evidence?.blocks) && evidence.blocks.some((block: any) => block?.id === anchor.blockId);
  if (precision === 'PAGE') return Number.isInteger(anchor?.pageNumber) && anchor.pageNumber > 0 && isValidBbox(anchor?.bbox)
    && Array.isArray(evidence?.blocks) && evidence.blocks.some((block: any) => samePageBbox(block, anchor));
  return false;
}

function supportsNativeAnchor(format: NativeFormat, anchor: any, evidence: any) {
  const precision = normalizePrecision(anchor?.precision);
  if (format === 'DOCX') return precision === 'SPAN';
  if (precision === 'PAGE') return isValidBbox(anchor?.bbox) && hasFrozenPdfCoordinateProvenance(anchor, evidence);
  if (precision !== 'BLOCK' || !Number.isInteger(anchor?.pageNumber) || !isValidBbox(anchor?.bbox)) return false;
  const block = Array.isArray(evidence?.blocks) ? evidence.blocks.find((row: any) => row?.id === anchor?.blockId) : null;
  return Boolean(block && samePageBbox(block, anchor) && hasFrozenPdfCoordinateProvenance(anchor, evidence));
}

function sanitizeReliableAnchor(anchor: any, evidence: any) {
  const precision = normalizePrecision(anchor?.precision);
  const block = Array.isArray(evidence?.blocks) ? evidence.blocks.find((row: any) => row?.id === anchor?.blockId || row?.pageNumber === anchor?.pageNumber) : null;
  const coordinateProvenance = isFrozenPdfCoordinateProvenance(block?.coordinateProvenance) ? block.coordinateProvenance : anchor?.coordinateProvenance;
  if (precision === 'SPAN') return { precision, spanStart: anchor.spanStart, spanEnd: anchor.spanEnd };
  if (precision === 'BLOCK') return {
    precision, blockId: anchor.blockId,
    ...(Number.isInteger(anchor.pageNumber) ? { pageNumber: anchor.pageNumber } : {}),
    ...(isValidBbox(anchor.bbox) ? { bbox: [...anchor.bbox] } : {}),
    ...(isFrozenPdfCoordinateProvenance(coordinateProvenance) ? { coordinateProvenance: { ...coordinateProvenance } } : {}),
  };
  if (precision === 'PAGE') return { precision, pageNumber: anchor.pageNumber, bbox: [...anchor.bbox], coordinateProvenance: { ...coordinateProvenance } };
  return { precision: 'GENERAL' };
}

function isValidBbox(value: unknown): value is [number, number, number, number] {
  return Array.isArray(value) && value.length === 4
    && value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate) && coordinate >= 0)
    && value[0] < value[2] && value[1] < value[3];
}

function samePageBbox(block: any, anchor: any) {
  return block?.pageNumber === anchor?.pageNumber && isValidBbox(block?.bbox) && isValidBbox(anchor?.bbox)
    && block.bbox.every((coordinate: number, index: number) => coordinate === anchor.bbox[index]);
}

function hasFrozenPdfCoordinateProvenance(anchor: any, evidence: any) {
  const block = Array.isArray(evidence?.blocks) ? evidence.blocks.find((row: any) => row?.id === anchor?.blockId || row?.pageNumber === anchor?.pageNumber) : null;
  if (!isFrozenPdfCoordinateProvenance(block?.coordinateProvenance)) return false;
  return !anchor?.coordinateProvenance || (isFrozenPdfCoordinateProvenance(anchor.coordinateProvenance)
    && stableStringify(block.coordinateProvenance) === stableStringify(anchor.coordinateProvenance));
}

function isFrozenPdfCoordinateProvenance(value: any) {
  return value && ['TOP_LEFT', 'BOTTOM_LEFT'].includes(value.origin)
    && ['PDF_POINT', 'NORMALIZED', 'PIXEL'].includes(value.unit)
    && Number.isFinite(value.pageWidth) && value.pageWidth > 0
    && Number.isFinite(value.pageHeight) && value.pageHeight > 0
    && [0, 90, 180, 270].includes(value.rotation);
}

function normalizePrecision(value: unknown): ReviewedDerivativePlan['anchorPrecision'] {
  const normalized = String(value ?? '').toUpperCase();
  return normalized === 'SPAN' || normalized === 'BLOCK' || normalized === 'PAGE' ? normalized : 'GENERAL';
}

function precisionRank(value: ReviewedDerivativePlan['anchorPrecision']) {
  return { GENERAL: 0, PAGE: 1, BLOCK: 2, SPAN: 3 }[value];
}

function aggregateAnchorPrecision(annotations: ReviewedDerivativePlan['annotations']): ReviewedDerivativePlan['anchorPrecision'] {
  if (annotations.length === 0) return 'GENERAL';
  return annotations.reduce<ReviewedDerivativePlan['anchorPrecision']>((weakest, annotation) => {
    const current = normalizePrecision(annotation.anchor?.precision);
    return precisionRank(current) < precisionRank(weakest) ? current : weakest;
  }, 'SPAN');
}

function cryptoRandomToken() {
  return randomUUID();
}

function startDerivativeLeaseHeartbeat(input: { db: any; derivativeId: string; claimToken: string; leaseMs: number }) {
  let lost = false;
  let stopped = false;
  let active = false;
  const intervalMs = Math.max(100, Math.floor(input.leaseMs / 3));
  const timer = setInterval(() => {
    if (stopped || active) return;
    active = true;
    const now = new Date();
    void input.db.teacherAssignmentReviewedDerivative.updateMany({
      where: { id: input.derivativeId, state: 'GENERATING', claimToken: input.claimToken, leaseExpiresAt: { gt: now } },
      data: { leaseExpiresAt: new Date(now.getTime() + input.leaseMs), updatedAt: now },
    }).then((result: any) => {
      if (result?.count !== 1) lost = true;
    }).catch(() => { lost = true; }).finally(() => { active = false; });
  }, intervalMs);
  timer.unref?.();
  return {
    isLost: () => lost,
    stop() {
      stopped = true;
      clearInterval(timer);
    },
  };
}

function copyAnnotation(value: any) {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown> & { anchor: Record<string, unknown> };
}

function checksum(value: unknown) {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
}

function requiredChecksum(value: unknown, code: string) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{6,}$/i.test(value)) throw new ReviewedDerivativeError(code);
  return value;
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002');
}
