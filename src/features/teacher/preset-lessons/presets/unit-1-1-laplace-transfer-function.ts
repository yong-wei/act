import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import { UNIT_1_1_COURSE_TITLE, UNIT_1_1_LESSON_STEPS, UNIT_1_1_PRESET_KEY, UNIT_1_1_STAGE_MAP } from '@/lib/unit-1-1-course';

export const UNIT_1_1_LAPLACE_TRANSFER_FUNCTION_PRESET: PresetLessonConfig = {
  key: UNIT_1_1_PRESET_KEY,
  title: UNIT_1_1_COURSE_TITLE,
  description: '围绕降维逻辑、微分定理、传递函数三步法、零极点与典型环节的精品互动课堂。',
  totalDuration: 100,
  tags: ['精品课程', '拉氏变换', '传递函数', '零极点', '典型环节'],
  items: UNIT_1_1_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_1_1_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: step.pageType === 'quiz' ? 'classroom-assessment' : step.pageType === 'summary' ? 'classroom-ai-report' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
