export const TOOLCHAIN_BOUNDARY_SCHEMA_VERSION = 'act-independent-toolchain-execution-boundary/v1' as const;
export const TOOLCHAIN_REGISTRY_SCHEMA_VERSION = 'act-toolchain-registry/v1' as const;
export const TOOLCHAIN_RECEIPT_SCHEMA_VERSION = 'act-toolchain-command-receipt/v1' as const;

export const SOURCE_FAMILIES = [
  { id: 'tools', path: 'tools' },
  { id: 'scripts-knowledge-cutover', path: 'scripts/knowledge-cutover' },
  { id: 'scripts-knowledge', path: 'scripts/knowledge' },
  { id: 'scripts-runtime-release', path: 'scripts/runtime-release' },
  { id: 'scripts-release', path: 'scripts/release' },
  { id: 'course-content-scripts', path: 'course-content/scripts' },
  { id: 'scripts-tests', path: 'scripts/tests' },
  { id: 'scripts-migrations', path: 'scripts/migrations' },
  { id: 'scripts-db', path: 'scripts/db' },
  { id: 'evaluate', path: 'evaluate' },
  { id: 'artifacts', path: 'artifacts' },
] as const;

export type SourceFamilyId = (typeof SOURCE_FAMILIES)[number]['id'];

export const TOOL_CLASSES = [
  'content-export-review',
  'knowledge-release',
  'runtime-oss-release',
  'evidence-visual-qa',
  'migration-backfill',
  'competition-material',
  'adapter',
  'fixture',
  'historical-evidence',
  'existing-unrelated-tool',
] as const;

export type ToolClass = (typeof TOOL_CLASSES)[number];
export type PrivacyClass = 'public-bundle' | 'private-run-evidence' | 'none';
export type SafetyMode = 'read-only' | 'dry-run-default' | 'apply-gated' | 'none';

export interface GeneratedInputRecord {
  readonly producer: string;
  readonly version: string;
  readonly pathClass: string;
  readonly digest: string;
  readonly sourceRevision: string;
  readonly path: string;
}

export interface FamilyDenominator {
  readonly id: SourceFamilyId;
  readonly path: string;
  readonly count: number;
  readonly digest: string;
}

export interface SourceDenominator {
  readonly schemaVersion: typeof TOOLCHAIN_BOUNDARY_SCHEMA_VERSION;
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly families: readonly FamilyDenominator[];
  readonly totalCount: number;
  readonly digest: string;
  readonly generatedInputs: readonly GeneratedInputRecord[];
}

export interface ClassifiedEntry {
  readonly path: string;
  readonly toolClass: ToolClass;
  readonly owner: string;
  readonly familyId: SourceFamilyId;
  readonly privacyClass: PrivacyClass;
  readonly safetyMode: SafetyMode;
  readonly retirementCondition: string;
  readonly followUpChange: string | null;
}

export interface ToolRegistryRecord {
  readonly toolId: string;
  readonly toolClass: ToolClass;
  readonly owner: string;
  readonly commandId: string;
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly inputManifest: string;
  readonly outputContract: string;
  readonly safetyMode: SafetyMode;
  readonly privacyClass: PrivacyClass;
  readonly graphId: 'tools' | 'test';
  readonly testCommand: string;
  readonly retirementCondition: string;
  readonly followUpChange: string | null;
  readonly paths: readonly string[];
}

export interface ToolRegistry {
  readonly schemaVersion: typeof TOOLCHAIN_REGISTRY_SCHEMA_VERSION;
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly denominatorDigest: string;
  readonly records: readonly ToolRegistryRecord[];
}

export interface CommandReceipt {
  readonly schemaVersion: typeof TOOLCHAIN_RECEIPT_SCHEMA_VERSION;
  readonly commandId: string;
  readonly sourceRevision: string;
  readonly sourceTree: string;
  readonly inputDigest: string;
  readonly outputDigest: string;
  readonly validatorVersion: string;
  readonly exitStatus: number;
  readonly graphId: 'tools' | 'test';
  readonly privacyClass: PrivacyClass;
  readonly safetyMode: SafetyMode;
}

export interface BoundaryFailure {
  readonly code: string;
  readonly message: string;
  readonly path?: string;
}

export interface ProductToolEdge {
  readonly from: string;
  readonly to: string;
  readonly specifier: string;
  readonly edgeClass: 'static-import' | 'dynamic-import';
}

export interface ProductToolPathRead {
  readonly from: string;
  readonly to: string;
  readonly kind: 'path-string';
}

export const DOWNSTREAM_CHANGES = [
  'extract-teaching-projection-publishing-cli',
  'isolate-content-knowledge-runtime-release-toolchains',
  'isolate-migration-backfill-competition-toolchains',
  'externalize-run-specific-qa-evidence-artifacts',
] as const;
