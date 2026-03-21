import { describe, expect, it } from 'vitest';

import { LEGACY_LESSONS, PREMIUM_LESSONS } from '../learning-catalog';

describe('PREMIUM_LESSONS', () => {
  it('includes unit 1-2 in the premium interactive lesson entry', () => {
    expect(PREMIUM_LESSONS.some((lesson) => lesson.id === 'unit-1-2-block-diagram-simplification')).toBe(true);
  });

  it('does not leave unit 1-2 in the legacy lesson list', () => {
    expect(LEGACY_LESSONS.some((lesson) => lesson.id === 'unit-1-2-block-diagram-simplification')).toBe(false);
  });

  it('includes unit 1-3 in the premium interactive lesson entry', () => {
    expect(PREMIUM_LESSONS.some((lesson) => lesson.id === 'unit-1-3-time-domain-response')).toBe(true);
  });

  it('does not leave unit 1-3 in the legacy lesson list', () => {
    expect(LEGACY_LESSONS.some((lesson) => lesson.id === 'unit-1-3-time-domain-response')).toBe(false);
  });
});
