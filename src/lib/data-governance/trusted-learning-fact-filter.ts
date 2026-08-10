/**
 * Versioned Portrait v2 trusted-fact policy.
 *
 * The policy deliberately does not read a `trusted` column. Trust is derived
 * from existing server-side evidence anchors, so historical facts cannot be
 * rehabilitated by an application-side marker.
 */

export const TRUSTED_LEARNING_FACT_POLICY_VERSION =
  'trusted-learning-fact-policy.v1' as const;

const NON_TRUSTED_SOURCE_EVENT_PREFIXES = [
  'historical:',
  'interaction-log:',
  'yangfan-diagnostic-fixture:',
  'backfill:',
  'recompute:',
] as const;

const SIMULATION_SOURCE_EVENT_PREFIXES = [
  'simulation-agent-evidence:',
  'simulation-task-evidence:',
] as const;

export interface TrustedLearningFactInput {
  sourceEventId?: string | null;
  sourceLogId?: string | null;
  knowledgeRevisionRef?: string | null;
}

export interface TrustedLearningFactPolicy {
  version: typeof TRUSTED_LEARNING_FACT_POLICY_VERSION;
  evidenceAnchorFields: readonly string[];
  nonTrustedSourceEventPrefixes: readonly string[];
  simulationSourceEventPrefixes: readonly string[];
}

export const trustedLearningFactPolicy: TrustedLearningFactPolicy = {
  version: TRUSTED_LEARNING_FACT_POLICY_VERSION,
  evidenceAnchorFields: ['sourceEventId', 'sourceLogId'],
  nonTrustedSourceEventPrefixes: NON_TRUSTED_SOURCE_EVENT_PREFIXES,
  simulationSourceEventPrefixes: SIMULATION_SOURCE_EVENT_PREFIXES,
};

export function isTrustedLearningFact(
  fact: TrustedLearningFactInput,
): boolean {
  const sourceEventId = normalizeAnchor(fact.sourceEventId);
  if (!sourceEventId) return false;
  if (NON_TRUSTED_SOURCE_EVENT_PREFIXES.some((prefix) =>
    sourceEventId.startsWith(prefix))) {
    return false;
  }
  if (SIMULATION_SOURCE_EVENT_PREFIXES.some((prefix) =>
    sourceEventId.startsWith(prefix))) {
    return Boolean(normalizeAnchor(fact.sourceLogId));
  }
  return true;
}

function normalizeAnchor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
