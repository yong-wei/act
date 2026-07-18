import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_1_4InteractivePageType,
  UNIT_1_4_COURSE_TITLE,
  UNIT_1_4_LESSON_STEPS,
  UNIT_1_4_PRESET_KEY,
  UNIT_1_4_STAGE_MAP,
} from '@/lib/unit-1-4-course';

export const UNIT_1_4_TIME_FREQUENCY_VIEWS_PRESET: PresetLessonConfig = {
  key: UNIT_1_4_PRESET_KEY,
  title: UNIT_1_4_COURSE_TITLE,
  description: '以船舶航向闭环为贯穿对象，联读极点、阶跃响应、Bode 图与 Nyquist 图。',
  totalDuration: 90,
  tags: ['精品课程', '模块1', '时域响应', '频率响应', 'Bode 图', 'Nyquist 图'],
  items: UNIT_1_4_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_1_4_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_1_4InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 6)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
