import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { TeachingResourceRuntime, TeachingResourceType } from '@/lib/teaching-projection/contracts';
import { toResourceIdToken } from '@/lib/teaching-projection/textbook-locators/identity';
import { buildTeachingResourceLaunchMaps } from '../teaching-resource-launch-maps';

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

describe('teaching resource launch maps', () => {
  it('keeps lesson, handout, and step contracts and maps lesson-owned media', () => {
    const maps = buildTeachingResourceLaunchMaps([
      resource('act:lesson:3-2', 'lesson'),
      resource('act:handout:3-2', 'handout'),
      resource('act:step:3-2:step-01', 'step'),
      resource('act:video:handout-3-2', 'video'),
      resource('act:audio:3-2', 'audio'),
    ]);
    expect(maps.resourceLaunchTargets).toMatchObject({
      'act:lesson:3-2': '/interactive-learning/courses/unit-3-2-routh-stability-boundary',
      'act:handout:3-2': '/interactive-learning/lessons/3-2/handout-print',
      'act:step:3-2:step-01': '/interactive-learning/courses/unit-3-2-routh-stability-boundary/student/demo?step=step-01',
      'act:video:handout-3-2': '/interactive-learning/courses/unit-3-2-routh-stability-boundary',
      'act:audio:3-2': '/interactive-learning/courses/unit-3-2-routh-stability-boundary',
    });
  });

  it('maps lesson-owned exercises to the course page and prefers an explicit step mapping', () => {
    const exercise = resource('act:exercise:handout-4-5', 'exercise');
    expect(buildTeachingResourceLaunchMaps([exercise]).resourceLaunchTargets[exercise.resourceId]).toBe(
      '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization',
    );
    expect(buildTeachingResourceLaunchMaps([exercise], {
      exerciseStepByResourceId: {
        [exercise.resourceId]: { lessonKey: '4-5', stepId: 'step-03' },
      },
    }).resourceLaunchTargets[exercise.resourceId]).toBe(
      '/interactive-learning/courses/unit-4-5-constraint-aware-parameter-optimization/student/demo?step=step-03',
    );
    expect(
      buildTeachingResourceLaunchMaps([
        resource('act:exercise:cruise-comfort-boppps', 'exercise'),
      ]).resourceLaunchTargets['act:exercise:cruise-comfort-boppps'],
    ).toBe('/interactive-learning/courses/cruise-comfort-boppps');
  });

  it('maps simulations only from exact resource origins', () => {
    const maps = buildTeachingResourceLaunchMaps([
      resource('act:simulation:arena-task-second-order-lead-pid', 'simulation'),
      resource('act:simulation:sim-scene-cruise', 'simulation'),
      resource('act:simulation:sim-pid-v1', 'simulation'),
      resource('act:simulation:sim-pid-v1-sim-pid-v1', 'simulation'),
      resource('act:simulation:control-odyssey-v1', 'simulation'),
      resource('act:simulation:odyssey-level-7', 'simulation'),
    ]);
    expect(maps.resourceLaunchTargets).toMatchObject({
      'act:simulation:arena-task-second-order-lead-pid': '/arena/challenges/task-second-order-lead-pid',
      'act:simulation:sim-scene-cruise': '/simulations/cruise',
      'act:simulation:sim-pid-v1': '/interactive-learning/resources/sim-pid-v1',
      'act:simulation:sim-pid-v1-sim-pid-v1': '/interactive-learning/resources/sim-pid-v1',
      'act:simulation:control-odyssey-v1': '/interactive-learning/control-odyssey',
      'act:simulation:odyssey-level-7': '/interactive-learning/control-odyssey',
    });
  });

  it('uses the viewer shell for cards and infographics and reader routes for sections', () => {
    const textbookId = `act:textbook-section:${toResourceIdToken(
      'dorf-modern-control-systems:chapter-01:section-01',
      'sourceAnchorId',
    )}`;
    const maps = buildTeachingResourceLaunchMaps([
      resource('act:card:safe-card', 'card'),
      resource('act:infographic:safe-infographic', 'infographic'),
      resource(textbookId, 'textbook-section'),
    ]);
    expect(maps.resourceLaunchTargets['act:card:safe-card']).toBeUndefined();
    expect(maps.resourceRegistryIds['act:card:safe-card']).toBe('viewer-shell');
    expect(maps.resourceRegistryIds['act:infographic:safe-infographic']).toBe('viewer-shell');
    expect(maps.resourceLaunchTargets[textbookId]).toBe(
      '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-01/section-01',
    );
  });

  it('opens the explicitly repaired chapter reference with its reviewed coordinates', () => {
    const id = 'act:textbook-chapter:dorf-modern-control-systems-14th:ch-root-locus-01';
    const maps = buildTeachingResourceLaunchMaps([resource(id, 'textbook-chapter')]);
    expect(maps.resourceLaunchTargets[id]).toBe(
      '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-07',
    );
  });

  it('leaves unknown, book-level, and unreviewed chapter targets unavailable without guessing coordinates', () => {
    const maps = buildTeachingResourceLaunchMaps([
      resource('act:project:ctc:canonical-node', 'project'),
      resource('act:simulation:unknown-registry', 'simulation'),
      resource('act:audio:no-lesson', 'audio'),
      resource('act:textbook:dorf-modern-control-systems-14th', 'textbook'),
      resource('act:textbook-chapter:dorf-modern-control-systems-14th:ch-unreviewed', 'textbook-chapter'),
    ]);
    expect(maps.resourceLaunchTargets).toEqual({});
    expect(Object.values(maps.resourceLaunchTargets)).not.toContain('ctc:canonical-node');
  });
});
