import fs from 'node:fs';
import path from 'node:path';

import type { AdaptiveLearningPathGraphContextInput } from '@/features/personalization/path-planning/public-api';
import type { LearningGoalResourceBaselineMatrixRow } from './learning-goal-resource-baseline';

type PlannerLearningGoalBaseline = NonNullable<AdaptiveLearningPathGraphContextInput['learningGoalBaseline']>;

const BASELINE_MATRIX_PATH = path.join(
  process.cwd(),
  'course-content',
  'runtime',
  'resource-governance',
  'learning-goal-resource-baseline-matrix.json',
);

let baselineByGoalId: Map<string, LearningGoalResourceBaselineMatrixRow> | null = null;

export function getLearningGoalResourceBaselineForPlanner(
  learningGoalId: string,
): PlannerLearningGoalBaseline | null {
  const row = getBaselineByGoalId().get(learningGoalId);
  if (!row) return null;
  return {
    coverageState: row.coverageState,
    missingBaselineCategories: row.missingBaselineCategories,
    reviewedBindingCount: row.denominator.reviewedBindingCount,
    limitationReason: row.limitationReason,
    sourceWindow: row.denominator.sourceWindow,
  };
}

function getBaselineByGoalId(): Map<string, LearningGoalResourceBaselineMatrixRow> {
  if (baselineByGoalId) return baselineByGoalId;
  const baselineRows = loadBaselineRows();
  baselineByGoalId = new Map(baselineRows.map((row) => [row.learningGoalId, row]));
  return baselineByGoalId;
}

function loadBaselineRows(): LearningGoalResourceBaselineMatrixRow[] {
  try {
    if (!fs.existsSync(BASELINE_MATRIX_PATH)) return [];
    const matrix = JSON.parse(fs.readFileSync(BASELINE_MATRIX_PATH, 'utf8')) as {
      rows?: LearningGoalResourceBaselineMatrixRow[];
    };
    return matrix.rows ?? [];
  } catch {
    return [];
  }
}
