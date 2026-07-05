import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type CitationState = 'ready' | 'limited';

interface GroundingCandidate {
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
    limitationState: string | null;
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
const MEDIA_REVIEW_PATH = path.join(GOVERNANCE_DIR, 'runtime-media-handout-disposition-review-items.jsonl');
const CORPUS_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'rag-citation-anchor-corpus-items.jsonl');
const SUMMARY_PATH = path.join(GOVERNANCE_DIR, 'rag-citation-anchor-coverage-summary.json');
const EVIDENCE_PATH = path.join(GOVERNANCE_DIR, 'rag-citation-anchor-coverage-evidence.md');
const ARTIFACT_VERSION = 'rag-citation-anchor-coverage.v1' as const;
const REVIEW_BATCH_ID = 'rag-citation-anchor-coverage-2026-07-05' as const;
const GENERATED_AT = process.env.RAG_CITATION_ANCHOR_GENERATED_AT ?? '2026-07-05T12:00:00.000Z';

async function main() {
  const candidates = await readJsonl<GroundingCandidate>(CANDIDATES_PATH);
  const targets = await readJsonl<CitationTarget>(CITATION_TARGETS_PATH);
  const coreReviews = await readJsonl<SectionReviewItem>(CORE_REVIEW_PATH);
  const referenceReviews = await readJsonl<ReferenceReviewItem>(REFERENCE_REVIEW_PATH);
  const mediaReviews = await readJsonl<MediaReviewItem>(MEDIA_REVIEW_PATH);

  const targetByCandidate = new Map(targets.map((target) => [target.candidateId, target]));
  const coreSectionIds = new Set(coreReviews.map((item) => item.sectionId));
  const referenceChunkIds = new Set(referenceReviews.map((item) => item.chunkId).filter(Boolean) as string[]);
  const corpusItems = [
    ...candidates.map((candidate) => textbookCorpusItem(candidate, targetByCandidate.get(candidate.candidateId), coreSectionIds, referenceChunkIds)),
    ...mediaReviews.map(mediaCorpusItem),
  ];
  const summary = buildSummary(candidates, targets, coreReviews, referenceReviews, mediaReviews, corpusItems);

  await writeJsonl(CORPUS_ITEMS_PATH, corpusItems);
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(EVIDENCE_PATH, renderEvidence(summary, corpusItems), 'utf8');

  console.log(`RAG corpus items: ${corpusItems.length}`);
  console.log(`Textbook citation targets: ${targets.length}`);
  console.log(`Media reviewed rows: ${mediaReviews.length}`);
  console.log(`Ready citations: ${summary.totals.ready}`);
  console.log(`Limited citations: ${summary.totals.limited}`);
}

function textbookCorpusItem(
  candidate: GroundingCandidate,
  target: CitationTarget | undefined,
  coreSectionIds: Set<string>,
  referenceChunkIds: Set<string>,
): CorpusItem {
  if (!target) throw new Error(`Missing citation target for ${candidate.candidateId}`);
  const reviewedSourceRef = coreSectionIds.has(candidate.sectionId)
    ? `core-textbook-section:${candidate.sectionId}`
    : referenceChunkIds.has(candidate.documentId)
      ? `reference-search-document:${candidate.documentId}`
      : null;
  const limitationState = reviewedSourceRef ? [] : ['section-review-not-selected-for-current-path-batch'];
  const sourceHash = normalizeSha256(candidate.sourceHash);
  const citationAddress = {
    kind: target.address.kind,
    href: target.address.href,
    locator: target.address.locator,
    contentHash: normalizeSha256(target.address.contentHash),
    sourceRefId: target.address.sourceRefId,
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
    sourceWindow: {
      ...candidate.sourceWindow,
      pageAnchor: candidate.pageAnchor,
    },
    freshness: {
      bucket: 'current',
      checkedAt: GENERATED_AT,
      limitationState: [],
    },
    reviewState: {
      state: candidate.reviewState,
      reviewBatchId: candidate.reviewBatchId,
      reviewedAt: null,
      reviewerId: null,
      sourceAvailability: 'server-owned-runtime-address',
    },
    citationState: 'ready',
    limitationState,
    citationTargetId: target.citationTargetId,
    retrievalChunkId: target.retrievalChunkId,
    citationAddress,
    serverOwnedAddress: true,
    authority: candidate.authority,
    privacyScope: candidate.privacyScope,
    graphNodeRefs: candidate.graphNodeRefs,
    sourceVersionRef: target.sourceVersionRefs,
    reviewedSourceRef,
    citationChip: buildCitationChip({
      chunkId: target.retrievalChunkId,
      title: displayTitle,
      href: target.address.href,
      sourceType: 'course-content',
      addressKind: toCitationAddressKind(target.address.kind),
      citationAddress,
      authorityLevel: 'verified',
      confidence: 'high',
      freshnessBucket: 'current',
      privacyScope: candidate.privacyScope,
      limitationState,
      sourceVersionRefs: target.sourceVersionRefs,
    }),
    pathEligible: false,
    promotedAsPathNode: false,
    rawContentIncluded: false,
  };
}

function mediaCorpusItem(item: MediaReviewItem): CorpusItem {
  const href = isLocalRuntimeTarget(item.renderTarget) ? item.renderTarget : null;
  const sourceHash = item.sourceHash ?? item.repairedSourceHash ?? null;
  const ready = item.citationAnchorState === 'figure-anchor-ready' && Boolean(href && sourceHash);
  const normalizedSourceHash = normalizeSha256(sourceHash);
  const limitationState = ready ? [] : uniqueSorted([
    ...item.limitationState,
    limitationForAnchorState(item.citationAnchorState),
    href ? '' : 'server-owned-display-href-unavailable',
    sourceHash ? '' : 'source-hash-unavailable',
  ]);
  const citationAddress = {
    kind: toCitationAddressKind(item.resourceKind),
    href,
    locator: item.resourceId,
    contentHash: normalizedSourceHash,
    sourceRefId: item.resourceId,
  };
  const freshnessBucket = normalizedSourceHash && item.sourceAvailability === 'local-source-present' ? 'current' : 'stale';
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
    serverOwnedAddress: Boolean(href),
    authority: item.disposition === 'embedded-asset' ? 'reviewed-embedded-asset' : 'reviewed-supporting-citation',
    privacyScope: item.privacyScope,
    graphNodeRefs: item.graphNodeRefs,
    sourceVersionRef: item.sourceVersionRef,
    reviewedSourceRef: `runtime-media-handout-disposition:${item.resourceId}`,
    citationChip: buildCitationChip({
      chunkId: ready ? `retrieval-chunk:${item.resourceId}` : `limited-citation:${item.resourceId}`,
      title: item.resourceId,
      href: ready ? href : null,
      sourceType: 'runtime-handout',
      addressKind: toCitationAddressKind(item.resourceKind),
      citationAddress,
      authorityLevel: ready ? 'verified' : 'contextual',
      confidence: ready ? 'high' : 'medium',
      freshnessBucket,
      privacyScope: item.privacyScope,
      limitationState,
    }),
    pathEligible: false,
    promotedAsPathNode: false,
    rawContentIncluded: false,
  };
}

function buildSummary(
  candidates: GroundingCandidate[],
  targets: CitationTarget[],
  coreReviews: SectionReviewItem[],
  referenceReviews: ReferenceReviewItem[],
  mediaReviews: MediaReviewItem[],
  corpusItems: CorpusItem[],
) {
  const targetCandidateIds = new Set(targets.map((target) => target.candidateId));
  const corpusByClass = countBy(corpusItems, (item) => item.sourceClass);
  const readyItems = corpusItems.filter((item) => item.citationState === 'ready');
  const limitedItems = corpusItems.filter((item) => item.citationState === 'limited');
  return {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: GENERATED_AT,
    reviewBatchId: REVIEW_BATCH_ID,
    totals: {
      candidates: candidates.length,
      citationTargets: targets.length,
      coreReviewedSections: coreReviews.length,
      referenceStructuralRows: referenceReviews.length,
      mediaReviewedRows: mediaReviews.length,
      corpusItems: corpusItems.length,
      ready: readyItems.length,
      limited: limitedItems.length,
    },
    coverage: {
      candidatesWithoutCitationTargets: candidates.filter((candidate) => !targetCandidateIds.has(candidate.candidateId)).length,
      citationTargetsWithoutCandidates: targets.filter((target) => !candidates.some((candidate) => candidate.candidateId === target.candidateId)).length,
      readyTextbookGrounding: readyItems.filter((item) => item.sourceClass === 'textbook-grounding').length,
      readyMediaAnchors: readyItems.filter((item) => item.sourceClass === 'runtime-media').length,
      limitedMediaAnchors: limitedItems.filter((item) => item.sourceClass === 'runtime-media').length,
      bySourceClass: corpusByClass,
      bySourceKind: countBy(corpusItems, (item) => item.sourceKind),
      byLimitation: countBy(limitedItems.flatMap((item) => item.limitationState), (item) => item),
    },
    guardrails: {
      serverOwnedAddressOnly: corpusItems.every((item) => !item.citationAddress.href || isServerOwnedHref(item.citationAddress.href)),
      noModelAuthoredUrls: corpusItems.every((item) => !String(item.citationAddress.href || '').includes('user-content-fn')),
      noPathPromotionFromChunksOrMedia: corpusItems.every((item) => item.pathEligible === false && item.promotedAsPathNode === false),
      rawContentIncluded: corpusItems.some((item) => item.rawContentIncluded === true),
      readyItemsHaveAddressAndHash: readyItems.every((item) => Boolean(item.citationAddress.href && item.citationAddress.contentHash)),
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
    `Ready citations: ${summary.totals.ready}`,
    `Limited citations: ${summary.totals.limited}`,
    '',
    '## Batch Before/After',
    '',
    '- Before: no tracked RAG citation-anchor coverage artifact existed for this batch.',
    `- After: ${summary.totals.corpusItems} governed corpus rows, ${summary.totals.ready} ready citation chips, ${summary.totals.limited} limited citation chips.`,
    '',
    '## Coverage',
    '',
    `- Candidates without citation targets: ${summary.coverage.candidatesWithoutCitationTargets}`,
    `- Citation targets without candidates: ${summary.coverage.citationTargetsWithoutCandidates}`,
    `- Ready textbook grounding rows: ${summary.coverage.readyTextbookGrounding}`,
    `- Ready media anchors: ${summary.coverage.readyMediaAnchors}`,
    `- Limited media anchors: ${summary.coverage.limitedMediaAnchors}`,
    '',
    '## Guardrails',
    '',
    `- Server-owned addresses only: ${summary.guardrails.serverOwnedAddressOnly}`,
    `- Model-authored URLs accepted: ${!summary.guardrails.noModelAuthoredUrls}`,
    `- Chunks or media promoted as PathNodes: ${!summary.guardrails.noPathPromotionFromChunksOrMedia}`,
    `- Raw content included in artifacts: ${summary.guardrails.rawContentIncluded}`,
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

function isLocalRuntimeTarget(value: string | null | undefined) {
  return typeof value === 'string' && value.startsWith('/course-runtime/');
}

function isServerOwnedHref(value: string) {
  return value.startsWith('/course-runtime/');
}

function toCitationAddressKind(value: string): CorpusItem['citationAddress']['kind'] {
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
    limitationState: input.limitationState[0] ?? null,
    sourceVersionRefs: input.sourceVersionRefs,
  };
}

function normalizeSha256(value: string | null | undefined) {
  if (!value) return null;
  return value.startsWith('sha256:') ? value : `sha256:${value}`;
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
