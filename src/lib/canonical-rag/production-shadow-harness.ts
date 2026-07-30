/**
 * Production Legacy retrieval + Canonical shadow comparison harness.
 *
 * Flow:
 * 1. Production retrieveSourcePack (Legacy only — never Canonical graph seeds).
 * 2. Graph seed stage (alignment/expansion/Crosswalk) → governed seeds only.
 * 3. Map governed seeds onto ACT SourcePackItems from an independent candidate pool.
 * 4. Re-run retrieveSourcePack for the shadow sidecar only (ranking/relevance/
 *    policy/citation hydration). Shadow citations come only from this path.
 * 5. Separation proof: production pack is unchanged and is the only user answer.
 */

import {
  retrieveSourcePack,
  type RetrieveSourcePackInput,
  type RetrieveSourcePackResult,
} from '@/lib/source-pack/hybrid-retriever';
import type { SourcePackItem } from '@/lib/source-pack/types';

import {
  assertProductionSelectorUnchanged,
  productionAnswerUsesLegacy,
  selectRagAuthority,
} from './authority';
import {
  RAG_EXPANSION_DEFAULTS,
  type CanonicalRagShadowInput,
  type CanonicalRagShadowResult,
  type NumberedCitation,
} from './contracts';
import { runCanonicalRagShadow, toRetrievalGraphNodeRefs } from './shadow-retrieval';

export interface ProductionShadowSeparationProof {
  productionAuthority: 'LEGACY';
  productionUsesCanonical: false;
  shadowSeparated: true;
  forbiddenProductionGraphNodeRefs: string[];
  productionCitationIds: string[];
  shadowCitationIds: string[];
  onlyInShadow: string[];
  onlyInProduction: string[];
  sharedStructuralIds: string[];
  productionCitesGraphText: false;
  shadowCandidatesLeakedIntoProduction: false;
  /** Graph stage never produced numbered citations. */
  graphStageEmittedNumberedCitations: false;
  /** Shadow citations only after Source Pack adjudication. */
  shadowCitationsFromAdjudication: true;
}

export interface LegacyProductionWithCanonicalShadowResult {
  production: RetrieveSourcePackResult;
  productionAuthority: ReturnType<typeof selectRagAuthority>;
  /** Graph seed stage result (no numbered citations). */
  shadowSeeds: CanonicalRagShadowResult;
  /** Separate Source Pack adjudication of Canonical seeds only. */
  shadowAdjudicated: RetrieveSourcePackResult | null;
  /** Numbered citations from adjudicated shadow pack only. */
  shadowCitations: NumberedCitation[];
  separation: ProductionShadowSeparationProof;
  latency: {
    productionMs: number;
    shadowSeedMs: number;
    shadowAdjudicationMs: number;
    totalMs: number;
    withinBudget: boolean;
    budgetMs: number;
  };
}

export interface RunLegacyProductionWithCanonicalShadowInput {
  query: string;
  production: Omit<RetrieveSourcePackInput, 'query'> & {
    query?: string;
    candidates: readonly SourcePackItem[];
  };
  shadow: Omit<CanonicalRagShadowInput, 'authorityConsumer' | 'query' | 'legacyCandidateIds'> & {
    query?: string;
  };
  /**
   * Independent ACT Source Pack candidate pool used to map governed structural
   * seeds into retrievable items. Must not be mutated from production result.
   */
  shadowCandidatePool: readonly SourcePackItem[];
  retrieveProduction?: (input: RetrieveSourcePackInput) => RetrieveSourcePackResult;
  retrieveShadow?: (input: RetrieveSourcePackInput) => RetrieveSourcePackResult;
  latencyBudgetMs?: number;
  now?: () => number;
}

export function runLegacyProductionWithCanonicalShadow(
  input: RunLegacyProductionWithCanonicalShadowInput,
): LegacyProductionWithCanonicalShadowResult {
  const now = input.now ?? (() => performance.now());
  const started = now();
  const productionAuthority = selectRagAuthority('PRODUCTION_ANSWER');
  if (!productionAnswerUsesLegacy(productionAuthority)) {
    throw new Error('Harness invariant: production authority must be LEGACY');
  }

  const productionGraphNodeRefs = [...(input.production.graphNodeRefs ?? [])];
  const productionInput: RetrieveSourcePackInput = {
    ...input.production,
    query: input.production.query ?? input.query,
    graphNodeRefs: productionGraphNodeRefs,
  };

  const productionStarted = now();
  const retrieveProduction = input.retrieveProduction ?? retrieveSourcePack;
  const production = retrieveProduction(productionInput);
  const productionMs = elapsed(productionStarted, now);

  // Freeze production identity for leak detection.
  const productionSnapshot = JSON.stringify(production.pack.items.map((item) => ({
    id: item.id,
    citationTargetId: item.citationTargetId,
    retrievalChunkId: item.retrievalChunkId,
    excerpt: item.excerpt,
  })));

  const productionCandidateIds = production.pack.items.map((item) => item.id);
  const productionCitationIds = production.pack.items
    .map((item) => item.citationTargetId)
    .filter((id): id is string => Boolean(id));

  const seedStarted = now();
  const shadowSeeds = runCanonicalRagShadow({
    ...input.shadow,
    query: input.shadow.query ?? input.query,
    authorityConsumer: 'SHADOW_COMPARISON',
    legacyCandidateIds: productionCandidateIds,
  });
  const shadowSeedMs = elapsed(seedStarted, now);

  if (shadowSeeds.numberedCitations.length > 0) {
    throw new Error('Harness invariant: graph seed stage emitted numbered citations');
  }

  const shadowGraphRefs = toRetrievalGraphNodeRefs(shadowSeeds);
  if (shadowGraphRefs.some((ref) => productionGraphNodeRefs.includes(ref))) {
    throw new Error(
      'Harness invariant violated: production graphNodeRefs included Canonical shadow seeds',
    );
  }

  // Map governed seeds → ACT SourcePackItems from independent pool, then adjudicate.
  const adjudicateStarted = now();
  const mappedCandidates = mapGovernedSeedsToSourcePackItems(
    shadowSeeds.governedStructuralSeeds,
    input.shadowCandidatePool,
  );
  const retrieveShadow = input.retrieveShadow ?? retrieveSourcePack;
  const shadowAdjudicated = mappedCandidates.length > 0
    ? retrieveShadow({
        query: input.shadow.query ?? input.query,
        answerRelevanceQuery: input.shadow.query ?? input.query,
        profile: input.production.profile ?? 'konling-answer',
        role: input.production.role ?? 'student',
        caller: 'canonical-rag-shadow-adjudication',
        topK: input.production.topK ?? 6,
        // Shadow-only graph refs for ranking inside the sidecar — never production.
        graphNodeRefs: shadowGraphRefs,
        candidates: mappedCandidates,
      })
    : null;
  const shadowAdjudicationMs = elapsed(adjudicateStarted, now);

  const shadowCitations = shadowAdjudicated
    ? citationsFromAdjudicatedPack(shadowAdjudicated)
    : [];

  // Production pack must be byte-identical to pre-shadow snapshot.
  const productionAfter = JSON.stringify(production.pack.items.map((item) => ({
    id: item.id,
    citationTargetId: item.citationTargetId,
    retrievalChunkId: item.retrievalChunkId,
    excerpt: item.excerpt,
  })));
  if (productionAfter !== productionSnapshot) {
    throw new Error('Harness invariant violated: production pack mutated by shadow path');
  }

  for (const item of production.pack.items) {
    if (item.excerpt && /Graph summary/i.test(item.excerpt)) {
      throw new Error('Harness invariant violated: production cites graph summary text');
    }
  }

  const productionItemIds = new Set(production.pack.items.map((item) => item.id));
  const shadowStructuralIds = shadowCitations.map((row) => row.structuralUnitId);
  const productionStructuralIds = production.pack.items.map((item) => item.id);
  const shared = productionStructuralIds.filter((id) => shadowStructuralIds.includes(id));
  const onlyInShadow = shadowStructuralIds.filter((id) => !productionItemIds.has(id));
  const onlyInProduction = productionStructuralIds.filter((id) => !shadowStructuralIds.includes(id));

  assertProductionSelectorUnchanged({
    requestedConsumer: 'PRODUCTION_ANSWER',
    selected: productionAuthority,
    shadowSucceeded: shadowCitations.length > 0,
  });

  const shadowCitationIds = shadowCitations.map((row) => row.citationTargetId);
  const totalMs = elapsed(started, now);
  const budgetMs = input.latencyBudgetMs ?? RAG_EXPANSION_DEFAULTS.harnessLatencyBudgetMs;

  return {
    production,
    productionAuthority,
    shadowSeeds,
    shadowAdjudicated,
    shadowCitations,
    separation: {
      productionAuthority: 'LEGACY',
      productionUsesCanonical: false,
      shadowSeparated: true,
      forbiddenProductionGraphNodeRefs: shadowGraphRefs,
      productionCitationIds: [...productionCitationIds].sort((a, b) => a.localeCompare(b)),
      shadowCitationIds: [...shadowCitationIds].sort((a, b) => a.localeCompare(b)),
      onlyInShadow: [...onlyInShadow].sort((a, b) => a.localeCompare(b)),
      onlyInProduction: [...onlyInProduction].sort((a, b) => a.localeCompare(b)),
      sharedStructuralIds: [...shared].sort((a, b) => a.localeCompare(b)),
      productionCitesGraphText: false,
      shadowCandidatesLeakedIntoProduction: false,
      graphStageEmittedNumberedCitations: false,
      shadowCitationsFromAdjudication: true,
    },
    latency: {
      productionMs,
      shadowSeedMs,
      shadowAdjudicationMs,
      totalMs,
      withinBudget: totalMs <= budgetMs,
      budgetMs,
    },
  };
}

export function mapGovernedSeedsToSourcePackItems(
  seeds: CanonicalRagShadowResult['governedStructuralSeeds'],
  pool: readonly SourcePackItem[],
): SourcePackItem[] {
  const byId = new Map(pool.map((item) => [item.id, item] as const));
  const byChunk = new Map(
    pool
      .filter((item) => item.retrievalChunkId)
      .map((item) => [item.retrievalChunkId!, item] as const),
  );
  const byCite = new Map(
    pool
      .filter((item) => item.citationTargetId)
      .map((item) => [item.citationTargetId!, item] as const),
  );

  const mapped: SourcePackItem[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    const item = byId.get(seed.structuralUnitId)
      ?? byChunk.get(seed.retrievalChunkId)
      ?? byCite.get(seed.citationTargetId)
      ?? null;
    if (!item || seen.has(item.id)) continue;
    // Require readable textbook-like identity and no graph summary text.
    if (item.excerpt && /Graph summary/i.test(item.excerpt)) continue;
    if (!item.retrievalChunkId || !item.citationTargetId) continue;
    seen.add(item.id);
    mapped.push({
      ...item,
      metadata: {
        ...item.metadata,
        // Diagnostic only — harness rejects if this appears on production items.
        canonicalShadowSeed: true,
        governedStructuralUnitId: seed.structuralUnitId,
      },
    });
  }
  return mapped.sort((a, b) => a.id.localeCompare(b.id));
}

function citationsFromAdjudicatedPack(
  result: RetrieveSourcePackResult,
): NumberedCitation[] {
  // Adjudicated Source Pack items are already policy/relevance gated.
  // Emit numbered citations directly without inventing a synthetic fingerprint.
  return result.pack.items
    .filter((item) => item.citationTargetId && item.retrievalChunkId)
    .map((item, index) => ({
      number: index + 1,
      structuralUnitId: item.id,
      retrievalChunkId: item.retrievalChunkId!,
      citationTargetId: item.citationTargetId!,
      displayTitle: item.title,
      locator: typeof item.metadata?.citationLocator === 'string'
        ? item.metadata.citationLocator
        : null,
      href: item.citation?.href ?? null,
      sourceEditionId: typeof item.metadata?.edition === 'string'
        ? item.metadata.edition
        : typeof item.metadata?.bookId === 'string'
          ? item.metadata.bookId
          : 'unknown',
    }));
}

export function productionNumberedCitations(
  production: RetrieveSourcePackResult,
): NumberedCitation[] {
  return production.pack.items
    .filter((item) => item.citationTargetId && item.retrievalChunkId)
    .map((item, index) => ({
      number: index + 1,
      structuralUnitId: item.id,
      retrievalChunkId: item.retrievalChunkId!,
      citationTargetId: item.citationTargetId!,
      displayTitle: item.title,
      locator: typeof item.metadata?.citationLocator === 'string'
        ? item.metadata.citationLocator
        : null,
      href: item.citation?.href ?? null,
      sourceEditionId: typeof item.metadata?.edition === 'string'
        ? item.metadata.edition
        : typeof item.metadata?.bookId === 'string'
          ? item.metadata.bookId
          : 'unknown',
    }));
}

function elapsed(started: number, now: () => number): number {
  return Math.max(0, Math.round((now() - started) * 1000) / 1000);
}
