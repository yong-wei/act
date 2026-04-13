import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_2_2InteractivePageType,
  UNIT_2_2_COURSE_TITLE,
  UNIT_2_2_LESSON_STEPS,
  UNIT_2_2_PRESET_KEY,
  UNIT_2_2_STAGE_MAP,
} from '@/lib/unit-2-2-course';

export const UNIT_2_2_TIME_DOMAIN_RESPONSE_PRESET: PresetLessonConfig = {
  key: UNIT_2_2_PRESET_KEY,
  title: UNIT_2_2_COURSE_TITLE,
  description: '围绕单位阶跃响应、一阶与二阶系统标准型以及动态性能指标的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '时域分析', '动态性能指标', '二阶系统', '极点桥接'],
  items: UNIT_2_2_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_2_2_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : isUNIT_2_2InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
