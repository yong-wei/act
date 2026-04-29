import type { AIContextConfig } from '@/types/ai-context';
import { UNIT_3_8_RUNTIME_MANIFEST } from '@/lib/unit-3-8-course';

export const UNIT_3_8_COURSE_META = {
  courseId: 'unit-3-8-frequency-domain-translation-judgment-v1',
  courseTitle: '3-8：频域判别与跨域综合语言',
  courseDescription:
    '围绕结构变化的频域指纹、Nyquist 与 Bode 统一判稳链、三频段分工与工程案例读回，把模块 3 理论主线收束为一张频域判断地图。',
  keyConcepts: ['频域指纹', 'Nyquist 判稳', 'Bode 裕度', '三频段分工', '中频超前', '工程读回'],
} as const;

function resolvePageType(interactionKind: string): AIContextConfig['pageType'] {
  if (interactionKind === 'quiz_group') return 'quiz';
  if (interactionKind === 'none' || interactionKind === 'teacher_reveal_only') return 'theory';
  return 'practice';
}

function buildQuickQuestions(title: string) {
  return [
    { label: '本页对象', question: `本页“${title}”需要先识别的对象是什么？` },
    { label: '判断链', question: `本页结论如何接回频域指纹、稳定边界和闭环后果这条判断链？` },
  ];
}

function contextFromStep(step: (typeof UNIT_3_8_RUNTIME_MANIFEST.steps)[number]): AIContextConfig {
  const pageGoal = step.aiContextSpec.pageGoal || step.title;
  return {
    enabled: true,
    courseId: UNIT_3_8_COURSE_META.courseId,
    courseTitle: UNIT_3_8_COURSE_META.courseTitle,
    pageType: resolvePageType(step.interactionSpec.interactionKind),
    stepId: step.id,
    topic: step.title,
    learningObjectives: [pageGoal],
    knowledgeType: 'X',
    tools: ['explain_concept', 'provide_guidance', 'check_answer'],
    quickQuestions: buildQuickQuestions(step.title),
    systemPromptExtension: `${pageGoal} 只围绕当前页的对象、公式、图形和判断链提供解释，不替学生完成需要提交的作答。`,
  };
}

export const UNIT_3_8_STEP_AI_CONTEXTS: Record<string, AIContextConfig> = Object.fromEntries(
  UNIT_3_8_RUNTIME_MANIFEST.steps.map((step) => [step.id, contextFromStep(step)]),
);

export function getUnit38StepAIContext(stepId: string): AIContextConfig | null {
  return UNIT_3_8_STEP_AI_CONTEXTS[stepId] ?? null;
}

export function getUnit38StepQuickQuestions(stepId: string): Array<{ label: string; question: string }> {
  return UNIT_3_8_STEP_AI_CONTEXTS[stepId]?.quickQuestions ?? [];
}

export const getUNIT_3_8StepAIContext = getUnit38StepAIContext;
export const getUNIT_3_8StepQuickQuestions = getUnit38StepQuickQuestions;
