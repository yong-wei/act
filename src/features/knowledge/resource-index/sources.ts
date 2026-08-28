import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

import { createPublishedArtifactAdapter } from './adapters/published-artifact';
import { createRenderMetadataAdapter } from './adapters/render-metadata';
import { buildResourceRegistryIndex } from './builder';
import { resolveLiveResourceIndexRevision } from './revision';
import type { RegistryIndex } from './types';

let memoized: RegistryIndex | null = null;

function publishedArtifactsNoneDeclared(sharedRevision: string) {
  return createPublishedArtifactAdapter({
    owner: 'published-artifact-none-declared',
    sharedRevision,
    records: [],
  });
}

export function captureLiveResourceRegistryIndex(): RegistryIndex {
  const sharedRevision = resolveLiveResourceIndexRevision();
  const records = getAllRegisteredResourceMetadata();
  return buildResourceRegistryIndex([
    createRenderMetadataAdapter({
      records,
      sharedRevision,
    }),
    publishedArtifactsNoneDeclared(sharedRevision),
  ]);
}

export function getLiveResourceRegistryIndex(): RegistryIndex {
  if (memoized) return memoized;
  memoized = captureLiveResourceRegistryIndex();
  return memoized;
}

export function resetLiveResourceRegistryIndexCache(): void {
  memoized = null;
}
