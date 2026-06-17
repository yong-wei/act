import type { AIContextConfig } from '@/types/ai-context';
import {
  UNIT_1_2_AI_PAGE_GOALS,
  UNIT_1_2_COURSE_DESCRIPTION,
  UNIT_1_2_COURSE_TITLE,
  UNIT_1_2_LESSON_KEY,
  UNIT_1_2_LESSON_STEPS,
} from './unit-1-2-course';

export const UNIT_1_2_COURSE_META = {
  courseId: UNIT_1_2_LESSON_KEY,
  courseTitle: UNIT_1_2_COURSE_TITLE,
  courseDescription: UNIT_1_2_COURSE_DESCRIPTION,
  keyConcepts: ['机理建模', '微分方程', '传递函数', '方框图', '信号流图', '极点'],
} as const;

function pageTypeFor(stepId: string) {
  const pageType = UNIT_1_2_LESSON_STEPS.find((step) => step.id === stepId)?.pageType ?? 'display';
  if (pageType === 'quiz_group' || pageType === 'single_choice') return 'quiz';
  if (pageType === 'summary') return 'summary';
  if (pageType === 'step_reveal' || pageType === 'interactive_figure_submit') return 'practice';
  return 'theory';
}

function knowledgeTypeFor(stepId: string): AIContextConfig['knowledgeType'] {
  if (stepId === 'step-05' || stepId === 'step-06' || stepId === 'step-10' || stepId === 'step-12') return 'X';
  if (stepId === 'step-03' || stepId === 'step-13') return 'D';
  return 'C';
}

function buildContext(stepId: string): AIContextConfig {
  const step = UNIT_1_2_LESSON_STEPS.find((item) => item.id === stepId) ?? UNIT_1_2_LESSON_STEPS[0];
  const goal = UNIT_1_2_AI_PAGE_GOALS[stepId] ?? step.hint;

  return {
    enabled: true,
    courseId: UNIT_1_2_COURSE_META.courseId,
    courseTitle: UNIT_1_2_COURSE_META.courseTitle,
    pageType: pageTypeFor(stepId),
    stepId,
    topic: step.title,
    learningObjectives: [
      goal,
      '回答时优先解释本页的建模对象、图形证据和判断链，不替学生直接生成整页作答。',
    ],
    knowledgeType: knowledgeTypeFor(stepId),
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: goal },
      { label: '判断线索', question: `这一页怎样帮助我理解“${step.title}”？` },
    ],
    systemPromptExtension: `${goal} 本页 AI 应围绕 1-2 建模链路作答，避免引入与当前页无关的高级校正或工程实现细节。`,
  };
}

export const UNIT_1_2_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_1_2_LESSON_STEPS.map((step) => [step.id, buildContext(step.id)]),
);

export function getUnit12StepAIContextLocal(stepId: string) {
  return UNIT_1_2_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit12StepQuickQuestionsLocal(stepId: string) {
  return UNIT_1_2_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit12StepAIContext(stepId: string) {
  return getUnit12StepAIContextLocal(stepId);
}

export function getUnit12StepQuickQuestions(stepId: string) {
  return getUnit12StepQuickQuestionsLocal(stepId);
}

export const getUNIT_1_2StepAIContext = getUnit12StepAIContext;
export const getUNIT_1_2StepQuickQuestions = getUnit12StepQuickQuestions;
