import {
  AdaptiveAssessmentCatalogSelectionError,
  selectCatalogBackedAssessmentItemFromArtifacts,
  type CatalogBackedAssessmentSelection,
} from '@/features/adaptive-assessment/adaptive-assessment-catalog-selector';
import {
  LIFECYCLE_COVERAGE_V2_VERSION,
  buildTerminalValidationOverlayCatalog,
  buildTerminalValidationReviewDecisions,
} from '@/features/adaptive-assessment/adaptive-assessment-lifecycle-coverage';
import type { AdaptiveAssessmentCatalogItem } from '@/features/adaptive-assessment/adaptive-assessment-item-catalog';
import type { AssessmentItemSemanticReviewDecision } from '@/features/adaptive-assessment/adaptive-assessment-semantic-review';

export interface ItemTypeTerminalValidationResolution {
  status: 'ready' | 'unavailable';
  lifecycleVersion: typeof LIFECYCLE_COVERAGE_V2_VERSION;
  catalogItemId: string | null;
  contentHash: string | null;
  taskId: string | null;
  limitationReason: string | null;
  replacesTypedTerminalEvidence: false;
  combinesWith: Array<'simulation' | 'arena'>;
}

export function resolveItemTypeTerminalValidation(input: {
  learningGoalId: string;
  items?: AdaptiveAssessmentCatalogItem[];
  decisions?: AssessmentItemSemanticReviewDecision[];
  askedQuestionIds?: Set<string>;
  answeredQuestionIds?: Set<string>;
}): ItemTypeTerminalValidationResolution {
  const overlay = buildTerminalValidationOverlayCatalog();
  const overlayDecisions = buildTerminalValidationReviewDecisions(overlay.items);
  const items = [...(input.items ?? []), ...overlay.items];
  const decisions = [...(input.decisions ?? []), ...overlayDecisions];
  try {
    const selected: CatalogBackedAssessmentSelection = selectCatalogBackedAssessmentItemFromArtifacts({
      learningGoalId: input.learningGoalId,
      requestedStage: 'terminal-validation',
      askedQuestionIds: input.askedQuestionIds ?? new Set(),
      answeredQuestionIds: input.answeredQuestionIds ?? new Set(),
      targetDifficulty: 0.74,
      weakAreas: new Set(),
      artifacts: { items, decisions },
    });
    return {
      status: 'ready',
      lifecycleVersion: LIFECYCLE_COVERAGE_V2_VERSION,
      catalogItemId: selected.catalogItem.catalogItemId,
      contentHash: selected.catalogItem.contentHash,
      taskId: selected.catalogItem.sourceId,
      limitationReason: null,
      replacesTypedTerminalEvidence: false,
      combinesWith: ['simulation', 'arena'],
    };
  } catch (error) {
    const limitationReason = error instanceof AdaptiveAssessmentCatalogSelectionError
      ? error.limitation.limitationReason
      : 'item-type-terminal-validation-unavailable';
    return {
      status: 'unavailable',
      lifecycleVersion: LIFECYCLE_COVERAGE_V2_VERSION,
      catalogItemId: null,
      contentHash: null,
      taskId: null,
      limitationReason,
      replacesTypedTerminalEvidence: false,
      combinesWith: ['simulation', 'arena'],
    };
  }
}
