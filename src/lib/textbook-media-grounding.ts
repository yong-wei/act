import type { RuntimeResourceProjectionArtifactRow } from './runtime-resource-projections';
import type { RuntimeResourceProjectionReviewStatus } from './resource-node-registry';
import type { TextbookRuntimeSearchDocument } from './textbook-runtime-resources';

export const TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION = 'textbook-media-grounding.v1';

export type TextbookGroundingReviewState = 'human-confirmed' | 'generated-provisional' | 'blocked';

export interface TextbookSectionGroundingCandidate {
  artifactVersion: typeof TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION;
  sourcePackageId: string;
  candidateId: string;
  documentId: string;
  kind: string;
  title: string;
  bookId: string;
  chapterId: string | null;
  chapterNumber: number | null;
  sectionId: string;
  pageAnchor: string | null;
  sourceHash: string | null;
  sourceWindow: {
    bookId: string;
    chapterId: string | null;
    sectionId: string;
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

export interface TextbookSectionCitationTargetArtifact {
  artifactVersion: typeof TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION;
  sourcePackageId: string;
  citationTargetId: string;
  retrievalChunkId: string;
  candidateId: string;
  documentId: string;
  address: NonNullable<TextbookRuntimeSearchDocument['citationAddress']>;
  contentHash: string | null;
  targetFileHash: string;
  sourceVersionRefs: TextbookRuntimeSearchDocument['resourceProjection']['versionRefs'];
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
  sourceKind: 'textbook-section' | 'media-projection';
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
    textbookDocuments: number;
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
  candidates: TextbookSectionGroundingCandidate[];
  citationTargets: TextbookSectionCitationTargetArtifact[];
  limitations: TextbookMediaGroundingLimitationsArtifact;
}

export function buildTextbookMediaGroundingArtifacts(input: {
  sourcePackageId: string;
  textbookDocuments: readonly TextbookRuntimeSearchDocument[];
  mediaProjections: readonly RuntimeResourceProjectionArtifactRow[];
  generatedAt?: string;
  reviewBatchId: string;
  targetFileHashForHref: (href: string) => string | null;
  maxLimitationRows?: number;
}): TextbookMediaGroundingArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const candidates = input.textbookDocuments
    .map((document) => buildTextbookCandidate(input.sourcePackageId, input.reviewBatchId, document))
    .sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  const candidateByDocumentId = new Map(candidates.map((candidate) => [candidate.documentId, candidate]));
  const citationTargets = input.textbookDocuments
    .flatMap((document) => {
      const candidate = candidateByDocumentId.get(document.id);
      return candidate ? buildTextbookCitationTarget(
        input.sourcePackageId,
        document,
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
        textbookDocuments: input.textbookDocuments.length,
        mediaProjectionRows: input.mediaProjections.length,
        reviewedTextbookCandidates: candidates.filter((candidate) => candidate.reviewState === 'human-confirmed').length,
        reviewedMediaProjections: input.mediaProjections.filter(hasCurrentHumanMediaProjectionReview).length,
      },
      sourceWindow: {
        textbookBookIds: uniqueSorted(input.textbookDocuments.map((document) => document.metadata.bookId)),
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
  document: TextbookRuntimeSearchDocument,
): TextbookSectionGroundingCandidate {
  const pageAnchor = document.citationAddress?.locator ?? anchorFromHref(document.href);
  const sourceHash = document.contentHash ?? document.resourceProjection.contentHash ?? document.citationAddress?.contentHash ?? null;
  const hasGraphBinding = document.resourceProjection.knowledgeNodeRefs.length > 0 ||
    document.resourceProjection.capabilityTargetRefs.length > 0;
  const limitationReason = firstLimitation([
    [!pageAnchor, 'missing-page-anchor'],
    [!sourceHash, 'missing-source-hash'],
    [!hasGraphBinding, 'missing-graph-binding'],
    [!document.citationAddress, 'missing-citation-address'],
    [Boolean(document.citationAddress && !isSafeServerOwnedAddress(document.citationAddress.href)), 'unsafe-citation-address'],
  ]);
  const reviewState: TextbookGroundingReviewState = limitationReason ? 'generated-provisional' : 'human-confirmed';

  return {
    artifactVersion: TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION,
    sourcePackageId,
    candidateId: `textbook-section:${document.metadata.bookId}:${document.metadata.sectionId}:${document.id}`,
    documentId: document.id,
    kind: document.kind,
    title: document.title,
    bookId: document.metadata.bookId,
    chapterId: document.metadata.chapterId ?? null,
    chapterNumber: document.metadata.chapterNumber ?? null,
    sectionId: document.metadata.sectionId,
    pageAnchor,
    sourceHash,
    sourceWindow: {
      bookId: document.metadata.bookId,
      chapterId: document.metadata.chapterId ?? null,
      sectionId: document.metadata.sectionId,
    },
    graphNodeRefs: {
      knowledge: uniqueSorted(document.resourceProjection.knowledgeNodeRefs),
      capability: uniqueSorted(document.resourceProjection.capabilityTargetRefs),
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
  document: TextbookRuntimeSearchDocument,
  candidate: TextbookSectionGroundingCandidate,
  targetFileHashForHref: (href: string) => string | null,
): TextbookSectionCitationTargetArtifact[] {
  if (candidate.reviewState !== 'human-confirmed' || candidate.limitationReason || !candidate.sourceHash) return [];
  const href = document.citationAddress?.href;
  if (!document.citationAddress || !href || !isSafeServerOwnedAddress(href)) return [];
  const targetFileHash = targetFileHashForHref(href);
  if (!targetFileHash) return [];
  return [{
    artifactVersion: TEXTBOOK_MEDIA_GROUNDING_ARTIFACT_VERSION,
    sourcePackageId,
    citationTargetId: `citation-target:${document.resourceProjection.citationTargetRef ?? document.id}`,
    retrievalChunkId: `retrieval-chunk:${document.id}`,
    candidateId: candidate.candidateId,
    documentId: document.id,
    address: document.citationAddress,
    contentHash: candidate.sourceHash,
    targetFileHash,
    sourceVersionRefs: document.resourceProjection.versionRefs,
    pathEligibility: {
      eligible: false,
      reason: 'resource-node-planning-audit-required',
    },
  }];
}

function buildTextbookLimitation(
  sourcePackageId: string,
  reviewBatchId: string,
  candidate: TextbookSectionGroundingCandidate,
): TextbookMediaGroundingLimitation {
  return {
    id: candidate.documentId,
    sourceKind: 'textbook-section',
    reason: candidate.limitationReason ?? 'provisional-review-state',
    sourcePackageId,
    reviewBatchId,
    sourceVersionRef: null,
    sourceHash: candidate.sourceHash,
    toolName: null,
    toolVersion: null,
    inputScope: candidate.sourceWindow.sectionId,
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
    href.startsWith('/course-runtime/resources/textbooks/') ||
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
