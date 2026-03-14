import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import { L2C_COURSE_TITLE, L2C_LESSON_STEPS, L2C_PRESET_KEY, L2C_STAGE_MAP } from '@/lib/l2c-course';

export const L2C_FREQUENCY_BODE_FASTTRACK_PRESET: PresetLessonConfig = {
  key: L2C_PRESET_KEY,
  title: L2C_COURSE_TITLE,
  description: '围绕 Bode 图、截止频率、相位裕度与三域联动的精品互动课堂。',
  totalDuration: 87,
  thumbnail: '/images/presets/lesson-12-frequency-bode.svg',
  tags: ['精品课程', '频域分析', 'Bode 图', '稳定裕度'],
  items: L2C_LESSON_STEPS.map((step, index) => ({
    stage: L2C_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: step.pageType === 'quiz' ? 'classroom-assessment' : step.pageType === 'summary' ? 'classroom-ai-report' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
