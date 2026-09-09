import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildResourceRegistryIndex } from '@/features/knowledge/resource-index/builder';
import { createRenderMetadataAdapter } from '@/features/knowledge/resource-index/adapters/render-metadata';
import { buildTeachingResourceLaunchMaps } from '@/lib/layered-graph/teaching-resource-launch-maps';
import { getAllRegisteredResourceMetadata } from '@/lib/resource-registry-metadata';
import { getTeachingLaunchRouteRecords, createTeachingLaunchRouteRecord } from '@/lib/teaching-launch-route-records';
import type { TeachingResourceRuntime, TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { toResourceIdToken } from '@/lib/teaching-projection/textbook-locators/identity';
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

  it('owns textbook-section hrefs through exact index entries, not a path whitelist', () => {
    const resourceId = `act:textbook-section:${toResourceIdToken(
      'dorf-modern-control-systems:chapter-01:section-01',
      'sourceAnchorId',
    )}`;
    const href = buildTeachingResourceLaunchMaps([
      resource(resourceId, 'textbook-section'),
    ]).resourceLaunchTargets[resourceId];
    expect(href).toMatch(/^\/textbooks\//);
    const unregistered = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        records: getAllRegisteredResourceMetadata(),
        sharedRevision: 'a'.repeat(40),
      }),
    ]);
    expect(indexOwnsLaunchHref(unregistered, href!)).toBe(false);
    const registered = buildResourceRegistryIndex([
      createRenderMetadataAdapter({
        records: [createTeachingLaunchRouteRecord(href!)],
        sharedRevision: 'a'.repeat(40),
      }),
    ]);
    expect(indexOwnsLaunchHref(registered, href!)).toBe(true);
  });

  it('registers live textbook-section hrefs from the active teaching projection', () => {
    const records = getTeachingLaunchRouteRecords();
    expect(records.some((row) => row.launchTarget?.startsWith('/textbooks/'))).toBe(true);
  });
});
