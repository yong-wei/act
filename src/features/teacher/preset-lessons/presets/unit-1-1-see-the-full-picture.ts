import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_1_1InteractivePageType,
  UNIT_1_1_COURSE_DESCRIPTION,
  UNIT_1_1_COURSE_TITLE,
  UNIT_1_1_LESSON_STEPS,
  UNIT_1_1_PRESET_KEY,
  UNIT_1_1_STAGE_MAP,
} from '@/lib/unit-1-1-course';

export const UNIT_1_1_SEE_THE_FULL_PICTURE_PRESET: PresetLessonConfig = {
  key: UNIT_1_1_PRESET_KEY,
  title: UNIT_1_1_COURSE_TITLE,
  description: UNIT_1_1_COURSE_DESCRIPTION,
  totalDuration: 90,
  tags: ['精品课程', '模块1', '控制全景', '反馈思想', '三域诊断'],
  items: UNIT_1_1_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_1_1_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.stage === 'S'
        ? 'classroom-ai-report'
        : isUNIT_1_1InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
