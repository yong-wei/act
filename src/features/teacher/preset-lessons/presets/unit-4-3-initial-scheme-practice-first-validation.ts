import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  UNIT_4_3_COURSE_TITLE,
  UNIT_4_3_PRESET_STEPS,
  UNIT_4_3_PRESET_KEY,
  UNIT_4_3_STAGE_MAP,
} from '@/lib/unit-4-3-course';

export const UNIT_4_3_INITIAL_SCHEME_PRACTICE_FIRST_VALIDATION_PRESET: PresetLessonConfig = {
  key: UNIT_4_3_PRESET_KEY,
  title: UNIT_4_3_COURSE_TITLE,
  description: '围绕单结构候选缺口、经典复合控制边界、前馈与反馈分工、实现层保护和客船首轮记录，把候选结构推进成工程可运行方案。',
  totalDuration: 90,
  tags: ['精品课程', '模块4', '经典复合控制', '前馈反馈分工', '首轮验证'],
  items: UNIT_4_3_PRESET_STEPS.map((step, index) => ({
    stage: UNIT_4_3_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: step.interactive ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: { stepId: step.id },
  })),
};
