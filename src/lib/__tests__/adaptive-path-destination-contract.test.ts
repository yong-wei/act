import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  canonicalizeAdaptivePathInternalHref,
  resolveAdaptivePathDestinationContract,
} from '@/features/personalization/path-planning/adaptive-path-destination-contract';

describe('adaptive path destination contract', () => {
  it('accepts a teaching resource only when source context matches the resource URL', () => {
    expect(resolveAdaptivePathDestinationContract(
      'lesson_step',
      '/interactive-learning/resources/lesson13-physics-builder-simple',
      {
        nodeId: 'teaching-resource:lesson13-physics-builder-simple',
        sourceKind: 'teaching_resource',
        sourceRef: 'lesson13-physics-builder-simple',
      },
    )).toMatchObject({ disposition: 'destination-control', reason: null });
    expect(resolveAdaptivePathDestinationContract(
      'lesson_step',
      '/interactive-learning/resources/lesson13-physics-builder-simple',
      {
        nodeId: 'registry:lesson13-physics-builder-simple',
        sourceKind: 'resource_registry',
        sourceRef: 'lesson13-physics-builder-simple',
      },
    )).toMatchObject({ disposition: 'destination-control', reason: null });
  });

  it.each([
    {},
    { nodeId: 'teaching-resource:lesson13-physics-builder-simple', sourceKind: 'teaching_resource', sourceRef: 'other' },
    { nodeId: 'registry:lesson13-physics-builder-simple', sourceKind: 'teaching_resource', sourceRef: 'lesson13-physics-builder-simple' },
    { nodeId: 'teaching-resource:lesson13-physics-builder-simple', sourceKind: 'runtime_lesson_step', sourceRef: 'lesson13-physics-builder-simple' },
  ])('blocks missing or inconsistent interactive resource source context: %o', (context) => {
    expect(resolveAdaptivePathDestinationContract(
      'lesson_step',
      '/interactive-learning/resources/lesson13-physics-builder-simple',
      context,
    ).disposition).toBe('blocked');
  });

  it('permits registry-backed simulation and knowledge-card resources only with verified source context', () => {
    expect(resolveAdaptivePathDestinationContract(
      'simulation',
      '/simulations/step-response',
    ).disposition).toBe('destination-control');
    expect(resolveAdaptivePathDestinationContract(
      'simulation',
      '/interactive-learning/resources/simulation-id',
      { nodeId: 'registry:simulation-id', sourceKind: 'resource_registry', sourceRef: 'simulation-id' },
    ).disposition).toBe('destination-control');
    expect(resolveAdaptivePathDestinationContract(
      'knowledge_card',
      '/interactive-learning/resources/knowledge-card-id',
      { nodeId: 'registry:knowledge-card-id', sourceKind: 'resource_registry', sourceRef: 'knowledge-card-id' },
    ).disposition).toBe('destination-control');
    expect(resolveAdaptivePathDestinationContract(
      'simulation',
      '/interactive-learning/resources/simulation-id',
    ).disposition).toBe('blocked');
  });

  it('keeps the destination contract off the manifest course app loader graph', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/personalization/path-planning/adaptive-path-destination-contract.ts'),
      'utf8',
    );
    expect(source).toContain("from '@/features/interactive/shared/manifest-course-route-segments'");
    expect(source).not.toContain('manifest-course-app-loaders');
  });

  it('permits governed course student demo steps for simulation nodes', () => {
    expect(resolveAdaptivePathDestinationContract(
      'simulation',
      '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=step-11',
    )).toMatchObject({
      disposition: 'destination-control',
      reason: null,
    });
  });

  it('permits reviewed video, audio, and exercise destinations on student courses', () => {
    expect(resolveAdaptivePathDestinationContract(
      'video',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    )).toMatchObject({ disposition: 'destination-control', reason: null });
    expect(resolveAdaptivePathDestinationContract(
      'audio',
      '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    )).toMatchObject({ disposition: 'destination-control', reason: null });
    expect(resolveAdaptivePathDestinationContract(
      'exercise',
      '/assessment/adaptive-practice',
    )).toMatchObject({ disposition: 'destination-control', reason: null });
    expect(resolveAdaptivePathDestinationContract(
      'exercise',
      '/profile/growth?prompt=bode-drill',
    )).toMatchObject({ disposition: 'destination-control', reason: null });
  });

  it.each([
    '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo',
    '/interactive-learning/courses/unit-3-6-zero-design-workshop/student/demo?step=',
    '/interactive-learning/courses/not-a-registered-course/student/demo?step=step-11',
  ])('blocks incomplete or unregistered simulation course demo %s', (target) => {
    expect(resolveAdaptivePathDestinationContract('simulation', target)).toMatchObject({
      disposition: 'blocked',
      reason: 'unsupported-resource-type',
    });
  });

  it('blocks teacher course demo paths as non-student-visible simulation destinations', () => {
    expect(resolveAdaptivePathDestinationContract(
      'simulation',
      '/interactive-learning/courses/unit-3-6-zero-design-workshop/teacher/demo?step=step-11',
    )).toMatchObject({
      disposition: 'blocked',
      reason: 'non-student-visible-target',
    });
  });

  it.each([
    ['simulation', '/interactive-learning/courses/unit-1-2-modeling-from-object-to-system', 'unsupported-resource-type'],
    ['project', '/missions?project=goal', 'non-student-visible-target'],
    ['reflection', '/profile/growth?prompt=reflect', 'unsupported-resource-type'],
    ['ai_intervention', '/ai/private-hint', 'non-student-visible-target'],
    ['checkpoint', '/assessment/checkpoints/bode-after-external', 'unsupported-resource-type'],
    ['lesson_step', '/teacher/resources/assigned-card', 'non-student-visible-target'],
  ])('fails closed for unsupported %s destination %s', (resourceType, target, reason) => {
    expect(resolveAdaptivePathDestinationContract(resourceType, target)).toMatchObject({
      disposition: 'blocked',
      reason,
    });
  });

  it('preserves path-center and external destination rules', () => {
    expect(resolveAdaptivePathDestinationContract(
      'textbook_section',
      '/course-runtime/resources/textbooks/book/sections/ch01.md',
    ).disposition).toBe('path-center-explicit');
    expect(resolveAdaptivePathDestinationContract(
      'external_resource',
      'https://example.edu/resource',
    ).disposition).toBe('external-fallback');
    expect(resolveAdaptivePathDestinationContract(
      'external_resource',
      'http://example.edu/resource',
    ).disposition).toBe('blocked');
  });

  it('canonicalizes only safe internal hrefs', () => {
    expect(canonicalizeAdaptivePathInternalHref('/interactive-learning/resources/demo?source=path')).toBe(
      '/interactive-learning/resources/demo?source=path',
    );
    expect(canonicalizeAdaptivePathInternalHref('/course-runtime/%2e%2e/api/private')).toBeNull();
  });
});
