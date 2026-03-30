import { describe, expect, it } from 'vitest';

import { PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { COURSE_AI_CONTEXT_REGISTRY } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

describe('2-1 mainline replacement', () => {
  it('registers the 2-1 AI context and removes 1-1/1-2 from the premium registry', () => {
    expect(COURSE_AI_CONTEXT_REGISTRY['unit-2-1-modeling-language-v1']).toBeDefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['unit-1-1-laplace-transfer-function-v1']).toBeUndefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['unit-1-2-block-diagram-simplification-v1']).toBeUndefined();
  });

  it('exposes 2-1 in premium lessons and removes 1-1/1-2 premium entries', () => {
    expect(PREMIUM_LESSONS.some((lesson) => lesson.id === 'unit-2-1-modeling-language')).toBe(true);
    expect(PREMIUM_LESSONS.some((lesson) => lesson.id === 'unit-1-1-laplace-transfer-function')).toBe(false);
    expect(PREMIUM_LESSONS.some((lesson) => lesson.id === 'unit-1-2-block-diagram-simplification')).toBe(false);
  });

  it('uses only the 2-1 preset for the modeling-language mainline course', () => {
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-2-1-modeling-language-v1')).toBe(true);
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-1-1-laplace-transfer-function-v1')).toBe(false);
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-1-2-block-diagram-simplification-v1')).toBe(false);
  });

  it('routes new 2-1 titles to the premium course and stops treating 1-1/1-2 titles as premium aliases', () => {
    expect(resolveSessionRouteFromPlanTitle('2-1：建模与变换语言——从真实对象到统一分析对象')).toEqual({
      routeSegment: 'unit-2-1-modeling-language',
      isPremiumCourse: true,
    });

    expect(resolveSessionRouteFromPlanTitle('1-1：拉氏变换与传递函数——从微分方程到代数方程')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });

    expect(resolveSessionRouteFromPlanTitle('1-2：系统结构图与化简——从积木块到系统蓝图')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });
  });
});
