import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_5_3InteractivePageType,
  UNIT_5_3_COURSE_TITLE,
  UNIT_5_3_LESSON_STEPS,
  UNIT_5_3_PRESET_KEY,
  UNIT_5_3_STAGE_MAP,
} from '@/lib/unit-5-3-course';

export const UNIT_5_3_MASS_COORDINATION_CHAIN_PRESET: PresetLessonConfig = {
  key: UNIT_5_3_PRESET_KEY,
  title: UNIT_5_3_COURSE_TITLE,
  description:
    '围绕 MASS 感知、估计、规划、控制、执行与监督链路，训练从单回路证据推进到复杂自主系统责任诊断。',
  totalDuration: 90,
  tags: ['精品课程', '模块5', 'MASS', '自主系统', '责任诊断'],
  items: UNIT_5_3_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_5_3_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_5_3InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
