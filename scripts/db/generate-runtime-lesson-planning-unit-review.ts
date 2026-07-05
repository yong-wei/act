import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type Disposition = 'planning-unit' | 'supporting-context' | 'reviewed-exclusion';
type PathRole = 'diagnostic-readiness' | 'terminal-validation' | 'bridge-context' | 'summary-context';
type EvidenceContract = 'none' | 'viewed-time-on-step' | 'quiz-submission';

interface WorkqueueItem {
  resourceId: string;
  sourceFamily: string;
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
}

interface ManifestStep {
  title: string;
  modules?: Array<{ id: string; title?: string; kind?: string; payload?: { interactionKind?: string; semanticRole?: string } }>;
  evidence_sequence?: string[];
  interaction_spec?: { interaction_kind?: string; student_task?: string };
  telemetry_spec?: { summary_fields?: string[]; misconception_tags?: string[] };
  ai_context_spec?: { page_goal?: string };
  preview_contract?: { demo_path?: string };
}

interface LessonManifest {
  lesson_id: string;
  course_title: string;
  course_route_segment: string;
  steps: Record<string, ManifestStep>;
}

interface ReviewDecision {
  disposition: Disposition;
  pathRole: PathRole;
  learningGoalIds: string[];
  knowledgeNodeIds: string[];
  capabilityTargetRefs: string[];
  estimatedTimeMinutes: number;
  evidenceContract: EvidenceContract;
  parentPlanningUnitRef: string | null;
  prerequisiteRelation: string;
  rationale: string;
}

interface ScopedWorkqueueItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  resourceId: string;
  lessonKey: string;
  stepId: string;
  title: string;
  deterministicShardId: string;
  selectedForReview: boolean;
  reviewState: 'reviewed' | 'residual-handoff';
  disposition: Disposition | 'unreviewed';
  dependencyStates: string[];
  queueRoles: string[];
  blockerCodes: string[];
  learningGoalIds: string[];
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  sourcePathOrUrl: string | null;
  sourceHash: string | null;
  runtimeFileHash: string | null;
  sourceVersionRef: string | null;
  interactionKind: string;
  evidenceTelemetry: string[];
  moduleCount: number;
  promotedAsPlanningUnit: boolean;
  rawContentIncluded: false;
}

interface ReviewItem {
  artifactVersion: typeof ARTIFACT_VERSION;
  reviewBatchId: typeof REVIEW_BATCH_ID;
  reviewerId: typeof REVIEWER_ID;
  reviewedAt: string;
  resourceId: string;
  lessonKey: string;
  stepId: string;
  title: string;
  disposition: Disposition;
  pathRole: PathRole;
  routeTarget: string | null;
  parentPlanningUnitRef: string | null;
  graphNodeRefs: { knowledge: string[]; capability: string[]; quality: string[] };
  learningGoalIds: string[];
  estimatedTimeMinutes: number;
  evidenceContract: EvidenceContract;
  evidenceTelemetry: string[];
  prerequisiteRelation: string;
  privacyScope: 'student-visible';
  sourceHash: string | null;
  runtimeFileHash: string | null;
  sourceVersionRef: string;
  limitationState: string[];
  promotedAsPlanningUnit: boolean;
  independentPathMetadataComplete: boolean;
  rawContentIncluded: false;
  reviewerVisibleRationale: string;
}

const GOVERNANCE_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const WORKQUEUE_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'resource-completion-workqueue-items.jsonl');
const SCOPED_WORKQUEUE_PATH = path.join(GOVERNANCE_DIR, 'runtime-lesson-planning-unit-workqueue-items.jsonl');
const SUMMARY_PATH = path.join(GOVERNANCE_DIR, 'runtime-lesson-planning-unit-workqueue-summary.json');
const REVIEW_ITEMS_PATH = path.join(GOVERNANCE_DIR, 'runtime-lesson-planning-unit-review-items.jsonl');
const REVIEW_EVIDENCE_PATH = path.join(GOVERNANCE_DIR, 'runtime-lesson-planning-unit-review-evidence.md');
const ARTIFACT_VERSION = 'runtime-lesson-planning-unit-review.v1' as const;
const REVIEW_BATCH_ID = 'runtime-lesson-planning-unit-review-2026-07-05' as const;
const REVIEWER_ID = 'runtime-lesson-planning-unit-implementing-agent' as const;
const GENERATED_AT = process.env.RUNTIME_LESSON_PLANNING_REVIEW_GENERATED_AT ?? '2026-07-05T09:30:00.000Z';
const SELECTED_LESSON = process.env.RUNTIME_LESSON_PLANNING_REVIEW_LESSON ?? '4-7';
const SELECTED_SHARD_ID = `lesson:${SELECTED_LESSON}` as const;

const REVIEW_DECISIONS: Record<string, ReviewDecision> = {
  '4-7:step-01': {
    disposition: 'supporting-context',
    pathRole: 'bridge-context',
    learningGoalIds: ['control-correction', 'simulation-validation-practice', 'ship-ocean-transfer-application'],
    knowledgeNodeIds: ['固定结构迁移失配信号_4_46002', '高保真任务降阶辨识_4_47001', '跨模型验证比较_4_47006'],
    capabilityTargetRefs: ['capability:autocontrol:validate-with-simulation-evidence', 'capability:autocontrol:transfer-to-ship-ocean-mission'],
    estimatedTimeMinutes: 4,
    evidenceContract: 'viewed-time-on-step',
    parentPlanningUnitRef: 'runtime-step:4-7:step-02',
    prerequisiteRelation: 'bridge-before-diagnostic',
    rationale: 'The step frames high-fidelity mission boundaries but has no student submission, so it should support the diagnostic gate instead of becoming an independent planning unit.',
  },
  '4-7:step-02': {
    disposition: 'planning-unit',
    pathRole: 'diagnostic-readiness',
    learningGoalIds: ['frequency-response-foundations', 'transfer-function-modeling-foundations', 'control-correction'],
    knowledgeNodeIds: ['惯性环节_2_11007', 'Bode图_1_1', '参数约束翻译表_4_45002'],
    capabilityTargetRefs: ['capability:autocontrol:synthesize-controller-correction'],
    estimatedTimeMinutes: 8,
    evidenceContract: 'quiz-submission',
    parentPlanningUnitRef: null,
    prerequisiteRelation: 'before-high-fidelity-identification',
    rationale: 'The pretest has four objective cards covering time constants, integration, Bode margin, and constraint penalties, making it a diagnostic readiness unit.',
  },
  '4-7:step-11': {
    disposition: 'planning-unit',
    pathRole: 'terminal-validation',
    learningGoalIds: ['control-correction', 'simulation-validation-practice', 'ship-ocean-transfer-application'],
    knowledgeNodeIds: ['分段辨识模型组合_4_47002', '跨模型验证比较_4_47006', '扰动噪声设计边界_4_47007'],
    capabilityTargetRefs: ['capability:autocontrol:validate-with-simulation-evidence', 'capability:autocontrol:transfer-to-ship-ocean-mission'],
    estimatedTimeMinutes: 10,
    evidenceContract: 'quiz-submission',
    parentPlanningUnitRef: null,
    prerequisiteRelation: 'after-high-fidelity-design-closure',
    rationale: 'The posttest directly checks parameter source, structure choice, cross-model validation, and disturbance boundary decisions, so it is the selected shard terminal validation unit.',
  },
  '4-7:step-12': {
    disposition: 'supporting-context',
    pathRole: 'summary-context',
    learningGoalIds: ['control-correction', 'simulation-validation-practice', 'ship-ocean-transfer-application'],
    knowledgeNodeIds: ['传统控制结构局限_4_47008', '模型预测控制_4_f3d4a099', '鲁棒控制_3_a7fa1491'],
    capabilityTargetRefs: ['capability:autocontrol:transfer-to-ship-ocean-mission'],
    estimatedTimeMinutes: 5,
    evidenceContract: 'viewed-time-on-step',
    parentPlanningUnitRef: 'runtime-step:4-7:step-11',
    prerequisiteRelation: 'summary-after-terminal-validation',
    rationale: 'The summary consolidates limitations and future-method entry points without a submission contract, so it remains supporting context linked to the terminal validation step.',
  },
};

async function main() {
  const rows = (await readJsonl<WorkqueueItem>(WORKQUEUE_ITEMS_PATH))
    .filter((row) => row.sourceFamily === 'runtime-lesson-step' && row.followupBucket === 'review-runtime-lesson-planning-units');
  const rowsByResource = groupBy(rows, (row) => row.resourceId);
  const scopedItems = await Promise.all(Array.from(rowsByResource.entries()).map(([resourceId, groupedRows]) =>
    scopedWorkqueueItem(resourceId, groupedRows)
  ));
  const sortedScopedItems = scopedItems.sort(compareByResourceId);
  const reviewItems = sortedScopedItems
    .filter((item) => item.selectedForReview && REVIEW_DECISIONS[`${item.lessonKey}:${item.stepId}`])
    .map(reviewItemFor);
  const summary = buildSummary(sortedScopedItems, reviewItems);

  await writeJsonl(SCOPED_WORKQUEUE_PATH, sortedScopedItems);
  await fs.writeFile(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  await writeJsonl(REVIEW_ITEMS_PATH, reviewItems);
  await fs.writeFile(REVIEW_EVIDENCE_PATH, renderEvidence(summary, reviewItems), 'utf8');

  console.log(`Runtime lesson step rows: ${sortedScopedItems.length}`);
  console.log(`Selected lesson shard: ${SELECTED_LESSON}`);
  console.log(`Selected reviewed rows: ${reviewItems.length}`);
  console.log(`Selected remaining: ${summary.selectedShard.remaining}`);
}

async function scopedWorkqueueItem(resourceId: string, rows: WorkqueueItem[]): Promise<ScopedWorkqueueItem> {
  const [lessonKey, stepId] = parseSourceRecord(rows[0]?.sourceRecord, resourceId);
  const manifest = await readManifest(lessonKey);
  const step = manifest.steps[stepId];
  if (!step) throw new Error(`Missing manifest step ${lessonKey}:${stepId}`);

  const decision = REVIEW_DECISIONS[`${lessonKey}:${stepId}`];
  const selectedForReview = lessonKey === SELECTED_LESSON;
  const sourcePathOrUrl = rows[0]?.sourcePathOrUrl ?? manifestPathFor(lessonKey);
  const evidenceTelemetry = uniqueSorted(step.telemetry_spec?.summary_fields ?? []);

  return {
    artifactVersion: ARTIFACT_VERSION,
    resourceId,
    lessonKey,
    stepId,
    title: step.title || rows[0]?.title || resourceId,
    deterministicShardId: `lesson:${lessonKey}`,
    selectedForReview,
    reviewState: selectedForReview && decision ? 'reviewed' : 'residual-handoff',
    disposition: decision?.disposition ?? 'unreviewed',
    dependencyStates: uniqueSorted(rows.map((row) => row.dependencyState)),
    queueRoles: uniqueSorted(rows.map((row) => row.queueRole)),
    blockerCodes: uniqueSorted(rows.flatMap((row) => [row.missingFieldCode, ...(row.currentBlockers ?? [])])),
    learningGoalIds: uniqueSorted(decision?.learningGoalIds ?? rows.flatMap((row) => row.learningGoalIds ?? [])),
    graphNodeRefs: {
      knowledge: uniqueSorted(decision?.knowledgeNodeIds ?? []),
      capability: uniqueSorted(decision?.capabilityTargetRefs ?? []),
      quality: [],
    },
    sourcePathOrUrl,
    sourceHash: rows[0]?.sourceHash ?? null,
    runtimeFileHash: await hashProjectPath(sourcePathOrUrl),
    sourceVersionRef: rows[0]?.sourceVersionRef ?? 'interactive-manifest.v2',
    interactionKind: step.interaction_spec?.interaction_kind ?? 'unknown',
    evidenceTelemetry,
    moduleCount: step.modules?.length ?? 0,
    promotedAsPlanningUnit: decision?.disposition === 'planning-unit',
    rawContentIncluded: false,
  };
}

function reviewItemFor(item: ScopedWorkqueueItem): ReviewItem {
  const decision = REVIEW_DECISIONS[`${item.lessonKey}:${item.stepId}`];
  if (!decision) throw new Error(`Missing review decision for ${item.resourceId}`);
  const promoted = decision.disposition === 'planning-unit';
  return {
    artifactVersion: ARTIFACT_VERSION,
    reviewBatchId: REVIEW_BATCH_ID,
    reviewerId: REVIEWER_ID,
    reviewedAt: GENERATED_AT,
    resourceId: item.resourceId,
    lessonKey: item.lessonKey,
    stepId: item.stepId,
    title: item.title,
    disposition: decision.disposition,
    pathRole: decision.pathRole,
    routeTarget: promoted ? `/interactive-learning/courses/unit-4-7-destroyer-hifi-design-closure/student/demo?step=${item.stepId}` : null,
    parentPlanningUnitRef: decision.parentPlanningUnitRef,
    graphNodeRefs: item.graphNodeRefs,
    learningGoalIds: item.learningGoalIds,
    estimatedTimeMinutes: decision.estimatedTimeMinutes,
    evidenceContract: decision.evidenceContract,
    evidenceTelemetry: item.evidenceTelemetry,
    prerequisiteRelation: decision.prerequisiteRelation,
    privacyScope: 'student-visible',
    sourceHash: item.sourceHash,
    runtimeFileHash: item.runtimeFileHash,
    sourceVersionRef: item.sourceVersionRef ?? 'interactive-manifest.v2',
    limitationState: promoted ? [] : ['not-independent-path-node', 'linked-to-parent-planning-unit'],
    promotedAsPlanningUnit: promoted,
    independentPathMetadataComplete: promoted,
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
    selectionBasis: 'deterministic lesson-level shard selected for bounded runtime-step semantic review',
    totals: {
      sourceWorkqueueRows: items.length,
      scopedRuntimeStepUnits: items.length,
      selectedRuntimeStepUnits: selected.length,
      reviewedRows: reviewItems.length,
      residualRuntimeStepUnits: residual.length,
    },
    selectedShard: {
      total: selected.length,
      reviewed: reviewItems.length,
      remaining: selected.length - reviewItems.length,
      dispositions: countBy(reviewItems, (item) => item.disposition),
      pathRoles: countBy(reviewItems, (item) => item.pathRole),
    },
    residualHandoff: {
      unselectedRuntimeStepUnits: residual.length,
      deterministicShardIds: uniqueSorted(residual.map((item) => item.deterministicShardId)),
    },
    guardrails: {
      onlyRuntimeLessonSteps: items.every((item) => item.resourceId.startsWith('runtime-step:')),
      selectedShardReviewed: selected.every((item) => item.reviewState === 'reviewed'),
      promotedMetadataComplete: reviewItems
        .filter((item) => item.promotedAsPlanningUnit)
        .every((item) =>
          item.routeTarget &&
          item.graphNodeRefs.knowledge.length > 0 &&
          item.learningGoalIds.length > 0 &&
          item.estimatedTimeMinutes > 0 &&
          item.evidenceContract !== 'none'
        ),
      nonPlanningStepsLinked: reviewItems
        .filter((item) => !item.promotedAsPlanningUnit)
        .every((item) => item.parentPlanningUnitRef && item.limitationState.includes('not-independent-path-node')),
      rawContentIncluded: false,
    },
  };
}

function renderEvidence(summary: ReturnType<typeof buildSummary>, reviewItems: ReviewItem[]) {
  const rows = reviewItems.map((item) => `| ${[
    item.resourceId,
    item.disposition,
    item.pathRole,
    item.parentPlanningUnitRef ?? '',
    item.learningGoalIds.join(', '),
    item.graphNodeRefs.knowledge.slice(0, 3).join(', '),
    item.evidenceContract,
    item.estimatedTimeMinutes,
  ].join(' | ')} |`);
  return [
    '# Runtime Lesson Planning Unit Review Evidence',
    '',
    `Generated at: ${summary.generatedAt}`,
    `Review batch: ${summary.reviewBatchId}`,
    `Selected shard: ${summary.selectedShardId}`,
    '',
    `Source runtime-step rows: ${summary.totals.sourceWorkqueueRows}`,
    `Selected reviewed rows: ${summary.selectedShard.reviewed}`,
    `Selected remaining: ${summary.selectedShard.remaining}`,
    `Residual runtime-step units: ${summary.residualHandoff.unselectedRuntimeStepUnits}`,
    '',
    '## Reviewed Runtime Steps',
    '',
    '| Resource | Disposition | Path role | Parent PlanningUnit | Learning goals | Knowledge refs | Evidence contract | Minutes |',
    '| --- | --- | --- | --- | --- | --- | --- | ---: |',
    ...rows,
    '',
  ].join('\n');
}

async function readManifest(lessonKey: string): Promise<LessonManifest> {
  return JSON.parse(await fs.readFile(manifestPathFor(lessonKey), 'utf8')) as LessonManifest;
}

function manifestPathFor(lessonKey: string) {
  return path.join(process.cwd(), 'course-content/runtime/lessons', lessonKey, 'interactive-manifest.json');
}

function parseSourceRecord(sourceRecord: string | undefined, resourceId: string): [string, string] {
  const value = sourceRecord || resourceId.replace(/^runtime-step:/, '').replace(/:step-/, ':step-');
  const [lessonKey, stepId] = value.split(':');
  if (!lessonKey || !stepId) throw new Error(`Cannot parse runtime step source record: ${sourceRecord || resourceId}`);
  return [lessonKey, stepId];
}

async function hashProjectPath(filePath: string | null) {
  if (!filePath) return null;
  const absolute = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  try {
    return `sha256:${createHash('sha256').update(await fs.readFile(absolute)).digest('hex')}`;
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

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
