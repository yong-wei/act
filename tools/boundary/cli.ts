import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { checkToolchainBoundary } from './check';
import { buildCommandReceipt, digestJson } from './receipt';
import { TOOLCHAIN_BOUNDARY_SCHEMA_VERSION } from './types';

const cwd = process.cwd();
const command = process.argv[2] ?? 'check';

const result = checkToolchainBoundary(cwd);
if (command === 'write') {
  const outDir = join(cwd, 'docs/architecture/toolchain-boundary');
  mkdirSync(outDir, { recursive: true });
  const payload = {
    schemaVersion: TOOLCHAIN_BOUNDARY_SCHEMA_VERSION,
    denominator: {
      sourceRevision: result.denominator.sourceRevision,
      sourceTree: result.denominator.sourceTree,
      totalCount: result.denominator.totalCount,
      digest: result.denominator.digest,
      families: result.denominator.families,
      generatedInputs: result.denominator.generatedInputs,
    },
    registry: {
      schemaVersion: result.registry.schemaVersion,
      recordCount: result.registry.records.length,
      records: result.registry.records.map((record) => ({
        toolId: record.toolId,
        toolClass: record.toolClass,
        owner: record.owner,
        commandId: record.commandId,
        pathCount: record.paths.length,
        graphId: record.graphId,
        testCommand: record.testCommand,
        privacyClass: record.privacyClass,
        safetyMode: record.safetyMode,
        retirementCondition: record.retirementCondition,
        followUpChange: record.followUpChange,
      })),
    },
    receipt: buildCommandReceipt({
      commandId: 'toolchain:boundary-check',
      sourceRevision: result.denominator.sourceRevision,
      sourceTree: result.denominator.sourceTree,
      inputDigest: result.denominator.digest,
      outputDigest: digestJson(result.registry.records.map((record) => record.toolId)),
      validatorVersion: TOOLCHAIN_BOUNDARY_SCHEMA_VERSION,
      exitStatus: result.ok ? 0 : 1,
      graphId: 'tools',
      privacyClass: 'none',
      safetyMode: 'read-only',
    }),
    preexistingPathReads: result.preexistingPathReads,
    failures: result.failures,
  };
  writeFileSync(join(outDir, 'denominator.json'), `${JSON.stringify(payload, null, 2)}\n`);
}

if (!result.ok) {
  for (const failure of result.failures.slice(0, 50)) {
    process.stderr.write(`${failure.code}: ${failure.message}${failure.path ? ` (${failure.path})` : ''}\n`);
  }
  if (result.failures.length > 50) {
    process.stderr.write(`... ${result.failures.length - 50} more failures\n`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write(`toolchain-boundary:ok records=${result.registry.records.length} entries=${result.denominator.totalCount}\n`);
}

