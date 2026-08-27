import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { privacyViolation } from '../../src/lib/architecture-census/privacy';
import { serializeDeterministic, sha256Text } from '../../src/lib/architecture-census/serialize';
import {
  COMMAND_CONTRACTS,
  GOVERNED_COMMAND_IDS,
  commandContract,
  type GovernedCommandId,
} from '../../src/lib/architecture-test-commands';
import {
  GRAPH_DEFINITIONS,
  GRAPH_IDS,
  graphDefinition,
  type GraphId,
} from '../typescript-graphs/contracts';

export const QUALITY_GATE_REGISTRY_SCHEMA_VERSION = 'act-pr-integration-quality-gates/v1' as const;
export const QUALITY_GATE_RECEIPT_SCHEMA_VERSION = 'act-quality-gate-receipt/v1' as const;
export const GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION = 'act-governed-command-receipt/v1' as const;

export const QUALITY_LAYER_IDS = ['pr', 'integration', 'main-release', 'nightly'] as const;
export type QualityLayerId = (typeof QUALITY_LAYER_IDS)[number];

export const QUALITY_EVENTS = ['pull_request', 'push', 'schedule', 'workflow_dispatch'] as const;
export type QualityEvent = (typeof QUALITY_EVENTS)[number];

export type FailurePolicy = 'block' | 'observe';
export type CommandKind = 'test-contract' | 'typescript-graph' | 'architecture-fitness' | 'npm-script';
export type CompositionKind = 'all-must-pass';

const EXTRA_COMMAND_IDS = [
  'fitness:architecture',
  'lint',
  'build',
  'wasm:build:control-engine',
  'test:migration-rehearsal',
  'test:runtime-release-deployment-contract',
  'test:runtime-production-cutover-contract',
  'test:runtime-release-oss-publisher-bridge',
  'test:runtime-release-activation-rollback',
  'test:runtime-production-readyz',
  'test:database-compatibility',
  'test:runtime-knowledge',
  'test:appshell-governance',
  'test:appshell-governance:browser',
  'test:theme-coverage',
  'test:provider-runtime-smoke',
  'test:smart-lesson-real-e2e',
  'test:micro-tutoring-qualification',
  'test:data-governance',
  'test:arena-official-followup-postgres',
  'test:simulation-task-portrait-postgres-redis',
  'test:simulation-runtime-noise',
] as const;

export type QualityCommandId =
  | GovernedCommandId
  | `typecheck:${GraphId}`
  | (typeof EXTRA_COMMAND_IDS)[number];

export interface QualityCommandDefinition {
  readonly id: QualityCommandId;
  readonly npmScript: string;
  readonly scope: string;
  readonly receiptSchema: string;
  readonly authorityPath: string;
  readonly kind: CommandKind;
}

export interface RequiredQualityCheck {
  readonly checkId: string;
  readonly name: string;
  readonly layer: QualityLayerId;
  readonly required: boolean;
  readonly commandIds: readonly QualityCommandId[];
  readonly scope: string;
  readonly requiredInputs: readonly string[];
  readonly receiptSchema: string;
  readonly timeoutMinutes: number;
  readonly failurePolicy: FailurePolicy;
  readonly composition?: CompositionKind;
}

export interface QualityLayerDefinition {
  readonly id: QualityLayerId;
  readonly events: readonly QualityEvent[];
  readonly branches: readonly string[];
  readonly scope: string;
  readonly checkIds: readonly string[];
  readonly fallback: 'expand-or-block' | 'not-applicable';
  readonly publicationBlocking: boolean;
  readonly owner: string;
}

export interface QualityAuthorityInput {
  readonly id: string;
  readonly path: string;
  readonly schema: string;
  readonly role: string;
}

export interface QualityGateRegistry {
  readonly schemaVersion: typeof QUALITY_GATE_REGISTRY_SCHEMA_VERSION;
  readonly registryId: string;
  readonly sourceOfTruth: readonly QualityAuthorityInput[];
  readonly commands: readonly QualityCommandDefinition[];
  readonly checks: readonly RequiredQualityCheck[];
  readonly layers: readonly QualityLayerDefinition[];
  readonly protectedReleaseCheckIds: readonly string[];
  readonly nightlySubstitutionForbidden: readonly QualityCommandId[];
}

export interface RegistryFailure {
  readonly code: string;
  readonly identity: string;
  readonly detail?: string;
}

const TEST_RECEIPT_SCHEMA = 'act-test-command-measurement-receipt/v1';
const GRAPH_RECEIPT_SCHEMA = 'act-typescript-graph-measurement-receipt/v1';
const FITNESS_RECEIPT_SCHEMA = 'act-architecture-fitness-report/v1';

function testCommand(id: GovernedCommandId): QualityCommandDefinition {
  const contract = commandContract(id);
  return {
    id,
    npmScript: contract.npmScript,
    scope: contract.scope,
    receiptSchema: TEST_RECEIPT_SCHEMA,
    authorityPath: 'src/lib/architecture-test-commands',
    kind: 'test-contract',
  };
}

function graphCommand(graph: GraphId): QualityCommandDefinition {
  const definition = graphDefinition(graph);
  return {
    id: definition.command,
    npmScript: definition.command,
    scope: definition.scope,
    receiptSchema: GRAPH_RECEIPT_SCHEMA,
    authorityPath: 'scripts/typescript-graphs/contracts.ts',
    kind: 'typescript-graph',
  };
}

const EXTRA_COMMANDS: readonly QualityCommandDefinition[] = [
  ['fitness:architecture', 'architecture-fitness-budgets', FITNESS_RECEIPT_SCHEMA, 'scripts/architecture-fitness.ts', 'architecture-fitness'],
  ['lint', 'repository-lint', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.lint', 'npm-script'],
  ['build', 'next-production-build', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.build', 'npm-script'],
  ['wasm:build:control-engine', 'control-engine-wasm-build', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'scripts/wasm/build-control-engine.mjs', 'npm-script'],
  ['test:migration-rehearsal', 'prisma-migration-rehearsal', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'scripts/quality-gates/migration-rehearsal.mjs', 'npm-script'],
  ['test:runtime-release-deployment-contract', 'runtime-release-deployment-contract', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'scripts/tests/test-runtime-release-deployment-contract.mjs', 'npm-script'],
  ['test:runtime-production-cutover-contract', 'runtime-production-cutover-contract', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'scripts/tests/test-runtime-production-cutover-contract.mjs', 'npm-script'],
  ['test:runtime-release-oss-publisher-bridge', 'runtime-release-oss-publisher-contract', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'scripts/tests/test-runtime-release-oss-publisher-bridge.mjs', 'npm-script'],
  ['test:runtime-release-activation-rollback', 'runtime-release-rollback-smoke', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'scripts/tests/test-runtime-release-activation-rollback.mjs', 'npm-script'],
  ['test:runtime-production-readyz', 'post-deploy-readyz-contract', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'scripts/tests/test-readyz-json.py', 'npm-script'],
  ['test:database-compatibility', 'database-compatibility-rehearsal', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:database-compatibility', 'npm-script'],
  ['test:runtime-knowledge', 'runtime-knowledge-integrity', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:runtime-knowledge', 'npm-script'],
  ['test:appshell-governance', 'isolated-appshell-governance', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:appshell-governance', 'npm-script'],
  ['test:appshell-governance:browser', 'visual-appshell-governance', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:appshell-governance:browser', 'npm-script'],
  ['test:theme-coverage', 'visual-theme-coverage', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:theme-coverage', 'npm-script'],
  ['test:provider-runtime-smoke', 'real-provider-runtime-smoke', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:provider-runtime-smoke', 'npm-script'],
  ['test:smart-lesson-real-e2e', 'real-course-matrix', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:smart-lesson-real-e2e', 'npm-script'],
  ['test:micro-tutoring-qualification', 'micro-tutoring-course-matrix', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:micro-tutoring-qualification', 'npm-script'],
  ['test:data-governance', 'data-governance-replay', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:data-governance', 'npm-script'],
  ['test:arena-official-followup-postgres', 'arena-postgres-sample', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:arena-official-followup-postgres', 'npm-script'],
  ['test:simulation-task-portrait-postgres-redis', 'simulation-postgres-redis-sample', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:simulation-task-portrait-postgres-redis', 'npm-script'],
  ['test:simulation-runtime-noise', 'simulation-visual-runtime-sample', GENERIC_COMMAND_RECEIPT_SCHEMA_VERSION, 'package.json:scripts.test:simulation-runtime-noise', 'npm-script'],
].map(([id, scope, receiptSchema, authorityPath, kind]) => ({
  id: id as QualityCommandId,
  npmScript: id,
  scope,
  receiptSchema,
  authorityPath,
  kind: kind as CommandKind,
}));

export const QUALITY_COMMAND_DEFINITIONS: readonly QualityCommandDefinition[] = [
  ...GOVERNED_COMMAND_IDS.map(testCommand),
  ...GRAPH_IDS.map(graphCommand),
  ...EXTRA_COMMANDS,
].sort((left, right) => left.id.localeCompare(right.id));

export function qualityCommand(id: QualityCommandId): QualityCommandDefinition {
  const command = QUALITY_COMMAND_DEFINITIONS.find((item) => item.id === id);
  if (!command) throw new Error(`unknown-quality-command:${id}`);
  return command;
}

function affectedScope(commandId: QualityCommandId): string {
  return `affected-or-full-fallback:${qualityCommand(commandId).scope}`;
}

function check(input: Omit<RequiredQualityCheck, 'required' | 'failurePolicy' | 'receiptSchema'> & { readonly receiptSchema?: string }): RequiredQualityCheck {
  const receiptSchema = input.receiptSchema ?? (
    input.commandIds.length === 1
      ? qualityCommand(input.commandIds[0]).receiptSchema
      : QUALITY_GATE_RECEIPT_SCHEMA_VERSION
  );
  return {
    ...input,
    required: true,
    failurePolicy: 'block',
    receiptSchema,
  };
}

const PR_CHECKS: readonly RequiredQualityCheck[] = [
  check({ checkId: 'pr/architecture-fitness', name: 'PR / architecture fitness', layer: 'pr', commandIds: ['fitness:architecture'], scope: 'architecture-fitness-budgets', requiredInputs: ['fitness-budget-ledger', 'typescript-graph-receipts'], timeoutMinutes: 20 }),
  check({ checkId: 'pr/affected-lint', name: 'PR / affected lint', layer: 'pr', commandIds: ['lint'], scope: affectedScope('lint'), requiredInputs: ['git-diff', 'owner-denominator'], timeoutMinutes: 20 }),
  check({ checkId: 'pr/typecheck-test', name: 'PR / test TypeScript graph', layer: 'pr', commandIds: ['typecheck:test'], scope: qualityCommand('typecheck:test').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'pr/typecheck-tools', name: 'PR / tooling TypeScript graph', layer: 'pr', commandIds: ['typecheck:tools'], scope: qualityCommand('typecheck:tools').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'pr/typecheck-web', name: 'PR / Web TypeScript graph', layer: 'pr', commandIds: ['typecheck:web'], scope: qualityCommand('typecheck:web').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'pr/typecheck-worker', name: 'PR / worker TypeScript graph', layer: 'pr', commandIds: ['typecheck:worker'], scope: qualityCommand('typecheck:worker').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'pr/affected-unit', name: 'PR / affected domain unit tests', layer: 'pr', commandIds: ['test:unit'], scope: affectedScope('test:unit'), requiredInputs: ['test-command-discovery-core', 'owner-denominator'], timeoutMinutes: 30 }),
  check({ checkId: 'pr/contract', name: 'PR / governed contract tests', layer: 'pr', commandIds: ['test:contract'], scope: qualityCommand('test:contract').scope, requiredInputs: ['test-command-discovery-core'], timeoutMinutes: 30 }),
  check({ checkId: 'pr/prisma-migration', name: 'PR / Prisma migration rehearsal', layer: 'pr', commandIds: ['test:migration-rehearsal'], scope: qualityCommand('test:migration-rehearsal').scope, requiredInputs: ['prisma-schema-and-migrations'], timeoutMinutes: 20 }),
  check({ checkId: 'pr/critical-e2e', name: 'PR / critical E2E journeys', layer: 'pr', commandIds: ['test:e2e:critical'], scope: affectedScope('test:e2e:critical'), requiredInputs: ['critical-journey-owner-map'], timeoutMinutes: 45 }),
];

const INTEGRATION_CHECKS: readonly RequiredQualityCheck[] = [
  check({ checkId: 'integration/architecture-fitness', name: 'Integration / architecture fitness', layer: 'integration', commandIds: ['fitness:architecture'], scope: 'architecture-fitness-budgets', requiredInputs: ['fitness-budget-ledger', 'typescript-graph-receipts'], timeoutMinutes: 30 }),
  check({ checkId: 'integration/unit', name: 'Integration / full unit tests', layer: 'integration', commandIds: ['test:unit'], scope: qualityCommand('test:unit').scope, requiredInputs: ['test-command-discovery-core'], timeoutMinutes: 45 }),
  check({ checkId: 'integration/contract', name: 'Integration / full contract tests', layer: 'integration', commandIds: ['test:contract'], scope: qualityCommand('test:contract').scope, requiredInputs: ['test-command-discovery-core'], timeoutMinutes: 45 }),
  check({ checkId: 'integration/integration', name: 'Integration / full integration tests', layer: 'integration', commandIds: ['test:integration'], scope: qualityCommand('test:integration').scope, requiredInputs: ['test-command-discovery-core', 'postgres-fixture'], timeoutMinutes: 60 }),
  check({ checkId: 'integration/typecheck-test', name: 'Integration / test TypeScript graph', layer: 'integration', commandIds: ['typecheck:test'], scope: qualityCommand('typecheck:test').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'integration/typecheck-tools', name: 'Integration / tooling TypeScript graph', layer: 'integration', commandIds: ['typecheck:tools'], scope: qualityCommand('typecheck:tools').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'integration/typecheck-web', name: 'Integration / Web TypeScript graph', layer: 'integration', commandIds: ['typecheck:web'], scope: qualityCommand('typecheck:web').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'integration/typecheck-worker', name: 'Integration / worker TypeScript graph', layer: 'integration', commandIds: ['typecheck:worker'], scope: qualityCommand('typecheck:worker').scope, requiredInputs: ['typescript-graph-manifest'], timeoutMinutes: 30 }),
  check({ checkId: 'integration/next-build', name: 'Integration / Next production build', layer: 'integration', commandIds: ['build'], scope: qualityCommand('build').scope, requiredInputs: ['npm-lock', 'optimized-model-assets'], timeoutMinutes: 60 }),
  check({ checkId: 'integration/wasm-build', name: 'Integration / control-engine WASM build', layer: 'integration', commandIds: ['wasm:build:control-engine'], scope: qualityCommand('wasm:build:control-engine').scope, requiredInputs: ['rust-toolchain'], timeoutMinutes: 30 }),
  check({ checkId: 'integration/migration-rehearsal', name: 'Integration / Prisma migration rehearsal', layer: 'integration', commandIds: ['test:migration-rehearsal'], scope: qualityCommand('test:migration-rehearsal').scope, requiredInputs: ['prisma-schema-and-migrations'], timeoutMinutes: 30 }),
  check({ checkId: 'integration/critical-e2e', name: 'Integration / critical E2E journeys', layer: 'integration', commandIds: ['test:e2e:critical'], scope: qualityCommand('test:e2e:critical').scope, requiredInputs: ['critical-journey-owner-map'], timeoutMinutes: 60 }),
];

const MAIN_RELEASE_CHECKS: readonly RequiredQualityCheck[] = [
  check({ checkId: 'main-release/typecheck-test', name: 'Main/release / test TypeScript receipt', layer: 'main-release', commandIds: ['typecheck:test'], scope: qualityCommand('typecheck:test').scope, requiredInputs: ['current-source-identity'], timeoutMinutes: 30 }),
  check({ checkId: 'main-release/typecheck-tools', name: 'Main/release / tooling TypeScript receipt', layer: 'main-release', commandIds: ['typecheck:tools'], scope: qualityCommand('typecheck:tools').scope, requiredInputs: ['current-source-identity'], timeoutMinutes: 30 }),
  check({ checkId: 'main-release/typecheck-web', name: 'Main/release / Web TypeScript receipt', layer: 'main-release', commandIds: ['typecheck:web'], scope: qualityCommand('typecheck:web').scope, requiredInputs: ['current-source-identity'], timeoutMinutes: 30 }),
  check({ checkId: 'main-release/typecheck-worker', name: 'Main/release / worker TypeScript receipt', layer: 'main-release', commandIds: ['typecheck:worker'], scope: qualityCommand('typecheck:worker').scope, requiredInputs: ['current-source-identity'], timeoutMinutes: 30 }),
  check({ checkId: 'main-release/release-qualification', name: 'Main/release / qualification manifest', layer: 'main-release', commandIds: ['test:release'], scope: qualityCommand('test:release').scope, requiredInputs: ['qualification-manifest'], timeoutMinutes: 45 }),
  check({ checkId: 'main-release/runtime-integrity', name: 'Main/release / runtime integrity', layer: 'main-release', commandIds: ['test:runtime-release-deployment-contract', 'test:runtime-production-cutover-contract'], scope: 'composition:runtime-release-integrity', requiredInputs: ['runtime-release-evidence'], timeoutMinutes: 45, composition: 'all-must-pass' }),
  check({ checkId: 'main-release/knowledge-integrity', name: 'Main/release / knowledge integrity', layer: 'main-release', commandIds: ['test:runtime-knowledge'], scope: qualityCommand('test:runtime-knowledge').scope, requiredInputs: ['knowledge-release-evidence'], timeoutMinutes: 45 }),
  check({ checkId: 'main-release/oss-integrity', name: 'Main/release / OSS runtime integrity', layer: 'main-release', commandIds: ['test:runtime-release-oss-publisher-bridge'], scope: qualityCommand('test:runtime-release-oss-publisher-bridge').scope, requiredInputs: ['oss-release-evidence'], timeoutMinutes: 45 }),
  check({ checkId: 'main-release/rollback-smoke', name: 'Main/release / rollback smoke', layer: 'main-release', commandIds: ['test:runtime-release-activation-rollback'], scope: qualityCommand('test:runtime-release-activation-rollback').scope, requiredInputs: ['rollback-plan'], timeoutMinutes: 45 }),
  check({ checkId: 'main-release/readyz', name: 'Main/release / post-deploy readyz', layer: 'main-release', commandIds: ['test:runtime-production-readyz'], scope: qualityCommand('test:runtime-production-readyz').scope, requiredInputs: ['post-deploy-readyz-observation'], timeoutMinutes: 20 }),
  check({ checkId: 'main-release/database-compatibility', name: 'Main/release / database compatibility', layer: 'main-release', commandIds: ['test:database-compatibility'], scope: qualityCommand('test:database-compatibility').scope, requiredInputs: ['database-compatibility-evidence'], timeoutMinutes: 45 }),
];

const NIGHTLY_CHECKS: readonly RequiredQualityCheck[] = [
  check({ checkId: 'nightly/isolated', name: 'Nightly / isolated governance samples', layer: 'nightly', commandIds: ['test:appshell-governance'], scope: qualityCommand('test:appshell-governance').scope, requiredInputs: ['isolated-test-fixtures'], timeoutMinutes: 30 }),
  check({ checkId: 'nightly/visual-performance', name: 'Nightly / visual and performance samples', layer: 'nightly', commandIds: ['test:appshell-governance:browser', 'test:theme-coverage', 'test:simulation-runtime-noise'], scope: 'composition:visual-performance-samples', requiredInputs: ['visual-baselines', 'performance-sample-plan'], timeoutMinutes: 90, composition: 'all-must-pass' }),
  check({ checkId: 'nightly/real-provider', name: 'Nightly / real provider smoke', layer: 'nightly', commandIds: ['test:provider-runtime-smoke'], scope: qualityCommand('test:provider-runtime-smoke').scope, requiredInputs: ['provider-runtime-credentials-by-environment'], timeoutMinutes: 45 }),
  check({ checkId: 'nightly/course-matrix', name: 'Nightly / real course matrix', layer: 'nightly', commandIds: ['test:smart-lesson-real-e2e', 'test:micro-tutoring-qualification'], scope: 'composition:real-course-matrix', requiredInputs: ['course-matrix-plan'], timeoutMinutes: 90, composition: 'all-must-pass' }),
  check({ checkId: 'nightly/data-replay', name: 'Nightly / data-governance replay', layer: 'nightly', commandIds: ['test:data-governance'], scope: qualityCommand('test:data-governance').scope, requiredInputs: ['postgres-fixture', 'data-replay-plan'], timeoutMinutes: 90 }),
  check({ checkId: 'nightly/arena', name: 'Nightly / Arena sample', layer: 'nightly', commandIds: ['test:arena-official-followup-postgres'], scope: qualityCommand('test:arena-official-followup-postgres').scope, requiredInputs: ['arena-sample-plan'], timeoutMinutes: 60 }),
  check({ checkId: 'nightly/simulation', name: 'Nightly / simulation sample', layer: 'nightly', commandIds: ['test:simulation-task-portrait-postgres-redis'], scope: qualityCommand('test:simulation-task-portrait-postgres-redis').scope, requiredInputs: ['simulation-sample-plan'], timeoutMinutes: 60 }),
];

const CHECKS: readonly RequiredQualityCheck[] = [
  ...PR_CHECKS,
  ...INTEGRATION_CHECKS,
  ...MAIN_RELEASE_CHECKS,
  ...NIGHTLY_CHECKS,
].sort((left, right) => left.checkId.localeCompare(right.checkId));

const LAYERS: readonly QualityLayerDefinition[] = [
  {
    id: 'pr',
    events: ['pull_request'],
    branches: ['integration'],
    scope: 'affected-pr-with-denominator-closed-fallback',
    checkIds: PR_CHECKS.map((item) => item.checkId).sort(),
    fallback: 'expand-or-block',
    publicationBlocking: true,
    owner: 'platform',
  },
  {
    id: 'integration',
    events: ['push'],
    branches: ['integration'],
    scope: 'full-integration-source-revision',
    checkIds: INTEGRATION_CHECKS.map((item) => item.checkId).sort(),
    fallback: 'not-applicable',
    publicationBlocking: true,
    owner: 'platform',
  },
  {
    id: 'main-release',
    events: ['push', 'workflow_dispatch'],
    branches: ['main', 'release/**'],
    scope: 'release-qualification-and-production-compatibility',
    checkIds: MAIN_RELEASE_CHECKS.map((item) => item.checkId).sort(),
    fallback: 'not-applicable',
    publicationBlocking: true,
    owner: 'release',
  },
  {
    id: 'nightly',
    events: ['schedule', 'workflow_dispatch'],
    branches: [],
    scope: 'declared-breadth-without-pr-repair-semantics',
    checkIds: NIGHTLY_CHECKS.map((item) => item.checkId).sort(),
    fallback: 'not-applicable',
    publicationBlocking: false,
    owner: 'platform',
  },
];

export const PROTECTED_RELEASE_CHECK_IDS = MAIN_RELEASE_CHECKS.map((item) => item.checkId).sort();

export const DEFAULT_QUALITY_GATE_REGISTRY: QualityGateRegistry = {
  schemaVersion: QUALITY_GATE_REGISTRY_SCHEMA_VERSION,
  registryId: 'act-pr-integration-quality-gates',
  sourceOfTruth: [
    { id: 'test-command-contracts', path: 'src/lib/architecture-test-commands', schema: 'act-test-command-contracts/v1', role: 'test discovery and command semantics' },
    { id: 'typescript-graphs', path: 'scripts/typescript-graphs/contracts.ts', schema: 'act-typescript-graph-contract/v1', role: 'four graph definitions and receipts' },
    { id: 'architecture-fitness', path: 'src/lib/architecture-fitness', schema: 'act-architecture-fitness/v1', role: 'fitness and budget evaluation' },
    { id: 'fitness-budget-ledger', path: 'docs/architecture/fitness-budget-ledger.json', schema: 'act-architecture-fitness-budget/v1', role: 'frozen fitness budget inputs' },
    { id: 'release-qualification', path: 'src/lib/architecture-test-commands/release.ts', schema: 'act-release-qualification-manifest/v1', role: 'release evidence validation' },
  ].sort((left, right) => left.id.localeCompare(right.id)),
  commands: QUALITY_COMMAND_DEFINITIONS,
  checks: CHECKS,
  layers: LAYERS,
  protectedReleaseCheckIds: PROTECTED_RELEASE_CHECK_IDS,
  nightlySubstitutionForbidden: ['typecheck:tools', 'typecheck:test'],
};

function uniqueFailures(failures: readonly RegistryFailure[]): RegistryFailure[] {
  const seen = new Set<string>();
  return [...failures]
    .sort((left, right) => `${left.code}:${left.identity}`.localeCompare(`${right.code}:${right.identity}`))
    .filter((failure) => {
      const key = `${failure.code}:${failure.identity}:${failure.detail ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function duplicateFailures<T extends { readonly id: string }>(items: readonly T[], code: string): RegistryFailure[] {
  const seen = new Map<string, number>();
  const failures: RegistryFailure[] = [];
  for (const item of items) {
    const count = (seen.get(item.id) ?? 0) + 1;
    seen.set(item.id, count);
    if (count > 1) failures.push({ code, identity: item.id });
  }
  return failures;
}

function scopeCompatible(checkRecord: RequiredQualityCheck, command: QualityCommandDefinition): boolean {
  return checkRecord.scope === command.scope
    || checkRecord.scope === affectedScope(command.id)
    || checkRecord.scope.startsWith('composition:');
}

export function validateQualityGateRegistry(
  registry: QualityGateRegistry = DEFAULT_QUALITY_GATE_REGISTRY,
  options: { readonly workflowTexts?: Readonly<Record<string, string>> } = {},
): RegistryFailure[] {
  const failures: RegistryFailure[] = [];
  if (registry.schemaVersion !== QUALITY_GATE_REGISTRY_SCHEMA_VERSION) failures.push({ code: 'registry-schema', identity: String(registry.schemaVersion) });
  if (!registry.registryId) failures.push({ code: 'registry-id-missing', identity: 'registry' });
  failures.push(...duplicateFailures(registry.commands, 'duplicate-command-authority'));
  failures.push(...duplicateFailures(registry.checks.map((item) => ({ id: item.checkId })), 'duplicate-required-check'));
  failures.push(...duplicateFailures(registry.layers, 'duplicate-layer'));

  const commandMap = new Map<string, QualityCommandDefinition>();
  for (const command of registry.commands) {
    if (!command.npmScript) failures.push({ code: 'command-script-missing', identity: command.id });
    if (!command.scope) failures.push({ code: 'command-scope-missing', identity: command.id });
    if (!command.receiptSchema) failures.push({ code: 'command-receipt-schema-missing', identity: command.id });
    if (!command.authorityPath || command.authorityPath.startsWith('/')) failures.push({ code: 'command-authority-path-invalid', identity: command.id });
    const prior = commandMap.get(command.id);
    if (prior && (prior.npmScript !== command.npmScript || prior.scope !== command.scope || prior.authorityPath !== command.authorityPath)) {
      failures.push({ code: 'duplicate-command-authority', identity: command.id });
    }
    commandMap.set(command.id, command);
  }

  const checkMap = new Map<string, RequiredQualityCheck>();
  for (const requiredCheck of registry.checks) {
    checkMap.set(requiredCheck.checkId, requiredCheck);
    if (!requiredCheck.name) failures.push({ code: 'required-check-name-missing', identity: requiredCheck.checkId });
    if (!requiredCheck.scope) failures.push({ code: 'required-check-scope-missing', identity: requiredCheck.checkId });
    if (!requiredCheck.receiptSchema) failures.push({ code: 'required-check-receipt-schema-missing', identity: requiredCheck.checkId });
    if (!Number.isInteger(requiredCheck.timeoutMinutes) || requiredCheck.timeoutMinutes <= 0) failures.push({ code: 'required-check-timeout-invalid', identity: requiredCheck.checkId });
    if (requiredCheck.required && requiredCheck.failurePolicy !== 'block') failures.push({ code: 'required-check-not-blocking', identity: requiredCheck.checkId });
    if (requiredCheck.commandIds.length === 0) failures.push({ code: 'required-check-command-missing', identity: requiredCheck.checkId });
    if (requiredCheck.commandIds.length > 1 && !requiredCheck.composition) failures.push({ code: 'composition-undocumented', identity: requiredCheck.checkId });
    if (requiredCheck.commandIds.length === 1 && requiredCheck.composition) failures.push({ code: 'composition-unnecessary', identity: requiredCheck.checkId });
    const commandIds = new Set<string>();
    for (const commandId of requiredCheck.commandIds) {
      if (commandIds.has(commandId)) failures.push({ code: 'required-check-command-duplicate', identity: `${requiredCheck.checkId}:${commandId}` });
      commandIds.add(commandId);
      const command = commandMap.get(commandId);
      if (!command) {
        failures.push({ code: 'required-check-unknown-command', identity: `${requiredCheck.checkId}:${commandId}` });
      } else if (!scopeCompatible(requiredCheck, command)) {
        failures.push({ code: 'required-check-scope-drift', identity: `${requiredCheck.checkId}:${commandId}`, detail: `${requiredCheck.scope} != ${command.scope}` });
      }
    }
  }

  const layerMap = new Map<string, QualityLayerDefinition>();
  for (const layer of registry.layers) {
    layerMap.set(layer.id, layer);
    if (!layer.owner) failures.push({ code: 'layer-owner-missing', identity: layer.id });
    const layerCheckIds = new Set<string>();
    for (const checkId of layer.checkIds) {
      if (layerCheckIds.has(checkId)) failures.push({ code: 'layer-check-duplicate', identity: `${layer.id}:${checkId}` });
      layerCheckIds.add(checkId);
      const requiredCheck = checkMap.get(checkId);
      if (!requiredCheck) failures.push({ code: 'layer-check-missing', identity: `${layer.id}:${checkId}` });
      else if (requiredCheck.layer !== layer.id) failures.push({ code: 'layer-check-scope-drift', identity: `${layer.id}:${checkId}` });
    }
  }

  for (const requiredCheck of registry.checks) {
    const layer = layerMap.get(requiredCheck.layer);
    if (!layer?.checkIds.includes(requiredCheck.checkId)) failures.push({ code: 'required-check-unlisted-in-layer', identity: requiredCheck.checkId });
  }

  for (const layerId of ['pr', 'integration'] as const) {
    const layer = layerMap.get(layerId);
    const ids = new Set(layer?.checkIds ?? []);
    for (const commandId of ['typecheck:web', 'typecheck:worker', 'typecheck:tools', 'typecheck:test'] as const) {
      if (![...ids].some((checkId) => checkMap.get(checkId)?.commandIds.includes(commandId))) {
        failures.push({ code: 'mandatory-graph-check-missing', identity: `${layerId}:${commandId}` });
      }
    }
  }

  const nightly = layerMap.get('nightly');
  for (const forbidden of registry.nightlySubstitutionForbidden) {
    if ([...(nightly?.checkIds ?? [])].some((checkId) => checkMap.get(checkId)?.commandIds.includes(forbidden))) {
      failures.push({ code: 'nightly-substitutes-mandatory-command', identity: forbidden });
    }
  }

  const mainRelease = layerMap.get('main-release');
  for (const checkId of registry.protectedReleaseCheckIds) {
    const requiredCheck = checkMap.get(checkId);
    if (!requiredCheck || !mainRelease?.checkIds.includes(checkId)) failures.push({ code: 'release-strong-gate-missing', identity: checkId });
    else if (!requiredCheck.required || requiredCheck.failurePolicy !== 'block') failures.push({ code: 'release-strong-gate-downgraded', identity: checkId });
  }

  for (const [workflowPath, workflowText] of Object.entries(options.workflowTexts ?? {})) {
    failures.push(...validateWorkflowText(workflowPath, workflowText));
  }
  return uniqueFailures(failures);
}

export function validatePackageCommandAuthority(repoRoot: string, registry: QualityGateRegistry = DEFAULT_QUALITY_GATE_REGISTRY): RegistryFailure[] {
  const parsed = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
  const scripts = parsed.scripts ?? {};
  return registry.commands
    .filter((command) => scripts[command.npmScript] === undefined)
    .map((command) => ({ code: 'local-command-script-missing', identity: command.id, detail: command.npmScript }));
}

export function validateWorkflowText(workflowPath: string, text: string): RegistryFailure[] {
  const failures: RegistryFailure[] = [];
  if (text.includes('node --import tsx/esm')) failures.push({ code: 'forbidden-node-tsx-esm-loader', identity: workflowPath });
  if (/(?:^|\s)(?:npx\s+)?vitest\s+run\b/u.test(text)) failures.push({ code: 'workflow-manual-test-list', identity: workflowPath });
  if (/continue-on-error\s*:\s*true/u.test(text)) failures.push({ code: 'workflow-accepted-failure', identity: workflowPath });
  if (/\|\|\s*true/u.test(text)) failures.push({ code: 'workflow-silent-skip', identity: workflowPath });
  if (workflowPath.endsWith('quality-gates.yml') && !text.includes('quality-gates:run')) failures.push({ code: 'workflow-registry-runner-missing', identity: workflowPath });
  return failures;
}

export function validateMainReleasePreservation(
  before: QualityGateRegistry,
  after: QualityGateRegistry,
): RegistryFailure[] {
  const afterById = new Map(after.checks.map((item) => [item.checkId, item]));
  const failures: RegistryFailure[] = [];
  for (const checkId of before.protectedReleaseCheckIds) {
    const original = before.checks.find((item) => item.checkId === checkId && item.layer === 'main-release');
    const candidate = afterById.get(checkId);
    if (!original) continue;
    if (!candidate) {
      failures.push({ code: 'release-check-removed', identity: checkId });
      continue;
    }
    if (candidate.layer !== 'main-release') failures.push({ code: 'release-check-moved', identity: checkId });
    if (!candidate.required || candidate.failurePolicy !== 'block') failures.push({ code: 'release-check-downgraded', identity: checkId });
    if (serializeDeterministic(candidate.commandIds) !== serializeDeterministic(original.commandIds)) failures.push({ code: 'release-check-command-drift', identity: checkId });
    if (candidate.scope !== original.scope) failures.push({ code: 'release-check-scope-drift', identity: checkId });
  }
  return uniqueFailures(failures);
}

export function serializeQualityGateRegistry(registry: QualityGateRegistry = DEFAULT_QUALITY_GATE_REGISTRY): string {
  const normalized: QualityGateRegistry = {
    ...registry,
    sourceOfTruth: [...registry.sourceOfTruth].sort((left, right) => left.id.localeCompare(right.id)),
    commands: [...registry.commands].sort((left, right) => left.id.localeCompare(right.id)),
    checks: [...registry.checks].map((item) => ({
      ...item,
      commandIds: [...item.commandIds].sort(),
      requiredInputs: [...item.requiredInputs].sort(),
    })).sort((left, right) => left.checkId.localeCompare(right.checkId)),
    layers: [...registry.layers].map((item) => ({
      ...item,
      events: [...item.events].sort(),
      branches: [...item.branches].sort(),
      checkIds: [...item.checkIds].sort(),
    })).sort((left, right) => left.id.localeCompare(right.id)),
    protectedReleaseCheckIds: [...registry.protectedReleaseCheckIds].sort(),
    nightlySubstitutionForbidden: [...registry.nightlySubstitutionForbidden].sort(),
  };
  const serialized = serializeDeterministic(normalized);
  const violation = privacyViolation(serialized);
  if (violation) throw new Error(`privacy-unsafe-quality-gate-registry:${violation}`);
  return serialized;
}

export function qualityGateRegistryHash(registry: QualityGateRegistry = DEFAULT_QUALITY_GATE_REGISTRY): string {
  return sha256Text(serializeQualityGateRegistry(registry));
}

export { COMMAND_CONTRACTS, GRAPH_DEFINITIONS };
