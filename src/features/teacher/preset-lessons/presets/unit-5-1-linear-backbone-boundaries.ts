import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_5_1InteractivePageType,
  UNIT_5_1_COURSE_TITLE,
  UNIT_5_1_LESSON_STEPS,
  UNIT_5_1_PRESET_KEY,
  UNIT_5_1_STAGE_MAP,
} from '@/lib/unit-5-1-course';

export const UNIT_5_1_LINEAR_BACKBONE_BOUNDARIES_PRESET: PresetLessonConfig = {
  key: UNIT_5_1_PRESET_KEY,
  title: UNIT_5_1_COURSE_TITLE,
  description:
    '围绕线性主干默认条件、典型非线性边界、局部线性化、预测失真与方法迁移理由，完成进入非线性方法前的边界识别。',
  totalDuration: 90,
  tags: ['精品课程', '模块5', '非线性边界', '局部线性化', '方法迁移'],
  items: UNIT_5_1_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_5_1_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_5_1InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
