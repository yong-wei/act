export const CENSUS_CORE_SCHEMA_VERSION = 'act-architecture-census/v1' as const;
export const MEASUREMENT_RECEIPT_SCHEMA_VERSION = 'act-architecture-measurement-receipt/v1' as const;

export const INVENTORY_KINDS = [
  'entrypoint',
  'route',
  'api',
  'prisma-model',
  'prisma-access',
  'event-contract',
  'worker',
  'script',
  'test',
  'registry',
  'openspec-capability',
  'dependency-edge',
  'reverse-edge',
  'deep-import',
  'scc',
  'compatibility-surface',
  'gate',
  'change-center',
] as const;

export type InventoryKind = (typeof INVENTORY_KINDS)[number];

export const SURFACE_CLASSES = [
  'production',
  'test',
  'generated',
  'compatibility',
  'framework-convention',
] as const;

export type SurfaceClass = (typeof SURFACE_CLASSES)[number];

export const OWNERSHIP_STATES = ['resolved-current', 'candidate-target', 'ambiguous'] as const;
export type OwnershipState = (typeof OWNERSHIP_STATES)[number];

export interface CaptureIdentity {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly commitTime: string;
  readonly nodeVersion: string;
  readonly npmVersion: string;
  readonly typescriptVersion: string;
}

export interface DenominatorTotals {
  readonly discovered: number;
  readonly represented: number;
  readonly excluded: number;
  readonly duplicate: number;
  readonly unresolved: number;
}

export interface OwnershipRecord {
  readonly currentOwnerEvidence: readonly string[];
  readonly candidateTargetOwner: string | null;
  readonly state: OwnershipState;
  readonly conflictingEvidence: readonly string[];
}

export interface CensusObservation {
  readonly id: string;
  readonly kind: InventoryKind;
  readonly identity: string;
  readonly surfaceClass: SurfaceClass;
  readonly ownership: OwnershipRecord;
  readonly evidence: readonly string[];
  readonly trustClass: string | null;
  readonly compatibility: boolean;
  readonly notes: readonly string[];
  readonly attributes: Readonly<Record<string, string | number | boolean | null>>;
}

export interface InventoryManifest {
  readonly kind: InventoryKind;
  readonly includeRules: readonly string[];
  readonly excludeRules: readonly string[];
  readonly totals: DenominatorTotals;
}

export interface CensusCore {
  readonly schemaVersion: typeof CENSUS_CORE_SCHEMA_VERSION;
  readonly captureIdentity: CaptureIdentity;
  readonly manifests: readonly InventoryManifest[];
  readonly observations: readonly CensusObservation[];
  readonly commandSummaries: readonly CommandSummary[];
}

export interface CommandSummary {
  readonly commandId: string;
  readonly scope: string;
  readonly exitStatus: number | null;
  readonly aggregate: Readonly<Record<string, number | string>>;
  readonly fingerprint: string | null;
}

export interface MeasurementReceipt {
  readonly schemaVersion: typeof MEASUREMENT_RECEIPT_SCHEMA_VERSION;
  readonly receiptId: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly command: string;
  readonly scope: string;
  readonly platform: string;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly cacheMode: string;
  readonly capturedAt: string;
  readonly exitStatus: number;
  readonly aggregate: Readonly<Record<string, number | string>>;
  readonly fingerprints: readonly string[];
}

export interface CensusSourceFile {
  readonly path: string;
  readonly content: string;
  readonly byteLength: number;
}

export interface CensusSourceSnapshot {
  readonly identity: CaptureIdentity;
  readonly files: readonly CensusSourceFile[];
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
  readonly detachedUnresolved: boolean;
}

export interface QualificationFailure {
  readonly code: string;
  readonly identity: string;
}
