import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';

import { createPublishedArtifactAdapter } from './adapters/published-artifact';
import { createRenderMetadataAdapter } from './adapters/render-metadata';
import { buildResourceRegistryIndex } from './builder';
import type { RegistryIndex } from './types';

const LIVE_SHARED_REVISION = 'live-render-metadata';

let memoized: { digest: string; index: RegistryIndex } | null = null;

function publishedArtifactsNoneDeclared() {
  return createPublishedArtifactAdapter({
    owner: 'published-artifact-none-declared',
    sharedRevision: LIVE_SHARED_REVISION,
    records: [],
  });
}

export function captureLiveResourceRegistryIndex(): RegistryIndex {
  const records = getAllRegisteredResourceMetadata();
  const index = buildResourceRegistryIndex([
    createRenderMetadataAdapter({
      records,
      sharedRevision: LIVE_SHARED_REVISION,
    }),
    publishedArtifactsNoneDeclared(),
  ]);
  return index;
}

export function getLiveResourceRegistryIndex(): RegistryIndex {
  const index = captureLiveResourceRegistryIndex();
  if (memoized && memoized.digest === index.digest) {
    return memoized.index;
  }
  memoized = { digest: index.digest, index };
  return index;
}

export function resetLiveResourceRegistryIndexCache(): void {
  memoized = null;
}
