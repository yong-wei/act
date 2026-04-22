import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_4_4InteractivePageType,
  UNIT_4_4_COURSE_TITLE,
  UNIT_4_4_LESSON_STEPS,
  UNIT_4_4_PRESET_KEY,
  UNIT_4_4_STAGE_MAP,
} from '@/lib/unit-4-4-course';

export const UNIT_4_4_FIXED_STRUCTURE_OPTIMIZATION_MODELING_PRESET: PresetLessonConfig = {
  key: UNIT_4_4_PRESET_KEY,
  title: UNIT_4_4_COURSE_TITLE,
  description:
    '围绕固定结构下的多目标拉扯、自由目标表达、无约束候选族与 Pareto 最小取舍，把 4-3 的首轮证据推进成 4-5 可复核的候选族。',
  totalDuration: 90,
  tags: ['精品课程', '模块4', '无约束优化', 'Pareto', '固定结构'],
  items: UNIT_4_4_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_4_4_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      isUNIT_4_4InteractivePageType(step.pageType)
        ? 'classroom-assessment'
        : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
