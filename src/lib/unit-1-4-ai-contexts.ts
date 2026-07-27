import type { AIContextConfig } from '@/types/ai-context';
import type { InteractiveRuntimeStepManifest } from '@/lib/interactive-lesson-manifest';
import {
  UNIT_1_4_AI_PAGE_GOALS,
  UNIT_1_4_COURSE_DESCRIPTION,
  UNIT_1_4_COURSE_TITLE,
  UNIT_1_4_LESSON_KEY,
  UNIT_1_4_LESSON_STEPS,
} from './unit-1-4-course';

export const UNIT_1_4_COURSE_META = {
  courseId: UNIT_1_4_LESSON_KEY,
  courseTitle: UNIT_1_4_COURSE_TITLE,
  courseDescription: UNIT_1_4_COURSE_DESCRIPTION,
  keyConcepts: ['时域响应', '频率响应', 'Bode 图', 'Nyquist 图', '多域联读'],
} as const;

export function getUNIT_1_4RequiredResponseKeys(step: InteractiveRuntimeStepManifest) {
  const activityKeys = (step.interactionSpec.activityCards ?? []).map((card) => card.id);
  const computeKeys = step.modules
    .filter((module) => module.kind === 'compute.panel')
    .map((module) => module.payload.responseContractId)
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);
  return Array.from(new Set([...activityKeys, ...computeKeys]));
}

function pageTypeFor(stepId: string) {
  const pageType = UNIT_1_4_LESSON_STEPS.find((step) => step.id === stepId)?.pageType ?? 'display';
  if (pageType === 'quiz_group' || pageType === 'activity_cards') return 'quiz';
  if (pageType === 'summary') return 'summary';
  if (pageType === 'worked_example_reveal' || pageType === 'interactive_figure_submit' || pageType === 'table_builder') return 'practice';
  return 'theory';
}

function knowledgeTypeFor(stepId: string): AIContextConfig['knowledgeType'] {
  if (['step-04', 'step-05', 'step-06', 'step-07', 'step-08'].includes(stepId)) return 'X';
  if (stepId === 'step-03' || stepId === 'step-11') return 'D';
  return 'C';
}

function buildContext(stepId: string): AIContextConfig {
  const step = UNIT_1_4_LESSON_STEPS.find((item) => item.id === stepId) ?? UNIT_1_4_LESSON_STEPS[0];
  const goal = UNIT_1_4_AI_PAGE_GOALS[stepId] ?? step.hint;

  return {
    enabled: true,
    courseId: UNIT_1_4_COURSE_META.courseId,
    courseTitle: UNIT_1_4_COURSE_META.courseTitle,
    pageType: pageTypeFor(stepId),
    stepId,
    topic: step.title,
    learningObjectives: [
      goal,
      '回答时优先解释通道对象、时域过程、频域读数和多图证据之间的判断链，不替学生直接生成整页作答。',
    ],
    knowledgeType: knowledgeTypeFor(stepId),
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: [
      { label: '本页目标', question: goal },
      { label: '判断线索', question: `这一页怎样帮助我理解“${step.title}”？` },
    ],
    systemPromptExtension: `${goal} 本页 AI 应围绕时域与频域的对象标注、Bode/Nyquist 同源表达和多域证据联读作答，避免混淆闭环带宽与环路穿越频率。`,
  };
}

export function createUNIT_1_4AIContext(
  step: InteractiveRuntimeStepManifest,
  state: { answers: Record<string, string>; answerVisible: boolean },
): AIContextConfig {
  const requiredResponseKeys = getUNIT_1_4RequiredResponseKeys(step);
  const submittedResponseCount = requiredResponseKeys.filter((key) => (
    Object.prototype.hasOwnProperty.call(state.answers, key)
  )).length;
  const responseStatus = requiredResponseKeys.length === 0
    ? 'not_required'
    : submittedResponseCount === 0
      ? 'unsubmitted'
      : submittedResponseCount === requiredResponseKeys.length
        ? 'complete'
        : 'partial';
  const canCheckAnswer = responseStatus === 'not_required' || responseStatus === 'complete' || state.answerVisible;
  const allowedScope = step.aiContextSpec.allowedScope ?? [];
  const forbiddenScope = step.aiContextSpec.forbiddenScope ?? [];
  const deliveryMode = step.aiContextSpec.deliveryMode || 'guided';
  const stateRule = state.answerVisible
    ? '教师已经揭示答案，可以检查现有作答，但不得代写或替学生提交。'
    : responseStatus === 'complete'
      ? '本页所需响应已经全部确认提交，可以检查现有答案，但不得代写或替学生提交。'
      : responseStatus === 'partial'
        ? '本页仅有部分响应确认提交，仍禁止检查答案或声称作答已经完成。'
        : responseStatus === 'unsubmitted'
          ? '本页所需响应尚未确认提交，禁止给出答案、检查答案或生成提交内容。'
          : '本页不产生学生响应，可以解释和检查页面概念，但不得虚构学生已提交作答。';

  return {
    enabled: true,
    courseId: UNIT_1_4_COURSE_META.courseId,
    courseTitle: UNIT_1_4_COURSE_META.courseTitle,
    pageType: pageTypeFor(step.id),
    stepId: step.id,
    topic: step.title,
    learningObjectives: [step.aiContextSpec.pageGoal, ...allowedScope],
    knowledgeType: knowledgeTypeFor(step.id),
    tools: canCheckAnswer
      ? ['explain_concept', 'provide_guidance', 'check_answer']
      : ['explain_concept', 'provide_guidance'],
    quickQuestions: [
      { label: '本页目标', question: step.aiContextSpec.pageGoal },
      { label: '观察方法', question: `请只提示“${step.title}”的观察顺序，不要给出待提交答案。` },
    ],
    systemPromptExtension: [
      `本页目标：${step.aiContextSpec.pageGoal}`,
      `引导方式：${deliveryMode}`,
      allowedScope.length ? `允许：${allowedScope.join('；')}` : '',
      forbiddenScope.length ? `禁止：${forbiddenScope.join('；')}` : '',
      stateRule,
      '不得代替学生作答或生成可直接提交的完整答案。',
    ].filter(Boolean).join('。'),
  };
}

export const UNIT_1_4_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_1_4_LESSON_STEPS.map((step) => [step.id, buildContext(step.id)]),
);

export function getUnit14StepAIContextLocal(stepId: string) {
  return UNIT_1_4_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit14StepQuickQuestionsLocal(stepId: string) {
  return UNIT_1_4_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export function getUnit14StepAIContext(stepId: string) {
  return getUnit14StepAIContextLocal(stepId);
}

export function getUnit14StepQuickQuestions(stepId: string) {
  return getUnit14StepQuickQuestionsLocal(stepId);
}

export const getUNIT_1_4StepAIContext = getUnit14StepAIContext;
export const getUNIT_1_4StepQuickQuestions = getUnit14StepQuickQuestions;
