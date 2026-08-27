import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readGitIdentity } from '../typescript-graphs/contracts';
import { readGraphArtifacts } from '../../src/lib/architecture-fitness';
import { isMixedWorktree } from '../../src/lib/architecture-census/identity';
import {
  DEFAULT_QUALITY_GATE_REGISTRY,
  qualityCommand,
  validatePackageCommandAuthority,
  validateQualityGateRegistry,
  type QualityCommandId,
  type QualityGateRegistry,
  type QualityLayerId,
  type RequiredQualityCheck,
} from './registry';
import { observeImpactDenominators, selectPrImpact, type ImpactSelection } from './impact';
import {
  createLayerReceipt,
  validateTypecheckReceipts,
  type CheckExecutionResult,
  type LayerReceipt,
} from './receipts';

export interface RunLayerOptions {
  readonly repoRoot: string;
  readonly layer: QualityLayerId;
  readonly registry?: QualityGateRegistry;
  readonly changedPaths?: readonly string[];
  readonly execute?: boolean;
  readonly workflowRunId?: string | null;
  readonly capturedAt?: string;
}

export interface GateRunResult {
  readonly receipt: LayerReceipt;
  readonly impact: ImpactSelection | null;
  readonly failures: readonly string[];
}

function changedPathsFromGit(repoRoot: string): string[] {
  const baseRef = process.env.GITHUB_BASE_REF;
  const ranges = baseRef ? [`origin/${baseRef}...HEAD`, `${baseRef}...HEAD`] : ['HEAD^...HEAD'];
  for (const range of ranges) {
    try {
      return execFileSync('git', ['diff', '--name-only', range], { cwd: repoRoot, encoding: 'utf8' })
        .split(/\r?\n/u)
        .map((path) => path.trim())
        .filter(Boolean);
    } catch {
      // A shallow or synthetic checkout may not have the first range. Try the next safe range.
    }
  }
  try {
    return execFileSync('git', ['diff', '--name-only'], { cwd: repoRoot, encoding: 'utf8' })
      .split(/\r?\n/u)
      .map((path) => path.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function runCommand(repoRoot: string, commandId: QualityCommandId, execute: boolean, layer: QualityLayerId): CheckExecutionResult {
  if (!execute) {
    return {
      checkId: '',
      status: 'skipped',
      commandIds: [commandId],
      exitStatus: null,
      receiptIds: [],
      failureCodes: ['execution-not-requested'],
      unhandledErrors: 0,
    };
  }
  const command = qualityCommand(commandId);
  const extraArgs: string[] = [];
  const evidenceIds: string[] = [];
  if (commandId === 'test:release') {
    const relativeManifest = process.env.QUALITY_GATE_RELEASE_MANIFEST ?? 'docs/testing/release-qualification-manifest.json';
    const manifest = relativeManifest.startsWith('/') ? relativeManifest : join(repoRoot, relativeManifest);
    if (!existsSync(manifest) || relativeManifest.startsWith('/') || relativeManifest.includes(':\\')) {
      return {
        checkId: '',
        status: 'failed',
        commandIds: [commandId],
        exitStatus: 1,
        receiptIds: [],
        failureCodes: [relativeManifest.startsWith('/') || relativeManifest.includes(':\\')
          ? 'privacy-unsafe-required-input'
          : 'missing-required-input:release-qualification-manifest'],
        unhandledErrors: 0,
      };
    }
    extraArgs.push('--', '--manifest', relativeManifest);
    evidenceIds.push(relativeManifest);
  }
  if (commandId === 'test:runtime-production-readyz') {
    const relativeObservation = process.env.QUALITY_GATE_READYZ_OBSERVATION ?? 'docs/architecture/quality-gates/post-deploy-readyz-observation.json';
    const observation = relativeObservation.startsWith('/') ? relativeObservation : join(repoRoot, relativeObservation);
    if (!existsSync(observation) || relativeObservation.startsWith('/') || relativeObservation.includes(':\\')) {
      return {
        checkId: '',
        status: 'failed',
        commandIds: [commandId],
        exitStatus: 1,
        receiptIds: [],
        failureCodes: [relativeObservation.startsWith('/') || relativeObservation.includes(':\\')
          ? 'privacy-unsafe-required-input'
          : 'missing-required-input:post-deploy-readyz-observation'],
        unhandledErrors: 0,
      };
    }
    try {
      const parsed = JSON.parse(readFileSync(observation, 'utf8')) as {
        sourceCommit?: string;
        sourceTree?: string;
        status?: string;
        endpoint?: string;
        capturedAt?: string;
      };
      const identity = readGitIdentity(repoRoot);
      const valid = parsed.sourceCommit === identity.sourceCommit
        && parsed.sourceTree === identity.sourceTree
        && parsed.status === 'passed'
        && parsed.endpoint === '/api/readyz'
        && typeof parsed.capturedAt === 'string'
        && parsed.capturedAt.length > 0;
      if (!valid) {
        return {
          checkId: '',
          status: 'failed',
          commandIds: [commandId],
          exitStatus: 1,
          receiptIds: [relativeObservation],
          failureCodes: ['stale-required-input:post-deploy-readyz-observation'],
          unhandledErrors: 0,
        };
      }
    } catch {
      return {
        checkId: '',
        status: 'failed',
        commandIds: [commandId],
        exitStatus: 1,
        receiptIds: [relativeObservation],
        failureCodes: ['invalid-required-input:post-deploy-readyz-observation'],
        unhandledErrors: 0,
      };
    }
    return {
      checkId: '',
      status: 'passed',
      commandIds: [commandId],
      exitStatus: 0,
      receiptIds: [relativeObservation],
      failureCodes: [],
      unhandledErrors: 0,
    };
  }
  const result = spawnSync('npm', ['run', command.npmScript, ...extraArgs], {
    cwd: repoRoot,
    env: { ...process.env, QUALITY_GATE_LAYER: layer },
    stdio: 'inherit',
  });
  const exitStatus = result.status ?? 1;
  return {
    checkId: '',
    status: exitStatus === 0 ? 'passed' : 'failed',
    commandIds: [commandId],
    exitStatus,
    receiptIds: evidenceIds,
    failureCodes: exitStatus === 0 ? [] : [`command-exit-${exitStatus}`],
    unhandledErrors: 0,
  };
}

function checkResult(repoRoot: string, check: RequiredQualityCheck, execute: boolean, layer: QualityLayerId): CheckExecutionResult {
  const results = check.commandIds.map((commandId) => runCommand(repoRoot, commandId, execute, layer));
  const failures = results.flatMap((result) => result.failureCodes);
  const status = results.some((result) => result.status === 'skipped')
    ? 'skipped'
    : results.some((result) => result.status !== 'passed') ? 'failed' : 'passed';
  const exitStatuses = results.map((result) => result.exitStatus).filter((status): status is number => status !== null);
  return {
    checkId: check.checkId,
    status,
    commandIds: check.commandIds,
    exitStatus: exitStatuses.some((status) => status !== 0) ? exitStatuses.find((status) => status !== 0) ?? 1 : execute ? 0 : null,
    receiptIds: results.flatMap((result) => result.receiptIds),
    failureCodes: [...new Set(failures)].sort(),
    unhandledErrors: results.reduce((total, result) => total + result.unhandledErrors, 0),
  };
}

function withTypecheckReceiptEvidence(
  repoRoot: string,
  results: readonly CheckExecutionResult[],
  sourceCommit: string,
  sourceTree: string,
): CheckExecutionResult[] {
  const artifacts = readGraphArtifacts(repoRoot);
  return results.map((result) => {
    const graphCommand = result.commandIds.find((commandId) => commandId.startsWith('typecheck:'));
    if (!graphCommand) return result;
    const graph = graphCommand.slice('typecheck:'.length) as 'web' | 'worker' | 'tools' | 'test';
    const failures = validateTypecheckReceipts(artifacts.receipts, {
      sourceCommit,
      sourceTree,
      requiredGraphs: [graph],
    });
    if (failures.length === 0) return result;
    return {
      ...result,
      status: 'failed' as const,
      failureCodes: [...new Set([...result.failureCodes, ...failures.map((failure) => failure.code)])].sort(),
    };
  });
}

function mainReleaseReceiptFailures(repoRoot: string, sourceCommit: string, sourceTree: string): string[] {
  const artifacts = readGraphArtifacts(repoRoot);
  return validateTypecheckReceipts(artifacts.receipts, { sourceCommit, sourceTree }).map((failure) => `${failure.code}:${failure.identity}`);
}

function selectedChecks(layer: QualityLayerId, registry: QualityGateRegistry, impact: ImpactSelection | null): RequiredQualityCheck[] {
  const ids = new Set(impact?.requiredCheckIds ?? registry.checks.filter((item) => item.layer === layer && item.required).map((item) => item.checkId));
  return registry.checks.filter((item) => item.layer === layer && ids.has(item.checkId)).sort((left, right) => left.checkId.localeCompare(right.checkId));
}

export function runQualityLayer(options: RunLayerOptions): GateRunResult {
  const registry = options.registry ?? DEFAULT_QUALITY_GATE_REGISTRY;
  const registryFailures = [
    ...validateQualityGateRegistry(registry),
    ...validatePackageCommandAuthority(options.repoRoot, registry),
  ];
  if (registryFailures.length > 0) {
    throw new Error(registryFailures.map((failure) => `${failure.code}:${failure.identity}`).join(';'));
  }
  const identity = readGitIdentity(options.repoRoot);
  const impact = options.layer === 'pr'
    ? selectPrImpact({
      changedPaths: options.changedPaths ?? changedPathsFromGit(options.repoRoot),
      denominator: observeImpactDenominators(options.repoRoot),
      registry,
    })
    : null;
  const checks = selectedChecks(options.layer, registry, impact);
  const execute = options.execute !== false;
  let results = checks.map((check) => checkResult(options.repoRoot, check, execute, options.layer));
  results = withTypecheckReceiptEvidence(options.repoRoot, results, identity.sourceCommit, identity.sourceTree);
  const additionalFailures = options.layer === 'main-release'
    ? mainReleaseReceiptFailures(options.repoRoot, identity.sourceCommit, identity.sourceTree)
    : [];
  if (additionalFailures.length > 0) {
    results = results.map((result) => result.checkId === 'main-release/typecheck-tools' || result.checkId === 'main-release/typecheck-test'
      ? { ...result, status: 'failed' as const, failureCodes: [...new Set([...result.failureCodes, ...additionalFailures])].sort() }
      : result);
  }
  const failureDispositions = results
    .filter((result) => result.status !== 'passed' || result.failureCodes.length > 0)
    .flatMap((result) => result.failureCodes.map((code) => ({ checkId: result.checkId, code, detail: 'required check did not produce a passing governed result' })));
  const receipt = createLayerReceipt({
    layer: options.layer,
    sourceCommit: identity.sourceCommit,
    sourceTree: identity.sourceTree,
    dirty: identity.dirty,
    mixedWorktree: isMixedWorktree(options.repoRoot),
    workflowRunId: options.workflowRunId ?? process.env.GITHUB_RUN_ID ?? null,
    scope: impact ? `${registry.layers.find((item) => item.id === options.layer)?.scope ?? options.layer}:${impact.scope}` : registry.layers.find((item) => item.id === options.layer)?.scope ?? options.layer,
    requiredInputs: [...new Set(checks.flatMap((check) => check.requiredInputs))].sort(),
    checks,
    results,
    failureDispositions,
    capturedAt: options.capturedAt ?? new Date().toISOString(),
  });
  return {
    receipt,
    impact,
    failures: [...new Set([...additionalFailures, ...failureDispositions.map((failure) => `${failure.code}:${failure.checkId}`)])].sort(),
  };
}

export function writeLayerReceipt(repoRoot: string, receipt: LayerReceipt): string {
  const directory = join(repoRoot, '.logs/quality-gates/receipts');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${receipt.receiptId}.json`);
  const text = `${JSON.stringify(receipt)}\n`;
  try {
    writeFileSync(path, text, { flag: 'wx' });
  } catch {
    if (readFileSync(path, 'utf8') !== text) throw new Error(`quality-gate-receipt-conflict:${receipt.receiptId}`);
  }
  return path;
}
