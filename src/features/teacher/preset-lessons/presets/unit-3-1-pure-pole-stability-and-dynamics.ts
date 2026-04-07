import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_1InteractivePageType,
  UNIT_3_1_COURSE_TITLE,
  UNIT_3_1_LESSON_STEPS,
  UNIT_3_1_PRESET_KEY,
  UNIT_3_1_STAGE_MAP,
} from '@/lib/unit-3-1-course';

export const UNIT_3_1_PURE_POLE_STABILITY_AND_DYNAMICS_PRESET: PresetLessonConfig = {
  key: UNIT_3_1_PRESET_KEY,
  title: UNIT_3_1_COURSE_TITLE,
  description: '围绕稳定底线、模态语言、主导极点近似与双域证据的精品互动课堂。',
  totalDuration: 100,
  tags: ['精品课程', '稳定性', '模态', '主导极点', 'Bode 对照'],
  items: UNIT_3_1_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_1_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : isUNIT_3_1InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
