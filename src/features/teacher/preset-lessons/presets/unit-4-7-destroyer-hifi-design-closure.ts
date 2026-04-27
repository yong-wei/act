import { ResourceType } from '@prisma/client';

import type { PresetLessonConfig } from '../types';
import {
  isUNIT_4_7InteractivePageType,
  UNIT_4_7_COURSE_TITLE,
  UNIT_4_7_LESSON_STEPS,
  UNIT_4_7_PRESET_KEY,
  UNIT_4_7_STAGE_MAP,
} from '@/lib/unit-4-7-course';

export const UNIT_4_7_DESTROYER_HIFI_DESIGN_CLOSURE_PRESET: PresetLessonConfig = {
  key: UNIT_4_7_PRESET_KEY,
  title: UNIT_4_7_COURSE_TITLE,
  description:
    '围绕高保真辨识、传统设计、优化解码、跨模型验证、扰动噪声边界与前沿方法入口，完成固定低阶结构的工程设计闭环。',
  totalDuration: 90,
  tags: ['精品课程', '模块4', '高保真辨识', '设计验证', '扰动边界'],
  items: UNIT_4_7_LESSON_STEPS.map((step, index) => ({
    stage: UNIT_4_7_STAGE_MAP[step.stage],
    order: index + 1,
    registryId: isUNIT_4_7InteractivePageType(step.pageType) ? 'classroom-assessment' : 'classroom-objective',
    resourceType: ResourceType.INTERACTIVE_COMP,
    duration: Math.max(1, Math.round(Number.parseFloat(step.duration) || 1)),
    title: step.title,
    description: step.hint,
    config: {},
  })),
};
