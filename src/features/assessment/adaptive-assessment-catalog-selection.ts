import type { AdaptiveAssessmentCatalogItem } from './adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from './adaptive-assessment-semantic-review';
import {
  checkpointAuthoredQuestionRuntimeId,
  sourceIdFromCheckpointAuthoredQuestionRuntimeId,
} from './learning-goal-checkpoint-question-sets';
import { evaluateAssessmentEvidenceAuthority } from './assessment-evidence-authority';

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

export class AdaptiveAssessmentCatalogSelectionError extends Error {
  constructor(readonly limitation: CatalogSelectionLimitation) {
    super(`学习目标 ${limitation.learningGoalId} 的 ${limitation.requestedStage} 已审核路径题目覆盖不足`);
    this.name = 'AdaptiveAssessmentCatalogSelectionError';
  }
}

export interface RuntimeCatalogArtifacts {
  items: AdaptiveAssessmentCatalogItem[];
  decisionsByCatalogItemId: Map<string, AssessmentItemSemanticReviewDecision>;
  selectionsByQuestionId: Map<string, CatalogBackedAssessmentSelection>;
}

export function buildRuntimeCatalogArtifacts(
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

function includesCatalogItemHistory(ids: Set<string>, item: AdaptiveAssessmentCatalogItem): boolean {
  return catalogItemQuestionHistoryIds(item).some((id) => ids.has(id));
}

function isReviewedPathEligibleSelection(
  item: AdaptiveAssessmentCatalogItem,
  decision: AssessmentItemSemanticReviewDecision | undefined,
  learningGoalId: string,
  requestedStage: CatalogBackedAssessmentScope,
): decision is AssessmentItemSemanticReviewDecision {
  const authority = decision
    ? evaluateAssessmentEvidenceAuthority(item, decision, { learningGoalId, requestedStage })
    : null;
  if (!decision || !authority || !decisionStageMatches(decision, requestedStage)) return false;
  if (requestedStage === 'terminal-validation') {
    return authority.limitations.length === 0
      && item.sourceFamily !== 'generated-adaptive-question'
      && item.eligibilityState === 'path-eligible';
  }
  return Boolean(authority[requestedStage]);
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
    return { entry, score: closeness + weakBoost };
  });

  scored.sort((left, right) =>
    right.score - left.score ||
    left.entry.catalogItem.catalogItemId.localeCompare(right.entry.catalogItem.catalogItemId)
  );
  return scored[0].entry;
}

export function sourceIdFromCatalogQuestionId(questionId: string): string {
  return sourceIdFromCheckpointAuthoredQuestionRuntimeId(questionId) ?? questionId;
}
