import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { worktreeIsClean } from '../boundary/git-source';
import { findProductToolEdges } from '../boundary/product-imports';
import { buildCommandReceipt, commandInputHash, evaluateApplyGate } from './apply-gate';
import { inventoryOneOffCommands, listTracked, listTrackedBlobs } from './classify';
import { findUngatedApplyPackageScripts } from './entrypoints';
import type { CommandReceipt, OneOffCommand } from './types';

export interface InventoryCommandRecord {
  readonly path: string;
  readonly commandId: string;
  readonly owner: string;
  readonly oneOffClass: string;
  readonly safetyMode: string;
  readonly contentHash: string;
}

export interface OneOffCheckResult {
  readonly ok: boolean;
  readonly failures: string[];
  readonly commands: readonly OneOffCommand[];
  readonly blobs: ReadonlyMap<string, string>;
  readonly sampleReceipt: CommandReceipt;
}

const INVENTORY_ROOTS = ['scripts/migrations', 'scripts/db', 'evaluate', 'scripts/tests'] as const;

export function collectCommandBlobs(cwd: string): Map<string, string> {
  const blobs = new Map<string, string>();
  for (const root of INVENTORY_ROOTS) {
    for (const [path, blob] of listTrackedBlobs(cwd, root)) blobs.set(path, blob);
  }
  return blobs;
}

export function inventoryFingerprint(rows: readonly InventoryCommandRecord[]): string {
  return rows
    .map((row) => [row.path, row.commandId, row.owner, row.oneOffClass, row.safetyMode, row.contentHash].join('\t'))
    .sort((left, right) => left.localeCompare(right))
    .join('\n');
}

export function commandRecords(
  commands: readonly OneOffCommand[],
  blobs: ReadonlyMap<string, string>,
): InventoryCommandRecord[] {
  return commands.map((item) => ({
    path: item.path,
    commandId: item.commandId,
    owner: item.owner,
    oneOffClass: item.oneOffClass,
    safetyMode: item.safetyMode,
    contentHash: commandInputHash(item, blobs.get(item.path) ?? ''),
  }));
}

export function resolveCommand(
  commands: readonly OneOffCommand[],
  token: string | undefined,
): OneOffCommand | undefined {
  if (!token) return undefined;
  return commands.find((item) => item.path === token || item.commandId === token);
}

export function checkMigrationBackfillCompetition(cwd: string): OneOffCheckResult {
  const failures: string[] = [];
  if (!worktreeIsClean(cwd)) failures.push('dirty-worktree');
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd, encoding: 'utf8' }).trim();
  const commands = inventoryOneOffCommands(cwd);
  const blobs = collectCommandBlobs(cwd);
  const migrations = commands.filter((item) => item.path.startsWith('scripts/migrations/'));
  const db = commands.filter((item) => item.path.startsWith('scripts/db/'));
  if (migrations.length !== 3) failures.push(`migration-count:${migrations.length}`);
  if (db.length < 70) failures.push(`db-count:${db.length}`);
  if (!commands.some((item) => item.oneOffClass === 'competition-material')) {
    failures.push('missing-competition-material');
  }
  if (commands.some((item) => !item.owner || !item.commandId)) failures.push('unclassified-oneoff');
  if (commands.some((item) => !blobs.get(item.path))) failures.push('missing-command-blob');
  const writers = [
    'scripts/db/set-ai-provider-qwen-default.ts',
    'scripts/db/update-fixed-account-passwords.mjs',
  ];
  for (const path of writers) {
    const found = commands.find((item) => item.path === path);
    if (!found || found.safetyMode !== 'apply-gated') failures.push(`writer-not-apply-gated:${path}`);
  }
  for (const hit of findUngatedApplyPackageScripts(cwd, commands)) {
    failures.push(`ungated-npm-script:${hit.name}:${hit.path}`);
  }

  const inventoryPath = join(cwd, 'docs/architecture/migration-backfill-competition/inventory.json');
  if (!existsSync(inventoryPath)) {
    failures.push('inventory-missing');
  } else {
    const inventory = JSON.parse(readFileSync(inventoryPath, 'utf8')) as {
      sourceRevision?: string;
      sourceTree?: string;
      commands?: InventoryCommandRecord[];
    };
    if (!inventory.sourceRevision) {
      failures.push('inventory-missing-source-revision');
    } else {
      try {
        execFileSync('git', ['merge-base', '--is-ancestor', inventory.sourceRevision, 'HEAD'], { cwd });
      } catch {
        failures.push('inventory-revision-not-ancestor');
      }
      try {
        const capturedTree = execFileSync('git', ['rev-parse', `${inventory.sourceRevision}^{tree}`], {
          cwd,
          encoding: 'utf8',
        }).trim();
        if (!inventory.sourceTree || inventory.sourceTree !== capturedTree) {
          failures.push('inventory-source-tree-mismatch');
        }
      } catch {
        failures.push('inventory-source-tree-unreadable');
      }
    }
    const recorded = inventory.commands ?? [];
    if (recorded.some((row) => !row.contentHash)) failures.push('inventory-missing-content-hash');
    if (inventoryFingerprint(recorded) !== inventoryFingerprint(commandRecords(commands, blobs))) {
      failures.push('inventory-command-set-drift');
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

  const sampleCommand = commands.find((item) => item.safetyMode === 'apply-gated') ?? commands[0];
  const inputHash = sampleCommand
    ? commandInputHash(sampleCommand, blobs.get(sampleCommand.path) ?? '')
    : '';
  const rejected = evaluateApplyGate({
    mode: 'apply',
    approval: null,
    planHash: inputHash,
    currentInputHash: inputHash,
    targetIdentity: 'fixture:local',
  });
  if (rejected.status !== 'apply-rejected') failures.push('apply-without-approval-not-rejected');

  const sampleReceipt = buildCommandReceipt({
    commandId: sampleCommand?.commandId ?? 'oneoff:historical-backfill:dry-run',
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

  return { ok: failures.length === 0, failures, commands, blobs, sampleReceipt };
}
