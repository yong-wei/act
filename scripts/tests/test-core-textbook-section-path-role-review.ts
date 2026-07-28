import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ScopedWorkqueueItem {
  resourceId: string;
  sectionId: string;
  deterministicShardId: string;
  selectedForReview: boolean;
  reviewState: string;
  dependencyStates: string[];
  sourceHash: string | null;
  runtimeFileHash: string | null;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  estimatedTimeMinutes: number;
  rawContentIncluded: boolean;
}

interface ReviewItem {
  reviewBatchId: string;
  reviewerId: string;
  reviewedAt: string;
  resourceId: string;
  sectionId: string;
  disposition: string;
  pathRole: string;
  prerequisitePosition: string;
  citationAddress: { href: string; sourceHash: string; sourceSpan: { startLine: number; endLine: number } };
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  estimatedTimeMinutes: number;
  authority: string;
  privacyScope: string;
  sourceHash: string;
  runtimeFileHash: string | null;
  sourceVersionRef: string;
  supportingAnchorCandidateCount: number;
  supportingCitationTargetCount: number;
  chunkBoundaryState: string;
  promotedAsPathNode: boolean;
  independentPathMetadataComplete: boolean;
  limitationState: string[];
  rawContentIncluded: boolean;
  reviewerVisibleRationale: string;
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
  pathEligibility?: { eligible: boolean };
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const GRAPH_NODES = JSON.parse(readFileSync(path.join(
  process.cwd(),
  'course-content/runtime/knowledge/graph/nodes.json',
), 'utf8')) as Array<{ id: string }>;
const GRAPH_NODE_IDS = new Set(GRAPH_NODES.map((node) => node.id));
const SELECTED_RESOURCE_IDS = new Set([
  'textbook-section:hu-shousong-exercise-analysis-3rd:ch03-sec11',
  'textbook-section:hu-shousong-exercise-analysis-3rd:ch05-sec04',
  'textbook-section:hu-shousong-exercise-analysis-3rd:ch05-sec21',
  'textbook-section:hu-shousong-exercise-analysis-3rd:ch10-sec11',
  'textbook-section:hu-shousong-exercise-analysis-3rd:ch10-sec18',
]);
const EXPECTED_REVIEW: Record<string, {
  disposition: string;
  pathRole: string;
  prerequisitePosition: string;
  learningGoalIds: string[];
  knowledge: string[];
  promotedAsPathNode: boolean;
}> = {
  'ch03-sec11': {
    disposition: 'path-planning-section',
    pathRole: 'remediation-practice',
    prerequisitePosition: 'core-after-modeling',
    learningGoalIds: ['controlModeling', 'diagnosticAssessment'],
    knowledge: ['劳斯判据_3_e3500ac9', '劳斯表特殊情况_3_f787433f', '稳定性_3_72d04fbd'],
    promotedAsPathNode: true,
  },
  'ch05-sec04': {
    disposition: 'path-planning-section',
    pathRole: 'path-plannable',
    prerequisitePosition: 'core-after-frequency-response',
    learningGoalIds: ['controlModeling', 'diagnosticAssessment'],
    knowledge: ['频率响应直觉_5_L2c001', '频率特性_5_404adfdd'],
    promotedAsPathNode: true,
  },
  'ch05-sec21': {
    disposition: 'path-planning-section',
    pathRole: 'remediation-practice',
    prerequisitePosition: 'core-after-frequency-response',
    learningGoalIds: ['controlModeling', 'diagnosticAssessment'],
    knowledge: ['截止频率_5_c7d09ff7', '相角裕度_5_5a74b451', '频率特性_5_404adfdd'],
    promotedAsPathNode: true,
  },
  'ch10-sec11': {
    disposition: 'path-planning-section',
    pathRole: 'extension-path',
    prerequisitePosition: 'advanced-after-state-space',
    learningGoalIds: ['engineeringDecision', 'parameterDesign'],
    knowledge: ['哈密顿函数_10_8cd65735', '最优控制_10_65717117'],
    promotedAsPathNode: true,
  },
  'ch10-sec18': {
    disposition: 'path-planning-section',
    pathRole: 'extension-path',
    prerequisitePosition: 'advanced-after-state-space',
    learningGoalIds: ['engineeringDecision', 'parameterDesign'],
    knowledge: ['庞特里亚金原理_10_03d7d109', '极小值原理_10_fa5b8689', '最优控制_10_65717117'],
    promotedAsPathNode: true,
  },
};
const artifactTexts = [
  'core-textbook-section-path-role-workqueue-items.jsonl',
  'core-textbook-section-path-role-workqueue-summary.json',
  'core-textbook-section-path-role-review-items.jsonl',
  'core-textbook-section-path-role-review-evidence.md',
].map((filename) => readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8'));
const workqueueItems = readJsonl<ScopedWorkqueueItem>('core-textbook-section-path-role-workqueue-items.jsonl');
const reviewItems = readJsonl<ReviewItem>('core-textbook-section-path-role-review-items.jsonl');
const groundingCandidates = readJsonl<GroundingCandidate>('textbook-section-grounding-candidates.jsonl');
const citationTargets = readJsonl<CitationTarget>('textbook-section-citation-targets.jsonl');
const summary = JSON.parse(readFileSync(path.join(
  GOVERNANCE_DIR,
  'core-textbook-section-path-role-workqueue-summary.json',
), 'utf8'));

assert(workqueueItems.length === 15, 'expected scoped textbook-section workqueue to retain 15 unique section units');
assert(reviewItems.length === 5, 'expected five selected section review rows');
assert(summary.selectedShard.remaining === 0, 'selected shard remaining must be zero');
assert(
  summary.selectedShard.remaining === workqueueItems.filter((item) => item.selectedForReview).length - reviewItems.length,
  'selected shard remaining must count selected needs-human-review rows without review decisions',
);
assert(summary.totals.sourceWorkqueueRows === 25, 'source workqueue row count must remain visible');
assert(summary.residualHandoff.blockedByDependencySectionUnits === 10, 'blocked dependency residual handoff must retain 10 section units');
assert(summary.residualHandoff.blockedByDependencySourceRows === 20, 'blocked dependency residual handoff must retain 20 source rows');
assert(summary.guardrails.onlySectionRecords === true, 'workqueue must only contain section records');
assert(summary.guardrails.rawChunksPromotedAsPathNodes === false, 'raw chunks must not be promoted as PathNodes');
assert(summary.guardrails.rawContentIncluded === false, 'raw content must not be included');
assert(summary.guardrails.promotedMetadataComplete === true, 'promoted review metadata must be complete');
assert(summary.guardrails.supportingRowsNotPromoted === true, 'supporting rows must remain non-promoted');
assert(
  citationTargets.every((target) => target.targetFileHash.startsWith('sha256:')),
  'all consumed textbook CitationTargets must declare a runtime target file hash',
);
assert(
  artifactTexts.every((text) => !/textbook-section:[^:\n]+:[^:\n]+:[^:\n]*__chunk/.test(text)),
  'artifacts must not treat chunk candidates as primary textbook section records',
);
assert(
  setEquals(new Set(reviewItems.map((item) => item.resourceId)), SELECTED_RESOURCE_IDS),
  'review items must match the selected needs-human-review section shard exactly',
);
assert(
  reviewItems.every((item) =>
    item.resourceId.startsWith('textbook-section:') &&
    !/(__chunk|__figure|caption|search-document|textbook-search-document)/.test(item.resourceId)
  ),
  'review items must not promote chunks, figures, captions, or search documents',
);
assert(
  setEquals(
    new Set(workqueueItems.filter((item) => item.selectedForReview).map((item) => item.resourceId)),
    SELECTED_RESOURCE_IDS,
  ),
  'selected workqueue rows must match reviewed rows exactly',
);
assert(
  workqueueItems.filter((item) => item.dependencyStates.includes('needs-human-review'))
    .every((item) => item.selectedForReview && item.deterministicShardId === 'dependency:needs-human-review'),
  'needs-human-review section rows must stay in the selected shard even before a semantic decision exists',
);
assert(
  workqueueItems.filter((item) => item.selectedForReview)
    .every((item) => item.reviewState === 'reviewed'),
  'currently selected section rows must have review decisions',
);
assert(
  workqueueItems.filter((item) => !item.selectedForReview)
    .every((item) => item.dependencyStates.includes('blocked-by-dependency')),
  'unselected section rows must remain dependency-blocked residual handoff',
);
assert(
  reviewItems.every((item) =>
    item.rawContentIncluded === false &&
    item.reviewBatchId === 'core-textbook-section-path-role-review-2026-07-05' &&
    item.reviewerId === 'core-textbook-section-review-implementing-agent' &&
    item.reviewedAt === '2026-07-05T07:15:00.000Z' &&
    item.authority === 'reviewed-section' &&
    item.privacyScope === 'student-visible' &&
    item.sourceVersionRef === 'resource-node-registry.v1' &&
    item.sourceHash.startsWith('sha256:') &&
    item.runtimeFileHash?.startsWith('sha256:') &&
    item.citationAddress.href.includes(`/sections/${item.sectionId}.md`) &&
    item.citationAddress.sourceHash === item.sourceHash &&
    item.citationAddress.sourceSpan.startLine > 0 &&
    item.citationAddress.sourceSpan.endLine >= item.citationAddress.sourceSpan.startLine &&
    item.learningGoalIds.length > 0 &&
    item.estimatedTimeMinutes > 0 &&
    item.reviewerVisibleRationale.length > 0
  ),
  'every review item must carry complete section-grain path metadata',
);
for (const item of reviewItems) {
  const expected = EXPECTED_REVIEW[item.sectionId];
  assert(expected, `unexpected reviewed section ${item.sectionId}`);
  assert(item.disposition === expected.disposition, `${item.sectionId} disposition mismatch`);
  assert(item.pathRole === expected.pathRole, `${item.sectionId} pathRole mismatch`);
  assert(item.prerequisitePosition === expected.prerequisitePosition, `${item.sectionId} prerequisitePosition mismatch`);
  assert(item.promotedAsPathNode === expected.promotedAsPathNode, `${item.sectionId} promotion mismatch`);
  assert(item.independentPathMetadataComplete === expected.promotedAsPathNode, `${item.sectionId} metadata complete mismatch`);
  assert(setEquals(new Set(item.learningGoalIds), new Set(expected.learningGoalIds)), `${item.sectionId} learning goals mismatch`);
  assert(setEquals(new Set(item.graphNodeRefs.knowledge), new Set(expected.knowledge)), `${item.sectionId} knowledge refs mismatch`);
  assert(
    item.graphNodeRefs.knowledge.every((nodeId) => GRAPH_NODE_IDS.has(nodeId)),
    `${item.sectionId} knowledge refs must exist in runtime graph`,
  );
  assert(
    expected.promotedAsPathNode || item.limitationState.includes('graph-node-binding-required-before-path-promotion'),
    `${item.sectionId} supporting row must explain missing graph binding`,
  );
}
assert(
    reviewItems.filter((item) => item.promotedAsPathNode).some((item) => item.pathRole === 'path-plannable') &&
    reviewItems.some((item) => item.pathRole === 'remediation-practice') &&
    reviewItems.some((item) => item.pathRole === 'extension-path'),
  'reviewed shard must classify path, remediation, and extension roles',
);
assert(
  workqueueItems.filter((item) => item.selectedForReview)
    .every((item) => item.sourceHash?.startsWith('sha256:') && item.runtimeFileHash?.startsWith('sha256:')),
  'selected section rows must carry source and runtime file hashes',
);
const selectedSectionIds = new Set(reviewItems.map((item) => item.sectionId));
assert(
  groundingCandidates
    .filter((candidate) => selectedSectionIds.has(candidate.sectionId))
    .every((candidate) => candidate.pathEligible === false && candidate.kind !== 'textbook_section'),
  'selected section chunks and figures must remain citation support and not path eligible',
);
assert(
  citationTargets
    .filter((target) => selectedSectionIds.has(sectionIdFromCandidate(target.candidateId)))
    .every((target) => target.pathEligibility?.eligible === false),
  'selected section citation targets must remain non-path-plannable chunk anchors',
);
assert(
  reviewItems.every((item) =>
    item.chunkBoundaryState === 'chunks-remain-supporting-citation' &&
    item.supportingAnchorCandidateCount > 0 &&
    item.supportingCitationTargetCount > 0
  ),
  'reviewed sections must retain supporting chunk/citation boundary evidence',
);

console.log(`Core textbook section review rows: ${reviewItems.length}`);
console.log(`Residual dependency handoff section units: ${summary.residualHandoff.blockedByDependencySectionUnits}`);

function readJsonl<T>(filename: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

function sectionIdFromCandidate(candidateId: string) {
  const parts = candidateId.split(':');
  return parts.length >= 3 ? parts[2] : 'unknown';
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function setEquals<T>(left: Set<T>, right: Set<T>) {
  if (left.size !== right.size) return false;
  for (const item of left) {
    if (!right.has(item)) return false;
  }
  return true;
}
