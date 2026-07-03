import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import {
  buildCheckpointAuthoredSemanticReviewDecisions,
  buildKaqFoundationSemanticReviewDecisions,
  mergeAssessmentItemSemanticReviewDecisions,
  type AssessmentItemSemanticReviewDecision,
} from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  buildLearningGoalAssessmentCoverageArtifacts,
  learningGoalAssessmentCoverageArtifactsToFiles,
} from '@/features/adaptive-assessment/learning-goal-assessment-coverage';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/lib/adaptive-learning-path-planner';
import { FIRST_BATCH_LEARNING_GOAL_IDS } from '@/lib/learning-goal-resource-baseline';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const SNAPSHOTS_PATH = path.join(OUTPUT_DIR, 'assessment-item-semantic-review-snapshots.jsonl');
const MATRIX_PATH = path.join(OUTPUT_DIR, 'learning-goal-assessment-coverage-matrix.json');

async function readExistingReviewSnapshots(): Promise<AssessmentItemSemanticReviewDecision[]> {
  try {
    const input = await readFile(SNAPSHOTS_PATH, 'utf8');
    return input
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AssessmentItemSemanticReviewDecision);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function main() {
  const sources = await loadAdaptiveAssessmentCatalogSources();
  const catalog = buildAdaptiveAssessmentItemCatalog({
    acqStaticQuestions: sources.acqStaticQuestions,
    icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
    icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
    kaqReviewedItems: sources.kaqReviewedItems,
  });
  const decisions = mergeAssessmentItemSemanticReviewDecisions(
    await readExistingReviewSnapshots(),
    [
      ...buildKaqFoundationSemanticReviewDecisions(catalog.items, sources.kaqReviewedItems),
      ...buildCheckpointAuthoredSemanticReviewDecisions(catalog.items),
    ],
  );
  const goals = FIRST_BATCH_LEARNING_GOAL_IDS.map((goalId) => {
    const definition = ADAPTIVE_LEARNING_GOAL_DEFINITIONS[goalId].learningGoal!;
    return {
      id: definition.id,
      title: definition.title,
      terminalValidationRequired: definition.terminalValidationPolicy.required,
      acceptedTerminalEvidenceTypes: definition.terminalValidationPolicy.acceptedEvidenceTypes,
    };
  });
  const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
    items: catalog.items,
    decisions,
    goals,
  });
  const files = learningGoalAssessmentCoverageArtifactsToFiles(artifacts);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(MATRIX_PATH, files.matrix);

  console.log(JSON.stringify({
    learningGoals: artifacts.matrix.totals.learningGoalCount,
    complete: artifacts.matrix.totals.complete,
    limited: artifacts.matrix.totals.limited,
    reviewedPathEligibleItemCount: artifacts.matrix.totals.reviewedPathEligibleItemCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
