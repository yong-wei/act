/**
 * Deterministic old-ID → Canonical card crosswalk (#1271).
 *
 * Classifies one-to-one, duplicate, split, unmapped, and course-specific cases.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { LegacyIdCrosswalkEntry } from '../migration-contracts';
import {
  CARD_CROSSWALK_CONTRACT,
  DEFAULT_CARD_MIGRATION_AUTHORING_RELATIVE,
  type CardCrosswalkDocument,
  type CardCrosswalkEntry,
  type CardMigrationClass,
  type KnowledgeCardInventoryEntry,
} from './contracts';

export class CardCrosswalkError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CardCrosswalkError';
    this.code = code;
  }
}

function compareCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function normalizeEntry(value: unknown, index: number): CardCrosswalkEntry {
  if (!value || typeof value !== 'object') {
    throw new CardCrosswalkError(
      'schema-invalid',
      `card crosswalk row ${index} must be an object`,
    );
  }
  const row = value as Record<string, unknown>;
  const legacyNodeId = String(row.legacyNodeId ?? row.legacyId ?? '').trim();
  const canonicalId = String(row.canonicalId ?? '').trim();
  if (!legacyNodeId || !canonicalId) {
    throw new CardCrosswalkError(
      'schema-invalid',
      `card crosswalk row ${index} requires legacyNodeId and canonicalId`,
    );
  }
  return {
    legacyNodeId,
    canonicalId,
    cardId:
      row.cardId == null || row.cardId === ''
        ? null
        : String(row.cardId).trim(),
    sourceEvidence:
      typeof row.sourceEvidence === 'string' ? row.sourceEvidence : null,
    stale: row.stale === true,
    courseSpecific: row.courseSpecific === true,
    scopeId:
      row.scopeId == null || row.scopeId === ''
        ? null
        : String(row.scopeId).trim(),
  };
}

export function parseCardCrosswalkDocument(raw: string): CardCrosswalkDocument {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { contract: CARD_CROSSWALK_CONTRACT, entries: [] };
  }

  // JSONL (one object per non-comment line) when multiple content lines exist.
  const contentLines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  if (
    contentLines.length > 1
    && contentLines.every((line) => line.startsWith('{') && line.endsWith('}'))
  ) {
    const entries: CardCrosswalkEntry[] = [];
    let index = 0;
    for (const line of contentLines) {
      entries.push(normalizeEntry(JSON.parse(line), index));
      index += 1;
    }
    return { contract: CARD_CROSSWALK_CONTRACT, entries };
  }

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    // Single object may be a document `{ contract, entries }` or one entry.
    if (Array.isArray(parsed.entries)) {
      return {
        contract: CARD_CROSSWALK_CONTRACT,
        entries: parsed.entries.map(normalizeEntry),
      };
    }
    return {
      contract: CARD_CROSSWALK_CONTRACT,
      entries: [normalizeEntry(parsed, 0)],
    };
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown[];
    return {
      contract: CARD_CROSSWALK_CONTRACT,
      entries: parsed.map(normalizeEntry),
    };
  }

  const entries: CardCrosswalkEntry[] = [];
  let index = 0;
  for (const line of contentLines) {
    entries.push(normalizeEntry(JSON.parse(line), index));
    index += 1;
  }
  return { contract: CARD_CROSSWALK_CONTRACT, entries };
}

export function loadCardCrosswalk(filePath: string): CardCrosswalkDocument {
  if (!existsSync(filePath)) {
    return { contract: CARD_CROSSWALK_CONTRACT, entries: [] };
  }
  return parseCardCrosswalkDocument(readFileSync(filePath, 'utf8'));
}

export function defaultCardCrosswalkPath(authoringRoot?: string): string {
  return join(
    authoringRoot
      ?? DEFAULT_CARD_MIGRATION_AUTHORING_RELATIVE,
    'card-crosswalk.jsonl',
  );
}

/**
 * Merge shared legacy-id crosswalk (#1268) with card-specific rows.
 * Card-specific rows win on (legacyNodeId, canonicalId) key.
 */
export function mergeCardCrosswalkSources(input: {
  legacyCrosswalk?: readonly LegacyIdCrosswalkEntry[];
  cardCrosswalk?: readonly CardCrosswalkEntry[];
}): CardCrosswalkEntry[] {
  const byKey = new Map<string, CardCrosswalkEntry>();

  for (const entry of input.legacyCrosswalk ?? []) {
    const key = `${entry.legacyId}\u001f${entry.canonicalId}`;
    byKey.set(key, {
      legacyNodeId: entry.legacyId,
      canonicalId: entry.canonicalId,
      cardId: null,
      sourceEvidence: entry.sourceEvidence ?? null,
      stale: entry.stale === true,
      courseSpecific: false,
      scopeId: null,
    });
  }

  for (const entry of input.cardCrosswalk ?? []) {
    const key = `${entry.legacyNodeId}\u001f${entry.canonicalId}`;
    byKey.set(key, entry);
  }

  return [...byKey.values()].sort((a, b) => {
    const byLegacy = compareCodePoint(a.legacyNodeId, b.legacyNodeId);
    if (byLegacy !== 0) return byLegacy;
    return compareCodePoint(a.canonicalId, b.canonicalId);
  });
}

export interface CardCrosswalkClassification {
  classification: CardMigrationClass;
  canonicalIds: string[];
  crosswalkRows: CardCrosswalkEntry[];
  reason: string;
}

/**
 * Classify one inventory card against the crosswalk + authority set.
 *
 * - ONE_TO_ONE: exactly one active non-course-specific mapping to usable Canonical
 * - DUPLICATE: multiple cards share one Canonical (detected later at set level;
 *   per-card still ONE_TO_ONE if mapping is unique for this legacy id)
 * - SPLIT: one legacy → many Canonicals
 * - UNMAPPED: no usable mapping
 * - COURSE_SPECIFIC: all mappings flagged courseSpecific
 */
export function classifyCardAgainstCrosswalk(input: {
  card: KnowledgeCardInventoryEntry;
  crosswalk: readonly CardCrosswalkEntry[];
  authorityCanonicalIds: ReadonlySet<string>;
}): CardCrosswalkClassification {
  const card = input.card;
  const rows = input.crosswalk.filter(
    (e) =>
      e.legacyNodeId === card.legacyNodeId
      || e.cardId === card.cardId
      || (card.declaredCanonicalId != null
        && e.canonicalId === card.declaredCanonicalId
        && e.legacyNodeId === card.legacyNodeId),
  );

  // Declared Canonical on card counts as an explicit one-to-one signal when
  // it is in Authority and no conflicting crosswalk exists.
  if (
    card.declaredCanonicalId
    && input.authorityCanonicalIds.has(card.declaredCanonicalId)
    && rows.length === 0
  ) {
    return {
      classification: 'ONE_TO_ONE',
      canonicalIds: [card.declaredCanonicalId],
      crosswalkRows: [
        {
          legacyNodeId: card.legacyNodeId,
          canonicalId: card.declaredCanonicalId,
          cardId: card.cardId,
          sourceEvidence: 'declared-canonical-id',
          stale: false,
          courseSpecific: false,
          scopeId: null,
        },
      ],
      reason: 'declared canonicalId on card frontmatter',
    };
  }

  const active = rows.filter((r) => !r.stale);
  if (active.length === 0) {
    return {
      classification: 'UNMAPPED',
      canonicalIds: [],
      crosswalkRows: rows,
      reason: rows.length > 0
        ? 'only stale crosswalk rows'
        : 'no crosswalk mapping',
    };
  }

  if (active.every((r) => r.courseSpecific === true)) {
    const canonicalIds = [
      ...new Set(
        active
          .map((r) => r.canonicalId)
          .filter((id) => input.authorityCanonicalIds.has(id)),
      ),
    ].sort(compareCodePoint);
    return {
      classification: 'COURSE_SPECIFIC',
      canonicalIds,
      crosswalkRows: active,
      reason: 'course-specific mapping; keep under lesson/step resources',
    };
  }

  const globalRows = active.filter((r) => r.courseSpecific !== true);
  const usable = globalRows.filter((r) =>
    input.authorityCanonicalIds.has(r.canonicalId),
  );
  const uniqueCanonicals = [...new Set(usable.map((r) => r.canonicalId))].sort(
    compareCodePoint,
  );

  if (uniqueCanonicals.length === 0) {
    return {
      classification: 'UNMAPPED',
      canonicalIds: [],
      crosswalkRows: active,
      reason: 'crosswalk targets not in Authority',
    };
  }

  if (uniqueCanonicals.length > 1) {
    return {
      classification: 'SPLIT',
      canonicalIds: uniqueCanonicals,
      crosswalkRows: usable,
      reason: `one legacy node maps to ${uniqueCanonicals.length} Canonical IDs`,
    };
  }

  return {
    classification: 'ONE_TO_ONE',
    canonicalIds: uniqueCanonicals,
    crosswalkRows: usable,
    reason: 'exact one-to-one crosswalk',
  };
}

/**
 * Detect many cards mapping to the same Canonical (duplicate actives).
 */
export function detectDuplicateCanonicalTargets(
  pairs: readonly { cardId: string; canonicalId: string }[],
): Array<{ canonicalId: string; cardIds: string[] }> {
  const byCanonical = new Map<string, string[]>();
  for (const pair of pairs) {
    const list = byCanonical.get(pair.canonicalId) ?? [];
    list.push(pair.cardId);
    byCanonical.set(pair.canonicalId, list);
  }
  const dups: Array<{ canonicalId: string; cardIds: string[] }> = [];
  for (const [canonicalId, cardIds] of byCanonical) {
    const unique = [...new Set(cardIds)].sort(compareCodePoint);
    if (unique.length > 1) {
      dups.push({ canonicalId, cardIds: unique });
    }
  }
  return dups.sort((a, b) => compareCodePoint(a.canonicalId, b.canonicalId));
}

/**
 * Generate a deterministic crosswalk document from inventory + Authority labels.
 * Only exact declared / provided rows are emitted — no fuzzy inference.
 */
export function buildDeterministicCardCrosswalk(input: {
  inventory: readonly KnowledgeCardInventoryEntry[];
  /** Pre-seeded rows (author or shared legacy crosswalk). */
  seed?: readonly CardCrosswalkEntry[];
  authorityCanonicalIds: ReadonlySet<string>;
}): CardCrosswalkDocument {
  const byKey = new Map<string, CardCrosswalkEntry>();

  for (const row of input.seed ?? []) {
    byKey.set(`${row.legacyNodeId}\u001f${row.canonicalId}`, row);
  }

  for (const card of input.inventory) {
    if (
      card.declaredCanonicalId
      && input.authorityCanonicalIds.has(card.declaredCanonicalId)
    ) {
      const key = `${card.legacyNodeId}\u001f${card.declaredCanonicalId}`;
      if (!byKey.has(key)) {
        byKey.set(key, {
          legacyNodeId: card.legacyNodeId,
          canonicalId: card.declaredCanonicalId,
          cardId: card.cardId,
          sourceEvidence: 'declared-canonical-id',
          stale: false,
          courseSpecific: false,
          scopeId: null,
        });
      }
    }
  }

  const entries = [...byKey.values()].sort((a, b) => {
    const byLegacy = compareCodePoint(a.legacyNodeId, b.legacyNodeId);
    if (byLegacy !== 0) return byLegacy;
    return compareCodePoint(a.canonicalId, b.canonicalId);
  });

  return { contract: CARD_CROSSWALK_CONTRACT, entries };
}
