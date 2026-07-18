import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  buildAdaptiveAssessmentItemCatalog,
  loadAdaptiveAssessmentCatalogSources,
} from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import {
  assessmentItemSemanticReviewArtifactsToFiles,
  buildAssessmentItemSemanticReviewArtifacts,
  buildCheckpointAuthoredSemanticReviewDecisions,
  buildKaqFoundationSemanticReviewDecisions,
  mergeAssessmentItemSemanticReviewDecisions,
  sourceReviewShardReplacementPolicy,
  type AssessmentItemSemanticReviewDecision,
} from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';
import { CORE_RESOURCE_PATH_READINESS_REVIEW_BATCH } from '@/lib/resource-node-path-readiness-review-batch';

const OUTPUT_DIR = path.join(process.cwd(), 'course-content/runtime/resource-governance');
const PACKETS_PATH = path.join(OUTPUT_DIR, 'assessment-item-semantic-review-packets.jsonl');
const SNAPSHOTS_PATH = path.join(OUTPUT_DIR, 'assessment-item-semantic-review-snapshots.jsonl');
const COVERAGE_PATH = path.join(OUTPUT_DIR, 'assessment-item-semantic-review-coverage.json');
const REVIEW_DECISION_PATHS = [
  path.join(OUTPUT_DIR, 'assessment-item-semantic-review-acq-decisions.jsonl'),
  path.join(OUTPUT_DIR, 'assessment-item-semantic-review-icourse-decisions.jsonl'),
];
const BASELINE_MATRIX_PATH = path.join(OUTPUT_DIR, 'learning-goal-resource-baseline-matrix.json');
const CORE_SEMANTIC_REVIEW_PATH = path.join(OUTPUT_DIR, 'core-registered-knowledge-resource-semantic-review-source.jsonl');

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

type CoreSemanticReviewRow = {
  resourceId?: string;
  learningGoalIds?: string[];
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

async function readReviewDecisionFile(filePath: string): Promise<AssessmentItemSemanticReviewDecision[]> {
  try {
    const input = await readFile(filePath, 'utf8');
    return input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
      .map((line) => JSON.parse(line) as AssessmentItemSemanticReviewDecision);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return [];
    throw error;
  }
}

async function loadRegisteredSemanticIds() {
  const matrix = JSON.parse(await readFile(BASELINE_MATRIX_PATH, 'utf8')) as LearningGoalResourceBaselineMatrix;
  const coreReviewRows = (await readFile(CORE_SEMANTIC_REVIEW_PATH, 'utf8'))
    .split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    .map((line) => JSON.parse(line) as CoreSemanticReviewRow);
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

async function main() {
  const sources = await loadAdaptiveAssessmentCatalogSources();
  const catalog = buildAdaptiveAssessmentItemCatalog({
    acqStaticQuestions: sources.acqStaticQuestions,
    icourseObjectiveBankItems: sources.icourseObjectiveBankItems,
    icourseObjectiveBankIndexTotal: sources.icourseObjectiveBankIndexTotal,
    kaqReviewedItems: sources.kaqReviewedItems,
  });
  const sourceReviewDecisions = (await Promise.all(
    REVIEW_DECISION_PATHS.map(readReviewDecisionFile),
  )).flat();
  const reviewedSnapshots = mergeAssessmentItemSemanticReviewDecisions(
    await readExistingReviewSnapshots(),
    [
      ...buildKaqFoundationSemanticReviewDecisions(catalog.items, sources.kaqReviewedItems),
      ...buildCheckpointAuthoredSemanticReviewDecisions(catalog.items),
      ...sourceReviewDecisions,
    ],
    sourceReviewShardReplacementPolicy,
  );
  const registeredSemanticIds = await loadRegisteredSemanticIds();
  const artifacts = buildAssessmentItemSemanticReviewArtifacts({
    items: catalog.items,
    decisions: reviewedSnapshots,
    sourceFamilies: catalog.manifest.sourceFamilies,
    knownLearningGoalIds: registeredSemanticIds.learningGoalIds,
    knownKaqObjectiveIds: registeredSemanticIds.kaqObjectiveIds,
    knownGraphNodeIds: registeredSemanticIds.graphNodeIds,
    knownRemediationResourceNodeIds: registeredSemanticIds.remediationResourceNodeIds,
  });
  const files = assessmentItemSemanticReviewArtifactsToFiles(artifacts);

  await mkdir(OUTPUT_DIR, { recursive: true });
  await Promise.all([
    writeFile(PACKETS_PATH, files.packets),
    writeFile(SNAPSHOTS_PATH, files.reviewedSnapshots),
    writeFile(COVERAGE_PATH, files.coverage),
  ]);

  console.log(JSON.stringify({
    itemCount: artifacts.coverage.itemCount,
    reviewedItemCount: artifacts.coverage.reviewedItemCount,
    reviewedDispositionCount: artifacts.coverage.reviewedDispositionCount,
    reviewedLimitationCount: artifacts.coverage.reviewedLimitationCount,
    unreviewedItemCount: artifacts.coverage.unreviewedItemCount,
    pathEligibleItemCount: artifacts.coverage.pathEligibleItemCount,
    staleReviewCount: artifacts.coverage.staleReviewCount,
    sourceFamilies: artifacts.coverage.sourceFamilies.map((family) => ({
      family: family.family,
      sourceTotal: family.sourceTotal,
      itemTotal: family.itemTotal,
      reviewedTotal: family.reviewedTotal,
      pathEligibleTotal: family.pathEligibleTotal,
      unreviewedTotal: family.unreviewedTotal,
      staleTotal: family.staleTotal,
      rejectedTotal: family.rejectedTotal,
      deprecatedTotal: family.deprecatedTotal,
      blockedTotal: family.blockedTotal,
      ...(typeof family.reviewOverlayTotal === 'number' ? { reviewOverlayTotal: family.reviewOverlayTotal } : {}),
    })),
    issues: artifacts.coverage.issues.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
