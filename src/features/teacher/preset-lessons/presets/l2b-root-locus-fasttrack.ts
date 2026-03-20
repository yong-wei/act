import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import { L2B_COURSE_TITLE, L2B_LESSON_STEPS, L2B_PRESET_KEY, L2B_STAGE_MAP } from '@/lib/l2b-course';

export const L2B_ROOT_LOCUS_FASTTRACK_PRESET: PresetLessonConfig = {
  key: L2B_PRESET_KEY,
  title: L2B_COURSE_TITLE,
  description: '围绕根轨迹直觉、45° 射线与课堂同步工作区的精品互动课堂。',
  totalDuration: 79,
  thumbnail: '/images/presets/lesson-10-root-locus.svg',
  tags: ['精品课程', '根轨迹分析', '阻尼比', '课堂同步'],
  items: L2B_LESSON_STEPS.map((step, index) => ({
    stage: L2B_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: step.pageType === 'quiz' ? 'classroom-assessment' : step.pageType === 'summary' ? 'classroom-ai-report' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
