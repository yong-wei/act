import { promises as fs } from 'node:fs';
import path from 'node:path';

type Classification = 'parent-section-evidence-support' | 'supporting-citation';

interface WorkqueueItem {
  sourceFamily: string;
  learningGoalId?: string;
  graphDomain: string;
  missingFieldCode: string;
  followupBucket: string;
  dependencyState: string;
  queueRole: string;
  resourceId: string;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string;
  learningGoalIds?: string[];
  currentBlockers?: string[];
  sourceHash?: string | null;
  sourceVersionRef?: string | null;
  rawContentIncluded?: boolean;
}

interface CitationTarget {
  citationTargetId: string;
  retrievalChunkId: string;
  candidateId: string;
  documentId: string;
  address: {
    kind: string;
    sourceRefId: string;
    href: string;
    locator: string;
    contentHash: string;
  };
  contentHash: string;
  targetFileHash: string;
  pathEligibility: { eligible: boolean; reason: string };
}

interface SectionReviewItem {
  reviewBatchId: string;
  reviewerId: string;
  reviewedAt: string;
  resourceId: string;
  sectionId: string;
  pathRole: string;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
}

interface ScopedWorkqueueItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  resourceId: string;
  documentId: string;
  title: string;
  parentSectionId: typeof SELECTED_PARENT_SECTION_ID;
  selectedForReview: true;
  reviewState: 'reviewed';
  deterministicShardId: typeof SELECTED_SHARD_ID;
  sourceWorkqueueRowCount: number;
  blockerCodes: string[];
  learningGoalIds: string[];
  sourcePathOrUrl: string | null;
  sourceHash: string | null;
  sourceVersionRef: string | null;
  citationTargetId: string;
  retrievalChunkId: string;
  rawContentIncluded: false;
}

interface ReviewItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  reviewBatchId: typeof REVIEW_BATCH_ID;
  reviewerId: typeof REVIEWER_ID;
  reviewedAt: string;
  resourceId: string;
  documentId: string;
  parentSectionId: typeof SELECTED_PARENT_SECTION_ID;
  parentSectionResourceId: typeof SELECTED_PARENT_RESOURCE_ID;
  parentReviewRef: string;
  title: string;
  classification: Classification;
  citationTargetId: string;
  retrievalChunkId: string;
  citationAddress: {
    kind: string;
    href: string;
    locator: string;
    contentHash: string;
  };
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  authority: 'reviewed-parent-section' | 'reviewed-citation-support';
  privacyScope: 'student-visible';
  sourceHash: string;
  sourceVersionRef: string;
  limitationState: string[];
  citationBoundaryState: 'raw-search-document-remains-supporting-citation';
  parentSectionPlanningState: 'parent-section-owns-planning-role';
  pathEligible: false;
  promotedAsPathNode: false;
  rawContentIncluded: false;
  reviewerVisibleRationale: string;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const WORKQUEUE_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'resource-completion-workqueue-items.jsonl');
const CITATION_TARGETS_PATH = path.join(GOVERNANCE_DIR, 'textbook-section-citation-targets.jsonl');
const SECTION_REVIEW_PATH = path.join(GOVERNANCE_DIR, 'core-textbook-section-path-role-review-items.jsonl');
const SHARD_WORKQUEUE_PATH = path.join(GOVERNANCE_DIR, 'textbook-search-document-citation-shard-workqueue-items.jsonl');
const REVIEW_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'textbook-search-document-citation-shard-review-items.jsonl');
const SUMMARY_PATH = path.join(GOVERNANCE_DIR, 'textbook-search-document-citation-shard-summary.json');
const EVIDENCE_PATH = path.join(GOVERNANCE_DIR, 'textbook-search-document-citation-shard-evidence.md');

const ARTIFACT_VERSION = 'textbook-search-document-citation-shard.v1' as const;
const REVIEW_BATCH_ID = 'textbook-search-document-citation-shard-2026-07-07' as const;
const REVIEWER_ID = 'textbook-search-document-citation-implementing-agent' as const;
const GENERATED_AT = process.env.TEXTBOOK_SEARCH_DOCUMENT_CITATION_SHARD_GENERATED_AT ?? '2026-07-07T03:30:00.000Z';
const SELECTED_PARENT_SECTION_ID = 'ch05-sec21' as const;
const SELECTED_PARENT_RESOURCE_ID = 'textbook-section:hu-shousong-exercise-analysis-3rd:ch05-sec21' as const;
const SELECTED_SHARD_ID = 'parent-section:ch05-sec21:frequency-margin-search-documents' as const;
const EXPECTED_SELECTED_IDS = Array.from({ length: 15 }, (_, index) =>
  `textbook-search-document:${SELECTED_PARENT_SECTION_ID}__chunk-${String(index + 1).padStart(3, '0')}`
);
const BASELINE_BLOCKER_CODES = [
  'missing-evidence-contract',
  'missing-human-review',
  'missing-path-profile',
  'missing-path-target',
] as const;

const SEMANTIC_DECISIONS: Record<string, { classification: Classification; limitationState: string[]; rationale: string }> = {
  'textbook-search-document:ch05-sec21__chunk-001': {
    classification: 'parent-section-evidence-support',
    limitationState: ['raw-search-document-not-path-node'],
    rationale: 'ch05-sec21__chunk-001 carries the 5-21 open-loop transfer-function setup and phase-margin derivation anchor, so it supports the reviewed parent section on crossover frequency and phase margin while the parent section keeps the PlanningUnit role.',
  },
  'textbook-search-document:ch05-sec21__chunk-002': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'derivation-continuation-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-002 continues the phase-margin formula and crossover calculation from 5-21, making it citation support for the reviewed parent section rather than an independent section-level PlanningUnit.',
  },
  'textbook-search-document:ch05-sec21__chunk-003': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'matlab-validation-continuation-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-003 records MATLAB validation for the frequency-response example, so it is useful as a verification citation while remaining subordinate to the reviewed frequency-margin parent section.',
  },
  'textbook-search-document:ch05-sec21__chunk-004': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'bode-figure-anchor-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-004 is a Bode-plot figure anchor for an open-loop frequency-response example, so it can ground figure citation but does not own independent path-planning metadata.',
  },
  'textbook-search-document:ch05-sec21__chunk-005': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'bode-figure-anchor-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-005 is another Bode-plot figure anchor in the same reviewed section window, so it remains supporting citation material tied to the parent frequency-response section.',
  },
  'textbook-search-document:ch05-sec21__chunk-006': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'matlab-command-continuation-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-006 contains MATLAB command construction for frequency-response comparisons, making it implementation evidence for citations rather than a standalone PlanningUnit.',
  },
  'textbook-search-document:ch05-sec21__chunk-007': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'frequency-component-table-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-007 summarizes logarithmic magnitude and phase contributions in table form, so it supports frequency-response rationale but remains under the reviewed parent section.',
  },
  'textbook-search-document:ch05-sec21__chunk-008': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'application-figure-anchor-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-008 is an oil-tanker heading-control Bode-plot anchor, useful for application citation while still lacking independent path target and profile metadata.',
  },
  'textbook-search-document:ch05-sec21__chunk-009': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'closed-loop-transfer-continuation-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-009 gives a closed-loop transfer-function relation for a later frequency-response example, so it is supporting citation material within the same reviewed export window.',
  },
  'textbook-search-document:ch05-sec21__chunk-010': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'bode-figure-anchor-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-010 is a frequency-response Bode figure anchor for the later example sequence, so it may be cited but must not become a separate PathNode.',
  },
  'textbook-search-document:ch05-sec21__chunk-011': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'typical-element-table-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-011 contains a typical-elements frequency table, which supports graph and citation context but remains a raw search-document row under the parent section.',
  },
  'textbook-search-document:ch05-sec21__chunk-012': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'robot-application-figure-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-012 anchors a walking-robot application figure, so it is application citation support and not independent planning content.',
  },
  'textbook-search-document:ch05-sec21__chunk-013': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'bode-figure-anchor-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-013 is a Bode-plot anchor for an application frequency-response example, keeping citation value while deferring path planning to the reviewed parent section.',
  },
  'textbook-search-document:ch05-sec21__chunk-014': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'anesthesia-control-diagram-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-014 anchors an automatic anesthesia control block diagram, so it supports application citation but lacks independent path-planning eligibility.',
  },
  'textbook-search-document:ch05-sec21__chunk-015': {
    classification: 'supporting-citation',
    limitationState: ['raw-search-document-not-path-node', 'closed-loop-bode-figure-under-reviewed-section'],
    rationale: 'ch05-sec21__chunk-015 anchors the anesthesia-control closed-loop Bode plot, making it reviewed citation support that must stay outside PathNode promotion.',
  },
};

async function main() {
  const sourceRows = (await readJsonl<WorkqueueItem>(WORKQUEUE_ITEMS_PATH))
    .filter((row) => row.sourceFamily === 'textbook-search-document');
  const groupedRows = groupBy(sourceRows, (row) => row.resourceId);
  const citationTargets = new Map((await readJsonl<CitationTarget>(CITATION_TARGETS_PATH))
    .map((target) => [target.documentId, target]));
  const parentReview = (await readJsonl<SectionReviewItem>(SECTION_REVIEW_PATH))
    .find((item) => item.resourceId === SELECTED_PARENT_RESOURCE_ID);
  if (!parentReview) throw new Error(`Missing parent section review for ${SELECTED_PARENT_RESOURCE_ID}`);

  const matchedSelectedIds = Array.from(groupedRows.keys())
    .filter((resourceId) => resourceId.startsWith(`textbook-search-document:${SELECTED_PARENT_SECTION_ID}__`))
    .sort((left, right) => left.localeCompare(right));
  if (!setEquals(new Set(matchedSelectedIds), new Set(EXPECTED_SELECTED_IDS))) {
    throw new Error(`Search-document shard drift for ${SELECTED_PARENT_SECTION_ID}: expected ${EXPECTED_SELECTED_IDS.length} ids, got ${matchedSelectedIds.length}`);
  }
  const selectedEntries = EXPECTED_SELECTED_IDS.map((resourceId) => {
    const rows = groupedRows.get(resourceId);
    if (!rows?.length) throw new Error(`Missing workqueue rows for ${resourceId}`);
    return [resourceId, rows] as const;
  });

  const scopedItems = selectedEntries.map(([resourceId, rows]) =>
    scopedWorkqueueItem(resourceId, rows, citationTargets)
  );
  const reviewItems = scopedItems.map((item) => reviewItemFor(item, parentReview));
  const restoredSelectedSourceRows = sum(selectedEntries, ([, rows]) =>
    Math.max(0, BASELINE_BLOCKER_CODES.length - rows.length)
  );
  const summary = buildSummary({
    uniqueSearchDocuments: groupedRows.size,
    sourceWorkqueueRows: sourceRows.length + restoredSelectedSourceRows,
    selectedRows: scopedItems,
    reviewItems,
  });

  await writeJsonl(SHARD_WORKQUEUE_PATH, scopedItems);
  await writeJsonl(REVIEW_ITEMS_PATH, reviewItems);
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await fs.writeFile(EVIDENCE_PATH, renderEvidence(summary, reviewItems), 'utf8');

  console.log(`Textbook search-document rows: ${summary.totals.uniqueSearchDocuments}`);
  console.log(`Selected shard rows: ${summary.totals.selectedRows}`);
  console.log(`Reviewed shard rows: ${summary.totals.reviewedRows}`);
  console.log(`Residual unselected rows: ${summary.totals.residualUnselectedRows}`);
}

function scopedWorkqueueItem(
  resourceId: string,
  rows: WorkqueueItem[],
  citationTargets: Map<string, CitationTarget>,
): ScopedWorkqueueItem {
  const documentId = resourceId.replace('textbook-search-document:', '');
  const target = citationTargets.get(documentId);
  if (!target) throw new Error(`Missing citation target for ${resourceId}`);
  const first = rows[0];
  return {
    artifactVersion: ARTIFACT_VERSION,
    resourceId,
    documentId,
    title: first?.title ?? documentId,
    parentSectionId: SELECTED_PARENT_SECTION_ID,
    selectedForReview: true,
    reviewState: 'reviewed',
    deterministicShardId: SELECTED_SHARD_ID,
    sourceWorkqueueRowCount: Math.max(rows.length, BASELINE_BLOCKER_CODES.length),
    blockerCodes: uniqueSorted([
      ...BASELINE_BLOCKER_CODES,
      ...rows.flatMap((row) => [row.missingFieldCode, ...(row.currentBlockers ?? [])]),
    ]),
    learningGoalIds: uniqueSorted(rows.flatMap((row) => row.learningGoalIds ?? [row.learningGoalId ?? ''])),
    sourcePathOrUrl: first?.sourcePathOrUrl ?? target.address.href,
    sourceHash: first?.sourceHash ?? target.contentHash,
    sourceVersionRef: first?.sourceVersionRef ?? 'textbook-runtime-search-documents.v1',
    citationTargetId: target.citationTargetId,
    retrievalChunkId: target.retrievalChunkId,
    rawContentIncluded: false,
  };
}

function reviewItemFor(item: ScopedWorkqueueItem, parentReview: SectionReviewItem): ReviewItem {
  const targetDecision = SEMANTIC_DECISIONS[item.resourceId] ?? {
    classification: 'supporting-citation' as const,
    limitationState: ['raw-search-document-not-path-node', 'cross-exercise-continuation-under-reviewed-section'],
    rationale: `${item.documentId} is a citation-ready search-document row in the reviewed ${SELECTED_PARENT_SECTION_ID} export window, but its content continues later frequency-response examples rather than owning an independent section-level PlanningUnit.`,
  };
  return {
    artifactVersion: ARTIFACT_VERSION,
    reviewBatchId: REVIEW_BATCH_ID,
    reviewerId: REVIEWER_ID,
    reviewedAt: GENERATED_AT,
    resourceId: item.resourceId,
    documentId: item.documentId,
    parentSectionId: SELECTED_PARENT_SECTION_ID,
    parentSectionResourceId: SELECTED_PARENT_RESOURCE_ID,
    parentReviewRef: `${parentReview.reviewBatchId}:${parentReview.resourceId}`,
    title: item.title,
    classification: targetDecision.classification,
    citationTargetId: item.citationTargetId,
    retrievalChunkId: item.retrievalChunkId,
    citationAddress: {
      kind: 'text',
      href: item.sourcePathOrUrl ?? '',
      locator: item.documentId,
      contentHash: item.sourceHash ?? '',
    },
    graphNodeRefs: parentReview.graphNodeRefs,
    learningGoalIds: parentReview.learningGoalIds,
    authority: targetDecision.classification === 'parent-section-evidence-support'
      ? 'reviewed-parent-section'
      : 'reviewed-citation-support',
    privacyScope: 'student-visible',
    sourceHash: item.sourceHash ?? '',
    sourceVersionRef: item.sourceVersionRef ?? 'textbook-runtime-search-documents.v1',
    limitationState: uniqueSorted(targetDecision.limitationState),
    citationBoundaryState: 'raw-search-document-remains-supporting-citation',
    parentSectionPlanningState: 'parent-section-owns-planning-role',
    pathEligible: false,
    promotedAsPathNode: false,
    rawContentIncluded: false,
    reviewerVisibleRationale: targetDecision.rationale,
  };
}

function buildSummary(input: {
  uniqueSearchDocuments: number;
  sourceWorkqueueRows: number;
  selectedRows: ScopedWorkqueueItem[];
  reviewItems: ReviewItem[];
}) {
  const selectedIds = input.selectedRows.map((item) => item.resourceId);
  return {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: GENERATED_AT,
    reviewBatchId: REVIEW_BATCH_ID,
    selectedShardId: SELECTED_SHARD_ID,
    selectionBasis: 'All textbook-search-document rows whose deterministic parent section is the already reviewed ch05-sec21 frequency-margin section.',
    parentSection: {
      sectionId: SELECTED_PARENT_SECTION_ID,
      resourceId: SELECTED_PARENT_RESOURCE_ID,
      parentOwnsPlanningRole: true,
    },
    totals: {
      sourceWorkqueueRows: input.sourceWorkqueueRows,
      uniqueSearchDocuments: input.uniqueSearchDocuments,
      selectedRows: input.selectedRows.length,
      reviewedRows: input.reviewItems.length,
      selectedSourceWorkqueueRows: sum(input.selectedRows, (item) => item.sourceWorkqueueRowCount),
      residualUnselectedRows: input.uniqueSearchDocuments - input.selectedRows.length,
    },
    selectedShard: {
      selectedIds,
      reviewedIds: input.reviewItems.map((item) => item.resourceId),
      remaining: input.selectedRows.length - input.reviewItems.length,
      byClassification: countBy(input.reviewItems, (item) => item.classification),
      byLearningGoal: countBy(input.reviewItems.flatMap((item) => item.learningGoalIds), (item) => item),
      byBlocker: countBy(input.selectedRows.flatMap((item) => item.blockerCodes), (item) => item),
      byLimitationState: countBy(input.reviewItems.flatMap((item) => item.limitationState), (item) => item),
    },
    guardrails: {
      selectedRowsHaveCitationTargets: input.reviewItems.every((item) => Boolean(item.citationTargetId && item.citationAddress.href && item.sourceHash)),
      selectedRowsHaveParentReview: input.reviewItems.every((item) => item.parentReviewRef.length > 0),
      rawSearchDocumentsPromotedAsPathNodes: input.reviewItems.some((item) => item.promotedAsPathNode),
      rawContentIncluded: input.reviewItems.some((item) => item.rawContentIncluded),
      allRowsKeepSectionPlanningBoundary: input.reviewItems.every((item) =>
        item.citationBoundaryState === 'raw-search-document-remains-supporting-citation' &&
        item.parentSectionPlanningState === 'parent-section-owns-planning-role' &&
        item.pathEligible === false
      ),
      everyRowHasRationale: input.reviewItems.every((item) => item.reviewerVisibleRationale.length > 0),
    },
  };
}

function renderEvidence(summary: ReturnType<typeof buildSummary>, reviewItems: ReviewItem[]) {
  const rows = reviewItems.map((item) => `| ${[
    item.resourceId,
    item.classification,
    item.citationTargetId,
    item.limitationState.join(', '),
    item.promotedAsPathNode,
  ].join(' | ')} |`);
  return [
    '# Textbook Search-Document Citation Shard Evidence',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Review batch: ${summary.reviewBatchId}`,
    `Selected shard: ${summary.selectedShardId}`,
    `Parent section: ${summary.parentSection.resourceId}`,
    '',
    `Unique search documents: ${summary.totals.uniqueSearchDocuments}`,
    `Selected rows: ${summary.totals.selectedRows}`,
    `Reviewed rows: ${summary.totals.reviewedRows}`,
    `Selected remaining: ${summary.selectedShard.remaining}`,
    `Residual unselected rows: ${summary.totals.residualUnselectedRows}`,
    '',
    '## Guardrails',
    '',
    `- Selected rows have citation targets: ${summary.guardrails.selectedRowsHaveCitationTargets}`,
    `- Selected rows have parent review: ${summary.guardrails.selectedRowsHaveParentReview}`,
    `- Raw search documents promoted as PathNodes: ${summary.guardrails.rawSearchDocumentsPromotedAsPathNodes}`,
    `- Raw content included: ${summary.guardrails.rawContentIncluded}`,
    `- Section planning boundary preserved: ${summary.guardrails.allRowsKeepSectionPlanningBoundary}`,
    '',
    '## Reviewed Search-Document Rows',
    '',
    '| Resource | Classification | Citation target | Limitation state | Promoted as PathNode |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await fs.readFile(filePath, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function writeJsonl(filePath: string, rows: unknown[]) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    const current = map.get(key) ?? [];
    current.push(row);
    map.set(key, current);
  }
  return map;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) => left.localeCompare(right));
}

function countBy<T>(values: T[], keyFor: (value: T) => string): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = keyFor(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function sum<T>(values: T[], valueFor: (value: T) => number) {
  return values.reduce((total, value) => total + valueFor(value), 0);
}

function setEquals<T>(left: Set<T>, right: Set<T>) {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
