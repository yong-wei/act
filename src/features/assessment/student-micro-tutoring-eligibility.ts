import {
  findMicroTutoringOptionAttribution,
  defaultMicroTutoringOptionAttributions,
} from './micro-tutoring-option-attribution';
import {
  listMicroTutoringGovernedResources,
  type MicroTutoringResourceAuthorityRow,
} from './micro-tutoring-resource-registry';
import { loadMicroTutoringRuntimeSource } from './micro-tutoring-runtime-source';
import {
  listMicroTutoringGovernedValidationItems,
  type MicroTutoringValidationAuthorityRow,
} from './micro-tutoring-validation-registry';
import {
  normalizeStudentMicroTutoringStage,
  type StudentMicroTutoringEligibility,
  type StudentMicroTutoringStage,
  type StudentMicroTutoringUnavailableReason,
} from './student-micro-tutoring-eligibility-contract';

export type {
  StudentMicroTutoringEligibility,
  StudentMicroTutoringStage,
  StudentMicroTutoringUnavailableReason,
} from './student-micro-tutoring-eligibility-contract';
export {
  isStudentMicroTutoringEligibility,
  normalizeStudentMicroTutoringStage,
  studentMicroTutoringStageLabel,
  studentMicroTutoringUnavailableCopy,
} from './student-micro-tutoring-eligibility-contract';

export interface StudentMicroTutoringCatalogReview {
  catalogItemId: string;
  sourceId: string;
  contentHash: string;
  itemReviewSourceHash: string;
  reviewedLearningGoalIds: string[];
  reviewedKnowledgeNodeIds: string[];
  reviewedMisconceptionTags: string[];
  assessmentStage?: string;
}

export interface ProjectStudentMicroTutoringEligibilityInput {
  isCorrect: boolean;
  selectedOptionKey: string;
  correctOptionKey: string;
  assessmentStage: string;
  catalogItemId?: string | null;
  contentHash?: string | null;
  catalogReview?: StudentMicroTutoringCatalogReview | null;
  baselineEntries?: unknown[];
  optionAttributions?: unknown[];
  resourceProjection?: unknown;
  validationRegistry?: unknown;
  practiceBaseline?: unknown;
  resourceAuthorityRows?: MicroTutoringResourceAuthorityRow[];
  validationAuthorityRows?: MicroTutoringValidationAuthorityRow[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function unqualified(
  stage: StudentMicroTutoringStage,
  unavailableReason: StudentMicroTutoringUnavailableReason | null,
  retryAttribution = false,
): StudentMicroTutoringEligibility {
  return {
    stage,
    qualified: false,
    unavailableReason,
    retryAttribution,
  };
}

function defaultV2BaselineEntries(): unknown[] {
  const source = record(loadMicroTutoringRuntimeSource('micro-tutoring-assessment-baseline-v2.json'));
  return Array.isArray(source?.entries) ? source.entries : [];
}

function findBaselineEntry(entries: unknown[], catalogItemId: string): {
  catalogItemId: string;
  contentHash: string;
  assessmentStage?: string;
} | null {
  const matches = entries
    .map(record)
    .filter((entry): entry is Record<string, unknown> => entry !== null
      && nonEmptyString(entry.catalogItemId)
      && entry.catalogItemId === catalogItemId);
  if (matches.length !== 1 || !nonEmptyString(matches[0].contentHash)) return null;
  return {
    catalogItemId,
    contentHash: matches[0].contentHash,
    assessmentStage: nonEmptyString(matches[0].assessmentStage) ? matches[0].assessmentStage : undefined,
  };
}

function hasAttributionIdentity(
  entries: unknown[],
  catalogItemId: string,
  contentHash: string,
  optionKey: string,
): boolean {
  return entries.some((value) => {
    const row = record(value);
    return row !== null
      && row.catalogItemId === catalogItemId
      && row.contentHash === contentHash
      && row.optionKey === optionKey;
  });
}

function hasAttributionContentDrift(
  entries: unknown[],
  catalogItemId: string,
  optionKey: string,
  contentHash: string,
): boolean {
  return entries.some((value) => {
    const row = record(value);
    return row !== null
      && row.catalogItemId === catalogItemId
      && row.optionKey === optionKey
      && nonEmptyString(row.contentHash)
      && row.contentHash !== contentHash;
  });
}

export function studentMicroTutoringCatalogReviewFromSnapshot(snapshot: {
  catalogItemId?: string;
  sourceId?: string;
  contentHash?: string;
  reviewDecision?: { reviewSourceHash?: string };
  semanticRefs?: {
    learningGoalIds?: string[];
    graphNodeIds?: string[];
    misconceptionTags?: string[];
    assessmentStage?: string | null;
  };
} | null | undefined): StudentMicroTutoringCatalogReview | null {
  if (
    !snapshot
    || !nonEmptyString(snapshot.catalogItemId)
    || !nonEmptyString(snapshot.sourceId)
    || !nonEmptyString(snapshot.contentHash)
  ) {
    return null;
  }
  return {
    catalogItemId: snapshot.catalogItemId,
    sourceId: snapshot.sourceId,
    contentHash: snapshot.contentHash,
    itemReviewSourceHash: snapshot.reviewDecision?.reviewSourceHash ?? '',
    reviewedLearningGoalIds: snapshot.semanticRefs?.learningGoalIds ?? [],
    reviewedKnowledgeNodeIds: snapshot.semanticRefs?.graphNodeIds ?? [],
    reviewedMisconceptionTags: snapshot.semanticRefs?.misconceptionTags ?? [],
    assessmentStage: snapshot.semanticRefs?.assessmentStage ?? undefined,
  };
}

export function projectStudentMicroTutoringEligibility(
  input: ProjectStudentMicroTutoringEligibilityInput,
): StudentMicroTutoringEligibility {
  const stage = normalizeStudentMicroTutoringStage(input.assessmentStage);
  if (input.isCorrect) return unqualified(stage, null);

  const catalogItemId = nonEmptyString(input.catalogItemId) ? input.catalogItemId.trim() : '';
  const contentHash = nonEmptyString(input.contentHash) ? input.contentHash.trim() : '';
  if (!catalogItemId || !contentHash || !nonEmptyString(input.selectedOptionKey)) {
    return unqualified(stage, 'NOT_COVERED', true);
  }

  const baselineEntries = input.baselineEntries ?? defaultV2BaselineEntries();
  const baseline = findBaselineEntry(baselineEntries, catalogItemId);
  if (!baseline) return unqualified(stage, 'NOT_COVERED', true);
  if (
    baseline.contentHash !== contentHash
    || (
      baseline.assessmentStage
      && normalizeStudentMicroTutoringStage(baseline.assessmentStage) !== stage
    )
  ) {
    return unqualified(stage, 'EVIDENCE_DRIFT', true);
  }

  const catalogReview = input.catalogReview ?? null;
  if (
    catalogReview
    && (
      catalogReview.catalogItemId !== catalogItemId
      || catalogReview.contentHash !== contentHash
    )
  ) {
    return unqualified(stage, 'EVIDENCE_DRIFT', true);
  }

  const optionAttributions = input.optionAttributions ?? defaultMicroTutoringOptionAttributions();
  if (hasAttributionContentDrift(optionAttributions, catalogItemId, input.selectedOptionKey, contentHash)) {
    return unqualified(stage, 'EVIDENCE_DRIFT', true);
  }
  if (!hasAttributionIdentity(optionAttributions, catalogItemId, contentHash, input.selectedOptionKey)) {
    return unqualified(stage, 'NOT_COVERED', true);
  }

  const attribution = findMicroTutoringOptionAttribution({
    entries: optionAttributions,
    catalogItemId,
    contentHash,
    selectedOptionKey: input.selectedOptionKey,
    correctOptionKey: input.correctOptionKey,
    assessmentStage: catalogReview?.assessmentStage ?? baseline.assessmentStage ?? input.assessmentStage,
    itemReviewSourceHash: catalogReview?.itemReviewSourceHash ?? '',
    reviewedLearningGoalIds: catalogReview?.reviewedLearningGoalIds ?? [],
    reviewedKnowledgeNodeIds: catalogReview?.reviewedKnowledgeNodeIds ?? [],
    reviewedMisconceptionTags: catalogReview?.reviewedMisconceptionTags ?? [],
  });
  if (!attribution) return unqualified(stage, 'EVIDENCE_DRIFT', true);

  const resourceQuery = {
    knowledgeNodeId: attribution.knowledgeNodeId,
    misconceptionTag: attribution.misconceptionTag,
    projection: input.resourceProjection,
  };
  const projectedResources = listMicroTutoringGovernedResources(resourceQuery);
  if (projectedResources.length === 0) return unqualified(stage, 'RESOURCE_UNAVAILABLE');
  if (input.resourceAuthorityRows) {
    const authorizedResources = listMicroTutoringGovernedResources({
      ...resourceQuery,
      authorityRows: input.resourceAuthorityRows,
    });
    if (authorizedResources.length === 0) return unqualified(stage, 'ACCESS_REVOKED');
  }

  const sourceQuestionId = catalogReview?.sourceId ?? catalogItemId;
  const validationQuery = {
    knowledgeNodeId: attribution.knowledgeNodeId,
    misconceptionTag: attribution.misconceptionTag,
    sourceQuestionId,
    sourceContentHash: contentHash,
    registry: input.validationRegistry,
    practiceBaseline: input.practiceBaseline,
  };
  const projectedValidations = listMicroTutoringGovernedValidationItems(validationQuery);
  if (projectedValidations.length === 0) return unqualified(stage, 'VALIDATION_UNAVAILABLE');
  if (input.validationAuthorityRows) {
    const authorizedValidations = listMicroTutoringGovernedValidationItems({
      ...validationQuery,
      authorityRows: input.validationAuthorityRows,
    });
    if (authorizedValidations.length === 0) return unqualified(stage, 'ACCESS_REVOKED');
  }

  return {
    stage,
    qualified: true,
    unavailableReason: null,
    retryAttribution: false,
  };
}
