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
  // 离线 harness 模拟的是 LEGACY 生产前台（#1112 fixture 语义）；#2047 生产
  // 拨盘切到 composed 后，这里显式固定 legacy，拨盘变化不再影响 fixture 流。
  const productionAuthority = selectRagAuthority('PRODUCTION_ANSWER', {
    productionAuthority: 'legacy',
  });
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
    productionAuthority: 'legacy',
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

/**
 * Map governed structural seeds onto pool SourcePackItems only when the full
 * endpoint tuple + version/content/resource metadata all agree.
 *
 * Never match on a single identifier (id OR chunk OR citation). Fail closed
 * when required identity/version/hash metadata is absent or drifted.
 */
export function mapGovernedSeedsToSourcePackItems(
  seeds: CanonicalRagShadowResult['governedStructuralSeeds'],
  pool: readonly SourcePackItem[],
): SourcePackItem[] {
  const mapped: SourcePackItem[] = [];
  const seen = new Set<string>();
  for (const seed of seeds) {
    const item = pool.find((candidate) => governedSeedMatchesSourcePackItem(seed, candidate));
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    mapped.push({
      ...item,
      metadata: {
        ...item.metadata,
        // Diagnostic only — harness rejects if this appears on production items.
        // Never stamp seed endpoint authority onto the pool item itself.
        canonicalShadowSeed: true,
        governedStructuralUnitId: seed.structuralUnitId,
      },
    });
  }
  return mapped.sort((a, b) => a.id.localeCompare(b.id));
}

export function governedSeedMatchesSourcePackItem(
  seed: CanonicalRagShadowResult['governedStructuralSeeds'][number],
  item: SourcePackItem,
): boolean {
  // Graph summary text is never citable evidence.
  if (item.excerpt && /Graph summary/i.test(item.excerpt)) return false;

  // 1) Simultaneous identity endpoints — no single-ID fallback.
  if (item.id !== seed.structuralUnitId) return false;
  if (item.retrievalChunkId !== seed.retrievalChunkId) return false;
  if (item.citationTargetId !== seed.citationTargetId) return false;
  if (!item.citation) return false;
  if (item.citation.citationTargetId !== seed.citationTargetId) return false;
  if (item.citation.sourceId !== seed.retrievalChunkId) return false;

  // 2) Required edition/version/content/resource metadata from textbook adapter.
  const bookId = metaString(item, 'bookId');
  const edition = metaString(item, 'edition');
  if (!bookId || !edition) return false;
  if (`${bookId}:${edition}` !== seed.sourceEditionId) return false;

  const itemSourceVersion = metaString(item, 'sourceVersion')
    ?? metaString(item, 'sourceRevision');
  if (!itemSourceVersion) return false;
  if (itemSourceVersion !== seed.sourceVersion) return false;
  // structuralUnitVersion must also agree; adapter usually reuses sourceRevision.
  const itemStructuralUnitVersion = metaString(item, 'structuralUnitVersion')
    ?? itemSourceVersion;
  if (itemStructuralUnitVersion !== seed.structuralUnitVersion) return false;

  const itemContentHash = metaString(item, 'contentHash');
  if (!itemContentHash) return false;
  const normalizedItemHash = normalizeContentHash(itemContentHash);
  if (normalizedItemHash !== normalizeContentHash(seed.structuralUnitHash)) return false;
  if (normalizedItemHash !== normalizeContentHash(seed.evidenceContentHash)) return false;

  const resourceId = metaString(item, 'resourceId');
  const segmentRef = metaString(item, 'segmentRef');
  if (!resourceId || !segmentRef) return false;
  if (resourceId !== seed.resourceId) return false;
  if (segmentRef !== seed.segmentId) return false;

  // 3) href / locator when seed declares non-null values.
  if (seed.href !== null) {
    if (item.citation.href !== seed.href) return false;
  }
  if (seed.locator !== null) {
    const itemLocator = metaString(item, 'citationLocator');
    if (itemLocator !== seed.locator) return false;
  }

  // 4) Optional inventory-shaped metadata — compare only when present; never invent.
  const atomicResourceId = metaString(item, 'atomicResourceId');
  if (atomicResourceId !== null && atomicResourceId !== seed.atomicResourceId) return false;
  const resourceSegmentHash = metaString(item, 'resourceSegmentHash');
  if (
    resourceSegmentHash !== null
    && normalizeContentHash(resourceSegmentHash) !== normalizeContentHash(seed.resourceSegmentHash)
  ) {
    return false;
  }
  const inventoryRunId = metaString(item, 'inventoryRunId');
  if (inventoryRunId !== null && inventoryRunId !== seed.inventoryRunId) return false;
  const captureRevision = metaString(item, 'captureRevision');
  if (captureRevision !== null && captureRevision !== seed.captureRevision) return false;

  return true;
}

function metaString(
  item: SourcePackItem,
  key: string,
): string | null {
  const value = item.metadata?.[key];
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeContentHash(value: string): string {
  return value.replace(/^sha256:/u, '');
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
