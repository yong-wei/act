/**
 * Engineering RAG vs Teaching Resource RAG domain composition (#1274).
 *
 * Domains stay separately governed. Composition is query-time only, records
 * dual provenance, and never writes ACT teaching edges into ActKG or mixes
 * Authority/Projection versions. Production selectors follow per-consumer
 * activation (#1276) when a consumer-activation pointer is present.
 */

import type {
  LayeredGraphPayload,
  TeachingResourceBindingView,
} from '@/lib/layered-graph/contracts';
import type {
  TeachingCardIndexEntry,
  TeachingResourceType,
} from '@/lib/teaching-projection/contracts';
import {
  overlayLiveTeachingPins,
  readAgreedLiveCourseProjection,
} from '@/lib/teaching-projection/live-course-pointer';
import {
  projectionPinsFromSelection,
  resolveEngineeringRagProductionSelection,
  resolveTeachingResourceRagProductionSelection,
  type ConsumerProductionSelection,
} from '@/lib/versioned-knowledge-activation';

export const RAG_DOMAIN_COMPOSITION_CONTRACT =
  'act-rag-domain-composition/v1' as const;

export const RAG_DOMAIN_KINDS = [
  'engineering',
  'teaching-resource',
  'learner-evidence',
] as const;

export type RagDomainKind = (typeof RAG_DOMAIN_KINDS)[number];

export type RagDomainAvailability =
  | 'ready'
  | 'pinned'
  | 'shadow'
  | 'fallback'
  | 'unavailable'
  | 'identity-drift'
  | 'unauthorized';

export type RagQueryMode =
  | 'engineering-only'
  | 'teaching-only'
  | 'composed'
  | 'learner-evidence';

export interface EngineeringRagQueryInput {
  domain: 'engineering';
  query: string;
  authorityReleaseId: string | null;
  /** Exact engineering relation predicates allowed under Authority. */
  allowedPredicates?: readonly string[] | null;
  canonicalIds?: readonly string[] | null;
  /** Shadow/pinned mode; never mutates production selector. */
  mode?: 'shadow' | 'pinned' | 'production';
}

export interface TeachingResourceRagQueryInput {
  domain: 'teaching-resource';
  query: string;
  projectionId: string | null;
  projectionHash?: string | null;
  authorityReleaseId?: string | null;
  scopeId: string | null;
  canonicalIds?: readonly string[] | null;
  resourceTypes?: readonly TeachingResourceType[] | null;
  /** Shadow/pinned mode; independent of Engineering Authority freshness. */
  mode?: 'shadow' | 'pinned' | 'production';
  includeOptionalCards?: boolean;
}

export interface ComposedRagQueryInput {
  domain: 'composed';
  query: string;
  engineering: EngineeringRagQueryInput;
  teaching: TeachingResourceRagQueryInput;
  /**
   * When true (default), fail closed per domain independently rather than
   * aborting the whole answer.
   */
  independentDomainFailClosed?: boolean;
}

export interface RagCitationProvenance {
  domain: RagDomainKind;
  authorityReleaseId: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  scopeId: string | null;
  canonicalId: string | null;
  resourceId: string | null;
  resourceType: TeachingResourceType | string | null;
  citationTargetId: string | null;
  /** Engineering predicate or ACT teaching role — never cross-forged. */
  relationKind: 'engineering-predicate' | 'teaching-resource' | 'teaching-prerequisite' | 'optional-card' | 'learner-evidence' | null;
  relationId: string | null;
  sourceLabel: string | null;
}

export interface EngineeringRagHit {
  domain: 'engineering';
  canonicalId: string;
  label: string | null;
  predicate: string | null;
  relationId: string | null;
  authorityReleaseId: string | null;
  citation: RagCitationProvenance;
}

export interface TeachingResourceRagHit {
  domain: 'teaching-resource';
  resourceId: string;
  resourceType: TeachingResourceType | null;
  canonicalId: string | null;
  title: string | null;
  role: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  authorityReleaseId: string | null;
  scopeId: string | null;
  cardId: string | null;
  optionalCardAbsent: boolean;
  citation: RagCitationProvenance;
}

export interface RagDomainResultMetadata {
  domain: RagDomainKind;
  availability: RagDomainAvailability;
  authorityReleaseId: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  scopeId: string | null;
  mode: 'shadow' | 'pinned' | 'production';
  hitCount: number;
  reasons: string[];
  /** True when this domain did not write or inherit edges from another domain. */
  domainIsolated: true;
  /** Production selector was not mutated by this query. */
  productionSelectorUnchanged: true;
}

export interface EngineeringRagResult {
  domain: 'engineering';
  metadata: RagDomainResultMetadata;
  hits: EngineeringRagHit[];
}

export interface TeachingResourceRagResult {
  domain: 'teaching-resource';
  metadata: RagDomainResultMetadata;
  hits: TeachingResourceRagHit[];
  optionalCardStatus: 'active' | 'absent' | 'inactive' | 'not-applicable';
}

export interface ComposedRagResult {
  domain: 'composed';
  contract: typeof RAG_DOMAIN_COMPOSITION_CONTRACT;
  query: string;
  engineering: EngineeringRagResult;
  teaching: TeachingResourceRagResult;
  /** Dual-domain citations retained through answer assembly. */
  citations: RagCitationProvenance[];
  /** No teaching edge was persisted to ActKG. */
  actkgWriteback: false;
  /** No silent inheritance of the other domain's edges. */
  crossDomainEdgeForged: false;
}

export interface EngineeringRagCorpusSeed {
  canonicalId: string;
  label: string | null;
  predicates: readonly string[];
  relationIds: readonly string[];
  authorityReleaseId: string | null;
}

export interface TeachingResourceRagCorpusSeed {
  resources: readonly {
    resourceId: string;
    resourceType: TeachingResourceType | null;
    title: string | null;
    scopeId: string;
    canonicalIds: readonly string[];
    roles: readonly string[];
  }[];
  bindings: readonly TeachingResourceBindingView[];
  cards: readonly TeachingCardIndexEntry[];
  projectionId: string | null;
  projectionHash: string | null;
  authorityReleaseId: string | null;
  scopeId: string | null;
  status: 'ready' | 'fallback' | 'pinned' | 'absent' | 'unavailable' | 'identity-drift';
}

function queryMatches(query: string, terms: readonly (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return terms.some((term) => term && term.toLowerCase().includes(q));
}

function unavailableEngineering(
  input: EngineeringRagQueryInput,
  reasons: string[],
  availability: RagDomainAvailability = 'unavailable',
): EngineeringRagResult {
  return {
    domain: 'engineering',
    metadata: {
      domain: 'engineering',
      availability,
      authorityReleaseId: input.authorityReleaseId,
      projectionId: null,
      projectionHash: null,
      scopeId: null,
      mode: input.mode ?? 'shadow',
      hitCount: 0,
      reasons,
      domainIsolated: true,
      productionSelectorUnchanged: true,
    },
    hits: [],
  };
}

function unavailableTeaching(
  input: TeachingResourceRagQueryInput,
  reasons: string[],
  availability: RagDomainAvailability = 'unavailable',
): TeachingResourceRagResult {
  return {
    domain: 'teaching-resource',
    metadata: {
      domain: 'teaching-resource',
      availability,
      authorityReleaseId: input.authorityReleaseId ?? null,
      projectionId: input.projectionId,
      projectionHash: input.projectionHash ?? null,
      scopeId: input.scopeId,
      mode: input.mode ?? 'shadow',
      hitCount: 0,
      reasons,
      domainIsolated: true,
      productionSelectorUnchanged: true,
    },
    hits: [],
    optionalCardStatus: 'not-applicable',
  };
}

/**
 * Apply engineering-rag consumer activation to a query identity.
 * Replacing consumer-activation current.json changes the Authority combination
 * used for production engineering RAG reads.
 */
export function applyEngineeringRagConsumerActivation(
  query: EngineeringRagQueryInput,
  options: {
    repoRoot?: string;
    activationSelection?: ConsumerProductionSelection;
  } = {},
): EngineeringRagQueryInput & {
  activationMode: ConsumerProductionSelection['mode'];
  activationBlocked?: boolean;
  activationReasons?: string[];
} {
  const selection =
    options.activationSelection
    ?? resolveEngineeringRagProductionSelection({ repoRoot: options.repoRoot });
  const pins = projectionPinsFromSelection(selection);
  if (selection.mode === 'absent') {
    return { ...query, activationMode: selection.mode };
  }
  if (selection.mode === 'unavailable') {
    return {
      ...query,
      ...(pins.authorityReleaseId ? { authorityReleaseId: pins.authorityReleaseId } : {}),
      activationMode: selection.mode,
      activationReasons: selection.reasons,
    };
  }
  // Activation selection forces the consumer combination (caller cannot keep
  // a different production release when pin/use is active).
  const authorityReleaseId = pins.authorityReleaseId ?? null;
  const mode =
    selection.mode === 'pin-combination'
      ? (query.mode === 'shadow' ? 'shadow' : 'pinned')
      : (query.mode ?? 'production');
  return {
    ...query,
    authorityReleaseId,
    mode,
    activationMode: selection.mode,
  };
}

/**
 * Apply teaching-resource-rag consumer activation to a query identity.
 */
export function applyTeachingResourceRagConsumerActivation(
  query: TeachingResourceRagQueryInput,
  options: {
    repoRoot?: string;
    activationSelection?: ConsumerProductionSelection;
  } = {},
): TeachingResourceRagQueryInput & {
  activationMode: ConsumerProductionSelection['mode'];
  activationBlocked?: boolean;
  activationReasons?: string[];
} {
  const selection =
    options.activationSelection
    ?? resolveTeachingResourceRagProductionSelection({
      repoRoot: options.repoRoot,
    });
  const pins = overlayLiveTeachingPins(
    projectionPinsFromSelection(selection),
    readAgreedLiveCourseProjection(options.repoRoot),
  );
  if (selection.mode === 'absent') {
    return { ...query, activationMode: selection.mode };
  }
  if (selection.mode === 'unavailable') {
    return {
      ...query,
      ...(pins.projectionId ? { projectionId: pins.projectionId, projectionHash: pins.projectionHash } : {}),
      ...(pins.authorityReleaseId ? { authorityReleaseId: pins.authorityReleaseId } : {}),
      activationMode: selection.mode,
      activationReasons: selection.reasons,
    };
  }
  return {
    ...query,
    projectionId: pins.projectionId ?? null,
    projectionHash: pins.projectionHash ?? null,
    authorityReleaseId: pins.authorityReleaseId ?? null,
    mode:
      selection.mode === 'pin-combination'
        ? (query.mode === 'shadow' ? 'shadow' : 'pinned')
        : (query.mode ?? 'production'),
    activationMode: selection.mode,
  };
}

/**
 * Engineering-only RAG: ActKG nodes, exact engineering relations, public
 * provenance under Authority. Does not require Teaching Projection.
 */
export function runEngineeringRagQuery(input: {
  query: EngineeringRagQueryInput;
  corpus: readonly EngineeringRagCorpusSeed[] | null | undefined;
  /** Optional repo root for consumer-activation resolution (#1276). */
  repoRoot?: string;
  activationSelection?: ConsumerProductionSelection;
}): EngineeringRagResult {
  const query = applyEngineeringRagConsumerActivation(input.query, {
    repoRoot: input.repoRoot,
    activationSelection: input.activationSelection,
  });
  const { corpus } = input;
  if (query.activationBlocked) {
    return unavailableEngineering(query, [
      'consumer-activation-unavailable',
      ...(query.activationReasons ?? []),
    ]);
  }
  if (!query.authorityReleaseId) {
    return unavailableEngineering(query, ['engineering-authority-missing']);
  }
  if (!corpus || corpus.length === 0) {
    return unavailableEngineering(query, ['engineering-corpus-empty']);
  }

  // Reject mixed Authority seeds.
  const drifted = corpus.some(
    (seed) =>
      seed.authorityReleaseId
      && seed.authorityReleaseId !== query.authorityReleaseId,
  );
  if (drifted) {
    return unavailableEngineering(
      query,
      ['engineering-authority-identity-drift'],
      'identity-drift',
    );
  }

  const allowed = query.allowedPredicates
    ? new Set(query.allowedPredicates)
    : null;
  const focus = query.canonicalIds ? new Set(query.canonicalIds) : null;

  const hits: EngineeringRagHit[] = [];
  for (const seed of corpus) {
    if (focus && !focus.has(seed.canonicalId)) continue;
    if (
      !queryMatches(query.query, [
        seed.canonicalId,
        seed.label,
        ...seed.predicates,
      ])
    ) {
      continue;
    }

    // Keep predicate and relationId paired by index; never attach a filtered
    // predicate to an unrelated original relationIds[0].
    const pairedRelations = seed.predicates.map((predicate, index) => ({
      predicate,
      relationId: seed.relationIds[index] ?? null,
    })).filter((pair) => !allowed || allowed.has(pair.predicate));
    if (pairedRelations.length === 0 && seed.predicates.length > 0 && allowed) {
      continue;
    }

    const selected = pairedRelations[0] ?? null;
    const predicate = selected?.predicate ?? null;
    const relationId = selected?.relationId ?? null;
    hits.push({
      domain: 'engineering',
      canonicalId: seed.canonicalId,
      label: seed.label,
      predicate,
      relationId,
      authorityReleaseId: seed.authorityReleaseId ?? query.authorityReleaseId,
      citation: {
        domain: 'engineering',
        authorityReleaseId: seed.authorityReleaseId ?? query.authorityReleaseId,
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        canonicalId: seed.canonicalId,
        resourceId: null,
        resourceType: null,
        citationTargetId: relationId
          ? `eng-rel:${relationId}`
          : `eng-node:${seed.canonicalId}`,
        relationKind: predicate ? 'engineering-predicate' : null,
        relationId,
        sourceLabel: seed.label,
      },
    });
  }

  const mode = query.mode ?? 'shadow';
  return {
    domain: 'engineering',
    metadata: {
      domain: 'engineering',
      availability: mode === 'pinned' ? 'pinned' : mode === 'production' ? 'ready' : 'shadow',
      authorityReleaseId: query.authorityReleaseId,
      projectionId: null,
      projectionHash: null,
      scopeId: null,
      mode,
      hitCount: hits.length,
      reasons:
        hits.length > 0
          ? ['engineering-rag-hits']
          : ['engineering-rag-no-match'],
      domainIsolated: true,
      productionSelectorUnchanged: true,
    },
    hits,
  };
}

/**
 * Teaching Resource RAG: projected course/handout/step/textbook/card under
 * Teaching Projection only. Optional card absence is reported, not node-missing.
 */
export function runTeachingResourceRagQuery(input: {
  query: TeachingResourceRagQueryInput;
  corpus: TeachingResourceRagCorpusSeed | null | undefined;
  /** Optional repo root for consumer-activation resolution (#1276). */
  repoRoot?: string;
  activationSelection?: ConsumerProductionSelection;
}): TeachingResourceRagResult {
  const query = applyTeachingResourceRagConsumerActivation(input.query, {
    repoRoot: input.repoRoot,
    activationSelection: input.activationSelection,
  });
  const { corpus } = input;
  if (query.activationBlocked) {
    return unavailableTeaching(query, [
      'consumer-activation-unavailable',
      ...(query.activationReasons ?? []),
    ]);
  }
  if (!corpus) {
    return unavailableTeaching(query, ['teaching-corpus-missing']);
  }
  if (corpus.status === 'identity-drift') {
    return unavailableTeaching(
      query,
      ['teaching-projection-identity-drift', ...[]],
      'identity-drift',
    );
  }
  if (corpus.status === 'absent' || corpus.status === 'unavailable') {
    return unavailableTeaching(query, [
      `teaching-projection-${corpus.status}`,
    ]);
  }
  if (!query.projectionId && !corpus.projectionId) {
    return unavailableTeaching(query, ['teaching-projection-id-missing']);
  }

  // Reject non-empty identity mismatches before any hits. Never relabel
  // corpus evidence under a different Authority / Projection / scope.
  if (
    query.projectionId
    && corpus.projectionId
    && query.projectionId !== corpus.projectionId
  ) {
    return unavailableTeaching(
      query,
      [
        `teaching-projection-drift:query=${query.projectionId}:corpus=${corpus.projectionId}`,
      ],
      'identity-drift',
    );
  }
  if (
    query.projectionHash
    && corpus.projectionHash
    && query.projectionHash !== corpus.projectionHash
  ) {
    return unavailableTeaching(
      query,
      ['teaching-projection-hash-drift'],
      'identity-drift',
    );
  }
  if (
    query.authorityReleaseId
    && corpus.authorityReleaseId
    && query.authorityReleaseId !== corpus.authorityReleaseId
  ) {
    return unavailableTeaching(
      query,
      [
        `teaching-authority-drift:query=${query.authorityReleaseId}:corpus=${corpus.authorityReleaseId}`,
      ],
      'identity-drift',
    );
  }
  if (
    query.scopeId
    && corpus.scopeId
    && query.scopeId !== corpus.scopeId
  ) {
    return unavailableTeaching(
      query,
      [
        `teaching-scope-drift:query=${query.scopeId}:corpus=${corpus.scopeId}`,
      ],
      'identity-drift',
    );
  }

  // Prefer corpus identities for provenance of actual hits (validated above).
  const projectionId = corpus.projectionId ?? query.projectionId;
  const projectionHash = corpus.projectionHash ?? query.projectionHash;
  const authorityReleaseId =
    corpus.authorityReleaseId ?? query.authorityReleaseId;
  const scopeId = corpus.scopeId ?? query.scopeId;
  const focus = query.canonicalIds ? new Set(query.canonicalIds) : null;
  const typeFilter = query.resourceTypes
    ? new Set(query.resourceTypes)
    : null;
  const resourceScopeById = new Map(
    corpus.resources.map((resource) => [resource.resourceId, resource.scopeId]),
  );

  const hits: TeachingResourceRagHit[] = [];
  let optionalCardStatus: TeachingResourceRagResult['optionalCardStatus'] =
    'not-applicable';

  for (const resource of corpus.resources) {
    if (scopeId && resource.scopeId !== scopeId) continue;
    if (typeFilter && resource.resourceType && !typeFilter.has(resource.resourceType)) {
      continue;
    }
    if (focus && !resource.canonicalIds.some((id) => focus.has(id))) continue;
    if (
      !queryMatches(query.query, [
        resource.resourceId,
        resource.title,
        ...resource.canonicalIds,
        ...resource.roles,
      ])
    ) {
      continue;
    }

    const primaryCanonical =
      resource.canonicalIds.find((id) => !focus || focus.has(id))
      ?? resource.canonicalIds[0]
      ?? null;
    const role = resource.roles[0] ?? null;

    hits.push({
      domain: 'teaching-resource',
      resourceId: resource.resourceId,
      resourceType: resource.resourceType,
      canonicalId: primaryCanonical,
      title: resource.title,
      role,
      projectionId,
      projectionHash: projectionHash ?? null,
      authorityReleaseId: authorityReleaseId ?? null,
      scopeId: resource.scopeId,
      cardId: null,
      optionalCardAbsent: false,
      citation: {
        domain: 'teaching-resource',
        authorityReleaseId: authorityReleaseId ?? null,
        projectionId,
        projectionHash: projectionHash ?? null,
        scopeId: resource.scopeId,
        canonicalId: primaryCanonical,
        resourceId: resource.resourceId,
        resourceType: resource.resourceType,
        citationTargetId: `teach-res:${resource.resourceId}`,
        relationKind: 'teaching-resource',
        relationId: role,
        sourceLabel: resource.title,
      },
    });
  }

  if (query.includeOptionalCards !== false && focus) {
    const scopedCards = corpus.cards.filter((card) => {
      if (!focus.has(card.canonicalId)) return false;
      if (!scopeId) return true;
      const resourceScope = resourceScopeById.get(card.resourceId);
      // Cards whose resource is out of scope, or has no resolvable scope while
      // the query is scoped, are excluded from teaching evidence.
      if (!resourceScope) return false;
      return resourceScope === scopeId;
    });
    if (scopedCards.length === 0 && focus.size > 0) {
      optionalCardStatus = 'absent';
      // Card absence is reported without hiding other resources.
    } else if (scopedCards.some((card) => card.active)) {
      optionalCardStatus = 'active';
      for (const card of scopedCards.filter((c) => c.active)) {
        if (
          !queryMatches(query.query, [
            card.cardId,
            card.title,
            card.canonicalId,
            card.resourceId,
          ])
        ) {
          continue;
        }
        hits.push({
          domain: 'teaching-resource',
          resourceId: card.resourceId,
          resourceType: 'card',
          canonicalId: card.canonicalId,
          title: card.title,
          role: 'EXPLAINS',
          projectionId,
          projectionHash: projectionHash ?? null,
          authorityReleaseId: authorityReleaseId ?? null,
          scopeId: scopeId,
          cardId: card.cardId,
          optionalCardAbsent: false,
          citation: {
            domain: 'teaching-resource',
            authorityReleaseId: authorityReleaseId ?? null,
            projectionId,
            projectionHash: projectionHash ?? null,
            scopeId,
            canonicalId: card.canonicalId,
            resourceId: card.resourceId,
            resourceType: 'card',
            citationTargetId: `teach-card:${card.cardId}`,
            relationKind: 'optional-card',
            relationId: card.cardId,
            sourceLabel: card.title,
          },
        });
      }
    } else if (scopedCards.length > 0) {
      optionalCardStatus = 'inactive';
    }
  }

  const mode = query.mode ?? 'shadow';
  let availability: RagDomainAvailability =
    mode === 'pinned' ? 'pinned' : mode === 'production' ? 'ready' : 'shadow';
  if (corpus.status === 'fallback') availability = 'fallback';

  return {
    domain: 'teaching-resource',
    metadata: {
      domain: 'teaching-resource',
      availability,
      authorityReleaseId: authorityReleaseId ?? null,
      projectionId,
      projectionHash: projectionHash ?? null,
      scopeId,
      mode,
      hitCount: hits.length,
      reasons:
        hits.length > 0
          ? optionalCardStatus === 'absent'
            ? ['teaching-rag-hits', 'optional-card-absent']
            : ['teaching-rag-hits']
          : optionalCardStatus === 'absent'
            ? ['teaching-rag-no-match', 'optional-card-absent']
            : ['teaching-rag-no-match'],
      domainIsolated: true,
      productionSelectorUnchanged: true,
    },
    hits,
    optionalCardStatus,
  };
}

/**
 * Explicit query-time composition. Records both domain identities; never
 * forges cross-domain edges or mutates production selectors.
 */
export function composeEngineeringAndTeachingRag(
  input: ComposedRagQueryInput & {
    engineeringCorpus: readonly EngineeringRagCorpusSeed[] | null | undefined;
    teachingCorpus: TeachingResourceRagCorpusSeed | null | undefined;
  },
): ComposedRagResult {
  const engineering = runEngineeringRagQuery({
    query: input.engineering,
    corpus: input.engineeringCorpus,
  });
  const teaching = runTeachingResourceRagQuery({
    query: input.teaching,
    corpus: input.teachingCorpus,
  });

  const citations: RagCitationProvenance[] = [
    ...engineering.hits.map((hit) => hit.citation),
    ...teaching.hits.map((hit) => hit.citation),
  ];

  return {
    domain: 'composed',
    contract: RAG_DOMAIN_COMPOSITION_CONTRACT,
    query: input.query,
    engineering,
    teaching,
    citations,
    actkgWriteback: false,
    crossDomainEdgeForged: false,
  };
}

/**
 * Build Engineering corpus seeds from a layered graph payload (shadow use).
 */
export function engineeringCorpusFromLayeredPayload(
  payload: LayeredGraphPayload | null | undefined,
): EngineeringRagCorpusSeed[] {
  if (!payload || payload.engineering.identity.status !== 'ready') return [];
  const releaseId = payload.engineering.identity.authorityReleaseId;
  const relationsByNode = new Map<string, { predicates: string[]; relationIds: string[] }>();

  for (const relation of payload.engineering.relations) {
    for (const nodeId of [relation.sourceId, relation.targetId]) {
      const entry = relationsByNode.get(nodeId) ?? {
        predicates: [],
        relationIds: [],
      };
      entry.predicates.push(relation.relationType);
      entry.relationIds.push(relation.relationId);
      relationsByNode.set(nodeId, entry);
    }
  }

  return payload.engineering.nodes.map((node) => {
    const related = relationsByNode.get(node.canonicalId);
    return {
      canonicalId: node.canonicalId,
      label: node.semanticName ?? node.canonicalId,
      predicates: related?.predicates ?? [],
      relationIds: related?.relationIds ?? [],
      authorityReleaseId: releaseId,
    };
  });
}

/**
 * Build Teaching Resource corpus from a layered graph payload (shadow use).
 */
export function teachingCorpusFromLayeredPayload(
  payload: LayeredGraphPayload | null | undefined,
): TeachingResourceRagCorpusSeed | null {
  if (!payload) return null;
  const identity = payload.teachingResources.identity;
  const status =
    identity.status === 'ready'
      ? 'ready'
      : identity.status === 'fallback'
        ? 'fallback'
        : identity.status === 'identity-drift'
          ? 'identity-drift'
          : identity.status === 'absent' || identity.status === 'NOT_PROJECTED'
            ? 'absent'
            : 'unavailable';

  const bindingsByResource = new Map<string, TeachingResourceBindingView[]>();
  for (const binding of payload.teachingResources.bindings) {
    const list = bindingsByResource.get(binding.resourceId) ?? [];
    list.push(binding);
    bindingsByResource.set(binding.resourceId, list);
  }

  return {
    resources: payload.teachingResources.resources.map((resource) => {
      const bindings = bindingsByResource.get(resource.resourceId) ?? [];
      return {
        resourceId: resource.resourceId,
        resourceType: resource.resourceType,
        title: resource.title,
        scopeId: resource.scopeId,
        canonicalIds: bindings.map((b) => b.canonicalId),
        roles: bindings.map((b) => b.role),
      };
    }),
    bindings: payload.teachingResources.bindings,
    cards: payload.teachingResources.cards,
    projectionId: identity.projectionId,
    projectionHash: identity.projectionHash,
    authorityReleaseId: identity.authorityReleaseId,
    scopeId: identity.scopeId,
    status,
  };
}

/**
 * Textbook-locator citation seed under Teaching Resource domain only.
 */
export function teachingTextbookLocatorCitation(input: {
  resourceId: string;
  canonicalId: string | null;
  projectionId: string | null;
  projectionHash: string | null;
  authorityReleaseId: string | null;
  scopeId: string | null;
  locator: string | null;
  title: string | null;
}): RagCitationProvenance {
  return {
    domain: 'teaching-resource',
    authorityReleaseId: input.authorityReleaseId,
    projectionId: input.projectionId,
    projectionHash: input.projectionHash,
    scopeId: input.scopeId,
    canonicalId: input.canonicalId,
    resourceId: input.resourceId,
    resourceType: 'textbook-section',
    citationTargetId: input.locator
      ? `teach-textbook:${input.resourceId}:${input.locator}`
      : `teach-textbook:${input.resourceId}`,
    relationKind: 'teaching-resource',
    relationId: null,
    sourceLabel: input.title,
  };
}

/**
 * Guard: Teaching Resource RAG may stay pinned while Engineering advances.
 */
export function assertIndependentDomainPinning(input: {
  engineeringAuthorityReleaseId: string | null;
  teachingPinnedProjectionId: string | null;
  teachingActiveProjectionId: string | null;
  teachingActivationReady: boolean;
}): {
  engineeringMayUseNewerAuthority: true;
  teachingRemainsPinned: boolean;
  productionSelectorUnchanged: true;
} {
  const teachingRemainsPinned =
    !input.teachingActivationReady
    && Boolean(input.teachingPinnedProjectionId)
    && input.teachingPinnedProjectionId !== input.teachingActiveProjectionId;

  return {
    engineeringMayUseNewerAuthority: true,
    teachingRemainsPinned:
      teachingRemainsPinned || !input.teachingActivationReady,
    productionSelectorUnchanged: true,
  };
}
