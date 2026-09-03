#!/usr/bin/env tsx
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { privacyViolation } from '../src/lib/architecture-census/privacy';
import { serializeDeterministic } from '../src/lib/architecture-census/serialize';
import {
  COMMAND_CONTRACTS,
  commandContract,
  compactPackageDigest,
  createTestMeasurementReceipt,
  createToolIdentity,
  defaultProductCommandsReadReleaseEvidence,
  deterministicDiscoveryText,
  discoverTests,
  discoveryCoreHash,
  entryBundleDigest,
  evaluateFailClosed,
  generateLiveDiscovery,
  investigateCurrentDenominator,
  listSubjectPaths,
  loadSuccessorSubject,
  REQUIRED_CHARTER,
  parseUnhandledSidecar,
  parseVitestJson,
  projectCiMappingDoc,
  projectCommandContractsDoc,
  projectCompactPackage,
  projectHandoffDoc,
  projectReceiptsDoc,
  readCheckoutState,
  releaseCommandFailures,
  type GovernedCommandId,
  type LaneExecutionInput,
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

const COMMAND_TIMEOUT_MS: Record<GovernedCommandId, number> = {
  test: 10 * 60 * 1000,
  'test:unit': 10 * 60 * 1000,
  'test:contract': 8 * 60 * 1000,
  'test:integration': 8 * 60 * 1000,
  'test:e2e:critical': 10 * 60 * 1000,
  'test:release': 2 * 60 * 1000,
  'test:nightly': 60 * 1000,
};

function run(command: string, args: readonly string[], env?: NodeJS.ProcessEnv, cwd = process.cwd(), timeoutMs?: number): number {
  const result = spawnSync(command, [...args], {
    cwd,
    env: env ?? process.env,
    stdio: 'inherit',
    timeout: timeoutMs,
  });
  if (result.error && (result.error as NodeJS.ErrnoException).code === 'ETIMEDOUT') return 124;
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
  return { status, passed: 0, failed: status === 0 ? 0 : 1, skipped: [], unhandledErrors: 0, failures: [] };
}

function runVitest(extraArgs: readonly string[], cwd = process.cwd(), timeoutMs?: number): VitestExecutionSummary & { status: number } {
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
    }, cwd, timeoutMs);
    let summary: VitestExecutionSummary = { passed: 0, failed: status === 0 ? 0 : 1, skipped: [], unhandledErrors: 0, failures: [] };
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

function executeCommand(
  commandId: GovernedCommandId,
  manifest: string | null,
  cwd = process.cwd(),
): VitestExecutionSummary & { status: number } {
  const timeoutMs = COMMAND_TIMEOUT_MS[commandId];
  if (commandId === 'test') {
    const prelude: Array<[string, string[]]> = [
      ['npm', ['run', 'test:smart-courseware']],
      ['node', ['./scripts/tests/smoke-test.mjs']],
      ['node', ['./scripts/tests/test-arena-home-entry.mjs']],
      ['node', ['./scripts/tests/test-arena-routes.mjs']],
    ];
    for (const [bin, args] of prelude) {
      const status = run(bin, args, process.env, cwd, timeoutMs);
      if (status !== 0) return emptySummary(status);
    }
    return runVitest(['src/lib/__tests__/test-command-contracts.test.ts'], cwd, timeoutMs);
  }
  if (commandId === 'test:unit') return runVitest([], cwd, timeoutMs);
  if (commandId === 'test:contract') return runVitest(['--config', 'vitest.contract.config.ts'], cwd, timeoutMs);
  if (commandId === 'test:integration') return runVitest(['--config', 'vitest.integration.config.ts'], cwd, timeoutMs);
  if (commandId === 'test:e2e:critical') {
    const files = [...commandContract('test:e2e:critical').executionIdentities];
    return emptySummary(run('npx', ['playwright', 'test', ...files], process.env, cwd, timeoutMs));
  }
  if (commandId === 'test:release') {
    const failures = releaseCommandFailures(cwd, manifest);
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

function loadEntryBundleDigest(repoRoot: string): string {
  const files: Record<string, string> = {};
  const dir = join(repoRoot, 'src/lib/architecture-test-commands');
  for (const name of readdirSync(dir).sort()) {
    if (!name.endsWith('.ts')) continue;
    const path = `src/lib/architecture-test-commands/${name}`;
    files[path] = readFileSync(join(repoRoot, path), 'utf8');
  }
  files['scripts/test-command-contracts.ts'] = readFileSync(join(repoRoot, 'scripts/test-command-contracts.ts'), 'utf8');
  return entryBundleDigest(files);
}

function ensureSubjectCheckout(repoRoot: string, sourceCommit: string, requested: string | null): string {
  const checkout = requested ?? join(tmpdir(), `act-1880-subject-${sourceCommit.slice(0, 12)}`);
  if (!existsSync(checkout)) {
    const added = spawnSync('git', ['worktree', 'add', '--detach', checkout, sourceCommit], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (added.status !== 0 && !existsSync(checkout)) {
      throw new Error(`subject-checkout-failed:${added.stderr || added.stdout}`);
    }
  }
  const modules = join(checkout, 'node_modules');
  if (!existsSync(modules) && existsSync(join(repoRoot, 'node_modules'))) {
    symlinkSync(join(repoRoot, 'node_modules'), modules);
  }
  return checkout;
}

function toLaneExecution(
  commandId: GovernedCommandId,
  summary: VitestExecutionSummary & { status: number },
  unavailable?: LaneExecutionInput['unavailable'],
): LaneExecutionInput {
  return {
    command: commandId,
    exitStatus: summary.status,
    passed: summary.passed,
    failed: summary.failed,
    skipped: summary.skipped,
    unhandledErrors: summary.unhandledErrors,
    failures: summary.failures.map((item) => ({
      testIdentity: item.testIdentity,
      failureStage: item.failureStage,
      errorClass: item.errorClass,
      errorSummary: item.errorSummary,
    })),
    capturedAt: new Date().toISOString(),
    platform: `${process.platform}-${process.arch}`,
    ...(unavailable ? { unavailable } : {}),
  };
}

function writeInvestigationHandoff(repoRoot: string, output: ReturnType<typeof investigateCurrentDenominator>): void {
  if (!output.compact) throw new Error('investigation-compact-missing');
  const outDir = join(repoRoot, 'openspec/changes/reconcile-current-clean-head-test-failure-denominator/handoff');
  mkdirSync(outDir, { recursive: true });
  const manifestText = serializeDeterministic(output.compact);
  writeFileSync(join(outDir, 'manifest.json'), manifestText);
  writeFileSync(join(outDir, 'lanes.md'), [
    '# Per-lane denominator',
    '',
    `- subject: \`${output.compact.subject.successorCaptureId}\``,
    `- sourceCommit: \`${output.compact.subject.sourceCommit}\``,
    `- toolCommit: \`${output.compact.tool.toolCommit}\``,
    `- defaultConclusion: \`${output.compact.defaultConclusion}\``,
    '',
    '| lane | command | status | passed | failed | skipped | unhandled | unresolved | default |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...output.compact.lanes.map((lane) => `| ${lane.lane} | \`${lane.command}\` | ${lane.status} | ${lane.passed} | ${lane.failed} | ${lane.skipped} | ${lane.unhandledErrors} | ${lane.unresolved} | ${lane.defaultMandatory ? 'yes' : 'no'} |`),
    '',
  ].join('\n'));
  writeFileSync(join(outDir, 'dispositions.md'), [
    '# Planned dispositions',
    '',
    'These records are investigation plans. This change does not execute FIX, DELETE, or QUARANTINE.',
    '',
    `| fingerprint | command | lane | disposition | owner | identity |`,
    `| --- | --- | --- | --- | --- | --- |`,
    ...output.compact.failureDispositionSummary.slice(0, 200).map((item) => `| \`${item.fingerprint.slice(0, 12)}\` | \`${item.command}\` | ${item.lane} | ${item.disposition}${item.subtype ? `/${item.subtype}` : ''} | ${item.owner} | ${item.testIdentity} |`),
    '',
    output.compact.failureDispositionSummary.length > 200
      ? `Truncated to 200 of ${output.compact.failureDispositionSummary.length} fingerprints. Full inventory is in manifest.json.\n`
      : '',
  ].join('\n'));
  writeFileSync(join(outDir, 'notes.md'), [
    '# Investigation notes',
    '',
    `- schemaVersion: \`${output.compact.schemaVersion}\``,
    `- packageDigest: \`${output.compact.packageDigest}\``,
    `- defaultConclusion: \`${output.compact.defaultConclusion}\``,
    `- compactDigestCheck: \`${compactPackageDigest(output.compact)}\``,
    `- deterministicProjection: see manifest.json; measurements are separate receipt identities`,
    '',
    'Follow-up FIX/DELETE/QUARANTINE execution is out of scope. Do not write this package into REQUIRED_BASELINE or any active selector.',
    '',
  ].join('\n'));
  const detailDir = join(repoRoot, 'artifacts/test-denominator', output.compact.subject.successorCaptureId);
  mkdirSync(detailDir, { recursive: true });
  writeFileSync(join(detailDir, 'result-cores.json'), serializeDeterministic(output.resultCores));
  writeFileSync(join(detailDir, 'measurement-receipts.json'), serializeDeterministic(output.measurementReceipts));
  const privacy = privacyViolation(projectCompactPackage(output.compact));
  if (privacy) throw new Error(`${privacy}:compact-package`);
}

function investigate(repoRoot: string): void {
  if (!hasFlag('--gate-verified')) {
    throw new Error('a-gate-unverified:pass --gate-verified only after live GitHub confirmation that #1876 is closed, status:archived, and native blockedBy is resolved');
  }
  const loaded = loadSuccessorSubject(repoRoot);
  if (loaded.failures.length > 0) {
    console.error(loaded.failures.slice(0, 20));
    throw new Error(loaded.failures.map((item) => item.code).join(','));
  }
  const checkout = readCheckoutState(repoRoot);
  if (checkout.dirty || checkout.mixedWorktree) {
    throw new Error(checkout.dirty ? 'dirty-worktree' : 'mixed-worktree');
  }
  const bundleDigest = loadEntryBundleDigest(repoRoot);
  const tool = createToolIdentity({
    toolCommit: checkout.commit,
    toolTree: checkout.tree,
    subject: loaded.subject,
    entryBundleDigest: bundleDigest,
  });
  const listed = listSubjectPaths(repoRoot, loaded.subject);
  if (listed.failures.length > 0) {
    throw new Error(listed.failures.map((item) => item.code).join(','));
  }
  const subjectCore = discoverTests({
    paths: listed.paths,
    sourceCommit: loaded.subject.sourceCommit,
    sourceTree: loaded.subject.sourceTree,
    charterSha256: REQUIRED_CHARTER.sha256,
  });
  const subjectCheckout = ensureSubjectCheckout(repoRoot, loaded.subject.sourceCommit, argValue('--subject-checkout'));
  const manifest = argValue('--manifest');
  const executions: LaneExecutionInput[] = COMMAND_CONTRACTS.map((command) => {
    if (command.id === 'test:nightly' && !hasFlag('--execute-nightly')) {
      return toLaneExecution(command.id, emptySummary(1), {
        responseClass: 'nightly-not-run',
        resolutionCondition: 'execute-the-registered-nightly-lane',
        owner: 'platform',
      });
    }
    const summary = executeCommand(command.id, manifest, subjectCheckout);
    if (summary.status === 124) {
      return toLaneExecution(command.id, summary, {
        responseClass: 'timeout',
        resolutionCondition: `rerun-${command.id}-when-the-external-or-runtime-prerequisite-is-available`,
        owner: 'platform',
      });
    }
    return toLaneExecution(command.id, summary);
  });
  const output = investigateCurrentDenominator({
    repoRoot,
    gate: { issueClosed: true, statusArchived: true, blockedByResolved: true },
    tool,
    discovery: subjectCore,
    executions,
    firstIdentity: { subject: loaded.subject, tool },
  });
  if (hasFlag('--write')) writeInvestigationHandoff(repoRoot, output);
  console.log(serializeDeterministic({
    command: 'investigate',
    subject: loaded.subject,
    tool,
    defaultConclusion: output.compact?.defaultConclusion ?? 'blocked',
    lanes: output.compact?.lanes.map((lane) => ({ lane: lane.lane, status: lane.status, failed: lane.failed })) ?? [],
    failures: output.failures.map((item) => item.code),
    packageDigest: output.compact?.packageDigest ?? null,
    subjectCheckout,
  }).trim());
  process.exitCode = output.failures.length > 0 || output.compact?.defaultConclusion !== 'clean' ? 1 : 0;
}

function main(): void {
  const repoRoot = process.cwd();
  if (hasFlag('--investigate')) {
    investigate(repoRoot);
    return;
  }
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
