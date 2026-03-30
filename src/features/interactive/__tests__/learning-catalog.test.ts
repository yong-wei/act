import { describe, expect, it } from 'vitest';

import { INTERACTIVE_COURSE_MODULES } from '../learning-catalog';

describe('INTERACTIVE_COURSE_MODULES', () => {
  it('only exposes module 1 and module 2 on the interactive course hub', () => {
    expect(INTERACTIVE_COURSE_MODULES.map((module) => module.id)).toEqual(['module-1', 'module-2']);
  });

  it('maps the legacy L-series lessons into module 1 unit slots in order', () => {
    expect(INTERACTIVE_COURSE_MODULES[0]?.lessons.map((lesson) => ({
      id: lesson.id,
      unitLabel: lesson.unitLabel,
    }))).toEqual([
      { id: 'l2a-time-domain-fasttrack', unitLabel: '1-1' },
      { id: 'l2b-root-locus-fasttrack', unitLabel: '1-2' },
      { id: 'l2c-frequency-bode-fasttrack', unitLabel: '1-3' },
      { id: 'l2d-three-domain-linkage-practice', unitLabel: '1-4' },
      { id: 'lsum-design-feasible-domain', unitLabel: '1-5' },
    ]);
  });

  it('marks module 1 cards as legacy mappings', () => {
    expect(INTERACTIVE_COURSE_MODULES[0]?.lessons.every((lesson) => lesson.legacySourceLabel)).toBe(true);
  });

  it('only exposes unit 2-1 in module 2', () => {
    expect(INTERACTIVE_COURSE_MODULES[1]?.lessons.map((lesson) => ({
      id: lesson.id,
      unitLabel: lesson.unitLabel,
      legacySourceLabel: lesson.legacySourceLabel ?? null,
    }))).toEqual([
      {
        id: 'unit-2-1-modeling-language',
        unitLabel: '2-1',
        legacySourceLabel: null,
      },
    ]);
  });

  it('does not surface unit 1-3 on the interactive course hub', () => {
    expect(
      INTERACTIVE_COURSE_MODULES.some((module) =>
        module.lessons.some((lesson) => lesson.id === 'unit-1-3-time-domain-response')
      )
    ).toBe(false);
  });
});
