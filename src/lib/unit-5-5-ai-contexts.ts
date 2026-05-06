import type { AIContextConfig } from '@/types/ai-context';
import {
  UNIT_5_5_AI_PAGE_GOALS,
  UNIT_5_5_COURSE_DESCRIPTION,
  UNIT_5_5_COURSE_TITLE,
  UNIT_5_5_LESSON_KEY,
  UNIT_5_5_LESSON_STEPS,
} from './unit-5-5-course';

export const UNIT_5_5_COURSE_META = {
  courseId: UNIT_5_5_LESSON_KEY,
  courseTitle: UNIT_5_5_COURSE_TITLE,
  courseDescription: UNIT_5_5_COURSE_DESCRIPTION,
  keyConcepts: ['显式控制律', '策略学习入口', '强化学习回报', '航向 RL 环境', '安全外壳', 'RL 调度 PID'],
} as const;

function pageTypeFor(stepId: string) {
  const pageType = UNIT_5_5_LESSON_STEPS.find((step) => step.id === stepId)?.pageType ?? 'display';
  if (pageType === 'quiz_group' || pageType === 'single_choice') return 'quiz';
  if (pageType === 'summary') return 'summary';
  if (
    pageType === 'activity_card_set' ||
    pageType === 'drag_match' ||
    pageType === 'multi_select' ||
    pageType === 'interactive_figure_submit' ||
    pageType === 'step_reveal' ||
    pageType === 'rust_toy_training_panel' ||
    pageType === 'rust_heading_rl_training_panel'
  ) return 'practice';
  return 'theory';
}

function buildContext(stepId: string): AIContextConfig {
  const step = UNIT_5_5_LESSON_STEPS.find((item) => item.id === stepId) ?? UNIT_5_5_LESSON_STEPS[0];
  const goal = UNIT_5_5_AI_PAGE_GOALS[stepId] ?? step.hint;

  return {
    enabled: true,
    courseId: UNIT_5_5_COURSE_META.courseId,
    courseTitle: UNIT_5_5_COURSE_META.courseTitle,
    pageType: pageTypeFor(stepId),
    stepId,
    topic: step.title,
    learningObjectives: [goal, '回答时只回接本页证据，不替学生直接生成整页作答。'],
    knowledgeType: 'X',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: goal },
      { label: '证据判断', question: `这一页怎样帮助判断“${step.title}”中的策略学习入口、训练证据或安全保护责任？` },
    ],
    systemPromptExtension: `${goal} 本页 AI 以隐藏式页面上下文工作，不在页面正文中显示独立 AI 入口。`,
  };
}

export const UNIT_5_5_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_5_5_LESSON_STEPS.map((step) => [step.id, buildContext(step.id)]),
);

export function getUnit55StepAIContextLocal(stepId: string) {
  return UNIT_5_5_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit55StepQuickQuestionsLocal(stepId: string) {
  return UNIT_5_5_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit55StepAIContext(stepId: string) {
  return getUnit55StepAIContextLocal(stepId);
}

export function getUnit55StepQuickQuestions(stepId: string) {
  return getUnit55StepQuickQuestionsLocal(stepId);
}
