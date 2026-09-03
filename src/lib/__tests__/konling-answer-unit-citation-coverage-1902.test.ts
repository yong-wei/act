import { describe, expect, it, vi } from 'vitest';

import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  buildKonlingCitationGuard,
  buildKonlingTeachingAssistantRuntimeContract,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import {
  STUDY_QUESTION_INTENTS,
  type StudyQuestionIntent,
} from '@/lib/konling-study-question-structure';

vi.mock('server-only', () => ({}));

function createScope(): KonlingRuntimeScope {
  return {
    authenticatedUserId: 'student-1',
    targetUserId: 'student-1',
    role: 'student',
    classId: 'class-1',
    courseId: 'unit-4-5',
    pageId: 'step-03',
    resourceId: 'resource-1',
    pathNodeId: 'node-1',
    privacyScopes: ['student-visible'],
  };
}

function createRuntimeContext(citationContext: KonlingRuntimeContext['citationContext']): KonlingRuntimeContext {
  return {
    pageContext: {
      courseId: 'simulation',
      courseTitle: '仿真',
      pageType: 'practice',
      stepId: 'pid-default',
      topic: 'PID 参数整定',
      learningObjectives: [],
      knowledgeType: 'X',
    },
    userProfile: {
      id: 'student-1',
      name: '张三',
      learningStyle: 'INTERACTIVE',
      cognitiveLevel: 3,
      abilityVector: {
        computational: 0.5,
        crossDomain: 0.5,
        design: 0.5,
        analysis: 0.5,
        evaluation: 0.5,
      },
    },
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
    citationContext,
    permittedTools: ['get_page_context', 'search_knowledge_graph'],
    missingContext: [],
    featureFlags: {
      learnerState: false,
      semanticMemory: false,
      strategyMemory: false,
    },
  };
}

function createCitationContext(extraContent: unknown[] = []) {
  return {
    required: true,
    contentCitations: [
      {
        id: 'content:evidence:primary',
        sourceType: 'content',
        displayTitle: '闭环控制教材片段',
        href: '/course-runtime/resources/closed-loop.md',
        confidence: 'high',
        evidenceBasis: 'source-pack:konling-answer:test',
        owner: 'answer',
        citationTargetId: 'content:closed-loop',
        verified: true,
        resolver: 'course-runtime',
        displayNumber: 1,
      },
      ...extraContent,
    ],
    evidenceCitations: [],
    missingCitationClasses: [],
    lowConfidenceReasons: [],
    responseProtocol: {
      requiredOwners: ['answer'],
      minimum: { content: 1, evidenceWhenAvailable: 0 },
      fallbackWhenMissing: 'low-confidence',
    },
  };
}

const QUERIES: Record<StudyQuestionIntent, string> = {
  'formula-derivation': '请推导闭环传递函数',
  'code-debugging': '这段 TypeScript 报错，帮我调试',
  'concept-comparison': '比较开环和闭环控制的区别',
  'normative-content': '请给出国家标准对控制实验报告的规范格式',
  'open-ended-explanation': '请用生活化例子解释，并换一种格式',
  'fact-explanation': '什么是超调量？',
};

// 典型模型输出：evidence-required 章节含引导头、纯公式展示行与短过渡等
// 结构行，但所有 substantive 结论行都带 [1]——覆盖分母只数 substantive 行。
const STRUCTURAL_MIXED_ANSWERS: Record<StudyQuestionIntent, { answer: string; requiredCount: number }> = {
  'formula-derivation': {
    answer: [
      '## 前提与符号',
      '主要假设包括：',
      '$$G(s)=\\frac{K}{Ts+1}$$',
      '接下来看符号约定',
      'G(s) 为前向通道，H(s) 为反馈通道 [1]。',
      '## 关键变形',
      '闭环为 G/(1+GH)。',
      '## 适用条件',
      '仅适用于单位负反馈的线性定常系统 [1]。',
    ].join('\n'),
    requiredCount: 2,
  },
  'code-debugging': {
    answer: [
      '**故障定位**',
      '现象描述：',
      '**可能原因**',
      '接下来排查',
      '**最小修复**',
      '为积分项增加抗饱和限幅 [1]。',
      '修复说明：',
      '**验证方法**',
      '观察阶跃超调是否回落。',
    ].join('\n'),
    requiredCount: 1,
  },
  'concept-comparison': {
    answer: [
      '## 判别维度',
      '比较维度如下：',
      '是否存在反馈回路 [1]。',
      '## 联系与差异',
      '闭环能抑制扰动 [1]。',
      '另看稳态精度',
      '## 边界或反例',
      '开环在模型很准时也可以。',
    ].join('\n'),
    requiredCount: 2,
  },
  'normative-content': {
    answer: [
      '## 适用范围',
      '适用对象：',
      '课程内的控制实验报告 [1]。',
      '## 规范结论',
      '封面必须包含题目与姓名 [1]。',
      '## 核验来源',
      '核验说明：',
      '以课程发布的服务端验证来源为准 [1]。',
    ].join('\n'),
    requiredCount: 3,
  },
  'open-ended-explanation': {
    answer: [
      '## 核心结论',
      '先说结论：',
      '超调是响应冲过稳态的现象 [1]。',
      '## 定制化讲解',
      '像船舵打得太猛。',
      '## 适用边界',
      '先看适用边界',
      '只适用于阶跃响应 [1]。',
    ].join('\n'),
    requiredCount: 2,
  },
  'fact-explanation': {
    answer: [
      '## 核心结论',
      '定义如下：',
      '超调量是峰值相对稳态值的超出比例 [1]。',
      '## 解释',
      '越大越抖。',
      '## 适用边界',
      '要求系统先达到稳态 [1]。',
    ].join('\n'),
    requiredCount: 2,
  },
};

function guardFor(
  intent: StudyQuestionIntent,
  answer: string,
  citationContext: ReturnType<typeof createCitationContext> = createCitationContext(),
) {
  const runtime = createRuntimeContext(citationContext);
  const contract = buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext: runtime,
    scope: createScope(),
    currentUserQuery: QUERIES[intent],
  });
  expect(contract.studyQuestion?.intent).toBe(intent);
  return buildKonlingCitationGuard(
    { citationContext: runtime.citationContext, teachingAssistantMode: contract },
    answer,
  );
}

describe('issue #1902 answer-unit citation coverage regression', () => {
  it.each(STUDY_QUESTION_INTENTS)(
    'structural lines do not dilute coverage for intent %s when every substantive conclusion carries [n]',
    (intent) => {
      const { answer, requiredCount } = STRUCTURAL_MIXED_ANSWERS[intent];
      // 规范性意图提供 official-reference 权威来源，使 guidance=verified、
      // 覆盖测量正常生效；fail-closed 语义已由 #1819 套件覆盖。
      const citationContext = intent === 'normative-content'
        ? createCitationContext()
        : createCitationContext();
      if (intent === 'normative-content') {
        citationContext.contentCitations[0] = {
          ...citationContext.contentCitations[0],
          resolver: 'official-reference',
        };
      }
      const guard = guardFor(intent, answer, citationContext);

      expect(guard.answerUnitCoverage).toMatchObject({
        intent,
        requiredCount,
        coveredCount: requiredCount,
        ratio: 1,
        missingReasons: [],
      });
    },
  );

  it('classifies unbound substantive units into no-marker, unassigned, unverified and no-target reasons', () => {
    const citationContext = createCitationContext([
      {
        id: 'content:evidence:unverified',
        sourceType: 'content',
        displayTitle: '未验证片段',
        href: '/course-runtime/resources/unverified.md',
        confidence: 'medium',
        evidenceBasis: 'source-pack:konling-answer:test',
        owner: 'answer',
        citationTargetId: 'content:unverified',
        verified: false,
        resolver: 'course-runtime',
        displayNumber: 2,
      },
      {
        id: 'content:evidence:no-target',
        sourceType: 'content',
        displayTitle: '无锚点片段',
        href: null,
        confidence: 'medium',
        evidenceBasis: 'source-pack:konling-answer:test',
        owner: 'answer',
        citationTargetId: null,
        verified: true,
        resolver: 'course-runtime',
        displayNumber: 3,
      },
    ]);
    const answer = [
      '## 核心结论',
      '结论一没有任何编号。',
      '结论二引用了未验证的来源 [2]。',
      '结论三引用了没有锚点的来源 [3]。',
      '## 适用边界',
      '边界结论引用了未分配的编号 [9]。',
    ].join('\n');

    const guard = guardFor('open-ended-explanation', answer, citationContext);

    expect(guard.answerUnitCoverage).toMatchObject({
      requiredCount: 4,
      coveredCount: 0,
      ratio: 0,
    });
    expect(guard.answerUnitCoverage?.missingReasons).toEqual([
      { reason: 'no-marker', count: 1 },
      { reason: 'citation-unverified', count: 1 },
      { reason: 'citation-no-target', count: 1 },
      { reason: 'marker-unassigned', count: 1 },
    ]);
    // 未覆盖的 evidence-required 章节仍然触发低置信降级
    expect(guard.lowConfidenceReasons).toContain('answer-unit-citation-missing:claim');
    expect(guard.lowConfidenceReasons).toContain('answer-unit-citation-missing:limit');
  });

  it('reports drifted markers as diagnostics without rescuing evidence-section coverage', () => {
    const answer = [
      '## 前提与符号',
      '输入为单位阶跃。',
      '## 结果校验',
      '分母次数不低于分子 [1]。',
    ].join('\n');

    const guard = guardFor('formula-derivation', answer);

    expect(guard.answerUnitCoverage).toMatchObject({
      requiredCount: 1,
      coveredCount: 0,
      ratio: 0,
      missingReasons: [{ reason: 'no-marker', count: 1 }],
    });
    // 有效 [1] 只出现在 model-derived 章节（结果校验），计为漂移且不救回覆盖
    expect(guard.diagnosticReasons).toContain('answer-citation-drift:1');
    expect(guard.lowConfidenceReasons).toContain('answer-unit-citation-missing:assumptions');
  });

  it('reports stacked duplicate markers without inflating unit coverage', () => {
    const stackedAnswer = [
      '## 核心结论',
      '超调量是峰值相对稳态值的超出比例 [1][1]。',
    ].join('\n');
    const guard = guardFor('fact-explanation', stackedAnswer);

    expect(guard.answerUnitCoverage).toMatchObject({
      requiredCount: 1,
      coveredCount: 1,
      ratio: 1,
    });
    expect(guard.diagnosticReasons).toContain('answer-citation-duplicate:1');
  });

  it('exposes every bindable citation number and the reuse rule in the study prompt', () => {
    const extraNumbers = [2, 3, 4, 5, 6, 7, 8].map((displayNumber) => ({
      id: `content:evidence:${displayNumber}`,
      sourceType: 'content',
      displayTitle: `片段 ${displayNumber}`,
      href: `/course-runtime/resources/${displayNumber}.md`,
      confidence: 'high',
      evidenceBasis: 'source-pack:konling-answer:test',
      owner: 'answer',
      citationTargetId: `content:${displayNumber}`,
      verified: true,
      resolver: 'course-runtime',
      displayNumber,
    }));
    const runtime = createRuntimeContext(createCitationContext(extraNumbers));
    const contract = buildKonlingTeachingAssistantRuntimeContract({
      modeId: 'generic-chat',
      runtimeContext: runtime,
      scope: createScope(),
      currentUserQuery: QUERIES['formula-derivation'],
    });

    const prompt = buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: { ...runtime, teachingAssistantMode: contract },
    });

    // 不再截断为 6 个：第 8 个可绑定编号也必须对模型可见
    expect(prompt).toContain('[8]');
    expect(prompt).toContain('同一编号可在多个不同结论单元重复使用');
    expect(prompt).toContain('无可用证据的结论必须改述为待核验或证据缺口');
  });
});
