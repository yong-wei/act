import type { AIContextConfig } from '@/types/ai-context';
import { UNIT_4_3_COURSE_DESCRIPTION, UNIT_4_3_COURSE_TITLE, UNIT_4_3_PRESET_KEY, UNIT_4_3_PRESET_STEPS } from './unit-4-3-course';

export const UNIT_4_3_COURSE_META = {
  courseId: UNIT_4_3_PRESET_KEY,
  courseTitle: UNIT_4_3_COURSE_TITLE,
  courseDescription: UNIT_4_3_COURSE_DESCRIPTION,
  keyConcepts: ['反馈主结构', '前馈补偿', '给定滤波', '执行器保护', '抗饱和验证', '首轮记录'],
} as const;

function pageTypeFor(stepPageType: string): AIContextConfig['pageType'] {
  if (stepPageType === 'quiz_group') return 'quiz';
  if (stepPageType === 'display') return 'theory';
  return 'practice';
}

function contextForStep(step: (typeof UNIT_4_3_PRESET_STEPS)[number]): AIContextConfig {
  return {
    enabled: true,
    courseId: UNIT_4_3_COURSE_META.courseId,
    courseTitle: UNIT_4_3_COURSE_META.courseTitle,
    pageType: pageTypeFor(step.pageType),
    stepId: step.id,
    topic: step.title,
    learningObjectives: [
      step.hint,
      '把本页证据接回经典复合控制初始方案。',
    ],
    knowledgeType: 'D',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      {
        label: '本页目标',
        question: `本页“${step.title}”在经典复合控制初始方案中承担什么作用？`,
      },
      {
        label: '证据检查',
        question: '这一页需要同时看哪几类证据，才能避免只凭单条曲线或单个公式下结论？',
      },
    ],
    systemPromptExtension: `${step.hint} 回答时只使用本页证据，不替学生直接生成完整作答。`,
  };
}

export const UNIT_4_3_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_4_3_PRESET_STEPS.map((step) => [step.id, contextForStep(step)]),
);

export function getUnit43StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_4_3_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit43StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_4_3_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_4_3StepAIContext = getUnit43StepAIContext;
export const getUNIT_4_3StepQuickQuestions = getUnit43StepQuickQuestions;
