import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_1_2InteractivePageType,
  UNIT_1_2_COURSE_TITLE,
  UNIT_1_2_LESSON_STEPS,
  UNIT_1_2_PRESET_KEY,
  UNIT_1_2_STAGE_MAP,
} from '@/lib/unit-1-2-course';

export const UNIT_1_2_MODELING_FROM_OBJECT_TO_SYSTEM_PRESET: PresetLessonConfig = {
  key: UNIT_1_2_PRESET_KEY,
  title: UNIT_1_2_COURSE_TITLE,
  description:
    '从真实工程对象出发，走通微分方程、传递函数、结构图、信号流图和极点行为地图。',
  totalDuration: 90,
  tags: ['精品课程', '模块1', '建模', '传递函数', '极点'],
  items: UNIT_1_2_LESSON_STEPS.map((step, index) => ({
    runtimeStepId: step.id,
    stage: UNIT_1_2_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_1_2InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
