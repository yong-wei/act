import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_5_2InteractivePageType,
  UNIT_5_2_COURSE_TITLE,
  UNIT_5_2_LESSON_STEPS,
  UNIT_5_2_PRESET_KEY,
  UNIT_5_2_STAGE_MAP,
} from '@/lib/unit-5-2-course';

export const UNIT_5_2_NONLINEAR_ANALYSIS_ENTRY_PRESET: PresetLessonConfig = {
  key: UNIT_5_2_PRESET_KEY,
  title: UNIT_5_2_COURSE_TITLE,
  description:
    '围绕局部线性化、相平面、描述函数、负倒曲线、微小扰动法与舵机执行器自振风险，建立非线性系统分析的最小入口。',
  totalDuration: 90,
  tags: ['精品课程', '模块5', '非线性系统', '相平面', '描述函数'],
  items: UNIT_5_2_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_5_2_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_5_2InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 5)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
