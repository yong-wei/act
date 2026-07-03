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
import { CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH } from '@/lib/resource-node-path-readiness-review-batch';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const SNAPSHOTS_PATH = path.join(OUTPUT_DIR, 'assessment-item-semantic-review-snapshots.jsonl');
const MATRIX_PATH = path.join(OUTPUT_DIR, 'learning-goal-assessment-coverage-matrix.json');
const BASELINE_MATRIX_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-matrix.json');

type LearningGoalResourceBaselineMatrix = {
  batchLearningGoalIds?: string[];
  rows?: Array<{
    learningGoalId?: string;
    objectiveBoundary?: {
      knowledgeObjectiveIds?: string[];
      capabilityObjectiveIds?: string[];
      qualityObjectiveIds?: string[];
    };
    targetGraphNodeIds?: string[];
    categories?: Record<string, {
      pathEligibleResourceIds?: string[];
    }>;
  }>;
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

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

async function loadRegisteredSemanticIds() {
  const matrix = JSON.parse(await readFile(BASELINE_MATRIX_PATH, 'utf8')) as LearningGoalResourceBaselineMatrix;
  const rows = matrix.rows ?? [];
  return {
    learningGoalIds: uniqueSorted([
      ...(matrix.batchLearningGoalIds ?? []),
      ...rows.map((row) => row.learningGoalId),
    ]),
    kaqObjectiveIds: uniqueSorted(rows.flatMap((row) => [
      ...(row.objectiveBoundary?.knowledgeObjectiveIds ?? []),
      ...(row.objectiveBoundary?.capabilityObjectiveIds ?? []),
      ...(row.objectiveBoundary?.qualityObjectiveIds ?? []),
    ])),
    graphNodeIds: uniqueSorted(rows.flatMap((row) => row.targetGraphNodeIds ?? [])),
    remediationResourceNodeIds: uniqueSorted([
      ...rows.flatMap((row) =>
        Object.values(row.categories ?? {}).flatMap((category) => category.pathEligibleResourceIds ?? [])
      ),
      ...CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH.reviewedSourceRefs.map((ref) => ref.split('|')[0]),
    ]),
  };
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
  const registeredSemanticIds = await loadRegisteredSemanticIds();
  const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
    items: catalog.items,
    decisions,
    goals,
    knownLearningGoalIds: registeredSemanticIds.learningGoalIds,
    knownKaqObjectiveIds: registeredSemanticIds.kaqObjectiveIds,
    knownGraphNodeIds: registeredSemanticIds.graphNodeIds,
    knownRemediationResourceNodeIds: registeredSemanticIds.remediationResourceNodeIds,
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
