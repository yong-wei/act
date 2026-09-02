import { describe, expect, it, vi } from 'vitest';

import { buildKonlingSystemPrompt } from '@/lib/ai-prompt-builder';
import {
  buildKonlingTeachingAssistantRuntimeContract,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import {
  STUDY_QUESTION_INTENTS,
  evaluateStudyQuestionStructure,
  studyQuestionSectionTitles,
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

function createRuntimeContext(): KonlingRuntimeContext {
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
    citationContext: {
      required: true,
      contentCitations: [],
      evidenceCitations: [],
      missingCitationClasses: ['content', 'evidence'],
      lowConfidenceReasons: ['missing-content', 'missing-evidence'],
      responseProtocol: {
        requiredOwners: ['answer', 'recommendation', 'intervention', 'report-explanation'],
        minimum: { content: 1, evidenceWhenAvailable: 1 },
        fallbackWhenMissing: 'low-confidence',
      },
    },
    permittedTools: ['get_page_context', 'search_knowledge_graph'],
    missingContext: [],
    featureFlags: {
      learnerState: false,
      semanticMemory: false,
      strategyMemory: false,
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

const SEMANTIC_ANSWERS: Record<StudyQuestionIntent, string> = {
  'formula-derivation': [
    '## 假设与符号',
    'G(s) 为前向通道。',
    '## 推导步骤',
    '闭环为 G/(1+GH)。',
    '## 成立条件',
    '单位负反馈。',
    '## 结果检验',
    '分母次数不低于分子。',
  ].join('\n'),
  'code-debugging': [
    '**问题定位**',
    '超调持续增大。',
    '**根因**',
    '积分项没有限幅。',
    '**修复建议**',
    '加抗饱和。',
    '**如何验证**',
    '看阶跃超调是否回落。',
  ].join('\n'),
  'concept-comparison': [
    '## 比较维度',
    '有没有反馈。',
    '## 主要差别',
    '闭环能抑制扰动。',
    '## 反例',
    '开环在模型很准时也可以。',
  ].join('\n'),
  'normative-content': [
    '## 适用对象',
    '课程实验报告。',
    '## 规定结论',
    '封面必须有题目与姓名。',
    '## 核验说明',
    '当前缺少权威来源，需核验。',
  ].join('\n'),
  'open-ended-explanation': [
    '## 要点',
    '超调是冲过头。',
    '## 展开讲解',
    '像船舵打得太猛。',
    '## 使用边界',
    '只适用于阶跃响应。',
  ].join('\n'),
  'fact-explanation': [
    '## 定义',
    '超调量是峰值相对稳态的超出比例。',
    '## 含义说明',
    '越大越抖。',
    '## 注意',
    '要先有稳态值。',
  ].join('\n'),
};

function unstructuredAnswer(intent: StudyQuestionIntent): string {
  const titles = studyQuestionSectionTitles(intent).join('、');
  return `下面依次说明${titles}。闭环控制能减小误差，但实现更复杂，需要根据对象和指标选择，同时注意测量噪声和执行器饱和，这些内容可以写成很长一段而不使用任何标题。`;
}

function promptFor(intent: StudyQuestionIntent, query: string) {
  const runtime = createRuntimeContext();
  const contract = buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext: runtime,
    scope: createScope(),
    currentUserQuery: query,
  });
  expect(contract.answerIntent).toBe(intent);
  return {
    contract,
    prompt: buildKonlingSystemPrompt({
      page: runtime.pageContext,
      user: runtime.userProfile,
      adaptiveRuntime: { ...runtime, teachingAssistantMode: contract },
    }),
  };
}

describe('issue #1817 study-question structure contract', () => {
  it('keeps six mutually exclusive section catalogs and writes an explicit prompt contract', () => {
    for (const intent of STUDY_QUESTION_INTENTS) {
      const titles = studyQuestionSectionTitles(intent);
      expect(titles.length).toBeGreaterThanOrEqual(3);
      const { prompt, contract } = promptFor(intent, QUERIES[intent]);
      expect(contract.studyQuestion?.requiredSections).toEqual(titles);
      expect(prompt).toContain('输出合同');
      expect(prompt).toContain('输出合同优先于一般字数上限');
      expect(prompt).toContain('不得省略任一章');
      expect(prompt).toContain(titles[0]);
    }
  });

  it('accepts semantic headings and rejects unstructured long text that only names the titles', () => {
    const validResults = STUDY_QUESTION_INTENTS.map((intent) => (
      evaluateStudyQuestionStructure({ answer: SEMANTIC_ANSWERS[intent], intent })
    ));
    const validPassRate = validResults.filter((result) => result.passed).length / validResults.length;
    expect(validPassRate).toBeGreaterThanOrEqual(0.8);
    for (const [index, intent] of STUDY_QUESTION_INTENTS.entries()) {
      expect(validResults[index].passed, intent).toBe(true);
      expect(evaluateStudyQuestionStructure({
        answer: unstructuredAnswer(intent),
        intent,
      }).passed).toBe(false);
    }
  });

  it('keeps every section required under concise, table, steps, and guided preferences', () => {
    const runtime = createRuntimeContext();
    const queries = [
      '请简洁地推导闭环传递函数',
      '请用表格比较开环和闭环控制的区别',
      '请分步骤说明这段代码报错该怎么修',
      '不要直接给答案，只给我逐步提示：什么是超调量？',
    ];
    for (const currentUserQuery of queries) {
      const contract = buildKonlingTeachingAssistantRuntimeContract({
        modeId: 'generic-chat',
        runtimeContext: runtime,
        scope: createScope(),
        currentUserQuery,
      });
      const prompt = buildKonlingSystemPrompt({
        page: runtime.pageContext,
        user: runtime.userProfile,
        adaptiveRuntime: { ...runtime, teachingAssistantMode: contract },
      });
      expect(contract.studyQuestion?.requiredSections.length).toBeGreaterThanOrEqual(3);
      expect(prompt).toContain('不得省略任一章');
    }
  });
});
