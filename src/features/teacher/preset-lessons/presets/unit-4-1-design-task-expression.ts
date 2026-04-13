import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_4_1InteractivePageType,
  UNIT_4_1_COURSE_TITLE,
  UNIT_4_1_LESSON_STEPS,
  UNIT_4_1_PRESET_KEY,
  UNIT_4_1_STAGE_MAP,
} from '@/lib/unit-4-1-course';

export const UNIT_4_1_DESIGN_TASK_EXPRESSION_PRESET: PresetLessonConfig = {
  key: UNIT_4_1_PRESET_KEY,
  title: UNIT_4_1_COURSE_TITLE,
  description: '围绕指标角色、工程约束、可行域分层和双案例联读，把分析证据收束成任务表达卡的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '模块4入口', '任务表达', '设计约束', '可行域'],
  items: UNIT_4_1_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_4_1_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      isUNIT_4_1InteractivePageType(step.pageType)
        ? 'classroom-assessment'
        : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
