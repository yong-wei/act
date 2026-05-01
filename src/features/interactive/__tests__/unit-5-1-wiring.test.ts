import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

const repoRoot = process.cwd();
const manifest = normalizeInteractiveRuntimeManifest(
  JSON.parse(readFileSync(join(repoRoot, 'course-content/runtime/lessons/5-1/interactive-manifest.json'), 'utf8')),
);

if (!manifest) throw new Error('5-1 interactive manifest is invalid');

const UNIT_5_1_ROUTE_SEGMENT = 'unit-5-1-linear-backbone-boundaries';
const UNIT_5_1_PRESET_KEY = 'unit-5-1-linear-backbone-boundaries-v1';
const UNIT_5_1_COURSE_ID = 'unit-5-1-linear-backbone-boundaries';
const UNIT_5_1_COURSE_TITLE = manifest.courseTitle;

describe('unit 5-1 platform wiring', () => {
  it('registers the 5-1 AI context registry entry and quick questions from manifest page goals', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY[UNIT_5_1_PRESET_KEY];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toBe(UNIT_5_1_COURSE_TITLE);

    const quickQuestions = getStepQuickQuestions(UNIT_5_1_PRESET_KEY, 'step-08');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toBe(manifest.steps[7]?.aiContextSpec.pageGoal);
  });

  it('registers the course in the featured catalog, module 5, and classroom route resolver', () => {
    const lesson = FEATURED_LESSONS.find((item) => item.id === UNIT_5_1_COURSE_ID);
    const module5 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-5');

    expect(lesson).toMatchObject({
      id: UNIT_5_1_COURSE_ID,
      title: UNIT_5_1_COURSE_TITLE,
      href: `/interactive-learning/courses/${UNIT_5_1_ROUTE_SEGMENT}`,
      badge: '精品课程',
    });
    expect(module5?.lessons.map((item) => ({ id: item.id, unitLabel: item.unitLabel }))).toContainEqual({
      id: UNIT_5_1_COURSE_ID,
      unitLabel: '5-1',
    });
    expect(resolveSessionRouteFromPlanTitle(UNIT_5_1_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_5_1_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
    expect(resolveSessionRouteFromPlanTitle('5-1：线性主干的边界')).toEqual({
      routeSegment: UNIT_5_1_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('exposes a dedicated preset generated from the 14-step runtime manifest flow', async () => {
    const presetsModule = await import('@/features/teacher/preset-lessons/presets');
    const preset = presetsModule.UNIT_5_1_LINEAR_BACKBONE_BOUNDARIES_PRESET;

    expect(preset).toBeDefined();
    expect(preset?.key).toBe(UNIT_5_1_PRESET_KEY);
    expect(preset?.totalDuration).toBe(90);
    expect(preset?.items).toHaveLength(manifest.steps.length);
    expect(preset?.items.map((item: { title: string }) => item.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(preset?.items[12]).toMatchObject({
      title: manifest.steps[12]?.title,
      stage: 'POST_ASSESSMENT',
    });
    expect(preset?.items[13]).toMatchObject({
      title: manifest.steps[13]?.title,
      stage: 'SUMMARY',
    });
    expect(ALL_PRESETS.some((item) => item.key === UNIT_5_1_PRESET_KEY)).toBe(true);
  });
});
