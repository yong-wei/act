/**
 * Konling Canonical RAG shadow diagnostic (#1112).
 *
 * Production textbook retrieval remains the sole user-facing answer path.
 * When an explicit shadow context is supplied, only the Canonical graph-seed
 * + Source Pack adjudication sidecar runs. Diagnostics compare the *actual*
 * production foreground identities with adjudicated shadow citations.
 *
 * The offline harness (`runLegacyProductionWithCanonicalShadow`) stays for
 * unit/fixture tests and must not drive the live Konling runtime path.
 */

import {
  retrieveSourcePack,
  type RetrieveSourcePackResult,
} from '@/lib/source-pack/hybrid-retriever';
import type { SourcePackCallerRole } from '@/lib/source-pack/retrieval-profiles';
import type { SourcePackItem } from '@/lib/source-pack/types';
import type { TextbookV2ToolResult } from '@/lib/source-pack/textbook-v2-adapter';

import {
  assertProductionSelectorUnchanged,
  productionAnswerUsesLegacy,
  selectRagAuthority,
} from './authority';
import {
  RAG_EXPANSION_DEFAULTS,
  type CanonicalRagShadowInput,
  type NumberedCitation,
} from './contracts';
import {
  mapGovernedSeedsToSourcePackItems,
} from './production-shadow-harness';
import { runCanonicalRagShadow, toRetrievalGraphNodeRefs } from './shadow-retrieval';

export interface KonlingCanonicalRagShadowContext {
  shadow: Omit<CanonicalRagShadowInput, 'authorityConsumer' | 'query' | 'legacyCandidateIds'> & {
    query?: string;
  };
  /**
   * Independent ACT Source Pack pool for Canonical seed mapping/adjudication.
   * Never treated as the production Legacy candidate pool.
   */
  shadowCandidatePool: readonly SourcePackItem[];
}

export interface KonlingCanonicalRagShadowDiagnostic {
  enabled: true;
  available: true;
  productionAuthority: 'LEGACY';
  productionUsesCanonical: false;
  shadowSeparated: true;
  graphStageEmittedNumberedCitations: false;
  shadowCitationsFromAdjudication: true;
  /** Structural unit IDs from the actual production TextbookV2 foreground. */
  productionStructuralUnitIds: string[];
  /** Citation keys from the actual production foreground (kind:unitId:fragment). */
  productionCitationKeys: string[];
  /** Structural unit IDs from adjudicated shadow Source Pack only. */
  shadowStructuralUnitIds: string[];
  /** Citation target IDs from adjudicated shadow Source Pack only. */
  shadowCitationIds: string[];
  sharedStructuralUnitIds: string[];
  onlyInProduction: string[];
  onlyInShadow: string[];
  governedSeedCount: number;
  adjudicatedItemCount: number;
  latencyMs: number;
  withinBudget: boolean;
}

export interface ProductionForegroundIdentity {
  structuralUnitIds: string[];
  citationKeys: string[];
}

/**
 * Extract stable production identities from the real TextbookV2 foreground.
 * These are the only production IDs allowed in the diagnostic comparison.
 */
export function extractProductionForegroundIdentities(
  foreground: TextbookV2ToolResult,
): ProductionForegroundIdentity {
  const structuralUnitIds = uniqueSorted(
    foreground.candidates.map((candidate) => candidate.identity.unitId),
  );
  const citationKeys = uniqueSorted(
    foreground.candidates.map((candidate) => [
      candidate.identity.kind,
      candidate.identity.unitId,
      candidate.identity.fragmentId ?? '',
    ].join(':')),
  );
  return { structuralUnitIds, citationKeys };
}

/**
 * Run Canonical graph seeds + Source Pack adjudication only, then compare
 * against the *actual* production foreground identities.
 *
 * Does not re-run production retrieval and never mutates the production result.
 */
export function runKonlingCanonicalRagShadowDiagnostic(input: {
  query: string;
  productionForeground: TextbookV2ToolResult;
  shadowContext: KonlingCanonicalRagShadowContext;
  role?: SourcePackCallerRole;
  retrieveShadow?: typeof retrieveSourcePack;
  now?: () => number;
  latencyBudgetMs?: number;
}): KonlingCanonicalRagShadowDiagnostic {
  const now = input.now ?? (() => performance.now());
  const started = now();
  const productionAuthority = selectRagAuthority('PRODUCTION_ANSWER');
  if (!productionAnswerUsesLegacy(productionAuthority)) {
    throw new Error('Konling shadow diagnostic requires LEGACY production authority');
  }

  const production = extractProductionForegroundIdentities(input.productionForeground);
  // Freeze production identity for leak detection (diagnostic must not mutate it).
  const productionSnapshot = JSON.stringify(production);

  const shadowSeeds = runCanonicalRagShadow({
    ...input.shadowContext.shadow,
    query: input.shadowContext.shadow.query ?? input.query,
    authorityConsumer: 'SHADOW_COMPARISON',
    // Comparison metadata only — never treated as the production candidate pool.
    legacyCandidateIds: production.structuralUnitIds,
  });

  // Version/cutover fail-closed seeds are not a comparable shadow result.
  // maybeRun* turns this into an omitted diagnostic without failing production.
  if (shadowSeeds.status !== 'shadow-seeds-recorded') {
    throw new Error(`Canonical shadow seed stage unavailable: ${shadowSeeds.status}`);
  }

  if (shadowSeeds.numberedCitations.length > 0) {
    throw new Error('Graph seed stage must not emit numbered citations');
  }

  const mapped = mapGovernedSeedsToSourcePackItems(
    shadowSeeds.governedStructuralSeeds,
    input.shadowContext.shadowCandidatePool,
  );

  const retrieveShadow = input.retrieveShadow ?? retrieveSourcePack;
  const shadowAdjudicated: RetrieveSourcePackResult | null = mapped.length > 0
    ? retrieveShadow({
        query: input.query,
        answerRelevanceQuery: input.query,
        profile: 'konling-answer',
        role: input.role ?? 'student',
        caller: 'konling-canonical-rag-shadow-adjudication',
        topK: 6,
        // Shadow-only ranking refs; never injected into production textbook retrieval.
        graphNodeRefs: toRetrievalGraphNodeRefs(shadowSeeds),
        candidates: mapped,
      })
    : null;

  const shadowCitations = citationsFromAdjudicatedPack(shadowAdjudicated);
  const shadowStructuralUnitIds = uniqueSorted(
    shadowCitations.map((row) => row.structuralUnitId),
  );
  const shadowCitationIds = uniqueSorted(
    shadowCitations.map((row) => row.citationTargetId),
  );

  const sharedStructuralUnitIds = production.structuralUnitIds.filter((id) => (
    shadowStructuralUnitIds.includes(id)
  ));
  const onlyInProduction = production.structuralUnitIds.filter((id) => (
    !shadowStructuralUnitIds.includes(id)
  ));
  const onlyInShadow = shadowStructuralUnitIds.filter((id) => (
    !production.structuralUnitIds.includes(id)
  ));

  // Production identity must be unchanged.
  if (JSON.stringify(extractProductionForegroundIdentities(input.productionForeground)) !== productionSnapshot) {
    throw new Error('Production foreground mutated during shadow diagnostic');
  }

  assertProductionSelectorUnchanged({
    requestedConsumer: 'PRODUCTION_ANSWER',
    selected: productionAuthority,
    shadowSucceeded: shadowCitations.length > 0,
  });

  const totalMs = Math.max(0, Math.round((now() - started) * 1000) / 1000);
  const budgetMs = input.latencyBudgetMs ?? RAG_EXPANSION_DEFAULTS.harnessLatencyBudgetMs;

  return {
    enabled: true,
    available: true,
    productionAuthority: 'LEGACY',
    productionUsesCanonical: false,
    shadowSeparated: true,
    graphStageEmittedNumberedCitations: false,
    shadowCitationsFromAdjudication: true,
    productionStructuralUnitIds: production.structuralUnitIds,
    productionCitationKeys: production.citationKeys,
    shadowStructuralUnitIds,
    shadowCitationIds,
    sharedStructuralUnitIds,
    onlyInProduction,
    onlyInShadow,
    governedSeedCount: shadowSeeds.governedStructuralSeeds.length,
    adjudicatedItemCount: shadowAdjudicated?.pack.items.length ?? 0,
    latencyMs: totalMs,
    withinBudget: totalMs <= budgetMs,
  };
}

/**
 * Safe wrapper for Konling runtime: broken shadow never fails production.
 * Returns null when shadow context is absent or the sidecar throws.
 */
export function maybeRunKonlingCanonicalRagShadowDiagnostic(input: {
  query: string;
  productionForeground: TextbookV2ToolResult;
  shadowContext?: KonlingCanonicalRagShadowContext | null;
  role?: SourcePackCallerRole;
  retrieveShadow?: typeof retrieveSourcePack;
}): KonlingCanonicalRagShadowDiagnostic | null {
  if (!input.shadowContext) return null;
  try {
    return runKonlingCanonicalRagShadowDiagnostic({
      query: input.query,
      productionForeground: input.productionForeground,
      shadowContext: input.shadowContext,
      role: input.role,
      retrieveShadow: input.retrieveShadow,
    });
  } catch {
    return null;
  }
}

function citationsFromAdjudicatedPack(
  result: RetrieveSourcePackResult | null,
): NumberedCitation[] {
  if (!result) return [];
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

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
