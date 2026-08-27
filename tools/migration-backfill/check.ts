import { execFileSync } from 'node:child_process';

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
