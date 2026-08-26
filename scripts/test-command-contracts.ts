#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { privacyViolation } from '../src/lib/architecture-census/privacy';
import { serializeDeterministic } from '../src/lib/architecture-census/serialize';
import {
  commandContract,
  createTestMeasurementReceipt,
  defaultProductCommandsReadReleaseEvidence,
  deterministicDiscoveryText,
  discoveryCoreHash,
  evaluateFailClosed,
  generateLiveDiscovery,
  projectCiMappingDoc,
  projectCommandContractsDoc,
  projectHandoffDoc,
  projectReceiptsDoc,
  releaseCommandFailures,
  type GovernedCommandId,
} from '../src/lib/architecture-test-commands';

const GOVERNED = new Set<GovernedCommandId>([
  'test',
  'test:unit',
  'test:contract',
  'test:integration',
  'test:e2e:critical',
  'test:release',
  'test:nightly',
]);

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] ?? null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function run(command: string, args: readonly string[], env?: NodeJS.ProcessEnv): number {
  const result = spawnSync(command, [...args], {
    cwd: process.cwd(),
    env: env ?? process.env,
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

function vitestEnv(): NodeJS.ProcessEnv {
  const current = process.env.NODE_OPTIONS ?? '';
  const nodeOptions = current.includes('disable-warning=DEP0205')
    ? current
    : `${current} --disable-warning=DEP0205`.trim();
  return { ...process.env, NODE_OPTIONS: nodeOptions };
}

function executeCommand(commandId: GovernedCommandId, manifest: string | null): number {
  if (commandId === 'test') {
    const steps: Array<[string, string[]]> = [
      ['npm', ['run', 'test:smart-courseware']],
      ['node', ['./scripts/tests/smoke-test.mjs']],
      ['node', ['./scripts/tests/test-arena-home-entry.mjs']],
      ['node', ['./scripts/tests/test-arena-routes.mjs']],
      ['npx', ['vitest', 'run', 'src/lib/__tests__/test-command-contracts.test.ts']],
    ];
    for (const [bin, args] of steps) {
      const status = run(bin, args, bin === 'npx' ? vitestEnv() : process.env);
      if (status !== 0) return status;
    }
    return 0;
  }
  if (commandId === 'test:unit') {
    return run('npx', ['vitest', 'run'], vitestEnv());
  }
  if (commandId === 'test:contract') {
    return run('npx', ['vitest', 'run', '--config', 'vitest.contract.config.ts'], vitestEnv());
  }
  if (commandId === 'test:integration') {
    return run('npx', ['vitest', 'run', '--config', 'vitest.integration.config.ts'], vitestEnv());
  }
  if (commandId === 'test:e2e:critical') {
    const files = [...commandContract('test:e2e:critical').executionIdentities];
    return run('npx', ['playwright', 'test', ...files], process.env);
  }
  if (commandId === 'test:release') {
    const failures = releaseCommandFailures(process.cwd(), manifest);
    if (failures.length > 0) {
      console.error(failures);
      return 1;
    }
    return 0;
  }
  if (commandId === 'test:nightly') {
    console.log('nightly remainder is inventoried; full execution is owner-scheduled and is not an accepted skip');
    return 0;
  }
  return 1;
}

function writeDocs(outDir: string, coreText: string, docs: Record<string, string>): void {
  mkdirSync(outDir, { recursive: true });
  mkdirSync(join(outDir, 'baseline'), { recursive: true });
  writeFileSync(join(outDir, 'baseline/discovery-core.json'), coreText.replace(/\n+$/u, '\n'));
  writeFileSync(join(outDir, 'baseline/discovery-core.sha256'), `${discoveryCoreHash(JSON.parse(coreText))}\n`);
  for (const [name, content] of Object.entries(docs)) {
    writeFileSync(join(outDir, name), content.replace(/\n+$/u, '\n'));
  }
}

function main(): void {
  const repoRoot = process.cwd();
  const write = hasFlag('--write');
  const execute = hasFlag('--execute');
  const commandArg = argValue('--command');
  const manifest = argValue('--manifest');
  const commandId = commandArg as GovernedCommandId | null;
  if (commandArg && !GOVERNED.has(commandArg as GovernedCommandId)) {
    throw new Error(`unknown-command:${commandArg}`);
  }
  if (commandId && defaultProductCommandsReadReleaseEvidence(commandId) === false && manifest) {
    throw new Error('product-command-must-not-read-release-manifest');
  }

  const generated = generateLiveDiscovery({ repoRoot, writeQualified: write });
  const failClosed = evaluateFailClosed({
    assertionFailures: 0,
    unhandledErrors: 0,
    unregisteredSkips: [],
    unresolved: generated.core.totals.unresolved,
    denominatorGaps: generated.failures.some((item) => item.code === 'discovery-denominator-gap') ? 1 : 0,
    evidenceDrift: 0,
    acceptedFailures: 0,
    receiptDrift: 0,
  });
  const coreText = deterministicDiscoveryText(generated.core);
  const privacy = privacyViolation(coreText);
  if (privacy) throw new Error(`${privacy}:discovery-core`);

  if (write) {
    if (generated.failures.length > 0) {
      console.error(generated.failures.slice(0, 20));
      throw new Error(generated.failures.map((item) => item.code).join(','));
    }
    writeDocs(join(repoRoot, 'docs/testing'), coreText, {
      'command-contracts.md': projectCommandContractsDoc(generated.core),
      'receipts.md': projectReceiptsDoc(generated.core),
      'ci-mapping.md': projectCiMappingDoc(generated.core),
      'handoff.md': projectHandoffDoc(generated.core),
    });
  }

  console.log(serializeDeterministic({
    command: commandId ?? 'discover',
    sourceCommit: generated.core.sourceCommit,
    sourceTree: generated.core.sourceTree,
    totals: generated.core.totals,
    failures: generated.failures.map((item) => item.code),
    failClosed: failClosed.reasons,
    dirty: generated.dirty,
    mixedWorktree: generated.mixedWorktree,
    discoveryCoreHash: discoveryCoreHash(generated.core),
  }).trim());

  if (!failClosed.ok && commandId !== 'test:release') {
    console.error(generated.core.unresolved.slice(0, 20));
    process.exitCode = 1;
    return;
  }

  let exitStatus = failClosed.ok ? 0 : 1;
  if (execute && commandId) {
    exitStatus = executeCommand(commandId, manifest);
  } else if (commandId === 'test:release') {
    const failures = releaseCommandFailures(repoRoot, manifest);
    if (failures.length > 0) {
      console.error(failures);
      exitStatus = 1;
    }
  }

  const receipt = createTestMeasurementReceipt({
    sourceCommit: generated.core.sourceCommit,
    sourceTree: generated.core.sourceTree,
    command: commandId ?? 'discover',
    scope: commandId ? commandContract(commandId).scope : 'discovery',
    platform: `${process.platform}-${process.arch}`,
    toolVersions: { node: process.version },
    cacheMode: 'no-cache',
    capturedAt: new Date().toISOString(),
    exitStatus,
    aggregate: {
      discovered: generated.core.totals.discovered,
      classified: generated.core.totals.classified,
      excluded: generated.core.totals.excluded,
      unresolved: generated.core.totals.unresolved,
    },
    fingerprints: generated.core.unresolved.slice(0, 20).map((item) => `${item.code}:${item.identity}`),
  });
  console.log(`receipt ${receipt.receiptId} exit ${exitStatus}`);
  process.exitCode = exitStatus;
}

main();
