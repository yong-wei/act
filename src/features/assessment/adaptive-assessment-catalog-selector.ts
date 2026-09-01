import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { CrossDomainQuestion } from '@/features/assessment/adaptive-question-bank';
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
import {
  GENERATED_CATALOG_ITEMS_PATH,
  GENERATED_CATALOG_REVIEWS_PATH,
} from './generated-candidate-catalog';

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
let generatedRuntimeOverlay: {
  items: AdaptiveAssessmentCatalogItem[];
  decisions: AssessmentItemSemanticReviewDecision[];
} = { items: [], decisions: [] };
let generatedRuntimeOverlayReady = false;

export function invalidateRuntimeCatalogCache() {
  cachedArtifacts = null;
}

export function isGeneratedRuntimeOverlayReady() {
  return generatedRuntimeOverlayReady;
}

export function resetGeneratedRuntimeOverlay() {
  generatedRuntimeOverlay = { items: [], decisions: [] };
  generatedRuntimeOverlayReady = false;
  cachedArtifacts = null;
}

export function replaceGeneratedRuntimeOverlay(input: {
  items: AdaptiveAssessmentCatalogItem[];
  decisions: AssessmentItemSemanticReviewDecision[];
}) {
  generatedRuntimeOverlay = {
    items: [...input.items],
    decisions: [...input.decisions],
  };
  generatedRuntimeOverlayReady = true;
  cachedArtifacts = null;
}

function readJsonl<T>(filePath: string): T[] {
  const content = readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  return content.split('\n').filter(Boolean).map((line) => JSON.parse(line) as T);
}

function loadGeneratedCatalog(rootDir: string): {
  items: AdaptiveAssessmentCatalogItem[];
  decisions: AssessmentItemSemanticReviewDecision[];
} {
  if (generatedRuntimeOverlayReady) {
    return generatedRuntimeOverlay;
  }
  const itemsPath = path.join(rootDir, GENERATED_CATALOG_ITEMS_PATH);
  const reviewsPath = path.join(rootDir, GENERATED_CATALOG_REVIEWS_PATH);
  return {
    items: existsSync(itemsPath) ? readJsonl<AdaptiveAssessmentCatalogItem>(itemsPath) : [],
    decisions: existsSync(reviewsPath)
      ? readJsonl<AssessmentItemSemanticReviewDecision>(reviewsPath)
      : [],
  };
}

function loadRuntimeCatalogArtifacts(rootDir = process.cwd()): RuntimeCatalogArtifacts {
  if (cachedArtifacts) return cachedArtifacts;
  const items = readJsonl<AdaptiveAssessmentCatalogItem>(path.join(rootDir, CATALOG_ITEMS_PATH));
  const decisions = readJsonl<AssessmentItemSemanticReviewDecision>(path.join(rootDir, REVIEW_SNAPSHOTS_PATH));
  const overlay = loadFrozenTerminalValidationOverlay();
  const overlayIds = new Set(overlay.items.map((item) => item.catalogItemId));
  const generatedCatalog = loadGeneratedCatalog(rootDir);
  const generatedItems = generatedCatalog.items;
  const generatedDecisions = generatedCatalog.decisions;
  const generatedIds = new Set(generatedItems.map((item) => item.catalogItemId));
  cachedArtifacts = buildRuntimeCatalogArtifacts(
    [
      ...items.filter((item) => !overlayIds.has(item.catalogItemId) && !generatedIds.has(item.catalogItemId)),
      ...overlay.items,
      ...generatedItems,
    ],
    [
      ...decisions.filter((decision) => !overlayIds.has(decision.catalogItemId) && !generatedIds.has(decision.catalogItemId)),
      ...overlay.decisions,
      ...generatedDecisions,
    ],
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

/**
 * Serves a published generated catalog item as a runtime question. Only items
 * that are path-eligible through a verified publication receipt resolve here;
 * provisional template practice stays in the session-scoped in-memory store and
 * never reaches this path. The returned question carries no generatedMetadata
 * owner/session scope because published items are reviewed shared content.
 */
export function findGeneratedRuntimeQuestionById(questionId: string): CrossDomainQuestion | null {
  const snapshot = findAdaptiveAssessmentCatalogSnapshot(questionId);
  if (
    !snapshot
    || snapshot.sourceFamily !== 'generated-adaptive-question'
    || snapshot.eligibilityState !== 'path-eligible'
    || !snapshot.questionRefs.stem
    || !snapshot.questionRefs.options?.length
  ) {
    return null;
  }
  const options = snapshot.questionRefs.options.flatMap((option) => (
    option.key && typeof option.isCorrect === 'boolean'
      ? [{
          label: option.key,
          text: option.text,
          isCorrect: option.isCorrect,
          explanation: option.explanation ?? '',
        }]
      : []
  ));
  if (options.length === 0) return null;
  return {
    id: snapshot.sourceId,
    stem: snapshot.questionRefs.stem,
    domains: ['time'],
    type: 'multi-criteria',
    difficulty: snapshot.semanticRefs.difficulty ?? 0.5,
    knowledgeTags: snapshot.semanticRefs.knowledgeTags,
    options,
  };
}
