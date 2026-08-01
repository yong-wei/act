/**
 * Historical / multi-era LearningFact serving projection (#1116).
 *
 * Cumulative reads may present both Legacy and Canonical eras, but each fact
 * keeps its own namespace and revision. Current Canonical graph must not
 * reinterpret historical facts.
 */

import {
  LEGACY_UNVERSIONED_REVISION,
  type LearningFactIdentityNamespace,
  type LearningFactServingIdentity,
} from './contracts';

export interface LearningFactServingRecord {
  id: string;
  knowledgeIdentityNamespace?: string | null;
  canonicalObjectId?: string | null;
  aggregateReleaseSetId?: string | null;
  aggregateReleaseId?: string | null;
  knowledgeProjectionId?: string | null;
  knowledgeRevisionRef?: string | null;
  contextJson?: unknown;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function legacyKnowledgeNodeIdsFromContext(contextJson: unknown): string[] {
  const context = readRecord(contextJson);
  const evidence = readRecord(context.evidenceGovernance);
  return [
    ...readStringArray(context.knowledgeNodeIds),
    ...readStringArray(evidence.knowledgeNodeIds),
  ];
}

function contextKnowledgeRevision(contextJson: unknown): string | null {
  const context = readRecord(contextJson);
  const evidence = readRecord(context.evidenceGovernance);
  return (
    readString(context.knowledgeRevisionRef)
    ?? readString(evidence.knowledgeRevisionRef)
    ?? (Array.isArray(context.knowledgeRevisionRefs)
      ? readString(context.knowledgeRevisionRefs[0])
      : null)
  );
}

/**
 * Project one stored fact into a serving identity that preserves its era.
 * Does not consult the current Canonical graph or rewrite the source row.
 */
export function projectLearningFactServingIdentity(
  fact: LearningFactServingRecord,
): LearningFactServingIdentity {
  const namespaceRaw = readString(fact.knowledgeIdentityNamespace);
  const isCanonical = namespaceRaw === 'CANONICAL';
  const isLegacy = namespaceRaw === 'LEGACY' || namespaceRaw === null;

  if (isCanonical) {
    return {
      factId: fact.id,
      identityNamespace: 'CANONICAL',
      knowledgeRevisionRef:
        readString(fact.knowledgeRevisionRef)
        ?? contextKnowledgeRevision(fact.contextJson)
        ?? LEGACY_UNVERSIONED_REVISION,
      canonicalObjectId: readString(fact.canonicalObjectId),
      aggregateReleaseSetId: readString(fact.aggregateReleaseSetId),
      aggregateReleaseId: readString(fact.aggregateReleaseId),
      knowledgeProjectionId: readString(fact.knowledgeProjectionId),
      legacyKnowledgeNodeIds: [],
      historicalRevisionBound: true,
    };
  }

  if (!isLegacy) {
    // Unknown namespace: treat as frozen historical without reinterpretation.
    return {
      factId: fact.id,
      identityNamespace: 'LEGACY_UNVERSIONED',
      knowledgeRevisionRef:
        readString(fact.knowledgeRevisionRef)
        ?? contextKnowledgeRevision(fact.contextJson)
        ?? LEGACY_UNVERSIONED_REVISION,
      canonicalObjectId: null,
      aggregateReleaseSetId: null,
      aggregateReleaseId: null,
      knowledgeProjectionId: null,
      legacyKnowledgeNodeIds: legacyKnowledgeNodeIdsFromContext(fact.contextJson),
      historicalRevisionBound: true,
    };
  }

  const revision =
    readString(fact.knowledgeRevisionRef)
    ?? contextKnowledgeRevision(fact.contextJson);

  return {
    factId: fact.id,
    identityNamespace: revision ? 'LEGACY' : 'LEGACY_UNVERSIONED',
    knowledgeRevisionRef: revision ?? LEGACY_UNVERSIONED_REVISION,
    canonicalObjectId: null,
    aggregateReleaseSetId: null,
    aggregateReleaseId: null,
    knowledgeProjectionId: null,
    legacyKnowledgeNodeIds: legacyKnowledgeNodeIdsFromContext(fact.contextJson),
    historicalRevisionBound: true,
  };
}

/**
 * Cumulative multi-era view: each fact remains attributable to its own
 * namespace/revision. Never rewrites historical source identities.
 */
export function projectCoexistingLearningFactIdentities(
  facts: readonly LearningFactServingRecord[],
): LearningFactServingIdentity[] {
  return facts.map(projectLearningFactServingIdentity);
}

export function servingIdentityNamespaces(
  facts: readonly LearningFactServingRecord[],
): Array<LearningFactIdentityNamespace | 'LEGACY_UNVERSIONED'> {
  return projectCoexistingLearningFactIdentities(facts).map(
    (item) => item.identityNamespace,
  );
}

/**
 * Guard for consumers that must not reinterpret historical facts with the
 * current Canonical graph. Always returns the fact's own revision.
 */
export function resolveFactBoundRevision(
  fact: LearningFactServingRecord,
): string {
  return projectLearningFactServingIdentity(fact).knowledgeRevisionRef;
}
