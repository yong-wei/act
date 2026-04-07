import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_3_4InteractivePageType,
  UNIT_3_4_COURSE_TITLE,
  UNIT_3_4_LESSON_STEPS,
  UNIT_3_4_PRESET_KEY,
  UNIT_3_4_STAGE_MAP,
} from '@/lib/unit-3-4-course';

export const UNIT_3_4_ROOT_LOCUS_READING_VALIDATION_PRESET: PresetLessonConfig = {
  key: UNIT_3_4_PRESET_KEY,
  title: UNIT_3_4_COURSE_TITLE,
  description: '围绕关键节点读图、参数窗口判断、增益换算与三域验证的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '根轨迹', '关键节点', '稳定窗口', '增益换算', '三域验证'],
  items: UNIT_3_4_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_3_4_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : isUNIT_3_4InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
