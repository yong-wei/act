import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import { L2D_COURSE_TITLE, L2D_LESSON_STEPS, L2D_PRESET_KEY, L2D_STAGE_MAP } from '@/lib/l2d-course';

export const L2D_THREE_DOMAIN_LINKAGE_PRACTICE_PRESET: PresetLessonConfig = {
  key: L2D_PRESET_KEY,
  title: L2D_COURSE_TITLE,
  description: '围绕三面板联动、临界增益、三域对照表与反思写作的实践型精品互动课堂。',
  totalDuration: 96,
  thumbnail: '/images/presets/lesson-10-root-locus.svg',
  tags: ['精品课程', '跨域实践', '根轨迹', 'Bode 图', '时域'],
  items: L2D_LESSON_STEPS.map((step, index) => ({
    stage: L2D_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: step.pageType === 'quiz' ? 'classroom-assessment' : step.pageType === 'summary' ? 'classroom-ai-report' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
