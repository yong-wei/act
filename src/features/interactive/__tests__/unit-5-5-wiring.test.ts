import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS, INTERACTIVE_COURSE_MODULES } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';
import { normalizeInteractiveRuntimeManifest } from '@/lib/interactive-lesson-manifest';

const repoRoot = process.cwd();
const manifest = normalizeInteractiveRuntimeManifest(
  JSON.parse(readFileSync(join(repoRoot, 'course-content/runtime/lessons/5-5/interactive-manifest.json'), 'utf8')),
);

if (!manifest) throw new Error('5-5 interactive manifest is invalid');

const UNIT_5_5_ROUTE_SEGMENT = 'unit-5-5-policy-learning-entry-risk';
const UNIT_5_5_PRESET_KEY = 'unit-5-5-policy-learning-entry-risk-v1';
const UNIT_5_5_COURSE_ID = 'unit-5-5-policy-learning-entry-risk';
const UNIT_5_5_COURSE_TITLE = manifest.courseTitle;

describe('unit 5-5 platform wiring', () => {
  it('registers the 5-5 AI context registry entry and quick questions from manifest page goals', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY[UNIT_5_5_PRESET_KEY];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toBe(UNIT_5_5_COURSE_TITLE);

    const quickQuestions = getStepQuickQuestions(UNIT_5_5_PRESET_KEY, 'step-15');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toBe(manifest.steps[14]?.aiContextSpec.pageGoal);
  });

  it('registers the course in the featured catalog, module 5, and classroom route resolver', () => {
    const lesson = FEATURED_LESSONS.find((item) => item.id === UNIT_5_5_COURSE_ID);
    const module5 = INTERACTIVE_COURSE_MODULES.find((module) => module.id === 'module-5');

    expect(lesson).toMatchObject({
      id: UNIT_5_5_COURSE_ID,
      title: UNIT_5_5_COURSE_TITLE,
      href: `/interactive-learning/courses/${UNIT_5_5_ROUTE_SEGMENT}`,
      badge: '精品课程',
    });
    expect(module5?.lessons.map((item) => ({ id: item.id, unitLabel: item.unitLabel }))).toContainEqual({
      id: UNIT_5_5_COURSE_ID,
      unitLabel: '5-5',
    });
    expect(resolveSessionRouteFromPlanTitle(UNIT_5_5_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_5_5_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
    expect(resolveSessionRouteFromPlanTitle('5-5：从显式控制器到策略学习')).toEqual({
      routeSegment: UNIT_5_5_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('exposes a dedicated preset generated from the 17-step runtime manifest flow', async () => {
    const presetsModule = await import('@/features/teacher/preset-lessons/presets');
    const preset = presetsModule.UNIT_5_5_POLICY_LEARNING_ENTRY_RISK_PRESET;

    expect(preset).toBeDefined();
    expect(preset?.key).toBe(UNIT_5_5_PRESET_KEY);
    expect(preset?.totalDuration).toBe(90);
    expect(preset?.items).toHaveLength(manifest.steps.length);
    expect(preset?.items.map((item: { title: string }) => item.title)).toEqual(
      manifest.steps.map((step) => step.title),
    );
    expect(preset?.items[15]).toMatchObject({
      title: manifest.steps[15]?.title,
      stage: 'POST_ASSESSMENT',
    });
    expect(preset?.items[16]).toMatchObject({
      title: manifest.steps[16]?.title,
      stage: 'SUMMARY',
    });
    expect(ALL_PRESETS.some((item) => item.key === UNIT_5_5_PRESET_KEY)).toBe(true);
  });
});
