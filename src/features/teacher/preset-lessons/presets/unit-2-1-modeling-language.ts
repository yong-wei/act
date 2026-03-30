import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import { UNIT_2_1_COURSE_TITLE, UNIT_2_1_LESSON_STEPS, UNIT_2_1_PRESET_KEY, UNIT_2_1_STAGE_MAP } from '@/lib/unit-2-1-course';

export const UNIT_2_1_MODELING_LANGUAGE_PRESET: PresetLessonConfig = {
  key: UNIT_2_1_PRESET_KEY,
  title: UNIT_2_1_COURSE_TITLE,
  description: '围绕拉氏变换工程动机、零初值传递函数、典型环节、结构图、信号流图与梅森公式的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '建模语言', '传递函数', '结构图', '梅森公式'],
  items: UNIT_2_1_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_2_1_STAGE_MAP[step.stage],
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
