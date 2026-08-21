import { createHash } from 'node:crypto';

import { MICRO_TUTORING_PRACTICE_BASELINE_VERSION } from '@/features/assessment/micro-tutoring-coverage-audit';

import type {
  AdaptiveAssessmentCatalogItem,
  AdaptiveAssessmentCatalogSourceFamily,
  AdaptiveAssessmentCatalogStage,
} from './adaptive-assessment-item-catalog';
import { buildAdaptiveAssessmentItemCatalog } from './adaptive-assessment-item-catalog';
import {
  assessmentItemSemanticReviewSourceHash,
  getAssessmentItemSemanticReviewDecisionIssues,
  type AssessmentItemSemanticReviewDecision,
} from './adaptive-assessment-semantic-review';
import {
  REVIEWED_TERMINAL_VALIDATION_QUESTIONS,
  TERMINAL_VALIDATION_REVIEW_BATCH_ID,
} from './learning-goal-terminal-validation-question-sets';

export const LIFECYCLE_COVERAGE_V2_VERSION = 'adaptive-assessment-lifecycle-coverage.v2';
export const LIFECYCLE_COVERAGE_V2_RELEASE_ID = 'adaptive-assessment-lifecycle-coverage-v2.r1';

export type LifecycleCoverageStage =
  | 'readiness'
  | 'practice'
  | 'checkpoint'
  | 'remediation'
  | 'terminal-validation';

export type LifecycleCoverageLayer =
  | 'registered'
  | 'allowed'
  | 'approved'
  | 'eligible'
  | 'runtimeRegistered'
  | 'selectable';

export type LifecycleCoverageCellStatus = 'complete' | 'incomplete';

export const LIFECYCLE_COVERAGE_STAGES: LifecycleCoverageStage[] = [
  'readiness',
  'practice',
  'checkpoint',
  'remediation',
  'terminal-validation',
];

export const DEFAULT_LIFECYCLE_COVERAGE_V2_POLICY: LifecycleCoveragePolicy = {
  baselineVersion: LIFECYCLE_COVERAGE_V2_VERSION,
  releaseId: LIFECYCLE_COVERAGE_V2_RELEASE_ID,
  practiceV1BaselineVersion: MICRO_TUTORING_PRACTICE_BASELINE_VERSION,
  stageMinimums: {
    readiness: 3,
    practice: 6,
    checkpoint: 3,
    remediation: 3,
    'terminal-validation': 1,
  },
  forbiddenSelectableFamilies: ['generated-adaptive-question'],
  highRiskStages: ['checkpoint', 'terminal-validation'],
  notes: [
    'Minima reuse the existing 3/6/3/3 reviewed-path-eligible floors; terminal-validation starts at 1 after inventory.',
    'Generated-provisional items never become selectable.',
    'A single human-review decision cannot silently authorize both checkpoint and terminal-validation.',
  ],
};

export interface LifecycleCoveragePolicy {
  baselineVersion: string;
  releaseId: string;
  practiceV1BaselineVersion: string;
  stageMinimums: Record<LifecycleCoverageStage, number>;
  forbiddenSelectableFamilies: AdaptiveAssessmentCatalogSourceFamily[];
  highRiskStages: LifecycleCoverageStage[];
  notes: string[];
}

export interface LifecycleCoverageLayerCounts {
  registered: number;
  allowed: number;
  approved: number;
  eligible: number;
  runtimeRegistered: number;
  selectable: number;
}

export interface LifecycleCoverageCell {
  learningGoalId: string;
  stage: LifecycleCoverageStage;
  status: LifecycleCoverageCellStatus;
  requiredCount: number;
  counts: LifecycleCoverageLayerCounts;
  catalogItemIds: Record<LifecycleCoverageLayer, string[]>;
  sourceMix: Partial<Record<AdaptiveAssessmentCatalogSourceFamily, number>>;
  limitations: string[];
}

export interface LifecycleCoverageItemRecord {
  catalogItemId: string;
  contentHash: string;
  sourceFamily: AdaptiveAssessmentCatalogSourceFamily;
  learningGoalIds: string[];
  allowedStages: AdaptiveAssessmentCatalogStage[];
  approvedStagePurpose: string | null;
  eligibilityState: AdaptiveAssessmentCatalogItem['eligibilityState'];
  runtimeRegistered: boolean;
  lifecycleBaselineId: string | null;
  lifecycleVersion: string | null;
  missingLayers: LifecycleCoverageLayer[];
}

export interface LifecycleBaselineEntry {
  catalogItemId: string;
  contentHash: string;
}

export interface FrozenTerminalValidationBaselineEntry extends LifecycleBaselineEntry {
  reviewSourceHash: string;
}

export const FROZEN_TERMINAL_VALIDATION_BASELINE: FrozenTerminalValidationBaselineEntry[] = [
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:control-correction-terminal-validation-01', contentHash: '3e78a3bfc9f990eb46f28b051352f16e53633f73d378e7c6c4bed0a68bdcb190', reviewSourceHash: 'sha256:b27e70b29f9d63292e5fcf13df0edc45678d843877bd3c2ff1a7f52532aae7d8' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:feedback-loop-concept-foundations-terminal-validation-01', contentHash: '11d21426c0f2fcf44850e721895b722e71d78fe055a3f1c0fddaad02d1bf07a2', reviewSourceHash: 'sha256:a83ea9fc7b19c4be6fc8455210e1559ec1c3ff522d7483994c43c70c2f07f7d5' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:frequency-response-foundations-terminal-validation-01', contentHash: '09d3bdf32a58ef68859394ba677e36eb31a2290326064e43976c8a9e84489be8', reviewSourceHash: 'sha256:7b6445197d4927220f610a849e286bcaed4668bb4718803dc5e212c8ccc7cac7' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:root-locus-analysis-foundations-terminal-validation-01', contentHash: 'f3fbe5a4a753588980a6ab08907e1893b8fb44ad4002530b675a8696c50c84cd', reviewSourceHash: 'sha256:72774a305caaaab4183c8cf61cdc229e2f2130685dd054d320fc02677d2f7d56' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:ship-ocean-transfer-application-terminal-validation-01', contentHash: 'bc83638bebb8d5888333bd0defe01744e5e329304990d86d2a9ec3bcebcc47cb', reviewSourceHash: 'sha256:723b8375da83189842a27746bb4c971d28e5a4b18d01282d7b97660341801211' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:simulation-validation-practice-terminal-validation-01', contentHash: 'decf6965a700d0ee186da14484d299894961b83ada81582f411269fa3bd8909d', reviewSourceHash: 'sha256:fabb8231790b2fe24f2669eeb2dbb6599bf96138c5106a6c4f597eadf7fcfec9' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:stability-margin-frequency-analysis-terminal-validation-01', contentHash: 'fac65abed8adbf90e2c09222fc3021c6c0fb7261791ff1d8afa7031f0adaad5c', reviewSourceHash: 'sha256:136acd6627161a74bec1e133ae98b1f471e844fa9addad1f6311f2226f6eb23f' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:time-domain-response-analysis-terminal-validation-01', contentHash: '9910a2d13844442cb1bce245afc860fa28845daff99042251fcbb202cee53259', reviewSourceHash: 'sha256:26ed18c12f0636f94be4bf21692a1f214c42af3c17a488b66e3c36bef6ad73e3' },
  { catalogItemId: 'adaptive-assessment-item:checkpoint-authored-question:transfer-function-modeling-foundations-terminal-validation-01', contentHash: 'e83c199cb16fb514245bd6ab0256758d91a2874d34098f9e6f55155ba1a0c047', reviewSourceHash: 'sha256:19fc8aeb814c01a2528e16ea534bd6d82b07a6b3f07d9577916c8d5457491547' },
];

export interface LifecycleCoverageArtifacts {
  matrix: {
    artifactVersion: typeof LIFECYCLE_COVERAGE_V2_VERSION;
    releaseId: string;
    generatedAt: string;
    practiceV1BaselineVersion: string;
    learningGoalIds: string[];
    stageMinimums: Record<LifecycleCoverageStage, number>;
    inputDigest: string;
    rows: Array<{
      learningGoalId: string;
      title: string;
      cells: LifecycleCoverageCell[];
      incompleteStages: LifecycleCoverageStage[];
    }>;
    totals: {
      learningGoalCount: number;
      completeCells: number;
      incompleteCells: number;
    };
  };
  itemRecords: LifecycleCoverageItemRecord[];
  baseline: {
    version: string;
    releaseId: string;
    entries: LifecycleBaselineEntry[];
  };
  drift: string[];
}

interface CountableItem {
  item: AdaptiveAssessmentCatalogItem;
  decision: AssessmentItemSemanticReviewDecision | null;
  runtimeRegistered: boolean;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].sort();
}

export function lifecycleStageFromCatalogStage(
  stage: string | null | undefined,
): LifecycleCoverageStage | null {
  if (stage === 'low-stakes-practice' || stage === 'practice') return 'practice';
  if (stage === 'readiness' || stage === 'readiness-gate' || stage === 'precheck') return 'readiness';
  if (stage === 'checkpoint' || stage === 'remediation' || stage === 'terminal-validation') return stage;
  return null;
}

export function catalogStagesForLifecycleStage(stage: LifecycleCoverageStage): AdaptiveAssessmentCatalogStage[] {
  if (stage === 'practice') return ['low-stakes-practice'];
  if (stage === 'readiness') return ['readiness'];
  return [stage];
}

export const LIFECYCLE_COVERAGE_LEARNING_GOALS: Array<{ id: string; title: string }> = [
  { id: 'control-correction', title: '控制系统校正设计' },
  { id: 'frequency-response-foundations', title: '频率响应基础' },
  { id: 'feedback-loop-concept-foundations', title: '反馈与闭环结构基础' },
  { id: 'transfer-function-modeling-foundations', title: '传递函数建模基础' },
  { id: 'time-domain-response-analysis', title: '时域响应与性能指标分析' },
  { id: 'root-locus-analysis-foundations', title: '根轨迹分析基础' },
  { id: 'stability-margin-frequency-analysis', title: '稳定裕度与频域安全边界' },
  { id: 'simulation-validation-practice', title: '仿真验证实践' },
  { id: 'ship-ocean-transfer-application', title: '船海场景迁移应用' },
];

export function lifecycleCoverageGoals() {
  return LIFECYCLE_COVERAGE_LEARNING_GOALS;
}

export function selectFrozenTerminalValidationItems(
  items: AdaptiveAssessmentCatalogItem[],
): AdaptiveAssessmentCatalogItem[] {
  const frozenById = new Map(FROZEN_TERMINAL_VALIDATION_BASELINE.map((entry) => [entry.catalogItemId, entry]));
  return items.filter((item) => frozenById.get(item.catalogItemId)?.contentHash === item.contentHash);
}

export function selectFrozenTerminalValidationOverlay(input: {
  items: AdaptiveAssessmentCatalogItem[];
  decisions: AssessmentItemSemanticReviewDecision[];
}): {
  items: AdaptiveAssessmentCatalogItem[];
  decisions: AssessmentItemSemanticReviewDecision[];
} {
  const frozenById = new Map(FROZEN_TERMINAL_VALIDATION_BASELINE.map((entry) => [entry.catalogItemId, entry]));
  const items = input.items.filter((item) => frozenById.get(item.catalogItemId)?.contentHash === item.contentHash);
  const itemIds = new Set(items.map((item) => item.catalogItemId));
  const decisions = input.decisions.filter((decision) => {
    const frozen = frozenById.get(decision.catalogItemId);
    return Boolean(
      frozen
      && itemIds.has(decision.catalogItemId)
      && frozen.reviewSourceHash === decision.reviewSourceHash
    );
  });
  const decisionIds = new Set(decisions.map((decision) => decision.catalogItemId));
  return {
    items: items.filter((item) => decisionIds.has(item.catalogItemId)),
    decisions,
  };
}

export function loadFrozenTerminalValidationOverlay() {
  const overlay = buildTerminalValidationOverlayCatalog();
  return selectFrozenTerminalValidationOverlay({
    items: overlay.items,
    decisions: buildTerminalValidationReviewDecisions(overlay.items),
  });
}

export function buildTerminalValidationOverlayCatalog() {
  return buildAdaptiveAssessmentItemCatalog({
    presetQuestions: [],
    prismaQuestions: [],
    acqStaticQuestions: [],
    icourseObjectiveBankItems: [],
    kaqReviewedItems: [],
    generatedQuestions: [],
    checkpointQuestions: REVIEWED_TERMINAL_VALIDATION_QUESTIONS,
  });
}

export function buildTerminalValidationReviewDecisions(
  items: AdaptiveAssessmentCatalogItem[],
): AssessmentItemSemanticReviewDecision[] {
  const recordsById = new Map(REVIEWED_TERMINAL_VALIDATION_QUESTIONS.map((record) => [record.id, record]));
  return items.flatMap((item) => {
    const record = recordsById.get(item.sourceId);
    if (!record || item.sourceFamily !== 'checkpoint-authored-question') return [];
    const decision: AssessmentItemSemanticReviewDecision = {
      catalogItemId: item.catalogItemId,
      decisionKind: 'human-review',
      outcome: 'approved',
      reviewerId: record.reviewerId,
      reviewerRole: record.reviewerRole,
      reviewedAt: record.reviewedAt,
      reviewBatchId: TERMINAL_VALIDATION_REVIEW_BATCH_ID,
      sourceContentHash: item.contentHash,
      selectedLearningGoalIds: [record.learningGoalId],
      selectedKaqObjectiveIds: [...record.kaqObjectiveIds],
      selectedGraphNodeIds: [...record.graphNodeIds],
      selectedStagePurpose: 'terminal-validation',
      difficulty: record.difficulty,
      cognitiveLevel: record.cognitiveLevel,
      misconceptionRefs: [...record.misconceptionTags],
      remediationRefs: [...record.remediationResourceNodeIds],
      metadataVersionRefs: Object.fromEntries(
        Object.entries(item.versionRefs).filter(([key]) => ![
          'catalogVersion',
          'adaptiveAssessmentSnapshotVersion',
          'kaqFoundationVersion',
          'acqStaticQuestionBankVersion',
          'icourseObjectiveBankVersion',
        ].includes(key)),
      ),
      notes: [
        `Independent terminal-validation review for ${record.learningGoalId}.`,
        'This decision does not authorize checkpoint, practice, or readiness reuse.',
        `Review batch ${TERMINAL_VALIDATION_REVIEW_BATCH_ID} is distinct from checkpoint authored reviews.`,
      ].join(' '),
    };
    return [{
      ...decision,
      reviewSourceHash: assessmentItemSemanticReviewSourceHash(decision),
    }];
  });
}

function decisionLifecycleStage(
  decision: AssessmentItemSemanticReviewDecision | null,
): LifecycleCoverageStage | null {
  return decision ? lifecycleStageFromCatalogStage(decision.selectedStagePurpose) : null;
}

function isApprovedDecision(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision | null,
): decision is AssessmentItemSemanticReviewDecision {
  return Boolean(
    decision
    && decision.decisionKind === 'human-review'
    && decision.outcome === 'approved'
    && decision.reviewerId
    && decision.reviewedAt
    && decision.reviewBatchId
    && decision.sourceContentHash === item.contentHash
    && getAssessmentItemSemanticReviewDecisionIssues(item, decision).length === 0,
  );
}

function itemAllowedForStage(item: AdaptiveAssessmentCatalogItem, stage: LifecycleCoverageStage): boolean {
  return catalogStagesForLifecycleStage(stage).some((catalogStage) => item.allowedStages.includes(catalogStage));
}

function learningGoalIdsFor(entry: CountableItem): string[] {
  const fromDecision = entry.decision?.selectedLearningGoalIds ?? [];
  return uniqueSorted([...entry.item.semanticRefs.learningGoalIds, ...fromDecision]);
}

function layerCatalogItemIds(
  entries: CountableItem[],
  stage: LifecycleCoverageStage,
  layer: LifecycleCoverageLayer,
  policy: LifecycleCoveragePolicy,
  baselineIds: Set<string>,
): string[] {
  return uniqueSorted(entries.filter((entry) => {
    const allowed = itemAllowedForStage(entry.item, stage);
    const approved = isApprovedDecision(entry.item, entry.decision) && decisionLifecycleStage(entry.decision) === stage;
    const eligible = approved
      && entry.item.eligibilityState === 'path-eligible'
      && entry.item.reviewState === 'path-eligible';
    const runtimeRegistered = eligible && entry.runtimeRegistered;
    const selectable = runtimeRegistered
      && baselineIds.has(entry.item.catalogItemId)
      && !policy.forbiddenSelectableFamilies.includes(entry.item.sourceFamily);
    if (layer === 'registered') {
      return allowed || lifecycleStageFromCatalogStage(entry.item.semanticRefs.assessmentStage) === stage;
    }
    if (layer === 'allowed') return allowed;
    if (layer === 'approved') return approved;
    if (layer === 'eligible') return eligible;
    if (layer === 'runtimeRegistered') return runtimeRegistered;
    return selectable;
  }).map((entry) => entry.item.catalogItemId));
}

function sourceMixFor(
  entries: CountableItem[],
  catalogItemIds: string[],
): Partial<Record<AdaptiveAssessmentCatalogSourceFamily, number>> {
  const wanted = new Set(catalogItemIds);
  const mix: Partial<Record<AdaptiveAssessmentCatalogSourceFamily, number>> = {};
  for (const entry of entries) {
    if (!wanted.has(entry.item.catalogItemId)) continue;
    mix[entry.item.sourceFamily] = (mix[entry.item.sourceFamily] ?? 0) + 1;
  }
  return mix;
}

function cellLimitations(
  cell: Omit<LifecycleCoverageCell, 'limitations' | 'status'>,
  entries: CountableItem[],
  policy: LifecycleCoveragePolicy,
): string[] {
  const limitations: string[] = [];
  if (cell.counts.registered === 0) limitations.push(`missing-${cell.stage}-registered-items`);
  if (cell.counts.selectable < cell.requiredCount) {
    limitations.push(`minimum-selectable-${cell.stage}-coverage-not-met`);
  }
  if (cell.counts.allowed > 0 && cell.counts.approved === 0) {
    limitations.push('allowed-stage-is-not-approved-coverage');
  }
  const approvedEntries = entries.filter((entry) =>
    cell.catalogItemIds.approved.includes(entry.item.catalogItemId)
  );
  if (policy.highRiskStages.includes(cell.stage)) {
    for (const entry of approvedEntries) {
      if (entry.item.sourceFamily === 'generated-adaptive-question') {
        limitations.push('generated-item-cannot-fill-high-risk-stage');
      }
    }
  }
  return uniqueSorted(limitations);
}

export function detectLifecycleBaselineDrift(
  frozen: LifecycleBaselineEntry[],
  current: LifecycleBaselineEntry[],
): string[] {
  const frozenById = new Map(frozen.map((entry) => [entry.catalogItemId, entry.contentHash]));
  const currentById = new Map(current.map((entry) => [entry.catalogItemId, entry.contentHash]));
  const drift: string[] = [];
  for (const [catalogItemId, contentHash] of frozenById) {
    const currentHash = currentById.get(catalogItemId);
    if (!currentHash) drift.push(`baseline-item-missing:${catalogItemId}`);
    else if (currentHash !== contentHash) drift.push(`content-hash-drift:${catalogItemId}`);
  }
  for (const catalogItemId of currentById.keys()) {
    if (!frozenById.has(catalogItemId)) drift.push(`baseline-item-extra:${catalogItemId}`);
  }
  return uniqueSorted(drift);
}

export function buildAdaptiveAssessmentLifecycleCoverage(input: {
  items: AdaptiveAssessmentCatalogItem[];
  decisions: AssessmentItemSemanticReviewDecision[];
  overlayItems?: AdaptiveAssessmentCatalogItem[];
  overlayDecisions?: AssessmentItemSemanticReviewDecision[];
  runtimeRegisteredCatalogItemIds?: Iterable<string>;
  policy?: LifecycleCoveragePolicy;
  frozenBaseline?: LifecycleBaselineEntry[];
  generatedAt?: string;
  strictBaseline?: boolean;
}): LifecycleCoverageArtifacts {
  const policy = input.policy ?? DEFAULT_LIFECYCLE_COVERAGE_V2_POLICY;
  const goals = lifecycleCoverageGoals();
  const items = [...input.items, ...(input.overlayItems ?? [])];
  const decisions = [...input.decisions, ...(input.overlayDecisions ?? [])];
  const runtimeRegistered = new Set(
    input.runtimeRegisteredCatalogItemIds
      ?? items
        .filter((item) => item.sourceFamily === 'checkpoint-authored-question' && item.eligibilityState === 'path-eligible')
        .map((item) => item.catalogItemId),
  );
  const decisionsByItemId = new Map(decisions.map((decision) => [decision.catalogItemId, decision]));
  const countable: CountableItem[] = items.map((item) => ({
    item,
    decision: decisionsByItemId.get(item.catalogItemId) ?? null,
    runtimeRegistered: runtimeRegistered.has(item.catalogItemId),
  }));

  const defaultBaselineIds = new Set(
    countable
      .filter((entry) => (
        isApprovedDecision(entry.item, entry.decision)
        && entry.item.eligibilityState === 'path-eligible'
        && entry.runtimeRegistered
        && !policy.forbiddenSelectableFamilies.includes(entry.item.sourceFamily)
      ))
      .map((entry) => entry.item.catalogItemId),
  );
  const frozenBaseline = input.frozenBaseline ?? [...defaultBaselineIds].sort().map((catalogItemId) => {
    const item = items.find((entry) => entry.catalogItemId === catalogItemId)!;
    return { catalogItemId, contentHash: item.contentHash };
  });
  const baselineIds = new Set(frozenBaseline.map((entry) => entry.catalogItemId));
  const currentBaseline = frozenBaseline.map((entry) => {
    const item = items.find((candidate) => candidate.catalogItemId === entry.catalogItemId);
    return { catalogItemId: entry.catalogItemId, contentHash: item?.contentHash ?? entry.contentHash };
  });
  const drift = detectLifecycleBaselineDrift(frozenBaseline, currentBaseline);
  if (input.strictBaseline && drift.length > 0) {
    throw new Error(`lifecycle-coverage-baseline-drift:${drift.join(',')}`);
  }

  const rows = goals.map((goal) => {
    const goalEntries = countable.filter((entry) => learningGoalIdsFor(entry).includes(goal.id));
    const cells = LIFECYCLE_COVERAGE_STAGES.map((stage) => {
      const catalogItemIds = {
        registered: layerCatalogItemIds(goalEntries, stage, 'registered', policy, baselineIds),
        allowed: layerCatalogItemIds(goalEntries, stage, 'allowed', policy, baselineIds),
        approved: layerCatalogItemIds(goalEntries, stage, 'approved', policy, baselineIds),
        eligible: layerCatalogItemIds(goalEntries, stage, 'eligible', policy, baselineIds),
        runtimeRegistered: layerCatalogItemIds(goalEntries, stage, 'runtimeRegistered', policy, baselineIds),
        selectable: layerCatalogItemIds(goalEntries, stage, 'selectable', policy, baselineIds),
      };
      const counts: LifecycleCoverageLayerCounts = {
        registered: catalogItemIds.registered.length,
        allowed: catalogItemIds.allowed.length,
        approved: catalogItemIds.approved.length,
        eligible: catalogItemIds.eligible.length,
        runtimeRegistered: catalogItemIds.runtimeRegistered.length,
        selectable: catalogItemIds.selectable.length,
      };
      const partialCell = {
        learningGoalId: goal.id,
        stage,
        requiredCount: policy.stageMinimums[stage],
        counts,
        catalogItemIds,
        sourceMix: sourceMixFor(goalEntries, catalogItemIds.selectable),
      };
      const limitations = cellLimitations(partialCell, goalEntries, policy);
      return {
        ...partialCell,
        status: (limitations.length ? 'incomplete' : 'complete') as LifecycleCoverageCellStatus,
        limitations,
      };
    });
    return {
      learningGoalId: goal.id,
      title: goal.title,
      cells,
      incompleteStages: cells.filter((cell) => cell.status === 'incomplete').map((cell) => cell.stage),
    };
  });

  const itemRecords: LifecycleCoverageItemRecord[] = countable.map((entry) => {
    const approved = isApprovedDecision(entry.item, entry.decision);
    const eligible = approved
      && entry.item.eligibilityState === 'path-eligible'
      && entry.item.reviewState === 'path-eligible';
    const selectable = eligible
      && entry.runtimeRegistered
      && baselineIds.has(entry.item.catalogItemId)
      && !policy.forbiddenSelectableFamilies.includes(entry.item.sourceFamily);
    const missingLayers: LifecycleCoverageLayer[] = [];
    if (entry.item.allowedStages.length === 0) missingLayers.push('allowed');
    if (!approved) missingLayers.push('approved');
    if (!eligible) missingLayers.push('eligible');
    if (!entry.runtimeRegistered) missingLayers.push('runtimeRegistered');
    if (!selectable) missingLayers.push('selectable');
    return {
      catalogItemId: entry.item.catalogItemId,
      contentHash: entry.item.contentHash,
      sourceFamily: entry.item.sourceFamily,
      learningGoalIds: learningGoalIdsFor(entry),
      allowedStages: entry.item.allowedStages,
      approvedStagePurpose: entry.decision?.selectedStagePurpose ?? null,
      eligibilityState: entry.item.eligibilityState,
      runtimeRegistered: entry.runtimeRegistered,
      lifecycleBaselineId: baselineIds.has(entry.item.catalogItemId) ? policy.releaseId : null,
      lifecycleVersion: baselineIds.has(entry.item.catalogItemId) ? policy.baselineVersion : null,
      missingLayers,
    };
  }).sort((left, right) => left.catalogItemId.localeCompare(right.catalogItemId));

  const completeCells = rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell.status === 'complete').length, 0);
  const incompleteCells = rows.reduce((sum, row) => sum + row.cells.filter((cell) => cell.status === 'incomplete').length, 0);
  const inputDigest = createHash('sha256')
    .update(JSON.stringify({
      itemIds: items.map((item) => [item.catalogItemId, item.contentHash]),
      decisionIds: decisions.map((decision) => [decision.catalogItemId, decision.sourceContentHash, decision.reviewBatchId]),
      policy,
    }))
    .digest('hex');

  return {
    matrix: {
      artifactVersion: LIFECYCLE_COVERAGE_V2_VERSION,
      releaseId: policy.releaseId,
      generatedAt: input.generatedAt ?? '2026-08-21T00:00:00.000Z',
      practiceV1BaselineVersion: policy.practiceV1BaselineVersion,
      learningGoalIds: goals.map((goal) => goal.id),
      stageMinimums: policy.stageMinimums,
      inputDigest,
      rows,
      totals: {
        learningGoalCount: goals.length,
        completeCells,
        incompleteCells,
      },
    },
    itemRecords,
    baseline: {
      version: policy.baselineVersion,
      releaseId: policy.releaseId,
      entries: frozenBaseline,
    },
    drift,
  };
}

export function lifecycleCoverageArtifactsToFiles(artifacts: LifecycleCoverageArtifacts) {
  return {
    matrix: `${JSON.stringify(artifacts.matrix, null, 2)}\n`,
    policy: `${JSON.stringify(DEFAULT_LIFECYCLE_COVERAGE_V2_POLICY, null, 2)}\n`,
    items: `${artifacts.itemRecords.map((record) => JSON.stringify(record)).join('\n')}\n`,
    baseline: `${JSON.stringify(artifacts.baseline, null, 2)}\n`,
  };
}
