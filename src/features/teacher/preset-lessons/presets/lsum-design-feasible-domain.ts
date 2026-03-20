import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import { LSUM_COURSE_TITLE, LSUM_LESSON_STEPS, LSUM_PRESET_KEY, LSUM_STAGE_MAP } from '@/lib/lsum-course';

export const LSUM_DESIGN_FEASIBLE_DOMAIN_PRESET: PresetLessonConfig = {
  key: LSUM_PRESET_KEY,
  title: LSUM_COURSE_TITLE,
  description: '围绕设计可行域、根轨迹可行弧段与三域投影的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '设计可行域', '根轨迹', '三域联动'],
  items: LSUM_LESSON_STEPS.map((step, index) => ({
    stage: LSUM_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: step.pageType === 'quiz' ? 'classroom-assessment' : step.pageType === 'summary' ? 'classroom-ai-report' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
