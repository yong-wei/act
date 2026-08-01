import type { RuntimeResourceProjectionArtifactRow } from './runtime-resource-projections';
import type { RuntimeResourceProjectionReviewStatus } from './resource-node-registry';
import type { TextbookStructureUnitProjection } from './structured-textbook-runtime';

export const TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION = 'textbook-media-grounding.v1';

export type TextbookGroundingReviewState = 'human-confirmed' | 'generated-provisional' | 'blocked';

export interface TextbookUnitGroundingCandidate {
  artifactVersion: typeof TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION;
  sourcePackageId: string;
  candidateId: string;
  unitId: string;
  kind: string;
  title: string;
  bookId: string;
  chapterId: string | null;
  pageAnchor: string | null;
  sourceHash: string | null;
  sourceWindow: {
    bookId: string;
    chapterId: string | null;
    unitId: string;
  };
  graphNodeRefs: {
    knowledge: string[];
    capability: string[];
    quality: string[];
  };
  citationPolicy: 'server-owned-address-required';
  authority: 'verified' | 'contextual';
  privacyScope: 'student-visible';
  reviewState: TextbookGroundingReviewState;
  reviewBatchId: string;
  limitationReason: TextbookMediaGroundingLimitationReason | null;
  pathEligible: false;
}

export interface TextbookUnitCitationTargetArtifact {
  artifactVersion: typeof TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION;
  sourcePackageId: string;
  citationTargetId: string;
  retrievalChunkId: string;
  candidateId: string;
  unitId: string;
  address: NonNullable<TextbookStructureUnitProjection['citationAddress']>;
  contentHash: string | null;
  targetFileHash: string;
  sourceVersionRefs: TextbookStructureUnitProjection['resourceProjection']['versionRefs'];
  pathEligibility: {
    eligible: false;
    reason: 'resource-node-planning-audit-required';
  };
}

export type TextbookMediaGroundingLimitationReason =
  | 'missing-page-anchor'
  | 'missing-source-hash'
  | 'missing-graph-binding'
  | 'missing-citation-address'
  | 'unsafe-citation-address'
  | 'missing-upstream-media-projection-review'
  | 'missing-media-citation-target'
  | 'provisional-review-state'
  | 'path-promotion-blocked';

export interface TextbookMediaGroundingLimitation {
  id: string;
  sourceKind: 'textbook-unit' | 'media-projection';
  reason: TextbookMediaGroundingLimitationReason;
  sourcePackageId: string;
  reviewBatchId: string | null;
  sourceVersionRef: string | null;
  sourceHash: string | null;
  toolName: string | null;
  toolVersion: string | null;
  inputScope: string | null;
  outputHash: string | null;
  retentionRule: string | null;
  generatedByPrivateParser: false;
}

export interface TextbookMediaGroundingLimitationsArtifact {
  artifactVersion: typeof TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION;
  generatedAt: string;
  sourcePackageId: string;
  denominator: {
    textbookUnits: number;
    mediaProjectionRows: number;
    reviewedTextbookCandidates: number;
    reviewedMediaProjections: number;
  };
  sourceWindow: {
    textbookBookIds: string[];
    mediaFamilies: string[];
  };
  reviewStatus: {
    textbookHumanConfirmed: number;
    textbookProvisional: number;
    mediaHumanConfirmed: number;
    mediaProvisional: number;
    mediaBlocked: number;
    mediaStale: number;
  };
  mediaReviewStatusCounts: Partial<Record<RuntimeResourceProjectionReviewStatus, number>>;
  limitationCounts: Record<TextbookMediaGroundingLimitationReason, number>;
  limitationReasons: TextbookMediaGroundingLimitationReason[];
  limitations: TextbookMediaGroundingLimitation[];
}

export interface TextbookMediaGroundingArtifacts {
  candidates: TextbookUnitGroundingCandidate[];
  citationTargets: TextbookUnitCitationTargetArtifact[];
  limitations: TextbookMediaGroundingLimitationsArtifact;
}

export function buildTextbookMediaGroundingArtifacts(input: {
  sourcePackageId: string;
  textbookUnits: readonly TextbookStructureUnitProjection[];
  mediaProjections: readonly RuntimeResourceProjectionArtifactRow[];
  generatedAt?: string;
  reviewBatchId: string;
  targetFileHashForHref: (href: string) => string | null;
  maxLimitationRows?: number;
}): TextbookMediaGroundingArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const candidates = input.textbookUnits
    .map((unit) => buildTextbookCandidate(input.sourcePackageId, input.reviewBatchId, unit))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const candidateByUnitId = new Map(candidates.map((candidate) => [candidate.unitId, candidate]));
  const citationTargets = input.textbookUnits
    .flatMap((unit) => {
      const candidate = candidateByUnitId.get(unit.id);
      return candidate ? buildTextbookCitationTarget(
        input.sourcePackageId,
        unit,
        candidate,
        input.targetFileHashForHref,
      ) : [];
    })
    .sort((left, right) => left.citationTargetId.localeCompare(right.citationTargetId));
  const mediaReviewStatusCounts = countMediaReviewStatuses(input.mediaProjections);
  const allLimitations = [
    ...candidates.flatMap((candidate) => candidate.limitationReason
      ? [buildTextbookLimitation(input.sourcePackageId, input.reviewBatchId, candidate)]
      : []
    ),
    ...input.mediaProjections.flatMap((row) => buildMediaLimitations(input.sourcePackageId, row)),
  ].sort((left, right) => `${left.sourceKind}:${left.id}:${left.reason}`.localeCompare(`${right.sourceKind}:${right.id}:${right.reason}`));
  const maxLimitationRows = input.maxLimitationRows ?? allLimitations.length;
  const limitations = allLimitations.slice(0, maxLimitationRows);

  return {
    candidates,
    citationTargets,
    limitations: {
      artifactVersion: TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION,
      generatedAt,
      sourcePackageId: input.sourcePackageId,
      denominator: {
        textbookUnits: input.textbookUnits.length,
        mediaProjectionRows: input.mediaProjections.length,
        reviewedTextbookCandidates: candidates.filter((candidate) => candidate.reviewState === 'human-confirmed').length,
        reviewedMediaProjections: input.mediaProjections.filter(hasCurrentHumanMediaProjectionReview).length,
      },
      sourceWindow: {
        textbookBookIds: uniqueSorted(input.textbookUnits.map((unit) => unit.metadata.bookId)),
        mediaFamilies: uniqueSorted(input.mediaProjections.map((row) => row.family)),
      },
      reviewStatus: {
        textbookHumanConfirmed: candidates.filter((candidate) => candidate.reviewState === 'human-confirmed').length,
        textbookProvisional: candidates.filter((candidate) => candidate.reviewState === 'generated-provisional').length,
        mediaHumanConfirmed: input.mediaProjections.filter(hasCurrentHumanMediaProjectionReview).length,
        mediaProvisional: input.mediaProjections.filter((row) => isMediaReviewProvisional(row.reviewAudit.status)).length,
        mediaBlocked: input.mediaProjections.filter((row) => row.reviewAudit.status === 'blocked').length,
        mediaStale: input.mediaProjections.filter((row) => row.reviewAudit.status === 'stale' || isStaleMediaProjectionReview(row)).length,
      },
      mediaReviewStatusCounts,
      limitationCounts: countLimitations(allLimitations),
      limitationReasons: uniqueSorted(allLimitations.map((limitation) => limitation.reason)),
      limitations,
    },
  };
}

function buildTextbookCandidate(
  sourcePackageId: string,
  reviewBatchId: string,
  unit: TextbookStructureUnitProjection,
): TextbookUnitGroundingCandidate {
  const pageAnchor = unit.citationAddress?.locator ?? anchorFromHref(unit.href);
  const sourceHash = unit.contentHash ?? unit.resourceProjection.contentHash ?? unit.citationAddress?.contentHash ?? null;
  const hasGraphBinding = unit.resourceProjection.knowledgeNodeRefs.length > 0 ||
    unit.resourceProjection.capabilityTargetRefs.length > 0;
  const limitationReason = firstLimitation([
    [!pageAnchor, 'missing-page-anchor'],
    [!sourceHash, 'missing-source-hash'],
    [!hasGraphBinding, 'missing-graph-binding'],
    [!unit.citationAddress, 'missing-citation-address'],
    [Boolean(unit.citationAddress && !isSafeServerOwnedAddress(unit.citationAddress.href)), 'unsafe-citation-address'],
  ]);
  const reviewState: TextbookGroundingReviewState = limitationReason ? 'generated-provisional' : 'human-confirmed';

  return {
    artifactVersion: TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION,
    sourcePackageId,
    candidateId: `textbook-unit:${unit.metadata.bookId}:${unit.metadata.unitId}:${unit.id}`,
    unitId: unit.metadata.unitId,
    kind: unit.kind,
    title: unit.title,
    bookId: unit.metadata.bookId,
    chapterId: unit.metadata.chapterId ?? null,
    pageAnchor,
    sourceHash,
    sourceWindow: {
      bookId: unit.metadata.bookId,
      chapterId: unit.metadata.chapterId ?? null,
      unitId: unit.metadata.unitId,
    },
    graphNodeRefs: {
      knowledge: uniqueSorted(unit.resourceProjection.knowledgeNodeRefs),
      capability: uniqueSorted(unit.resourceProjection.capabilityTargetRefs),
      quality: [],
    },
    citationPolicy: 'server-owned-address-required',
    authority: reviewState === 'human-confirmed' ? 'verified' : 'contextual',
    privacyScope: 'student-visible',
    reviewState,
    reviewBatchId,
    limitationReason,
    pathEligible: false,
  };
}

function buildTextbookCitationTarget(
  sourcePackageId: string,
  unit: TextbookStructureUnitProjection,
  candidate: TextbookUnitGroundingCandidate,
  targetFileHashForHref: (href: string) => string | null,
): TextbookUnitCitationTargetArtifact[] {
  if (candidate.reviewState !== 'human-confirmed' || candidate.limitationReason || !candidate.sourceHash) return [];
  const href = unit.citationAddress?.href;
  if (!unit.citationAddress || !href || !isSafeServerOwnedAddress(href)) return [];
  const targetFileHash = targetFileHashForHref(href);
  if (!targetFileHash) return [];
  return [{
    artifactVersion: TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION,
    sourcePackageId,
    citationTargetId: `citation-target:${unit.resourceProjection.citationTargetRef ?? unit.id}`,
    retrievalChunkId: `retrieval-chunk:${unit.id}`,
    candidateId: candidate.candidateId,
    unitId: unit.id,
    address: unit.citationAddress,
    contentHash: candidate.sourceHash,
    targetFileHash,
    sourceVersionRefs: unit.resourceProjection.versionRefs,
    pathEligibility: {
      eligible: false,
      reason: 'resource-node-planning-audit-required',
    },
  }];
}

function buildTextbookLimitation(
  sourcePackageId: string,
  reviewBatchId: string,
  candidate: TextbookUnitGroundingCandidate,
): TextbookMediaGroundingLimitation {
  return {
    id: candidate.unitId,
    sourceKind: 'textbook-unit',
    reason: candidate.limitationReason ?? 'provisional-review-state',
    sourcePackageId,
    reviewBatchId,
    sourceVersionRef: null,
    sourceHash: candidate.sourceHash,
    toolName: null,
    toolVersion: null,
    inputScope: candidate.sourceWindow.unitId,
    outputHash: candidate.sourceHash,
    retentionRule: null,
    generatedByPrivateParser: false,
  };
}

function buildMediaLimitations(
  sourcePackageId: string,
  row: RuntimeResourceProjectionArtifactRow,
): TextbookMediaGroundingLimitation[] {
  const hasUnsafeCitationTarget = row.citationTargets.some((target) => !isSafeServerOwnedAddress(target));
  const hasCurrentHumanReview = hasCurrentHumanMediaProjectionReview(row);
  const reasons = uniqueSorted([
    !hasCurrentHumanReview ? 'missing-upstream-media-projection-review' : null,
    row.citationTargets.length === 0 ? 'missing-media-citation-target' : null,
    hasUnsafeCitationTarget ? 'unsafe-citation-address' : null,
    !hasCurrentHumanReview ? 'provisional-review-state' : null,
    row.pathEligibility.blockedBy.length > 0 ? 'path-promotion-blocked' : null,
  ].filter((reason): reason is TextbookMediaGroundingLimitationReason => Boolean(reason)));

  return reasons.map((reason) => ({
    id: row.id,
    sourceKind: 'media-projection',
    reason,
    sourcePackageId,
    reviewBatchId: row.reviewAudit.reviewBatchId,
    sourceVersionRef: row.sourceVersionRef,
    sourceHash: row.sourceHash,
    toolName: row.reviewAudit.generationToolOrModel,
    toolVersion: row.reviewAudit.reviewedVersionRef,
    inputScope: row.sourceRecord,
    outputHash: row.reviewAudit.promptOrManifestHash ?? row.sourceHash,
    retentionRule: row.reviewAudit.staleInvalidationRule,
    generatedByPrivateParser: false,
  }));
}

function hasCurrentHumanMediaProjectionReview(row: RuntimeResourceProjectionArtifactRow): boolean {
  return row.reviewAudit.status === 'human-confirmed' && !isStaleMediaProjectionReview(row);
}

function isStaleMediaProjectionReview(row: RuntimeResourceProjectionArtifactRow): boolean {
  return row.reviewAudit.status === 'human-confirmed' &&
    (row.reviewAudit.reviewedSourceHash !== row.sourceHash ||
      row.reviewAudit.reviewedVersionRef !== row.sourceVersionRef);
}

function firstLimitation(
  checks: Array<[boolean, TextbookMediaGroundingLimitationReason]>,
): TextbookMediaGroundingLimitationReason | null {
  return checks.find(([failed]) => failed)?.[1] ?? null;
}

function anchorFromHref(href: string | null): string | null {
  if (!href) return null;
  const hashIndex = href.indexOf('#');
  return hashIndex >= 0 && hashIndex < href.length - 1 ? href.slice(hashIndex + 1) : null;
}

function isSafeServerOwnedAddress(href: string | null | undefined): boolean {
  if (typeof href !== 'string' || !href.startsWith('/') || href.startsWith('//') || href.includes('..')) {
    return false;
  }
  return href === '/knowledge' ||
    href.startsWith('/knowledge?') ||
    href.startsWith('/course-runtime/lessons/') ||
    href.startsWith('/course-runtime/knowledge/') ||
    href.startsWith('/textbooks/') ||
    href.startsWith('/interactive-learning/') ||
    href.startsWith('/learning-paths/');
}

function isMediaReviewProvisional(status: RuntimeResourceProjectionReviewStatus): boolean {
  return status !== 'human-confirmed';
}

function uniqueSorted<T extends string>(items: readonly T[]): T[] {
  return Array.from(new Set(items.filter((item): item is T => Boolean(item)))).sort((left, right) => left.localeCompare(right));
}

function countLimitations(
  limitations: readonly TextbookMediaGroundingLimitation[],
): Record<TextbookMediaGroundingLimitationReason, number> {
  const counts = Object.fromEntries(
    uniqueSorted(limitations.map((limitation) => limitation.reason)).map((reason) => [
      reason,
      limitations.filter((limitation) => limitation.reason === reason).length,
    ]),
  ) as Partial<Record<TextbookMediaGroundingLimitationReason, number>>;
  return counts as Record<TextbookMediaGroundingLimitationReason, number>;
}

function countMediaReviewStatuses(
  rows: readonly RuntimeResourceProjectionArtifactRow[],
): Partial<Record<RuntimeResourceProjectionReviewStatus, number>> {
  const counts: Partial<Record<RuntimeResourceProjectionReviewStatus, number>> = {};
  for (const row of rows) {
    counts[row.reviewAudit.status] = (counts[row.reviewAudit.status] ?? 0) + 1;
  }
  return counts;
}
