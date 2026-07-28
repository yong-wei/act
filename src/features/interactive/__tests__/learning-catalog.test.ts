import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES, PREMIUM_LESSONS } from '../learning-catalog';
import { UNIT_2_2_TIME_DOMAIN_RESPONSE_PRESET } from '@/features/teacher/preset-lessons/presets/unit-2-2-time-domain-response';
import { UNIT_2_3_FREQUENCY_RESPONSE_BODE_INTRO_PRESET } from '@/features/teacher/preset-lessons/presets/unit-2-3-frequency-response-bode-intro';
import { UNIT_2_4_NYQUIST_MARGIN_ENTRY_PRESET } from '@/features/teacher/preset-lessons/presets/unit-2-4-nyquist-margin-entry';
import { UNIT_3_1_PURE_POLE_STABILITY_AND_DYNAMICS_PRESET } from '@/features/teacher/preset-lessons/presets/unit-3-1-pure-pole-stability-and-dynamics';

const repoRoot = process.cwd();

describe('INTERACTIVE_COURSE_MODULES', () => {
  it('keeps the current module 1 mainline and cruise comfort in the premium section', () => {
    expect(PREMIUM_LESSONS.map((lesson) => lesson.id)).toEqual([
      'unit-1-1-see-the-full-picture',
      'unit-1-2-modeling-from-object-to-system',
      'unit-1-3-parameter-pole-migration',
      'unit-1-4-time-frequency-views',
      'unit-1-5-three-domain-gain-sweep',
      'cruise-comfort-boppps',
    ]);
  });

  it('exposes module 1 through module 5 on the interactive course hub', () => {
    expect(INTERACTIVE_COURSE_MODULES.map((module) => module.id)).toEqual([
      'module-1',
      'module-2',
      'module-3',
      'module-4',
      'module-5',
    ]);
  });

  it('exposes the current unit 1 mainline in module 1', () => {
    const module1 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-1');

    expect(module1?.lessons.map((lesson) => ({
      id: lesson.id,
      unitLabel: lesson.unitLabel,
      legacySourceLabel: lesson.legacySourceLabel ?? null,
    }))).toEqual([
      {
        id: 'unit-1-1-see-the-full-picture',
        unitLabel: '1-1',
        legacySourceLabel: null,
      },
      {
        id: 'unit-1-2-modeling-from-object-to-system',
        unitLabel: '1-2',
        legacySourceLabel: null,
      },
      {
        id: 'unit-1-3-parameter-pole-migration',
        unitLabel: '1-3',
        legacySourceLabel: null,
      },
      {
        id: 'unit-1-4-time-frequency-views',
        unitLabel: '1-4',
        legacySourceLabel: null,
      },
      {
        id: 'unit-1-5-three-domain-gain-sweep',
        unitLabel: '1-5',
        legacySourceLabel: null,
      },
    ]);
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

  it('does not expose retired one-page lesson routes', () => {
    const appRouterDirs = readdirSync(join(repoRoot, 'src/app/interactive-learning'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^lesson-\d+/.test(entry.name))
      .map((entry) => entry.name);

    const catalogHrefs = [
      ...FEATURED_LESSONS.map((lesson) => lesson.href),
      ...INTERACTIVE_COURSE_MODULES.flatMap((module) => module.lessons.map((lesson) => lesson.href)),
    ].filter((href) => href.startsWith('/interactive-learning/lesson-'));

    expect(appRouterDirs).toEqual([]);
    expect(catalogHrefs).toEqual([]);
  });

  it('exposes unit 2-1, unit 2-2, unit 2-3, and unit 2-4 in module 2', () => {
    const module2 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-2');

    expect(module2?.lessons.map((lesson) => ({
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
    const module3 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-3');

    expect(module3?.lessons.map((lesson) => ({
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
    expect(
      INTERACTIVE_COURSE_MODULES.flatMap((module) => module.lessons).every((lesson) => lesson.legacySourceLabel == null)
    ).toBe(true);
  });

  it('exposes unit 4-1 through unit 4-7 in module 4', () => {
    const module4 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-4');

    expect(module4?.lessons.map((lesson) => ({
      id: lesson.id,
      unitLabel: lesson.unitLabel,
      legacySourceLabel: lesson.legacySourceLabel ?? null,
    }))).toEqual([
      {
        id: 'unit-4-1-design-task-expression',
        unitLabel: '4-1',
        legacySourceLabel: null,
      },
      {
        id: 'unit-4-2-controller-selection-first-start',
        unitLabel: '4-2',
        legacySourceLabel: null,
      },
      {
        id: 'unit-4-3-initial-scheme-practice-first-validation',
        unitLabel: '4-3',
        legacySourceLabel: null,
      },
      {
        id: 'unit-4-4-fixed-structure-optimization-modeling',
        unitLabel: '4-4',
        legacySourceLabel: null,
      },
      {
        id: 'unit-4-5-constraint-aware-parameter-optimization',
        unitLabel: '4-5',
        legacySourceLabel: null,
      },
      {
        id: 'unit-4-6-fixed-structure-boundary-structural-encoding',
        unitLabel: '4-6',
        legacySourceLabel: null,
      },
      {
        id: 'unit-4-7-destroyer-hifi-design-closure',
        unitLabel: '4-7',
        legacySourceLabel: null,
      },
    ]);
  });

  it('exposes units 5-1 through 5-6 in module 5', () => {
    const module5 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-5');

    expect(module5?.lessons.map((lesson) => ({
      id: lesson.id,
      unitLabel: lesson.unitLabel,
      legacySourceLabel: lesson.legacySourceLabel ?? null,
    }))).toEqual([
      {
        id: 'unit-5-1-linear-backbone-boundaries',
        unitLabel: '5-1',
        legacySourceLabel: null,
      },
      {
        id: 'unit-5-2-nonlinear-analysis-entry',
        unitLabel: '5-2',
        legacySourceLabel: null,
      },
      {
        id: 'unit-5-3-mass-coordination-chain',
        unitLabel: '5-3',
        legacySourceLabel: null,
      },
      {
        id: 'unit-5-4-data-driven-mpc-transition',
        unitLabel: '5-4',
        legacySourceLabel: null,
      },
      {
        id: 'unit-5-5-policy-learning-entry-risk',
        unitLabel: '5-5',
        legacySourceLabel: null,
      },
      {
        id: 'unit-5-6-method-comparison-cold-chain',
        unitLabel: '5-6',
        legacySourceLabel: null,
      },
    ]);
  });

  it('uses 90-minute durations for 2-2, 2-3, 2-4, and 3-1 in module cards and presets', () => {
    const module2 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-2');
    const module3 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-3');
    const module2Lessons = new Map(module2?.lessons.map((lesson) => [lesson.id, lesson.runtimeCardMetadata.durationLabel]));
    const module3Lessons = new Map(module3?.lessons.map((lesson) => [lesson.id, lesson.runtimeCardMetadata.durationLabel]));

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
