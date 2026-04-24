import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_4_6InteractivePageType,
  UNIT_4_6_COURSE_TITLE,
  UNIT_4_6_LESSON_STEPS,
  UNIT_4_6_PRESET_KEY,
  UNIT_4_6_STAGE_MAP,
} from '@/lib/unit-4-6-course';

export const UNIT_4_6_FIXED_STRUCTURE_BOUNDARY_STRUCTURAL_ENCODING_PRESET: PresetLessonConfig = {
  key: UNIT_4_6_PRESET_KEY,
  title: UNIT_4_6_COURSE_TITLE,
  description:
    '围绕驱逐舰任务迁移、固定结构失配、专用代价函数、统一结构编码与专项验证，把固定结构优化边界推进成结构编码入口。',
  totalDuration: 90,
  tags: ['精品课程', '模块4', '结构编码', '场景迁移', '方案比较'],
  items: UNIT_4_6_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_4_6_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_4_6InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
