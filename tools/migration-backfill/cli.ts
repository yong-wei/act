import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildCommandReceipt, commandInputHash, evaluateApplyGate } from './apply-gate';
import { checkMigrationBackfillCompetition, commandRecords, resolveCommand } from './check';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const positional = process.argv.slice(3).filter((value) => value !== '--');
const result = checkMigrationBackfillCompetition(cwd);
const inventoryRefreshFailures = new Set([
  'inventory-missing',
  'inventory-missing-source-revision',
  'inventory-revision-not-ancestor',
  'inventory-source-tree-mismatch',
  'inventory-source-tree-unreadable',
  'inventory-missing-content-hash',
  'inventory-command-set-drift',
]);

function failCheck(): void {
  for (const failure of result.failures.slice(0, 50)) process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
}

function canWriteInventory(): boolean {
  return result.failures.every((failure) => (
    inventoryRefreshFailures.has(failure) || failure === 'dirty-worktree'
  ));
}

function inputHashFor(item: { commandId: string; safetyMode: 'read-only' | 'dry-run-default' | 'apply-gated'; path: string }): string {
  return commandInputHash(item, result.blobs.get(item.path) ?? '');
}

if (command === 'write' && (result.ok || canWriteInventory())) {
  const outDir = join(cwd, 'docs/architecture/migration-backfill-competition');
  mkdirSync(outDir, { recursive: true });
  const counts = result.commands.reduce<Record<string, number>>((acc, item) => {
    acc[item.oneOffClass] = (acc[item.oneOffClass] ?? 0) + 1;
    return acc;
  }, {});
  writeFileSync(join(outDir, 'inventory.json'), `${JSON.stringify({
    sourceRevision: result.sampleReceipt.sourceRevision,
    sourceTree: result.sampleReceipt.sourceTree,
    counts,
    commandCount: result.commands.length,
    commands: commandRecords(result.commands, result.blobs),
  }, null, 2)}\n`);
  writeFileSync(join(outDir, 'sample-dry-run-receipt.json'), `${JSON.stringify(result.sampleReceipt, null, 2)}\n`);
} else if (command === 'dry-run' && result.ok) {
  const selected = positional[0]
    ? result.commands.filter((item) => item.path === positional[0] || item.commandId === positional[0])
    : result.commands.filter((item) => item.safetyMode === 'apply-gated');
  const plans = selected.map((item) => {
    const inputHash = inputHashFor(item);
    return buildCommandReceipt({
      commandId: item.commandId,
      sourceRevision: result.sampleReceipt.sourceRevision,
      sourceTree: result.sampleReceipt.sourceTree,
      planHash: inputHash,
      inputHash,
      targetIdentity: 'fixture:unspecified',
      gate: evaluateApplyGate({
        mode: 'dry-run',
        approval: null,
        planHash: inputHash,
        currentInputHash: inputHash,
        targetIdentity: 'fixture:unspecified',
      }),
    });
  });
  process.stdout.write(`${JSON.stringify({
    mode: 'dry-run',
    planCount: plans.length,
    plans,
  }, null, 2)}\n`);
} else if (command === 'apply') {
  if (!result.ok) {
    failCheck();
  } else {
    const selected = resolveCommand(result.commands, positional[0] ?? process.env.ACT_APPLY_COMMAND);
    if (!selected || selected.safetyMode !== 'apply-gated') {
      process.stderr.write('apply-command-absent-or-not-gated\n');
      process.exitCode = 1;
    } else {
      const inputHash = inputHashFor(selected);
      const gate = evaluateApplyGate({
        mode: 'apply',
        approval: process.env.ACT_APPLY_APPROVAL ?? null,
        planHash: process.env.ACT_APPLY_PLAN_HASH ?? '',
        currentInputHash: inputHash,
        targetIdentity: process.env.ACT_APPLY_TARGET ?? 'unspecified',
      });
      const receipt = buildCommandReceipt({
        commandId: selected.commandId,
        sourceRevision: result.sampleReceipt.sourceRevision,
        sourceTree: result.sampleReceipt.sourceTree,
        planHash: process.env.ACT_APPLY_PLAN_HASH ?? '',
        inputHash,
        targetIdentity: process.env.ACT_APPLY_TARGET ?? 'unspecified',
        gate,
      });
      process.stdout.write(`${JSON.stringify(receipt)}\n`);
      if (!gate.allowed) process.exitCode = 1;
    }
  }
} else if (!result.ok) {
  failCheck();
} else {
  process.stdout.write(`migration-backfill-competition:ok commands=${result.commands.length}\n`);
}
