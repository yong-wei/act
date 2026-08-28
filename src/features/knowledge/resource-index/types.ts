export const RESOURCE_REGISTRY_INDEX_CONTRACT = 'resource-registry-index/v1';
export const RESOURCE_REGISTRY_INDEX_GENERATOR_VERSION = 'resource-registry-index.v1';

export const RENDER_METADATA_SOURCE_KIND = 'render-metadata';
export const RESOURCE_NODE_SOURCE_KIND = 'resource-node';
export const PUBLISHED_ARTIFACT_SOURCE_KIND = 'published-artifact';

export const RENDER_METADATA_ADAPTER_VERSION = 'render-metadata.v1';
export const RESOURCE_NODE_ADAPTER_VERSION = 'resource-node.v1';
export const PUBLISHED_ARTIFACT_ADAPTER_VERSION = 'published-artifact.v1';

export type ResourceIndexSourceKind =
  | typeof RENDER_METADATA_SOURCE_KIND
  | typeof RESOURCE_NODE_SOURCE_KIND
  | typeof PUBLISHED_ARTIFACT_SOURCE_KIND;

export type ResourceAvailability = 'available' | 'degraded' | 'unavailable';

export type ResourceRegistryIndexErrorCode =
  | 'UNOWNED_ADAPTER'
  | 'MISSING_CAPTURE'
  | 'MISSING_REQUIRED_FIELD'
  | 'DUPLICATE_SOURCE_REF'
  | 'DUPLICATE_IDENTITY'
  | 'CONFLICT_MERGE'
  | 'MIXED_CAPTURE'
  | 'IDENTITY_MISMATCH'
  | 'UNSAFE_DESCRIPTOR'
  | 'UNKNOWN_SOURCE';

export interface ResourceIdentity {
  key: string;
  sourceKind: ResourceIndexSourceKind;
  sourceRef: string;
  sourceVersion: string;
  contentHash: string;
  scope: string;
}

export interface ResourceForeignRefs {
  registryId?: string;
  teachingResourceId?: string;
  runtimeResourceRef?: string;
  canonicalIds?: readonly string[];
  resourceNodeId?: string;
  formalBindingIds?: readonly string[];
}

export interface ResourceLauncherDescriptor {
  contractClass: string;
  contractVersion: string;
  launcherRef?: string;
}

export interface ResourceDescriptor {
  identity: ResourceIdentity;
  title: string;
  type: string;
  availability: ResourceAvailability;
  availabilityCode: string;
  status: string;
  foreignRefs: ResourceForeignRefs;
  launcher: ResourceLauncherDescriptor | null;
  safeConfig?: Record<string, string | number | boolean>;
}

export interface IndexedResourceAccess {
  teacherPolicy?: string;
  privacyLevel?: string;
  sourceAvailability?: string;
}

export interface IndexedResourceEntry {
  descriptor: ResourceDescriptor;
  access: IndexedResourceAccess;
  required: boolean;
}

export interface SourceCaptureIdentity {
  owner: string;
  sourceKind: ResourceIndexSourceKind;
  adapterVersion: string;
  inputDigest: string;
  recordCount: number;
  sharedRevision?: string;
}

export interface AdapterRecord {
  sourceRef: string;
  sourceVersion: string;
  contentHash: string;
  scope: string;
  title: string;
  type: string;
  required: boolean;
  availability: ResourceAvailability;
  availabilityCode: string;
  status: string;
  foreignRefs: ResourceForeignRefs;
  launcher: ResourceLauncherDescriptor | null;
  access?: IndexedResourceAccess;
  safeConfig?: Record<string, string | number | boolean>;
}

export interface SourceAdapterResult {
  owner: string;
  sourceKind: ResourceIndexSourceKind;
  adapterVersion: string;
  capture: SourceCaptureIdentity;
  records: readonly AdapterRecord[];
}

export type SourceAdapter = () => SourceAdapterResult;

export interface RegistryIndex {
  contract: typeof RESOURCE_REGISTRY_INDEX_CONTRACT;
  generatorVersion: string;
  identity: string;
  captures: SourceCaptureIdentity[];
  entries: IndexedResourceEntry[];
  digest: string;
}

export interface ResolveIndexedResourceInput {
  index: RegistryIndex;
  sourceKind?: ResourceIndexSourceKind;
  sourceRef?: string;
  identityKey?: string;
  role: 'student' | 'teacher' | 'admin';
}
