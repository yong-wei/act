export const CENSUS_CORE_SCHEMA_VERSION = 'act-architecture-census/v1' as const;
export const MEASUREMENT_RECEIPT_SCHEMA_VERSION = 'act-architecture-measurement-receipt/v1' as const;
export const POST_CONVERGENCE_SCHEMA_VERSION = 'act-architecture-post-convergence-successor/v1' as const;
export const POST_CONVERGENCE_COMMAND_SCOPE = 'post-convergence-successor:capture' as const;
export const POST_CONVERGENCE_OUTPUT_DIR = 'docs/architecture/modular-monolith/post-convergence';
export const POST_CONVERGENCE_DETAIL_DIR = 'artifacts/architecture-census';
export const HOTSPOT_LIMIT = 50;
export const CHANGE_FREQUENCY_COMMIT_LIMIT = 500;

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

export const POST_CONVERGENCE_STATUSES = [
  'captured',
  'digest-verified',
  'qualified-for-investigation',
] as const;

export type PostConvergenceStatus = (typeof POST_CONVERGENCE_STATUSES)[number];

export const MATERIAL_LAYERS = [
  'binary-media-model',
  'archived-openspec',
  'active-openspec',
  'generated-runtime-release',
  'authored-course-content',
  'qa-browser-evidence',
  'tests',
  'tools-scripts',
  'build-assets',
  'hand-authored-production',
] as const;

export type MaterialLayer = (typeof MATERIAL_LAYERS)[number];

export const DERIVED_SLICES = [
  'feature-to-app-router',
  'deep-import',
  'core-infrastructure',
  'scc',
  'src-lib-business',
  'compatibility',
  'duplicate-owner',
  'public-entrypoint',
  'single-implementation-interface',
  'delegate-only-wrapper',
  'zero-caller',
] as const;

export type DerivedSlice = (typeof DERIVED_SLICES)[number];

export const BINARY_MEDIA_MODEL_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.svgz',
  '.mp4', '.webm', '.mov', '.mp3', '.wav', '.ogg',
  '.wasm', '.zip', '.gz', '.tar', '.7z',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.pdf', '.xlsx', '.pptx', '.docx',
  '.onnx', '.bin', '.parquet', '.duckdb', '.sqlite',
] as const;

export interface SuccessorArtifactLocator {
  readonly logicalLocator: string;
  readonly mediaType: string;
  readonly byteCount: number;
  readonly sha256: string;
}

export interface MaterialLayerManifest {
  readonly layer: MaterialLayer;
  readonly includeRules: readonly string[];
  readonly excludeRules: readonly string[];
  readonly totals: DenominatorTotals;
  readonly byteTotal: number;
}

export interface DerivedSliceManifest {
  readonly slice: DerivedSlice;
  readonly includeRules: readonly string[];
  readonly totals: DenominatorTotals;
}

export interface SuccessorPredecessorBaseline {
  readonly schemaVersion: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly censusCoreSha256: string;
  readonly receiptSchemaVersion: string;
  readonly receiptIds: readonly string[];
}

export interface SuccessorPredecessorCurrentHead {
  readonly schemaVersion: string;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly packageSha256: string;
}

export type PayloadClassName =
  | 'current-runtime-referenced'
  | 'archive-only'
  | 'authoring-only'
  | 'mixed-unresolved'
  | 'other-tracked';

export interface PayloadClassAggregate {
  readonly className: PayloadClassName;
  readonly blobCount: number;
  readonly duplicateBlobCount: number;
  readonly pathCount: number;
  readonly byteTotal: number;
}

export interface HotspotMetricVector {
  readonly sourceBytes: number;
  readonly functionCount: number;
  readonly branchCount: number;
  readonly importBreadth: number;
  readonly fanIn: number;
  readonly fanOut: number;
  readonly changeFrequency: number;
  readonly testDensity: number;
  readonly trustDensity: number;
}

export interface HotspotEntry {
  readonly rank: number;
  readonly identity: string;
  readonly metrics: HotspotMetricVector;
  readonly changeCenter: boolean;
  readonly evidence: readonly string[];
}

export interface OwnerResidueConsumer {
  readonly path: string;
  readonly kind: string;
  readonly relationship: string;
}

export interface OwnerResidueRecord {
  readonly id: string;
  readonly source: 'current-head-delta' | 'census-duplicate-owner' | 'census-public-entrypoint';
  readonly identity: string;
  readonly currentOwnerEvidence: readonly string[];
  readonly candidateTargetOwners: readonly string[];
  readonly consumers: readonly OwnerResidueConsumer[];
  readonly consumerClass: string;
  readonly deletionCondition: string;
  readonly trustBoundary: string | null;
  readonly state: 'observation' | 'ambiguous' | 'unresolved';
  readonly evidence: readonly string[];
  readonly rollbackReference: string;
  readonly notes: readonly string[];
}

export interface SuccessorHandoff {
  readonly consumer: 'B-owner-residue' | 'C-payload-classes' | 'D-test-baseline' | 'N5-activation';
  readonly requiredIdentity: string;
  readonly locators: readonly string[];
  readonly failClosedRule: string;
}

export interface PostConvergenceEnvelope {
  readonly schemaVersion: typeof POST_CONVERGENCE_SCHEMA_VERSION;
  readonly successorCaptureId: string;
  readonly status: PostConvergenceStatus;
  readonly statusEvidence: readonly { stage: PostConvergenceStatus; evidence: string }[];
  readonly captureIdentity: CaptureIdentity;
  readonly originIntegrationCommit: string;
  readonly commandScope: typeof POST_CONVERGENCE_COMMAND_SCOPE;
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly schemaVersions: Readonly<Record<string, string>>;
  readonly predecessorBaseline: SuccessorPredecessorBaseline;
  readonly predecessorCurrentHead: SuccessorPredecessorCurrentHead;
  readonly successorCoreSha256: string;
  readonly inventoryKindSet: readonly InventoryKind[];
  readonly predecessorKindSet: readonly string[];
  readonly materialLayers: readonly MaterialLayerManifest[];
  readonly layerReconciliation: {
    readonly trackedFileCount: number;
    readonly layerAssignedCount: number;
    readonly unassignedCount: number;
  };
  readonly denominatorSlices: readonly DerivedSliceManifest[];
  readonly ownerResidueTotals: {
    readonly total: number;
    readonly observation: number;
    readonly ambiguous: number;
    readonly unresolved: number;
  };
  readonly hotspotTotals: {
    readonly limit: number;
    readonly ranked: number;
    readonly unresolvedMetrics: number;
  };
  readonly payloadClassTotals: {
    readonly duplicateBlobCount: number;
    readonly classes: readonly PayloadClassAggregate[];
    readonly unresolvedCount: number;
  };
  readonly frozenReceiptIds: readonly string[];
  readonly handoff: readonly SuccessorHandoff[];
  readonly artifacts: readonly SuccessorArtifactLocator[];
  readonly digestScope: string;
  readonly packageDigest: string;
}
