import {
  buildKonlingTeachingAssistantRuntimeContract,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  buildStudyQuestionOutputContractLines,
  STUDY_QUESTION_SECTIONS,
  type StudyQuestionIntent,
} from '@/lib/konling-study-question-structure';
import type { PageContext, UserProfile } from '@/types/ai-context';

import type {
  KonlingFairExperimentArm,
  KonlingFairExperimentBankItem,
} from './types';

/**
 * 三臂系统提示组装（#1900）。三臂共用同一基础上下文与同一用户消息；
 * 差异只来自臂定义：
 *
 * - plain-baseline：基础提示，无任何结构要求（合同化之前的基线形态）。
 * - enhanced-baseline：基础提示 + 与功能组相同的篇幅/结构要求行，纯文本
 *   注入，不经过专用意图分类、逐单元引用映射与规范 fail-closed 门禁。
 * - full-feature：产品运行时合同 + prompt builder 渲染；其中章节/篇幅
 *   要求公平固定为题库标注意图（两臂要求恒等），分类器输出只进指标。
 */

export interface KonlingFairExperimentPromptContext {
  page: PageContext;
  user: UserProfile;
}

export function buildKonlingFairExperimentPromptContext(): KonlingFairExperimentPromptContext {
  return {
    page: {
      courseId: 'fair-experiment',
      courseTitle: '自动控制原理',
      pageType: 'theory',
      stepId: 'fair-experiment',
      topic: '自动控制原理知识问答',
      learningObjectives: [],
      knowledgeType: 'C',
    },
    user: {
      id: 'fair-experiment-learner',
      name: '合成学习者',
      profileAvailability: 'missing',
    },
  };
}

/** 三臂共用的用户消息：题面 + 同一份参考材料（证据可用性一致）。 */
export function buildKonlingFairExperimentUserPrompt(item: KonlingFairExperimentBankItem): string {
  return [
    `问题：${item.question}`,
    `参考材料：${item.referenceAnswer}`,
  ].join('\n');
}

export function buildKonlingFairExperimentRuntimeContext(
  context: KonlingFairExperimentPromptContext,
): KonlingRuntimeContext {
  return {
    pageContext: context.page,
    userProfile: context.user,
    learnerState: null,
    planContext: {
      currentPathId: null,
      activeNodeId: null,
      nextNodeIds: [],
      recentPathIds: [],
      completedNodeIds: [],
      status: 'missing',
    },
    memory: [],
    permittedTools: [],
    missingContext: [],
    featureFlags: { learnerState: false, semanticMemory: false, strategyMemory: false },
  };
}

function enhancedBaselineRequirementLines(intent: StudyQuestionIntent): string[] {
  const titles = STUDY_QUESTION_SECTIONS[intent].map((section) => section.title);
  // 与 buildStudyQuestionOutputContractLines 相同的篇幅/结构要求，但作为
  // 纯文本注入：不携带类型标签、逐单元引用映射或规范核验行。
  return buildStudyQuestionOutputContractLines({
    intent,
    requiredSections: titles,
    depth: 'standard',
    format: 'default',
    hintStrength: 'full-answer',
  });
}

export function buildKonlingFairExperimentSystemPrompt(input: {
  arm: KonlingFairExperimentArm;
  item: KonlingFairExperimentBankItem;
  context: KonlingFairExperimentPromptContext;
}): {
  systemPrompt: string;
  contractIntent: string | null;
} {
  const { arm, item, context } = input;
  if (arm === 'plain-baseline' || arm === 'enhanced-baseline') {
    const base = buildKonlingSystemPrompt({ page: context.page, user: context.user, sessionHistory: [] });
    if (arm === 'plain-baseline') {
      return { systemPrompt: base, contractIntent: null };
    }
    const systemPrompt = [
      base,
      '',
      '本次专业问答要求:',
      ...enhancedBaselineRequirementLines(item.intent),
    ].join('\n');
    return { systemPrompt, contractIntent: item.intent };
  }

  const runtimeContext = buildKonlingFairExperimentRuntimeContext(context);
  const scope: KonlingRuntimeScope = {
    authenticatedUserId: 'fair-experiment',
    targetUserId: 'fair-experiment',
    role: 'student',
    courseId: context.page.courseId,
    pageId: context.page.stepId,
    privacyScopes: [],
  };
  const contract = buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext,
    scope,
    currentUserQuery: item.question,
  });
  // 公平固定（#1900）：交付的章节合同始终使用题库标注意图，保证
  // enhanced-baseline 与 full-feature 两臂收到相同章节/篇幅要求——分类
  // 未命中不得改变功能组的章节要求。分类器输出单独进入分类一致率指标。
  const labeledTitles = STUDY_QUESTION_SECTIONS[item.intent].map((section) => section.title);
  const teachingAssistantMode = {
    ...contract,
    studyQuestion: {
      intent: item.intent,
      requiredSections: labeledTitles,
      normativeGuidance: item.intent === 'normative-content'
        ? ('verification-required' as const)
        : ('not-applicable' as const),
      preferences: {
        depth: 'standard',
        format: 'default',
        hintStrength: 'full-answer',
        exampleContext: null,
      },
    },
  };
  const systemPrompt = buildKonlingSystemPrompt({
    page: context.page,
    user: context.user,
    sessionHistory: [],
    adaptiveRuntime: {
      teachingAssistantMode,
      knowledgeCapabilityContext: contract.groundingContext,
    },
  });
  return { systemPrompt, contractIntent: contract.studyQuestion?.intent ?? null };
}
