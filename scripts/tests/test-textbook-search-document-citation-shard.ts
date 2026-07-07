import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ReviewItem {
  reviewBatchId: string;
  reviewerId: string;
  reviewedAt: string;
  resourceId: string;
  documentId: string;
  parentSectionId: string;
  parentSectionResourceId: string;
  parentReviewRef: string;
  title: string;
  classification: string;
  citationTargetId: string;
  retrievalChunkId: string;
  citationAddress: { kind: string; href: string; locator: string; contentHash: string };
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  authority: string;
  privacyScope: string;
  sourceHash: string;
  sourceVersionRef: string;
  limitationState: string[];
  citationBoundaryState: string;
  parentSectionPlanningState: string;
  pathEligible: boolean;
  promotedAsPathNode: boolean;
  rawContentIncluded: boolean;
  reviewerVisibleRationale: string;
}

interface WorkqueueItem {
  resourceId: string;
  documentId: string;
  parentSectionId: string;
  selectedForReview: boolean;
  reviewState: string;
  deterministicShardId: string;
  sourceWorkqueueRowCount: number;
  blockerCodes: string[];
  citationTargetId: string;
  retrievalChunkId: string;
  rawContentIncluded: boolean;
}

interface AuditRow {
  resourceId: string;
  sourceHash: string | null;
  reviewStatus: string;
  missingFieldCodes: string[];
  groundingEligibility: { citationReady: boolean };
  pathEligibility: { current: boolean; blockedBy: string[] };
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  reviewAudit: {
    reviewBatchId: string | null;
    reviewerId: string | null;
    reviewerRole: string | null;
    independentEvidenceRef: string | null;
    reviewerVisibleRationale: string | null;
  };
}

interface SourceWorkqueueRow {
  resourceId: string;
  missingFieldCode: string;
  currentBlockers?: string[];
}

interface CitationTarget {
  documentId: string;
  citationTargetId: string;
  retrievalChunkId: string;
  contentHash: string;
  address: { href: string; contentHash: string };
  pathEligibility?: { eligible: boolean };
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const REVIEW_BATCH_ID = 'textbook-search-document-citation-shard-2026-07-07';
const SHARD_ID = 'parent-section:ch05-sec21:frequency-margin-search-documents';
const PARENT_SECTION_ID = 'ch05-sec21';
const PARENT_RESOURCE_ID = 'textbook-section:hu-shousong-exercise-analysis-3rd:ch05-sec21';
const EXPECTED_KNOWLEDGE_REFS = new Set(['截止频率_5_c7d09ff7', '相角裕度_5_5a74b451', '频率特性_5_404adfdd']);
const EXPECTED_IDS = Array.from({ length: 15 }, (_, index) =>
  `textbook-search-document:ch05-sec21__chunk-${String(index + 1).padStart(3, '0')}`
);

const workqueueItems = readJsonl<WorkqueueItem>('textbook-search-document-citation-shard-workqueue-items.jsonl');
const reviewItems = readJsonl<ReviewItem>('textbook-search-document-citation-shard-review-items.jsonl');
const auditRows = readJsonl<AuditRow>('resource-field-completion-audit.jsonl');
const sourceWorkqueueRows = readJsonl<SourceWorkqueueRow>('resource-completion-workqueue-items.jsonl');
const citationTargets = readJsonl<CitationTarget>('textbook-section-citation-targets.jsonl');
const summary = readJson('textbook-search-document-citation-shard-summary.json') as any;
const evidence = readText('textbook-search-document-citation-shard-evidence.md');

assert(setEquals(new Set(workqueueItems.map((item) => item.resourceId)), new Set(EXPECTED_IDS)), 'workqueue shard must select the deterministic ch05-sec21 chunks');
assert(setEquals(new Set(reviewItems.map((item) => item.resourceId)), new Set(EXPECTED_IDS)), 'review shard must match selected rows exactly');
assert(workqueueItems.length === 15, 'expected 15 scoped workqueue rows');
assert(reviewItems.length === 15, 'expected 15 reviewed search-document rows');
assert(summary.totals.sourceWorkqueueRows === 3856, 'source workqueue row count must be preserved');
assert(summary.totals.uniqueSearchDocuments === 964, 'unique source document count must be preserved');
assert(summary.totals.selectedRows === 15, 'selected row count mismatch');
assert(summary.totals.reviewedRows === 15, 'reviewed row count mismatch');
assert(summary.totals.selectedSourceWorkqueueRows === 60, 'source blocker row count for selected shard mismatch');
assert(summary.totals.residualUnselectedRows === 949, 'residual unselected count mismatch');
assert(summary.selectedShard.remaining === 0, 'selected shard remaining must be zero');
assert(summary.selectedShard.byClassification['parent-section-evidence-support'] === 1, 'expected one parent-section evidence support row');
assert(summary.selectedShard.byClassification['supporting-citation'] === 14, 'expected fourteen supporting citation rows');
assert(summary.guardrails.rawSearchDocumentsPromotedAsPathNodes === false, 'raw search documents must not be PathNodes');
assert(summary.guardrails.rawContentIncluded === false, 'raw content must not be included');
assert(summary.guardrails.allRowsKeepSectionPlanningBoundary === true, 'section planning boundary must be preserved');

const citationTargetByDocument = new Map(citationTargets.map((target) => [target.documentId, target]));
for (const item of reviewItems) {
  const target = citationTargetByDocument.get(item.documentId);
  assert(target, `${item.documentId} must have a CitationTarget`);
  assert(item.reviewBatchId === REVIEW_BATCH_ID, `${item.resourceId} review batch mismatch`);
  assert(item.reviewerId === 'textbook-search-document-citation-implementing-agent', `${item.resourceId} reviewer mismatch`);
  assert(item.parentSectionId === PARENT_SECTION_ID, `${item.resourceId} parent section mismatch`);
  assert(item.parentSectionResourceId === PARENT_RESOURCE_ID, `${item.resourceId} parent resource mismatch`);
  assert(item.parentReviewRef.startsWith('core-textbook-section-path-role-review-'), `${item.resourceId} must reference parent section review`);
  assert(item.title.length > 0, `${item.resourceId} title must be present`);
  assert(item.citationTargetId === target.citationTargetId, `${item.resourceId} citation target mismatch`);
  assert(item.retrievalChunkId === target.retrievalChunkId, `${item.resourceId} retrieval chunk mismatch`);
  assert(item.citationAddress.href === target.address.href, `${item.resourceId} citation href mismatch`);
  assert(item.citationAddress.contentHash === target.contentHash, `${item.resourceId} citation hash mismatch`);
  assert(item.sourceHash === target.contentHash, `${item.resourceId} source hash must match CitationTarget hash`);
  assert(item.graphNodeRefs.knowledge.length > 0, `${item.resourceId} knowledge refs required`);
  assert(setEquals(new Set(item.learningGoalIds), new Set(['controlModeling', 'diagnosticAssessment'])), `${item.resourceId} learning goals mismatch`);
  assert(item.privacyScope === 'student-visible', `${item.resourceId} privacy scope mismatch`);
  assert(item.sourceVersionRef === 'textbook-runtime-search-documents.v1', `${item.resourceId} source version mismatch`);
  assert(item.citationBoundaryState === 'raw-search-document-remains-supporting-citation', `${item.resourceId} citation boundary mismatch`);
  assert(item.parentSectionPlanningState === 'parent-section-owns-planning-role', `${item.resourceId} parent planning state mismatch`);
  assert(item.pathEligible === false && item.promotedAsPathNode === false, `${item.resourceId} must stay out of path planning`);
  assert(item.rawContentIncluded === false, `${item.resourceId} must not include raw content`);
  assert(item.reviewerVisibleRationale.includes(item.documentId) || item.resourceId.endsWith('chunk-001'), `${item.resourceId} needs row-specific rationale`);
}
const first = reviewItems.find((item) => item.resourceId.endsWith('chunk-001'));
assert(first?.classification === 'parent-section-evidence-support', 'chunk-001 must support the parent section evidence');
assert(reviewItems.filter((item) => !item.resourceId.endsWith('chunk-001')).every((item) =>
  item.classification === 'supporting-citation' &&
  item.limitationState.includes('raw-search-document-not-path-node')
), 'non-first chunks must remain supporting citations outside PathNode promotion');
assert(new Set(reviewItems.map((item) => item.reviewerVisibleRationale)).size === reviewItems.length, 'each reviewed row must have an explicit per-row rationale');

for (const item of workqueueItems) {
  assert(item.selectedForReview === true, `${item.resourceId} must be selected for review`);
  assert(item.reviewState === 'reviewed', `${item.resourceId} must be reviewed`);
  assert(item.deterministicShardId === SHARD_ID, `${item.resourceId} shard id mismatch`);
  assert(item.sourceWorkqueueRowCount === 4, `${item.resourceId} must preserve original blocker row count`);
  assert(item.blockerCodes.includes('missing-human-review'), `${item.resourceId} must show original review blocker`);
  assert(item.rawContentIncluded === false, `${item.resourceId} workqueue item must not include raw content`);
}

const selectedAuditRows = auditRows.filter((row) => EXPECTED_IDS.includes(row.resourceId));
assert(selectedAuditRows.length === 15, 'selected audit rows missing');
const reviewByResourceId = new Map(reviewItems.map((item) => [item.resourceId, item]));
for (const row of selectedAuditRows) {
  const review = reviewByResourceId.get(row.resourceId);
  assert(review, `${row.resourceId} review item missing`);
  assert(row.reviewStatus === 'human-confirmed', `${row.resourceId} audit review status mismatch`);
  assert(row.sourceHash === review.sourceHash, `${row.resourceId} audit source hash must match review hash`);
  assert(!row.missingFieldCodes.includes('missing-human-review'), `${row.resourceId} must close the review blocker`);
  assert(row.missingFieldCodes.every((code) => ['missing-path-profile', 'missing-path-target'].includes(code)), `${row.resourceId} should only retain path readiness blockers`);
  assert(row.groundingEligibility.citationReady === true, `${row.resourceId} must remain citation-ready`);
  assert(row.pathEligibility.current === false, `${row.resourceId} must not be path eligible`);
  assert(row.pathEligibility.blockedBy.includes('missing-path-target'), `${row.resourceId} must retain path target blocker`);
  assert(row.pathEligibility.blockedBy.includes('missing-path-profile'), `${row.resourceId} must retain path profile blocker`);
  assert(row.reviewAudit.reviewBatchId === REVIEW_BATCH_ID, `${row.resourceId} audit batch mismatch`);
  assert(row.reviewAudit.reviewerRole === 'curriculum-data-governance', `${row.resourceId} reviewer role mismatch`);
  assert(row.reviewAudit.independentEvidenceRef?.includes('textbook-search-document-citation-shard-review-items.jsonl'), `${row.resourceId} evidence ref mismatch`);
  assert(setEquals(new Set(row.graphNodeRefs.knowledge), new Set(review.graphNodeRefs.knowledge)), `${row.resourceId} audit knowledge refs must come from review artifact`);
  assert(setEquals(new Set(row.graphNodeRefs.capability), new Set(review.graphNodeRefs.capability)), `${row.resourceId} audit capability refs must come from review artifact`);
  assert(setEquals(new Set(row.graphNodeRefs.quality), new Set(review.graphNodeRefs.quality)), `${row.resourceId} audit quality refs must come from review artifact`);
  assert(setEquals(new Set(row.graphNodeRefs.knowledge), EXPECTED_KNOWLEDGE_REFS), `${row.resourceId} audit knowledge refs must match reviewed parent section`);
}

const selectedSourceRows = sourceWorkqueueRows.filter((row) => EXPECTED_IDS.includes(row.resourceId));
assert(selectedSourceRows.length === 30, 'selected source workqueue rows must now retain only two path blockers each');
assert(selectedSourceRows.every((row) => !row.currentBlockers?.includes('missing-human-review')), 'current workqueue blockers must not include missing review');
assert(setEquals(new Set(selectedSourceRows.map((row) => row.missingFieldCode)), new Set(['missing-path-profile', 'missing-path-target'])), 'current workqueue rows should only retain path blockers');
assert(evidence.includes('Raw search documents promoted as PathNodes: false'), 'evidence must state non-promotion guardrail');
assert(evidence.includes('Residual unselected rows: 949'), 'evidence must record residual unselected count');

console.log('Textbook search-document citation shard artifacts verified.');

function readJsonl<T>(filename: string): T[] {
  return readText(filename).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

function readJson(filename: string) {
  return JSON.parse(readText(filename));
}

function readText(filename: string) {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function setEquals<T>(left: Set<T>, right: Set<T>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}
