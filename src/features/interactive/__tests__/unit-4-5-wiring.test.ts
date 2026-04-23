import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import {
  COURSE_AI_CONTEXT_REGISTRY,
  getStepQuickQuestions,
} from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

const UNIT_4_5_ROUTE_SEGMENT = 'unit-4-5-constraint-aware-parameter-optimization';
const UNIT_4_5_PRESET_KEY = 'unit-4-5-constraint-aware-parameter-optimization-v1';
const UNIT_4_5_COURSE_ID = 'unit-4-5-constraint-aware-parameter-optimization';
const UNIT_4_5_COURSE_TITLE = '4-5：约束下的优化设计实践：参数约束翻译与带约束参数优化';

describe('unit 4-5 platform wiring', () => {
  it('registers the 4-5 AI context registry entry and quick questions', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY[UNIT_4_5_PRESET_KEY];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toBe(UNIT_4_5_COURSE_TITLE);

    const quickQuestions = getStepQuickQuestions(UNIT_4_5_PRESET_KEY, 'step-11');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('可接受');
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    const lesson = FEATURED_LESSONS.find((item) => item.id === UNIT_4_5_COURSE_ID);

    expect(lesson).toMatchObject({
      id: UNIT_4_5_COURSE_ID,
      title: UNIT_4_5_COURSE_TITLE,
      href: `/interactive-learning/courses/${UNIT_4_5_ROUTE_SEGMENT}`,
      badge: '精品课程',
    });

    expect(resolveSessionRouteFromPlanTitle(UNIT_4_5_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_4_5_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
    expect(resolveSessionRouteFromPlanTitle('4-5：约束下的优化设计实践')).toEqual({
      routeSegment: UNIT_4_5_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('exposes a dedicated preset with the 13-step 4-5 lesson flow', async () => {
    const presetsModule = await import('@/features/teacher/preset-lessons/presets');
    const preset =
      presetsModule.UNIT_4_5_CONSTRAINT_AWARE_PARAMETER_OPTIMIZATION_PRESET;

    expect(preset).toBeDefined();
    expect(preset?.key).toBe(UNIT_4_5_PRESET_KEY);
    expect(preset?.totalDuration).toBe(90);
    expect(preset?.items).toHaveLength(13);
    expect(preset?.items[0]).toMatchObject({
      title: '无约束候选越界：时间指标更好，为什么仍不可交付',
      stage: 'BRIDGE_IN',
    });
    expect(preset?.items[1]).toMatchObject({
      title: '本次课程目标：完成这轮实践后应能做到什么',
      stage: 'OBJECTIVE',
    });
    expect(preset?.items[11]).toMatchObject({
      title: '后测：边界、求解与解释是否已经成链',
      stage: 'POST_ASSESSMENT',
    });
    expect(preset?.items[12]).toMatchObject({
      title: '总结：把越界证据、约束翻译与结构边界连成一条链',
      stage: 'SUMMARY',
    });
    expect(ALL_PRESETS.some((item) => item.key === UNIT_4_5_PRESET_KEY)).toBe(true);
  });
});
