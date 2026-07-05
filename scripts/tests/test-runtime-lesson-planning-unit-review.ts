import { readFileSync } from 'node:fs';
import path from 'node:path';

interface ScopedWorkqueueItem {
  resourceId: string;
  lessonKey: string;
  deterministicShardId: string;
  selectedForReview: boolean;
  reviewState: string;
  disposition: string;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  promotedAsPlanningUnit: boolean;
  rawContentIncluded: boolean;
}

interface ReviewItem {
  resourceId: string;
  lessonKey: string;
  stepId: string;
  disposition: string;
  pathRole: string;
  routeTarget: string | null;
  parentPlanningUnitRef: string | null;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  estimatedTimeMinutes: number;
  evidenceContract: string;
  evidenceTelemetry: string[];
  limitationState: string[];
  promotedAsPlanningUnit: boolean;
  independentPathMetadataComplete: boolean;
  rawContentIncluded: boolean;
  reviewerVisibleRationale: string;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const GRAPH_NODES = JSON.parse(readFileSync(path.join(
  process.cwd(),
  'course-content/runtime/knowledge/graph/nodes.json',
), 'utf8')) as Array<{ id: string }>;
const GRAPH_NODE_IDS = new Set(GRAPH_NODES.map((node) => node.id));
const EXPECTED_SELECTED_IDS = new Set([
  'runtime-step:4-7:step-01',
  'runtime-step:4-7:step-02',
  'runtime-step:4-7:step-11',
  'runtime-step:4-7:step-12',
]);
const artifactTexts = [
  'runtime-lesson-planning-unit-workqueue-items.jsonl',
  'runtime-lesson-planning-unit-workqueue-summary.json',
  'runtime-lesson-planning-unit-review-items.jsonl',
  'runtime-lesson-planning-unit-review-evidence.md',
].map((filename) => readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8'));
const workqueueItems = readJsonl<ScopedWorkqueueItem>('runtime-lesson-planning-unit-workqueue-items.jsonl');
const reviewItems = readJsonl<ReviewItem>('runtime-lesson-planning-unit-review-items.jsonl');
const summary = JSON.parse(readFileSync(path.join(
  GOVERNANCE_DIR,
  'runtime-lesson-planning-unit-workqueue-summary.json',
), 'utf8'));

assert(workqueueItems.length === 388, 'expected scoped runtime-step workqueue to retain 388 unique step units');
assert(reviewItems.length === 4, 'expected four reviewed rows for selected lesson 4-7 shard');
assert(summary.selectedShardId === 'lesson:4-7', 'selected shard must be lesson:4-7');
assert(summary.selectedShard.remaining === 0, 'selected shard remaining must be zero');
assert(
  summary.selectedShard.remaining === workqueueItems.filter((item) => item.selectedForReview).length - reviewItems.length,
  'selected remaining must count selected runtime steps without review decisions',
);
assert(summary.residualHandoff.unselectedRuntimeStepUnits === 384, 'unselected runtime steps must remain residual handoff');
assert(summary.guardrails.onlyRuntimeLessonSteps === true, 'workqueue must only include runtime-step records');
assert(summary.guardrails.selectedShardReviewed === true, 'selected shard must be fully reviewed');
assert(summary.guardrails.promotedMetadataComplete === true, 'promoted PlanningUnits must have required metadata');
assert(summary.guardrails.nonPlanningStepsLinked === true, 'non-planning steps must be linked to parent PlanningUnits');
assert(summary.guardrails.rawContentIncluded === false, 'raw content must not be included');
assert(
  artifactTexts.every((text) => !text.includes('question_cards') && !text.includes('frontier_methods')),
  'artifacts must not copy raw manifest content blocks',
);
assert(
  setEquals(new Set(workqueueItems.filter((item) => item.selectedForReview).map((item) => item.resourceId)), EXPECTED_SELECTED_IDS),
  'selected workqueue rows must match the lesson 4-7 shard',
);
assert(
  setEquals(new Set(reviewItems.map((item) => item.resourceId)), EXPECTED_SELECTED_IDS),
  'review items must match selected shard exactly',
);
assert(
  workqueueItems.filter((item) => item.selectedForReview)
    .every((item) => item.reviewState === 'reviewed' && item.deterministicShardId === 'lesson:4-7'),
  'selected rows must be reviewed and stay in the lesson shard',
);
assert(
  workqueueItems.filter((item) => !item.selectedForReview)
    .every((item) => item.reviewState === 'residual-handoff'),
  'unselected rows must remain residual handoff',
);
assert(
  reviewItems.filter((item) => item.promotedAsPlanningUnit).length === 2,
  'selected shard should promote only diagnostic and terminal validation steps',
);
assert(
  reviewItems.filter((item) => !item.promotedAsPlanningUnit).length === 2,
  'selected shard should keep bridge and summary as supporting context',
);
for (const item of reviewItems) {
  assert(item.lessonKey === '4-7', `${item.resourceId} must belong to lesson 4-7`);
  assert(item.learningGoalIds.length > 0, `${item.resourceId} must have learning goals`);
  assert(item.graphNodeRefs.knowledge.length > 0, `${item.resourceId} must have knowledge refs`);
  assert(
    item.graphNodeRefs.knowledge.every((nodeId) => GRAPH_NODE_IDS.has(nodeId)),
    `${item.resourceId} knowledge refs must exist in runtime graph`,
  );
  assert(item.estimatedTimeMinutes > 0, `${item.resourceId} must estimate time`);
  assert(item.evidenceContract !== 'none', `${item.resourceId} must declare evidence contract`);
  assert(item.reviewerVisibleRationale.length > 0, `${item.resourceId} must have rationale`);
  assert(item.rawContentIncluded === false, `${item.resourceId} must not include raw content`);
  if (item.promotedAsPlanningUnit) {
    assert(item.routeTarget?.includes(`step=${item.stepId}`), `${item.resourceId} promoted row must route to its step`);
    assert(item.independentPathMetadataComplete === true, `${item.resourceId} promoted row must be metadata complete`);
    assert(item.limitationState.length === 0, `${item.resourceId} promoted row should not carry limitation state`);
  } else {
    assert(item.routeTarget === null, `${item.resourceId} supporting row must not have route target`);
    assert(item.parentPlanningUnitRef?.startsWith('runtime-step:4-7:'), `${item.resourceId} supporting row must link parent`);
    assert(item.independentPathMetadataComplete === false, `${item.resourceId} supporting row must not be metadata complete`);
    assert(item.limitationState.includes('not-independent-path-node'), `${item.resourceId} supporting row must explain limitation`);
  }
}
assert(
  reviewItems.some((item) =>
    item.resourceId === 'runtime-step:4-7:step-02' &&
    item.disposition === 'planning-unit' &&
    item.pathRole === 'diagnostic-readiness' &&
    item.evidenceContract === 'quiz-submission' &&
    item.evidenceTelemetry.includes('quizSubmitted')
  ),
  'step-02 must be the diagnostic readiness PlanningUnit',
);
assert(
  reviewItems.some((item) =>
    item.resourceId === 'runtime-step:4-7:step-11' &&
    item.disposition === 'planning-unit' &&
    item.pathRole === 'terminal-validation' &&
    item.evidenceContract === 'quiz-submission' &&
    item.evidenceTelemetry.includes('quizSubmitted')
  ),
  'step-11 must be the terminal validation PlanningUnit',
);

console.log(`Runtime lesson planning review rows: ${reviewItems.length}`);
console.log(`Residual runtime step handoff units: ${summary.residualHandoff.unselectedRuntimeStepUnits}`);

function readJsonl<T>(filename: string): T[] {
  return readFileSync(path.join(GOVERNANCE_DIR, filename), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
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
