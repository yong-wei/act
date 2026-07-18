import type { AIContextConfig } from '@/types/ai-context';
import {
  UNIT_1_3_AI_PAGE_GOALS,
  UNIT_1_3_COURSE_DESCRIPTION,
  UNIT_1_3_COURSE_TITLE,
  UNIT_1_3_LESSON_KEY,
  UNIT_1_3_LESSON_STEPS,
} from './unit-1-3-course';

export const UNIT_1_3_COURSE_META = {
  courseId: UNIT_1_3_LESSON_KEY,
  courseTitle: UNIT_1_3_COURSE_TITLE,
  courseDescription: UNIT_1_3_COURSE_DESCRIPTION,
  keyConcepts: ['闭环特征方程', '极点迁移', '临界阻尼', '衰减振荡', '根轨迹'],
} as const;

function pageTypeFor(stepId: string) {
  const pageType = UNIT_1_3_LESSON_STEPS.find((step) => step.id === stepId)?.pageType ?? 'display';
  if (pageType === 'quiz_group' || pageType === 'single_choice') return 'quiz';
  if (pageType === 'summary') return 'summary';
  if (pageType === 'step_reveal' || pageType === 'interactive_figure_submit') return 'practice';
  return 'theory';
}

function knowledgeTypeFor(stepId: string): AIContextConfig['knowledgeType'] {
  if (['step-04', 'step-05', 'step-06', 'step-07', 'step-08'].includes(stepId)) return 'X';
  if (stepId === 'step-03' || stepId === 'step-10') return 'D';
  return 'C';
}

function buildContext(stepId: string): AIContextConfig {
  const step = UNIT_1_3_LESSON_STEPS.find((item) => item.id === stepId) ?? UNIT_1_3_LESSON_STEPS[0];
  const goal = UNIT_1_3_AI_PAGE_GOALS[stepId] ?? step.hint;

  return {
    enabled: true,
    courseId: UNIT_1_3_COURSE_META.courseId,
    courseTitle: UNIT_1_3_COURSE_META.courseTitle,
    pageType: pageTypeFor(stepId),
    stepId,
    topic: step.title,
    learningObjectives: [
      goal,
      '回答时优先解释参数、极点、曲线之间的图形证据和判断链，不替学生直接生成整页作答。',
    ],
    knowledgeType: knowledgeTypeFor(stepId),
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: goal },
      { label: '判断线索', question: `这一页怎样帮助我理解“${step.title}”？` },
    ],
    systemPromptExtension: `${goal} 本页 AI 应围绕开闭环增益角色、极点迁移与根轨迹雏形作答，避免提前展开完整根轨迹法则或高级校正。`,
  };
}

export const UNIT_1_3_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_1_3_LESSON_STEPS.map((step) => [step.id, buildContext(step.id)]),
);

export function getUnit13StepAIContextLocal(stepId: string) {
  return UNIT_1_3_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit13StepQuickQuestionsLocal(stepId: string) {
  return UNIT_1_3_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit13StepAIContext(stepId: string) {
  return getUnit13StepAIContextLocal(stepId);
}

export function getUnit13StepQuickQuestions(stepId: string) {
  return getUnit13StepQuickQuestionsLocal(stepId);
}

export const getUNIT_1_3StepAIContext = getUnit13StepAIContext;
export const getUNIT_1_3StepQuickQuestions = getUnit13StepQuickQuestions;
