import learningGoalResourceBaselineMatrix from '../../course-content/runtime/resource-governance/learning-goal-resource-baseline-matrix.json';

import type { AdaptiveLearningPathGraphContextInput } from './adaptive-learning-path-planner';
import type { LearningGoalResourceBaselineMatrixRow } from './learning-goal-resource-baseline';

type PlannerLearningGoalBaseline = NonNullable<AdaptiveLearningPathGraphContextInput['learningGoalBaseline']>;

const baselineRows = (learningGoalResourceBaselineMatrix as {
  rows?: LearningGoalResourceBaselineMatrixRow[];
}).rows ?? [];

const baselineByGoalId = new Map(baselineRows.map((row) => [row.learningGoalId, row]));

export function getLearningGoalResourceBaselineForPlanner(
  learningGoalId: string,
): PlannerLearningGoalBaseline | null {
  const row = baselineByGoalId.get(learningGoalId);
  if (!row) return null;
  return {
    coverageState: row.coverageState,
    missingBaselineCategories: row.missingBaselineCategories,
    reviewedBindingCount: row.denominator.reviewedBindingCount,
    limitationReason: row.limitationReason,
    sourceWindow: row.denominator.sourceWindow,
  };
}
