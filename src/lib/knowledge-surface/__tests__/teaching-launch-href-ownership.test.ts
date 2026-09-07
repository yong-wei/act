import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildResourceRegistryIndex } from '@/features/knowledge/resource-index/builder';
import { createRenderMetadataAdapter } from '@/features/knowledge/resource-index/adapters/render-metadata';
import { buildTeachingResourceLaunchMaps } from '@/lib/layered-graph/course-page-context';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { getTeachingLaunchRouteRecords } from '@/lib/teaching-launch-route-records';
import type { TeachingResourceRuntime, TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { indexOwnsLaunchHref } from '../registry-closure';

function resource(resourceId: string, resourceType: TeachingResourceType): TeachingResourceRuntime {
  return {
    resourceId,
    resourceType,
    projectionMode: 'OPTIONAL',
    scopeId: 'course-package:3-2',
    title: resourceId,
    sourcePath: null,
    legacyCrosswalkRef: null,
    bindingCount: 1,
    bindingStatus: 'BOUND',
    projectionStatus: 'BOUND',
    bindingDigest: 'a'.repeat(64),
  };
}

describe('teaching launch href ownership', () => {
  it('owns every page href emitted by the teaching launch map', () => {
    const resources = [
      resource('act:lesson:3-2', 'lesson'),
      resource('act:handout:3-2', 'handout'),
      resource('act:audio:3-2', 'audio'),
      resource('act:exercise:handout-3-2', 'exercise'),
      resource('act:exercise:handout-4-5', 'exercise'),
      resource('act:simulation:odyssey-level-7', 'simulation'),
      resource('act:simulation:arena-task-second-order-lead-pid', 'simulation'),
      resource('act:simulation:sim-scene-cruise', 'simulation'),
      resource('act:simulation:sim-pid-v1', 'simulation'),
      resource('act:simulation:control-odyssey-v1', 'simulation'),
      resource('act:card:safe-card', 'card'),
    ];
    const maps = buildTeachingResourceLaunchMaps(resources, {
      exerciseStepByResourceId: {
        'act:exercise:handout-3-2': { lessonKey: '3-2', stepId: 'step-01' },
      },
    });
    const index = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        records: [
          ...getAllRegisteredResourceMetadata(),
          ...getTeachingLaunchRouteRecords(),
        ],
        sharedRevision: 'a'.repeat(40),
      }),
    ]);
    for (const href of Object.values(maps.resourceLaunchTargets)) {
      if (href) expect(indexOwnsLaunchHref(index, href), href).toBe(true);
    }
    expect(maps.resourceRegistryIds['act:card:safe-card']).toBe('viewer-shell');
    expect(maps.resourceLaunchTargets['act:card:safe-card']).toBeUndefined();
  });
});
