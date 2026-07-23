import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PREMIUM_LESSONS } from '@/features/interactive/learning-catalog';
import { ALL_PRESETS } from '@/features/teacher/preset-lessons/presets';
import { COURSE_AI_CONTEXT_REGISTRY } from '@/lib/course-ai-contexts';
import { resolveSessionRouteFromPlanTitle } from '@/lib/classroom-session-route';

const repoRoot = process.cwd();

describe('2-1 mainline replacement', () => {
  it('registers current mainline AI contexts and removes retired module 1 registry entries', () => {
    expect(COURSE_AI_CONTEXT_REGISTRY['unit-2-1-modeling-language-v1']).toBeDefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['unit-1-2-modeling-from-object-to-system-v1']).toBeDefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['unit-1-1-laplace-transfer-function-v1']).toBeUndefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['unit-1-2-block-diagram-simplification-v1']).toBeUndefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['l2a-time-domain-fasttrack']).toBeUndefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['l2b-root-locus-fasttrack']).toBeUndefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['l2c-frequency-bode-fasttrack']).toBeUndefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['l2d-three-domain-linkage-practice']).toBeUndefined();
    expect(COURSE_AI_CONTEXT_REGISTRY['lsum-design-feasible-domain-v1']).toBeUndefined();
  });

  it('exposes the current premium lessons and removes retired module 1 entries', () => {
    const lessonIds = PREMIUM_LESSONS.map((lesson) => String(lesson.id));
    expect(lessonIds).toEqual([
      'unit-1-1-see-the-full-picture',
      'unit-1-2-modeling-from-object-to-system',
      'unit-1-3-parameter-pole-migration',
      'unit-1-4-time-frequency-views',
      'unit-1-5-three-domain-gain-sweep',
      'cruise-comfort-boppps',
    ]);
    expect(lessonIds).not.toContain('unit-2-1-modeling-language');
    expect(lessonIds).not.toContain('unit-2-2-time-domain-response');
    expect(lessonIds).not.toContain('unit-1-1-laplace-transfer-function');
    expect(lessonIds).not.toContain('unit-1-2-block-diagram-simplification');
    expect(lessonIds).not.toContain('l2a-time-domain-fasttrack');
    expect(lessonIds).not.toContain('l2b-root-locus-fasttrack');
    expect(lessonIds).not.toContain('l2c-frequency-bode-fasttrack');
    expect(lessonIds).not.toContain('l2d-three-domain-linkage-practice');
    expect(lessonIds).not.toContain('lsum-design-feasible-domain');
  });

  it('keeps only current mainline presets and removes retired module 1 presets', () => {
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-2-1-modeling-language-v1')).toBe(true);
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-2-2-time-domain-response-v1')).toBe(true);
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-1-1-see-the-full-picture-v1')).toBe(true);
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-1-2-modeling-from-object-to-system-v1')).toBe(true);
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-1-1-laplace-transfer-function-v1')).toBe(false);
    expect(ALL_PRESETS.some((preset) => preset.key === 'unit-1-2-block-diagram-simplification-v1')).toBe(false);
    expect(ALL_PRESETS.some((preset) => preset.key === 'l2a-time-domain-fasttrack-v1')).toBe(false);
    expect(ALL_PRESETS.some((preset) => preset.key === 'l2b-root-locus-fasttrack-v1')).toBe(false);
    expect(ALL_PRESETS.some((preset) => preset.key === 'l2c-frequency-bode-fasttrack-v1')).toBe(false);
    expect(ALL_PRESETS.some((preset) => preset.key === 'l2d-three-domain-linkage-practice-v1')).toBe(false);
    expect(ALL_PRESETS.some((preset) => preset.key === 'lsum-design-feasible-domain-v1')).toBe(false);
  });

  it('routes current mainline titles and stops treating module 1 titles as premium aliases', () => {
    expect(resolveSessionRouteFromPlanTitle('2-1：建模与变换语言——从真实对象到统一分析对象')).toEqual({
      routeSegment: 'unit-2-1-modeling-language',
      isPremiumCourse: true,
    });

    expect(resolveSessionRouteFromPlanTitle('1-1：拉氏变换与传递函数——从微分方程到代数方程')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });

    expect(resolveSessionRouteFromPlanTitle('1-2：建模——从真实对象到可分析的系统')).toEqual({
      routeSegment: 'unit-1-2-modeling-from-object-to-system',
      isPremiumCourse: true,
    });

    expect(resolveSessionRouteFromPlanTitle('1-2：系统结构图与化简——从积木块到系统蓝图')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });

    expect(resolveSessionRouteFromPlanTitle('L-2a：时域响应分析——从曲线到性能')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });

    expect(resolveSessionRouteFromPlanTitle('L-2b：根轨迹——从极点迁移到设计调整')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });

    expect(resolveSessionRouteFromPlanTitle('L-2c：频率响应与 Bode 图')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });

    expect(resolveSessionRouteFromPlanTitle('L-2d：三域联动控制设计')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });

    expect(resolveSessionRouteFromPlanTitle('L-∑：设计可行域——让约束成为指南针')).toEqual({
      routeSegment: null,
      isPremiumCourse: false,
    });
  });

  it('keeps the central AI context registry aligned with current module 1 imports', () => {
    const source = readFileSync(join(repoRoot, 'src/lib/course-ai-contexts.ts'), 'utf8');

    expect(source).toContain("./unit-1-3-ai-contexts");
    expect(source).toContain("./unit-1-4-ai-contexts");
    expect(source).toContain("./unit-1-5-ai-contexts");
    expect(source).not.toContain("./l2a-ai-contexts");
    expect(source).not.toContain("./l2b-ai-contexts");
    expect(source).not.toContain("./l2c-ai-contexts");
    expect(source).not.toContain("./l2d-ai-contexts");
    expect(source).not.toContain("./lsum-ai-contexts");
    expect(source).not.toContain('unit-1-2-block-diagram-simplification-v1');
    expect(source).not.toContain('L2A_COURSE_META');
    expect(source).not.toContain('L2B_COURSE_META');
    expect(source).not.toContain('L2C_COURSE_META');
    expect(source).not.toContain('L2D_COURSE_META');
    expect(source).not.toContain('LSUM_COURSE_META');
  });
});
