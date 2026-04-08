import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_7InteractivePageType,
  UNIT_3_7_COURSE_TITLE,
  UNIT_3_7_LESSON_STEPS,
  UNIT_3_7_PRESET_KEY,
  UNIT_3_7_STAGE_MAP,
} from '@/lib/unit-3-7-course';

export const UNIT_3_7_STEADY_ERROR_LOW_FREQUENCY_COMPENSATION_PRESET: PresetLessonConfig = {
  key: UNIT_3_7_PRESET_KEY,
  title: UNIT_3_7_COURSE_TITLE,
  description: '围绕双通道误差、终值定理与型别快判、PI/滞后低频补偿比较的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '稳态误差', '系统型别', '终值定理', 'PI', '滞后校正'],
  items: UNIT_3_7_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_7_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_3_7InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
