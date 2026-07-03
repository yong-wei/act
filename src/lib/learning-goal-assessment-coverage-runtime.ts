import learningGoalAssessmentCoverageMatrix from '../../course-content/runtime/resource-governance/learning-goal-assessment-coverage-matrix.json';

import type { AdaptiveLearningPathGraphContextInput } from './adaptive-learning-path-planner';
import type { LearningGoalAssessmentCoverageMatrixRow } from '@/features/adaptive-assessment/learning-goal-assessment-coverage';

type PlannerLearningGoalAssessmentCoverage = NonNullable<AdaptiveLearningPathGraphContextInput['assessmentCoverage']>;

const matrix = learningGoalAssessmentCoverageMatrix as {
  artifactVersion?: string;
  generatedAt?: string;
  rows?: LearningGoalAssessmentCoverageMatrixRow[];
};

const coverageByGoalId = new Map((matrix.rows ?? []).map((row) => [row.learningGoalId, row]));

export function getLearningGoalAssessmentCoverageForPlanner(
  learningGoalId: string,
): PlannerLearningGoalAssessmentCoverage | null {
  const row = coverageByGoalId.get(learningGoalId);
  if (!row) return null;
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
