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
  description: '围绕对象分析、结构分流、复合结构职责、参数方向、首轮验证与问题清单，把起步卡推进成第一版方案的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '模块4', '初始方案', '复合结构', '首轮验证'],
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
