import { resolveMicroTutoringGoalNode } from './micro-tutoring-goal-node-catalog';
import { microTutoringOptionAttributionReviewSourceHash } from './micro-tutoring-option-attribution-evidence';
import { loadMicroTutoringRuntimeSource } from './micro-tutoring-runtime-source';

export { microTutoringOptionAttributionReviewSourceHash } from './micro-tutoring-option-attribution-evidence';

const MICRO_TUTORING_V2_ASSESSMENT_STAGES = new Set([
  'practice',
  'low-stakes-practice',
  'checkpoint',
  'remediation',
  'readiness',
  'readiness-gate',
]);

function normalizeMicroTutoringAssessmentStage(value: string | undefined): string | null {
  if (!value) return null;
  if (value === 'practice') return 'low-stakes-practice';
  if (value === 'readiness-gate') return 'readiness';
  return MICRO_TUTORING_V2_ASSESSMENT_STAGES.has(value) ? value : null;
}

export interface MicroTutoringOptionAttribution {
  catalogItemId: string;
  contentHash: string;
  optionKey: string;
  assessmentStage?: string;
  learningGoalId: string;
  misconceptionTag: string;
  knowledgeNodeId: string;
  version: string;
  itemReviewSourceHash: string;
  reviewSourceHash: string;
  reviewerId: string;
  reviewerRole: string;
  reviewedAt: string;
  reviewBatchId: string;
  evidenceSummary: string;
  limitations: string[];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString);
}

export function optionAttributionKey(
  catalogItemId: string,
  contentHash: string,
  optionKey: string,
): string {
  return `${catalogItemId}\u0000${contentHash}\u0000${optionKey}`;
}

export function isMicroTutoringOptionAttribution(
  value: unknown,
): value is MicroTutoringOptionAttribution {
  const attribution = record(value);
  if (!attribution) return false;
  const hasRequiredStage = attribution.version !== 'micro-tutoring-option-attribution.v3' || (
    nonEmptyString(attribution.assessmentStage) &&
    normalizeMicroTutoringAssessmentStage(attribution.assessmentStage) !== null
  );
  return hasRequiredStage &&
    nonEmptyString(attribution.catalogItemId) &&
    nonEmptyString(attribution.contentHash) &&
    nonEmptyString(attribution.optionKey) &&
    nonEmptyString(attribution.learningGoalId) &&
    nonEmptyString(attribution.misconceptionTag) &&
    nonEmptyString(attribution.knowledgeNodeId) &&
    nonEmptyString(attribution.version) &&
    /^sha256:[a-f0-9]{64}$/.test(String(attribution.itemReviewSourceHash ?? '')) &&
    /^sha256:[a-f0-9]{64}$/.test(String(attribution.reviewSourceHash ?? '')) &&
    nonEmptyString(attribution.reviewerId) &&
    nonEmptyString(attribution.reviewerRole) &&
    nonEmptyString(attribution.reviewedAt) &&
    nonEmptyString(attribution.reviewBatchId) &&
    nonEmptyString(attribution.evidenceSummary) &&
    nonEmptyStringArray(attribution.limitations) &&
    attribution.reviewSourceHash === microTutoringOptionAttributionReviewSourceHash(
      attribution as unknown as MicroTutoringOptionAttribution,
    );
}

export function defaultMicroTutoringOptionAttributions(): unknown[] {
  const source = record(loadMicroTutoringRuntimeSource('micro-tutoring-option-attributions-v2.json'));
  return Array.isArray(source?.entries) ? source.entries : [];
}

export function findMicroTutoringOptionAttribution(input: {
  entries?: unknown[];
  catalogItemId: string;
  contentHash: string;
  selectedOptionKey: string;
  correctOptionKey: string;
  assessmentStage?: string;
  itemReviewSourceHash: string;
  reviewedLearningGoalIds: string[];
  reviewedKnowledgeNodeIds: string[];
  reviewedMisconceptionTags: string[];
}): MicroTutoringOptionAttribution | null {
  if (input.selectedOptionKey === input.correctOptionKey) return null;
  const targetKey = optionAttributionKey(
    input.catalogItemId,
    input.contentHash,
    input.selectedOptionKey,
  );
  const entries = input.entries ?? defaultMicroTutoringOptionAttributions();
  const identityMatches = entries
    .filter((value) => {
      const attribution = record(value);
      return attribution &&
        nonEmptyString(attribution.catalogItemId) &&
        nonEmptyString(attribution.contentHash) &&
        nonEmptyString(attribution.optionKey) &&
        optionAttributionKey(
          attribution.catalogItemId,
          attribution.contentHash,
          attribution.optionKey,
        ) === targetKey;
    });
  if (identityMatches.length !== 1) return null;

  const matches = identityMatches.filter(isMicroTutoringOptionAttribution);
  if (matches.length !== 1) return null;

  const [attribution] = matches;
  const goalNode = resolveMicroTutoringGoalNode(attribution.learningGoalId);
  const reusesSiblingEvidence = entries
    .filter(isMicroTutoringOptionAttribution)
    .some((candidate) =>
      candidate.catalogItemId === attribution.catalogItemId &&
      candidate.contentHash === attribution.contentHash &&
      candidate.optionKey !== attribution.optionKey &&
      (
        candidate.misconceptionTag === attribution.misconceptionTag ||
        candidate.reviewSourceHash === attribution.reviewSourceHash ||
        candidate.evidenceSummary === attribution.evidenceSummary
      ));
  if (
    reusesSiblingEvidence ||
    !goalNode.ok ||
    (
      attribution.version === 'micro-tutoring-option-attribution.v3' &&
      normalizeMicroTutoringAssessmentStage(attribution.assessmentStage) !==
        normalizeMicroTutoringAssessmentStage(input.assessmentStage)
    ) ||
    attribution.knowledgeNodeId !== goalNode.knowledgeNodeId ||
    attribution.itemReviewSourceHash !== input.itemReviewSourceHash ||
    !input.reviewedLearningGoalIds.includes(attribution.learningGoalId) ||
    (
      !input.reviewedMisconceptionTags.includes(attribution.misconceptionTag) &&
      !attribution.misconceptionTag.startsWith(`misconception:${attribution.learningGoalId}:`)
    )
  ) {
    return null;
  }
  return attribution;
}
