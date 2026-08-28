import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import {
  loadAssessmentItemSemanticReviewSource,
} from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import {
  buildLearningGoalAssessmentCoverageArtifacts,
  learningGoalAssessmentCoverageArtifactsToFiles,
} from '@/features/adaptive-assessment/learning-goal-assessment-coverage';
import { ADAPTIVE_LEARNING_GOAL_DEFINITIONS } from '@/features/personalization/path-planning/public-api';
import { CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH } from '@/lib/resource-node-path-readiness-review-batch';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const MATRIX_PATH = path.join(OUTPUT_DIR, 'learning-goal-assessment-coverage-matrix.json');
const BASELINE_MATRIX_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-matrix.json');
const CORE_SEMANTIC_REVIEW_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-review-source.jsonl');

type LearningGoalResourceBaselineMatrix = {
  registeredLearningGoalIds?: string[];
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
      resourceIds?: string[];
      pathEligibleResourceIds?: string[];
    }>;
  }>;
};

type CoreSemanticReviewRow = {
  resourceId?: string;
  learningGoalIds?: string[];
};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

async function loadRegisteredSemanticIds() {
  const matrix = JSON.parse(await readFile(BASELINE_MATRIX_PATH, 'utf8')) as LearningGoalResourceBaselineMatrix;
  const coreReviewRows = await loadCoreSemanticReviewRows();
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
      ...coreReviewRows.map((row) => row.resourceId),
    ]),
  };
}

async function loadCoreSemanticReviewRows(): Promise<CoreSemanticReviewRow[]> {
  return (await readFile(CORE_SEMANTIC_REVIEW_PATH, 'utf8'))
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .map((line) => JSON.parse(line) as CoreSemanticReviewRow);
}

async function loadLearningGoalSemanticBoundaries() {
  const matrix = JSON.parse(await readFile(BASELINE_MATRIX_PATH, 'utf8')) as LearningGoalResourceBaselineMatrix;
  const coreReviewRows = await loadCoreSemanticReviewRows();
  return new Map((matrix.rows ?? [])
    .filter((row): row is Required<Pick<LearningGoalResourceBaselineMatrix['rows'][number], 'learningGoalId'>> & NonNullable<LearningGoalResourceBaselineMatrix['rows'][number]> =>
      Boolean(row.learningGoalId)
    )
    .map((row) => [
      row.learningGoalId,
      {
        kaqObjectiveIds: uniqueSorted([
          ...(row.objectiveBoundary?.knowledgeObjectiveIds ?? []),
          ...(row.objectiveBoundary?.capabilityObjectiveIds ?? []),
          ...(row.objectiveBoundary?.qualityObjectiveIds ?? []),
        ]),
        graphNodeIds: uniqueSorted(row.targetGraphNodeIds ?? []),
        remediationResourceNodeIds: uniqueSorted([
          ...Object.values(row.categories ?? {}).flatMap((category) => category.resourceIds ?? []),
          ...coreReviewRows
            .filter((review) => review.learningGoalIds?.includes(row.learningGoalId!))
            .map((review) => review.resourceId),
        ]),
      },
    ]));
}

async function main() {
  const sources = await loadAdaptiveAssessmentCatalogSources();
  const catalog = buildAdaptiveAssessmentItemCatalog({
    acqStaticQuestions: sources.acqStaticQuestions,
    icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
    icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
    kaqReviewedItems: sources.kaqReviewedItems,
  });
  const decisions = await loadAssessmentItemSemanticReviewSource(catalog.items);
  const learningGoalSemanticBoundaries = await loadLearningGoalSemanticBoundaries();
  const registeredSemanticIds = await loadRegisteredSemanticIds();
  const goals = Object.values(ADAPTIVE_LEARNING_GOAL_DEFINITIONS)
    .filter((registeredGoal) => Boolean(registeredGoal.learningGoal))
    .map((registeredGoal) => {
      const definition = registeredGoal.learningGoal!;
      return {
        id: definition.id,
        title: definition.title,
        terminalValidationRequired: definition.terminalValidationPolicy.required,
        acceptedTerminalEvidenceTypes: definition.terminalValidationPolicy.acceptedEvidenceTypes,
        semanticBoundary: learningGoalSemanticBoundaries.get(definition.id),
      };
    });
  const artifacts = buildLearningGoalAssessmentCoverageArtifacts({
    items: catalog.items,
    decisions,
    goals,
    generatedAt: process.env.RESOURCE_FIELD_COMPLETION_GENERATED_AT,
    knownLearningGoalIds: goals.map((goal) => goal.id),
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
