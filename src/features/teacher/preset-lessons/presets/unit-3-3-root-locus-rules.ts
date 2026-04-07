import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_3InteractivePageType,
  UNIT_3_3_COURSE_TITLE,
  UNIT_3_3_LESSON_STEPS,
  UNIT_3_3_PRESET_KEY,
  UNIT_3_3_STAGE_MAP,
} from '@/lib/unit-3-3-course';

export const UNIT_3_3_ROOT_LOCUS_RULES_PRESET: PresetLessonConfig = {
  key: UNIT_3_3_PRESET_KEY,
  title: UNIT_3_3_COURSE_TITLE,
  description: '围绕根轨迹条件入口、完整法则、广义根轨迹与动态翻译的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '根轨迹', '广义根轨迹', '相角条件', '幅值条件'],
  items: UNIT_3_3_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_3_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : isUNIT_3_3InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
