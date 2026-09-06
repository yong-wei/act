import {
  buildKonlingTeachingAssistantRuntimeContract,
  type KonlingCitationContext,
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

import {
  buildKonlingFairExperimentCitationAssembly,
  type KonlingFairExperimentCitationAssembly,
} from './evidence-pool';

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

/**
 * 分级盲审系统提示词（#1952，promptVersion konling-blind-audit-graded.v2，
 * scoreVersion rubric-graded.v2）：三级 verdict + 五子分，每个维度配一句
 * 操作性定义，降低子分主观性；输出契约与
 * parseKonlingFairExperimentGradedVerdict 严格对齐。
 */
export const KONLING_FAIR_EXPERIMENT_GRADED_AUDIT_SYSTEM_PROMPT = [
  '你是自动控制课程知识问答的独立分级盲审评委。',
  '对给定问题与被审回答（唯一评审对象），先按五维度各打 0-1 分，再整体分级：',
  '- accuracy：事实与推导正确性；题面含错误前提或冲突证据而回答未识别时大幅扣分。',
  '- evidenceFaithfulness：对参考材料与证据的忠实度；捏造、歪曲或过度引申来源即低分。',
  '- pedagogy：对目标学习者的讲解有效性；结论清晰、步骤可循、类比与边界说明恰当。',
  '- structureCompliance：是否遵循该意图要求的章节结构与篇幅。',
  '- traceCoverage：关键推理步骤与结论出处的覆盖完整度；跳步或无出处的关键断言扣分。',
  '整体分级：correct=完全正确；minor-flaw=存在轻微缺陷但不影响结论成立；',
  'major-error=重大错误（错误前提未处置、关键推导错误、结论不成立或捏造证据）。',
  'ruleScore 为 0-1 总分，必须与五子分和分级一致。',
  '只输出 JSON：{"verdict":"correct"|"minor-flaw"|"major-error","ruleScore":0-1,',
  '"subscores":{"accuracy":0-1,"evidenceFaithfulness":0-1,"pedagogy":0-1,',
  '"structureCompliance":0-1,"traceCoverage":0-1},"notes":"简要理由"}',
].join('\n');

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
  /**
   * #2039：full-feature 臂的证据装配输入（题库版本 + 生成修订）。存在时
   * 经生产分配模块装配 citationContext 并随返回值交出，供 runner 冻结
   * 与补证；基线臂必须不传（保持零引用能力）。
   */
  evidence?: { bankVersion: string; sourceRevision: string; includeAuditEdgeCandidates?: boolean };
}): {
  systemPrompt: string;
  contractIntent: string | null;
  citationAssembly?: KonlingFairExperimentCitationAssembly;
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

  const citationAssembly = input.evidence
    ? buildKonlingFairExperimentCitationAssembly({
      item,
      bankVersion: input.evidence.bankVersion,
      sourceRevision: input.evidence.sourceRevision,
      includeAuditEdgeCandidates: input.evidence.includeAuditEdgeCandidates,
    })
    : undefined;
  const runtimeContext = buildKonlingFairExperimentRuntimeContext(context);
  if (citationAssembly) {
    runtimeContext.citationContext = buildFairExperimentCitationContext(citationAssembly);
  }
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
      ...(runtimeContext.citationContext ? { citationContext: runtimeContext.citationContext } : {}),
    },
  });
  return {
    systemPrompt,
    contractIntent: contract.studyQuestion?.intent ?? null,
    ...(citationAssembly ? { citationAssembly } : {}),
  };
}

/**
 * #2039：把分配表映射为生产 `KonlingCitationContext` 形状（prompt 渲染
 * 与运行时合同共用）；逐单元映射附在 contentCitations 的同源数据上。
 * 未分配章节进入 lowConfidenceReasons，供模型如实降级而不是伪造覆盖。
 */
function buildFairExperimentCitationContext(
  assembly: KonlingFairExperimentCitationAssembly,
): KonlingCitationContext {
  const contentCitations = assembly.citations.map((citation) => ({
    id: citation.id,
    sourceType: 'content' as const,
    displayTitle: `参考材料引用 ${citation.displayNumber}`,
    href: citation.href,
    confidence: 'medium' as const,
    evidenceBasis: citation.answerRelevanceBasis ?? 'unspecified',
    owner: 'answer' as const,
    citationTargetId: citation.citationTargetId,
    verified: citation.verified,
    displayNumber: citation.displayNumber ?? undefined,
    answerRelevanceBasis: citation.answerRelevanceBasis ?? undefined,
  }));
  const unassignedTitles = assembly.plan.unassignedSectionIds
    .map((sectionId) => assembly.plan.assignments.find((row) => row.sectionId === sectionId)?.sectionTitle ?? sectionId);
  return {
    required: true,
    contentCitations,
    evidenceCitations: [],
    missingCitationClasses: unassignedTitles.length ? ['content'] : [],
    lowConfidenceReasons: unassignedTitles.map((title) => `章节「${title}」无可直接支撑的分配来源`),
    unitCitations: assembly.unitMappings.map((mapping) => ({
      sectionTitle: mapping.sectionTitle,
      displayNumbers: mapping.displayNumbers,
    })),
    responseProtocol: {
      requiredOwners: ['answer'],
      minimum: { content: 1, evidenceWhenAvailable: 1 },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}
