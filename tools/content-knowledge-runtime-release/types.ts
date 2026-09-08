export const RELEASE_TOOLCHAIN_SCHEMA_VERSION =
  'act-content-knowledge-runtime-release-toolchains/v1' as const;

export const SOURCE_ROOTS = [
  'course-content/scripts',
  'scripts/knowledge',
  'scripts/knowledge-cutover',
  'scripts/runtime-release',
  'scripts/release',
] as const;

export const FROZEN_COUNTS = {
  'course-content/scripts': 41,
  'scripts/knowledge': 19,
  'scripts/knowledge-cutover': 80,
  'scripts/runtime-release': 44,
  'scripts/release': 5,
} as const;

export const CHARACTERIZATION_PATHS = {
  content: 'course-content/scripts/export-runtime.sh',
  knowledge: 'scripts/knowledge-cutover/publish-actkg-v018-cutover-runtime.ts',
  runtime: 'scripts/runtime-release/materialize-runtime-blob-release.py',
} as const;

export const PROJECTION_HANDOFF = {
  owner: 'teaching-projection-publishing',
  commandIds: [
    'teaching-projection:qualify',
    'teaching-projection:rebase',
    'teaching-projection:publish',
  ],
} as const;

export type SourceRoot = (typeof SOURCE_ROOTS)[number];
export type ToolchainId = 'content-compiler' | 'knowledge-release' | 'runtime-release';
export type ReleaseRole =
  | 'compiler'
  | 'validator'
  | 'publication-writer'
  | 'candidate-adapter'
  | 'reader'
  | 'operator-adapter';
export type SafetyMode = 'read-only' | 'dry-run-default' | 'apply-gated';

export interface ReleaseCommand {
  readonly path: string;
  readonly commandId: string;
  readonly toolchain: ToolchainId;
  readonly owner: 'course' | 'knowledge' | 'platform';
  readonly role: ReleaseRole;
  readonly safetyMode: SafetyMode;
  readonly retirementCondition: string;
}

export interface ApplyGateInput {
  readonly mode: 'dry-run' | 'apply';
  readonly approval: string | null;
  readonly planHash: string;
  readonly currentInputHash: string;
  readonly targetIdentity: string;
}

export interface ApplyGateResult {
  readonly allowed: boolean;
  readonly executed: false;
  readonly status: 'dry-run' | 'apply-rejected' | 'apply-authorized-not-executed';
  readonly reason: string | null;
}

export interface ReleaseIdentity {
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly toolchain: ToolchainId | 'inventory';
  readonly commandId: string;
  readonly inputDigest: string;
  readonly outputDigest: string;
  readonly artifactDigest: null;
  readonly executed: false;
  readonly productionActivation: false;
  readonly selectorMutation: false;
}

export interface CommandReceipt extends ReleaseIdentity {
  readonly schemaVersion: typeof RELEASE_TOOLCHAIN_SCHEMA_VERSION;
  readonly planHash: string;
  readonly inputHash: string;
  readonly targetIdentity: string;
  readonly approvalState: 'absent' | 'stale' | 'fixture-approved' | 'not-required';
  readonly status: ApplyGateResult['status'] | 'check-ok' | 'check-failed' | 'identity-mismatch';
  readonly projectionHandoff: typeof PROJECTION_HANDOFF | null;
}

export interface InventoryCommandRecord {
  readonly path: string;
  readonly commandId: string;
  readonly toolchain: ToolchainId;
  readonly owner: ReleaseCommand['owner'];
  readonly role: ReleaseRole;
  readonly safetyMode: SafetyMode;
  readonly contentHash: string;
}
