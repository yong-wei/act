import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_5_4InteractivePageType,
  UNIT_5_4_COURSE_TITLE,
  UNIT_5_4_LESSON_STEPS,
  UNIT_5_4_PRESET_KEY,
  UNIT_5_4_STAGE_MAP,
} from '@/lib/unit-5-4-course';

export const UNIT_5_4_DATA_DRIVEN_MPC_TRANSITION_PRESET: PresetLessonConfig = {
  key: UNIT_5_4_PRESET_KEY,
  title: UNIT_5_4_COURSE_TITLE,
  description:
    '围绕模型预测偏差、MPC 约束优化、数据驱动进入条件和三路线比较，训练模型数据责任分配。',
  totalDuration: 90,
  tags: ['精品课程', '模块5', 'MPC', '数据驱动', '责任分配'],
  items: UNIT_5_4_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_5_4_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_5_4InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
