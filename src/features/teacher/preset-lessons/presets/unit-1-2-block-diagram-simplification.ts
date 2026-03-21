import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  UNIT_1_2_COURSE_TITLE,
  UNIT_1_2_LESSON_STEPS,
  UNIT_1_2_PRESET_KEY,
  UNIT_1_2_STAGE_MAP,
} from '@/lib/unit-1-2-course';

export const UNIT_1_2_BLOCK_DIAGRAM_SIMPLIFICATION_PRESET: PresetLessonConfig = {
  key: UNIT_1_2_PRESET_KEY,
  title: UNIT_1_2_COURSE_TITLE,
  description: '围绕结构图四元素、三种基本连接、等效变换、代数化简与梅森公式的精品互动课堂。',
  totalDuration: 100,
  tags: ['精品课程', '结构图', '信号流图', '梅森公式', '系统建模'],
  items: UNIT_1_2_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_1_2_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : step.pageType === 'quiz' || step.pageType === 'form' || step.pageType === 'ai'
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
