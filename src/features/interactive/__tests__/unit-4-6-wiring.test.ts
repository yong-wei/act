import { describe, expect, it } from 'vitest';

import { FEATURED_LESSONS } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { COURSE_AI_CONTEXT_REGISTRY, getStepQuickQuestions } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

const UNIT_4_6_ROUTE_SEGMENT = 'unit-4-6-fixed-structure-boundary-structural-encoding';
const UNIT_4_6_PRESET_KEY = 'unit-4-6-fixed-structure-boundary-structural-encoding-v1';
const UNIT_4_6_COURSE_ID = 'unit-4-6-fixed-structure-boundary-structural-encoding';
const UNIT_4_6_COURSE_TITLE = '4-6：场景迁移与方案比较：固定结构优化边界与结构编码入口';

describe('unit 4-6 platform wiring', () => {
  it('registers the 4-6 AI context registry entry and quick questions', () => {
    const registry = COURSE_AI_CONTEXT_REGISTRY[UNIT_4_6_PRESET_KEY];

    expect(registry).toBeDefined();
    expect(registry?.courseMeta.courseTitle).toBe(UNIT_4_6_COURSE_TITLE);

    const quickQuestions = getStepQuickQuestions(UNIT_4_6_PRESET_KEY, 'step-07');

    expect(quickQuestions).toHaveLength(2);
    expect(quickQuestions[0]?.question).toContain('统一编码');
  });

  it('registers the course in the learning catalog and classroom route resolver', () => {
    const lesson = FEATURED_LESSONS.find((item) => item.id === UNIT_4_6_COURSE_ID);

    expect(lesson).toMatchObject({
      id: UNIT_4_6_COURSE_ID,
      title: UNIT_4_6_COURSE_TITLE,
      href: `/interactive-learning/courses/${UNIT_4_6_ROUTE_SEGMENT}`,
      badge: '精品课程',
    });

    expect(resolveSessionRouteFromPlanTitle(UNIT_4_6_COURSE_TITLE)).toEqual({
      routeSegment: UNIT_4_6_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
    expect(resolveSessionRouteFromPlanTitle('4-6：场景迁移与方案比较')).toEqual({
      routeSegment: UNIT_4_6_ROUTE_SEGMENT,
      isPremiumCourse: true,
    });
  });

  it('exposes a dedicated preset with the 11-step 4-6 lesson flow', async () => {
    const presetsModule = await import('@/features/teacher/preset-lessons/presets');
    const preset = presetsModule.UNIT_4_6_FIXED_STRUCTURE_BOUNDARY_STRUCTURAL_ENCODING_PRESET;

    expect(preset).toBeDefined();
    expect(preset?.key).toBe(UNIT_4_6_PRESET_KEY);
    expect(preset?.totalDuration).toBe(90);
    expect(preset?.items).toHaveLength(11);
    expect(preset?.items[0]).toMatchObject({
      title: '从 4-5 可用解到驱逐舰失配：为什么这次不能只说“再调一调参数”',
      stage: 'BRIDGE_IN',
    });
    expect(preset?.items[9]).toMatchObject({
      title: '后测：目标错位、结构边界与统一编码是否已经连成链',
      stage: 'POST_ASSESSMENT',
    });
    expect(preset?.items[10]).toMatchObject({
      title: '总结：从任务重排到结构编码入口的完整判断链',
      stage: 'SUMMARY',
    });
    expect(ALL_PRESETS.some((item) => item.key === UNIT_4_6_PRESET_KEY)).toBe(true);
  });
});
