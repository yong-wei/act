import type { AIContextConfig } from '@/types/ai-context';
import {
  UNIT_5_2_AI_PAGE_GOALS,
  UNIT_5_2_COURSE_DESCRIPTION,
  UNIT_5_2_COURSE_TITLE,
  UNIT_5_2_LESSON_KEY,
  UNIT_5_2_LESSON_STEPS,
} from './unit-5-2-course';

export const UNIT_5_2_COURSE_META = {
  courseId: UNIT_5_2_LESSON_KEY,
  courseTitle: UNIT_5_2_COURSE_TITLE,
  courseDescription: UNIT_5_2_COURSE_DESCRIPTION,
  keyConcepts: ['局部线性化', '相平面', '描述函数', '负倒曲线', '微小扰动法', '自振风险'],
} as const;

function pageTypeFor(stepId: string) {
  const pageType = UNIT_5_2_LESSON_STEPS.find((step) => step.id === stepId)?.pageType ?? 'display';
  if (pageType === 'quiz_group' || pageType === 'single_choice') return 'quiz';
  if (pageType === 'summary') return 'summary';
  if (pageType === 'activity_card_set' || pageType === 'parameter_slider' || pageType === 'teacher_reveal_only') {
    return 'practice';
  }
  return 'theory';
}

function buildContext(stepId: string): AIContextConfig {
  const step = UNIT_5_2_LESSON_STEPS.find((item) => item.id === stepId) ?? UNIT_5_2_LESSON_STEPS[0];
  const goal = UNIT_5_2_AI_PAGE_GOALS[stepId] ?? step.hint;

  return {
    enabled: true,
    courseId: UNIT_5_2_COURSE_META.courseId,
    courseTitle: UNIT_5_2_COURSE_META.courseTitle,
    pageType: pageTypeFor(stepId),
    stepId,
    topic: step.title,
    learningObjectives: [goal, '回答时只回接本页证据，不替学生直接生成整页作答。'],
    knowledgeType: 'X',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: goal },
      { label: '非线性判断', question: `这一页怎样帮助判断“${step.title}”中的非线性证据？` },
    ],
    systemPromptExtension: `${goal} 本页 AI 以隐藏式页面上下文工作，不在页面正文中显示独立 AI 入口。`,
  };
}

export const UNIT_5_2_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_5_2_LESSON_STEPS.map((step) => [step.id, buildContext(step.id)]),
);

export function getUnit52StepAIContextLocal(stepId: string) {
  return UNIT_5_2_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit52StepQuickQuestionsLocal(stepId: string) {
  return UNIT_5_2_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit52StepAIContext(stepId: string) {
  return getUnit52StepAIContextLocal(stepId);
}

export function getUnit52StepQuickQuestions(stepId: string) {
  return getUnit52StepQuickQuestionsLocal(stepId);
}
