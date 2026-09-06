#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { generateCensusCore, loadGitSourceSnapshot } from '../src/lib/architecture-census';
import { serializeDeterministic, sha256Text } from '../src/lib/architecture-census/serialize';
import type { CensusCore } from '../src/lib/architecture-census/types';
import { REQUIRED_BASELINE } from '../src/lib/architecture-charter';
import {
  createAllowlist,
  createFitnessBudgetLedger,
  evaluateFitnessBudgets,
  fitnessBudgetLedgerHash,
  readGraphArtifacts,
  REQUIRED_FITNESS_BUDGET,
  serializeFitnessBudgetReport,
} from '../src/lib/architecture-fitness';
import type { FitnessAllowlist, FitnessBudgetFailure, FitnessBudgetLedger } from '../src/lib/architecture-fitness';

const BASELINE_CORE_PATH = 'docs/architecture/modular-monolith/baseline/census-core.json';
const ALLOWLIST_PATH = 'docs/architecture/dependency-allowlist.json';
const LEDGER_EXPORT_DIR = '.logs/architecture-fitness';
const LEDGER_PATH = `${LEDGER_EXPORT_DIR}/fitness-budget-ledger.json`;
const LEDGER_HASH_PATH = `${LEDGER_EXPORT_DIR}/fitness-budget-ledger.sha256`;
const FROZEN_ALLOWLIST_PATH = 'docs/architecture/fitness-budget-allowlist.json';
const FROZEN_ALLOWLIST_HASH_PATH = 'docs/architecture/fitness-budget-allowlist.sha256';
const FROZEN_GRAPH_ARTIFACT_ROOT = 'docs/architecture/typescript-graphs/frozen-receipts';

function writeAllowlist(repoRoot: string, allowlist: FitnessAllowlist): string {
  const serialized = serializeDeterministic(allowlist);
  writeFileSync(join(repoRoot, 'docs/architecture/dependency-allowlist.json'), serialized);
  writeFileSync(join(repoRoot, 'docs/architecture/dependency-allowlist.sha256'), `${sha256Text(serialized)}\n`);
  const summary = [
    '# Dependency allowlist',
    '',
    `- schemaVersion: \`${allowlist.schemaVersion}\``,
    `- baselineSourceCommit: \`${allowlist.baselineSourceCommit}\``,
    `- charterSha256: \`${allowlist.charterSha256}\``,
    `- entries: ${allowlist.entries.length}`,
    `- feature-to-app: ${allowlist.entries.filter((item) => item.kind === 'feature-to-app').length}`,
    `- deep-import: ${allowlist.entries.filter((item) => item.kind === 'deep-import').length}`,
    `- domain-core-infrastructure: ${allowlist.entries.filter((item) => item.kind === 'domain-core-infrastructure').length}`,
    `- scc: ${allowlist.entries.filter((item) => item.kind === 'scc').length}`,
    `- lib-file: ${allowlist.entries.filter((item) => item.kind === 'lib-file').length}`,
    '',
    'Existing debt remains staged. Entries and forbidden edges may only decrease. This check does not activate production or claim repository-wide migration.',
    '',
    'First deletion slice: `decouple-teacher-diagnosis-route-contract`.',
    '',
  ].join('\n');
  writeFileSync(join(repoRoot, 'docs/architecture/dependency-allowlist.md'), summary);
  const stamp = `\nFitness allowlist identity: \`${sha256Text(serialized)}\`. Remaining staged entries: ${allowlist.entries.length}.\n`;
  for (const name of ['dependency-rules.md', 'deprecation-ledger.md']) {
    const path = join(repoRoot, 'docs/architecture', name);
    const current = readFileSync(path, 'utf8');
    const withoutStamp = current.replace(/\nFitness allowlist identity:.*\n?/gu, '\n');
    writeFileSync(path, `${withoutStamp.replace(/\n+$/u, '\n')}${stamp}`);
  }
  return sha256Text(serialized);
}

function writeBudgetLedger(repoRoot: string, ledger: FitnessBudgetLedger): string {
  const serialized = serializeDeterministic(ledger);
  mkdirSync(join(repoRoot, LEDGER_EXPORT_DIR), { recursive: true });
  const path = join(repoRoot, LEDGER_PATH);
  writeFileSync(path, serialized);
  const hash = sha256Text(serialized);
  writeFileSync(join(repoRoot, LEDGER_HASH_PATH), `${hash}\n`);
  return hash;
}

interface FrozenLedgerInputs {
  readonly ledger: FitnessBudgetLedger;
  readonly frozenAllowlist: FitnessAllowlist;
  readonly frozenGraphArtifacts: ReturnType<typeof readGraphArtifacts>;
}

function loadFrozenLedgerInputs(repoRoot: string, charterSha256: string): FrozenLedgerInputs {
  const frozen = readJson<CensusCore>(repoRoot, BASELINE_CORE_PATH);
  const frozenAllowlist = readJson<FitnessAllowlist>(repoRoot, FROZEN_ALLOWLIST_PATH);
  if (frozen.captureIdentity.sourceCommit !== REQUIRED_BASELINE.sourceCommit) throw new Error('baseline-commit-drift');
  const frozenGraphArtifacts = readGraphArtifacts(repoRoot, join(repoRoot, FROZEN_GRAPH_ARTIFACT_ROOT));
  if (frozenGraphArtifacts.failures.length > 0) throw new Error('frozen-graph-artifact-invalid');
  if (frozenGraphArtifacts.receipts.some((receipt) => (
    receipt.sourceCommit !== frozen.captureIdentity.sourceCommit
    || receipt.sourceTree !== frozen.captureIdentity.sourceTree
  ))) throw new Error('frozen-graph-receipt-baseline-drift');
  const ledger = createFitnessBudgetLedger({
    baselineCore: frozen,
    allowlist: frozenAllowlist,
    baselineGraphReceipts: frozenGraphArtifacts.receipts,
    dependencyAllowlistIdentity: sha256Text(serializeDeterministic(frozenAllowlist)),
    charterIdentity: charterSha256,
  });
  return { ledger, frozenAllowlist, frozenGraphArtifacts };
}

function readJson<T>(repoRoot: string, path: string): T {
  return JSON.parse(readFileSync(join(repoRoot, path), 'utf8')) as T;
}

function main(): void {
  const repoRoot = process.cwd();
  const write = process.argv.includes('--write-allowlist');
  const writeLedger = process.argv.includes('--write-ledger');
  const charterSha256 = readFileSync(join(repoRoot, 'docs/architecture/modular-monolith-charter.sha256'), 'utf8').trim();
  if (write) {
    const frozen = readJson<CensusCore>(repoRoot, BASELINE_CORE_PATH);
    if (frozen.captureIdentity.sourceCommit !== REQUIRED_BASELINE.sourceCommit) {
      throw new Error('baseline-commit-drift');
    }
    const snapshot = loadGitSourceSnapshot(repoRoot);
    const frozenPaths = new Set(frozen.observations.flatMap((item) => [
      item.identity,
      ...item.evidence,
      String(item.attributes.from ?? ''),
      String(item.attributes.to ?? ''),
    ]));
    const files = snapshot.files.filter((file) => frozenPaths.has(file.path));
    const allowlist = createAllowlist(frozen, charterSha256, [
      ...files,
      ...snapshot.files.filter((file) => file.path.startsWith('src/lib/') && !file.path.startsWith('src/lib/architecture-')),
    ]);
    const hash = writeAllowlist(repoRoot, allowlist);
    console.log(`wrote allowlist ${allowlist.entries.length} ${hash}`);
    return;
  }
  if (writeLedger) {
    const { ledger } = loadFrozenLedgerInputs(repoRoot, charterSha256);
    const hash = writeBudgetLedger(repoRoot, ledger);
    console.log(`wrote fitness budget ledger ${ledger.budgets.length} ${hash} -> ${LEDGER_PATH}`);
    return;
  }
  const snapshot = loadGitSourceSnapshot(repoRoot);
  const { core, failures: censusFailures } = generateCensusCore(snapshot);
  const baselineCore = readJson<CensusCore>(repoRoot, BASELINE_CORE_PATH);
  const allowlist = readJson<FitnessAllowlist>(repoRoot, ALLOWLIST_PATH);
  const { ledger, frozenAllowlist, frozenGraphArtifacts } = loadFrozenLedgerInputs(repoRoot, charterSha256);
  const inputFailures: FitnessBudgetFailure[] = [];
  const frozenAllowlistHashPath = join(repoRoot, FROZEN_ALLOWLIST_HASH_PATH);
  const frozenAllowlistHash = existsSync(frozenAllowlistHashPath) ? readFileSync(frozenAllowlistHashPath, 'utf8').trim() : '';
  const actualFrozenHash = sha256Text(serializeDeterministic(frozenAllowlist));
  if (!frozenAllowlistHash) inputFailures.push({ code: 'frozen-allowlist-hash-missing', identity: FROZEN_ALLOWLIST_HASH_PATH });
  if (actualFrozenHash !== REQUIRED_FITNESS_BUDGET.allowlistSha256 || frozenAllowlistHash && frozenAllowlistHash !== REQUIRED_FITNESS_BUDGET.allowlistSha256) {
    inputFailures.push({ code: 'frozen-allowlist-hash-drift', identity: FROZEN_ALLOWLIST_PATH });
  }
  if (fitnessBudgetLedgerHash(ledger) !== REQUIRED_FITNESS_BUDGET.ledgerSha256) {
    inputFailures.push({ code: 'ledger-pin-drift', identity: 'generate-fitness-budget-ledger' });
  }
  const graphArtifacts = readGraphArtifacts(repoRoot);
  const receipts = graphArtifacts.receipts.filter((receipt) => (
    receipt.sourceCommit === snapshot.identity.sourceCommit
    && receipt.sourceTree === snapshot.identity.sourceTree
  ));
  const manifests = graphArtifacts.manifests.filter((manifest) => (
    manifest.sourceCommit === snapshot.identity.sourceCommit
    && manifest.sourceTree === snapshot.identity.sourceTree
  ));
  const report = evaluateFitnessBudgets({
    baselineCore,
    baselineCoreHash: REQUIRED_BASELINE.censusCoreSha256,
    currentCore: core,
    currentFiles: snapshot.files,
    sourceState: {
      dirty: snapshot.dirty,
      mixedWorktree: snapshot.mixedWorktree,
      detachedUnresolved: snapshot.detachedUnresolved,
    },
    allowlist,
    baselineAllowlist: frozenAllowlist,
    ledger,
    graphReceipts: receipts,
    graphManifests: manifests,
    baselineGraphReceipts: frozenGraphArtifacts.receipts,
    graphArtifactFailures: [
      ...graphArtifacts.failures,
      ...frozenGraphArtifacts.failures,
      ...inputFailures,
      ...censusFailures.map((item) => ({ code: item.code, identity: item.identity })),
    ],
    requireGraphInputs: true,
  });
  if (process.argv.includes('--json')) {
    console.log(serializeFitnessBudgetReport(report));
  } else {
    console.log(JSON.stringify({
      schemaVersion: report.schemaVersion,
      status: report.status,
      ok: report.ok,
      baselineIdentity: report.baselineIdentity,
      sourceCommit: report.sourceCommit,
      sourceTree: report.sourceTree,
      summary: report.summary,
      failureCount: report.failures.length,
      failures: report.failures.slice(0, 20),
    }));
  }
  if (!report.ok) process.exitCode = 1;
}

main();
