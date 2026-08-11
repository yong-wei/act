/**
 * Read-time Legacy → Canonical crosswalk for historical LearningFacts (#1275).
 *
 * Historical facts remain Legacy-bound. Display Canonical/resource context is
 * resolved through an immutable old-ID crosswalk without mutating fact bytes
 * or performing historical backfill.
 */

import type { LegacyIdCrosswalkEntry } from '@/lib/teaching-projection/migration-contracts';

import type {
  HistoricalLearningFactDisplayContext,
  LearningFactServingIdentity,
} from './contracts';
import {
  projectLearningFactServingIdentity,
  type LearningFactServingRecord,
} from './serving';

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export interface LearningFactCrosswalkIndex {
  /** legacyId → active (non-stale preferred) crosswalk rows */
  byLegacyId: ReadonlyMap<string, readonly LegacyIdCrosswalkEntry[]>;
}

/**
 * Build an immutable lookup index from crosswalk entries.
 * Stale rows remain available for historical display but are sorted after
 * active rows.
 */
export function buildLearningFactCrosswalkIndex(
  entries: readonly LegacyIdCrosswalkEntry[],
): LearningFactCrosswalkIndex {
  const byLegacyId = new Map<string, LegacyIdCrosswalkEntry[]>();
  for (const entry of entries) {
    const legacyId = entry.legacyId?.trim();
    if (!legacyId) continue;
    const list = byLegacyId.get(legacyId) ?? [];
    list.push(entry);
    byLegacyId.set(legacyId, list);
  }
  for (const [legacyId, list] of byLegacyId) {
    byLegacyId.set(
      legacyId,
      [...list].sort((a, b) => {
        if (a.stale !== b.stale) return a.stale ? 1 : -1;
        return compareCodePoint(a.canonicalId, b.canonicalId);
      }),
    );
  }
  return { byLegacyId };
}

/**
 * Resolve display Canonical/resource context for one stored fact.
 * Never rewrites the original fact; never consults live path planner state.
 */
export function resolveHistoricalLearningFactDisplayContext(input: {
  fact: LearningFactServingRecord;
  crosswalk: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[];
  /** Optional precomputed serving identity; recomputed when omitted. */
  servingIdentity?: LearningFactServingIdentity;
}): HistoricalLearningFactDisplayContext {
  const serving =
    input.servingIdentity
    ?? projectLearningFactServingIdentity(input.fact);
  const index = asCrosswalkIndex(input.crosswalk);

  // Canonical facts already carry fixed identity — no crosswalk rewrite.
  if (serving.identityNamespace === 'CANONICAL') {
    return {
      factId: serving.factId,
      identityNamespace: 'CANONICAL',
      knowledgeRevisionRef: serving.knowledgeRevisionRef,
      legacyKnowledgeNodeIds: [],
      displayCanonicalIds: serving.canonicalObjectId
        ? [serving.canonicalObjectId]
        : [],
      displayResourceContext: [],
      originalFactUnchanged: true,
      crosswalkApplied: false,
      unresolvedLegacyIds: [],
    };
  }

  const legacyIds = serving.legacyKnowledgeNodeIds;
  const displayCanonicalIds = new Set<string>();
  const displayResourceContext: HistoricalLearningFactDisplayContext['displayResourceContext'][number][] =
    [];
  const unresolvedLegacyIds: string[] = [];

  for (const legacyId of legacyIds) {
    const rows = index.byLegacyId.get(legacyId) ?? [];
    if (rows.length === 0) {
      unresolvedLegacyIds.push(legacyId);
      continue;
    }
    for (const row of rows) {
      displayCanonicalIds.add(row.canonicalId);
      displayResourceContext.push({
        legacyId: row.legacyId,
        canonicalId: row.canonicalId,
        role: row.role ?? null,
        sourceEvidence: row.sourceEvidence ?? null,
        stale: row.stale === true,
      });
    }
  }

  return {
    factId: serving.factId,
    identityNamespace: serving.identityNamespace,
    knowledgeRevisionRef: serving.knowledgeRevisionRef,
    legacyKnowledgeNodeIds: legacyIds,
    displayCanonicalIds: [...displayCanonicalIds].sort(compareCodePoint),
    displayResourceContext: displayResourceContext
      .slice()
      .sort((a, b) =>
        compareCodePoint(
          `${a.legacyId}\u001f${a.canonicalId}`,
          `${b.legacyId}\u001f${b.canonicalId}`,
        ),
      ),
    originalFactUnchanged: true,
    crosswalkApplied: displayCanonicalIds.size > 0,
    unresolvedLegacyIds: [...unresolvedLegacyIds].sort(compareCodePoint),
  };
}

/**
 * Batch read-time resolution. Source facts are never mutated.
 */
function asCrosswalkIndex(
  crosswalk: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[],
): LearningFactCrosswalkIndex {
  return Array.isArray(crosswalk)
    ? buildLearningFactCrosswalkIndex(crosswalk)
    : (crosswalk as LearningFactCrosswalkIndex);
}

export function resolveHistoricalLearningFactDisplayContexts(input: {
  facts: readonly LearningFactServingRecord[];
  crosswalk: LearningFactCrosswalkIndex | readonly LegacyIdCrosswalkEntry[];
}): HistoricalLearningFactDisplayContext[] {
  const index = asCrosswalkIndex(input.crosswalk);
  return input.facts.map((fact) =>
    resolveHistoricalLearningFactDisplayContext({ fact, crosswalk: index }),
  );
}

/**
 * Guard: prove a display context did not rewrite fact identity columns.
 */
export function assertHistoricalFactBytesUnchanged(input: {
  before: LearningFactServingRecord;
  after: LearningFactServingRecord;
}): void {
  const keys: Array<keyof LearningFactServingRecord> = [
    'id',
    'knowledgeIdentityNamespace',
    'canonicalObjectId',
    'aggregateReleaseSetId',
    'aggregateReleaseId',
    'knowledgeProjectionId',
    'knowledgeRevisionRef',
    'contextJson',
  ];
  for (const key of keys) {
    const left = JSON.stringify(input.before[key] ?? null);
    const right = JSON.stringify(input.after[key] ?? null);
    if (left !== right) {
      throw new Error(
        `Historical LearningFact mutation detected on field ${String(key)}`,
      );
    }
  }
}
