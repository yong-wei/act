import { describe, expect, it } from 'vitest';

import { resolvePathCenterViewerHref } from '../adaptive-path-destination-contract';

describe('resolvePathCenterViewerHref', () => {
  it('opens destination-control app pages in the shared viewer', () => {
    expect(resolvePathCenterViewerHref({
      disposition: 'destination-control',
      canonicalTarget: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    })).toBe('/interactive-learning/courses/unit-1-1-see-the-full-picture');
  });

  it('keeps path-center raw files and in-page practice on the existing launch paths', () => {
    expect(resolvePathCenterViewerHref({
      disposition: 'path-center-explicit',
      canonicalTarget: '/course-runtime/lessons/demo/handout.md',
    })).toBeNull();
    expect(resolvePathCenterViewerHref({
      disposition: 'destination-control',
      canonicalTarget: '/course-runtime/lessons/demo/handout.md',
    })).toBeNull();
    expect(resolvePathCenterViewerHref({
      disposition: 'destination-control',
      canonicalTarget: '/assessment/adaptive-practice?goalId=control-correction&questionScope=terminal-validation',
    })).toBeNull();
  });

  it('does not open the viewer for blocked or external fallbacks', () => {
    expect(resolvePathCenterViewerHref({
      disposition: 'blocked',
      canonicalTarget: '/interactive-learning/courses/unit-1-1-see-the-full-picture',
    })).toBeNull();
    expect(resolvePathCenterViewerHref({
      disposition: 'external-fallback',
      canonicalTarget: 'https://example.com/resource',
    })).toBeNull();
  });
});
