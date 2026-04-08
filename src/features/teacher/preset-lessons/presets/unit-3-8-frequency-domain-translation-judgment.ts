import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_8InteractivePageType,
  UNIT_3_8_COURSE_TITLE,
  UNIT_3_8_LESSON_STEPS,
  UNIT_3_8_PRESET_KEY,
  UNIT_3_8_STAGE_MAP,
} from '@/lib/unit-3-8-course';

export const UNIT_3_8_FREQUENCY_DOMAIN_TRANSLATION_JUDGMENT_PRESET: PresetLessonConfig = {
  key: UNIT_3_8_PRESET_KEY,
  title: UNIT_3_8_COURSE_TITLE,
  description: '围绕结构变化的频域指纹、Nyquist/Bode 统一判稳与三频段工程读回的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '模块3', '频域', 'Nyquist', 'Bode'],
  items: UNIT_3_8_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_8_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_3_8InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
