import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { worktreeIsClean } from '../../../tools/boundary/git-source';
import { commandInputHash, evaluateApplyGate } from '../../../tools/migration-backfill/apply-gate';
import { checkMigrationBackfillCompetition } from '../../../tools/migration-backfill/check';
import { classifyOneOffPath } from '../../../tools/migration-backfill/classify';
import { findUngatedApplyPackageScripts } from '../../../tools/migration-backfill/entrypoints';

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
    expect(classifyOneOffPath('scripts/db/set-ai-provider-qwen-default.ts').safetyMode).toBe('apply-gated');
    expect(classifyOneOffPath('scripts/db/update-fixed-account-passwords.mjs').safetyMode).toBe('apply-gated');
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
      planHash: '',
      currentInputHash: 'new',
      targetIdentity: 'fixture:local',
    })).toMatchObject({ status: 'apply-rejected', reason: 'plan-hash-absent', executed: false });
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
    expect(result.commands.filter((item) => item.path.startsWith('scripts/migrations/'))).toHaveLength(3);
    expect(result.commands.some((item) => item.oneOffClass === 'competition-material')).toBe(true);
    expect(JSON.stringify(result.sampleReceipt)).not.toMatch(/DATABASE_URL=/);
    expect(findUngatedApplyPackageScripts(process.cwd(), result.commands)).toEqual([]);
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts['seed:fixed-passwords']).toContain('tools/migration-backfill/cli.ts');
    expect(pkg.scripts['db:set-ai-provider-qwen-default']).toContain('tools/migration-backfill/cli.ts');
    const first = result.commands.find((item) => item.path === 'scripts/db/set-ai-provider-qwen-default.ts');
    const second = result.commands.find((item) => item.path === 'scripts/db/update-fixed-account-passwords.mjs');
    expect(first && second).toBeTruthy();
    if (first && second) {
      expect(commandInputHash(first, result.blobs.get(first.path) ?? '')).not.toEqual(
        commandInputHash(second, result.blobs.get(second.path) ?? ''),
      );
    }
    if (result.failures.includes('dirty-worktree')) {
      expect(worktreeIsClean(process.cwd())).toBe(false);
      expect(result.failures.filter((item) => item !== 'dirty-worktree')).toEqual([]);
      return;
    }
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
