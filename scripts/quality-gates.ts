#!/usr/bin/env tsx
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { readGitIdentity } from './typescript-graphs/contracts';
import {
  createBlockedIntegrationProtectionReceipt,
  INTEGRATION_PROTECTION_RECEIPT_SCHEMA_VERSION,
  PROTECTION_RESPONSE_CLASSES,
  type ProtectionResponseClass,
} from './quality-gates/branch-protection';
import {
  DEFAULT_QUALITY_GATE_REGISTRY,
  qualityGateRegistryHash,
  serializeQualityGateRegistry,
  validatePackageCommandAuthority,
  validateQualityGateRegistry,
  validateWorkflowText,
  QUALITY_LAYER_IDS,
  type QualityLayerId,
} from './quality-gates/registry';
import { runQualityLayer, writeLayerReceipt } from './quality-gates/runner';

function argument(name: string): string | null {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function layerArgument(): QualityLayerId {
  const value = argument('--layer');
  if (!value || !(QUALITY_LAYER_IDS as readonly string[]).includes(value)) throw new Error(`quality-gate-layer-required:${value ?? 'missing'}`);
  return value as QualityLayerId;
}

function workflowTexts(repoRoot: string): Record<string, string> {
  const paths = ['.github/workflows/ci.yml', '.github/workflows/quality-gates.yml'];
  return Object.fromEntries(paths
    .map((path) => [path, join(repoRoot, path)] as const)
    .filter(([, path]) => existsSync(path))
    .map(([path, fullPath]) => [path, readFileSync(fullPath, 'utf8')]));
}

function validate(repoRoot: string): string[] {
  const failures = [
    ...validateQualityGateRegistry(DEFAULT_QUALITY_GATE_REGISTRY, { workflowTexts: workflowTexts(repoRoot) }),
    ...validatePackageCommandAuthority(repoRoot),
  ];
  return failures.map((failure) => `${failure.code}:${failure.identity}`);
}

function writeRegistry(repoRoot: string): void {
  mkdirSync(join(repoRoot, 'docs/architecture/quality-gates'), { recursive: true });
  const registry = JSON.parse(serializeQualityGateRegistry(DEFAULT_QUALITY_GATE_REGISTRY)) as Record<string, unknown>;
  const document = {
    ...registry,
    generatedFrom: 'scripts/quality-gates/registry.ts',
    registryHash: qualityGateRegistryHash(DEFAULT_QUALITY_GATE_REGISTRY),
  };
  writeFileSync(join(repoRoot, 'docs/architecture/quality-gates/registry.json'), `${JSON.stringify(document)}\n`);
}

function writeProtectionReceipt(repoRoot: string): void {
  const responseClass = (argument('--response-class') ?? 'not-queried-in-patch-worker-scope') as ProtectionResponseClass;
  if (!(PROTECTION_RESPONSE_CLASSES as readonly string[]).includes(responseClass)) throw new Error(`unknown-protection-response-class:${responseClass}`);
  const identity = readGitIdentity(repoRoot);
  const receipt = createBlockedIntegrationProtectionReceipt({
    sourceCommit: identity.sourceCommit,
    sourceTree: identity.sourceTree,
    dirty: identity.dirty,
    responseClass,
    capturedAt: argument('--captured-at') ?? new Date().toISOString(),
  });
  mkdirSync(join(repoRoot, 'docs/architecture/quality-gates'), { recursive: true });
  writeFileSync(join(repoRoot, 'docs/architecture/quality-gates/integration-protection-verification.json'), `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(JSON.stringify({ schemaVersion: INTEGRATION_PROTECTION_RECEIPT_SCHEMA_VERSION, status: receipt.status, receiptId: receipt.receiptId }));
}

function main(): void {
  const repoRoot = process.cwd();
  const action = process.argv[2] ?? 'validate';
  if (action === 'validate') {
    const failures = validate(repoRoot);
    console.log(JSON.stringify({ registryId: DEFAULT_QUALITY_GATE_REGISTRY.registryId, registryHash: qualityGateRegistryHash(DEFAULT_QUALITY_GATE_REGISTRY), failures }));
    if (failures.length > 0) process.exitCode = 1;
    return;
  }
  if (action === 'write-registry') {
    writeRegistry(repoRoot);
    return;
  }
  if (action === 'write-protection-receipt') {
    writeProtectionReceipt(repoRoot);
    return;
  }
  if (action === 'run') {
    const result = runQualityLayer({ repoRoot, layer: layerArgument(), checkId: argument('--check') ?? undefined });
    writeLayerReceipt(repoRoot, result.receipt);
    console.log(JSON.stringify({ layer: result.receipt.layer, status: result.receipt.status, receiptId: result.receipt.receiptId, failures: result.failures }));
    if (result.receipt.status !== 'passed') process.exitCode = 1;
    return;
  }
  throw new Error(`unknown-quality-gate-action:${action}`);
}

main();

export { validateWorkflowText };
