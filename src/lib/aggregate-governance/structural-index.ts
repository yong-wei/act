import type { ResourceBindingInventory } from '@/lib/canonical-resource-binding';

import type { StructuralUnitIndexEntry } from './contracts';
import { sha256Canonical } from './hash';

/**
 * Families that carry ACT course/textbook content usable for semantic
 * Crosswalk recall even when inventory disposition is not yet INCLUDED
 * (e.g. knowledge cards missing pathEligibility, audit-only textbook sections).
 */
const SEMANTIC_CONTENT_FAMILY_PREFIXES = [
  'knowledge-card:',
  'infograph:',
  'knowledge-infograph:',
  'textbook-section:',
  'authoring-textbook-section:',
  'authoring-textbook-chapter:',
  'runtime-handout:',
  'textbook:',
] as const;

/**
 * True when an inventory item may enter the semantic recall structural index.
 * INCLUDED units always qualify. Content-bearing UNRESOLVED/EXCLUDED units
 * qualify when the atomic identity tuple is complete — review may still reject.
 */
export function isSemanticRecallInventoryItem(
  item: ResourceBindingInventory['items'][number],
): boolean {
  if (
    !item.structuralUnitId
    || !item.resourceSegmentHash
    || !item.atomicResourceId
    || !item.resourceId
    || !item.segmentId
  ) {
    return false;
  }
  if (item.disposition === 'INCLUDED') return true;

  const blob = `${item.structuralUnitId}\u001f${item.resourceId}`;
  const contentBearing = SEMANTIC_CONTENT_FAMILY_PREFIXES.some((prefix) => (
    blob.includes(prefix)
  ));
  if (!contentBearing) return false;
  // Source must have been observed (hash present is required above).
  return item.disposition === 'UNRESOLVED' || item.disposition === 'EXCLUDED';
}

/**
 * Build one versioned ACT structural-unit index from the effective #1124
 * inventory. Deterministic alignment requires the complete
 * edition/unit/version/hash/inventory/resource/segment tuple.
 *
 * Pass `mode: 'semantic-recall'` to include content-bearing UNRESOLVED/EXCLUDED
 * textbook and knowledge units for Crosswalk candidate generation. Default
 * remains INCLUDED-only for publication-facing deterministic alignment.
 */
export function buildStructuralUnitIndexFromInventory(input: {
  inventory: ResourceBindingInventory;
  sourceEditionId?: string;
  sourceVersion?: string;
  dispositions?: ReadonlyArray<'INCLUDED' | 'EXCLUDED' | 'UNRESOLVED'>;
  mode?: 'included-only' | 'semantic-recall';
}): {
  version: string;
  versionHash: string;
  entries: StructuralUnitIndexEntry[];
} {
  const mode = input.mode ?? 'included-only';
  const allowed = new Set(input.dispositions ?? (
    mode === 'semantic-recall'
      ? (['INCLUDED', 'EXCLUDED', 'UNRESOLVED'] as const)
      : (['INCLUDED'] as const)
  ));
  const entries = input.inventory.items
    .filter((item) => allowed.has(item.disposition))
    .filter((item) => (
      mode === 'included-only' ? true : isSemanticRecallInventoryItem(item)
    ))
    .map((item) => {
      const reasonCodes = [...new Set(item.reasonCodes ?? [])].sort((a, b) => (
        a.localeCompare(b, 'en')
      ));
      const entry: StructuralUnitIndexEntry = {
        sourceEditionId: input.sourceEditionId ?? 'act-teaching-resource-inventory',
        sourceVersion: input.sourceVersion ?? input.inventory.captureRevision,
        structuralUnitId: item.structuralUnitId,
        structuralUnitVersion: input.inventory.captureRevision,
        structuralUnitHash: item.resourceSegmentHash,
        stableIds: [
          item.atomicResourceId,
          item.structuralUnitId,
          item.resourceId,
          item.segmentId,
        ].filter(Boolean),
        contentHashes: [item.resourceSegmentHash],
        atomicResourceId: item.atomicResourceId,
        resourceId: item.resourceId,
        segmentId: item.segmentId,
        resourceSegmentHash: item.resourceSegmentHash,
        textPreviewDigest: item.observationDigest,
        inventoryDisposition: item.disposition,
        reasonCodes,
      };
      return entry;
    })
    .sort((a, b) => (
      a.structuralUnitId.localeCompare(b.structuralUnitId)
      || a.segmentId!.localeCompare(b.segmentId!)
    ));

  const versionHash = sha256Canonical({
    inventoryRunId: input.inventory.runId,
    captureRevision: input.inventory.captureRevision,
    sourceHash: input.inventory.sourceHash,
    mode,
    entryDigests: entries.map((row) => sha256Canonical({
      structuralUnitId: row.structuralUnitId,
      structuralUnitVersion: row.structuralUnitVersion,
      structuralUnitHash: row.structuralUnitHash,
      atomicResourceId: row.atomicResourceId,
      resourceId: row.resourceId,
      segmentId: row.segmentId,
      resourceSegmentHash: row.resourceSegmentHash,
      inventoryDisposition: row.inventoryDisposition,
      reasonCodes: row.reasonCodes,
    })),
  });
  const version = `struct-index:${versionHash.slice(0, 16)}`;
  return { version, versionHash, entries };
}

export function structuralUnitIndexVersionDigest(
  version: string,
  versionHash: string,
): string {
  return sha256Canonical({ version, versionHash });
}
