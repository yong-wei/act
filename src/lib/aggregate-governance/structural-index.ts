import type { ResourceBindingInventory } from '@/lib/canonical-resource-binding';

import type { StructuralUnitIndexEntry } from './contracts';
import { sha256Canonical } from './hash';

/**
 * Build one versioned ACT structural-unit index from the effective #1124
 * inventory. Deterministic alignment requires the complete
 * edition/unit/version/hash/inventory/resource/segment tuple.
 */
export function buildStructuralUnitIndexFromInventory(input: {
  inventory: ResourceBindingInventory;
  sourceEditionId?: string;
  sourceVersion?: string;
  dispositions?: ReadonlyArray<'INCLUDED' | 'EXCLUDED' | 'UNRESOLVED'>;
}): {
  version: string;
  versionHash: string;
  entries: StructuralUnitIndexEntry[];
} {
  const allowed = new Set(input.dispositions ?? ['INCLUDED']);
  const entries = input.inventory.items
    .filter((item) => allowed.has(item.disposition))
    .map((item) => {
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
    entryDigests: entries.map((row) => sha256Canonical({
      structuralUnitId: row.structuralUnitId,
      structuralUnitVersion: row.structuralUnitVersion,
      structuralUnitHash: row.structuralUnitHash,
      atomicResourceId: row.atomicResourceId,
      resourceId: row.resourceId,
      segmentId: row.segmentId,
      resourceSegmentHash: row.resourceSegmentHash,
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
