import { createHash } from 'node:crypto';
import { existsSync, promises as fs, readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  loadLongformValidationFacts,
  validateLongformReviewSource,
  type ReviewSourceRow,
} from './generate-longform-textbook-reference-resource-semantics';

type CitationState = 'ready' | 'limited';
type CitationChipLimitationReason =
  | 'missing-chunk'
  | 'inaccessible-source'
  | 'unsupported-source-type'
  | 'privacy-violation'
  | 'source-type-mismatch'
  | 'quote-hash-mismatch'
  | 'span-ref-mismatch'
  | 'insufficient-authority'
  | 'missing-learner-evidence'
  | 'conflicting-source'
  | 'privacy-redacted'
  | 'low-confidence-source'
  | 'stale-source'
  | 'expired-source'
  | 'unresolved-address'
  | 'unsafe-address'
  | 'address-kind-mismatch'
  | 'missing-version-ref'
  | 'semantic-relevance-unconfirmed';

interface GroundingCandidate {
  artifactVersion: string;
  candidateId: string;
  sourcePackageId: string;
  documentId: string;
  kind: 'chunk' | 'figure' | string;
  title: string;
  bookId: string;
  chapterId: string;
  chapterNumber: number;
  sectionId: string;
  pageAnchor: string;
  sourceHash: string;
  sourceWindow: Record<string, string>;
  graphNodeRefs: GraphNodeRefs;
  citationPolicy: string;
  authority: string;
  privacyScope: string;
  reviewState: string;
  reviewBatchId: string;
  pathEligible: boolean;
}

interface CitationTarget {
  citationTargetId: string;
  retrievalChunkId: string;
  candidateId: string;
  documentId: string;
  address: {
    kind: 'text' | 'image' | string;
    sourceRefId: string;
    href: string;
    locator: string;
    contentHash: string;
  };
  contentHash: string;
  sourceVersionRefs: Record<string, string>;
  pathEligibility: { eligible: boolean; reason: string };
}

interface SectionReviewItem {
  resourceId: string;
  sectionId: string;
  disposition: string;
  pathRole: string;
  citationAddress: { href: string; sourceHash: string };
}

interface ReferenceReviewItem {
  resourceId: string;
  sectionId: string;
  chunkId: string | null;
  disposition: string;
  pathRole: string;
  citationAddress: { href: string | null; sourceHash: string | null };
}

interface LongformReviewSourceItem extends Pick<ReviewSourceRow,
  | 'resourceId'
  | 'sourceFamily'
  | 'reviewStatus'
  | 'reviewBatchId'
  | 'reviewerId'
  | 'reviewerRole'
  | 'reviewedAt'
  | 'sourceHash'
  | 'sourceVersionRef'
  | 'citationAddress'
  | 'acceptedGraphNodeRefs'
  | 'independentEvidenceRef'
  | 'reviewSourceSha256'
  | 'reviewRowHash'
> {
}

interface MediaReviewItem {
  resourceId: string;
  family: string;
  lessonKey: string;
  resourceKind: string;
  disposition: string;
  citationAnchorState: string;
  renderTarget: string | null;
  sourceHash: string | null;
  repairedSourceHash?: string | null;
  sourceAvailability: string;
  graphNodeRefs: GraphNodeRefs;
  privacyScope: string;
  sourceVersionRef: string;
  limitationState: string[];
  reviewBatchId: string;
  reviewerId: string;
  reviewedAt: string;
  reviewerVisibleRationale: string;
}

export interface MediaAcceptedRefReviewRow {
  artifactVersion: 'rag-media-accepted-ref-review-source.v1';
  resourceId: string;
  reviewStatus: 'agent-reviewed';
  acceptedGraphNodeRefs: GraphNodeRefs;
  citation: { kind: string; href: string; locator: string };
  sourceHash: string;
  sourceVersionRef: string;
  reviewerId: string;
  reviewerRole: 'implementing-agent';
  reviewedAt: string;
  provenance: { reviewBatchId: string; independentEvidenceRef: string };
  rationale: string;
  rowDigest: string;
}

export interface MediaAcceptedRefReviewSeal {
  artifactVersion: 'rag-media-accepted-ref-review-source.seal.v1';
  rowCount: number;
  aggregateDigest: string;
}

interface GraphNodeRefs {
  knowledge: string[];
  capability: string[];
  quality: string[];
}

interface CorpusItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  reviewBatchId: typeof REVIEW_BATCH_ID;
  sourceClass: 'textbook-grounding' | 'runtime-media';
  sourceId: string;
  sourceKind: string;
  title: string;
  resourceSegmentRef: string;
  resourceSegmentId: string;
  sourceHash: string | null;
  sourceSemanticHash: string | null;
  citationTargetFileHash: string | null;
  citationPayloadHash: string | null;
  sourceWindow: Record<string, unknown> | null;
  freshness: {
    bucket: 'current' | 'stale';
    checkedAt: typeof GENERATED_AT;
    limitationState: string[];
  };
  reviewState: {
    state: string;
    reviewBatchId: string;
    reviewedAt: string | null;
    reviewerId: string | null;
    sourceAvailability: string | null;
  };
  citationState: CitationState;
  limitationState: string[];
  citationTargetId: string | null;
  retrievalChunkId: string | null;
  citationAddress: {
    kind: string;
    href: string | null;
    locator: string | null;
    contentHash: string | null;
    sourceRefId: string | null;
  };
  serverOwnedAddress: boolean;
  addressReady: boolean;
  semanticGroundingVerified: boolean;
  authority: string;
  privacyScope: string;
  graphNodeRefs: GraphNodeRefs;
  sourceVersionRef: string | Record<string, string>;
  reviewedSourceRef: string | null;
  citationChip: {
    chunkId: string;
    displayTitle: string;
    displayHref: string | null;
    sourceType: 'course-content' | 'runtime-handout';
    addressKind: 'text' | 'image' | 'audio' | 'video' | 'slides' | 'external';
    citationAddress: CorpusItem['citationAddress'];
    authorityLevel: 'verified' | 'contextual';
    confidence: 'high' | 'medium';
    freshnessBucket: CorpusItem['freshness']['bucket'];
    privacyVisibility: 'public' | 'redacted' | 'privileged';
    limitationState: CitationChipLimitationReason | null;
    sourceVersionRefs?: Record<string, string>;
  };
  pathEligible: false;
  promotedAsPathNode: false;
  rawContentIncluded: false;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const CANDIDATES_PATH = path.join(GOVERNANCE_DIR, 'textbook-section-grounding-candidates.jsonl');
const CITATION_TARGETS_PATH = path.join(GOVERNANCE_DIR, 'textbook-section-citation-targets.jsonl');
const CORE_REVIEW_PATH = path.join(GOVERNANCE_DIR, 'core-textbook-section-path-role-review-items.jsonl');
const REFERENCE_REVIEW_PATH = path.join(GOVERNANCE_DIR, 'reference-section-path-role-review-items.jsonl');
const LONGFORM_REVIEW_SOURCE_PATH = path.join(GOVERNANCE_DIR, 'longform-textbook-reference-resource-semantics-review-source.jsonl');
const MEDIA_REVIEW_PATH = path.join(GOVERNANCE_DIR, 'runtime-media-handout-disposition-review-items.jsonl');
const MEDIA_ACCEPTED_REF_REVIEW_PATH = path.join(GOVERNANCE_DIR, 'rag-media-accepted-ref-review-source.jsonl');
const MEDIA_ACCEPTED_REF_REVIEW_SEAL_PATH = path.join(GOVERNANCE_DIR, 'rag-media-accepted-ref-review-source.seal.json');
const KNOWLEDGE_GRAPH_NODES_PATH = path.join(process.cwd(), 'course-content/runtime/knowledge/graph/nodes.json');
const CORPUS_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'rag-citation-anchor-corpus-items.jsonl');
const SUMMARY_PATH = path.join(GOVERNANCE_DIR, 'rag-citation-anchor-coverage-summary.json');
const EVIDENCE_PATH = path.join(GOVERNANCE_DIR, 'rag-citation-anchor-coverage-evidence.md');
const ARTIFACT_VERSION = 'rag-citation-anchor-coverage.v1' as const;
const REVIEW_BATCH_ID = 'rag-citation-anchor-coverage-2026-07-05' as const;
const GENERATED_AT = process.env.RAG_CITATION_ANCHOR_GENERATED_AT ?? '2026-07-17T00:00:00.000Z';
const VERIFIED_LONGFORM_REVIEW_ROWS = new WeakSet<object>();

async function main() {
  const candidates = await readJsonl<GroundingCandidate>(CANDIDATES_PATH);
  const targets = await readJsonl<CitationTarget>(CITATION_TARGETS_PATH);
  const coreReviews = await readJsonl<SectionReviewItem>(CORE_REVIEW_PATH);
    const referenceReviews = await readJsonl<ReferenceReviewItem>(REFERENCE_REVIEW_PATH);
    const mediaReviews = await readJsonl<MediaReviewItem>(MEDIA_REVIEW_PATH);
    const mediaAcceptedRefReviews = await readJsonl<MediaAcceptedRefReviewRow>(MEDIA_ACCEPTED_REF_REVIEW_PATH);
    const mediaAcceptedRefReviewSeal = JSON.parse(await fs.readFile(MEDIA_ACCEPTED_REF_REVIEW_SEAL_PATH, 'utf8')) as MediaAcceptedRefReviewSeal;
    const longformReviews = await readJsonl<ReviewSourceRow>(LONGFORM_REVIEW_SOURCE_PATH);
    await validateLongformReviewSource(longformReviews, await loadLongformValidationFacts());
    longformReviews.forEach((row) => VERIFIED_LONGFORM_REVIEW_ROWS.add(row));
    const verifiedMediaAcceptedRefs = validateMediaAcceptedRefReviewSource(
      mediaAcceptedRefReviews,
      mediaAcceptedRefReviewSeal,
      mediaReviews,
    );

    ensureTextbookRuntimeExports(targets);

    const targetByCandidate = new Map(targets.map((target) => [target.candidateId, target]));
  const coreSectionIds = new Set(coreReviews.map((item) => item.sectionId));
  const referenceChunkIds = new Set(referenceReviews.map((item) => item.chunkId).filter(Boolean) as string[]);
  const longformSearchReviews = new Map(longformReviews
    .filter((item) => item.sourceFamily === 'textbook-search-document')
    .map((item) => [item.resourceId, item]));
  const corpusItems = [
    ...candidates.map((candidate) => textbookCorpusItem(
      candidate,
      targetByCandidate.get(candidate.candidateId),
      coreSectionIds,
      referenceChunkIds,
      longformSearchReviews,
    )),
    ...mediaReviews.map((item) => mediaCorpusItem(item, verifiedMediaAcceptedRefs.get(item.resourceId))),
  ];
  const summary = buildSummary(candidates, targets, coreReviews, referenceReviews, mediaReviews, corpusItems, longformSearchReviews.size);

  await writeJsonl(CORPUS_ITEMS_PATH, corpusItems);
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(EVIDENCE_PATH, renderEvidence(summary, corpusItems), 'utf8');

  console.log(`RAG corpus items: ${corpusItems.length}`);
  console.log(`Textbook citation targets: ${targets.length}`);
  console.log(`Media reviewed rows: ${mediaReviews.length}`);
  console.log(`Address-ready citations: ${summary.totals.addressReady}`);
  console.log(`Semantically verified rows: ${summary.totals.semanticGroundingVerified}`);
}

export function textbookCorpusItem(
  candidate: GroundingCandidate,
  target: CitationTarget | undefined,
  coreSectionIds: Set<string>,
  referenceChunkIds: Set<string>,
  longformSearchReviews: ReadonlyMap<string, LongformReviewSourceItem> = new Map(),
): CorpusItem {
  const longformReview = longformSearchReviews.get(`textbook-search-document:${candidate.documentId}`);
  const reviewedSourceRef = longformReview
    ? `longform-agent-review:${longformReview.resourceId}`
    : coreSectionIds.has(candidate.sectionId)
    ? `core-textbook-section:${candidate.sectionId}`
    : referenceChunkIds.has(candidate.documentId)
      ? `reference-search-document:${candidate.documentId}`
      : null;
  const sourceHash = normalizeSha256(candidate.sourceHash);
  const citationPayloadHash = normalizeSha256(target?.contentHash);
  const targetAddressPayloadHash = normalizeSha256(target?.address.contentHash);
  const citationTargetFileHash = hashRuntimeTargetFile(target?.address.href);
  const hasServerOwnedTargetHref = Boolean(target?.address.href && isResolvableServerOwnedHref(target.address.href));
  const targetHashesMatch = Boolean(
    target &&
    sourceHash &&
    citationPayloadHash === sourceHash &&
    targetAddressPayloadHash === citationPayloadHash &&
    Boolean(citationTargetFileHash),
  );
  const targetAddressKindMatches = Boolean(target && target.address.kind === toCitationAddressKind(candidate.kind));
  const targetSpanMatches = Boolean(
    target &&
    target.documentId === candidate.documentId &&
    target.address.sourceRefId === candidate.pageAnchor &&
    target.address.locator === candidate.pageAnchor,
  );
  const ready = Boolean(
    target &&
    reviewedSourceRef &&
    hasServerOwnedTargetHref &&
    targetHashesMatch &&
    targetAddressKindMatches &&
    targetSpanMatches,
  );
  const longformReviewIntegrity = Boolean(
    longformReview &&
    VERIFIED_LONGFORM_REVIEW_ROWS.has(longformReview) &&
    longformReview.resourceId === `textbook-search-document:${candidate.documentId}` &&
    longformReview.sourceFamily === 'textbook-search-document' &&
    longformReview.reviewStatus === 'agent-reviewed' &&
    longformReview.reviewerRole === 'implementing-agent' &&
    Number.isFinite(Date.parse(longformReview.reviewedAt)) &&
    Date.parse(longformReview.reviewedAt) <= Date.parse(GENERATED_AT) &&
    longformReview.sourceHash &&
    longformReview.sourceVersionRef &&
    longformReview.reviewSourceSha256 &&
    longformReview.reviewRowHash &&
    target &&
    longformReview.citationAddress.href === target.address.href &&
    longformReview.citationAddress.locator === target.address.locator &&
    normalizeSha256(longformReview.sourceHash) === sourceHash &&
    normalizeSha256(longformReview.citationAddress.contentHash) === citationPayloadHash
  );
  const semanticGroundingVerified = Boolean(
    longformReviewIntegrity &&
    longformReview &&
    Object.values(longformReview.acceptedGraphNodeRefs).some((refs) => refs.length > 0) &&
    longformReview.independentEvidenceRef,
  );
  const limitationState = uniqueSorted([
    semanticGroundingVerified ? '' : 'semantic-relevance-unconfirmed',
    longformReview && !longformReviewIntegrity ? 'semantic-review-provenance-or-freshness-invalid' : '',
    ...(ready ? [] : [
    target ? '' : 'missing-citation-target',
    reviewedSourceRef ? '' : 'section-review-not-selected-for-current-path-batch',
    target && !hasServerOwnedTargetHref ? 'unsafe-citation-target-href' : '',
    target && !targetHashesMatch ? 'quote-hash-mismatch' : '',
    target && !targetAddressKindMatches ? 'address-kind-mismatch' : '',
    target && !targetSpanMatches ? 'span-ref-mismatch' : '',
    ]),
  ]);
  const citationAddress = {
    kind: ready ? target!.address.kind : toCitationAddressKind(candidate.kind),
    href: ready ? target!.address.href : null,
    locator: ready ? target!.address.locator : candidate.pageAnchor,
    contentHash: ready ? citationPayloadHash : sourceHash,
    sourceRefId: ready ? target!.address.sourceRefId : candidate.pageAnchor,
  };
  const displayTitle = textbookDisplayTitle(candidate);
  return {
    artifactVersion: ARTIFACT_VERSION,
    reviewBatchId: REVIEW_BATCH_ID,
    sourceClass: 'textbook-grounding',
    sourceId: candidate.candidateId,
    sourceKind: candidate.kind,
    title: displayTitle,
    resourceSegmentRef: `ResourceSegment:${candidate.sourcePackageId}:${candidate.sectionId}:${candidate.documentId}`,
    resourceSegmentId: candidate.documentId,
    sourceHash,
    sourceSemanticHash: sourceHash,
    citationTargetFileHash,
    citationPayloadHash,
    sourceWindow: {
      ...candidate.sourceWindow,
      pageAnchor: candidate.pageAnchor,
    },
    freshness: {
      bucket: targetHashesMatch ? 'current' : 'stale',
      checkedAt: GENERATED_AT,
      limitationState: targetHashesMatch ? [] : ['citation-target-freshness-unverified'],
    },
    reviewState: {
      state: longformReview?.reviewStatus ?? candidate.reviewState,
      reviewBatchId: longformReview?.reviewBatchId ?? candidate.reviewBatchId,
      reviewedAt: longformReview?.reviewedAt ?? null,
      reviewerId: longformReview?.reviewerId ?? null,
      sourceAvailability: 'server-owned-runtime-address',
    },
    citationState: ready ? 'ready' : 'limited',
    limitationState,
    citationTargetId: ready ? target!.citationTargetId : target?.citationTargetId ?? null,
    retrievalChunkId: ready ? target!.retrievalChunkId : target?.retrievalChunkId ?? null,
    citationAddress,
    serverOwnedAddress: ready,
    addressReady: ready,
    semanticGroundingVerified,
    authority: semanticGroundingVerified ? candidate.authority : 'contextual-address-only',
    privacyScope: candidate.privacyScope,
    graphNodeRefs: semanticGroundingVerified
      ? longformReview!.acceptedGraphNodeRefs
      : { knowledge: [], capability: [], quality: [] },
    sourceVersionRef: target?.sourceVersionRefs ?? { groundingVersion: candidate.artifactVersion },
    reviewedSourceRef,
    citationChip: buildCitationChip({
      chunkId: ready ? target!.retrievalChunkId : `limited-citation:${candidate.candidateId}`,
      title: displayTitle,
      href: ready ? target!.address.href : null,
      sourceType: 'course-content',
      addressKind: toCitationAddressKind(citationAddress.kind),
      citationAddress,
      authorityLevel: semanticGroundingVerified ? 'verified' : 'contextual',
      confidence: semanticGroundingVerified ? 'high' : 'medium',
      freshnessBucket: targetHashesMatch ? 'current' : 'stale',
      privacyScope: candidate.privacyScope,
      limitationState,
      sourceVersionRefs: target?.sourceVersionRefs,
    }),
    pathEligible: false,
    promotedAsPathNode: false,
    rawContentIncluded: false,
  };
}

export function ensureTextbookRuntimeExports(targets: CitationTarget[]) {
  const missing = targets
    .filter((target) => target.address.href.startsWith('/course-runtime/resources/textbooks/'))
    .filter((target) => !isResolvableServerOwnedHref(target.address.href));
  if (missing.length === 0) return;
  const examples = missing.slice(0, 5).map((target) => target.address.href).join(', ');
  throw new Error(
    `Textbook runtime exports are missing for ${missing.length} citation target(s). ` +
    `Run npm run db:rag-citation-anchor-coverage or npm run db:export-textbook-resources before writing RAG citation coverage. ` +
    `Examples: ${examples}`,
  );
}

export function mediaCorpusItem(item: MediaReviewItem, acceptedReview?: MediaAcceptedRefReviewRow): CorpusItem {
  const href = isResolvableServerOwnedHref(item.renderTarget) ? item.renderTarget : null;
  const sourceHash = item.sourceHash ?? item.repairedSourceHash ?? null;
  const normalizedSourceHash = normalizeSha256(sourceHash);
  const citationTargetFileHash = href ? hashRuntimeTargetFile(href) : null;
  const targetHashMatches = Boolean(
    normalizedSourceHash && citationTargetFileHash === normalizedSourceHash,
  );
  const ready = item.citationAnchorState === 'figure-anchor-ready' && Boolean(href) && targetHashMatches;
  const acceptedRefs = acceptedReview?.acceptedGraphNodeRefs ?? { knowledge: [], capability: [], quality: [] };
  const acceptedRefProvenanceFresh = Boolean(acceptedReview);
  const semanticGroundingVerified = Boolean(
    Object.values(acceptedRefs).some((refs) => refs.length > 0) &&
    acceptedRefProvenanceFresh,
  );
  const limitationState = uniqueSorted([
    semanticGroundingVerified ? '' : 'semantic-relevance-unconfirmed',
    !acceptedRefProvenanceFresh ? 'accepted-ref-provenance-missing-or-stale' : '',
    ...(ready ? [] : [
      ...item.limitationState,
      limitationForAnchorState(item.citationAnchorState),
      href ? '' : 'server-owned-display-href-unavailable',
      sourceHash ? '' : 'source-hash-unavailable',
      href && normalizedSourceHash && !targetHashMatches ? 'quote-hash-mismatch' : '',
    ]),
  ]);
  const citationAddress = {
    kind: toCitationAddressKind(item.resourceKind),
    href: ready ? href : null,
    locator: item.resourceId,
    contentHash: normalizedSourceHash,
    sourceRefId: item.resourceId,
  };
  const freshnessBucket = targetHashMatches && item.sourceAvailability === 'local-source-present' ? 'current' : 'stale';
  return {
    artifactVersion: ARTIFACT_VERSION,
    reviewBatchId: REVIEW_BATCH_ID,
    sourceClass: 'runtime-media',
    sourceId: item.resourceId,
    sourceKind: item.resourceKind,
    title: item.resourceId,
    resourceSegmentRef: `ResourceSegment:${item.family}:${item.lessonKey}:${item.resourceId}`,
    resourceSegmentId: item.resourceId,
    sourceHash: normalizedSourceHash,
    sourceSemanticHash: acceptedReview ? normalizeSha256(acceptedReview.sourceHash) : null,
    citationTargetFileHash,
    citationPayloadHash: normalizedSourceHash,
    sourceWindow: {
      family: item.family,
      lessonKey: item.lessonKey,
      renderTarget: item.renderTarget,
    },
    freshness: {
      bucket: freshnessBucket,
      checkedAt: GENERATED_AT,
      limitationState: freshnessBucket === 'current' ? [] : ['source-hash-or-source-availability-incomplete'],
    },
    reviewState: {
      state: ready ? 'human-reviewed-anchor-ready' : 'human-reviewed-limited',
      reviewBatchId: item.reviewBatchId,
      reviewedAt: item.reviewedAt,
      reviewerId: item.reviewerId,
      sourceAvailability: item.sourceAvailability,
    },
    citationState: ready ? 'ready' : 'limited',
    limitationState,
    citationTargetId: ready ? `citation-target:${item.resourceId}` : null,
    retrievalChunkId: ready ? `retrieval-chunk:${item.resourceId}` : null,
    citationAddress,
    serverOwnedAddress: Boolean(citationAddress.href),
    addressReady: ready,
    semanticGroundingVerified,
    authority: semanticGroundingVerified
      ? item.disposition === 'embedded-asset' ? 'reviewed-embedded-asset' : 'reviewed-supporting-citation'
      : 'contextual-address-only',
    privacyScope: item.privacyScope,
    graphNodeRefs: semanticGroundingVerified
      ? acceptedRefs
      : { knowledge: [], capability: [], quality: [] },
    sourceVersionRef: item.sourceVersionRef,
    reviewedSourceRef: `runtime-media-handout-disposition:${item.resourceId}`,
    citationChip: buildCitationChip({
      chunkId: ready ? `retrieval-chunk:${item.resourceId}` : `limited-citation:${item.resourceId}`,
      title: item.resourceId,
      href: ready ? href : null,
      sourceType: 'runtime-handout',
      addressKind: toCitationAddressKind(item.resourceKind),
      citationAddress,
      authorityLevel: semanticGroundingVerified ? 'verified' : 'contextual',
      confidence: semanticGroundingVerified ? 'high' : 'medium',
      freshnessBucket,
      privacyScope: item.privacyScope,
      limitationState,
    }),
    pathEligible: false,
    promotedAsPathNode: false,
    rawContentIncluded: false,
  };
}

export function validateMediaAcceptedRefReviewSource(
  rows: MediaAcceptedRefReviewRow[],
  seal: MediaAcceptedRefReviewSeal,
  items: MediaReviewItem[],
): Map<string, MediaAcceptedRefReviewRow> {
  const verified = new Map<string, MediaAcceptedRefReviewRow>();
  const expectedAggregate = hashText(rows.map((row) => JSON.stringify(row)).join('\n') + '\n');
  if (
    seal.artifactVersion !== 'rag-media-accepted-ref-review-source.seal.v1' ||
    seal.rowCount !== rows.length ||
    seal.aggregateDigest !== expectedAggregate
  ) return verified;
  const itemById = new Map(items.map((item) => [item.resourceId, item]));
  const acceptedRefRegistry = loadAcceptedRefRegistry();
  for (const row of rows) {
    const item = itemById.get(row.resourceId);
    const reviewedAt = Date.parse(row.reviewedAt);
    const currentHash = item ? normalizeSha256(item.sourceHash ?? item.repairedSourceHash) : null;
    const actualFileHash = hashRuntimeTargetFile(row.citation.href);
    const rowDigestValid = row.rowDigest === hashJson(mediaAcceptedRefRowForDigest(row));
    const refsPresent = Object.values(row.acceptedGraphNodeRefs).some((refs) => refs.length > 0);
    const refsExistAndMatchType = mediaAcceptedRefsExistAndMatchType(row, acceptedRefRegistry);
    const independentEvidenceMatches = mediaAcceptedRefIndependentEvidenceMatches(row, item, acceptedRefRegistry);
    if (
      item && rowDigestValid && refsPresent && refsExistAndMatchType && independentEvidenceMatches &&
      row.artifactVersion === 'rag-media-accepted-ref-review-source.v1' &&
      row.reviewStatus === 'agent-reviewed' && row.reviewerRole === 'implementing-agent' &&
      Boolean(row.reviewerId) && row.rationale.trim().length >= 24 &&
      Boolean(row.provenance.reviewBatchId && row.provenance.independentEvidenceRef) &&
      row.citation.href === item.renderTarget && row.citation.locator === item.resourceId &&
      row.citation.kind === toCitationAddressKind(item.resourceKind) &&
      normalizeSha256(row.sourceHash) === currentHash && actualFileHash === currentHash &&
      row.sourceVersionRef === item.sourceVersionRef &&
      Number.isFinite(reviewedAt) && reviewedAt <= Date.parse(GENERATED_AT)
    ) verified.set(row.resourceId, row);
  }
  return verified;
}

interface AcceptedRefRegistry {
  knowledge: Map<string, string>;
  capability: Map<string, string>;
}

function loadAcceptedRefRegistry(): AcceptedRefRegistry {
  const nodes = JSON.parse(readFileSync(KNOWLEDGE_GRAPH_NODES_PATH, 'utf8')) as Array<{ id?: string; name?: string }>;
  const knowledge = new Map(nodes
    .filter((node): node is { id: string; name?: string } => Boolean(node.id))
    .map((node) => [node.id, node.name ?? node.id]));
  const capability = new Map<string, string>([
    ['controlModeling', '控制建模'],
    ['parameterDesign', '参数设计'],
    ['crossDomainTransfer', '跨域迁移'],
    ['engineeringDecision', '工程决策'],
    ['inquiryReflection', '探究反思'],
    ['selfDirectedLearning', '自主学习'],
  ]);
  return { knowledge, capability };
}

function mediaAcceptedRefsExistAndMatchType(
  row: MediaAcceptedRefReviewRow,
  registry: AcceptedRefRegistry,
) {
  return row.acceptedGraphNodeRefs.knowledge.every((ref) => registry.knowledge.has(ref) && !registry.capability.has(ref)) &&
    row.acceptedGraphNodeRefs.capability.every((ref) => registry.capability.has(ref) && !registry.knowledge.has(ref)) &&
    row.acceptedGraphNodeRefs.quality.length === 0;
}

function mediaAcceptedRefIndependentEvidenceMatches(
  row: MediaAcceptedRefReviewRow,
  item: MediaReviewItem | undefined,
  registry: AcceptedRefRegistry,
) {
  if (!item) return false;
  const evidencePath = row.provenance.independentEvidenceRef.split('#')[0];
  if (!evidencePath.startsWith('course-content/')) return false;
  const fullEvidencePath = path.join(process.cwd(), evidencePath);
  if (!existsSync(fullEvidencePath)) return false;
  const evidence = readFileSync(fullEvidencePath, 'utf8');
  const assetName = path.basename(row.citation.href);
  if (!assetName || !evidence.includes(assetName)) return false;
  return row.acceptedGraphNodeRefs.knowledge.every((ref) => row.rationale.includes(registry.knowledge.get(ref)!)) &&
    row.acceptedGraphNodeRefs.capability.every((ref) => row.rationale.includes(registry.capability.get(ref)!));
}

export function buildSummary(
  candidates: GroundingCandidate[],
  targets: CitationTarget[],
  coreReviews: SectionReviewItem[],
  referenceReviews: ReferenceReviewItem[],
  mediaReviews: MediaReviewItem[],
  corpusItems: CorpusItem[],
  longformReviewedRows = 0,
) {
  const targetCandidateIds = new Set(targets.map((target) => target.candidateId));
  const corpusByClass = countBy(corpusItems, (item) => item.sourceClass);
  const readyItems = corpusItems.filter((item) => item.citationState === 'ready');
  const limitedItems = corpusItems.filter((item) => item.citationState === 'limited');
  const addressReadyItems = corpusItems.filter((item) => item.addressReady);
  const semanticVerifiedItems = corpusItems.filter((item) => item.semanticGroundingVerified);
  const semanticUnverifiedItems = corpusItems.filter((item) => !item.semanticGroundingVerified);
  return {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: GENERATED_AT,
    reviewBatchId: REVIEW_BATCH_ID,
    totals: {
      candidates: candidates.length,
      citationTargets: targets.length,
      coreReviewedSections: coreReviews.length,
      referenceStructuralRows: referenceReviews.length,
      longformAgentReviewedRows: longformReviewedRows,
      mediaReviewedRows: mediaReviews.length,
      corpusItems: corpusItems.length,
      addressReady: addressReadyItems.length,
      addressLimited: corpusItems.length - addressReadyItems.length,
      semanticGroundingVerified: semanticVerifiedItems.length,
      semanticGroundingUnverified: corpusItems.length - semanticVerifiedItems.length,
    },
    coverage: {
      candidatesWithoutCitationTargets: candidates.filter((candidate) => !targetCandidateIds.has(candidate.candidateId)).length,
      citationTargetsWithoutCandidates: targets.filter((target) => !candidates.some((candidate) => candidate.candidateId === target.candidateId)).length,
      addressReadyTextbookRows: addressReadyItems.filter((item) => item.sourceClass === 'textbook-grounding').length,
      semanticVerifiedTextbookRows: semanticVerifiedItems.filter((item) => item.sourceClass === 'textbook-grounding').length,
      addressReadyMediaAnchors: addressReadyItems.filter((item) => item.sourceClass === 'runtime-media').length,
      semanticVerifiedMediaRows: semanticVerifiedItems.filter((item) => item.sourceClass === 'runtime-media').length,
      addressLimitedMediaAnchors: limitedItems.filter((item) => item.sourceClass === 'runtime-media').length,
      bySourceClass: corpusByClass,
      bySourceKind: countBy(corpusItems, (item) => item.sourceKind),
      byLimitation: countBy(limitedItems.flatMap((item) => item.limitationState), (item) => item),
    },
    limitations: {
      address: countBy(
        limitedItems.flatMap((item) => item.limitationState.filter((reason) => !isSemanticLimitation(reason))),
        (item) => item,
      ),
      semanticGrounding: countBy(
        semanticUnverifiedItems.flatMap((item) => item.limitationState.filter(isSemanticLimitation)),
        (item) => item,
      ),
    },
    guardrails: {
      serverOwnedAddressOnly: corpusItems.every((item) => !item.citationAddress.href || isResolvableServerOwnedHref(item.citationAddress.href)),
      noModelAuthoredUrls: corpusItems.every((item) => !String(item.citationAddress.href || '').includes('user-content-fn')),
      noPathPromotionFromChunksOrMedia: corpusItems.every((item) => item.pathEligible === false && item.promotedAsPathNode === false),
      rawContentIncluded: corpusItems.some((item) => item.rawContentIncluded === true),
      readyItemsHaveAddressAndHash: readyItems.every((item) => Boolean(item.citationAddress.href && item.citationAddress.contentHash)),
      readyItemsMatchSourceHash: readyItems.every((item) => (
        item.citationAddress.contentHash === item.citationPayloadHash &&
        Boolean(item.citationTargetFileHash) &&
        (item.sourceClass === 'runtime-media'
          ? item.citationTargetFileHash === item.citationPayloadHash && item.sourceHash === item.citationPayloadHash
          : item.sourceSemanticHash === item.citationPayloadHash)
      )),
      explicitHashRoles: corpusItems.every((item) => (
        'sourceSemanticHash' in item && 'citationTargetFileHash' in item && 'citationPayloadHash' in item
      )),
      addressAndSemanticGroundingOrthogonal: corpusItems.every((item) => (
        typeof item.addressReady === 'boolean' && typeof item.semanticGroundingVerified === 'boolean'
      )),
      unverifiedSemanticRowsDoNotRetainGraphRefs: corpusItems
        .filter((item) => !item.semanticGroundingVerified)
        .every((item) => Object.values(item.graphNodeRefs).every((refs) => refs.length === 0)),
      limitedItemsHaveReason: limitedItems.every((item) => item.limitationState.length > 0),
      metadataContractComplete: corpusItems.every((item) =>
        Boolean(item.resourceSegmentRef && item.resourceSegmentId && item.freshness.bucket && item.reviewState.state) &&
        (Boolean(item.sourceHash) || item.limitationState.includes('source-hash-unavailable'))
      ),
      citationChipPayloadsComplete: corpusItems.every((item) =>
        Boolean(item.citationChip.chunkId && item.citationChip.displayTitle && item.citationChip.sourceType && item.citationChip.authorityLevel)
      ),
    },
  };
}

function renderEvidence(summary: ReturnType<typeof buildSummary>, corpusItems: CorpusItem[]) {
  const sampledRows = corpusItems.slice(0, 20).map((item) => `| ${[
    item.sourceId,
    item.sourceClass,
    item.sourceKind,
    item.citationState,
    item.citationAddress.kind,
    item.citationAddress.href ?? '',
    item.limitationState.join(', '),
  ].join(' | ')} |`);
  return [
    '# RAG Citation Anchor Coverage Evidence',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Review batch: ${summary.reviewBatchId}`,
    '',
    `Textbook citation targets: ${summary.totals.citationTargets}`,
    `Runtime media reviewed rows: ${summary.totals.mediaReviewedRows}`,
    `Address-ready citations: ${summary.totals.addressReady}`,
    `Address-limited citations: ${summary.totals.addressLimited}`,
    `Semantic grounding verified: ${summary.totals.semanticGroundingVerified}`,
    `Semantic grounding unverified: ${summary.totals.semanticGroundingUnverified}`,
    '',
    '## Batch Before/After',
    '',
    '- Before: no tracked RAG citation-anchor coverage artifact existed for this batch.',
    `- After: ${summary.totals.corpusItems} governed corpus rows, ${summary.totals.addressReady} address-ready citation chips, ${summary.totals.semanticGroundingVerified} semantically verified rows.`,
    '',
    '## Coverage',
    '',
    `- Candidates without citation targets: ${summary.coverage.candidatesWithoutCitationTargets}`,
    `- Citation targets without candidates: ${summary.coverage.citationTargetsWithoutCandidates}`,
    `- Address-ready textbook rows: ${summary.coverage.addressReadyTextbookRows}`,
    `- Semantically verified textbook rows: ${summary.coverage.semanticVerifiedTextbookRows}`,
    `- Address-ready media anchors: ${summary.coverage.addressReadyMediaAnchors}`,
    `- Semantically verified media rows: ${summary.coverage.semanticVerifiedMediaRows}`,
    `- Address-limited media anchors: ${summary.coverage.addressLimitedMediaAnchors}`,
    `- Address limitation rows: ${summary.totals.addressLimited}`,
    `- Semantic-grounding limitation rows: ${summary.totals.semanticGroundingUnverified}`,
    `- Address limitation reasons: ${JSON.stringify(summary.limitations.address)}`,
    `- Semantic-grounding limitation reasons: ${JSON.stringify(summary.limitations.semanticGrounding)}`,
    '',
    '## Guardrails',
    '',
    `- Server-owned addresses only: ${summary.guardrails.serverOwnedAddressOnly}`,
    `- Model-authored URLs accepted: ${!summary.guardrails.noModelAuthoredUrls}`,
    `- Chunks or media promoted as PathNodes: ${!summary.guardrails.noPathPromotionFromChunksOrMedia}`,
    `- Raw content included in artifacts: ${summary.guardrails.rawContentIncluded}`,
    `- Ready citation hashes match source hashes: ${summary.guardrails.readyItemsMatchSourceHash}`,
    `- Source semantic, citation target file, and citation payload hashes are explicit: ${summary.guardrails.explicitHashRoles}`,
    `- Metadata contract complete: ${summary.guardrails.metadataContractComplete}`,
    `- CitationChip payloads complete: ${summary.guardrails.citationChipPayloadsComplete}`,
    '',
    '## Sampled Corpus Rows',
    '',
    '| Source | Class | Kind | State | Address kind | Href | Limitations |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...sampledRows,
    '',
  ].join('\n');
}

function limitationForAnchorState(state: string) {
  if (state === 'document-section-anchor-required') return 'document-section-anchor-required';
  if (state === 'transcript-required') return 'transcript-required';
  if (state === 'page-anchor-required') return 'page-anchor-required';
  if (state === 'data-appendix-anchor-required') return 'data-appendix-anchor-required';
  if (state === 'production-missing') return 'media-production-missing';
  return `citation-anchor-limited:${state || 'unknown'}`;
}

function isSemanticLimitation(reason: string) {
  return reason === 'semantic-relevance-unconfirmed' ||
    reason === 'semantic-review-provenance-or-freshness-invalid' ||
    reason === 'accepted-ref-provenance-missing-or-stale';
}

function isServerOwnedHref(value: string) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('..')) {
    return false;
  }
  return value === '/knowledge' ||
    value.startsWith('/knowledge?') ||
    value.startsWith('/course-runtime/lessons/') ||
    value.startsWith('/course-runtime/knowledge/') ||
    value.startsWith('/course-runtime/resources/textbooks/') ||
    value.startsWith('/interactive-learning/') ||
    value.startsWith('/learning-paths/');
}

function isResolvableServerOwnedHref(value: string | null | undefined) {
  if (typeof value !== 'string' || !isServerOwnedHref(value)) return false;
  if (!value.startsWith('/course-runtime/')) return true;
  const relativePath = runtimeRelativePath(value);
  if (!relativePath || isPrivateRuntimeGovernancePath(relativePath)) return false;
  const runtimeRoot = path.join(process.cwd(), 'course-content', 'runtime');
  const absolutePath = path.join(runtimeRoot, relativePath);
  const relativeToRuntime = path.relative(runtimeRoot, absolutePath);
  if (!relativeToRuntime || relativeToRuntime.startsWith('..') || path.isAbsolute(relativeToRuntime)) return false;
  if (isPrivateRuntimeGovernancePath(relativeToRuntime)) return false;
  return existsSync(absolutePath);
}

function runtimeRelativePath(href: string) {
  const withoutFragment = href.split('#')[0] ?? '';
  const withoutQuery = withoutFragment.split('?')[0] ?? '';
  const relative = withoutQuery.replace(/^\/course-runtime\/?/, '');
  try {
    return path.normalize(decodeURIComponent(relative)).replace(/^[\\/]+/, '');
  } catch {
    return '';
  }
}

function isPrivateRuntimeGovernancePath(relativePath: string) {
  const normalizedPath = relativePath.replace(/\\/g, '/').toLowerCase();
  return normalizedPath === 'resource-governance' || normalizedPath.startsWith('resource-governance/');
}

function toCitationAddressKind(value: string): CorpusItem['citationAddress']['kind'] {
  if (value === 'figure') return 'image';
  if (value === 'image' || value === 'audio' || value === 'video' || value === 'slides') return value;
  if (value === 'external') return 'external';
  return 'text';
}

function textbookDisplayTitle(candidate: GroundingCandidate) {
  const normalized = candidate.title.replace(/\s+/g, ' ').trim();
  const looksLikeRawDescription = /^>?\s*Image description\b/i.test(normalized);
  if (candidate.kind === 'figure' || looksLikeRawDescription || normalized.length > 120) {
    return `${candidate.kind === 'figure' ? 'Figure' : 'Section'} ${candidate.pageAnchor}`;
  }
  return normalized;
}

function privacyVisibilityFor(scope: string): CorpusItem['citationChip']['privacyVisibility'] {
  if (scope === 'student-visible' || scope === 'public') return 'public';
  if (scope === 'service-only' || scope === 'admin-only') return 'privileged';
  return 'redacted';
}

function buildCitationChip(input: {
  chunkId: string;
  title: string;
  href: string | null;
  sourceType: CorpusItem['citationChip']['sourceType'];
  addressKind: CorpusItem['citationChip']['addressKind'];
  citationAddress: CorpusItem['citationAddress'];
  authorityLevel: CorpusItem['citationChip']['authorityLevel'];
  confidence: CorpusItem['citationChip']['confidence'];
  freshnessBucket: CorpusItem['freshness']['bucket'];
  privacyScope: string;
  limitationState: string[];
  sourceVersionRefs?: Record<string, string>;
}): CorpusItem['citationChip'] {
  return {
    chunkId: input.chunkId,
    displayTitle: input.title,
    displayHref: input.href,
    sourceType: input.sourceType,
    addressKind: input.addressKind,
    citationAddress: input.citationAddress,
    authorityLevel: input.authorityLevel,
    confidence: input.confidence,
    freshnessBucket: input.freshnessBucket,
    privacyVisibility: privacyVisibilityFor(input.privacyScope),
    limitationState: citationChipLimitationReason(input.limitationState),
    sourceVersionRefs: input.sourceVersionRefs,
  };
}

function citationChipLimitationReason(limitationState: string[]): CitationChipLimitationReason | null {
  if (limitationState.length === 0) return null;
  if (limitationState.includes('missing-citation-target')) return 'missing-chunk';
  if (limitationState.includes('section-review-not-selected-for-current-path-batch')) return 'insufficient-authority';
  if (limitationState.includes('unsafe-citation-target-href')) return 'unsafe-address';
  if (limitationState.includes('quote-hash-mismatch')) return 'quote-hash-mismatch';
  if (limitationState.includes('address-kind-mismatch')) return 'address-kind-mismatch';
  if (limitationState.includes('span-ref-mismatch')) return 'span-ref-mismatch';
  if (limitationState.includes('semantic-relevance-unconfirmed')) return 'semantic-relevance-unconfirmed';
  if (limitationState.includes('media-production-missing')) return 'inaccessible-source';
  if (limitationState.some((item) =>
    item.includes('anchor-required') ||
    item.includes('transcript-required') ||
    item === 'server-owned-display-href-unavailable'
  )) {
    return 'unresolved-address';
  }
  if (limitationState.includes('source-hash-unavailable')) return 'stale-source';
  return 'unsupported-source-type';
}

function normalizeSha256(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith('sha256:') ? value : `sha256:${value}`;
}

function hashRuntimeTargetFile(href: string | null | undefined): string | null {
  if (!href || !isResolvableServerOwnedHref(href) || !href.startsWith('/course-runtime/')) return null;
  const relativePath = runtimeRelativePath(href);
  if (!relativePath) return null;
  return normalizeSha256(createHash('sha256').update(readFileSync(
    path.join(process.cwd(), 'course-content', 'runtime', relativePath),
  )).digest('hex'));
}

function mediaAcceptedRefRowForDigest(row: MediaAcceptedRefReviewRow) {
  const { rowDigest: _rowDigest, ...signedFields } = row;
  return signedFields;
}

function hashText(value: string): string {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function hashJson(value: unknown): string {
  return hashText(JSON.stringify(value));
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await fs.readFile(filePath, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function writeJsonl(filePath: string, rows: unknown[]) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function countBy<T>(values: T[], keyFor: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
