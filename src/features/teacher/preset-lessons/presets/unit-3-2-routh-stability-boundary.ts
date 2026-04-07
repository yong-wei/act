import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_2InteractivePageType,
  UNIT_3_2_COURSE_TITLE,
  UNIT_3_2_LESSON_STEPS,
  UNIT_3_2_PRESET_KEY,
  UNIT_3_2_STAGE_MAP,
} from '@/lib/unit-3-2-course';

export const UNIT_3_2_ROUTH_STABILITY_BOUNDARY_PRESET: PresetLessonConfig = {
  key: UNIT_3_2_PRESET_KEY,
  title: UNIT_3_2_COURSE_TITLE,
  description: '围绕劳斯判稳、参数区间、两类特殊情况、三域翻译与变量平移的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '劳斯判据', '稳定可行域', '辅助方程', '变量平移'],
  items: UNIT_3_2_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_2_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : isUNIT_3_2InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
