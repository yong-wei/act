import { describe, expect, it } from 'vitest';

import { INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '../learning-catalog';
import { UNIT_2_2_TIME_DOMAIN_RESPONSE_PRESET } from '@/features/teacher/preset-lessons/presets/unit-2-2-time-domain-response';
import { UNIT_2_3_FREQUENCY_RESPONSE_BODE_INTRO_PRESET } from '@/features/teacher/preset-lessons/presets/unit-2-3-frequency-response-bode-intro';
import { UNIT_2_4_NYQUIST_MARGIN_ENTRY_PRESET } from '@/features/teacher/preset-lessons/presets/unit-2-4-nyquist-margin-entry';
import { UNIT_3_1_PURE_POLE_STABILITY_AND_DYNAMICS_PRESET } from '@/features/teacher/preset-lessons/presets/unit-3-1-pure-pole-stability-and-dynamics';

describe('INTERACTIVE_COURSE_MODULES', () => {
  it('keeps only cruise comfort in the premium section', () => {
    expect(PREMIUM_LESSONS.map((lesson) => lesson.id)).toEqual(['cruise-comfort-boppps']);
  });

  it('exposes module 2 and module 3 on the interactive course hub', () => {
    expect(INTERACTIVE_COURSE_MODULES.map((module) => module.id)).toEqual(['module-2', 'module-3', 'module-4']);
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

  it('exposes the full current module 3 mainline on the interactive course hub', () => {
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
      {
        id: 'unit-3-3-root-locus-rules',
        unitLabel: '3-3',
        legacySourceLabel: null,
      },
      {
        id: 'unit-3-4-root-locus-reading-validation',
        unitLabel: '3-4',
        legacySourceLabel: null,
      },
      {
        id: 'unit-3-5-zero-dynamic-improvement',
        unitLabel: '3-5',
        legacySourceLabel: null,
      },
      {
        id: 'unit-3-6-zero-design-workshop',
        unitLabel: '3-6',
        legacySourceLabel: null,
      },
      {
        id: 'unit-3-7-steady-error-low-frequency-compensation',
        unitLabel: '3-7',
        legacySourceLabel: null,
      },
      {
        id: 'unit-3-8-frequency-domain-translation-judgment',
        unitLabel: '3-8',
        legacySourceLabel: null,
      },
      {
        id: 'unit-3-9-cross-domain-mapping-lab',
        unitLabel: '3-9',
        legacySourceLabel: null,
      },
    ]);
  });

  it('does not use legacy source labels on the current mainline units', () => {
    expect(INTERACTIVE_COURSE_MODULES[0]?.lessons.every((lesson) => lesson.legacySourceLabel == null)).toBe(true);
  });

  it('uses 90-minute durations for 2-2, 2-3, 2-4, and 3-1 in module cards and presets', () => {
    const module2Lessons = new Map(INTERACTIVE_COURSE_MODULES[0]?.lessons.map((lesson) => [lesson.id, lesson.duration]));
    const module3Lessons = new Map(INTERACTIVE_COURSE_MODULES[1]?.lessons.map((lesson) => [lesson.id, lesson.duration]));

    expect(module2Lessons.get('unit-2-2-time-domain-response')).toBe('90 分钟');
    expect(module2Lessons.get('unit-2-3-frequency-response-bode-intro')).toBe('90 分钟');
    expect(module2Lessons.get('unit-2-4-nyquist-margin-entry')).toBe('90 分钟');
    expect(module3Lessons.get('unit-3-1-pure-pole-stability-and-dynamics')).toBe('90 分钟');

    expect(UNIT_2_2_TIME_DOMAIN_RESPONSE_PRESET.totalDuration).toBe(90);
    expect(UNIT_2_3_FREQUENCY_RESPONSE_BODE_INTRO_PRESET.totalDuration).toBe(90);
    expect(UNIT_2_4_NYQUIST_MARGIN_ENTRY_PRESET.totalDuration).toBe(90);
    expect(UNIT_3_1_PURE_POLE_STABILITY_AND_DYNAMICS_PRESET.totalDuration).toBe(90);
  });
});
