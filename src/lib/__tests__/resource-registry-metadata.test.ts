import { describe, expect, it } from 'vitest';

import {
  getAllRegisteredResourceMetadata,
  getRegisteredResourceMetadataByNodeId,
} from '../resource-registry-metadata';
import { getTeachingLaunchRouteRecords } from '../teaching-launch-route-records';

describe('getRegisteredResourceMetadataByNodeId', () => {
  it('resolves registry resource node ids to their canonical metadata', () => {
    expect(getRegisteredResourceMetadataByNodeId('registry:lesson09-correction-precheck')).toMatchObject({
      id: 'lesson09-correction-precheck',
      renderTarget: '/interactive-learning/resources/lesson09-correction-precheck',
    });
  });

  it('resolves arena resource node ids to their canonical title and launch target', () => {
    expect(getRegisteredResourceMetadataByNodeId('arena-task:task-second-order-lead-pid')).toMatchObject({
      id: 'arena-challenge-workbench',
      label: expect.any(String),
      launchTarget: '/arena/challenges/task-second-order-lead-pid',
    });
  });

  it('does not synthesize metadata for unknown resource node ids', () => {
    expect(getRegisteredResourceMetadataByNodeId('arena-task:unknown-task')).toBeUndefined();
    expect(getRegisteredResourceMetadataByNodeId('external:unknown-resource')).toBeUndefined();
  });
});

describe('teaching launch route records', () => {
  it('keeps synthetic course routes out of the curated resource inventory', () => {
    expect(getAllRegisteredResourceMetadata().some((row) => row.id.startsWith('teaching-launch-route:'))).toBe(false);
    expect(getTeachingLaunchRouteRecords().some((row) => row.id.startsWith('teaching-launch-route:'))).toBe(true);
  });
});
