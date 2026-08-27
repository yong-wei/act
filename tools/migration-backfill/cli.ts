import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkMigrationBackfillCompetition } from './check';
import { evaluateApplyGate, buildCommandReceipt } from './apply-gate';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';
const result = checkMigrationBackfillCompetition(cwd);

if (command === 'write' && result.ok) {
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
    commands: result.commands.map((item) => ({
      path: item.path,
      commandId: item.commandId,
      owner: item.owner,
      oneOffClass: item.oneOffClass,
      safetyMode: item.safetyMode,
    })),
  }, null, 2)}\n`);
  writeFileSync(join(outDir, 'sample-dry-run-receipt.json'), `${JSON.stringify(result.sampleReceipt, null, 2)}\n`);
}

if (command === 'apply') {
  const gate = evaluateApplyGate({
    mode: 'apply',
    approval: process.env.ACT_APPLY_APPROVAL ?? null,
    planHash: result.sampleReceipt.planHash,
    currentInputHash: result.sampleReceipt.inputHash,
    targetIdentity: process.env.ACT_APPLY_TARGET ?? 'unspecified',
  });
  const receipt = buildCommandReceipt({
    commandId: 'oneoff:apply-gate',
    sourceRevision: result.sampleReceipt.sourceRevision,
    sourceTree: result.sampleReceipt.sourceTree,
    planHash: result.sampleReceipt.planHash,
    inputHash: result.sampleReceipt.inputHash,
    targetIdentity: process.env.ACT_APPLY_TARGET ?? 'unspecified',
    gate,
  });
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  if (!gate.allowed) process.exitCode = 1;
} else if (!result.ok) {
  for (const failure of result.failures.slice(0, 50)) process.stderr.write(`${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`migration-backfill-competition:ok commands=${result.commands.length}\n`);
}
