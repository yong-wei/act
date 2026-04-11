import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_9InteractivePageType,
  UNIT_3_9_COURSE_TITLE,
  UNIT_3_9_LESSON_STEPS,
  UNIT_3_9_PRESET_KEY,
  UNIT_3_9_STAGE_MAP,
} from '@/lib/unit-3-9-course';

export const UNIT_3_9_CROSS_DOMAIN_MAPPING_LAB_PRESET: PresetLessonConfig = {
  key: UNIT_3_9_PRESET_KEY,
  title: UNIT_3_9_COURSE_TITLE,
  description: '围绕基准、零点线补强、积分家族与滞后对照的综合映射实验型精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '模块3', '综合映射', '动态改善', '稳态改善'],
  items: UNIT_3_9_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_9_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_3_9InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
