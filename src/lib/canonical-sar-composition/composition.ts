/**
 * Query-time Canonical SAR composition (#1114).
 *
 * Parallel independent source queries → reviewed binding traversal →
 * reconstructable candidate projection. Never mutates sources, never
 * materializes a mixed graph, never replaces production Legacy SAR.
 *
 * All internal indexes and candidate/edge identities are namespace-qualified.
 * Adapter results are fail-closed validated against the requested adapter and
 * closed version context before use.
 */

import {
  assertPipelineReadinessCannotReplaceProduction,
  assertProductionSelectorUnchanged,
  assertShadowCannotActivateSarCutover,
  canonicalCompositionEnabled,
  SarCutoverActivationError,
  selectSarAuthority,
} from './authority';
import {
  assertTrustedAdapterResult,
  mergeHitIntoIndex,
  SarAdapterResultError,
} from './adapter-validation';
import { assertCompleteAdapterSet } from './adapters';
import {
  assertVerifiedSarBindingSet,
  SarBindingCapabilityError,
} from './binding-capability';
import { evaluateBindingForTraversal } from './bindings';
import { buildSarCompositionCacheKey } from './cache';
import {
  CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
  CANONICAL_SAR_CONSUMER_ID,
  SAR_AUTHORITY_OWNERS,
  SAR_EXPANSION_DEFAULTS,
  SAR_SOURCE_NAMESPACES,
  type SarCandidateEdge,
  type SarCandidateNode,
  type SarCandidateProjection,
  type SarCompositionBudget,
  type SarCompositionDiagnostics,
  type SarCompositionInput,
  type SarCompositionResult,
  type SarCompositionStatus,
  type SarProvenance,
  type SarShadowEvidence,
  type SarSourceHit,
  type SarSourceNamespace,
  type SarSourceQueryResult,
  type SarTraversalSkipReason,
} from './contracts';
import { qualifySarId, type SarQualifiedId } from './identity';
import {
  isSarSupportedObjectType,
  isSarSupportedTraversalPredicate,
  resolveSarTraversalNeighbor,
} from './semantics';
import {
  assertCompleteSarVersionContext,
  SarVersionContextError,
} from './version-context';

function elapsedMs(started: number, now?: () => number): number {
  return (now ?? (() => performance.now()))() - started;
}

function provenanceFromHit(hit: SarSourceHit): SarProvenance {
  return {
    namespace: hit.namespace,
    authorityOwner: SAR_AUTHORITY_OWNERS[hit.namespace],
    sourceIdentity: hit.sourceIdentity,
    versionRef: hit.versionRef,
    releaseSetId: hit.releaseSetId,
    releaseId: hit.releaseId,
    overlayVersion: hit.overlayVersion,
  };
}

function nodeFromHit(hit: SarSourceHit, readOnly: boolean): SarCandidateNode {
  const supported = isSarSupportedObjectType(hit.objectType) && !readOnly;
  return {
    kind: 'node',
    id: qualifySarId(hit.namespace, hit.id),
    localId: hit.id,
    objectType: hit.objectType,
    label: hit.label,
    supportedForTraversal: supported,
    provenance: provenanceFromHit(hit),
    readOnlyContext: readOnly || !supported,
  };
}

function resolveBudget(
  partial: SarCompositionInput['budget'],
): SarCompositionBudget {
  return {
    maxHops: partial?.maxHops ?? SAR_EXPANSION_DEFAULTS.maxHops,
    maxPerSourceCandidates:
      partial?.maxPerSourceCandidates
      ?? SAR_EXPANSION_DEFAULTS.maxPerSourceCandidates,
    maxTotalCandidates:
      partial?.maxTotalCandidates ?? SAR_EXPANSION_DEFAULTS.maxTotalCandidates,
  };
}

async function resolveQuery(
  value: SarSourceQueryResult | Promise<SarSourceQueryResult>,
): Promise<SarSourceQueryResult> {
  return value;
}

async function queryAllSources(
  input: SarCompositionInput,
  budget: SarCompositionBudget,
  seedIdsByNs: Map<SarSourceNamespace, string[]>,
): Promise<SarSourceQueryResult[]> {
  assertCompleteAdapterSet(input.adapters);

  const tasks = SAR_SOURCE_NAMESPACES.map(async (namespace) => {
    const adapter = input.adapters[namespace];
    const seedIds = seedIdsByNs.get(namespace) ?? [];
    const raw = await resolveQuery(
      adapter.query({
        seedIds,
        scope: input.scope,
        version: input.version,
        budget: budget.maxPerSourceCandidates,
      }),
    );
    return assertTrustedAdapterResult({
      adapter,
      result: raw,
      version: input.version,
    });
  });

  return Promise.all(tasks);
}

async function requerySource(
  input: SarCompositionInput,
  namespace: SarSourceNamespace,
  seedIds: readonly string[],
  budget: number,
): Promise<SarSourceQueryResult> {
  const adapter = input.adapters[namespace];
  const raw = await resolveQuery(
    adapter.query({
      seedIds,
      scope: input.scope,
      version: input.version,
      budget,
    }),
  );
  return assertTrustedAdapterResult({
    adapter,
    result: raw,
    version: input.version,
  });
}

/** Hit index keyed by namespace-qualified id. Conflicts fail closed. */
function indexHits(
  results: readonly SarSourceQueryResult[],
): Map<SarQualifiedId, SarSourceHit> {
  const map = new Map<SarQualifiedId, SarSourceHit>();
  for (const result of results) {
    for (const hit of [...result.hits, ...result.readOnlyContext]) {
      mergeHitIntoIndex(
        map as Map<string, SarSourceHit>,
        qualifySarId(hit.namespace, hit.id),
        hit,
        hit.namespace,
      );
    }
  }
  return map;
}

function edgeProvenanceFromRelation(
  seedHit: SarSourceHit,
  edgeSourceIdentity: string,
): SarProvenance {
  return {
    namespace: seedHit.namespace,
    authorityOwner: SAR_AUTHORITY_OWNERS[seedHit.namespace],
    sourceIdentity: edgeSourceIdentity,
    versionRef: seedHit.versionRef,
    releaseSetId: seedHit.releaseSetId,
    releaseId: seedHit.releaseId,
    overlayVersion: seedHit.overlayVersion,
  };
}

interface ExpansionState {
  nodes: Map<SarQualifiedId, SarCandidateNode>;
  edges: Map<string, SarCandidateEdge>;
  readOnly: Map<SarQualifiedId, SarCandidateNode>;
  traversedBindingIds: string[];
  skippedBindings: Array<{ bindingId: string; reason: SarTraversalSkipReason }>;
  skippedSameNamePairs: Array<{ left: string; right: string }>;
  perSourceCount: Map<SarSourceNamespace, number>;
  totalCount: number;
  limitations: string[];
}

interface FrontierItem {
  namespace: SarSourceNamespace;
  localId: string;
  key: SarQualifiedId;
}

function emptyExpansion(): ExpansionState {
  return {
    nodes: new Map(),
    edges: new Map(),
    readOnly: new Map(),
    traversedBindingIds: [],
    skippedBindings: [],
    skippedSameNamePairs: [],
    perSourceCount: new Map(
      SAR_SOURCE_NAMESPACES.map((ns) => [ns, 0] as const),
    ),
    totalCount: 0,
    limitations: [],
  };
}

function tryAddNode(
  state: ExpansionState,
  hit: SarSourceHit,
  budget: SarCompositionBudget,
  readOnly: boolean,
): boolean {
  const key = qualifySarId(hit.namespace, hit.id);
  if (state.nodes.has(key) || state.readOnly.has(key)) return true;

  const per = state.perSourceCount.get(hit.namespace) ?? 0;
  if (per >= budget.maxPerSourceCandidates) {
    state.limitations.push(`per-source-budget:${hit.namespace}`);
    return false;
  }
  if (state.totalCount >= budget.maxTotalCandidates) {
    state.limitations.push('total-budget');
    return false;
  }

  const node = nodeFromHit(hit, readOnly);
  if (node.readOnlyContext) {
    state.readOnly.set(key, node);
  } else {
    state.nodes.set(key, node);
  }
  state.perSourceCount.set(hit.namespace, per + 1);
  state.totalCount += 1;
  return true;
}

function addEdge(state: ExpansionState, edge: SarCandidateEdge): void {
  if (!state.edges.has(edge.id)) {
    state.edges.set(edge.id, edge);
  }
}

function bindingProvenance(
  binding: {
    id: string;
    fromNamespace: SarSourceNamespace;
    releaseSetId: string;
    releaseId: string;
    overlayVersion: string | null;
  },
): SarProvenance {
  const versionRef = binding.overlayVersion
    ?? `${binding.releaseSetId}/${binding.releaseId}`;
  return {
    namespace: binding.fromNamespace,
    authorityOwner: SAR_AUTHORITY_OWNERS[binding.fromNamespace],
    sourceIdentity: binding.id,
    versionRef,
    releaseSetId: binding.releaseSetId,
    releaseId: binding.releaseId,
    overlayVersion: binding.overlayVersion,
  };
}

async function expand(
  input: SarCompositionInput,
  budget: SarCompositionBudget,
  initialResults: SarSourceQueryResult[],
): Promise<{
  state: ExpansionState;
  sourceResults: SarSourceQueryResult[];
}> {
  const state = emptyExpansion();
  const hitIndex = indexHits(initialResults);
  const sourceResults = [...initialResults];

  for (const seed of input.seeds) {
    const key = qualifySarId(seed.namespace, seed.id);
    const hit = hitIndex.get(key);
    if (!hit) {
      state.limitations.push(`missing-seed:${seed.namespace}::${seed.id}`);
      continue;
    }
    // Namespace-specific seed must not resolve a foreign-namespace hit.
    if (hit.namespace !== seed.namespace) {
      state.limitations.push(
        `seed-namespace-collision:${seed.namespace}::${seed.id}`,
      );
      continue;
    }
    // Repository seeds must be in admitted scope before entering projection.
    if (
      seed.namespace === 'repository'
      && !input.scope.admittedCanonicalIds.includes(seed.id)
    ) {
      state.limitations.push(`outside-scope:repository::${seed.id}`);
      continue;
    }
    const readOnly = !isSarSupportedObjectType(hit.objectType);
    tryAddNode(state, hit, budget, readOnly);
  }

  let frontier: FrontierItem[] = input.seeds
    .map((s) => ({
      namespace: s.namespace,
      localId: s.id,
      key: qualifySarId(s.namespace, s.id),
    }))
    .filter((item) => state.nodes.has(item.key));

  for (let hop = 1; hop <= budget.maxHops; hop += 1) {
    if (frontier.length === 0) break;
    const nextFrontier: FrontierItem[] = [];
    const nextKeys = new Set<string>();

    const pushNext = (namespace: SarSourceNamespace, localId: string) => {
      const key = qualifySarId(namespace, localId);
      if (!state.nodes.has(key) || nextKeys.has(key)) return;
      nextKeys.add(key);
      nextFrontier.push({ namespace, localId, key });
    };

    for (const seedItem of frontier) {
      const seedNode = state.nodes.get(seedItem.key);
      if (!seedNode || !seedNode.supportedForTraversal) continue;

      const seedHit = hitIndex.get(seedItem.key);
      // In-source repository edges only (never cross namespaces by bare id).
      if (
        seedHit?.neighborEdges
        && seedHit.namespace === 'repository'
        && seedItem.namespace === 'repository'
      ) {
        for (const edge of seedHit.neighborEdges) {
          const resolved = resolveSarTraversalNeighbor({
            seedId: seedItem.localId,
            predicate: edge.predicate,
            fromId: edge.fromId,
            toId: edge.toId,
          });

          const fromQ = qualifySarId('repository', edge.fromId);
          const toQ = qualifySarId('repository', edge.toId);

          const edgeProv = edgeProvenanceFromRelation(
            seedHit,
            edge.sourceIdentity,
          );

          if (resolved.skipReason === 'unsupported-predicate') {
            addEdge(state, {
              kind: 'edge',
              id: `edge:repository:${edge.id}`,
              predicate: edge.predicate,
              fromId: fromQ,
              toId: toQ,
              hop,
              supportedForTraversal: false,
              provenance: edgeProv,
              skipReason: 'unsupported-predicate',
            });
            const otherLocal =
              edge.fromId === seedItem.localId ? edge.toId : edge.fromId;
            const neighborHit = hitIndex.get(
              qualifySarId('repository', otherLocal),
            );
            if (neighborHit && neighborHit.namespace === 'repository') {
              tryAddNode(state, neighborHit, budget, true);
            }
            continue;
          }

          if (!resolved.neighborId || resolved.skipReason) {
            addEdge(state, {
              kind: 'edge',
              id: `edge:repository:${edge.id}:${resolved.skipReason ?? 'skip'}`,
              predicate: edge.predicate,
              fromId: fromQ,
              toId: toQ,
              hop,
              supportedForTraversal: resolved.supported,
              provenance: edgeProv,
              skipReason: resolved.skipReason,
            });
            continue;
          }

          const neighborKey = qualifySarId('repository', resolved.neighborId);
          let neighborHit = hitIndex.get(neighborKey);
          if (!neighborHit) {
            const requery = await requerySource(
              input,
              'repository',
              [resolved.neighborId],
              budget.maxPerSourceCandidates,
            );
            sourceResults.push(requery);
            for (const h of [...requery.hits, ...requery.readOnlyContext]) {
              mergeHitIntoIndex(
                hitIndex as Map<string, SarSourceHit>,
                qualifySarId(h.namespace, h.id),
                h,
                h.namespace,
              );
            }
            neighborHit = hitIndex.get(neighborKey);
          }

          if (!neighborHit || neighborHit.namespace !== 'repository') {
            state.limitations.push(
              `missing-neighbor:repository::${resolved.neighborId}`,
            );
            continue;
          }

          if (
            !input.scope.admittedCanonicalIds.includes(resolved.neighborId)
            && !input.scope.admittedCanonicalIds.includes(neighborHit.id)
          ) {
            addEdge(state, {
              kind: 'edge',
              id: `edge:repository:${edge.id}:outside-scope`,
              predicate: edge.predicate,
              fromId: fromQ,
              toId: toQ,
              hop,
              supportedForTraversal: true,
              provenance: edgeProv,
              skipReason: 'outside-scope',
            });
            continue;
          }

          const readOnly = !isSarSupportedObjectType(neighborHit.objectType);
          const added = tryAddNode(state, neighborHit, budget, readOnly);
          addEdge(state, {
            kind: 'edge',
            id: `edge:repository:${edge.id}`,
            predicate: edge.predicate,
            fromId: fromQ,
            toId: toQ,
            hop,
            supportedForTraversal:
              !readOnly && isSarSupportedTraversalPredicate(edge.predicate),
            provenance: edgeProv,
            skipReason: readOnly
              ? 'unsupported-object-type'
              : added
                ? null
                : 'total-budget',
          });
          if (added && !readOnly && state.nodes.has(neighborKey)) {
            pushNext('repository', resolved.neighborId);
          }
        }
      }

      // Cross-namespace: match endpoints by namespace + local id only.
      for (const binding of input.bindings.bindings) {
        const evaluation = evaluateBindingForTraversal({
          binding,
          version: input.version,
          seed: {
            namespace: seedItem.namespace,
            localId: seedItem.localId,
          },
          admittedCanonicalIds: input.scope.admittedCanonicalIds,
          scope: input.scope,
        });

        // Only consider bindings that touch this seed endpoint.
        const touches =
          (binding.fromNamespace === seedItem.namespace
            && binding.fromIdentity === seedItem.localId)
          || (binding.toNamespace === seedItem.namespace
            && binding.toIdentity === seedItem.localId);
        if (!touches) continue;

        if (binding.sameNameAutoMatch !== false) {
          state.skippedSameNamePairs.push({
            left: `${binding.fromNamespace}::${binding.fromIdentity}`,
            right: `${binding.toNamespace}::${binding.toIdentity}`,
          });
          state.skippedBindings.push({
            bindingId: binding.id,
            reason: 'same-name-only',
          });
          continue;
        }

        if (!evaluation.allowed || !evaluation.neighbor) {
          state.skippedBindings.push({
            bindingId: binding.id,
            reason: evaluation.reason ?? 'missing-binding',
          });
          continue;
        }

        const neighbor = evaluation.neighbor;
        const neighborKey = qualifySarId(neighbor.namespace, neighbor.localId);
        let neighborHit = hitIndex.get(neighborKey);
        if (!neighborHit) {
          const requery = await requerySource(
            input,
            neighbor.namespace,
            [neighbor.localId],
            budget.maxPerSourceCandidates,
          );
          sourceResults.push(requery);
          for (const h of [...requery.hits, ...requery.readOnlyContext]) {
            mergeHitIntoIndex(
              hitIndex as Map<string, SarSourceHit>,
              qualifySarId(h.namespace, h.id),
              h,
              h.namespace,
            );
          }
          neighborHit = hitIndex.get(neighborKey);
        }

        if (!neighborHit || neighborHit.namespace !== neighbor.namespace) {
          state.skippedBindings.push({
            bindingId: binding.id,
            reason: 'missing-binding',
          });
          continue;
        }

        const readOnly = !isSarSupportedObjectType(neighborHit.objectType);
        const added = tryAddNode(state, neighborHit, budget, readOnly);
        if (
          !added
          && !state.nodes.has(neighborKey)
          && !state.readOnly.has(neighborKey)
        ) {
          state.skippedBindings.push({
            bindingId: binding.id,
            reason: 'total-budget',
          });
          continue;
        }

        state.traversedBindingIds.push(binding.id);
        addEdge(state, {
          kind: 'edge',
          id: `edge:binding:${binding.id}`,
          predicate: binding.predicate,
          fromId: qualifySarId(binding.fromNamespace, binding.fromIdentity),
          toId: qualifySarId(binding.toNamespace, binding.toIdentity),
          hop,
          supportedForTraversal: !readOnly,
          provenance: bindingProvenance(binding),
          skipReason: readOnly ? 'unsupported-object-type' : null,
        });

        if (!readOnly && state.nodes.has(neighborKey)) {
          pushNext(neighbor.namespace, neighbor.localId);
        }
      }
    }

    frontier = nextFrontier.sort((a, b) => a.key.localeCompare(b.key));
  }

  state.traversedBindingIds = [...new Set(state.traversedBindingIds)].sort();
  state.limitations = [...new Set(state.limitations)].sort();

  return { state, sourceResults };
}

function buildProjection(input: {
  state: ExpansionState;
  seeds: SarCompositionInput['seeds'];
  scope: SarCompositionInput['scope'];
  budget: SarCompositionBudget;
  version: SarCompositionInput['version'];
  cacheKey: string;
}): SarCandidateProjection {
  return {
    schemaVersion: CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
    consumerId: CANONICAL_SAR_CONSUMER_ID,
    projectionKind: 'request-candidate',
    writable: false,
    materializesMixedGraph: false,
    mutatesSources: false,
    version: input.version,
    seedIds: input.seeds
      .map((s) => qualifySarId(s.namespace, s.id))
      .sort(),
    scope: {
      ...input.scope,
      admittedCanonicalIds: [...input.scope.admittedCanonicalIds],
    },
    budget: input.budget,
    nodes: [...input.state.nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...input.state.edges.values()].sort((a, b) => a.id.localeCompare(b.id)),
    readOnlyContext: [...input.state.readOnly.values()].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
    limitations: input.state.limitations,
    cacheKey: input.cacheKey,
    reconstructable: true,
  };
}

function buildShadowEvidence(input: {
  consumer: SarCompositionInput['authorityConsumer'];
  authority: ReturnType<typeof selectSarAuthority>;
  projection: SarCandidateProjection;
  recordedAt: Date;
}): SarShadowEvidence {
  const iso = input.recordedAt.toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T/.test(iso)) {
    throw new Error(`Invalid shadow evidence recordedAt: ${iso}`);
  }
  return {
    schemaVersion: CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
    recordedAt: iso,
    consumer: input.consumer ?? 'SHADOW_COMPARISON',
    authority: input.authority,
    candidateNodeIds: input.projection.nodes.map((n) => n.id),
    candidateEdgeIds: input.projection.edges.map((e) => e.id),
    limitations: input.projection.limitations,
    cacheKey: input.projection.cacheKey,
    replacesProduction: false,
  };
}

function failClosedResult(input: {
  status: SarCompositionStatus;
  authority: ReturnType<typeof selectSarAuthority>;
  version: SarCompositionInput['version'];
  started: number;
  now?: () => number;
  latencyBudgetMs: number;
  cacheKey: string;
  sourceResults?: SarSourceQueryResult[];
}): SarCompositionResult {
  const latencyMs = elapsedMs(input.started, input.now);
  const diagnostics: SarCompositionDiagnostics = {
    schemaVersion: CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
    authority: input.authority,
    version: input.version,
    sourceResults: input.sourceResults ?? [],
    traversedBindingIds: [],
    skippedBindings: [],
    skippedSameNamePairs: [],
    latencyMs,
    withinLatencyBudget: latencyMs <= input.latencyBudgetMs,
    latencyBudgetMs: input.latencyBudgetMs,
    productionUsesCanonical: false,
    shadowSeparated: true,
    cacheKey: input.cacheKey,
    sourcesMutated: false,
  };
  return {
    status: input.status,
    authority: input.authority,
    projection: null,
    shadowEvidence: null,
    diagnostics,
  };
}

/**
 * Main entry: compose a request-scoped candidate projection over five sources.
 * Queries adapters in parallel (Promise.all) from the explicit seed set.
 *
 * Read-only: never writes through caller-owned adapters, bindings, seeds,
 * scope, version, or sourceMutationProbe references.
 */
export async function composeCanonicalSar(
  input: SarCompositionInput,
): Promise<SarCompositionResult> {
  const started = (input.now ?? (() => performance.now()))();
  const consumer = input.authorityConsumer ?? 'SHADOW_COMPARISON';
  const latencyBudgetMs =
    input.latencyBudgetMs ?? SAR_EXPANSION_DEFAULTS.latencyBudgetMs;
  const budget = resolveBudget(input.budget);

  // Snapshot probe value for diagnostics only — never write through it.
  const probeSnapshot = input.sourceMutationProbe
    ? input.sourceMutationProbe.mutated
    : null;

  let authority;
  try {
    authority = selectSarAuthority(consumer, {
      cutoverReceipt: input.cutoverReceipt,
    });
  } catch (error) {
    if (
      error instanceof SarCutoverActivationError
      && consumer === 'CUTOVER_ACTIVATION'
    ) {
      const legacy = selectSarAuthority('PRODUCTION_RETRIEVAL');
      return failClosedResult({
        status: 'cutover-fail-closed',
        authority: legacy,
        version: input.version,
        started,
        now: input.now,
        latencyBudgetMs,
        cacheKey: 'cutover-fail-closed',
      });
    }
    throw error;
  }

  if (consumer === 'PRODUCTION_RETRIEVAL') {
    assertProductionSelectorUnchanged({
      requestedConsumer: consumer,
      selected: authority,
      shadowSucceeded: false,
      projection: null,
    });
    return failClosedResult({
      status: 'legacy-only',
      authority,
      version: input.version,
      started,
      now: input.now,
      latencyBudgetMs,
      cacheKey: 'legacy-only',
    });
  }

  let version;
  try {
    version = assertCompleteSarVersionContext(input.version);
  } catch (error) {
    if (error instanceof SarVersionContextError) {
      const legacy = selectSarAuthority('PRODUCTION_RETRIEVAL');
      return failClosedResult({
        status: 'version-context-rejected',
        authority: legacy,
        version: input.version,
        started,
        now: input.now,
        latencyBudgetMs,
        cacheKey: `version:${error.code}`,
      });
    }
    throw error;
  }

  if (!canonicalCompositionEnabled(authority)) {
    throw new Error('Canonical composition requested but selector forbids it');
  }

  assertCompleteAdapterSet(input.adapters);

  let verifiedBindings;
  try {
    verifiedBindings = assertVerifiedSarBindingSet(input.bindings, version);
  } catch (error) {
    if (error instanceof SarBindingCapabilityError) {
      return failClosedResult({
        status: 'binding-set-rejected',
        authority: selectSarAuthority('PRODUCTION_RETRIEVAL'),
        version,
        started,
        now: input.now,
        latencyBudgetMs,
        cacheKey: `binding:${error.code}`,
      });
    }
    throw error;
  }

  // Use verified set for the rest of composition (fail closed on clones).
  const compositionInput: SarCompositionInput = {
    ...input,
    bindings: verifiedBindings,
  };

  const cacheKey = buildSarCompositionCacheKey({
    seeds: input.seeds,
    scope: input.scope,
    budget,
    version,
    adapters: input.adapters,
    bindings: verifiedBindings,
  });

  const seedIdsByNs = new Map<SarSourceNamespace, string[]>();
  for (const ns of SAR_SOURCE_NAMESPACES) {
    seedIdsByNs.set(ns, []);
  }
  for (const seed of input.seeds) {
    seedIdsByNs.get(seed.namespace)?.push(seed.id);
  }

  let initialResults: SarSourceQueryResult[];
  try {
    initialResults = await queryAllSources(compositionInput, budget, seedIdsByNs);
  } catch (error) {
    if (error instanceof SarAdapterResultError) {
      return failClosedResult({
        status: 'adapter-result-rejected',
        authority: selectSarAuthority('PRODUCTION_RETRIEVAL'),
        version,
        started,
        now: input.now,
        latencyBudgetMs,
        cacheKey: `adapter:${error.code}`,
      });
    }
    throw error;
  }

  let state: ExpansionState;
  let sourceResults: SarSourceQueryResult[];
  try {
    const expanded = await expand(compositionInput, budget, initialResults);
    state = expanded.state;
    sourceResults = expanded.sourceResults;
  } catch (error) {
    if (error instanceof SarAdapterResultError) {
      return failClosedResult({
        status: 'adapter-result-rejected',
        authority: selectSarAuthority('PRODUCTION_RETRIEVAL'),
        version,
        started,
        now: input.now,
        latencyBudgetMs,
        cacheKey: `adapter:${error.code}`,
      });
    }
    throw error;
  }

  const projection = buildProjection({
    state,
    seeds: input.seeds,
    scope: input.scope,
    budget,
    version,
    cacheKey,
  });

  Object.freeze(projection);
  Object.freeze(projection.nodes);
  Object.freeze(projection.edges);
  Object.freeze(projection.readOnlyContext);

  const wallClock = input.recordedAt ?? (() => new Date());
  const shadowEvidence = buildShadowEvidence({
    consumer,
    authority,
    projection,
    recordedAt: wallClock(),
  });

  // Prove we never wrote the probe: value must be unchanged from snapshot.
  if (
    input.sourceMutationProbe
    && probeSnapshot !== null
    && input.sourceMutationProbe.mutated !== probeSnapshot
  ) {
    throw new Error(
      'SAR composition wrote through sourceMutationProbe (invariant violation)',
    );
  }

  assertShadowCannotActivateSarCutover({
    shadowSucceeded: projection.nodes.length > 0,
    cutoverReceipt: input.cutoverReceipt ?? null,
    pipelineReady: true,
    projectionReady: true,
  });

  assertPipelineReadinessCannotReplaceProduction({
    pipelineReady: true,
    projectionReady: projection.nodes.length > 0,
    shadowSucceeded: true,
    cutoverReceipt: input.cutoverReceipt ?? null,
  });

  const latencyMs = elapsedMs(started, input.now);
  const diagnostics: SarCompositionDiagnostics = {
    schemaVersion: CANONICAL_SAR_COMPOSITION_SCHEMA_VERSION,
    authority,
    version,
    sourceResults,
    traversedBindingIds: state.traversedBindingIds,
    skippedBindings: state.skippedBindings,
    skippedSameNamePairs: state.skippedSameNamePairs,
    latencyMs,
    withinLatencyBudget: latencyMs <= latencyBudgetMs,
    latencyBudgetMs,
    productionUsesCanonical: false,
    shadowSeparated: true,
    cacheKey,
    sourcesMutated: false,
  };

  const status: SarCompositionStatus =
    projection.nodes.length === 0 && projection.readOnlyContext.length === 0
      ? 'empty'
      : 'composed';

  return {
    status,
    authority,
    projection,
    shadowEvidence,
    diagnostics,
  };
}
