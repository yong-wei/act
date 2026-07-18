import learningGoalAssessmentCoverageMatrix from '../../course-content/runtime/resource-governance/learning-goal-assessment-coverage-matrix.json';

import type { AdaptiveLearningPathGraphContextInput } from './adaptive-learning-path-planner';
import type { LearningGoalAssessmentCoverageMatrixRow } from '@/features/adaptive-assessment/learning-goal-assessment-coverage';

type PlannerLearningGoalAssessmentCoverage = NonNullable<AdaptiveLearningPathGraphContextInput['assessmentCoverage']>;

const matrix = learningGoalAssessmentCoverageMatrix as unknown as {
  artifactVersion?: string;
  generatedAt?: string;
  rows?: LearningGoalAssessmentCoverageMatrixRow[];
};

const coverageByGoalId = new Map((matrix.rows ?? []).map((row) => [row.learningGoalId, row]));

export function getLearningGoalAssessmentCoverageForPlanner(
  learningGoalId: string,
): PlannerLearningGoalAssessmentCoverage {
  const row = coverageByGoalId.get(learningGoalId);
  if (!row) {
    return {
      coverageState: 'limited',
      incompleteStages: ['readiness', 'practice', 'checkpoint', 'remediation'],
      reviewedPathEligibleItemCount: 0,
      limitationReason: `learning-goal-assessment-coverage-missing:${learningGoalId}`,
      matrixVersion: matrix.artifactVersion ?? 'learning-goal-assessment-coverage.unavailable',
      generatedAt: matrix.generatedAt ?? null,
      terminalValidationRequired: true,
      assessmentItemsReplaceTerminalEvidence: false,
    };
  }
  return {
    coverageState: row.assessmentCoverageState,
    incompleteStages: row.incompleteStages,
    reviewedPathEligibleItemCount: row.reviewedPathEligibleItemCount,
    limitationReason: row.limitationReason,
    matrixVersion: matrix.artifactVersion ?? 'learning-goal-assessment-coverage.unavailable',
    generatedAt: matrix.generatedAt ?? null,
    terminalValidationRequired: row.terminalValidationSupport.required,
    assessmentItemsReplaceTerminalEvidence: false,
  };
}
