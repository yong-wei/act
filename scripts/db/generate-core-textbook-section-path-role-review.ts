import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type Disposition = 'path-planning-section' | 'supporting-citation';
type PathRole = 'path-plannable' | 'remediation-practice' | 'extension-path';
type PrerequisitePosition = 'core-after-modeling' | 'core-after-frequency-response' | 'advanced-after-state-space';

interface WorkqueueItem {
  resourceId: string;
  sourceFamily: string;
  learningGoalId?: string;
  missingFieldCode: string;
  followupBucket: string;
  dependencyState: string;
  queueRole: string;
  title: string;
  sourcePathOrUrl: string | null;
  sourceRecord: string;
  learningGoalIds?: string[];
  currentBlockers?: string[];
  sourceHash?: string | null;
  sourceVersionRef?: string | null;
  rawContentIncluded?: boolean;
}

interface SectionIndexRow {
  id: string;
  bookId: string;
  title: string;
  kind: string;
  chapterId: string;
  chapterNumber: number;
  pathPlanning: {
    nodeType: string;
    pathEligible: boolean;
    estimatedTimeMinutes: number;
    knowledgeNodeIds: string[];
    capabilityTargetRefs: string[];
  };
  sourceSpan: { startLine: number; endLine: number };
  contentHash: string;
  href: string;
  figureIds?: string[];
}

interface GroundingCandidate {
  candidateId: string;
  kind: string;
  sectionId: string;
  pathEligible: boolean;
}

interface CitationTarget {
  candidateId: string;
  targetFileHash: string;
  pathEligibility?: { eligible: boolean; reason?: string };
}

interface ScopedWorkqueueItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  resourceId: string;
  bookId: string;
  sectionId: string;
  chapterId: string;
  chapterNumber: number;
  title: string;
  deterministicShardId: typeof SELECTED_SHARD_ID | 'dependency:blocked-by-dependency';
  selectedForReview: boolean;
  reviewState: 'reviewed' | 'residual-handoff';
  dependencyStates: string[];
  queueRoles: string[];
  blockerCodes: string[];
  learningGoalIds: string[];
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  graphBindingState: 'reviewed' | 'needs-graph-node';
  sourcePathOrUrl: string | null;
  sourceHash: string | null;
  runtimeFileHash: string | null;
  sourceVersionRef: string | null;
  estimatedTimeMinutes: number;
  pathEligibleInIndex: boolean;
  supportingAnchorCandidateCount: number;
  supportingCitationTargetCount: number;
  sourceWorkqueueRowCount: number;
  rawContentIncluded: false;
}

interface ReviewItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  reviewBatchId: typeof REVIEW_BATCH_ID;
  reviewerId: typeof REVIEWER_ID;
  reviewedAt: string;
  resourceId: string;
  bookId: string;
  sectionId: string;
  title: string;
  disposition: Disposition;
  pathRole: PathRole;
  prerequisitePosition: PrerequisitePosition;
  citationAddress: {
    href: string;
    sourceSpan: { startLine: number; endLine: number };
    sourceHash: string;
  };
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  estimatedTimeMinutes: number;
  authority: 'reviewed-section';
  privacyScope: 'student-visible';
  sourceHash: string;
  runtimeFileHash: string | null;
  sourceVersionRef: string;
  supportingAnchorCandidateCount: number;
  supportingCitationTargetCount: number;
  chunkBoundaryState: 'chunks-remain-supporting-citation';
  promotedAsPathNode: boolean;
  independentPathMetadataComplete: boolean;
  limitationState: string[];
  rawContentIncluded: false;
  reviewerVisibleRationale: string;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const SECTION_INDEX_PATH = path.join(
  process.cwd(),
  'course-content/runtime/resources/textbooks/hu-shousong-exercise-analysis-3rd/section-index.jsonl',
);
const WORKQUEUE_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'resource-completion-workqueue-items.jsonl');
const GROUNDING_CANDIDATES_PATH = path.join(GOVERNANCE_DIR, 'textbook-section-grounding-candidates.jsonl');
const CITATION_TARGETS_PATH = path.join(GOVERNANCE_DIR, 'textbook-section-citation-targets.jsonl');
const SCOPED_WORKQUEUE_PATH = path.join(GOVERNANCE_DIR, 'core-textbook-section-path-role-workqueue-items.jsonl');
const SUMMARY_PATH = path.join(GOVERNANCE_DIR, 'core-textbook-section-path-role-workqueue-summary.json');
const REVIEW_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'core-textbook-section-path-role-review-items.jsonl');
const REVIEW_EVIDENCE_PATH = path.join(GOVERNANCE_DIR, 'core-textbook-section-path-role-review-evidence.md');
const ARTIFACT_VERSION = 'core-textbook-section-path-role-review.v1' as const;
const REVIEW_BATCH_ID = 'core-textbook-section-path-role-review-2026-07-05' as const;
const REVIEWER_ID = 'core-textbook-section-review-implementing-agent' as const;
const GENERATED_AT = process.env.CORE_TEXTBOOK_SECTION_REVIEW_GENERATED_AT ?? '2026-07-05T07:15:00.000Z';
const SELECTED_SHARD_ID = 'dependency:needs-human-review' as const;

const SEMANTIC_DECISIONS: Record<string, {
  disposition: Disposition;
  pathRole: PathRole;
  prerequisitePosition: PrerequisitePosition;
  knowledgeNodeIds: string[];
  learningGoalIds: string[];
  capabilityTargetRefs: string[];
  rationale: string;
}> = {
  'ch03-sec11': {
    disposition: 'path-planning-section',
    pathRole: 'remediation-practice',
    prerequisitePosition: 'core-after-modeling',
    knowledgeNodeIds: ['劳斯判据_3_e3500ac9', '劳斯表特殊情况_3_f787433f', '稳定性_3_72d04fbd'],
    learningGoalIds: ['controlModeling', 'diagnosticAssessment'],
    capabilityTargetRefs: ['controlModeling', 'diagnosticAssessment'],
    rationale: 'Routh and Hurwitz stability exercises repair characteristic-equation stability judgement after modeling has been introduced.',
  },
  'ch05-sec04': {
    disposition: 'path-planning-section',
    pathRole: 'path-plannable',
    prerequisitePosition: 'core-after-frequency-response',
    knowledgeNodeIds: ['频率特性_5_404adfdd', '频率响应直觉_5_L2c001'],
    learningGoalIds: ['controlModeling', 'diagnosticAssessment'],
    capabilityTargetRefs: ['controlModeling', 'diagnosticAssessment'],
    rationale: 'Frequency-response parameter identification links sinusoidal steady-state evidence to model parameter reasoning.',
  },
  'ch05-sec21': {
    disposition: 'path-planning-section',
    pathRole: 'remediation-practice',
    prerequisitePosition: 'core-after-frequency-response',
    knowledgeNodeIds: ['相角裕度_5_5a74b451', '截止频率_5_c7d09ff7', '频率特性_5_404adfdd'],
    learningGoalIds: ['controlModeling', 'diagnosticAssessment'],
    capabilityTargetRefs: ['controlModeling', 'diagnosticAssessment'],
    rationale: 'Phase-margin and crossover-frequency exercises remediate margin definitions before controller tuning work.',
  },
  'ch10-sec11': {
    disposition: 'path-planning-section',
    pathRole: 'extension-path',
    prerequisitePosition: 'advanced-after-state-space',
    knowledgeNodeIds: ['哈密顿函数_10_8cd65735', '最优控制_10_65717117'],
    learningGoalIds: ['engineeringDecision', 'parameterDesign'],
    capabilityTargetRefs: ['engineeringDecision', 'parameterDesign'],
    rationale: 'Variational optimal-control derivation uses Hamiltonian construction and boundary conditions, so it is an advanced path section for optimal-control transfer after state-space foundations.',
  },
  'ch10-sec18': {
    disposition: 'path-planning-section',
    pathRole: 'extension-path',
    prerequisitePosition: 'advanced-after-state-space',
    knowledgeNodeIds: ['庞特里亚金原理_10_03d7d109', '极小值原理_10_fa5b8689', '最优控制_10_65717117'],
    learningGoalIds: ['engineeringDecision', 'parameterDesign'],
    capabilityTargetRefs: ['engineeringDecision', 'parameterDesign'],
    rationale: 'Constrained optimal-control example applies Pontryagin/minimum principle to choose the control law, so it is an advanced path section for engineering decision and parameter-design transfer.',
  },
};

async function main() {
  const workqueueRows = (await readJsonl<WorkqueueItem>(WORKQUEUE_ITEMS_PATH))
    .filter((row) => row.sourceFamily === 'textbook-section');
  const sectionIndex = new Map((await readJsonl<SectionIndexRow>(SECTION_INDEX_PATH))
    .filter((row) => row.pathPlanning.nodeType === 'textbook_section')
    .map((row) => [`textbook-section:${row.bookId}:${row.id}`, row]));
  const groundingBySection = groupBy(await readJsonl<GroundingCandidate>(GROUNDING_CANDIDATES_PATH), (row) => row.sectionId);
  const citationTargetsBySection = groupBy(
    await readJsonl<CitationTarget>(CITATION_TARGETS_PATH),
    (row) => sectionIdFromCandidate(row.candidateId),
  );
  const groupedWorkqueue = groupBy(workqueueRows, (row) => row.resourceId);
  const scopedItems = await Promise.all(Array.from(groupedWorkqueue.entries()).map(([resourceId, rows]) =>
    scopedWorkqueueItem(resourceId, rows, sectionIndex, groundingBySection, citationTargetsBySection)
  ));
  const sortedScopedItems = scopedItems.sort(compareByResourceId);
  const reviewItems = sortedScopedItems
    .filter((item) => item.selectedForReview && Boolean(SEMANTIC_DECISIONS[item.sectionId]))
    .map((item) => reviewItemFor(item, sectionIndex.get(item.resourceId)!));
  const summary = buildSummary(sortedScopedItems, reviewItems);

  await writeJsonl(SCOPED_WORKQUEUE_PATH, sortedScopedItems);
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeJsonl(REVIEW_ITEMS_PATH, reviewItems);
  await fs.writeFile(REVIEW_EVIDENCE_PATH, renderEvidence(summary, reviewItems), 'utf8');

  console.log(`Core textbook section rows: ${sortedScopedItems.length}`);
  console.log(`Selected reviewed rows: ${reviewItems.length}`);
  console.log(`Residual handoff section units: ${summary.residualHandoff.blockedByDependencySectionUnits}`);
  console.log(`Residual handoff source rows: ${summary.residualHandoff.blockedByDependencySourceRows}`);
  console.log(`Selected remaining: ${summary.selectedShard.remaining}`);
}

async function scopedWorkqueueItem(
  resourceId: string,
  rows: WorkqueueItem[],
  sectionIndex: Map<string, SectionIndexRow>,
  groundingBySection: Map<string, GroundingCandidate[]>,
  citationTargetsBySection: Map<string, CitationTarget[]>,
): Promise<ScopedWorkqueueItem> {
  const indexRow = sectionIndex.get(resourceId);
  if (!indexRow) throw new Error(`Missing section index row for ${resourceId}`);
  const selectedForReview = rows.some((row) => row.dependencyState === 'needs-human-review');
  const hasReviewDecision = Boolean(SEMANTIC_DECISIONS[indexRow.id]);
  const grounding = groundingBySection.get(indexRow.id) ?? [];
  const citationTargets = citationTargetsBySection.get(indexRow.id) ?? [];

  const decision = SEMANTIC_DECISIONS[indexRow.id];
  const learningGoalIds = decision?.learningGoalIds ?? uniqueSorted(rows.flatMap((row) => row.learningGoalIds ?? [row.learningGoalId ?? '']));
  const knowledgeNodeIds = decision?.knowledgeNodeIds ?? indexRow.pathPlanning.knowledgeNodeIds;
  const capabilityTargetRefs = decision?.capabilityTargetRefs ?? indexRow.pathPlanning.capabilityTargetRefs;

  return {
    artifactVersion: ARTIFACT_VERSION,
    resourceId,
    bookId: indexRow.bookId,
    sectionId: indexRow.id,
    chapterId: indexRow.chapterId,
    chapterNumber: indexRow.chapterNumber,
    title: indexRow.title,
    deterministicShardId: selectedForReview ? SELECTED_SHARD_ID : 'dependency:blocked-by-dependency',
    selectedForReview,
    reviewState: selectedForReview && hasReviewDecision ? 'reviewed' : 'residual-handoff',
    dependencyStates: uniqueSorted(rows.map((row) => row.dependencyState)),
    queueRoles: uniqueSorted(rows.map((row) => row.queueRole)),
    blockerCodes: uniqueSorted(rows.flatMap((row) => [row.missingFieldCode, ...(row.currentBlockers ?? [])])),
    learningGoalIds: uniqueSorted(learningGoalIds),
    graphNodeRefs: {
      knowledge: uniqueSorted(knowledgeNodeIds),
      capability: uniqueSorted(capabilityTargetRefs),
      quality: [],
    },
    graphBindingState: knowledgeNodeIds.length > 0 ? 'reviewed' : 'needs-graph-node',
    sourcePathOrUrl: rows[0]?.sourcePathOrUrl ?? indexRow.href,
    sourceHash: `sha256:${indexRow.contentHash}`,
    runtimeFileHash: await hashProjectFile(indexRow.href),
    sourceVersionRef: rows[0]?.sourceVersionRef ?? 'resource-node-registry.v1',
    estimatedTimeMinutes: indexRow.pathPlanning.estimatedTimeMinutes,
    pathEligibleInIndex: indexRow.pathPlanning.pathEligible,
    supportingAnchorCandidateCount: grounding.length,
    supportingCitationTargetCount: citationTargets.length,
    sourceWorkqueueRowCount: rows.length,
    rawContentIncluded: false,
  };
}

function reviewItemFor(item: ScopedWorkqueueItem, indexRow: SectionIndexRow): ReviewItem {
  const decision = SEMANTIC_DECISIONS[item.sectionId];
  if (!decision) throw new Error(`Missing semantic decision for ${item.resourceId}`);
  return {
    artifactVersion: ARTIFACT_VERSION,
    reviewBatchId: REVIEW_BATCH_ID,
    reviewerId: REVIEWER_ID,
    reviewedAt: GENERATED_AT,
    resourceId: item.resourceId,
    bookId: item.bookId,
    sectionId: item.sectionId,
    title: item.title,
    disposition: decision.disposition,
    pathRole: decision.pathRole,
    prerequisitePosition: decision.prerequisitePosition,
    citationAddress: {
      href: indexRow.href,
      sourceSpan: indexRow.sourceSpan,
      sourceHash: item.sourceHash!,
    },
    graphNodeRefs: item.graphNodeRefs,
    learningGoalIds: item.learningGoalIds,
    estimatedTimeMinutes: item.estimatedTimeMinutes,
    authority: 'reviewed-section',
    privacyScope: 'student-visible',
    sourceHash: item.sourceHash!,
    runtimeFileHash: item.runtimeFileHash,
    sourceVersionRef: item.sourceVersionRef ?? 'resource-node-registry.v1',
    supportingAnchorCandidateCount: item.supportingAnchorCandidateCount,
    supportingCitationTargetCount: item.supportingCitationTargetCount,
    chunkBoundaryState: 'chunks-remain-supporting-citation',
    promotedAsPathNode: decision.disposition === 'path-planning-section',
    independentPathMetadataComplete: decision.disposition === 'path-planning-section',
    limitationState: decision.knowledgeNodeIds.length > 0 ? [] : ['graph-node-binding-required-before-path-promotion'],
    rawContentIncluded: false,
    reviewerVisibleRationale: decision.rationale,
  };
}

function buildSummary(items: ScopedWorkqueueItem[], reviewItems: ReviewItem[]) {
  const selected = items.filter((item) => item.selectedForReview);
  const residual = items.filter((item) => !item.selectedForReview);
  return {
    artifactVersion: ARTIFACT_VERSION,
    generatedAt: GENERATED_AT,
    reviewBatchId: REVIEW_BATCH_ID,
    selectedShardId: SELECTED_SHARD_ID,
    selectionBasis: 'dependencyState needs-human-review; item-by-item semantic decisions are counted separately',
    totals: {
      sourceWorkqueueRows: sum(items, (item) => item.sourceWorkqueueRowCount),
      scopedSectionUnits: items.length,
      selectedSectionUnits: selected.length,
      reviewedRows: reviewItems.length,
      residualSectionUnits: residual.length,
    },
    selectedShard: {
      total: selected.length,
      reviewed: reviewItems.length,
      remaining: selected.length - reviewItems.length,
      pathRoles: countBy(reviewItems, (item) => item.pathRole),
      dispositions: countBy(reviewItems, (item) => item.disposition),
      prerequisitePositions: countBy(reviewItems, (item) => item.prerequisitePosition),
    },
    residualHandoff: {
      blockedByDependencySectionUnits: residual.filter((item) => item.dependencyStates.includes('blocked-by-dependency')).length,
      blockedByDependencySourceRows: sum(
        residual.filter((item) => item.dependencyStates.includes('blocked-by-dependency')),
        (item) => item.sourceWorkqueueRowCount,
      ),
      resourceIds: residual.map((item) => item.resourceId),
    },
    grouping: {
      byChapter: countBy(items, (item) => item.chapterId),
      byDeterministicShard: countBy(items, (item) => item.deterministicShardId),
      byBlocker: countBy(items.flatMap((item) => item.blockerCodes), (item) => item),
      byLearningGoal: countBy(items.flatMap((item) => item.learningGoalIds), (item) => item),
    },
    guardrails: {
      onlySectionRecords: items.every((item) => item.resourceId.startsWith('textbook-section:') && !item.sectionId.includes('__chunk')),
      selectedSectionsPromotedOnlyAtSectionGrain: reviewItems.every((item) => !item.promotedAsPathNode || !item.sectionId.includes('__chunk')),
      rawChunksPromotedAsPathNodes: false,
      rawContentIncluded: false,
      promotedMetadataComplete: reviewItems
        .filter((item) => item.promotedAsPathNode)
        .every((item) =>
        item.sourceHash &&
        item.citationAddress.href &&
        item.graphNodeRefs.knowledge.length > 0 &&
        item.learningGoalIds.length > 0 &&
        item.estimatedTimeMinutes > 0
      ),
      supportingRowsNotPromoted: reviewItems
        .filter((item) => item.disposition === 'supporting-citation')
        .every((item) => !item.promotedAsPathNode && item.limitationState.includes('graph-node-binding-required-before-path-promotion')),
    },
  };
}

function renderEvidence(summary: ReturnType<typeof buildSummary>, reviewItems: ReviewItem[]) {
  const rows = reviewItems.map((item) => `| ${[
    item.resourceId,
    item.disposition,
    item.pathRole,
    item.prerequisitePosition,
    item.learningGoalIds.join(', '),
    item.graphNodeRefs.knowledge.slice(0, 3).join(', '),
    item.estimatedTimeMinutes,
    item.supportingAnchorCandidateCount,
  ].join(' | ')} |`);
  return [
    '# Core Textbook Section Path Role Review Evidence',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Review batch: ${summary.reviewBatchId}`,
    `Selected shard: ${summary.selectedShardId}`,
    '',
    `Source workqueue rows: ${summary.totals.sourceWorkqueueRows}`,
    `Scoped section units: ${summary.totals.scopedSectionUnits}`,
    `Selected reviewed rows: ${summary.selectedShard.reviewed}`,
    `Selected remaining: ${summary.selectedShard.remaining}`,
    `Residual dependency handoff section units: ${summary.residualHandoff.blockedByDependencySectionUnits}`,
    `Residual dependency handoff source rows: ${summary.residualHandoff.blockedByDependencySourceRows}`,
    '',
    '## Guardrails',
    '',
    `- Only section records: ${summary.guardrails.onlySectionRecords}`,
    `- Selected sections promoted only at section grain: ${summary.guardrails.selectedSectionsPromotedOnlyAtSectionGrain}`,
    `- Raw chunks promoted as PathNodes: ${summary.guardrails.rawChunksPromotedAsPathNodes}`,
    `- Raw content included: ${summary.guardrails.rawContentIncluded}`,
    '',
    '## Reviewed Section Rows',
    '',
    '| Resource | Disposition | Path role | Prerequisite position | Learning goals | Knowledge refs | Minutes | Supporting anchors |',
    '| --- | --- | --- | --- | --- | --- | ---: | ---: |',
    ...rows,
    '',
  ].join('\n');
}

async function hashProjectFile(href: string) {
  const filePath = href.startsWith('/course-runtime/resources/')
    ? path.join(process.cwd(), href.replace(/^\/course-runtime\/resources\//, 'course-content/runtime/resources/'))
    : null;
  if (!filePath) return null;
  try {
    return `sha256:${createHash('sha256').update(await fs.readFile(filePath)).digest('hex')}`;
  } catch {
    return null;
  }
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const text = await fs.readFile(filePath, 'utf8');
  return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as T);
}

async function writeJsonl(filePath: string, rows: unknown[]) {
  await fs.writeFile(filePath, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`, 'utf8');
}

function sectionIdFromCandidate(candidateId: string) {
  const parts = candidateId.split(':');
  return parts.length >= 3 ? parts[2] : 'unknown';
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

function compareByResourceId(left: { resourceId: string }, right: { resourceId: string }) {
  return left.resourceId.localeCompare(right.resourceId);
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
