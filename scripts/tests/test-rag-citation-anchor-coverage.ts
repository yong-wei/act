import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  buildSummary,
  ensureTextbookRuntimeExports,
  mediaCorpusItem,
  textbookCorpusItem,
  validateMediaAcceptedRefReviewSource,
} from '../db/generate-rag-citation-anchor-coverage';

interface CorpusItem {
  sourceClass: string;
  sourceKind: string;
  resourceSegmentRef: string;
  resourceSegmentId: string;
  sourceHash: string | null;
  sourceSemanticHash: string | null;
  citationTargetFileHash: string | null;
  declaredTargetFileHash: string | null;
  citationPayloadHash: string | null;
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
  addressReady: boolean;
  semanticGroundingVerified: boolean;
  authority: string;
  privacyScope: string;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
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
  'semantic-relevance-unconfirmed',
]);

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const corpusItems = readJsonl<CorpusItem>('rag-citation-anchor-corpus-items.jsonl');
const citationTargets = readJsonl<{ targetFileHash: string }>('textbook-section-citation-targets.jsonl');
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
assert(
  citationTargets.length === 964 && citationTargets.every((target) => target.targetFileHash.startsWith('sha256:')),
  'every textbook CitationTarget must declare its final runtime target file hash',
);
assert(summary.totals.longformAgentReviewedRows === 964, 'all textbook grounding rows should retain agent-reviewed provenance');
assert(summary.totals.mediaReviewedRows === 20, 'expected current reviewed media/handout row count');
assert(summary.totals.corpusItems === 984, 'expected textbook plus media corpus rows');
assert(summary.coverage.candidatesWithoutCitationTargets === 0, 'every grounding candidate must have a citation target');
assert(summary.coverage.citationTargetsWithoutCandidates === 0, 'every citation target must map to a grounding candidate');
assert(summary.totals.addressReady === 978 && summary.totals.addressLimited === 6, 'address readiness totals must be explicit');
assert(summary.totals.semanticGroundingVerified === 1 && summary.totals.semanticGroundingUnverified === 983, 'semantic grounding totals must be independent from address readiness');
assert(summary.coverage.addressReadyTextbookRows === 964, 'all textbook rows must resolve through CitationAddress metadata');
assert(summary.coverage.semanticVerifiedTextbookRows === 0, 'address-ready textbook rows are not grounding-verified without accepted refs');
assert(summary.coverage.addressReadyMediaAnchors === 14, 'reviewed figure anchors should be address-ready');
assert(summary.coverage.semanticVerifiedMediaRows === 1, 'media graph refs require explicit accepted-ref provenance');
assert(summary.coverage.addressLimitedMediaAnchors === 6, 'non-figure media/handout anchors should be explicitly address-limited');
assert(Object.keys(summary.limitations.address).length > 0, 'address limitations need a separate reason histogram');
assert(summary.limitations.semanticGrounding['semantic-relevance-unconfirmed'] === 983, 'semantic grounding limitations need an independent reason histogram');
assert(summary.guardrails.serverOwnedAddressOnly === true, 'citations must use server-owned hrefs only');
assert(summary.guardrails.noModelAuthoredUrls === true, 'model-authored footnote URLs must not be accepted');
assert(summary.guardrails.noPathPromotionFromChunksOrMedia === true, 'chunks/media must not become path nodes');
assert(summary.guardrails.rawContentIncluded === false, 'artifacts must not include raw content');
assert(summary.guardrails.readyItemsHaveAddressAndHash === true, 'ready rows need href and content hash');
assert(summary.guardrails.readyItemsMatchSourceHash === true, 'ready rows must not use stale CitationTarget hashes');
assert(summary.guardrails.explicitHashRoles === true, 'source semantic, citation target file, and citation payload hashes must remain distinct fields');
assert(summary.guardrails.addressAndSemanticGroundingOrthogonal === true, 'address readiness and semantic grounding must remain orthogonal');
assert(summary.guardrails.unverifiedSemanticRowsDoNotRetainGraphRefs === true, 'unverified semantic rows must not retain candidate graph refs');
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
    item.sourceSemanticHash === item.citationPayloadHash &&
    item.citationTargetFileHash?.startsWith('sha256:') &&
    item.declaredTargetFileHash === item.citationTargetFileHash &&
    item.sourceWindow !== null &&
    item.freshness.bucket === 'current' &&
    item.reviewState.state === 'agent-reviewed' &&
    isSafeDisplayTitle(item.title) &&
    isSafeDisplayTitle(item.citationChip.displayTitle) &&
    item.citationTargetId?.startsWith('citation-target:') &&
    item.retrievalChunkId?.startsWith('retrieval-chunk:') &&
    item.citationAddress.href?.startsWith('/course-runtime/resources/textbooks/') &&
    item.citationAddress.contentHash?.startsWith('sha256:') &&
    item.serverOwnedAddress === true &&
    item.addressReady === true &&
    item.semanticGroundingVerified === false &&
    Object.values(item.graphNodeRefs).every((refs) => refs.length === 0) &&
    item.limitationState.includes('semantic-relevance-unconfirmed') &&
    item.authority.length > 0 &&
    item.privacyScope.length > 0 &&
    isReadyCitationChip(item, 'course-content')
  ),
  'textbook rows must use server-owned citation targets, addresses, review metadata, and CitationChip payloads',
);

const mediaReviewRows = readJsonl<any>('runtime-media-handout-disposition-review-items.jsonl');
const mediaItems = corpusItems.filter((item) => item.sourceClass === 'runtime-media');
assert(mediaItems.length === 20, 'media corpus row count mismatch');
const readyMediaReview = mediaReviewRows.find((item) => item.citationAnchorState === 'figure-anchor-ready');
assert(readyMediaReview, 'a ready media review fixture is required');
const staleMedia = mediaCorpusItem({
  ...readyMediaReview,
  sourceHash: `sha256:${'0'.repeat(64)}`,
}) as CorpusItem;
assert(staleMedia.citationState === 'limited' && staleMedia.addressReady === false, 'stale media bytes/hash must fail closed');
assert(staleMedia.freshness.bucket === 'stale', 'stale media bytes/hash must not remain current');
assert(staleMedia.limitationState.includes('quote-hash-mismatch'), 'stale media hash limitation must be explicit');
assert(staleMedia.citationAddress.href === null, 'stale media citation must not remain hydratable');

const forgedReadyMedia = {
  ...mediaItems.find((item) => item.citationState === 'ready')!,
  citationTargetFileHash: `sha256:${'f'.repeat(64)}`,
};
const staleSummary = buildSummary([], [], [], [], [], [forgedReadyMedia] as any[]);
assert(staleSummary.guardrails.readyItemsMatchSourceHash === false, 'summary guardrail must compare target file and declared payload/source hashes');
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
    (item.semanticGroundingVerified
      ? Object.values(item.graphNodeRefs).some((refs) => refs.length > 0) && item.citationChip.authorityLevel === 'verified' && item.citationChip.confidence === 'high'
      : Object.values(item.graphNodeRefs).every((refs) => refs.length === 0) && item.citationChip.authorityLevel === 'contextual' && item.citationChip.confidence === 'medium') &&
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
assert(evidence.includes('Ready citation file declarations and semantic payload hashes match: true'), 'evidence must state CitationTarget file and semantic hash consistency');
assert(evidence.includes('Metadata contract complete: true'), 'evidence must state metadata contract closure');
assert(evidence.includes('CitationChip payloads complete: true'), 'evidence must state CitationChip payload closure');
assert(evidence.includes('Address-ready citations: 978'), 'evidence must report address readiness separately');
assert(evidence.includes('Semantic grounding verified: 1'), 'evidence must report semantic grounding separately');
assert(evidence.includes('Source semantic, actual/declared citation target file, and citation payload hashes are explicit: true'), 'evidence must report explicit hash roles');
assert(evidence.includes('Address limitation rows: 6'), 'evidence must report address limitations separately');
assert(evidence.includes('Semantic-grounding limitation rows: 983'), 'evidence must report semantic limitations separately');
assert(!evidence.includes('Ready textbook grounding'), 'address readiness must not be called grounding ready');
assert(
  corpusItems.every((item) => isSafeDisplayTitle(item.title) && isSafeDisplayTitle(item.citationChip.displayTitle)),
  'corpus titles and CitationChip display titles must not carry raw image descriptions',
);
assertMissingTextbookTargetDowngradesToLimited();
assertAcceptedGraphRefsEmptyStayContextual();
assertForgedAcceptedGraphRefsStayContextual();
assertMissingFigureTargetDowngradesToLimitedImage();
assertInvalidFigureTargetDowngradesToLimitedImage();
assertUnreviewedTextbookTargetDowngradesToLimited();
assertUnsafeTextbookTargetDowngradesToLimited();
assertUnresolvableTextbookTargetDowngradesToLimited();
assertEncodedTraversalTextbookTargetDowngradesToLimited();
assertStaleTextbookTargetHashDowngradesToLimited();
assertTextbookRuntimeTargetFileDriftFailsClosed();
assertMissingDeclaredTextbookTargetFileHashFailsClosed();
assertAddressKindMismatchDowngradesToLimited();
assertSpanMismatchDowngradesToLimited();
assertFigureSpanMismatchDowngradesToLimited();
assertMissingTextbookRuntimeExportFailsFast();

const runtimeHandout = corpusItems.find((item) => item.sourceClass === 'runtime-media' && item.resourceSegmentId === 'runtime-handout:1-1');
assert(runtimeHandout, 'runtime-handout:1-1 corpus row is required');
assert(runtimeHandout.semanticGroundingVerified === false, 'runtime-handout:1-1 has no accepted-ref provenance');
assert(runtimeHandout.citationChip.authorityLevel === 'contextual' && runtimeHandout.citationChip.confidence === 'medium', 'runtime-handout:1-1 cannot be verified/high');

const acceptedRows = readJsonl<any>('rag-media-accepted-ref-review-source.jsonl');
const acceptedSeal = JSON.parse(readFileSync(path.join(GOVERNANCE_DIR, 'rag-media-accepted-ref-review-source.seal.json'), 'utf8'));
assert(validateMediaAcceptedRefReviewSource(acceptedRows, acceptedSeal, mediaReviewRows).size === 1, 'sealed accepted-ref review source needs one legal positive');
for (const mutation of [
  (row: any) => { row.reviewerRole = 'forged-reviewer'; },
  (row: any) => { row.acceptedGraphNodeRefs.knowledge = ['forged-node']; },
  (row: any) => { row.sourceHash = 'sha256:stale-source'; },
]) {
  const changed = structuredClone(acceptedRows);
  mutation(changed[0]);
  assert(validateMediaAcceptedRefReviewSource(changed, acceptedSeal, mediaReviewRows).size === 0, 'forged fields, refs, or stale source must clear accepted refs');
}
assert(validateMediaAcceptedRefReviewSource(acceptedRows, { ...acceptedSeal, aggregateDigest: 'sha256:bad-seal' }, mediaReviewRows).size === 0, 'bad aggregate seal must clear accepted refs');
for (const [label, refs] of [
  ['nonexistent node', { knowledge: ['knowledge-node-does-not-exist'], capability: ['controlModeling'], quality: [] }],
  ['wrong node type', { knowledge: ['controlModeling'], capability: ['反馈_1_1'], quality: [] }],
] as const) {
  const changed = structuredClone(acceptedRows);
  changed[0].acceptedGraphNodeRefs = refs;
  const resealed = resealMediaAcceptedRows(changed);
  assert(validateMediaAcceptedRefReviewSource(resealed.rows, resealed.seal, mediaReviewRows).size === 0, `recomputed seal must not admit ${label}`);
}

console.log('RAG citation anchor coverage artifacts verified.');

function readJsonl<T>(filename: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function resealMediaAcceptedRows(rows: any[]) {
  const sealedRows = rows.map((row) => {
    const { rowDigest: _rowDigest, ...signedFields } = row;
    return { ...signedFields, rowDigest: sha256Json(signedFields) };
  });
  return {
    rows: sealedRows,
    seal: {
      artifactVersion: 'rag-media-accepted-ref-review-source.seal.v1',
      rowCount: sealedRows.length,
      aggregateDigest: sha256Text(sealedRows.map((row) => JSON.stringify(row)).join('\n') + '\n'),
    },
  };
}

function sha256Json(value: unknown) {
  return sha256Text(JSON.stringify(value));
}

function sha256Text(value: string) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
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
    item.citationChip.authorityLevel === (item.semanticGroundingVerified ? 'verified' : 'contextual') &&
    item.citationChip.confidence === (item.semanticGroundingVerified ? 'high' : 'medium') &&
    item.citationChip.freshnessBucket === item.freshness.bucket &&
    item.citationChip.privacyVisibility === 'public' &&
    item.citationChip.limitationState === (item.semanticGroundingVerified ? null : 'semantic-relevance-unconfirmed');
}

function isLimitedCitationChip(item: CorpusItem) {
  return item.citationChip.chunkId === `limited-citation:${item.citationAddress.sourceRefId}` &&
    item.citationChip.displayTitle.length > 0 &&
    item.citationChip.displayHref === null &&
    item.citationChip.sourceType === 'runtime-handout' &&
    item.citationChip.citationAddress.sourceRefId === item.citationAddress.sourceRefId &&
    item.citationChip.authorityLevel === (item.semanticGroundingVerified ? 'verified' : 'contextual') &&
    item.citationChip.confidence === (item.semanticGroundingVerified ? 'high' : 'medium') &&
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

function assertAcceptedGraphRefsEmptyStayContextual() {
  const candidate = {
    ...syntheticCandidate(),
    graphNodeRefs: { knowledge: ['candidate-only-node'], capability: [], quality: [] },
  };
  const reviews = new Map([[`textbook-search-document:${candidate.documentId}`, {
    resourceId: `textbook-search-document:${candidate.documentId}`,
    sourceFamily: 'textbook-search-document',
    reviewStatus: 'agent-reviewed',
    reviewBatchId: 'review-batch',
    reviewerId: 'implementing-agent',
    reviewedAt: '2026-07-16T00:00:00.000Z',
    sourceHash: candidate.sourceHash,
    citationAddress: { href: syntheticTarget().address.href, locator: candidate.pageAnchor, contentHash: candidate.sourceHash },
    acceptedGraphNodeRefs: { knowledge: [], capability: [], quality: [] },
    independentEvidenceRef: syntheticTarget().address.href,
    reviewSourceSha256: 'sha256:review-source',
    reviewRowHash: 'sha256:review-row',
  }]]);
  const item = textbookCorpusItem(
    candidate,
    syntheticTarget(),
    new Set([candidate.sectionId]),
    new Set(),
    reviews as any,
  ) as CorpusItem;
  assert(item.addressReady === true && item.citationState === 'ready', 'valid address must remain independently ready');
  assert(item.semanticGroundingVerified === false, 'empty accepted refs cannot verify semantic grounding');
  assert(Object.values(item.graphNodeRefs).every((refs) => refs.length === 0), 'candidate graph refs must be cleared');
  assert(item.limitationState.includes('semantic-relevance-unconfirmed'), 'semantic limitation must be explicit');
  assert(item.citationChip.authorityLevel === 'contextual' && item.citationChip.confidence === 'medium', 'unverified semantics cannot be high/verified');
}

function assertForgedAcceptedGraphRefsStayContextual() {
  const candidate = syntheticCandidate();
  const target = syntheticTarget();
  const forgedReview = {
    resourceId: `textbook-search-document:${candidate.documentId}`,
    sourceFamily: 'textbook-search-document',
    reviewStatus: 'agent-reviewed',
    reviewBatchId: 'forged-review-batch',
    reviewerId: 'forged-reviewer',
    reviewerRole: 'implementing-agent',
    reviewedAt: '2999-01-01T00:00:00.000Z',
    sourceHash: candidate.sourceHash,
    sourceVersionRef: 'textbook-runtime-search-documents.v1',
    citationAddress: { ...target.address },
    acceptedGraphNodeRefs: { knowledge: ['forged-node'], capability: ['forged-capability'], quality: [] },
    independentEvidenceRef: target.address.href,
    reviewSourceSha256: 'sha256:forged-source',
    reviewRowHash: 'sha256:forged-row',
  };
  const item = textbookCorpusItem(
    candidate,
    target,
    new Set([candidate.sectionId]),
    new Set(),
    new Map([[forgedReview.resourceId, forgedReview]]) as any,
  ) as CorpusItem;
  assert(item.addressReady === true, 'independently valid address may remain ready');
  assert(item.semanticGroundingVerified === false, 'forged/future review provenance cannot verify grounding');
  assert(Object.values(item.graphNodeRefs).every((refs) => refs.length === 0), 'forged accepted refs must be cleared');
  assert(item.citationChip.authorityLevel === 'contextual' && item.citationChip.confidence === 'medium', 'forged review must downgrade authority and confidence');
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

function assertTextbookRuntimeTargetFileDriftFailsClosed() {
  const runtimeRoot = path.join(process.cwd(), 'course-content/runtime/resources/textbooks');
  const fixtureDir = mkdtempSync(path.join(runtimeRoot, '.rag-citation-target-drift-'));
  try {
    const targetPath = path.join(fixtureDir, 'target.md');
    writeFileSync(targetPath, 'original runtime wrapper\n', 'utf8');
    const href = `/course-runtime/resources/textbooks/${path.basename(fixtureDir)}/target.md#synthetic-chunk`;
    const target = syntheticTarget(href);
    writeFileSync(targetPath, 'corrupted runtime wrapper\n', 'utf8');
    const item = textbookCorpusItem(
      syntheticCandidate(),
      target,
      new Set(['synthetic-section']),
      new Set(),
    ) as CorpusItem;
    assert(item.citationState === 'limited' && item.addressReady === false, 'runtime target file drift must fail closed');
    assert(item.freshness.bucket === 'stale', 'runtime target file drift must be stale');
    assert(item.citationAddress.href === null && item.citationChip.displayHref === null, 'drifted runtime target must not remain clickable');
    assert(item.citationTargetFileHash !== item.declaredTargetFileHash, 'drift fixture must compare different actual and declared file hashes');
    const driftSummary = buildSummary([], [], [], [], [], [item] as any[]);
    assert(driftSummary.guardrails.readyItemsMatchSourceHash === false, 'summary guardrail must reject runtime target file drift');
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
}

function assertMissingDeclaredTextbookTargetFileHashFailsClosed() {
  const target = syntheticTarget() as ReturnType<typeof syntheticTarget> & { targetFileHash?: string };
  delete target.targetFileHash;
  const item = textbookCorpusItem(
    syntheticCandidate(),
    target as any,
    new Set(['synthetic-section']),
    new Set(),
  ) as CorpusItem;
  assert(item.citationState === 'limited' && item.addressReady === false, 'missing declared target file hash must fail closed');
  assert(item.freshness.bucket === 'stale', 'missing declared target file hash must be stale');
  assert(item.citationAddress.href === null && item.citationChip.displayHref === null, 'missing declared target file hash must not remain clickable');
  const missingHashSummary = buildSummary([], [], [], [], [], [item] as any[]);
  assert(missingHashSummary.guardrails.readyItemsMatchSourceHash === false, 'summary guardrail must reject a missing declared target file hash');
}

function assertAddressKindMismatchDowngradesToLimited() {
  const figureCandidate = {
    ...syntheticCandidate(),
    kind: 'figure',
    candidateId: 'textbook-figure:synthetic-book:synthetic-section:fig-003',
    documentId: 'fig-003__figure',
    pageAnchor: 'fig-003',
  };
  const textTarget = syntheticTarget();
  textTarget.candidateId = figureCandidate.candidateId;
  textTarget.documentId = figureCandidate.documentId;
  textTarget.address.sourceRefId = figureCandidate.pageAnchor;
  textTarget.address.locator = figureCandidate.pageAnchor;
  const item = textbookCorpusItem(figureCandidate, textTarget, new Set(['synthetic-section']), new Set()) as CorpusItem;
  assert(item.citationState === 'limited', 'address kind mismatch must produce a limited artifact');
  assert(item.limitationState.includes('address-kind-mismatch'), 'address kind mismatch limitation must be explicit');
  assert(item.citationAddress.kind === 'image', 'limited kind mismatch must preserve candidate image address kind');
  assert(item.citationAddress.sourceRefId === figureCandidate.pageAnchor, 'limited kind mismatch must preserve candidate source ref');
  assert(item.citationAddress.href === null, 'kind mismatch CitationAddress must not be hydratable');
  assert(item.citationChip.displayHref === null, 'kind mismatch CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'address-kind-mismatch', 'kind mismatch CitationChip must use the standard reason');
}

function assertSpanMismatchDowngradesToLimited() {
  const target = syntheticTarget();
  target.address.sourceRefId = 'different-source-ref';
  target.address.locator = 'different-locator';
  const candidate = syntheticCandidate();
  const item = textbookCorpusItem(candidate, target, new Set(['synthetic-section']), new Set()) as CorpusItem;
  assert(item.citationState === 'limited', 'span mismatch must produce a limited artifact');
  assert(item.limitationState.includes('span-ref-mismatch'), 'span mismatch limitation must be explicit');
  assert(item.citationAddress.sourceRefId === candidate.documentId, 'limited span mismatch must preserve candidate source ref');
  assert(item.citationAddress.href === null, 'span mismatch CitationAddress must not be hydratable');
  assert(item.citationChip.displayHref === null, 'span mismatch CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'span-ref-mismatch', 'span mismatch CitationChip must use the standard reason');
}

function assertFigureSpanMismatchDowngradesToLimited() {
  const figureCandidate = {
    ...syntheticCandidate(),
    kind: 'figure',
    candidateId: 'textbook-figure:synthetic-book:synthetic-section:fig-004',
    documentId: 'fig-004__figure',
    pageAnchor: 'fig-004',
  };
  const target = syntheticTarget();
  target.candidateId = figureCandidate.candidateId;
  target.documentId = figureCandidate.documentId;
  target.address.kind = 'image';
  target.address.sourceRefId = 'different-figure';
  target.address.locator = 'different-figure';
  const item = textbookCorpusItem(figureCandidate, target, new Set(['synthetic-section']), new Set()) as CorpusItem;
  assert(item.citationState === 'limited', 'figure span mismatch must produce a limited artifact');
  assert(item.limitationState.includes('span-ref-mismatch'), 'figure span mismatch limitation must be explicit');
  assert(item.citationAddress.kind === 'image', 'limited figure span mismatch must preserve image address kind');
  assert(item.citationAddress.sourceRefId === figureCandidate.pageAnchor, 'limited figure span mismatch must preserve candidate figure anchor');
  assert(item.citationAddress.href === null, 'figure span mismatch CitationAddress must not be hydratable');
  assert(item.citationChip.displayHref === null, 'figure span mismatch CitationChip must not be clickable');
  assert(item.citationChip.limitationState === 'span-ref-mismatch', 'figure span mismatch CitationChip must use the standard reason');
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
  const targetFileHash = hashRuntimeHref(href) ?? `sha256:${'f'.repeat(64)}`;
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
    targetFileHash,
    sourceVersionRefs: { groundingVersion: 'textbook-media-grounding.v1' },
    pathEligibility: { eligible: false, reason: 'synthetic' },
  };
}

function hashRuntimeHref(href: string): string | null {
  if (!href.startsWith('/course-runtime/')) return null;
  const relativePath = href.split('#')[0].replace(/^\/course-runtime\//, '');
  const absolutePath = path.join(process.cwd(), 'course-content/runtime', relativePath);
  try {
    return `sha256:${createHash('sha256').update(readFileSync(absolutePath)).digest('hex')}`;
  } catch {
    return null;
  }
}
