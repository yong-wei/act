import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_2_4InteractivePageType,
  UNIT_2_4_COURSE_TITLE,
  UNIT_2_4_LESSON_STEPS,
  UNIT_2_4_PRESET_KEY,
  UNIT_2_4_STAGE_MAP,
} from '@/lib/unit-2-4-course';

export const UNIT_2_4_NYQUIST_MARGIN_ENTRY_PRESET: PresetLessonConfig = {
  key: UNIT_2_4_PRESET_KEY,
  title: UNIT_2_4_COURSE_TITLE,
  description: '围绕 Nyquist 图、频域指标入口、手工绘图入口与最小反向识别的精品互动课堂。',
  totalDuration: 90,
  tags: ['精品课程', '频域分析', 'Nyquist 图', '相位裕度', '增益裕度'],
  items: UNIT_2_4_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_2_4_STAGE_MAP[step.stage],
    order: index + 1,
    registryId:
      step.pageType === 'summary'
        ? 'classroom-ai-report'
        : isUNIT_2_4InteractivePageType(step.pageType)
          ? 'classroom-assessment'
          : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
