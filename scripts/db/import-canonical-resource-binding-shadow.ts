#!/usr/bin/env tsx
/**
 * CLI: import / verify #1124 resource binding inventory shadow runs.
 * Reusable inventory construction lives in
 * `src/lib/canonical-resource-binding/current-inventory.ts`.
 */
import 'dotenv/config';

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCurrentInventory,
  canonicalSha256,
  CanonicalResourceBindingRepository,
  evaluateCanonicalResourceCutoverReadiness,
  selectResourceKnowledgeAuthority,
  type CanonicalResourceBindingDatabase,
} from '../../src/lib/canonical-resource-binding';
import { createPrismaClient } from '../../src/lib/prisma-client';

// Re-export for any residual relative importers of the CLI path.
export { buildCurrentInventory } from '../../src/lib/canonical-resource-binding';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL is required');
  const verifyOnly = process.argv.includes('--verify-only');
  const db = createPrismaClient({ log: ['warn', 'error'] });
  try {
    const repository = new CanonicalResourceBindingRepository(
      db as unknown as CanonicalResourceBindingDatabase,
    );
    if (verifyOnly) {
      const recomputed = await buildCurrentInventory(db);
      const [persisted, crosswalkCount, bindingCount] = await Promise.all([
        db.resourceBindingInventoryRun.findUnique({
          where: { id: recomputed.runId },
          include: { items: { orderBy: { atomicResourceId: 'asc' } } },
        }),
        db.actkgEvidenceStructuralUnitCrosswalk.count(),
        db.canonicalResourceBindingDecision.count(),
      ]);
      if (!persisted) {
        throw new Error(`current resource binding inventory ${recomputed.runId} is missing`);
      }
      if (
        !persisted.complete
        || persisted.items.length !== persisted.itemCount
        || persisted.itemCount !== (
          persisted.includedCount + persisted.excludedCount + persisted.unresolvedCount
        )
      ) {
        throw new Error('persisted resource binding inventory is missing or incomplete');
      }
      if (crosswalkCount !== 0 || bindingCount !== 0) {
        throw new Error('unexpected formal crosswalk or shadow binding rows in baseline');
      }
      const persistedProjection = {
        runId: persisted.id,
        sourceHash: persisted.sourceHash,
        summary: {
          itemCount: persisted.itemCount,
          includedCount: persisted.includedCount,
          excludedCount: persisted.excludedCount,
          unresolvedCount: persisted.unresolvedCount,
        },
        items: persisted.items.map((item) => ({
          atomicResourceId: item.atomicResourceId,
          resourceId: item.resourceId,
          structuralUnitId: item.structuralUnitId,
          segmentId: item.segmentId,
          resourceSegmentHash: item.resourceSegmentHash,
          disposition: item.disposition,
          reasonCodes: item.reasonCodes,
          sourceObservations: item.sourceObservations,
          observationDigest: item.observationDigest,
        })).sort((left, right) => left.atomicResourceId.localeCompare(right.atomicResourceId)),
      };
      const recomputedProjection = {
        runId: recomputed.runId,
        sourceHash: recomputed.sourceHash,
        summary: recomputed.summary,
        items: recomputed.items,
      };
      const persistedDigest = canonicalSha256(persistedProjection);
      const recomputedDigest = canonicalSha256(recomputedProjection);
      if (persistedDigest !== recomputedDigest) {
        throw new Error(
          `persisted resource binding inventory has drifted from current inputs (${persistedDigest} != ${recomputedDigest})`,
        );
      }
      const readiness = evaluateCanonicalResourceCutoverReadiness({
        inventory: recomputed,
        decisions: [],
      });
      if (readiness.ready) throw new Error('baseline unexpectedly reports cutover ready');
      for (const consumer of [
        'FORMAL_RECOMMENDATION',
        'FORMAL_PATH',
        'FORMAL_EVIDENCE',
      ] as const) {
        if (selectResourceKnowledgeAuthority(consumer).authority !== 'LEGACY') {
          throw new Error(`formal authority drift for ${consumer}`);
        }
      }
      console.log(JSON.stringify({
        mode: 'verify-only',
        runId: persisted.id,
        complete: persisted.complete,
        cutoverReady: readiness.ready,
        authorityState: 'LEGACY',
        summary: {
          itemCount: persisted.itemCount,
          includedCount: persisted.includedCount,
          excludedCount: persisted.excludedCount,
          unresolvedCount: persisted.unresolvedCount,
          crosswalkCount,
          bindingCount,
        },
      }));
      return;
    }

    const inventory = await buildCurrentInventory(db);
    const persisted = await repository.persistInventory(inventory);
    console.log(JSON.stringify({
      mode: 'import',
      ...persisted,
      inventory: {
        runId: inventory.runId,
        captureRevision: inventory.captureRevision,
        capturedAt: inventory.capturedAt,
        dbWatermark: inventory.dbWatermark,
        sourceHash: inventory.sourceHash,
        complete: inventory.complete,
        cutoverReady: false,
        summary: inventory.summary,
      },
      authorityState: 'LEGACY',
    }));
  } finally {
    await db.$disconnect();
  }
}

const isDirectExecution = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const entry = process.argv[1] ? path.resolve(process.argv[1]) : '';
    return entry.length > 0 && path.resolve(thisFile) === entry;
  } catch {
    return false;
  }
})();

if (isDirectExecution) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'resource binding shadow import failed');
    process.exitCode = 1;
  });
}
