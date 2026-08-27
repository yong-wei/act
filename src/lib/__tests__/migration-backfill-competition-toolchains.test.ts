import { describe, expect, it } from 'vitest';

import { worktreeIsClean } from '../../../tools/boundary/git-source';
import { evaluateApplyGate } from '../../../tools/migration-backfill/apply-gate';
import { checkMigrationBackfillCompetition } from '../../../tools/migration-backfill/check';
import { classifyOneOffPath } from '../../../tools/migration-backfill/classify';

describe('migration backfill competition toolchains', () => {
  it('classifies migrations, backfills, and competition helpers', () => {
    expect(classifyOneOffPath('scripts/migrations/002-migrate-to-learning-facts.ts')).toMatchObject({
      oneOffClass: 'migration-repair',
      safetyMode: 'apply-gated',
    });
    expect(classifyOneOffPath('scripts/db/backfill-learning-facts-from-event-batches.ts')).toMatchObject({
      oneOffClass: 'historical-backfill',
      safetyMode: 'apply-gated',
    });
    expect(classifyOneOffPath('scripts/db/dry-run-simulation-task-evidence.ts').safetyMode).toBe('dry-run-default');
    expect(classifyOneOffPath('evaluate/reports/summary.md').oneOffClass).toBe('competition-material');
  });

  it('rejects apply without approval or with a stale plan hash and never executes', () => {
    expect(evaluateApplyGate({
      mode: 'apply',
      approval: null,
      planHash: 'a',
      currentInputHash: 'a',
      targetIdentity: 'fixture:local',
    })).toMatchObject({ status: 'apply-rejected', reason: 'approval-absent', executed: false });
    expect(evaluateApplyGate({
      mode: 'apply',
      approval: 'fixture-approval',
      planHash: 'old',
      currentInputHash: 'new',
      targetIdentity: 'fixture:local',
    })).toMatchObject({ status: 'apply-rejected', reason: 'plan-hash-stale', executed: false });
    expect(evaluateApplyGate({
      mode: 'apply',
      approval: 'fixture-approval',
      planHash: 'same',
      currentInputHash: 'same',
      targetIdentity: 'fixture:local',
    })).toMatchObject({ status: 'apply-authorized-not-executed', executed: false });
  });

  it('qualifies the live one-off inventory without product writer imports', () => {
    const result = checkMigrationBackfillCompetition(process.cwd());
    if (result.failures.includes('dirty-worktree')) {
      expect(worktreeIsClean(process.cwd())).toBe(false);
      return;
    }
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.commands.filter((item) => item.path.startsWith('scripts/migrations/'))).toHaveLength(3);
    expect(result.commands.some((item) => item.oneOffClass === 'competition-material')).toBe(true);
    expect(JSON.stringify(result.sampleReceipt)).not.toMatch(/DATABASE_URL=/);
  });
});
