#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
  parseUnhandledSidecar,
  parseVitestJson,
  projectCiMappingDoc,
  projectCommandContractsDoc,
  projectHandoffDoc,
  projectReceiptsDoc,
  releaseCommandFailures,
  type GovernedCommandId,
  type VitestExecutionSummary,
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

function emptySummary(status: number): VitestExecutionSummary & { status: number } {
  return { status, passed: 0, failed: status === 0 ? 0 : 1, skipped: [], unhandledErrors: 0 };
}

function runVitest(extraArgs: readonly string[]): VitestExecutionSummary & { status: number } {
  const dir = mkdtempSync(join(tmpdir(), 'test-command-contracts-'));
  const outputFile = join(dir, 'vitest.json');
  const sidecarFile = join(dir, 'unhandled.json');
  try {
    const status = run('npx', [
      'vitest',
      'run',
      ...extraArgs,
      '--reporter=json',
      `--outputFile=${outputFile}`,
      '--reporter=./src/lib/architecture-census/vitest-unhandled-reporter.ts',
    ], {
      ...vitestEnv(),
      ARCHITECTURE_CENSUS_VITEST_SIDECAR: sidecarFile,
    });
    let summary: VitestExecutionSummary = { passed: 0, failed: status === 0 ? 0 : 1, skipped: [], unhandledErrors: 0 };
    try {
      summary = parseVitestJson(readFileSync(outputFile, 'utf8'), process.cwd());
    } catch {
      summary = { ...summary, failed: Math.max(summary.failed, 1) };
    }
    try {
      summary = { ...summary, unhandledErrors: parseUnhandledSidecar(readFileSync(sidecarFile, 'utf8')) };
    } catch {
      // Sidecar is absent when the reporter did not start; keep fail-visible via status.
    }
    return { ...summary, status };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function executeCommand(commandId: GovernedCommandId, manifest: string | null): VitestExecutionSummary & { status: number } {
  if (commandId === 'test') {
    const prelude: Array<[string, string[]]> = [
      ['npm', ['run', 'test:smart-courseware']],
      ['node', ['./scripts/tests/smoke-test.mjs']],
      ['node', ['./scripts/tests/test-arena-home-entry.mjs']],
      ['node', ['./scripts/tests/test-arena-routes.mjs']],
    ];
    for (const [bin, args] of prelude) {
      const status = run(bin, args);
      if (status !== 0) return emptySummary(status);
    }
    return runVitest(['src/lib/__tests__/test-command-contracts.test.ts']);
  }
  if (commandId === 'test:unit') return runVitest([]);
  if (commandId === 'test:contract') return runVitest(['--config', 'vitest.contract.config.ts']);
  if (commandId === 'test:integration') return runVitest(['--config', 'vitest.integration.config.ts']);
  if (commandId === 'test:e2e:critical') {
    const files = [...commandContract('test:e2e:critical').executionIdentities];
    return emptySummary(run('npx', ['playwright', 'test', ...files]));
  }
  if (commandId === 'test:release') {
    const failures = releaseCommandFailures(process.cwd(), manifest);
    if (failures.length > 0) {
      console.error(failures);
      return emptySummary(1);
    }
    return emptySummary(0);
  }
  if (commandId === 'test:nightly') {
    console.error('nightly-execution-not-run');
    return emptySummary(1);
  }
  return emptySummary(1);
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
  let execution: VitestExecutionSummary & { status: number } = emptySummary(0);
  const discoveryClosed = evaluateFailClosed({
    assertionFailures: 0,
    unhandledErrors: 0,
    unregisteredSkips: [],
    unresolved: generated.core.totals.unresolved,
    denominatorGaps: generated.failures.some((item) => item.code === 'discovery-denominator-gap') ? 1 : 0,
    evidenceDrift: 0,
    acceptedFailures: 0,
    receiptDrift: 0,
    dirtyWorktree: generated.dirty ? 1 : 0,
    mixedWorktree: generated.mixedWorktree ? 1 : 0,
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
    failClosed: discoveryClosed.reasons,
    dirty: generated.dirty,
    mixedWorktree: generated.mixedWorktree,
    discoveryCoreHash: discoveryCoreHash(generated.core),
  }).trim());

  if (!discoveryClosed.ok) {
    console.error(generated.core.unresolved.slice(0, 20));
    console.error(generated.failures.slice(0, 20));
    process.exitCode = 1;
    return;
  }

  let exitStatus = discoveryClosed.ok ? 0 : 1;
  if (commandId === 'test:nightly') {
    execution = executeCommand(commandId, manifest);
    exitStatus = 1;
  } else if (execute && commandId) {
    execution = executeCommand(commandId, manifest);
    exitStatus = execution.status;
  } else if (commandId === 'test:release') {
    execution = executeCommand(commandId, manifest);
    exitStatus = execution.status;
  }

  const failClosed = evaluateFailClosed({
    assertionFailures: execution.failed,
    unhandledErrors: execution.unhandledErrors,
    unregisteredSkips: execution.skipped,
    unresolved: generated.core.totals.unresolved,
    denominatorGaps: generated.failures.some((item) => item.code === 'discovery-denominator-gap') ? 1 : 0,
    evidenceDrift: commandId === 'test:release' && exitStatus !== 0 ? 1 : 0,
    acceptedFailures: 0,
    receiptDrift: 0,
    dirtyWorktree: generated.dirty ? 1 : 0,
    mixedWorktree: generated.mixedWorktree ? 1 : 0,
  });
  if (!failClosed.ok) exitStatus = 1;

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
      passed: execution.passed,
      failed: execution.failed,
      skipped: execution.skipped.length,
      unhandledErrors: execution.unhandledErrors,
      qualified: failClosed.ok && !generated.dirty && !generated.mixedWorktree ? 1 : 0,
    },
    fingerprints: [
      ...generated.core.unresolved.slice(0, 10).map((item) => `${item.code}:${item.identity}`),
      ...execution.skipped.slice(0, 10),
      ...failClosed.reasons,
    ],
  });
  console.log(`receipt ${receipt.receiptId} exit ${exitStatus}`);
  process.exitCode = exitStatus;
}

main();
