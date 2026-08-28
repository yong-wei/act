export {
  RESOURCE_REGISTRY_INDEX_CONTRACT,
  RESOURCE_REGISTRY_INDEX_GENERATOR_VERSION,
  RENDER_METADATA_SOURCE_KIND,
  RESOURCE_NODE_SOURCE_KIND,
  PUBLISHED_ARTIFACT_SOURCE_KIND,
} from './types';
export type {
  IndexedResourceEntry,
  RegistryIndex,
  ResourceDescriptor,
  ResourceIdentity,
  SourceAdapter,
  SourceAdapterResult,
} from './types';
export { ResourceRegistryIndexError } from './errors';
export { buildResourceIdentity } from './identity';
export { buildResourceRegistryIndex, serializeResourceRegistryIndex } from './builder';
export { createRenderMetadataAdapter } from './adapters/render-metadata';
export { createResourceNodeAdapter } from './adapters/resource-node';
export { createPublishedArtifactAdapter } from './adapters/published-artifact';
export { resolveIndexedResource, canRevealIndexedResource } from './resolve';
export { resolveLiveResourceIndexRevision } from './revision';
export {
  captureLiveResourceRegistryIndex,
  getLiveResourceRegistryIndex,
  resetLiveResourceRegistryIndexCache,
} from './sources';
export { resolveStudentVisibleIndexedResource, projectStudentReadFromIndex } from './student-read';
export type { StudentIndexedResourceRead } from './student-read';
