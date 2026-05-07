import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_5_6InteractivePageType,
  UNIT_5_6_COURSE_TITLE,
  UNIT_5_6_LESSON_STEPS,
  UNIT_5_6_PRESET_KEY,
  UNIT_5_6_STAGE_MAP,
} from '@/lib/unit-5-6-course';

export const UNIT_5_6_METHOD_COMPARISON_COLD_CHAIN_PRESET: PresetLessonConfig = {
  key: UNIT_5_6_PRESET_KEY,
  title: UNIT_5_6_COURSE_TITLE,
  description:
    '围绕同一冷链温控任务，比较经典 PI/PID、数据驱动预测补偿和策略学习监督层的收益、风险与验证责任。',
  totalDuration: 90,
  tags: ['精品课程', '模块5', '方法比较', '冷链温控', '策略监督层'],
  items: UNIT_5_6_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_5_6_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_5_6InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 5)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
