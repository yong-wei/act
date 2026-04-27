import type { AIContextConfig } from '@/types/ai-context';
import {
  UNIT_4_7_COURSE_DESCRIPTION,
  UNIT_4_7_COURSE_TITLE,
  UNIT_4_7_LESSON_KEY,
  UNIT_4_7_LESSON_STEPS,
  UNIT_4_7_PAGE_CONTRACTS,
} from './unit-4-7-course';

export const UNIT_4_7_COURSE_META = {
  courseId: UNIT_4_7_LESSON_KEY,
  courseTitle: UNIT_4_7_COURSE_TITLE,
  courseDescription: UNIT_4_7_COURSE_DESCRIPTION,
  keyConcepts: ['高保真辨识', '传统设计', '优化解码', '跨模型验证', '扰动噪声边界'],
} as const;

function pageTypeFor(stepId: string) {
  const pageType = UNIT_4_7_LESSON_STEPS.find((step) => step.id === stepId)?.pageType ?? 'display';
  if (pageType === 'quiz_group') return 'quiz';
  if (pageType === 'summary') return 'summary';
  if (pageType === 'activity_card_set') return 'practice';
  return 'theory';
}

function buildContext(stepId: string): AIContextConfig {
  const step = UNIT_4_7_LESSON_STEPS.find((item) => item.id === stepId) ?? UNIT_4_7_LESSON_STEPS[0];
  const contract = UNIT_4_7_PAGE_CONTRACTS[stepId];
  const goal = contract?.aiPageGoal ?? step.hint;

  return {
    enabled: true,
    courseId: UNIT_4_7_COURSE_META.courseId,
    courseTitle: UNIT_4_7_COURSE_META.courseTitle,
    pageType: pageTypeFor(stepId),
    stepId,
    topic: step.title,
    learningObjectives: [goal, '回答时只回接本页证据，不替学生直接生成整页作答。'],
    knowledgeType: 'D',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: goal },
      { label: '关键判断', question: `这一页如何支撑“${step.title}”？` },
    ],
    systemPromptExtension: `${goal} 本页 AI 以隐藏式页面上下文工作，不在页面正文中显示独立 AI 入口。`,
  };
}

export const UNIT_4_7_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_4_7_LESSON_STEPS.map((step) => [step.id, buildContext(step.id)]),
);

export function getUnit47StepAIContextLocal(stepId: string) {
  return UNIT_4_7_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit47StepQuickQuestionsLocal(stepId: string) {
  return UNIT_4_7_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit47StepAIContext(stepId: string) {
  return getUnit47StepAIContextLocal(stepId);
}

export function getUnit47StepQuickQuestions(stepId: string) {
  return getUnit47StepQuickQuestionsLocal(stepId);
}
