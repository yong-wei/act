import { describe, expect, it } from 'vitest';

import {
  canonicalizeAdaptivePathInternalHref,
  resolveAdaptivePathDestinationContract,
} from '../adaptive-path-destination-contract';

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
