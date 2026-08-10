/**
 * Card authoring policy (#1271).
 *
 * Migrated cards require exactly one Canonical ID. New authoring rejects
 * legacy graph IDs in Canonical fields while preserving legacy audit/crosswalk.
 */

import {
  isLegacyLocalGraphNodeId,
  LegacyGraphIdAuthoringError,
} from '../legacy-id-policy';
import type { TeachingCardAuthoring } from '../contracts';
import type {
  CardCrosswalkEntry,
  CanonicalCardIndexEntry,
  KnowledgeCardInventoryEntry,
} from './contracts';

export class CardAuthoringPolicyError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CardAuthoringPolicyError';
    this.code = code;
  }
}

export interface MigratedCardAuthoring {
  cardId: string;
  /** Exactly one Canonical ID is required. */
  canonicalId: string;
  status: 'ACTIVE' | 'INACTIVE' | 'DRAFT';
  title?: string | null;
  contentVersion?: number | null;
  projectionScope?: string | null;
  sourceHash?: string | null;
  legacyAliases?: string[];
  sourcePath?: string | null;
  required?: boolean;
}

/**
 * Validate a migrated card authoring record.
 * Requires exactly one Canonical ID and rejects legacy IDs in that field.
 */
export function assertMigratedCardAuthoring(
  card: MigratedCardAuthoring,
): asserts card is MigratedCardAuthoring {
  if (!card.cardId?.trim()) {
    throw new CardAuthoringPolicyError('schema-invalid', 'cardId is required');
  }
  if (!card.canonicalId?.trim()) {
    throw new CardAuthoringPolicyError(
      'schema-invalid',
      `card ${card.cardId} requires exactly one canonicalId`,
    );
  }
  if (isLegacyLocalGraphNodeId(card.canonicalId)) {
    throw new LegacyGraphIdAuthoringError([card.canonicalId]);
  }
  if (card.canonicalId.includes(' ') || card.canonicalId.includes(',')) {
    throw new CardAuthoringPolicyError(
      'schema-invalid',
      `card ${card.cardId} must carry exactly one canonicalId (no lists)`,
    );
  }
  for (const alias of card.legacyAliases ?? []) {
    // Aliases may be legacy IDs — that is intentional and read-only.
    if (!alias?.trim()) {
      throw new CardAuthoringPolicyError(
        'schema-invalid',
        `card ${card.cardId} has empty legacy alias`,
      );
    }
  }
}

/**
 * Reject new TeachingCardAuthoring rows that place legacy graph IDs into
 * the Canonical field.
 */
export function assertNoLegacyGraphIdsInCards(
  cards: readonly TeachingCardAuthoring[],
): void {
  const found = new Set<string>();
  for (const card of cards) {
    if (isLegacyLocalGraphNodeId(card.canonicalId)) {
      found.add(card.canonicalId);
    }
  }
  if (found.size > 0) {
    throw new LegacyGraphIdAuthoringError([...found].sort());
  }
}

/**
 * Convert a migrated authoring record to Teaching Projection card authoring.
 */
export function toTeachingCardAuthoring(
  card: MigratedCardAuthoring,
): TeachingCardAuthoring {
  assertMigratedCardAuthoring(card);
  return {
    cardId: card.cardId,
    canonicalId: card.canonicalId,
    active: card.status === 'ACTIVE',
    required: card.required === true,
    sourcePath: card.sourcePath ?? undefined,
    title: card.title ?? undefined,
  };
}

/**
 * Apply Canonical ID onto inventory entry for schema migration (in-memory).
 * Does not write files; used by builders and tests.
 */
export function applyCanonicalIdToInventoryEntry(
  entry: KnowledgeCardInventoryEntry,
  canonicalId: string,
): KnowledgeCardInventoryEntry {
  if (isLegacyLocalGraphNodeId(canonicalId)) {
    throw new LegacyGraphIdAuthoringError([canonicalId]);
  }
  return {
    ...entry,
    declaredCanonicalId: canonicalId,
  };
}

/**
 * Crosswalk remains readable for history/rollback even when it lists legacy IDs.
 */
export function readOnlyLegacyIdsFromCrosswalk(
  entries: readonly CardCrosswalkEntry[],
): string[] {
  return [...new Set(entries.map((e) => e.legacyNodeId))].sort();
}

/**
 * Convert active index entry to authoring shape for re-export.
 */
export function indexEntryToAuthoring(
  entry: CanonicalCardIndexEntry,
): MigratedCardAuthoring {
  return {
    cardId: entry.cardId,
    canonicalId: entry.canonicalId,
    status:
      entry.status === 'ACTIVE'
        ? 'ACTIVE'
        : entry.status === 'DRAFT'
          ? 'DRAFT'
          : 'INACTIVE',
    title: entry.title,
    contentVersion: entry.cardVersion,
    projectionScope: entry.projectionScope,
    sourceHash: entry.sourceHash,
    legacyAliases: entry.legacyAliases,
    sourcePath: entry.sourcePath,
    required: entry.required,
  };
}
