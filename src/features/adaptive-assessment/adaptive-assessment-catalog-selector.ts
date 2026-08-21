import { readFileSync } from 'node:fs';
import path from 'node:path';

import type { AdaptiveAssessmentCatalogItem } from './adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from './adaptive-assessment-semantic-review';
import { loadFrozenTerminalValidationOverlay } from './adaptive-assessment-lifecycle-coverage';
import {
  buildRuntimeCatalogArtifacts,
  selectCatalogBackedAssessmentItemFromArtifacts,
  sourceIdFromCatalogQuestionId,
  type CatalogBackedAssessmentScope,
  type CatalogBackedAssessmentSelection,
  type RuntimeCatalogArtifacts,
} from './adaptive-assessment-catalog-selection';

export {
  AdaptiveAssessmentCatalogSelectionError,
  buildRuntimeCatalogArtifacts,
  selectCatalogBackedAssessmentItemFromArtifacts,
  type CatalogBackedAssessmentScope,
  type CatalogBackedAssessmentSelection,
  type CatalogSelectionLimitation,
  type RuntimeCatalogArtifacts,
} from './adaptive-assessment-catalog-selection';

export interface AdaptiveAssessmentCatalogSnapshot {
  catalogItemId: string;
  sourceFamily: AdaptiveAssessmentCatalogItem['sourceFamily'];
  sourceId: string;
  sourceAnchor: string;
  sourceLineage: AdaptiveAssessmentCatalogItem['lineage'];
  contentHash: string;
  contentHashAlgorithm: AdaptiveAssessmentCatalogItem['contentHashAlgorithm'];
  reviewState: AdaptiveAssessmentCatalogItem['reviewState'];
  eligibilityState: AdaptiveAssessmentCatalogItem['eligibilityState'];
  allowedStages: AdaptiveAssessmentCatalogItem['allowedStages'];
  questionRefs: AdaptiveAssessmentCatalogItem['questionRefs'];
  semanticRefs: AdaptiveAssessmentCatalogItem['semanticRefs'];
  limitations: AdaptiveAssessmentCatalogItem['limitations'];
  reviewDecision: AssessmentItemSemanticReviewDecision;
  versionRefs: AdaptiveAssessmentCatalogItem['versionRefs'];
  relationship: AdaptiveAssessmentCatalogItem['adaptiveAssessmentItemRef'];
}

const RUNTIME_DIR = 'course-content/runtime/resource-governance';
const CATALOG_ITEMS_PATH = `${RUNTIME_DIR}/adaptive-assessment-item-catalog-items.jsonl`;
const REVIEW_SNAPSHOTS_PATH = `${RUNTIME_DIR}/assessment-item-semantic-review-snapshots.jsonl`;

let cachedArtifacts: RuntimeCatalogArtifacts | null = null;

function readJsonl<T>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
}

function loadRuntimeCatalogArtifacts(rootDir = process.cwd()): RuntimeCatalogArtifacts {
  if (cachedArtifacts) return cachedArtifacts;
  const items = readJsonl<AdaptiveAssessmentCatalogItem>(path.join(rootDir, CATALOG_ITEMS_PATH));
  const decisions = readJsonl<AssessmentItemSemanticReviewDecision>(path.join(rootDir, REVIEW_SNAPSHOTS_PATH));
  const overlay = loadFrozenTerminalValidationOverlay();
  const overlayIds = new Set(overlay.items.map((item) => item.catalogItemId));
  cachedArtifacts = buildRuntimeCatalogArtifacts(
    [...items.filter((item) => !overlayIds.has(item.catalogItemId)), ...overlay.items],
    [...decisions.filter((decision) => !overlayIds.has(decision.catalogItemId)), ...overlay.decisions],
  );
  return cachedArtifacts;
}

export function selectCatalogBackedAssessmentItem(params: {
  learningGoalId: string;
  requestedStage: CatalogBackedAssessmentScope;
  askedQuestionIds: Set<string>;
  answeredQuestionIds: Set<string>;
  targetDifficulty: number;
  weakAreas: Set<string>;
}): CatalogBackedAssessmentSelection {
  return selectCatalogBackedAssessmentItemFromArtifacts({
    ...params,
    artifacts: loadRuntimeCatalogArtifacts(),
  });
}

export function findAdaptiveAssessmentCatalogSnapshot(
  questionId: string,
): AdaptiveAssessmentCatalogSnapshot | null {
  const sourceId = sourceIdFromCatalogQuestionId(questionId);
  const selection = loadRuntimeCatalogArtifacts().selectionsByQuestionId.get(sourceId);
  if (!selection) return null;
  const reviewDecision = selection.reviewDecision;
  return {
    catalogItemId: selection.catalogItem.catalogItemId,
    sourceFamily: selection.catalogItem.sourceFamily,
    sourceId: selection.catalogItem.sourceId,
    sourceAnchor: selection.catalogItem.sourceAnchor,
    sourceLineage: selection.catalogItem.lineage,
    contentHash: selection.catalogItem.contentHash,
    contentHashAlgorithm: selection.catalogItem.contentHashAlgorithm,
    reviewState: selection.catalogItem.reviewState,
    eligibilityState: selection.catalogItem.eligibilityState,
    allowedStages: selection.catalogItem.allowedStages,
    questionRefs: selection.catalogItem.questionRefs,
    semanticRefs: {
      ...selection.catalogItem.semanticRefs,
      learningGoalIds: reviewDecision.selectedLearningGoalIds,
      kaqObjectiveIds: reviewDecision.selectedKaqObjectiveIds,
      graphNodeIds: reviewDecision.selectedGraphNodeIds,
      misconceptionTags: reviewDecision.misconceptionRefs,
      remediationResourceNodeIds: reviewDecision.remediationRefs,
      difficulty: reviewDecision.difficulty ?? selection.catalogItem.semanticRefs.difficulty,
      cognitiveLevel: reviewDecision.cognitiveLevel ?? selection.catalogItem.semanticRefs.cognitiveLevel,
      assessmentStage: reviewDecision.selectedStagePurpose ?? selection.catalogItem.semanticRefs.assessmentStage,
    },
    limitations: selection.catalogItem.limitations,
    reviewDecision,
    versionRefs: selection.catalogItem.versionRefs,
    relationship: selection.catalogItem.adaptiveAssessmentItemRef,
  };
}
