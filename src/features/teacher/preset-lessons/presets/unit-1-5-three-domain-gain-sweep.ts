import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_1_5InteractivePageType,
  UNIT_1_5_COURSE_TITLE,
  UNIT_1_5_LESSON_STEPS,
  UNIT_1_5_PRESET_KEY,
  UNIT_1_5_STAGE_MAP,
} from '@/lib/unit-1-5-course';

export const UNIT_1_5_THREE_DOMAIN_GAIN_SWEEP_PRESET: PresetLessonConfig = {
  key: UNIT_1_5_PRESET_KEY,
  title: UNIT_1_5_COURSE_TITLE,
  description: '围绕同一个比例增益，联读闭环极点、阶跃响应与环路稳定裕度，完成三域增益扫描。',
  totalDuration: 90,
  tags: ['精品课程', '模块1', '三域联动', '根轨迹', '阶跃响应', '稳定裕度'],
  items: UNIT_1_5_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_1_5_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_1_5InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: step.id === 'step-04' || step.id === 'step-12'
      ? 0
      : Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
