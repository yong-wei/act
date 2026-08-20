import optionAttributionSource from '../../../course-content/runtime/resource-governance/micro-tutoring-option-attributions.json';

export interface MicroTutoringOptionAttribution {
  catalogItemId: string;
  contentHash: string;
  optionKey: string;
  learningGoalId: string;
  misconceptionTag: string;
  knowledgeNodeId: string;
  version: string;
  reviewSourceHash: string;
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
  return nonEmptyString(attribution.catalogItemId) &&
    nonEmptyString(attribution.contentHash) &&
    nonEmptyString(attribution.optionKey) &&
    nonEmptyString(attribution.learningGoalId) &&
    nonEmptyString(attribution.misconceptionTag) &&
    nonEmptyString(attribution.knowledgeNodeId) &&
    nonEmptyString(attribution.version) &&
    /^sha256:[a-f0-9]{64}$/.test(String(attribution.reviewSourceHash ?? '')) &&
    nonEmptyString(attribution.evidenceSummary) &&
    nonEmptyStringArray(attribution.limitations);
}

export function defaultMicroTutoringOptionAttributions(): unknown[] {
  const source = record(optionAttributionSource);
  return Array.isArray(source?.entries) ? source.entries : [];
}

export function findMicroTutoringOptionAttribution(input: {
  entries?: unknown[];
  catalogItemId: string;
  contentHash: string;
  selectedOptionKey: string;
  correctOptionKey: string;
  reviewSourceHash: string;
  reviewedLearningGoalIds: string[];
  reviewedKnowledgeNodeIds: string[];
  reviewedMisconceptionTags: string[];
}): MicroTutoringOptionAttribution | null {
  if (input.selectedOptionKey === input.correctOptionKey) return null;
  const matches = (input.entries ?? defaultMicroTutoringOptionAttributions())
    .filter(isMicroTutoringOptionAttribution)
    .filter((attribution) => optionAttributionKey(
      attribution.catalogItemId,
      attribution.contentHash,
      attribution.optionKey,
    ) === optionAttributionKey(
      input.catalogItemId,
      input.contentHash,
      input.selectedOptionKey,
    ));
  if (matches.length !== 1) return null;

  const [attribution] = matches;
  if (
    attribution.reviewSourceHash !== input.reviewSourceHash ||
    !input.reviewedLearningGoalIds.includes(attribution.learningGoalId) ||
    !input.reviewedKnowledgeNodeIds.includes(attribution.knowledgeNodeId) ||
    !input.reviewedMisconceptionTags.includes(attribution.misconceptionTag)
  ) {
    return null;
  }
  return attribution;
}
