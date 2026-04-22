import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_4_5InteractivePageType,
  UNIT_4_5_COURSE_TITLE,
  UNIT_4_5_LESSON_STEPS,
  UNIT_4_5_PRESET_KEY,
  UNIT_4_5_STAGE_MAP,
} from '@/lib/unit-4-5-course';

export const UNIT_4_5_CONSTRAINT_AWARE_PARAMETER_OPTIMIZATION_PRESET: PresetLessonConfig = {
  key: UNIT_4_5_PRESET_KEY,
  title: UNIT_4_5_COURSE_TITLE,
  description:
    '围绕越界证据、硬约束翻译、罚函数写模与三方案闭环比较，把 4-4 的无约束候选推进成固定结构下的可交付解。',
  totalDuration: 90,
  tags: ['精品课程', '模块4', '约束优化', '罚函数', '固定结构'],
  items: UNIT_4_5_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_4_5_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      isUNIT_4_5InteractivePageType(step.pageType)
        ? 'classroom-assessment'
        : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};

export const UNIT_4_5_FIXED_STRUCTURE_OPTIMIZATION_MODELING_PRESET =
  UNIT_4_5_CONSTRAINT_AWARE_PARAMETER_OPTIMIZATION_PRESET;
