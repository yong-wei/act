import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_2_3InteractivePageType,
  UNIT_2_3_COURSE_TITLE,
  UNIT_2_3_LESSON_STEPS,
  UNIT_2_3_PRESET_KEY,
  UNIT_2_3_STAGE_MAP,
} from '@/lib/unit-2-3-course';

export const UNIT_2_3_FREQUENCY_RESPONSE_BODE_INTRO_PRESET: PresetLessonConfig = {
  key: UNIT_2_3_PRESET_KEY,
  title: UNIT_2_3_COURSE_TITLE,
  description: '围绕频率分量、正弦稳态响应、G(jω) 与 Bode 首轮骨架的精品互动课堂。',
  totalDuration: 100,
  tags: ['精品课程', '频域分析', 'Bode 图', '频率响应', '正弦稳态'],
  items: UNIT_2_3_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_2_3_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : isUNIT_2_3InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
