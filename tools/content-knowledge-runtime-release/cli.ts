import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildCommandReceipt,
  claimedIdentityMatches,
  commandInputHash,
  evaluateApplyGate,
} from './apply-gate';
import { checkContentKnowledgeRuntimeRelease, commandRecords, resolveCommand } from './check';
import type { ReleaseCommand } from './types';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const positional = process.argv.slice(3).filter((value) => value !== '--');
const result = checkContentKnowledgeRuntimeRelease(cwd);
const inventoryRefreshFailures = new Set([
  'inventory-missing',
  'inventory-missing-source-revision',
  'inventory-revision-unreadable',
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

function inputHashFor(item: Pick<ReleaseCommand, 'commandId' | 'role' | 'safetyMode' | 'path'>): string {
  return commandInputHash(item, result.blobs.get(item.path) ?? '');
}

function claimedIdentity(): { sourceRevision: string; sourceTree: string } | null {
  const sourceRevision = process.env.ACT_RELEASE_SOURCE_REVISION ?? null;
  const sourceTree = process.env.ACT_RELEASE_SOURCE_TREE ?? null;
  if (!sourceRevision && !sourceTree) return null;
  return {
    sourceRevision: sourceRevision ?? '',
    sourceTree: sourceTree ?? '',
  };
}

function applyGate(selected: ReleaseCommand): void {
  if (selected.role === 'operator-adapter') {
    process.stderr.write('operator-adapter-not-publication\n');
    process.exitCode = 1;
    return;
  }
  if (selected.safetyMode !== 'apply-gated') {
    process.stderr.write('apply-command-not-gated\n');
    process.exitCode = 1;
    return;
  }
  if (!claimedIdentityMatches(claimedIdentity(), result.sampleReceipt)) {
    process.stderr.write('identity-mismatch\n');
    process.exitCode = 1;
    return;
  }
  const inputHash = inputHashFor(selected);
  const gate = evaluateApplyGate({
    mode: 'apply',
    approval: process.env.ACT_APPLY_APPROVAL ?? null,
    planHash: process.env.ACT_APPLY_PLAN_HASH ?? '',
    currentInputHash: inputHash,
    targetIdentity: process.env.ACT_APPLY_TARGET ?? 'unspecified',
  });
  const receipt = buildCommandReceipt({
    command: selected,
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

if (command === 'write' && (result.ok || canWriteInventory())) {
  const outDir = join(cwd, 'docs/architecture/content-knowledge-runtime-release');
  mkdirSync(outDir, { recursive: true });
  const sourceRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
  const sourceTree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { cwd, encoding: 'utf8' }).trim();
  const roleCounts = result.commands.reduce<Record<string, number>>((acc, item) => {
    acc[item.role] = (acc[item.role] ?? 0) + 1;
    return acc;
  }, {});
  const bind = <T extends { sourceRevision: string; sourceTree: string }>(receipt: T): T => ({
    ...receipt,
    sourceRevision,
    sourceTree,
  });
  writeFileSync(join(outDir, 'inventory.json'), `${JSON.stringify({
    sourceRevision,
    sourceTree,
    generatedInputs: [],
    counts: result.counts,
    roleCounts,
    commandCount: result.commands.length,
    commands: commandRecords(result.commands, result.blobs),
  }, null, 2)}\n`);
  writeFileSync(join(outDir, 'sample-content-export-receipt.json'), `${JSON.stringify(bind(result.characterization.content), null, 2)}\n`);
  writeFileSync(join(outDir, 'sample-knowledge-publication-receipt.json'), `${JSON.stringify(bind(result.characterization.knowledge), null, 2)}\n`);
  writeFileSync(join(outDir, 'sample-runtime-materialization-receipt.json'), `${JSON.stringify(bind(result.characterization.runtime), null, 2)}\n`);
} else if (command === 'dry-run' && result.ok) {
  const identity = claimedIdentity();
  if (!claimedIdentityMatches(identity, result.sampleReceipt)) {
    process.stderr.write('identity-mismatch\n');
    process.exitCode = 1;
  } else {
    const selected = positional[0]
      ? result.commands.filter((item) => item.path === positional[0] || item.commandId === positional[0])
      : result.commands.filter((item) => item.safetyMode === 'apply-gated' && item.role !== 'operator-adapter');
    const plans = selected.map((item) => {
      const inputHash = inputHashFor(item);
      return buildCommandReceipt({
        command: item,
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
  }
} else if (
  command === 'apply'
  || command === 'run'
  || command === 'export'
  || command === 'publish'
  || command === 'materialize'
) {
  if (!result.ok) {
    failCheck();
  } else {
    const selected = resolveCommand(result.commands, positional[0] ?? process.env.ACT_APPLY_COMMAND);
    if (!selected) {
      process.stderr.write('apply-command-absent\n');
      process.exitCode = 1;
    } else {
      applyGate(selected);
    }
  }
} else if (!result.ok) {
  failCheck();
} else {
  process.stdout.write(`content-knowledge-runtime-release:ok commands=${result.commands.length}\n`);
}
