import { describe, expect, it } from 'vitest';

import { INTERACTIVE_COURSE_MODULES } from '../learning-catalog';

describe('INTERACTIVE_COURSE_MODULES', () => {
  it('exposes module 2 and module 3 on the interactive course hub', () => {
    expect(INTERACTIVE_COURSE_MODULES.map((module) => module.id)).toEqual(['module-2', 'module-3']);
  });

  it('does not surface retired module 1 lessons anywhere on the hub', () => {
    const retiredLessonIds = [
      'l2a-time-domain-fasttrack',
      'l2b-root-locus-fasttrack',
      'l2c-frequency-bode-fasttrack',
      'l2d-three-domain-linkage-practice',
      'lsum-design-feasible-domain',
      'unit-1-1-laplace-transfer-function',
      'unit-1-2-block-diagram-simplification',
      'unit-1-3-time-domain-response',
    ];

    expect(
      INTERACTIVE_COURSE_MODULES.some((module) =>
        module.lessons.some((lesson) => retiredLessonIds.includes(lesson.id))
      )
    ).toBe(false);
  });

  it('exposes unit 2-1, unit 2-2, unit 2-3, and unit 2-4 in module 2', () => {
    expect(INTERACTIVE_COURSE_MODULES[0]?.lessons.map((lesson) => ({
      id: lesson.id,
      unitLabel: lesson.unitLabel,
      legacySourceLabel: lesson.legacySourceLabel ?? null,
    }))).toEqual([
      {
        id: 'unit-2-1-modeling-language',
        unitLabel: '2-1',
        legacySourceLabel: null,
      },
      {
        id: 'unit-2-2-time-domain-response',
        unitLabel: '2-2',
        legacySourceLabel: null,
      },
      {
        id: 'unit-2-3-frequency-response-bode-intro',
        unitLabel: '2-3',
        legacySourceLabel: null,
      },
      {
        id: 'unit-2-4-nyquist-margin-entry',
        unitLabel: '2-4',
        legacySourceLabel: null,
      },
    ]);
  });

  it('exposes unit 3-1 and unit 3-2 as premium lessons in module 3', () => {
    expect(INTERACTIVE_COURSE_MODULES[1]?.lessons.map((lesson) => ({
      id: lesson.id,
      unitLabel: lesson.unitLabel,
      legacySourceLabel: lesson.legacySourceLabel ?? null,
    }))).toEqual([
      {
        id: 'unit-3-1-pure-pole-stability-and-dynamics',
        unitLabel: '3-1',
        legacySourceLabel: null,
      },
      {
        id: 'unit-3-2-routh-stability-boundary',
        unitLabel: '3-2',
        legacySourceLabel: null,
      },
    ]);
  });

  it('does not use legacy source labels on the current mainline units', () => {
    expect(INTERACTIVE_COURSE_MODULES[0]?.lessons.every((lesson) => lesson.legacySourceLabel == null)).toBe(true);
  });
});
