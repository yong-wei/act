import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_5InteractivePageType,
  UNIT_3_5_COURSE_TITLE,
  UNIT_3_5_LESSON_STEPS,
  UNIT_3_5_PRESET_KEY,
  UNIT_3_5_STAGE_MAP,
} from '@/lib/unit-3-5-course';

export const UNIT_3_5_ZERO_DYNAMIC_IMPROVEMENT_PRESET: PresetLessonConfig = {
  key: UNIT_3_5_PRESET_KEY,
  title: UNIT_3_5_COURSE_TITLE,
  description: '围绕零点重排、PD/测速反馈、超前频域原则与非最小相边界的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '零点', 'PD控制', '测速反馈', '超前校正', '非最小相'],
  items: UNIT_3_5_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_5_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_3_5InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
