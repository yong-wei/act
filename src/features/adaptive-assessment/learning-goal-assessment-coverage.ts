import type {
  AdaptiveAssessmentCatalogItem,
  AdaptiveAssessmentCatalogSourceFamily,
} from './adaptive-assessment-item-catalog';
import {
  getAssessmentItemSemanticReviewDecisionIssues,
  type AssessmentItemSemanticReviewDecision,
} from './adaptive-assessment-semantic-review';

export const LEARNING_GOAL_ASSESSMENT_COVERAGE_VERSION = 'learning-goal-assessment-coverage.v1';

export type LearningGoalAssessmentStage = 'readiness' | 'practice' | 'checkpoint' | 'remediation';
export type LearningGoalAssessmentCoverageState = 'complete' | 'limited';

export const LEARNING_GOAL_ASSESSMENT_STAGE_REQUIREMENTS: Record<LearningGoalAssessmentStage, number> = {
  readiness: 3,
  practice: 6,
  checkpoint: 3,
  remediation: 3,
};

export interface LearningGoalAssessmentCoverageGoal {
  id: string;
  title: string;
  terminalValidationRequired: boolean;
  acceptedTerminalEvidenceTypes: string[];
}

export interface LearningGoalAssessmentCoverageStageRow {
  stage: LearningGoalAssessmentStage;
  requiredCount: number;
  reviewedPathEligibleCount: number;
  status: LearningGoalAssessmentCoverageState;
  countedCatalogItemIds: string[];
  sourceMix: Partial<Record<AdaptiveAssessmentCatalogSourceFamily, number>>;
  kaqObjectiveCoverage: string[];
  graphNodeCoverage: string[];
  difficultyDistribution: {
    low: number;
    medium: number;
    high: number;
  };
  cognitiveLevelDistribution: Record<string, number>;
  misconceptionCoverage: string[];
  remediationResourceNodeIds: string[];
  blockers: string[];
  limitationReasons: string[];
}

export interface LearningGoalAssessmentCoverageMatrixRow {
  learningGoalId: string;
  title: string;
  assessmentCoverageState: LearningGoalAssessmentCoverageState;
  incompleteStages: LearningGoalAssessmentStage[];
  reviewedPathEligibleItemCount: number;
  stageCoverage: LearningGoalAssessmentCoverageStageRow[];
  terminalValidationSupport: {
    required: boolean;
    acceptedEvidenceTypes: string[];
    assessmentItemsReplaceTerminalEvidence: false;
    limitationReason: string | null;
  };
  limitationReason: string | null;
}

export interface LearningGoalAssessmentCoverageArtifacts {
  matrix: {
    artifactVersion: typeof LEARNING_GOAL_ASSESSMENT_COVERAGE_VERSION;
    generatedAt: string;
    batchLearningGoalIds: string[];
    stageRequirements: Record<LearningGoalAssessmentStage, number>;
    rows: LearningGoalAssessmentCoverageMatrixRow[];
    totals: {
      learningGoalCount: number;
      complete: number;
      limited: number;
      reviewedPathEligibleItemCount: number;
    };
  };
}

interface CountableAssessmentItem {
  item: AdaptiveAssessmentCatalogItem;
  decision: AssessmentItemSemanticReviewDecision;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function decisionStage(decision: AssessmentItemSemanticReviewDecision): LearningGoalAssessmentStage | null {
  if (decision.selectedStagePurpose === 'readiness' || decision.selectedStagePurpose === 'readiness-gate' || decision.selectedStagePurpose === 'precheck') {
    return 'readiness';
  }
  if (decision.selectedStagePurpose === 'checkpoint') return 'checkpoint';
  if (decision.selectedStagePurpose === 'remediation') return 'remediation';
  if (decision.selectedStagePurpose === 'practice' || decision.selectedStagePurpose === 'low-stakes-practice') return 'practice';
  return null;
}

function isCountableReviewedPathEligibleItem(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision | undefined,
): decision is AssessmentItemSemanticReviewDecision {
  return Boolean(
    decision
    && decision.decisionKind === 'human-review'
    && decision.outcome === 'approved'
    && decision.reviewerId
    && decision.reviewedAt
    && decision.reviewBatchId
    && decision.sourceContentHash === item.contentHash
    && item.eligibilityState === 'path-eligible'
    && item.reviewState === 'path-eligible'
    && item.sourceFamily !== 'generated-adaptive-question'
    && getAssessmentItemSemanticReviewDecisionIssues(item, decision).length === 0
  );
}

function itemCountsForStage(
  entry: CountableAssessmentItem,
  stage: LearningGoalAssessmentStage,
): boolean {
  return decisionStage(entry.decision) === stage;
}

function difficultyBand(value: number | undefined): keyof LearningGoalAssessmentCoverageStageRow['difficultyDistribution'] {
  if (typeof value !== 'number') return 'medium';
  if (value < 0.4) return 'low';
  if (value >= 0.7) return 'high';
  return 'medium';
}

function stageRow(
  stage: LearningGoalAssessmentStage,
  entries: CountableAssessmentItem[],
): LearningGoalAssessmentCoverageStageRow {
  const counted = entries.filter((entry) => itemCountsForStage(entry, stage));
  const requiredCount = LEARNING_GOAL_ASSESSMENT_STAGE_REQUIREMENTS[stage];
  const sourceMix: Partial<Record<AdaptiveAssessmentCatalogSourceFamily, number>> = {};
  const difficultyDistribution = { low: 0, medium: 0, high: 0 };
  const cognitiveLevelDistribution: Record<string, number> = {};
  for (const entry of counted) {
    sourceMix[entry.item.sourceFamily] = (sourceMix[entry.item.sourceFamily] ?? 0) + 1;
    difficultyDistribution[difficultyBand(entry.decision.difficulty)] += 1;
    const cognitiveLevel = entry.decision.cognitiveLevel ?? 'unknown';
    cognitiveLevelDistribution[cognitiveLevel] = (cognitiveLevelDistribution[cognitiveLevel] ?? 0) + 1;
  }
  const blockers = counted.length >= requiredCount
    ? []
    : [`minimum-reviewed-${stage}-coverage-not-met`];
  return {
    stage,
    requiredCount,
    reviewedPathEligibleCount: counted.length,
    status: blockers.length ? 'limited' : 'complete',
    countedCatalogItemIds: counted.map((entry) => entry.item.catalogItemId).sort(),
    sourceMix,
    kaqObjectiveCoverage: uniqueSorted(counted.flatMap((entry) => entry.decision.selectedKaqObjectiveIds)),
    graphNodeCoverage: uniqueSorted(counted.flatMap((entry) => entry.decision.selectedGraphNodeIds)),
    difficultyDistribution,
    cognitiveLevelDistribution,
    misconceptionCoverage: uniqueSorted(counted.flatMap((entry) => entry.decision.misconceptionRefs)),
    remediationResourceNodeIds: uniqueSorted(counted.flatMap((entry) => entry.decision.remediationRefs)),
    blockers,
    limitationReasons: blockers,
  };
}

export function buildLearningGoalAssessmentCoverageArtifacts(input: {
  items: AdaptiveAssessmentCatalogItem[];
  decisions: AssessmentItemSemanticReviewDecision[];
  goals: LearningGoalAssessmentCoverageGoal[];
  generatedAt?: string;
}): LearningGoalAssessmentCoverageArtifacts {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const itemsById = new Map(input.items.map((item) => [item.catalogItemId, item]));
  const countableByGoal = new Map<string, CountableAssessmentItem[]>();
  for (const decision of input.decisions) {
    const item = itemsById.get(decision.catalogItemId);
    if (!item || !isCountableReviewedPathEligibleItem(item, decision)) continue;
    for (const learningGoalId of decision.selectedLearningGoalIds) {
      const list = countableByGoal.get(learningGoalId) ?? [];
      list.push({ item, decision });
      countableByGoal.set(learningGoalId, list);
    }
  }

  const rows = input.goals.map((goal): LearningGoalAssessmentCoverageMatrixRow => {
    const entries = countableByGoal.get(goal.id) ?? [];
    const stageCoverage = (Object.keys(LEARNING_GOAL_ASSESSMENT_STAGE_REQUIREMENTS) as LearningGoalAssessmentStage[])
      .map((stage) => stageRow(stage, entries));
    const incompleteStages = stageCoverage
      .filter((row) => row.status === 'limited')
      .map((row) => row.stage);
    const limitationReason = incompleteStages.length
      ? `minimum-assessment-coverage-incomplete:${incompleteStages.join(',')}`
      : null;
    return {
      learningGoalId: goal.id,
      title: goal.title,
      assessmentCoverageState: incompleteStages.length ? 'limited' : 'complete',
      incompleteStages,
      reviewedPathEligibleItemCount: uniqueSorted(entries.map((entry) => entry.item.catalogItemId)).length,
      stageCoverage,
      terminalValidationSupport: {
        required: goal.terminalValidationRequired,
        acceptedEvidenceTypes: goal.acceptedTerminalEvidenceTypes,
        assessmentItemsReplaceTerminalEvidence: false,
        limitationReason: goal.terminalValidationRequired
          ? 'assessment-items-support-diagnosis-but-do-not-replace-typed-terminal-evidence'
          : null,
      },
      limitationReason,
    };
  });

  return {
    matrix: {
      artifactVersion: LEARNING_GOAL_ASSESSMENT_COVERAGE_VERSION,
      generatedAt,
      batchLearningGoalIds: input.goals.map((goal) => goal.id),
      stageRequirements: LEARNING_GOAL_ASSESSMENT_STAGE_REQUIREMENTS,
      rows,
      totals: {
        learningGoalCount: rows.length,
        complete: rows.filter((row) => row.assessmentCoverageState === 'complete').length,
        limited: rows.filter((row) => row.assessmentCoverageState === 'limited').length,
        reviewedPathEligibleItemCount: uniqueSorted(rows.flatMap((row) =>
          row.stageCoverage.flatMap((stage) => stage.countedCatalogItemIds)
        )).length,
      },
    },
  };
}

export function learningGoalAssessmentCoverageArtifactsToFiles(
  artifacts: LearningGoalAssessmentCoverageArtifacts,
) {
  return {
    matrix: `${JSON.stringify(artifacts.matrix, null, 2)}\n`,
  };
}
