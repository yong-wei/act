import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_4_2InteractivePageType,
  UNIT_4_2_COURSE_TITLE,
  UNIT_4_2_LESSON_STEPS,
  UNIT_4_2_PRESET_KEY,
  UNIT_4_2_STAGE_MAP,
} from '@/lib/unit-4-2-course';

export const UNIT_4_2_CONTROLLER_SELECTION_FIRST_START_PRESET: PresetLessonConfig = {
  key: UNIT_4_2_PRESET_KEY,
  title: UNIT_4_2_COURSE_TITLE,
  description: '围绕结构工具箱、三频段职责、双案例首轮起步与前馈边界，把任务表达卡推进成单结构首轮起步卡的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '模块4', '控制器选型', '结构工具箱', '前馈边界'],
  items: UNIT_4_2_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_4_2_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      isUNIT_4_2InteractivePageType(step.pageType)
        ? 'classroom-assessment'
        : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
