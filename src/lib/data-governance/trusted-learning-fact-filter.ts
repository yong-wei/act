/**
 * Versioned Portrait v2 trusted-fact policy.
 *
 * The policy deliberately does not read a `trusted` column. Trust is derived
 * from existing server-side evidence anchors, so historical facts cannot be
 * rehabilitated by an application-side marker.
 */

import { listGovernedKnowledgeScopedProducers } from '@/lib/canonical-learning-fact-identity/inventory';

export const TRUSTED_LEARNING_FACT_POLICY_VERSION =
  'trusted-learning-fact-policy.v1' as const;

const NON_TRUSTED_SOURCE_EVENT_PREFIXES = [
  'historical:',
  'interaction-log:',
  'yangfan-diagnostic-fixture:',
  'backfill:',
  'recompute:',
] as const;

const NON_TRUSTED_SOURCE_EVENT_MARKERS = [
  'historical',
  'interaction-log',
  'yangfan-diagnostic-fixture',
  'backfill',
  'recompute',
] as const;

const SIMULATION_SOURCE_EVENT_PREFIXES = [
  'simulation-agent-evidence:',
  'simulation-task-evidence:',
] as const;

export interface TrustedSourceEventPolicy {
  producerId: string;
  sourceEventPrefix: string;
  requiresSourceLogId: boolean;
}

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
  controlledSourceEventPolicies: readonly TrustedSourceEventPolicy[];
}

function buildControlledSourceEventPolicies(): TrustedSourceEventPolicy[] {
  const policies = listGovernedKnowledgeScopedProducers().flatMap((producer) =>
    producer.sourcePrefixes.map((prefix) => ({
      producerId: producer.id,
      sourceEventPrefix: `${prefix}:`,
      requiresSourceLogId: true,
    })),
  );
  policies.push({
    producerId: 'simulation-task-learning-fact',
    sourceEventPrefix: 'simulation-task-evidence:',
    requiresSourceLogId: true,
  });
  return policies.sort((left, right) =>
    left.sourceEventPrefix.localeCompare(right.sourceEventPrefix),
  );
}

const CONTROLLED_SOURCE_EVENT_POLICIES = buildControlledSourceEventPolicies();

export const trustedLearningFactPolicy: TrustedLearningFactPolicy = {
  version: TRUSTED_LEARNING_FACT_POLICY_VERSION,
  evidenceAnchorFields: ['sourceEventId', 'sourceLogId'],
  nonTrustedSourceEventPrefixes: NON_TRUSTED_SOURCE_EVENT_PREFIXES,
  simulationSourceEventPrefixes: SIMULATION_SOURCE_EVENT_PREFIXES,
  controlledSourceEventPolicies: CONTROLLED_SOURCE_EVENT_POLICIES,
};

export function isTrustedLearningFact(
  fact: TrustedLearningFactInput,
): boolean {
  const sourceEventId = normalizeAnchor(fact.sourceEventId);
  if (!sourceEventId) return false;
  if (NON_TRUSTED_SOURCE_EVENT_MARKERS.some((marker) =>
    sourceEventId.split(':').includes(marker))) {
    return false;
  }
  const sourceLogId = normalizeAnchor(fact.sourceLogId);
  const controlledPolicy = CONTROLLED_SOURCE_EVENT_POLICIES.find((policy) =>
    sourceEventId.startsWith(policy.sourceEventPrefix),
  );
  if (controlledPolicy) {
    return !controlledPolicy.requiresSourceLogId || Boolean(sourceLogId);
  }

  // Unprefixed events are the core materialization contract. They are accepted
  // only when the server-side log anchor exists, so arbitrary unknown IDs never
  // pass because they happen to be non-empty.
  return !sourceEventId.includes(':') && Boolean(sourceLogId);
}

function normalizeAnchor(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
