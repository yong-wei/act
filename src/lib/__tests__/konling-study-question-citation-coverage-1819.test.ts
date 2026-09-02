import { describe, expect, it, vi } from 'vitest';

import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  buildKonlingCitationGuard,
  buildKonlingTeachingAssistantRuntimeContract,
  stripUnverifiedKonlingCitationMarkers,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import {
  STUDY_QUESTION_INTENTS,
  evidenceRequiredStudyQuestionSections,
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

// 每类意图的样例回答：evidence-required 章节的结论行带 [1]，
// model-derived 章节不带引用（推导/教学补充不机械引用）。
const CITED_ANSWERS: Record<StudyQuestionIntent, string> = {
  'formula-derivation': [
    '## 前提与符号',
    'G(s) 为前向通道，H(s) 为反馈 [1]。',
    '## 关键变形',
    '闭环为 G/(1+GH)。',
    '## 适用条件',
    '单位负反馈 [1]。',
    '## 结果校验',
    '分母次数不低于分子。',
  ].join('\n'),
  'code-debugging': [
    '**故障定位**',
    '超调持续增大。',
    '**可能原因**',
    '积分项没有限幅。',
    '**最小修复**',
    '加抗饱和 [1]。',
    '**验证方法**',
    '看阶跃超调是否回落。',
  ].join('\n'),
  'concept-comparison': [
    '## 判别维度',
    '有没有反馈 [1]。',
    '## 联系与差异',
    '闭环能抑制扰动 [1]。',
    '## 边界或反例',
    '开环在模型很准时也可以。',
  ].join('\n'),
  'normative-content': [
    '## 适用范围',
    '课程实验报告。',
    '## 规范结论',
    '封面必须有题目与姓名。',
    '## 核验来源',
    '当前缺少权威来源，需核验。',
  ].join('\n'),
  'open-ended-explanation': [
    '## 核心结论',
    '超调是冲过头 [1]。',
    '## 定制化讲解',
    '像船舵打得太猛。',
    '## 适用边界',
    '只适用于阶跃响应 [1]。',
  ].join('\n'),
  'fact-explanation': [
    '## 核心结论',
    '超调量是峰值相对稳态的超出比例 [1]。',
    '## 解释',
    '越大越抖。',
    '## 适用边界',
    '要先有稳态值 [1]。',
  ].join('\n'),
};

function contractFor(intent: StudyQuestionIntent, citationContext = createCitationContext()) {
  const runtime = createRuntimeContext(citationContext);
  const contract = buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext: runtime,
    scope: createScope(),
    currentUserQuery: QUERIES[intent],
  });
  expect(contract.studyQuestion?.intent).toBe(intent);
  return { runtime, contract };
}

function guardFor(intent: StudyQuestionIntent, answer: string, citationContext?: ReturnType<typeof createCitationContext>) {
  const { runtime, contract } = contractFor(intent, citationContext);
  return {
    prompt: buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: { ...runtime, teachingAssistantMode: contract },
    }),
    guard: buildKonlingCitationGuard(
      { citationContext: runtime.citationContext, teachingAssistantMode: contract },
      answer,
    ),
  };
}

describe('issue #1819 answer-unit citation coverage', () => {
  it('binds answer units to sections and reaches full evidence coverage for every non-fail-closed intent', () => {
    for (const intent of STUDY_QUESTION_INTENTS) {
      const { guard } = guardFor(intent, CITED_ANSWERS[intent]);

      if (intent === 'normative-content') {
        // 规范性内容缺权威来源时 fail-closed：章节不计入覆盖分母。
        expect(guard.answerUnitCoverage, intent).toBeNull();
        expect(guard.lowConfidenceReasons, intent).toContain('normative-guidance-verification-required');
        continue;
      }

      const requiredIds = evidenceRequiredStudyQuestionSections(intent).map((section) => section.id);
      expect(guard.answerUnitCoverage?.intent, intent).toBe(intent);
      expect(guard.answerUnitCoverage?.requiredCount, intent).toBe(requiredIds.length);
      expect(guard.answerUnitCoverage?.coveredCount, intent).toBe(requiredIds.length);
      expect(guard.answerUnitCoverage?.ratio, intent).toBeGreaterThanOrEqual(0.85);
      for (const binding of guard.answerUnits ?? []) {
        expect(binding.sectionId, intent).toBeTruthy();
        expect(binding.sectionTitle, intent).toBeTruthy();
      }
      expect(guard.unverifiedCitationMarkers, intent).toEqual([]);
    }
  });

  it('identifies model-derived sections so derivation content is not presented as source text', () => {
    const expectations: Partial<Record<StudyQuestionIntent, string[]>> = {
      'formula-derivation': ['transform', 'check'],
      'code-debugging': ['locate', 'cause', 'verify'],
      'concept-comparison': ['boundary'],
      'open-ended-explanation': ['explain'],
      'fact-explanation': ['explain'],
    };
    for (const [intent, expectedDerived] of Object.entries(expectations)) {
      const { guard } = guardFor(intent as StudyQuestionIntent, CITED_ANSWERS[intent as StudyQuestionIntent]);
      expect(guard.derivedSectionIds, intent).toEqual(expectedDerived);
    }
  });

  it('writes the per-section citation mapping contract into the prompt', () => {
    for (const intent of STUDY_QUESTION_INTENTS) {
      const { prompt } = guardFor(intent, CITED_ANSWERS[intent]);
      expect(prompt, intent).toContain('逐单元引用映射');
      const evidenceTitles = evidenceRequiredStudyQuestionSections(intent).map((section) => section.title);
      for (const title of evidenceTitles) {
        expect(prompt, intent).toContain(title);
      }
      if (intent !== 'normative-content') {
        expect(prompt, intent).toContain('推导章节');
        expect(prompt, intent).toContain('不需逐步重复引用');
      }
    }
  });

  it('reports and strips invalid or out-of-range citation markers', () => {
    const citationContext = createCitationContext([{
      id: 'content:evidence:unverified',
      sourceType: 'content',
      displayTitle: '未验证材料',
      href: '/course-runtime/resources/unverified.md',
      confidence: 'medium',
      evidenceBasis: 'source-pack:konling-answer:test',
      owner: 'answer',
      displayNumber: 2,
    }]);
    const answer = [
      '## 前提与符号',
      'G(s) 为前向通道 [1]。',
      '## 关键变形',
      '未验证结论 [2]',
      '越界引用 [9]',
    ].join('\n');
    const { guard } = guardFor('formula-derivation', answer, citationContext);

    expect(guard.unverifiedCitationMarkers).toEqual([2, 9]);
    const stripped = stripUnverifiedKonlingCitationMarkers(answer, guard);
    expect(stripped).toContain('[1]');
    expect(stripped).not.toContain('[2]');
    expect(stripped).not.toContain('[9]');
    expect(stripped).toContain('未验证结论');
    expect(stripped).toContain('越界引用');
  });

  it('keeps stripping a no-op for non-study-question guards without invalid markers', () => {
    const citationContext = createCitationContext();
    const answer = '闭环控制能抑制扰动 [1]。';
    const { guard } = guardFor('fact-explanation', answer, citationContext);
    expect(stripUnverifiedKonlingCitationMarkers(answer, guard)).toBe(answer);
  });

  it('downgrades an evidence-required section whose conclusions carry no citation', () => {
    const answer = [
      '## 前提与符号',
      'G(s) 为前向通道。',
      '## 关键变形',
      '闭环为 G/(1+GH) [1]。',
      '## 适用条件',
      '单位负反馈。',
      '## 结果校验',
      '分母次数不低于分子。',
    ].join('\n');
    const { guard } = guardFor('formula-derivation', answer);

    expect(guard.answerUnits?.length).toBe(1);
    expect(guard.answerUnitCoverage?.requiredCount).toBe(2);
    expect(guard.answerUnitCoverage?.coveredCount).toBe(0);
    expect(guard.answerUnitCoverage?.ratio).toBe(0);
    expect(guard.lowConfidenceReasons).toContain('answer-unit-citation-missing:assumptions');
    expect(guard.lowConfidenceReasons).toContain('answer-unit-citation-missing:applicability');
  });
});
