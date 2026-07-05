import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ensureTextbookRuntimeExports, textbookCorpusItem } from '../db/generate-rag-citation-anchor-coverage';

interface CorpusItem {
  sourceClass: string;
  sourceKind: string;
  resourceSegmentRef: string;
  resourceSegmentId: string;
  sourceHash: string | null;
  sourceWindow: Record<string, unknown> | null;
  freshness: {
    bucket: 'current' | 'stale';
    checkedAt: string;
    limitationState: string[];
  };
  reviewState: {
    state: string;
    reviewBatchId: string;
    reviewedAt: string | null;
    reviewerId: string | null;
    sourceAvailability: string | null;
  };
  citationState: string;
  limitationState: string[];
  citationTargetId: string | null;
  retrievalChunkId: string | null;
  citationAddress: {
    kind: string;
    href: string | null;
    contentHash: string | null;
    sourceRefId: string | null;
  };
  serverOwnedAddress: boolean;
  authority: string;
  privacyScope: string;
  pathEligible: boolean;
  promotedAsPathNode: boolean;
  rawContentIncluded: boolean;
  citationChip: {
    chunkId: string;
    displayTitle: string;
    displayHref: string | null;
    sourceType: string;
    addressKind: string;
    citationAddress: CorpusItem['citationAddress'];
    authorityLevel: string;
    confidence: string;
    freshnessBucket: string;
    privacyVisibility: string;
    limitationState: string | null;
  };
}

const CITATION_CHIP_LIMITATION_REASONS = new Set([
  'missing-chunk',
  'inaccessible-source',
  'unsupported-source-type',
  'privacy-violation',
  'source-type-mismatch',
  'quote-hash-mismatch',
  'span-ref-mismatch',
  'insufficient-authority',
  'missing-learner-evidence',
  'conflicting-source',
  'privacy-redacted',
  'low-confidence-source',
  'stale-source',
  'expired-source',
  'unresolved-address',
  'unsafe-address',
  'address-kind-mismatch',
  'missing-version-ref',
]);

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const corpusItems = readJsonl<CorpusItem>('rag-citation-anchor-corpus-items.jsonl');
const summary = JSON.parse(readFileSync(path.join(
  GOVERNANCE_DIR,
  'rag-citation-anchor-coverage-summary.json',
), 'utf8'));
const evidence = readFileSync(path.join(
  GOVERNANCE_DIR,
  'rag-citation-anchor-coverage-evidence.md',
), 'utf8');

assert(summary.totals.candidates === 964, 'expected current textbook grounding candidate count');
assert(summary.totals.citationTargets === 964, 'expected current textbook citation target count');
assert(summary.totals.mediaReviewedRows === 20, 'expected current reviewed media/handout row count');
assert(summary.totals.corpusItems === 984, 'expected textbook plus media corpus rows');
assert(summary.coverage.candidatesWithoutCitationTargets === 0, 'every grounding candidate must have a citation target');
assert(summary.coverage.citationTargetsWithoutCandidates === 0, 'every citation target must map to a grounding candidate');
assert(summary.coverage.readyTextbookGrounding === 964, 'all textbook grounding rows must resolve through CitationAddress metadata');
assert(summary.coverage.readyMediaAnchors === 14, 'reviewed figure anchors should be ready');
assert(summary.coverage.limitedMediaAnchors === 6, 'non-figure media/handout anchors should be explicitly limited');
assert(summary.guardrails.serverOwnedAddressOnly === true, 'citations must use server-owned hrefs only');
assert(summary.guardrails.noModelAuthoredUrls === true, 'model-authored footnote URLs must not be accepted');
assert(summary.guardrails.noPathPromotionFromChunksOrMedia === true, 'chunks/media must not become path nodes');
assert(summary.guardrails.rawContentIncluded === false, 'artifacts must not include raw content');
assert(summary.guardrails.readyItemsHaveAddressAndHash === true, 'ready rows need href and content hash');
assert(summary.guardrails.readyItemsMatchSourceHash === true, 'ready rows must not use stale CitationTarget hashes');
assert(summary.guardrails.limitedItemsHaveReason === true, 'limited rows need explicit reasons');
assert(summary.guardrails.metadataContractComplete === true, 'all rows must carry segment, freshness, source hash or source-hash limitation, and review state metadata');
assert(summary.guardrails.citationChipPayloadsComplete === true, 'all rows must carry product CitationChip payload metadata');

const readyTextbook = corpusItems.filter((item) => item.sourceClass === 'textbook-grounding');
assert(readyTextbook.length === 964, 'textbook corpus row count mismatch');
assert(
  readyTextbook.every((item) =>
    item.citationState === 'ready' &&
    item.resourceSegmentRef.startsWith('ResourceSegment:hu-shousong-exercise-analysis-3rd:') &&
    item.resourceSegmentId.length > 0 &&
    item.sourceHash?.startsWith('sha256:') &&
    item.sourceWindow !== null &&
    item.freshness.bucket === 'current' &&
    item.reviewState.state === 'human-confirmed' &&
    isSafeDisplayTitle(item.title) &&
    isSafeDisplayTitle(item.citationChip.displayTitle) &&
    item.citationTargetId?.startsWith('citation-target:') &&
    item.retrievalChunkId?.startsWith('retrieval-chunk:') &&
    item.citationAddress.href?.startsWith('/course-runtime/resources/textbooks/') &&
    item.citationAddress.contentHash?.startsWith('sha256:') &&
    item.serverOwnedAddress === true &&
    item.authority.length > 0 &&
    item.privacyScope.length > 0 &&
    isReadyCitationChip(item, 'course-content')
  ),
  'textbook rows must use server-owned citation targets, addresses, review metadata, and CitationChip payloads',
);

const mediaItems = corpusItems.filter((item) => item.sourceClass === 'runtime-media');
assert(mediaItems.length === 20, 'media corpus row count mismatch');
assert(
  mediaItems.filter((item) => item.citationState === 'ready').every((item) =>
    item.resourceSegmentRef.startsWith('ResourceSegment:') &&
    item.reviewState.state === 'human-reviewed-anchor-ready' &&
    item.sourceHash?.startsWith('sha256:') &&
    item.freshness.bucket === 'current' &&
    item.sourceKind === 'image' &&
    item.citationAddress.href?.startsWith('/course-runtime/lessons/') &&
    item.citationAddress.contentHash?.startsWith('sha256:') &&
    item.authority.length > 0 &&
    item.privacyScope.length > 0 &&
    isReadyCitationChip(item, 'runtime-handout')
  ),
  'ready media rows must be local reviewed image anchors with CitationChip payloads',
);
assert(
  mediaItems.filter((item) => item.citationState === 'limited').every((item) =>
    item.resourceSegmentRef.startsWith('ResourceSegment:') &&
    item.reviewState.state === 'human-reviewed-limited' &&
    item.freshness.bucket === (item.sourceHash ? 'current' : 'stale') &&
    (item.sourceHash?.startsWith('sha256:') || item.limitationState.includes('source-hash-unavailable')) &&
    item.limitationState.length > 0 &&
    item.authority.length > 0 &&
    item.privacyScope.length > 0 &&
    item.citationAddress.href === null &&
    item.serverOwnedAddress === false &&
    item.citationChip.limitationState !== null &&
    CITATION_CHIP_LIMITATION_REASONS.has(item.citationChip.limitationState) &&
    isLimitedCitationChip(item)
  ),
  'limited media rows must preserve review metadata, limitation state, and limited CitationChip payloads',
);
assert(
  corpusItems.every((item) => item.pathEligible === false && item.promotedAsPathNode === false && item.rawContentIncluded === false),
  'corpus citation artifacts must not promote citation support into path nodes or include raw content',
);
assert(evidence.includes('Model-authored URLs accepted: false'), 'evidence must state model URL rejection');
assert(evidence.includes('Chunks or media promoted as PathNodes: false'), 'evidence must state non-promotion guardrail');
assert(evidence.includes('Ready citation hashes match source hashes: true'), 'evidence must state CitationTarget hash consistency');
assert(evidence.includes('Metadata contract complete: true'), 'evidence must state metadata contract closure');
assert(evidence.includes('CitationChip payloads complete: true'), 'evidence must state CitationChip payload closure');
assert(
  corpusItems.every((item) => isSafeDisplayTitle(item.title) && isSafeDisplayTitle(item.citationChip.displayTitle)),
  'corpus titles and CitationChip display titles must not carry raw image descriptions',
);
assertMissingTextbookTargetDowngradesToLimited();
assertMissingFigureTargetDowngradesToLimitedImage();
assertInvalidFigureTargetDowngradesToLimitedImage();
assertUnreviewedTextbookTargetDowngradesToLimited();
assertUnsafeTextbookTargetDowngradesToLimited();
assertUnresolvableTextbookTargetDowngradesToLimited();
assertEncodedTraversalTextbookTargetDowngradesToLimited();
assertStaleTextbookTargetHashDowngradesToLimited();
assertMissingTextbookRuntimeExportFailsFast();

console.log('RAG citation anchor coverage artifacts verified.');

function readJsonl<T>(filename: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function isReadyCitationChip(item: CorpusItem, expectedSourceType: string) {
  return item.citationChip.chunkId === item.retrievalChunkId &&
    item.citationChip.displayTitle.length > 0 &&
    item.citationChip.displayHref === item.citationAddress.href &&
    item.citationChip.sourceType === expectedSourceType &&
    item.citationChip.citationAddress.href === item.citationAddress.href &&
    item.citationChip.authorityLevel === 'verified' &&
    item.citationChip.confidence === 'high' &&
    item.citationChip.freshnessBucket === item.freshness.bucket &&
    item.citationChip.privacyVisibility === 'public' &&
    item.citationChip.limitationState === null;
}

function isLimitedCitationChip(item: CorpusItem) {
  return item.citationChip.chunkId === `limited-citation:${item.citationAddress.sourceRefId}` &&
    item.citationChip.displayTitle.length > 0 &&
    item.citationChip.displayHref === null &&
    item.citationChip.sourceType === 'runtime-handout' &&
    item.citationChip.citationAddress.sourceRefId === item.citationAddress.sourceRefId &&
    item.citationChip.authorityLevel === 'contextual' &&
    item.citationChip.confidence === 'medium' &&
    item.citationChip.freshnessBucket === item.freshness.bucket &&
    item.citationChip.privacyVisibility === 'public' &&
    item.citationChip.limitationState !== null &&
    CITATION_CHIP_LIMITATION_REASONS.has(item.citationChip.limitationState);
}

function isSafeDisplayTitle(value: string) {
  return value.length > 0 &&
    value.length <= 120 &&
    !/Image description/i.test(value);
}

function assertMissingTextbookTargetDowngradesToLimited() {
  const item = textbookCorpusItem(syntheticCandidate(), undefined, new Set(), new Set()) as CorpusItem;
  assert(item.citationState === 'limited', 'missing citation target must produce a limited textbook artifact');
  assert(item.limitationState.includes('missing-citation-target'), 'missing target limitation must be explicit');
  assert(item.citationTargetId === null, 'missing target artifact must not claim a CitationTarget');
  assert(item.retrievalChunkId === null, 'missing target artifact must not claim a retrieval chunk');
  assert(item.citationChip.displayHref === null, 'missing target CitationChip must not be clickable');
  assert(item.citationAddress.href === null, 'missing target CitationAddress must not be hydratable');
  assert(item.citationChip.limitationState === 'missing-chunk', 'missing target CitationChip must use a standard limitation reason');
  assert(item.citationChip.authorityLevel === 'contextual', 'missing target CitationChip must be authority downgraded');
  assert(item.citationChip.confidence === 'medium', 'missing target CitationChip must be confidence downgraded');
  assert((item as any).sourceVersionRef.groundingVersion === 'textbook-media-grounding.v1', 'missing target artifact must preserve grounding version lineage');
}

function assertMissingFigureTargetDowngradesToLimitedImage() {
  const item = textbookCorpusItem({
    ...syntheticCandidate(),
    kind: 'figure',
    candidateId: 'textbook-figure:synthetic-book:synthetic-section:fig-001',
    documentId: 'fig-001',
    pageAnchor: 'fig-001',
  }, undefined, new Set(), new Set()) as CorpusItem;
  assert(item.citationState === 'limited', 'missing figure citation target must produce a limited artifact');
  assert(item.citationAddress.kind === 'image', 'missing figure target must preserve image address kind');
  assert(item.citationChip.addressKind === 'image', 'missing figure CitationChip must preserve image address kind');
  assert(item.citationChip.displayHref === null, 'missing figure CitationChip must not be clickable');
}

function assertInvalidFigureTargetDowngradesToLimitedImage() {
  const invalidTarget = syntheticTarget('https://example.test/model-authored');
  invalidTarget.address.kind = 'text';
  const item = textbookCorpusItem({
    ...syntheticCandidate(),
    kind: 'figure',
    candidateId: 'textbook-figure:synthetic-book:synthetic-section:fig-002',
    documentId: 'fig-002',
    pageAnchor: 'fig-002',
  }, invalidTarget, new Set(['synthetic-section']), new Set()) as CorpusItem;
  assert(item.citationState === 'limited', 'invalid figure citation target must produce a limited artifact');
  assert(item.citationAddress.kind === 'image', 'invalid figure target must preserve image address kind');
  assert(item.citationChip.addressKind === 'image', 'invalid figure CitationChip must preserve image address kind');
  assert(item.citationChip.displayHref === null, 'invalid figure CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'unsafe-address', 'invalid figure CitationChip must use unsafe-address');
}

function assertUnreviewedTextbookTargetDowngradesToLimited() {
  const item = textbookCorpusItem(syntheticCandidate(), syntheticTarget(), new Set(), new Set()) as CorpusItem;
  assert(item.citationState === 'limited', 'unreviewed textbook target must produce a limited artifact');
  assert(
    item.limitationState.includes('section-review-not-selected-for-current-path-batch'),
    'unreviewed target limitation must be explicit',
  );
  assert(item.citationTargetId === 'citation-target:synthetic', 'unreviewed limited artifact may retain target lineage');
  assert(item.retrievalChunkId === 'retrieval-chunk:synthetic', 'unreviewed limited artifact may retain chunk lineage');
  assert(item.citationChip.displayHref === null, 'unreviewed CitationChip must not be clickable');
  assert(item.citationAddress.href === null, 'unreviewed CitationAddress must not be hydratable');
  assert(item.citationChip.limitationState === 'insufficient-authority', 'unreviewed CitationChip must use a standard limitation reason');
  assert(item.citationChip.authorityLevel === 'contextual', 'unreviewed CitationChip must be authority downgraded');
  assert(item.citationChip.confidence === 'medium', 'unreviewed CitationChip must be confidence downgraded');
}

function assertUnsafeTextbookTargetDowngradesToLimited() {
  const item = textbookCorpusItem(
    syntheticCandidate(),
    syntheticTarget('https://example.test/model-authored'),
    new Set(['synthetic-section']),
    new Set(),
  ) as CorpusItem;
  assert(item.citationState === 'limited', 'unsafe target href must produce a limited artifact');
  assert(item.limitationState.includes('unsafe-citation-target-href'), 'unsafe target limitation must be explicit');
  assert(item.citationAddress.href === null, 'unsafe target CitationAddress must not be hydratable');
  assert(item.serverOwnedAddress === false, 'unsafe target artifact must not claim a server-owned address');
  assert(item.citationChip.citationAddress.href === null, 'unsafe target CitationChip address must not be hydratable');
  assert(item.citationChip.displayHref === null, 'unsafe target CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'unsafe-address', 'unsafe target CitationChip must use a standard limitation reason');
  assert(item.citationChip.authorityLevel === 'contextual', 'unsafe target CitationChip must be authority downgraded');
  assert(item.citationChip.confidence === 'medium', 'unsafe target CitationChip must be confidence downgraded');
}

function assertUnresolvableTextbookTargetDowngradesToLimited() {
  const item = textbookCorpusItem(
    syntheticCandidate(),
    syntheticTarget('/course-runtime/resource-governance/private.json'),
    new Set(['synthetic-section']),
    new Set(),
  ) as CorpusItem;
  assert(item.citationState === 'limited', 'private runtime target must produce a limited artifact');
  assert(item.limitationState.includes('unsafe-citation-target-href'), 'private runtime target limitation must be explicit');
  assert(item.citationAddress.href === null, 'private runtime target CitationAddress must not be hydratable');
  assert(item.citationChip.displayHref === null, 'private runtime target CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'unsafe-address', 'private runtime target CitationChip must use unsafe-address');
  assert(item.serverOwnedAddress === false, 'private runtime target must not be marked server owned');
}

function assertEncodedTraversalTextbookTargetDowngradesToLimited() {
  const item = textbookCorpusItem(
    syntheticCandidate(),
    syntheticTarget('/course-runtime/resources/textbooks/%2e%2e/%2e%2e/resource-governance/rag-citation-anchor-coverage-summary.json'),
    new Set(['synthetic-section']),
    new Set(),
  ) as CorpusItem;
  assert(item.citationState === 'limited', 'encoded traversal target must produce a limited artifact');
  assert(item.limitationState.includes('unsafe-citation-target-href'), 'encoded traversal limitation must be explicit');
  assert(item.citationAddress.href === null, 'encoded traversal CitationAddress must not be hydratable');
  assert(item.citationChip.displayHref === null, 'encoded traversal CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'unsafe-address', 'encoded traversal CitationChip must use unsafe-address');
  assert(item.serverOwnedAddress === false, 'encoded traversal target must not be marked server owned');
}

function assertStaleTextbookTargetHashDowngradesToLimited() {
  const staleTarget = syntheticTarget();
  staleTarget.address.contentHash = 'fedcba9876543210';
  staleTarget.contentHash = 'fedcba9876543210';
  const item = textbookCorpusItem(
    syntheticCandidate(),
    staleTarget,
    new Set(['synthetic-section']),
    new Set(),
  ) as CorpusItem;
  assert(item.citationState === 'limited', 'stale target hash must produce a limited artifact');
  assert(item.limitationState.includes('quote-hash-mismatch'), 'stale target hash limitation must be explicit');
  assert(item.citationAddress.href === null, 'stale target CitationAddress must not be hydratable');
  assert(item.citationAddress.contentHash === 'sha256:0123456789abcdef', 'limited stale target must preserve candidate source hash');
  assert(item.serverOwnedAddress === false, 'stale target artifact must not claim a server-owned address');
  assert(item.citationChip.displayHref === null, 'stale target CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'quote-hash-mismatch', 'stale target CitationChip must use the hash mismatch limitation reason');
  assert(item.citationChip.authorityLevel === 'contextual', 'stale target CitationChip must be authority downgraded');
  assert(item.citationChip.confidence === 'medium', 'stale target CitationChip must be confidence downgraded');
}

function assertMissingTextbookRuntimeExportFailsFast() {
  let failed = false;
  try {
    ensureTextbookRuntimeExports([
      syntheticTarget('/course-runtime/resources/textbooks/synthetic-book/chunks/missing.md') as any,
    ]);
  } catch (error) {
    failed = String((error as Error).message).includes('Textbook runtime exports are missing');
  }
  assert(failed, 'missing textbook runtime exports must fail before writing coverage artifacts');
}

function syntheticCandidate() {
  return {
    artifactVersion: 'textbook-media-grounding.v1',
    sourcePackageId: 'synthetic-book',
    candidateId: 'textbook-section:synthetic-book:synthetic-section:synthetic-chunk',
    documentId: 'synthetic-chunk',
    kind: 'chunk',
    title: 'Synthetic reviewed section',
    bookId: 'synthetic-book',
    chapterId: 'chapter-00',
    chapterNumber: 0,
    sectionId: 'synthetic-section',
    pageAnchor: 'synthetic-chunk',
    sourceHash: '0123456789abcdef',
    sourceWindow: {
      bookId: 'synthetic-book',
      chapterId: 'chapter-00',
      sectionId: 'synthetic-section',
    },
    graphNodeRefs: { knowledge: [], capability: [], quality: [] },
    citationPolicy: 'server-owned-address-required',
    authority: 'verified',
    privacyScope: 'student-visible',
    reviewState: 'human-confirmed',
    reviewBatchId: 'synthetic-review',
    pathEligible: false,
  };
}

function syntheticTarget(href = '/course-runtime/lessons/1-1/1-1-handout.md') {
  return {
    citationTargetId: 'citation-target:synthetic',
    retrievalChunkId: 'retrieval-chunk:synthetic',
    candidateId: 'textbook-section:synthetic-book:synthetic-section:synthetic-chunk',
    documentId: 'synthetic-chunk',
    address: {
      kind: 'text',
      sourceRefId: 'synthetic-chunk',
      href,
      locator: 'synthetic-chunk',
      contentHash: '0123456789abcdef',
    },
    contentHash: '0123456789abcdef',
    sourceVersionRefs: { groundingVersion: 'textbook-media-grounding.v1' },
    pathEligibility: { eligible: false, reason: 'synthetic' },
  };
}
