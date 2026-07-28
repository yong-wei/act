import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_1_3InteractivePageType,
  UNIT_1_3_COURSE_TITLE,
  UNIT_1_3_LESSON_STEPS,
  UNIT_1_3_PRESET_KEY,
  UNIT_1_3_STAGE_MAP,
} from '@/lib/unit-1-3-course';

export const UNIT_1_3_PARAMETER_POLE_MIGRATION_PRESET: PresetLessonConfig = {
  key: UNIT_1_3_PRESET_KEY,
  title: UNIT_1_3_COURSE_TITLE,
  description: '从自动舵增益旋钮出发，联读闭环特征方程、极点迁移、时域响应与根轨迹雏形。',
  totalDuration: 90,
  tags: ['精品课程', '模块1', '极点迁移', '根轨迹', '时域响应'],
  items: UNIT_1_3_LESSON_STEPS.map((step, index) => ({
    runtimeStepId: step.id,
    stage: UNIT_1_3_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_1_3InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
