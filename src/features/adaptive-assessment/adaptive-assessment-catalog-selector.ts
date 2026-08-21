import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type {
  AdaptiveAssessmentCatalogItem,
} from './adaptive-assessment-item-catalog';
import {
  type AssessmentItemSemanticReviewDecision,
} from './adaptive-assessment-semantic-review';
import {
  checkpointAuthoredQuestionRuntimeId,
  sourceIdFromCheckpointAuthoredQuestionRuntimeId,
} from './learning-goal-checkpoint-question-sets';
import {
  evaluateAssessmentEvidenceAuthority,
} from './assessment-evidence-authority';
import {
  loadFrozenTerminalValidationOverlay,
} from './adaptive-assessment-lifecycle-coverage';
import {
  GENERATED_CATALOG_ITEMS_PATH,
  GENERATED_CATALOG_REVIEWS_PATH,
} from './generated-candidate-catalog';

export type CatalogBackedAssessmentScope = 'readiness' | 'checkpoint' | 'remediation' | 'terminal-validation';

export interface CatalogSelectionLimitation {
  code: 'path-assessment-catalog-coverage-incomplete';
  state: 'limited';
  learningGoalId: string;
  requestedStage: CatalogBackedAssessmentScope;
  reviewedPathEligibleCandidateCount: number;
  limitationReason: string;
}

export interface CatalogBackedAssessmentSelection {
  catalogItem: AdaptiveAssessmentCatalogItem;
  reviewDecision: AssessmentItemSemanticReviewDecision;
}

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

export class AdaptiveAssessmentCatalogSelectionError extends Error {
  constructor(readonly limitation: CatalogSelectionLimitation) {
    super(`学习目标 ${limitation.learningGoalId} 的 ${limitation.requestedStage} 已审核路径题目覆盖不足`);
    this.name = 'AdaptiveAssessmentCatalogSelectionError';
  }
}

const RUNTIME_DIR = 'course-content/runtime/resource-governance';
const CATALOG_ITEMS_PATH = `${RUNTIME_DIR}/adaptive-assessment-item-catalog-items.jsonl`;
const REVIEW_SNAPSHOTS_PATH = `${RUNTIME_DIR}/assessment-item-semantic-review-snapshots.jsonl`;

interface RuntimeCatalogArtifacts {
  items: AdaptiveAssessmentCatalogItem[];
  decisionsByCatalogItemId: Map<string, AssessmentItemSemanticReviewDecision>;
  selectionsByQuestionId: Map<string, CatalogBackedAssessmentSelection>;
}

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

function buildRuntimeCatalogArtifacts(
  items: AdaptiveAssessmentCatalogItem[],
  decisions: AssessmentItemSemanticReviewDecision[],
): RuntimeCatalogArtifacts {
  const decisionsByCatalogItemId = new Map(
    decisions
      .filter((decision) => decision.decisionKind === 'human-review')
      .map((decision) => [decision.catalogItemId, decision]),
  );
  const selectionsByQuestionId = new Map<string, CatalogBackedAssessmentSelection>();
  for (const item of items) {
    const reviewDecision = decisionsByCatalogItemId.get(item.catalogItemId);
    if (!reviewDecision) continue;
    selectionsByQuestionId.set(item.sourceId, { catalogItem: item, reviewDecision });
  }
  return { items, decisionsByCatalogItemId, selectionsByQuestionId };
}

function decisionStageMatches(
  decision: AssessmentItemSemanticReviewDecision,
  requestedStage: CatalogBackedAssessmentScope,
): boolean {
  if (requestedStage === 'readiness') {
    return decision.selectedStagePurpose === 'readiness' ||
      decision.selectedStagePurpose === 'readiness-gate' ||
      decision.selectedStagePurpose === 'precheck';
  }
  if (requestedStage === 'checkpoint') return decision.selectedStagePurpose === 'checkpoint';
  if (requestedStage === 'terminal-validation') return decision.selectedStagePurpose === 'terminal-validation';
  return decision.selectedStagePurpose === 'remediation';
}

function catalogItemQuestionHistoryIds(item: AdaptiveAssessmentCatalogItem): string[] {
  if (item.sourceFamily === 'checkpoint-authored-question') {
    return [item.sourceId, checkpointAuthoredQuestionRuntimeId(item.sourceId)];
  }
  return [item.sourceId];
}

function includesCatalogItemHistory(
  ids: Set<string>,
  item: AdaptiveAssessmentCatalogItem,
): boolean {
  return catalogItemQuestionHistoryIds(item).some((id) => ids.has(id));
}

function isReviewedPathEligibleSelection(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision | undefined,
  learningGoalId: string,
  requestedStage: CatalogBackedAssessmentScope,
): decision is AssessmentItemSemanticReviewDecision {
  const authority = decision
    ? evaluateAssessmentEvidenceAuthority(item, decision, {
        learningGoalId,
        requestedStage,
      })
    : null;
  if (!decision || !authority || !decisionStageMatches(decision, requestedStage)) return false;
  if (requestedStage === 'terminal-validation') {
    return authority.limitations.length === 0
      && item.sourceFamily !== 'generated-adaptive-question'
      && item.eligibilityState === 'path-eligible';
  }
  return Boolean(authority[requestedStage]);
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

export function selectCatalogBackedAssessmentItemFromArtifacts(params: {
  learningGoalId: string;
  requestedStage: CatalogBackedAssessmentScope;
  askedQuestionIds: Set<string>;
  answeredQuestionIds: Set<string>;
  targetDifficulty: number;
  weakAreas: Set<string>;
  artifacts: {
    items: AdaptiveAssessmentCatalogItem[];
    decisions: AssessmentItemSemanticReviewDecision[];
  } | RuntimeCatalogArtifacts;
}): CatalogBackedAssessmentSelection {
  const artifacts = 'decisionsByCatalogItemId' in params.artifacts
    ? params.artifacts
    : buildRuntimeCatalogArtifacts(params.artifacts.items, params.artifacts.decisions);
  const reviewedCandidates = artifacts.items
    .map((item) => ({
      catalogItem: item,
      reviewDecision: artifacts.decisionsByCatalogItemId.get(item.catalogItemId),
    }))
    .filter((entry): entry is CatalogBackedAssessmentSelection =>
      isReviewedPathEligibleSelection(
        entry.catalogItem,
        entry.reviewDecision,
        params.learningGoalId,
        params.requestedStage,
      )
    );

  if (reviewedCandidates.length === 0) {
    throw new AdaptiveAssessmentCatalogSelectionError({
      code: 'path-assessment-catalog-coverage-incomplete',
      state: 'limited',
      learningGoalId: params.learningGoalId,
      requestedStage: params.requestedStage,
      reviewedPathEligibleCandidateCount: 0,
      limitationReason: `no-reviewed-path-eligible-${params.requestedStage}-items`,
    });
  }

  const unasked = reviewedCandidates.filter((entry) =>
    !includesCatalogItemHistory(params.askedQuestionIds, entry.catalogItem)
  );
  const unansweredSelected = reviewedCandidates.find((entry) =>
    includesCatalogItemHistory(params.askedQuestionIds, entry.catalogItem) &&
    !includesCatalogItemHistory(params.answeredQuestionIds, entry.catalogItem)
  );
  const selectionPool = unasked.length > 0
    ? unasked
    : unansweredSelected
      ? [unansweredSelected]
      : reviewedCandidates;
  const scored = selectionPool.map((entry) => {
    const difficulty = entry.reviewDecision.difficulty ?? entry.catalogItem.semanticRefs.difficulty ?? 0.5;
    const closeness = 1 - Math.abs(difficulty - params.targetDifficulty);
    const weakBoost = entry.catalogItem.semanticRefs.knowledgeTags
      .reduce((sum, tag) => sum + (params.weakAreas.has(tag) ? 0.15 : 0), 0);
    return {
      entry,
      score: closeness + weakBoost,
    };
  });

  scored.sort((left, right) =>
    right.score - left.score ||
    left.entry.catalogItem.catalogItemId.localeCompare(right.entry.catalogItem.catalogItemId)
  );
  return scored[0].entry;
}

export function findAdaptiveAssessmentCatalogSnapshot(
  questionId: string,
): AdaptiveAssessmentCatalogSnapshot | null {
  const sourceId = sourceIdFromCheckpointAuthoredQuestionRuntimeId(questionId) ?? questionId;
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
