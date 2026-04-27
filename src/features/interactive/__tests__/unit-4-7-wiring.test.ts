import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

const repoRoot = process.cwd();
const manifest = normalizeInteractiveRuntimeManifest(
  JSON.parse(readFileSync(join(repoRoot, 'course-content/runtime/lessons/4-7/interactive-manifest.json'), 'utf8')),
);

if (!manifest) throw new Error('4-7 interactive manifest is invalid');

const UNIT_4_7_ROUTE_SEGMENT = 'unit-4-7-destroyer-hifi-design-closure';
const UNIT_4_7_PRESET_KEY = 'unit-4-7-destroyer-hifi-design-closure-v1';
const UNIT_4_7_COURSE_ID = 'unit-4-7-destroyer-hifi-design-closure';
const UNIT_4_7_COURSE_TITLE = manifest.courseTitle;

describe('unit 4-7 platform wiring', () => {
  it('registers the 4-7 AI context registry entry and quick questions from manifest page goals', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY[UNIT_4_7_PRESET_KEY];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toBe(UNIT_4_7_COURSE_TITLE);

    const quickQuestions = getStepQuickQuestions(UNIT_4_7_PRESET_KEY, 'step-08');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toBe(manifest.steps[7]?.aiContextSpec.pageGoal);
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    const lesson = FEATURED_LESSONS.find((item) => item.id === UNIT_4_7_COURSE_ID);

    expect(lesson).toMatchObject({
      id: UNIT_4_7_COURSE_ID,
      title: UNIT_4_7_COURSE_TITLE,
      href: `/interactive-learning/courses/${UNIT_4_7_ROUTE_SEGMENT}`,
      badge: '精品课程',
    });

    expect(resolveSessionRouteFromPlanTitle(UNIT_4_7_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_4_7_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
    expect(resolveSessionRouteFromPlanTitle('4-7：高保真辨识、设计验证与扰动边界')).toEqual({
      routeSegment: UNIT_4_7_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('exposes a dedicated preset generated from the 12-step runtime manifest flow', async () => {
    const presetsModule = await import('@/features/teacher/preset-lessons/presets');
    const preset = presetsModule.UNIT_4_7_DESTROYER_HIFI_DESIGN_CLOSURE_PRESET;

    expect(preset).toBeDefined();
    expect(preset?.key).toBe(UNIT_4_7_PRESET_KEY);
    expect(preset?.totalDuration).toBe(90);
    expect(preset?.items).toHaveLength(manifest.steps.length);
    expect(preset?.items.map((item: { title: string }) => item.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(preset?.items[10]).toMatchObject({
      title: manifest.steps[10]?.title,
      stage: 'POST_ASSESSMENT',
    });
    expect(preset?.items[11]).toMatchObject({
      title: manifest.steps[11]?.title,
      stage: 'SUMMARY',
    });
    expect(ALL_PRESETS.some((item) => item.key === UNIT_4_7_PRESET_KEY)).toBe(true);
  });
});
