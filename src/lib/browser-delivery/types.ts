export const TOOL_VERSION = 'browser-delivery/1' as const;
export const MANIFEST_SCHEMA = 'browser-delivery-manifest/v1' as const;
export const PUBLICATION_SCHEMA = 'browser-delivery-publication/v1' as const;
export const ROUTING_SCHEMA = 'browser-delivery-routing/v1' as const;

export const COHORT_ID = 'simulation-glb-v1' as const;
export const DELIVERY_BUCKET = 'act-course-delivery';
export const AUTHORITY_BUCKET = 'act-course-assets';
export const STATIC_HOSTNAME = 'static.adapt-learn.online';
export const MEDIA_TYPE = 'model/gltf-binary' as const;
export const CACHE_CLASS = 'assets-immutable' as const;
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable' as const;
export const OPTIMIZER_NAME = '@act/glb-model-optimizer';
export const OPTIMIZER_LEVEL = 'medium' as const;

export const SHA256 = /^[a-f0-9]{64}$/;
export const GIT_SHA = /^[a-f0-9]{40}$/;

export const SIMULATION_MODELS = [
  { logicalId: 'destroyer', basename: 'destroyer.glb' },
  { logicalId: 'icebreaker', basename: 'icebreaker.glb' },
  { logicalId: 'lng-carrier', basename: 'Lng-carrier.glb' },
  { logicalId: 'container', basename: 'container.glb' },
  { logicalId: 'dredger', basename: 'dredger.glb' },
  { logicalId: 'luxury-liner', basename: 'luxury-liner.glb' },
  { logicalId: 'drilling-rig', basename: 'drilling-rig.glb' },
] as const;

export type SimulationModelId = (typeof SIMULATION_MODELS)[number]['logicalId'];
export const SIMULATION_MODEL_IDS = SIMULATION_MODELS.map((model) => model.logicalId);
export const ROUTING_STATUSES = ['qualified', 'incomplete', 'blocked'] as const;
export type RoutingStatus = (typeof ROUTING_STATUSES)[number];

export interface GitCapture {
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly dirty: boolean;
  readonly mixedWorktree: boolean;
}

export interface OptimizerIdentity {
  readonly name: typeof OPTIMIZER_NAME;
  readonly version: string;
  readonly configDigest: string;
}

export interface ManifestEntry {
  readonly logicalId: SimulationModelId;
  readonly basename: string;
  readonly sourcePath: string;
  readonly sourceGitBlob: string;
  readonly sourceSha256: string;
  readonly sourceBytes: number;
  readonly optimizedPath: string;
  readonly outputSha256: string | null;
  readonly outputBytes: number | null;
  readonly mediaType: typeof MEDIA_TYPE;
  readonly publicEligible: true;
  readonly included: boolean;
  readonly exclusionReason: string | null;
  readonly objectKey: string | null;
  readonly originalUrl: string;
  readonly optimizedUrl: string;
}

export interface BrowserDeliveryManifest {
  readonly schemaVersion: typeof MANIFEST_SCHEMA;
  readonly cohortId: typeof COHORT_ID;
  readonly toolVersion: typeof TOOL_VERSION;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly capturedAt: string;
  readonly optimizer: OptimizerIdentity;
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly entries: readonly ManifestEntry[];
  readonly manifestDigest: string;
}

export interface PublicationObject {
  readonly logicalId: SimulationModelId;
  readonly objectKey: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly mediaType: typeof MEDIA_TYPE;
  readonly basename: string;
}

export interface PublicationReceipt {
  readonly schemaVersion: typeof PUBLICATION_SCHEMA;
  readonly cohortId: typeof COHORT_ID;
  readonly bucket: typeof DELIVERY_BUCKET;
  readonly manifestDigest: string;
  readonly applied: boolean;
  readonly objects: readonly PublicationObject[];
  readonly missing: readonly string[];
  readonly blockingReasons: readonly string[];
}

export interface RoutingReceipt {
  readonly schemaVersion: typeof ROUTING_SCHEMA;
  readonly cohortId: typeof COHORT_ID;
  readonly toolVersion: typeof TOOL_VERSION;
  readonly sourceCommit: string;
  readonly sourceTree: string;
  readonly capturedAt: string;
  readonly status: RoutingStatus;
  readonly manifestDigest: string;
  readonly esaFirst: boolean;
  readonly blockingReasons: readonly string[];
  readonly missingEvidence: readonly string[];
}

export interface ResolvedSimulationModel {
  readonly logicalId: SimulationModelId;
  readonly originalUrl: string;
  readonly optimizedUrl: string;
  readonly esaUrl: string | null;
  readonly candidates: readonly string[];
  readonly primary: string;
}
