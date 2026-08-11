/**
 * Legacy ID crosswalk load/parse (#1268).
 *
 * Crosswalk is readable for history and rollback; new authoring does not write
 * legacy IDs as Canonical endpoints.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isTeachingProjectionRole } from './identity';
import {
  LEGACY_ID_CROSSWALK_CONTRACT,
  type LegacyIdCrosswalkDocument,
  type LegacyIdCrosswalkEntry,
} from './migration-contracts';

export class CrosswalkError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'CrosswalkError';
    this.code = code;
  }
}

function normalizeEntry(value: unknown, index: number): LegacyIdCrosswalkEntry {
  if (!value || typeof value !== 'object') {
    throw new CrosswalkError('schema-invalid', `crosswalk row ${index} must be an object`);
  }
  const row = value as Record<string, unknown>;
  const legacyId = String(row.legacyId ?? '').trim();
  const canonicalId = String(row.canonicalId ?? '').trim();
  if (!legacyId || !canonicalId) {
    throw new CrosswalkError(
      'schema-invalid',
      `crosswalk row ${index} requires legacyId and canonicalId`,
    );
  }
  const roleRaw = row.role;
  const role =
    roleRaw == null || roleRaw === ''
      ? null
      : isTeachingProjectionRole(roleRaw)
        ? roleRaw
        : (() => {
            throw new CrosswalkError(
              'schema-invalid',
              `crosswalk row ${index} has invalid role ${String(roleRaw)}`,
            );
          })();

  return {
    legacyId,
    canonicalId,
    role,
    sourceEvidence: typeof row.sourceEvidence === 'string' ? row.sourceEvidence : null,
    stale: row.stale === true,
  };
}

export function parseLegacyCrosswalkDocument(raw: string): LegacyIdCrosswalkDocument {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { contract: LEGACY_ID_CROSSWALK_CONTRACT, entries: [] };
  }

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const entriesRaw = Array.isArray(parsed.entries) ? parsed.entries : [];
    return {
      contract: LEGACY_ID_CROSSWALK_CONTRACT,
      entries: entriesRaw.map(normalizeEntry),
    };
  }

  if (trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed) as unknown[];
    return {
      contract: LEGACY_ID_CROSSWALK_CONTRACT,
      entries: parsed.map(normalizeEntry),
    };
  }

  const entries: LegacyIdCrosswalkEntry[] = [];
  let index = 0;
  for (const line of trimmed.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    entries.push(normalizeEntry(JSON.parse(t), index));
    index += 1;
  }
  return { contract: LEGACY_ID_CROSSWALK_CONTRACT, entries };
}

export function loadLegacyCrosswalk(filePath: string): LegacyIdCrosswalkDocument {
  if (!existsSync(filePath)) {
    return { contract: LEGACY_ID_CROSSWALK_CONTRACT, entries: [] };
  }
  return parseLegacyCrosswalkDocument(readFileSync(filePath, 'utf8'));
}

export function defaultLegacyCrosswalkPath(authoringRoot: string): string {
  return join(authoringRoot, 'legacy-crosswalk.jsonl');
}

/**
 * Detect one-to-many (split) and many-to-one (merge) relations in a crosswalk.
 * These cannot auto-publish without an author decision.
 */
export function analyzeCrosswalkCardinality(entries: readonly LegacyIdCrosswalkEntry[]): {
  splits: Array<{ legacyId: string; canonicalIds: string[] }>;
  merges: Array<{ canonicalId: string; legacyIds: string[] }>;
  oneToOne: LegacyIdCrosswalkEntry[];
} {
  const active = entries.filter((e) => !e.stale);
  const byLegacy = new Map<string, string[]>();
  const byCanonical = new Map<string, string[]>();

  for (const entry of active) {
    const leg = byLegacy.get(entry.legacyId) ?? [];
    leg.push(entry.canonicalId);
    byLegacy.set(entry.legacyId, leg);

    const can = byCanonical.get(entry.canonicalId) ?? [];
    can.push(entry.legacyId);
    byCanonical.set(entry.canonicalId, can);
  }

  const splits: Array<{ legacyId: string; canonicalIds: string[] }> = [];
  const merges: Array<{ canonicalId: string; legacyIds: string[] }> = [];
  const oneToOne: LegacyIdCrosswalkEntry[] = [];

  for (const [legacyId, canonicalIds] of byLegacy) {
    const unique = [...new Set(canonicalIds)];
    if (unique.length > 1) {
      splits.push({ legacyId, canonicalIds: unique.sort() });
    }
  }

  for (const [canonicalId, legacyIds] of byCanonical) {
    const unique = [...new Set(legacyIds)];
    if (unique.length > 1) {
      merges.push({ canonicalId, legacyIds: unique.sort() });
    }
  }

  const splitLegacies = new Set(splits.map((s) => s.legacyId));
  const mergeLegacies = new Set(merges.flatMap((m) => m.legacyIds));

  for (const entry of active) {
    if (splitLegacies.has(entry.legacyId) || mergeLegacies.has(entry.legacyId)) {
      continue;
    }
    oneToOne.push(entry);
  }

  return { splits, merges, oneToOne };
}
