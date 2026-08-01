import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(join(
  process.cwd(),
  'prisma/migrations/20260729063847_add_diagnosis_report/migration.sql',
), 'utf8');
const snapshotBackfill = readFileSync(join(
  process.cwd(),
  'scripts/migrations/003-backfill-snapshots.ts',
), 'utf8');

describe('diagnosis migration contract', () => {
  it('limits active-risk deduplication and uniqueness to current risk types', () => {
    const currentRiskPredicate = "\"flagType\" IN ('stagnation', 'constraint', 'cross_domain')";

    expect(migration).toContain(currentRiskPredicate);
    for (const flagType of ['stagnation', 'constraint', 'cross_domain']) {
      expect(migration).toContain(
        `CREATE UNIQUE INDEX IF NOT EXISTS "StudentRiskFlag_active_${flagType}_user_key"`,
      );
      expect(migration).toContain(`AND "flagType" = '${flagType}'`);
    }
    expect(migration).not.toMatch(/AND "flagType" = '(participation|ai_misuse)'/);
  });

  it('backfills historical evidence at migration observation time without changing trigger history', () => {
    expect(migration).toContain('ADD COLUMN "evidenceObservedAt" TIMESTAMP(3)');
    expect(migration).toContain('SET "evidenceObservedAt" = CURRENT_TIMESTAMP');
    expect(migration).toContain('ALTER COLUMN "evidenceObservedAt" SET NOT NULL');
    expect(migration).not.toContain('SET "evidenceObservedAt" = "triggeredAt"');
    expect(migration).not.toContain('SET "triggeredAt" =');
  });

  it('records snapshot backfill materialization time as the first governed risk observation', () => {
    expect(snapshotBackfill).toContain('const materializedAt = new Date();');
    expect(snapshotBackfill).toContain('snapshotAt: materializedAt');
    expect(snapshotBackfill).toContain('evidenceObservedAt: materializedAt');
    expect(snapshotBackfill).not.toContain('evidenceObservedAt: risk.triggeredAt');
  });
});
