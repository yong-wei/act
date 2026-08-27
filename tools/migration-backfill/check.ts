import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { worktreeIsClean } from '../boundary/git-source';
import { findProductToolEdges } from '../boundary/product-imports';
import { listTracked } from './classify';
import { inventoryOneOffCommands } from './classify';
import { evaluateApplyGate, hashValue, buildCommandReceipt } from './apply-gate';
import type { CommandReceipt, OneOffCommand } from './types';

export interface OneOffCheckResult {
  readonly ok: boolean;
  readonly failures: string[];
  readonly commands: readonly OneOffCommand[];
  readonly sampleReceipt: CommandReceipt;
}

export function checkMigrationBackfillCompetition(cwd: string): OneOffCheckResult {
  const failures: string[] = [];
  if (!worktreeIsClean(cwd)) failures.push('dirty-worktree');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd, encoding: 'utf8' }).trim();
  const commands = inventoryOneOffCommands(cwd);
  const migrations = commands.filter((item) => item.path.startsWith('scripts/migrations/'));
  const db = commands.filter((item) => item.path.startsWith('scripts/db/'));
  if (migrations.length !== 3) failures.push(`migration-count:${migrations.length}`);
  if (db.length < 70) failures.push(`db-count:${db.length}`);
  if (!commands.some((item) => item.oneOffClass === 'competition-material')) {
    failures.push('missing-competition-material');
  }
  if (commands.some((item) => !item.owner || !item.commandId)) failures.push('unclassified-oneoff');
  const writers = [
    'scripts/db/set-ai-provider-qwen-default.ts',
    'scripts/db/update-fixed-account-passwords.mjs',
  ];
  for (const path of writers) {
    const found = commands.find((item) => item.path === path);
    if (!found || found.safetyMode !== 'apply-gated') failures.push(`writer-not-apply-gated:${path}`);
  }
  const inventoryPath = join(cwd, 'docs/architecture/migration-backfill-competition/inventory.json');
  if (existsSync(inventoryPath)) {
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as { sourceRevision?: string };
    if (!inventory.sourceRevision) {
      failures.push('inventory-missing-source-revision');
    } else {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', inventory.sourceRevision, 'HEAD'], { cwd });
      } catch {
        failures.push('inventory-revision-not-ancestor');
      }
    }
  }

  const tracked = [
    ...listTracked(cwd, 'scripts/migrations'),
    ...listTracked(cwd, 'scripts/db'),
    ...listTracked(cwd, 'evaluate'),
    ...listTracked(cwd, 'src'),
  ];
  for (const edge of findProductToolEdges(cwd, tracked)) {
    failures.push(`product-to-oneoff-import:${edge.from}->${edge.to}`);
  }

  const inputHash = hashValue(commands.map((item) => item.path).join('\n'));
  const rejected = evaluateApplyGate({
    mode: 'apply',
    approval: null,
    planHash: inputHash,
    currentInputHash: inputHash,
    targetIdentity: 'fixture:local',
  });
  if (rejected.status !== 'apply-rejected') failures.push('apply-without-approval-not-rejected');

  const sampleReceipt = buildCommandReceipt({
    commandId: 'oneoff:historical-backfill:dry-run',
    sourceRevision,
    sourceTree,
    planHash: inputHash,
    inputHash,
    targetIdentity: 'fixture:local',
    gate: evaluateApplyGate({
      mode: 'dry-run',
      approval: null,
      planHash: inputHash,
      currentInputHash: inputHash,
      targetIdentity: 'fixture:local',
    }),
  });

  return { ok: failures.length === 0, failures, commands, sampleReceipt };
}
