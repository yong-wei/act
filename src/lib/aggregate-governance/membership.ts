/**
 * Authoritative current Canonical Object membership for course governance.
 *
 * Membership is the equality of the runtime Projection node set and the
 * knowledge_object entry set. Relation / evidence / governance entries are
 * never course objects. Governance does NOT bind to a fixed object count.
 */

export interface MembershipEntryLike {
  entityId: string;
  entityRole?: string | null;
}

export interface ProjectionNodeLike {
  entityId: string;
}

export interface CanonicalObjectMembership {
  canonicalIds: string[];
  source: 'projection-nodes-eq-knowledge-object-entries';
  projectionNodeCount: number;
  knowledgeObjectEntryCount: number;
}

function uniqueSorted(ids: Iterable<string>): string[] {
  return [...new Set([...ids].filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

/**
 * Resolve current Canonical Object membership by exact equality of:
 * - authoritative Projection node entity ids
 * - Release entries with entityRole === knowledge_object
 *
 * Both sets must be non-empty and identical. No fixed-count production gate.
 */
export function selectCanonicalObjectMembership(input: {
  projectionNodes: readonly ProjectionNodeLike[];
  releaseEntries: readonly MembershipEntryLike[];
}): CanonicalObjectMembership {
  const projectionIds = uniqueSorted(
    input.projectionNodes.map((row) => row.entityId),
  );
  const knowledgeObjectIds = uniqueSorted(
    input.releaseEntries
      .filter((row) => row.entityRole === 'knowledge_object')
      .map((row) => row.entityId),
  );

  if (projectionIds.length === 0) {
    throw new Error(
      'Aggregate governance rejected: Projection node membership is empty',
    );
  }
  if (knowledgeObjectIds.length === 0) {
    throw new Error(
      'Aggregate governance rejected: knowledge_object entry membership is empty',
    );
  }
  if (projectionIds.length !== knowledgeObjectIds.length) {
    throw new Error(
      `Aggregate governance rejected: membership ambiguity `
      + `(projectionNodes=${projectionIds.length}, knowledge_object entries=${knowledgeObjectIds.length})`,
    );
  }
  for (let i = 0; i < projectionIds.length; i += 1) {
    if (projectionIds[i] !== knowledgeObjectIds[i]) {
      throw new Error(
        'Aggregate governance rejected: projection node set disagrees with knowledge_object entries',
      );
    }
  }

  return {
    canonicalIds: projectionIds,
    source: 'projection-nodes-eq-knowledge-object-entries',
    projectionNodeCount: projectionIds.length,
    knowledgeObjectEntryCount: knowledgeObjectIds.length,
  };
}

/**
 * Fixture-only constant for the current accepted standard candidate v0.3-r2.
 * NEVER use as a production membership gate.
 */
export const V03_R2_FIXTURE_OBJECT_COUNT = 744;

/**
 * ACT teaching-scope membership (#1265).
 *
 * Unlike Release object membership, the ACT teaching denominator is the
 * explicitly selected ACT-bound resource/core-node set and MAY be empty.
 * Aggregate/profile-only upstream IDs without an ACT binding stay outside.
 */
export interface ActTeachingScopeMembership {
  canonicalIds: string[];
  source: 'act-teaching-scope';
  empty: boolean;
  unprojectedUpstream: string[];
}

export function selectActTeachingScopeMembership(input: {
  actBoundCanonicalIds: readonly string[];
  /** Full upstream Release/projection IDs for reporting unprojected members. */
  upstreamCanonicalIds?: readonly string[];
}): ActTeachingScopeMembership {
  const bound = uniqueSorted(input.actBoundCanonicalIds);
  const upstream = uniqueSorted(input.upstreamCanonicalIds ?? []);
  const boundSet = new Set(bound);
  const unprojectedUpstream = upstream.filter((id) => !boundSet.has(id));
  // Bound IDs that do not appear upstream are still retained as selected scope
  // only when no upstream list is supplied; otherwise filter to intersection.
  const canonicalIds = upstream.length === 0
    ? bound
    : bound.filter((id) => new Set(upstream).has(id));
  return {
    canonicalIds,
    source: 'act-teaching-scope',
    empty: canonicalIds.length === 0,
    unprojectedUpstream,
  };
}
