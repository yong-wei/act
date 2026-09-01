import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { listRegistryEntries } from '@/features/learning-record/event-contract/registry';
import {
  WRITE_BOUNDARY_C0_CAPTURE_SHA,
  WRITE_BOUNDARY_DELETION_LEDGER,
  WRITE_BOUNDARY_ROWS,
  WriteBoundaryError,
  assertExplicitHistoricalApply,
  assertWriteBoundaryCanary,
  assertWriteBoundaryRowComplete,
  getWriteBoundaryRow,
} from '../public-api';

describe('Learning Record write-boundary denominator', () => {
  it('binds the producer inventory to the published C0 capture SHA', () => {
    const summary = readFileSync('docs/architecture/modular-monolith/current-head/summary.md', 'utf8');
    expect(WRITE_BOUNDARY_C0_CAPTURE_SHA).toMatch(/^[0-9a-f]{40}$/);
    expect(summary).toContain(WRITE_BOUNDARY_C0_CAPTURE_SHA);
    expect(execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()).toMatch(/^[0-9a-f]{40}$/);
  });

  it('fails closed when a row lacks owner, replacement or deletion condition', () => {
    for (const item of WRITE_BOUNDARY_ROWS) {
      expect(assertWriteBoundaryRowComplete(item).owner).toBeTruthy();
    }
    expect(() => getWriteBoundaryRow('does-not-exist')).toThrow(WriteBoundaryError);
  });

  it('closes the live producer canary against the current worktree', () => {
    const discovered = assertWriteBoundaryCanary(process.cwd());
    expect(discovered).toEqual(expect.arrayContaining([
      'src/app/api/interactive/events/route.ts',
      'src/features/learning-record/ingestion/ingest.ts',
      'scripts/workers/data-governance-worker.ts',
      'src/features/assessment/adaptive-persistence.ts',
    ]));
  });

  it('keeps the existing event registry as the only protocol authority', () => {
    expect(listRegistryEntries().length).toBeGreaterThan(0);
    const inventory = readFileSync('src/features/learning-record/write-boundary/inventory.ts', 'utf8');
    expect(inventory).not.toContain('buildLearningRecordRegistry');
    expect(inventory).not.toContain('discriminator:');
  });

  it('keeps same-transaction Assessment writes as typed ingest, not synthetic events', () => {
    const assessment = readFileSync('src/features/assessment/adaptive-persistence.ts', 'utf8');
    expect(assessment).toContain('ingestLearningFact');
    expect(assessment).not.toContain('acceptLearningRecordEvent');
    expect(assessment).not.toContain('stageLearningFactIngestion');
  });

  it('splits API direct ingest from Redis secondary buffering', () => {
    const interactive = readFileSync('src/app/api/interactive/events/route.ts', 'utf8');
    expect(interactive).toContain('if (materializesFact)');
    expect(interactive).toContain('ingestLearningFact');
    expect(interactive).toContain('routeEvent(learningEvent)');
    expect(interactive.indexOf('ingestLearningFact')).toBeLessThan(interactive.indexOf('routeEvent(learningEvent)'));
  });

  it('keeps Redis secondary claims on idempotent ingest instead of ACK-skipping them', () => {
    const worker = readFileSync('scripts/workers/data-governance-worker.ts', 'utf8');
    expect(worker).toContain('ingestLearningFact');
    expect(worker).not.toContain('classifySecondaryWorkerClaim');
    expect(worker).toContain('selectAckClaims');
  });

  it('records the deletion/isolation ledger without guessing C6/C7 file deletions', () => {
    expect(WRITE_BOUNDARY_DELETION_LEDGER.map((item) => item.id)).toEqual([
      'queue.rpop.destructive',
      'queue.ltrim.destructive',
      'materializer.persist-core.bypass',
      'historical.online-projection-trigger',
      'redis.core-shouldMaterialize',
    ]);
    expect(WRITE_BOUNDARY_DELETION_LEDGER.find((item) => item.id === 'redis.core-shouldMaterialize')?.replacement).toContain('ingestLearningFact');
    expect(getWriteBoundaryRow('producer.arena.official').disposition).toBe('exception-c6-c7');
    expect(getWriteBoundaryRow('producer.assessment.adaptive').disposition).toBe('canonical');
    expect(getWriteBoundaryRow('backfill.historical-evidence').transport).toBe('explicit-backfill');
  });

  it('rejects historical apply without an explicit operation, actor and frozen cutoff', () => {
    expect(() => assertExplicitHistoricalApply({})).toThrow(WriteBoundaryError);
    expect(assertExplicitHistoricalApply({
      operationId: 'op-1',
      authorizedBy: 'operator',
      frozenCutoff: '2026-09-01T00:00:00.000Z',
    })).toEqual({
      operationId: 'op-1',
      authorizedBy: 'operator',
      frozenCutoff: '2026-09-01T00:00:00.000Z',
    });
  });

  it('keeps backfill CLIs dry-run by default and off the current pointer', () => {
    const historical = readFileSync('src/lib/data-governance/historical-evidence-materialization.ts', 'utf8');
    const batches = readFileSync('scripts/db/backfill-learning-facts-from-event-batches.ts', 'utf8');
    const script = readFileSync('scripts/db/materialize-historical-learning-facts.ts', 'utf8');
    expect(historical).toContain("mode: 'dry-run'");
    expect(historical).not.toContain('recordProjectionTriggerIntent');
    expect(historical).not.toContain('publishCurrentPointer');
    expect(batches).toContain('const isDryRun = process.argv.includes(\'--dry-run\')');
    expect(batches).toContain('--enqueue-snapshots has been removed');
    expect(script).toContain('--authorize');
    expect(script).toContain('--operation-id');
  });
});
