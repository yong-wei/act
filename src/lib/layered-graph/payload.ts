/**
 * Build layered graph payloads from Authority + Teaching Projection (#1273).
 */

import type {
  EngineeringGraphLayer,
  LayeredGraphAuthorityInput,
  LayeredGraphLayerIdentity,
  LayeredGraphPayload,
  LayeredGraphProjectionInput,
  LayeredGraphResolveRequest,
  LayeredGraphScope,
  LayeredNodeInspectorSections,
  TeachingPrerequisitesLayer,
  TeachingResourcesLayer,
} from './contracts';
import { LAYERED_GRAPH_PAYLOAD_CONTRACT } from './contracts';
import { buildTeachingResourceBindingViews } from './resolver';

function engineeringIdentity(
  authority: LayeredGraphAuthorityInput,
): LayeredGraphLayerIdentity {
  if (authority.status !== 'ready') {
    return {
      layer: 'engineering',
      status: 'unavailable',
      authorityReleaseId: authority.releaseId,
      authoritySnapshotId: authority.snapshotId,
      authoritySnapshotHash: authority.snapshotHash,
      projectionId: null,
      projectionHash: null,
      scopeId: null,
      reasons: [authority.reason ?? 'authority-unavailable'],
    };
  }
  return {
    layer: 'engineering',
    status: 'ready',
    authorityReleaseId: authority.releaseId,
    authoritySnapshotId: authority.snapshotId,
    authoritySnapshotHash: authority.snapshotHash,
    projectionId: null,
    projectionHash: null,
    scopeId: null,
    reasons: ['engineering-authority-ready'],
  };
}

function teachingIdentity(
  layer: 'teachingPrerequisites' | 'teachingResources',
  projection: LayeredGraphProjectionInput,
  scope: LayeredGraphScope | null | undefined,
): LayeredGraphLayerIdentity {
  return {
    layer,
    status: projection.status,
    authorityReleaseId: projection.authorityReleaseId,
    authoritySnapshotId: null,
    authoritySnapshotHash: null,
    projectionId: projection.projectionId,
    projectionHash: projection.projectionHash,
    scopeId: scope?.scopeId ?? projection.scopeId,
    reasons: projection.reasons,
  };
}

export function buildEngineeringGraphLayer(
  authority: LayeredGraphAuthorityInput,
): EngineeringGraphLayer {
  const identity = engineeringIdentity(authority);
  if (authority.status !== 'ready' || !authority.engineering) {
    return {
      identity,
      nodes: [],
      relations: [],
      predicates: [],
    };
  }

  const predicates = [
    ...new Set(authority.engineering.relations.map((relation) => relation.relationType)),
  ].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  return {
    identity,
    nodes: [...authority.engineering.objects],
    relations: [...authority.engineering.relations],
    predicates,
  };
}

export function buildTeachingPrerequisitesLayer(
  projection: LayeredGraphProjectionInput,
  scope?: LayeredGraphScope | null,
): TeachingPrerequisitesLayer {
  return {
    identity: teachingIdentity('teachingPrerequisites', projection, scope),
    edges: projection.prerequisites.map((edge) => ({
      prerequisiteId: edge.prerequisiteId,
      sourceCanonicalId: edge.sourceCanonicalId,
      targetCanonicalId: edge.targetCanonicalId,
      strength: edge.strength,
      scopeId: edge.scopeId,
      evidenceRef: edge.evidenceRef,
      rationale: edge.rationale,
    })),
  };
}

export function buildTeachingResourcesLayer(
  projection: LayeredGraphProjectionInput,
  scope?: LayeredGraphScope | null,
): TeachingResourcesLayer {
  return {
    identity: teachingIdentity('teachingResources', projection, scope),
    resources: projection.resources,
    bindings: buildTeachingResourceBindingViews({
      bindings: projection.bindings,
      resources: projection.resources,
    }),
    coreNodes: projection.coreNodes,
    cards: projection.cards,
    notProjectedCanonicalIds: projection.notProjectedCanonicalIds,
  };
}

/**
 * Compose a full layered payload. Teaching layers stay independent of
 * engineering readiness and never rewrite engineering relations.
 */
export function buildLayeredGraphPayload(input: {
  authority: LayeredGraphAuthorityInput;
  projection: LayeredGraphProjectionInput;
  request?: LayeredGraphResolveRequest | null;
}): LayeredGraphPayload {
  const scope = input.request?.scope ?? null;
  const engineering = buildEngineeringGraphLayer(input.authority);
  const teachingPrerequisites = buildTeachingPrerequisitesLayer(
    input.projection,
    scope,
  );
  const teachingResources = buildTeachingResourcesLayer(input.projection, scope);

  return {
    contract: LAYERED_GRAPH_PAYLOAD_CONTRACT,
    engineering,
    teachingPrerequisites,
    teachingResources,
    fallback: input.projection.fallback ?? null,
    requestedScope: scope,
  };
}

/**
 * Node inspector sections for workspace UI. Engineering relations remain exact
 * and separate from teaching prerequisites/resources.
 */
export function buildLayeredNodeInspectorSections(input: {
  payload: LayeredGraphPayload;
  canonicalId: string;
}): LayeredNodeInspectorSections {
  const { payload, canonicalId } = input;
  const engineeringNode =
    payload.engineering.nodes.find((node) => node.canonicalId === canonicalId)
    ?? null;
  const engineeringRelations = payload.engineering.relations.filter(
    (relation) =>
      relation.sourceId === canonicalId || relation.targetId === canonicalId,
  );

  const incoming = payload.teachingPrerequisites.edges.filter(
    (edge) => edge.targetCanonicalId === canonicalId,
  );
  const outgoing = payload.teachingPrerequisites.edges.filter(
    (edge) => edge.sourceCanonicalId === canonicalId,
  );

  const bindings = payload.teachingResources.bindings.filter(
    (binding) => binding.canonicalId === canonicalId,
  );
  const cards = payload.teachingResources.cards.filter(
    (card) => card.canonicalId === canonicalId,
  );

  const teachingStatus = payload.teachingResources.identity.status;
  let resourceStatus: LayeredNodeInspectorSections['teachingResources']['status'] =
    teachingStatus;
  if (
    (teachingStatus === 'ready' || teachingStatus === 'fallback')
    && bindings.length === 0
    && engineeringNode
  ) {
    resourceStatus = 'NOT_PROJECTED';
  }

  let optionalCardStatus: LayeredNodeInspectorSections['teachingResources']['optionalCardStatus'] =
    'not-applicable';
  if (cards.length === 0) {
    optionalCardStatus = engineeringNode || bindings.length > 0 ? 'absent' : 'not-applicable';
  } else if (cards.some((card) => card.active)) {
    optionalCardStatus = 'active';
  } else {
    optionalCardStatus = 'inactive';
  }

  return {
    canonicalId,
    engineering: {
      present: Boolean(engineeringNode),
      node: engineeringNode,
      relations: engineeringRelations,
    },
    teachingPrerequisites: {
      status: payload.teachingPrerequisites.identity.status,
      incoming,
      outgoing,
    },
    teachingResources: {
      status: resourceStatus,
      bindings,
      cards,
      optionalCardStatus,
    },
    fallback: payload.fallback,
    projectionIdentity: {
      projectionId: payload.teachingResources.identity.projectionId,
      projectionHash: payload.teachingResources.identity.projectionHash,
      scopeId: payload.teachingResources.identity.scopeId,
      authorityReleaseId: payload.teachingResources.identity.authorityReleaseId,
    },
  };
}

/**
 * Layers that surface teaching content (ready or explicit fallback) must share
 * a single Authority/projection identity. Absent/unavailable layers are ignored.
 */
function layerCarriesComparableIdentity(
  status: LayeredGraphPayload['teachingResources']['identity']['status'],
): boolean {
  return status === 'ready' || status === 'fallback';
}

/**
 * Assert layers do not mix identities (used by tests and fail-closed gates).
 * Covers both ready and fallback teaching layers so a pinned/legacy fallback
 * cannot silently pair with a different Engineering Authority release.
 */
export function assertNoLayerIdentityMixing(payload: LayeredGraphPayload): {
  ok: boolean;
  violations: string[];
} {
  const violations: string[] = [];
  const engRelease = payload.engineering.identity.authorityReleaseId;
  const teachRelease = payload.teachingResources.identity.authorityReleaseId;
  const prereqRelease = payload.teachingPrerequisites.identity.authorityReleaseId;
  const teachActive = layerCarriesComparableIdentity(
    payload.teachingResources.identity.status,
  );
  const prereqActive = layerCarriesComparableIdentity(
    payload.teachingPrerequisites.identity.status,
  );

  if (
    engRelease
    && teachRelease
    && engRelease !== teachRelease
    && teachActive
    && payload.engineering.identity.status === 'ready'
  ) {
    violations.push(
      `engineering-teaching-release-mismatch:${engRelease}!=${teachRelease}`,
    );
  }
  if (
    teachRelease
    && prereqRelease
    && teachRelease !== prereqRelease
    && prereqActive
    && teachActive
  ) {
    violations.push(
      `prerequisite-resource-release-mismatch:${prereqRelease}!=${teachRelease}`,
    );
  }

  const teachProj = payload.teachingResources.identity.projectionId;
  const prereqProj = payload.teachingPrerequisites.identity.projectionId;
  if (
    teachProj
    && prereqProj
    && teachProj !== prereqProj
    && teachActive
    && prereqActive
  ) {
    violations.push(
      `prerequisite-resource-projection-mismatch:${prereqProj}!=${teachProj}`,
    );
  }

  // Fallback provenance must agree with teaching layer identity when present.
  if (
    payload.fallback
    && teachActive
    && payload.fallback.authorityReleaseId
    && teachRelease
    && payload.fallback.authorityReleaseId !== teachRelease
  ) {
    violations.push(
      `fallback-teaching-release-mismatch:${payload.fallback.authorityReleaseId}!=${teachRelease}`,
    );
  }
  if (
    payload.fallback
    && teachActive
    && payload.fallback.projectionId
    && teachProj
    && payload.fallback.projectionId !== teachProj
  ) {
    violations.push(
      `fallback-teaching-projection-mismatch:${payload.fallback.projectionId}!=${teachProj}`,
    );
  }

  // Engineering predicates must never appear rewritten into teaching edges.
  for (const edge of payload.teachingPrerequisites.edges) {
    if (!edge.strength || !['REQUIRED', 'RECOMMENDED'].includes(edge.strength)) {
      violations.push(`invalid-teaching-prerequisite-strength:${edge.prerequisiteId}`);
    }
  }

  return { ok: violations.length === 0, violations };
}
