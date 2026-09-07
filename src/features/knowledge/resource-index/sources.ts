import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { getTeachingLaunchRouteRecords } from '@/lib/teaching-launch-route-records';
import { resolveConfiguredTeachingProjectionRoot } from '@/lib/teaching-projection/live-course-pointer';
import {
  readCurrentTeachingProjectionPointer,
  resolveTeachingProjectionStorePaths,
} from '@/lib/teaching-projection/store';

import { createPublishedArtifactAdapter } from './adapters/published-artifact';
import { createRenderMetadataAdapter } from './adapters/render-metadata';
import { buildResourceRegistryIndex } from './builder';
import { resolveLiveResourceIndexRevision } from './revision';
import type { RegistryIndex } from './types';

let memoized: { key: string; index: RegistryIndex } | null = null;

function publishedArtifactsNoneDeclared(sharedRevision: string) {
  return createPublishedArtifactAdapter({
    owner: 'published-artifact-none-declared',
    sharedRevision,
    records: [],
  });
}

function readTeachingProjectionPointerIdentity(cwd: string): string {
  try {
    const pointer = readCurrentTeachingProjectionPointer(
      resolveTeachingProjectionStorePaths(
        resolveConfiguredTeachingProjectionRoot(cwd),
      ),
    );
    const projectionId = pointer?.projectionId?.trim() ?? '';
    const projectionHash = pointer?.projectionHash?.trim() ?? '';
    if (!projectionId || !projectionHash) return 'teaching-projection:none';
    return `teaching-projection:${projectionId}:${projectionHash}`;
  } catch {
    return 'teaching-projection:invalid';
  }
}

export function readLiveResourceRegistryIndexMemoKey(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): string {
  return `${resolveLiveResourceIndexRevision(env, cwd)}|${readTeachingProjectionPointerIdentity(cwd)}`;
}

export function captureLiveResourceRegistryIndex(): RegistryIndex {
  const sharedRevision = resolveLiveResourceIndexRevision();
  const records = [
    ...getAllRegisteredResourceMetadata(),
    ...getTeachingLaunchRouteRecords(),
  ];
  return buildResourceRegistryIndex([
    createRenderMetadataAdapter({
      records,
      sharedRevision,
    }),
    publishedArtifactsNoneDeclared(sharedRevision),
  ]);
}

export function getLiveResourceRegistryIndex(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
): RegistryIndex {
  const key = readLiveResourceRegistryIndexMemoKey(env, cwd);
  if (memoized?.key === key) return memoized.index;
  memoized = {
    key,
    index: captureLiveResourceRegistryIndex(),
  };
  return memoized.index;
}

export function resetLiveResourceRegistryIndexCache(): void {
  memoized = null;
}
