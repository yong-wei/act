/**
 * Scope-aware Teaching Projection resolver and Legacy/pinned fallback (#1273).
 *
 * Course and classroom consumers pass a scope; the resolver returns only
 * resources/bindings reachable from that scope and the selected projection
 * combination. It never scans Authority to fill teaching gaps.
 */

import type { AuthorityStorePaths } from '@/lib/authoritative-knowledge/authority-store';
import { resolveEngineeringGraphAuthority } from '@/lib/authoritative-knowledge/engineering-authority-consumers';
import type {
  TeachingBindingRuntime,
  TeachingCardIndexEntry,
  TeachingCoreNodeRuntime,
  TeachingPrerequisiteRuntime,
  TeachingResourceRuntime,
} from '@/lib/teaching-projection/contracts';
import {
  loadStagedTeachingProjection,
  resolveActiveTeachingProjection,
  type TeachingProjectionStorePaths,
} from '@/lib/teaching-projection/store';

import type {
  LayeredGraphAuthorityInput,
  LayeredGraphFallbackProvenance,
  LayeredGraphProjectionInput,
  LayeredGraphResolveRequest,
  LayeredGraphScope,
  TeachingResourceBindingView,
} from './contracts';

export function resolveLayeredGraphAuthorityInput(
  authorityPaths: AuthorityStorePaths,
): LayeredGraphAuthorityInput {
  const resolved = resolveEngineeringGraphAuthority(authorityPaths);
  if (resolved.status !== 'ready' || !resolved.engineering) {
    return {
      status: 'unavailable',
      releaseId: resolved.releaseId,
      releaseSetId: resolved.releaseSetId,
      snapshotId: resolved.snapshotId,
      snapshotHash: resolved.snapshotHash,
      engineering: null,
      manifest: resolved.manifest,
      reason: resolved.reason ?? 'authority-unavailable',
    };
  }

  return {
    status: 'ready',
    releaseId: resolved.releaseId,
    releaseSetId: resolved.releaseSetId,
    snapshotId: resolved.snapshotId,
    snapshotHash: resolved.snapshotHash,
    engineering: {
      objects: resolved.engineering.objects,
      relations: resolved.engineering.relations,
    },
    manifest: resolved.manifest,
  };
}

function resourceMatchesScope(
  resource: TeachingResourceRuntime,
  scope: LayeredGraphScope | null | undefined,
): boolean {
  if (!scope) return true;
  if (resource.scopeId !== scope.scopeId) return false;
  if (!scope.lessonKey && !scope.stepId) return true;

  // Resource IDs are deterministic: act:<type>:<keys...>
  // Scope filtering prefers scopeId; lesson/step further narrow when provided.
  if (scope.stepId) {
    if (resource.resourceType === 'step') {
      return (
        resource.resourceId.endsWith(`:${scope.stepId}`)
        || resource.resourceId.includes(`:${scope.stepId}`)
      );
    }
    // Non-step resources in the same lesson remain visible when step-scoped.
    if (scope.lessonKey) {
      return (
        resource.resourceId.includes(`:${scope.lessonKey}`)
        || resource.sourcePath?.includes(scope.lessonKey) === true
      );
    }
    return true;
  }

  if (scope.lessonKey) {
    return (
      resource.resourceId.includes(`:${scope.lessonKey}`)
      || resource.sourcePath?.includes(scope.lessonKey) === true
    );
  }

  return true;
}

function bindingMatchesScope(
  binding: TeachingBindingRuntime,
  scope: LayeredGraphScope | null | undefined,
  resourceIds: ReadonlySet<string>,
): boolean {
  if (!scope) return true;
  if (binding.scopeId !== scope.scopeId) return false;
  if (!resourceIds.has(binding.resourceId)) return false;
  if (scope.knowledgeRefs && scope.knowledgeRefs.length > 0) {
    return scope.knowledgeRefs.includes(binding.canonicalId);
  }
  return true;
}

function prerequisiteMatchesScope(
  edge: TeachingPrerequisiteRuntime,
  scope: LayeredGraphScope | null | undefined,
  projectedCanonicalIds: ReadonlySet<string>,
): boolean {
  if (!scope) return true;
  if (edge.scopeId && edge.scopeId !== scope.scopeId) return false;
  // Only edges whose endpoints are in the projected scope set.
  return (
    projectedCanonicalIds.has(edge.sourceCanonicalId)
    || projectedCanonicalIds.has(edge.targetCanonicalId)
  );
}

export function filterProjectionToScope(input: {
  resources: readonly TeachingResourceRuntime[];
  bindings: readonly TeachingBindingRuntime[];
  prerequisites: readonly TeachingPrerequisiteRuntime[];
  coreNodes: readonly TeachingCoreNodeRuntime[];
  cards: readonly TeachingCardIndexEntry[];
  notProjectedCanonicalIds: readonly string[];
  scope: LayeredGraphScope | null | undefined;
}): {
  resources: TeachingResourceRuntime[];
  bindings: TeachingBindingRuntime[];
  prerequisites: TeachingPrerequisiteRuntime[];
  coreNodes: TeachingCoreNodeRuntime[];
  cards: TeachingCardIndexEntry[];
  notProjectedCanonicalIds: string[];
} {
  const resources = input.resources.filter((resource) =>
    resourceMatchesScope(resource, input.scope),
  );
  const resourceIds = new Set(resources.map((resource) => resource.resourceId));
  const bindings = input.bindings.filter((binding) =>
    bindingMatchesScope(binding, input.scope, resourceIds),
  );
  const projectedCanonicalIds = new Set(bindings.map((binding) => binding.canonicalId));
  for (const node of input.coreNodes) {
    if (!input.scope || node.scopeId === input.scope.scopeId) {
      projectedCanonicalIds.add(node.canonicalId);
    }
  }

  const prerequisites = input.prerequisites.filter((edge) =>
    prerequisiteMatchesScope(edge, input.scope, projectedCanonicalIds),
  );
  const coreNodes = input.coreNodes.filter(
    (node) => !input.scope || node.scopeId === input.scope.scopeId,
  );
  const cards = input.cards.filter((card) => {
    if (!input.scope) return true;
    if (input.scope.knowledgeRefs && input.scope.knowledgeRefs.length > 0) {
      return input.scope.knowledgeRefs.includes(card.canonicalId);
    }
    return projectedCanonicalIds.has(card.canonicalId) || coreNodes.some(
      (node) => node.canonicalId === card.canonicalId,
    );
  });

  // notProjected stays scoped diagnostics — Authority nodes not bound in scope.
  const notProjectedCanonicalIds = [...input.notProjectedCanonicalIds].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  return {
    resources: [...resources].sort((a, b) =>
      a.resourceId < b.resourceId ? -1 : a.resourceId > b.resourceId ? 1 : 0,
    ),
    bindings: [...bindings].sort((a, b) =>
      a.bindingId < b.bindingId ? -1 : a.bindingId > b.bindingId ? 1 : 0,
    ),
    prerequisites: [...prerequisites].sort((a, b) =>
      a.prerequisiteId < b.prerequisiteId
        ? -1
        : a.prerequisiteId > b.prerequisiteId
          ? 1
          : 0,
    ),
    coreNodes: [...coreNodes].sort((a, b) =>
      a.canonicalId < b.canonicalId ? -1 : a.canonicalId > b.canonicalId ? 1 : 0,
    ),
    cards: [...cards].sort((a, b) =>
      a.cardId < b.cardId ? -1 : a.cardId > b.cardId ? 1 : 0,
    ),
    notProjectedCanonicalIds,
  };
}

function projectionArtifactsToInput(input: {
  status: LayeredGraphProjectionInput['status'];
  source: LayeredGraphProjectionInput['source'];
  projectionId: string | null;
  projectionHash: string | null;
  authorityReleaseId: string | null;
  scopeId: string | null;
  resources: readonly TeachingResourceRuntime[];
  bindings: readonly TeachingBindingRuntime[];
  prerequisites: readonly TeachingPrerequisiteRuntime[];
  coreNodes: readonly TeachingCoreNodeRuntime[];
  cards: readonly TeachingCardIndexEntry[];
  notProjectedCanonicalIds: readonly string[];
  reasons: string[];
  fallback?: LayeredGraphFallbackProvenance | null;
  scope: LayeredGraphScope | null | undefined;
  manifest?: LayeredGraphProjectionInput['manifest'];
}): LayeredGraphProjectionInput {
  const scoped = filterProjectionToScope({
    resources: input.resources,
    bindings: input.bindings,
    prerequisites: input.prerequisites,
    coreNodes: input.coreNodes,
    cards: input.cards,
    notProjectedCanonicalIds: input.notProjectedCanonicalIds,
    scope: input.scope,
  });

  return {
    status: input.status,
    source: input.source,
    projectionId: input.projectionId,
    projectionHash: input.projectionHash,
    authorityReleaseId: input.authorityReleaseId,
    scopeId: input.scopeId,
    manifest: input.manifest ?? null,
    resources: scoped.resources,
    bindings: scoped.bindings,
    prerequisites: scoped.prerequisites,
    coreNodes: scoped.coreNodes,
    cards: scoped.cards,
    notProjectedCanonicalIds: scoped.notProjectedCanonicalIds,
    reasons: input.reasons,
    fallback: input.fallback ?? null,
  };
}

function emptyProjection(input: {
  status: LayeredGraphProjectionInput['status'];
  source: LayeredGraphProjectionInput['source'];
  reasons: string[];
  fallback?: LayeredGraphFallbackProvenance | null;
  authorityReleaseId?: string | null;
  scopeId?: string | null;
}): LayeredGraphProjectionInput {
  return {
    status: input.status,
    source: input.source,
    projectionId: null,
    projectionHash: null,
    authorityReleaseId: input.authorityReleaseId ?? null,
    scopeId: input.scopeId ?? null,
    manifest: null,
    resources: [],
    bindings: [],
    prerequisites: [],
    coreNodes: [],
    cards: [],
    notProjectedCanonicalIds: [],
    reasons: input.reasons,
    fallback: input.fallback ?? null,
  };
}

/**
 * Resolve teaching projection for a consumer request with explicit fallback.
 * Never mixes candidate + Legacy or pin + active records.
 */
export function resolveTeachingProjectionForScope(input: {
  projectionPaths: TeachingProjectionStorePaths;
  request: LayeredGraphResolveRequest;
  /**
   * Optional Legacy adapter data. When provided and active/candidate are
   * unavailable, used only when allowLegacyFallback is true.
   */
  legacyProjection?: {
    projectionId: string;
    projectionHash: string;
    authorityReleaseId: string;
    scopeId: string;
    resources: readonly TeachingResourceRuntime[];
    bindings: readonly TeachingBindingRuntime[];
    prerequisites: readonly TeachingPrerequisiteRuntime[];
    coreNodes: readonly TeachingCoreNodeRuntime[];
    cards: readonly TeachingCardIndexEntry[];
    notProjectedCanonicalIds?: readonly string[];
  } | null;
}): LayeredGraphProjectionInput {
  const { projectionPaths, request } = input;
  const scope = request.scope ?? null;
  const requiredAuthority = request.requiredAuthorityReleaseId ?? null;

  if (request.includeTeaching === false) {
    return emptyProjection({
      status: 'absent',
      source: 'none',
      reasons: ['teaching-layers-not-requested'],
      scopeId: scope?.scopeId ?? null,
      authorityReleaseId: requiredAuthority,
    });
  }

  // 1) Explicit candidate pin (shadow/read-only path).
  if (request.candidateProjectionId) {
    try {
      const staged = loadStagedTeachingProjection(
        projectionPaths,
        request.candidateProjectionId,
      );
      const manifest = staged.artifacts.manifest;
      if (
        requiredAuthority
        && manifest.authorityReleaseId
        && manifest.authorityReleaseId !== requiredAuthority
      ) {
        return emptyProjection({
          status: 'identity-drift',
          source: 'candidate',
          reasons: [
            'candidate-authority-release-mismatch',
            `required:${requiredAuthority}`,
            `actual:${manifest.authorityReleaseId}`,
          ],
          authorityReleaseId: requiredAuthority,
          scopeId: scope?.scopeId ?? manifest.scopeId,
        });
      }
      if (
        scope?.scopeId
        && manifest.scopeId
        && scope.scopeId !== manifest.scopeId
      ) {
        // Scope mismatch: return NOT_PROJECTED for this scope, not a mix.
        return emptyProjection({
          status: 'NOT_PROJECTED',
          source: 'candidate',
          reasons: [
            'scope-not-in-projection',
            `requested:${scope.scopeId}`,
            `projection:${manifest.scopeId}`,
          ],
          authorityReleaseId: manifest.authorityReleaseId,
          scopeId: scope.scopeId,
        });
      }
      return projectionArtifactsToInput({
        status: 'ready',
        source: 'candidate',
        projectionId: staged.projectionId,
        projectionHash: staged.projectionHash,
        authorityReleaseId: manifest.authorityReleaseId,
        scopeId: manifest.scopeId,
        resources: staged.artifacts.resources,
        bindings: staged.artifacts.bindings,
        prerequisites: staged.artifacts.prerequisites,
        coreNodes: staged.artifacts.coreNodes,
        cards: staged.artifacts.cardsIndex.cards,
        notProjectedCanonicalIds: staged.artifacts.gate.notProjectedCanonicalIds,
        reasons: ['candidate-projection-ready'],
        scope,
        manifest,
      });
    } catch (error) {
      // Candidate missing → explicit unavailable, then pin/Legacy only.
      // Must pass projectionPaths so a valid pin can load artifacts.
      const pin = tryPinnedFallback(
        request,
        scope,
        requiredAuthority,
        projectionPaths,
      );
      if (pin) return pin;
      if (request.allowLegacyFallback && input.legacyProjection) {
        return legacyFallback(input.legacyProjection, scope, [
          'candidate-unavailable',
          error instanceof Error ? error.message : 'candidate-load-failed',
        ]);
      }
      return emptyProjection({
        status: 'unavailable',
        source: 'candidate',
        reasons: [
          'candidate-projection-unavailable',
          error instanceof Error ? error.message : 'load-failed',
        ],
        authorityReleaseId: requiredAuthority,
        scopeId: scope?.scopeId ?? null,
      });
    }
  }

  // 2) Active projection pointer.
  const active = resolveActiveTeachingProjection(projectionPaths);
  if (active.status === 'available' && active.staged) {
    const staged = active.staged;
    const manifest = staged.artifacts.manifest;

    if (
      requiredAuthority
      && manifest.authorityReleaseId
      && manifest.authorityReleaseId !== requiredAuthority
    ) {
      // Fail closed for teaching layer; do not mix with another release.
      const pin = tryPinnedFallback(
        request,
        scope,
        requiredAuthority,
        projectionPaths,
      );
      if (pin) return pin;
      return emptyProjection({
        status: 'identity-drift',
        source: 'active',
        reasons: [
          'active-authority-release-mismatch',
          `required:${requiredAuthority}`,
          `actual:${manifest.authorityReleaseId}`,
        ],
        authorityReleaseId: requiredAuthority,
        scopeId: scope?.scopeId ?? manifest.scopeId,
      });
    }

    if (
      scope?.scopeId
      && manifest.scopeId
      && scope.scopeId !== manifest.scopeId
    ) {
      return emptyProjection({
        status: 'NOT_PROJECTED',
        source: 'active',
        reasons: [
          'scope-not-in-projection',
          `requested:${scope.scopeId}`,
          `projection:${manifest.scopeId}`,
        ],
        authorityReleaseId: manifest.authorityReleaseId,
        scopeId: scope.scopeId,
      });
    }

    return projectionArtifactsToInput({
      status: 'ready',
      source: 'active',
      projectionId: staged.projectionId,
      projectionHash: staged.projectionHash,
      authorityReleaseId: manifest.authorityReleaseId,
      scopeId: manifest.scopeId,
      resources: staged.artifacts.resources,
      bindings: staged.artifacts.bindings,
      prerequisites: staged.artifacts.prerequisites,
      coreNodes: staged.artifacts.coreNodes,
      cards: staged.artifacts.cardsIndex.cards,
      notProjectedCanonicalIds: staged.artifacts.gate.notProjectedCanonicalIds,
      reasons: ['active-projection-ready'],
      scope,
      manifest,
    });
  }

  // 3) Pinned previous.
  const pin = tryPinnedFallback(request, scope, requiredAuthority, projectionPaths);
  if (pin) return pin;

  // 4) Named Legacy fallback.
  if (request.allowLegacyFallback && input.legacyProjection) {
    return legacyFallback(input.legacyProjection, scope, [
      active.detail ?? 'active-projection-unavailable',
    ]);
  }

  return emptyProjection({
    status: active.status === 'unavailable' ? 'absent' : 'unavailable',
    source: 'none',
    reasons: [active.detail ?? 'projection-not-available'],
    authorityReleaseId: requiredAuthority,
    scopeId: scope?.scopeId ?? null,
  });
}

function tryPinnedFallback(
  request: LayeredGraphResolveRequest,
  scope: LayeredGraphScope | null,
  requiredAuthority: string | null,
  projectionPaths?: TeachingProjectionStorePaths,
): LayeredGraphProjectionInput | null {
  if (!request.pinnedProjectionId) return null;

  if (projectionPaths) {
    try {
      const staged = loadStagedTeachingProjection(
        projectionPaths,
        request.pinnedProjectionId,
      );
      if (
        request.pinnedProjectionHash
        && staged.projectionHash !== request.pinnedProjectionHash
      ) {
        return emptyProjection({
          status: 'identity-drift',
          source: 'pinned',
          reasons: [
            'pinned-projection-hash-mismatch',
            `expected:${request.pinnedProjectionHash}`,
            `actual:${staged.projectionHash}`,
          ],
          authorityReleaseId: requiredAuthority,
          scopeId: scope?.scopeId ?? null,
        });
      }
      if (
        staged.projectionId
        && request.pinnedProjectionId
        && staged.projectionId !== request.pinnedProjectionId
      ) {
        return emptyProjection({
          status: 'identity-drift',
          source: 'pinned',
          reasons: [
            'pinned-projection-id-mismatch',
            `expected:${request.pinnedProjectionId}`,
            `actual:${staged.projectionId}`,
          ],
          authorityReleaseId: requiredAuthority,
          scopeId: scope?.scopeId ?? null,
        });
      }

      const manifest = staged.artifacts.manifest;

      // Fail closed before returning artifacts when pin identity drifts from
      // the required Authority / requested scope.
      if (
        requiredAuthority
        && manifest.authorityReleaseId
        && manifest.authorityReleaseId !== requiredAuthority
      ) {
        return emptyProjection({
          status: 'identity-drift',
          source: 'pinned',
          reasons: [
            'pinned-authority-release-mismatch',
            `required:${requiredAuthority}`,
            `actual:${manifest.authorityReleaseId}`,
          ],
          authorityReleaseId: requiredAuthority,
          scopeId: scope?.scopeId ?? null,
        });
      }
      if (
        scope?.scopeId
        && manifest.scopeId
        && scope.scopeId !== manifest.scopeId
      ) {
        return emptyProjection({
          status: 'NOT_PROJECTED',
          source: 'pinned',
          reasons: [
            'pinned-scope-mismatch',
            `requested:${scope.scopeId}`,
            `projection:${manifest.scopeId}`,
          ],
          authorityReleaseId: manifest.authorityReleaseId,
          scopeId: scope.scopeId,
        });
      }

      const fallback: LayeredGraphFallbackProvenance = {
        kind: 'pinned-previous',
        adapterId: 'pinned-previous-projection',
        authorityReleaseId: manifest.authorityReleaseId,
        projectionId: staged.projectionId,
        projectionHash: staged.projectionHash,
        scopeId: manifest.scopeId,
        reasons: ['using-pinned-previous-projection'],
      };
      return projectionArtifactsToInput({
        status: 'fallback',
        source: 'pinned',
        projectionId: staged.projectionId,
        projectionHash: staged.projectionHash,
        authorityReleaseId: manifest.authorityReleaseId,
        scopeId: manifest.scopeId,
        resources: staged.artifacts.resources,
        bindings: staged.artifacts.bindings,
        prerequisites: staged.artifacts.prerequisites,
        coreNodes: staged.artifacts.coreNodes,
        cards: staged.artifacts.cardsIndex.cards,
        notProjectedCanonicalIds: staged.artifacts.gate.notProjectedCanonicalIds,
        reasons: ['pinned-previous-projection'],
        fallback,
        scope,
        manifest,
      });
    } catch {
      // Fall through to identity-only pin status.
    }
  }

  const fallback: LayeredGraphFallbackProvenance = {
    kind: 'pinned-previous',
    adapterId: 'pinned-previous-projection',
    authorityReleaseId: requiredAuthority,
    projectionId: request.pinnedProjectionId,
    projectionHash: request.pinnedProjectionHash ?? null,
    scopeId: scope?.scopeId ?? null,
    reasons: ['pinned-projection-declared-but-not-loaded'],
  };
  return emptyProjection({
    status: 'fallback',
    source: 'pinned',
    reasons: ['pinned-projection-unavailable-for-load'],
    fallback,
    authorityReleaseId: requiredAuthority,
    scopeId: scope?.scopeId ?? null,
  });
}

function legacyFallback(
  legacy: NonNullable<
    Parameters<typeof resolveTeachingProjectionForScope>[0]['legacyProjection']
  >,
  scope: LayeredGraphScope | null,
  extraReasons: string[],
): LayeredGraphProjectionInput {
  const fallback: LayeredGraphFallbackProvenance = {
    kind: 'legacy',
    adapterId: 'legacy-runtime-projection',
    authorityReleaseId: legacy.authorityReleaseId,
    projectionId: legacy.projectionId,
    projectionHash: legacy.projectionHash,
    scopeId: legacy.scopeId,
    reasons: ['using-explicit-legacy-fallback', ...extraReasons],
  };
  return projectionArtifactsToInput({
    status: 'fallback',
    source: 'legacy',
    projectionId: legacy.projectionId,
    projectionHash: legacy.projectionHash,
    authorityReleaseId: legacy.authorityReleaseId,
    scopeId: legacy.scopeId,
    resources: legacy.resources,
    bindings: legacy.bindings,
    prerequisites: legacy.prerequisites,
    coreNodes: legacy.coreNodes,
    cards: legacy.cards,
    notProjectedCanonicalIds: legacy.notProjectedCanonicalIds ?? [],
    reasons: fallback.reasons,
    fallback,
    scope,
  });
}

export function buildTeachingResourceBindingViews(input: {
  bindings: readonly TeachingBindingRuntime[];
  resources: readonly TeachingResourceRuntime[];
}): TeachingResourceBindingView[] {
  const resourcesById = new Map(
    input.resources.map((resource) => [resource.resourceId, resource]),
  );
  return input.bindings.map((binding) => {
    const resource = resourcesById.get(binding.resourceId);
    return {
      bindingId: binding.bindingId,
      resourceId: binding.resourceId,
      canonicalId: binding.canonicalId,
      role: binding.role,
      scopeId: binding.scopeId,
      primary: binding.primary,
      resourceType: resource?.resourceType ?? null,
      resourceTitle: resource?.title ?? null,
      projectionMode: resource?.projectionMode ?? null,
      sourcePath: binding.sourcePath ?? resource?.sourcePath ?? null,
    };
  });
}
