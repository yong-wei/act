import {
  assertProductionSelectorUnchanged,
  assertShadowCannotActivateCutover,
  canonicalExpansionEnabled,
  RagCutoverActivationError,
  selectRagAuthority,
} from './authority';
import {
  CANONICAL_RAG_SCHEMA_VERSION,
  RAG_EXPANSION_DEFAULTS,
  type ActStructuralCitationTarget,
  type CanonicalRagShadowDiagnostics,
  type CanonicalRagShadowInput,
  type CanonicalRagShadowResult,
  type FinalEvidenceCandidate,
  type UpstreamRagReferenceSeed,
} from './contracts';
import {
  evaluateFinalEvidenceCandidate,
  rejectGraphOwnedEvidence,
} from './citation-ownership';
import { resolveUpstreamSeeds } from './crosswalk-resolution';
import { alignCanonicalEntities } from './entity-alignment';
import { expandCanonicalRelations } from './relation-expansion';
import {
  assertVersionClosedShadowInput,
  CanonicalRagVersionContextError,
} from './version-context';

/**
 * Canonical graph seed stage.
 *
 * Emits candidate identities and governed structural seeds only.
 * NEVER emits final/numbered citations — those require Source Pack
 * retrieval, ranking, relevance gating, and citation hydration.
 */
export function runCanonicalRagShadow(
  input: CanonicalRagShadowInput,
): CanonicalRagShadowResult {
  const started = (input.now ?? (() => performance.now()))();
  const consumer = input.authorityConsumer ?? 'SHADOW_COMPARISON';
  const latencyBudgetMs = input.latencyBudgetMs ?? RAG_EXPANSION_DEFAULTS.latencyBudgetMs;

  let authority;
  try {
    authority = selectRagAuthority(consumer, {
      cutoverReceipt: input.cutoverReceipt,
    });
  } catch (error) {
    if (error instanceof RagCutoverActivationError && consumer === 'CUTOVER_ACTIVATION') {
      const legacy = selectRagAuthority('PRODUCTION_ANSWER');
      return failClosedResult({
        status: 'cutover-fail-closed',
        authority: legacy,
        release: input.release,
        started,
        now: input.now,
        latencyBudgetMs,
        legacyCandidateIds: input.legacyCandidateIds ?? [],
        rejectedId: `cutover:${error.code}`,
      });
    }
    throw error;
  }

  if (consumer === 'PRODUCTION_ANSWER') {
    assertProductionSelectorUnchanged({
      requestedConsumer: consumer,
      selected: authority,
      shadowSucceeded: false,
    });
    return failClosedResult({
      status: 'legacy-only',
      authority,
      release: input.release,
      started,
      now: input.now,
      latencyBudgetMs,
      legacyCandidateIds: input.legacyCandidateIds ?? [],
    });
  }

  let release;
  try {
    release = assertVersionClosedShadowInput(input);
  } catch (error) {
    if (error instanceof CanonicalRagVersionContextError) {
      const legacy = selectRagAuthority('PRODUCTION_ANSWER');
      return failClosedResult({
        status: 'version-context-rejected',
        authority: legacy,
        release: input.release,
        started,
        now: input.now,
        latencyBudgetMs,
        legacyCandidateIds: input.legacyCandidateIds ?? [],
        rejectedId: `version:${error.code}`,
      });
    }
    throw error;
  }

  if (!canonicalExpansionEnabled(authority)) {
    throw new Error('Canonical expansion requested but selector forbids it');
  }

  const alignmentHits = alignCanonicalEntities({
    query: input.query,
    objects: input.objects,
    coverage: input.coverage,
    release,
    limit: input.maxSeeds ?? RAG_EXPANSION_DEFAULTS.maxSeeds,
  });

  const expansion = expandCanonicalRelations({
    seedCanonicalIds: alignmentHits.map((hit) => hit.canonicalId),
    relations: input.relations,
    objects: input.objects,
    coverage: input.coverage,
    maxHops: input.maxHops ?? RAG_EXPANSION_DEFAULTS.maxHops,
    maxExpandedObjects: input.maxExpandedObjects ?? RAG_EXPANSION_DEFAULTS.maxExpandedObjects,
  });

  const candidateCanonicalIds = [
    ...expansion.seedCanonicalIds,
    ...expansion.expandedCanonicalIds,
  ].sort((a, b) => a.localeCompare(b));

  const upstreamSeeds = collectUpstreamSeeds(
    candidateCanonicalIds,
    input.upstreamByCanonicalId,
    RAG_EXPANSION_DEFAULTS.maxUpstreamSeedsPerObject,
  );

  const crosswalkOutcomes = resolveUpstreamSeeds({
    seeds: upstreamSeeds,
    crosswalks: input.crosswalks,
    structuralUnits: input.structuralUnits,
    release,
  });

  const governedStructuralSeeds = uniqueStructuralTargets(
    crosswalkOutcomes
      .map((outcome) => outcome.structuralTarget)
      .filter((target): target is ActStructuralCitationTarget => Boolean(target)),
  );

  // Graph-stage seeds are never final citations without adjudication.
  const ungatedSeeds: FinalEvidenceCandidate[] = governedStructuralSeeds.map((seed) => ({
    kind: 'ungated-crosswalk-seed',
    id: `ungated-seed:${seed.structuralUnitId}`,
    citable: false,
    structuralTarget: seed,
  }));

  const rejectedEvidence = [
    ...buildRejectedEvidence({
      objects: input.objects,
      candidateCanonicalIds,
      crosswalkOutcomes,
      relations: input.relations,
    }),
    ...ungatedSeeds,
  ];

  for (const candidate of rejectedEvidence) {
    if (evaluateFinalEvidenceCandidate(candidate).accepted) {
      throw new Error(`Invariant: rejected evidence accepted (${candidate.id})`);
    }
  }

  const latencyMs = elapsedMs(started, input.now);
  const legacyCandidateIds = [...(input.legacyCandidateIds ?? [])].sort((a, b) => a.localeCompare(b));
  const comparison = buildComparison(
    legacyCandidateIds,
    governedStructuralSeeds.map((row) => row.structuralUnitId),
  );

  const diagnostics: CanonicalRagShadowDiagnostics = {
    schemaVersion: CANONICAL_RAG_SCHEMA_VERSION,
    authority,
    release,
    entityAlignmentHits: alignmentHits,
    expansion,
    crosswalkOutcomes,
    rejectedEvidence,
    numberedCitations: [],
    latencyMs,
    withinLatencyBudget: latencyMs <= latencyBudgetMs,
    latencyBudgetMs,
    productionUsesCanonical: false,
    shadowSeparated: true,
    comparison,
  };

  assertShadowCannotActivateCutover({
    shadowSucceeded: governedStructuralSeeds.length > 0 || candidateCanonicalIds.length > 0,
    cutoverReceipt: input.cutoverReceipt ?? null,
  });

  return {
    status: 'shadow-seeds-recorded',
    authority,
    candidateCanonicalIds,
    governedStructuralSeeds,
    numberedCitations: [],
    diagnostics,
  };
}

export function toRetrievalGraphNodeRefs(
  result: CanonicalRagShadowResult,
  options: { max?: number } = {},
): string[] {
  if (!result.authority.canonicalExpansionVisible) return [];
  if (result.status !== 'shadow-seeds-recorded') return [];
  const max = Math.min(Math.max(options.max ?? 8, 1), 16);
  return result.candidateCanonicalIds.slice(0, max);
}

function collectUpstreamSeeds(
  canonicalIds: readonly string[],
  upstreamByCanonicalId: ReadonlyMap<string, readonly UpstreamRagReferenceSeed[]>,
  maxPerObject: number,
): UpstreamRagReferenceSeed[] {
  const seeds: UpstreamRagReferenceSeed[] = [];
  for (const canonicalId of canonicalIds) {
    const rows = upstreamByCanonicalId.get(canonicalId) ?? [];
    for (const row of rows.slice(0, maxPerObject)) {
      seeds.push({
        publishedEntityId: row.publishedEntityId,
        retrievalChunkId: row.retrievalChunkId,
        citationTargetId: row.citationTargetId,
        canonicalId: row.canonicalId ?? canonicalId,
        context: row.context,
      });
    }
  }
  return seeds;
}

function uniqueStructuralTargets(
  targets: readonly ActStructuralCitationTarget[],
): ActStructuralCitationTarget[] {
  const byKey = new Map<string, ActStructuralCitationTarget>();
  for (const target of targets) {
    const key = [
      target.structuralUnitId,
      target.structuralUnitVersion,
      target.structuralUnitHash,
      target.retrievalChunkId,
      target.citationTargetId,
    ].join('\u001f');
    if (!byKey.has(key)) byKey.set(key, target);
  }
  return [...byKey.values()].sort((a, b) => (
    a.structuralUnitId.localeCompare(b.structuralUnitId)
    || a.citationTargetId.localeCompare(b.citationTargetId)
  ));
}

function buildRejectedEvidence(input: {
  objects: CanonicalRagShadowInput['objects'];
  candidateCanonicalIds: readonly string[];
  crosswalkOutcomes: CanonicalRagShadowResult['diagnostics']['crosswalkOutcomes'];
  relations: CanonicalRagShadowInput['relations'];
}): FinalEvidenceCandidate[] {
  const objectById = new Map(input.objects.map((row) => [row.canonicalId, row]));
  const summaries = input.candidateCanonicalIds.flatMap((id) => {
    const object = objectById.get(id);
    if (!object?.summary) return [];
    return [{ canonicalId: id, summary: object.summary }];
  });
  const unresolvedUpstream = input.crosswalkOutcomes
    .filter((outcome) => outcome.status !== 'resolved')
    .map((outcome) => outcome.upstream);
  const relationIds = input.relations
    .filter((relation) => (
      input.candidateCanonicalIds.includes(relation.sourceId)
      || input.candidateCanonicalIds.includes(relation.targetId)
    ))
    .map((relation) => ({ relationId: relation.relationId }));

  return rejectGraphOwnedEvidence({
    summaries,
    relations: relationIds,
    unresolvedUpstream,
  });
}

function buildComparison(
  legacyCandidateIds: readonly string[],
  canonicalCandidateIds: readonly string[],
): CanonicalRagShadowDiagnostics['comparison'] {
  const legacy = new Set(legacyCandidateIds);
  const canonical = new Set(canonicalCandidateIds);
  const shared = [...legacy].filter((id) => canonical.has(id)).sort((a, b) => a.localeCompare(b));
  const onlyInLegacy = [...legacy].filter((id) => !canonical.has(id)).sort((a, b) => a.localeCompare(b));
  const onlyInCanonical = [...canonical].filter((id) => !legacy.has(id)).sort((a, b) => a.localeCompare(b));
  return {
    legacyCandidateIds: [...legacy].sort((a, b) => a.localeCompare(b)),
    canonicalCandidateIds: [...canonical].sort((a, b) => a.localeCompare(b)),
    onlyInLegacy,
    onlyInCanonical,
    shared,
  };
}

function failClosedResult(input: {
  status: CanonicalRagShadowResult['status'];
  authority: CanonicalRagShadowResult['authority'];
  release: CanonicalRagShadowInput['release'];
  started: number;
  now?: () => number;
  latencyBudgetMs: number;
  legacyCandidateIds: readonly string[];
  rejectedId?: string;
}): CanonicalRagShadowResult {
  const latencyMs = elapsedMs(input.started, input.now);
  return {
    status: input.status,
    authority: input.authority,
    candidateCanonicalIds: [],
    governedStructuralSeeds: [],
    numberedCitations: [],
    diagnostics: {
      schemaVersion: CANONICAL_RAG_SCHEMA_VERSION,
      authority: input.authority,
      release: input.release,
      entityAlignmentHits: [],
      expansion: {
        seedCanonicalIds: [],
        expandedCanonicalIds: [],
        steps: [],
        skippedUnsupportedPredicates: [],
        skippedWrongDirection: 0,
        truncated: false,
      },
      crosswalkOutcomes: [],
      rejectedEvidence: input.rejectedId
        ? [{ kind: 'legacy-fallback', id: input.rejectedId, citable: false }]
        : [],
      numberedCitations: [],
      latencyMs,
      withinLatencyBudget: latencyMs <= input.latencyBudgetMs,
      latencyBudgetMs: input.latencyBudgetMs,
      productionUsesCanonical: false,
      shadowSeparated: true,
      comparison: buildComparison(input.legacyCandidateIds, []),
    },
  };
}

function elapsedMs(started: number, now?: () => number): number {
  const end = (now ?? (() => performance.now()))();
  return Math.max(0, Math.round((end - started) * 1000) / 1000);
}
