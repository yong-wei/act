import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_5_5InteractivePageType,
  UNIT_5_5_COURSE_TITLE,
  UNIT_5_5_LESSON_STEPS,
  UNIT_5_5_PRESET_KEY,
  UNIT_5_5_STAGE_MAP,
} from '@/lib/unit-5-5-course';

export const UNIT_5_5_POLICY_LEARNING_ENTRY_RISK_PRESET: PresetLessonConfig = {
  key: UNIT_5_5_PRESET_KEY,
  title: UNIT_5_5_COURSE_TITLE,
  description:
    '围绕显式控制律、策略学习入口、强化学习训练、安全外壳和航向控制三路线比较，训练策略学习进入控制系统时的证据判断。',
  totalDuration: 90,
  tags: ['精品课程', '模块5', '策略学习', '强化学习', '安全外壳'],
  items: UNIT_5_5_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_5_5_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_5_5InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
