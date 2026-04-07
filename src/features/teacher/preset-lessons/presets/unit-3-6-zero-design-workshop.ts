import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_6InteractivePageType,
  UNIT_3_6_COURSE_TITLE,
  UNIT_3_6_LESSON_STEPS,
  UNIT_3_6_PRESET_KEY,
  UNIT_3_6_STAGE_MAP,
} from '@/lib/unit-3-6-course';

export const UNIT_3_6_ZERO_DESIGN_WORKSHOP_PRESET: PresetLessonConfig = {
  key: UNIT_3_6_PRESET_KEY,
  title: UNIT_3_6_COURSE_TITLE,
  description: '围绕目标分类、时域 / 频域设计链与非最小相边界判断的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '目标驱动设计', 'PD控制', '测速反馈', '超前校正', '非最小相'],
  items: UNIT_3_6_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_6_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_3_6InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
