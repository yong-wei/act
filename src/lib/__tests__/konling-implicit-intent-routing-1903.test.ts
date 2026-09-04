import { describe, expect, it, vi } from 'vitest';

import intentCases from '@/lib/konling-study-question-intent-cases.json';
import {
  buildKonlingTeachingAssistantRuntimeContract,
  type KonlingAnswerIntent,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';

vi.mock('server-only', () => ({}));

const STUDY_INTENTS = [
  'formula-derivation',
  'code-debugging',
  'concept-comparison',
  'normative-content',
  'open-ended-explanation',
  'fact-explanation',
] as const satisfies readonly KonlingAnswerIntent[];

type StudyIntent = (typeof STUDY_INTENTS)[number];
type Phrasing = 'standard' | 'implicit';

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
  } as unknown as KonlingRuntimeContext;
}

function classify(query: string): StudyIntent {
  const intent = buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext: createRuntimeContext(),
    scope: createScope(),
    currentUserQuery: query,
  }).answerIntent;
  if (!(STUDY_INTENTS as readonly string[]).includes(intent)) {
    throw new Error(`unexpected predicted intent: ${intent}`);
  }
  return intent as StudyIntent;
}

function evaluatePhrasingGroup(cases: readonly { intent: string; query: string }[]) {
  const labels = [...STUDY_INTENTS];
  const matrix = Object.fromEntries(
    labels.map((row) => [row, Object.fromEntries(labels.map((column) => [column, 0]))]),
  ) as Record<StudyIntent, Record<StudyIntent, number>>;
  for (const item of cases) {
    matrix[item.intent as StudyIntent][classify(item.query)] += 1;
  }
  const perClass = Object.fromEntries(labels.map((label) => {
    const tp = matrix[label][label];
    const support = labels.reduce((sum, column) => sum + matrix[label][column], 0);
    const predicted = labels.reduce((sum, row) => sum + matrix[row][label], 0);
    const recall = support === 0 ? 0 : tp / support;
    const precision = predicted === 0 ? 0 : tp / predicted;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    return [label, { support, recall, precision, f1 }];
  })) as Record<StudyIntent, { support: number; recall: number; precision: number; f1: number }>;
  const accuracy = cases.length === 0
    ? 0
    : labels.reduce((sum, label) => sum + matrix[label][label], 0) / cases.length;
  const macroF1 = labels.reduce((sum, label) => sum + perClass[label].f1, 0) / labels.length;
  const misclassified = cases.length - labels.reduce((sum, label) => sum + matrix[label][label], 0);
  return { matrix, perClass, accuracy, macroF1, misclassified };
}

describe('issue #1903 per-phrasing intent routing gates', () => {
  for (const phrasing of ['standard', 'implicit'] as const satisfies readonly Phrasing[]) {
    describe(`${phrasing} phrasing group`, () => {
      const group = intentCases.filter((item) => item.phrasing === phrasing);
      const report = evaluatePhrasingGroup(group);

      it('keeps sixty cases with ten per intent', () => {
        expect(group).toHaveLength(60);
        for (const intent of STUDY_INTENTS) {
          expect(group.filter((item) => item.intent === intent), intent).toHaveLength(10);
        }
      });

      it('meets accuracy, macro-F1, and per-class recall gates', () => {
        expect(report.accuracy, JSON.stringify(report.matrix)).toBeGreaterThanOrEqual(0.8);
        expect(report.macroF1).toBeGreaterThanOrEqual(0.75);
        for (const intent of STUDY_INTENTS) {
          expect(report.perClass[intent].recall, intent).toBeGreaterThanOrEqual(0.7);
        }
        expect(report.perClass['normative-content'].recall).toBeGreaterThanOrEqual(0.9);
      });

      it('does not concentrate misclassifications into one fallback class', () => {
        const misclassified = intentCases.filter((item) => item.phrasing === phrasing && classify(item.query) !== item.intent);
        const byPredicted = new Map<StudyIntent, number>();
        for (const item of misclassified) {
          const predicted = classify(item.query);
          byPredicted.set(predicted, (byPredicted.get(predicted) ?? 0) + 1);
        }
        for (const [predicted, count] of byPredicted) {
          // “Not more than half” means strictly count*2 <= total; Math.ceil
          // would admit 2-of-3 concentration on an odd total.
          expect(count * 2, predicted).toBeLessThanOrEqual(misclassified.length);
        }
        console.info(
          `[issue #1903] ${phrasing}: accuracy=${report.accuracy.toFixed(3)} macroF1=${report.macroF1.toFixed(3)} misclassified=${misclassified.length}`,
        );
        console.info(`[issue #1903] ${phrasing} per-class recall:`, Object.fromEntries(
          STUDY_INTENTS.map((intent) => [intent, report.perClass[intent].recall.toFixed(2)]),
        ));
        console.info(`[issue #1903] ${phrasing} confusion matrix:`, report.matrix);
      });
    });
  }
});

describe('issue #1948 combo-signal intent routing', () => {
  // 第三措辞族（#1948 公平实验暴露）：不含显式调试/规范关键词，信号来自
  // 「异常现象＋定位/修复」与「规范/要求/格式＋权威来源」的组合。
  const comboCases: Array<[string, StudyIntent]> = [
    // code-debugging：现象 × 排障动作（含公平实验原始样本）
    ['PID 输出持续饱和导致超调增大，如何定位和修复？', 'code-debugging'],
    ['仿真曲线持续发散不收敛，怎么排查原因？', 'code-debugging'],
    ['系统响应剧烈振荡，该怎么解决？', 'code-debugging'],
    ['执行机构反复抖动，怎么排查？', 'code-debugging'],
    ['数值溢出后曲线崩溃，如何修复？', 'code-debugging'],
    ['控制器输出卡死在限幅，如何定位问题？', 'code-debugging'],
    // normative-content：规范/要求/格式 × 权威来源（含公平实验原始样本）
    ['实验报告封面有哪些规范要求？', 'normative-content'],
    ['毕业论文封面模板有什么规范要求？', 'normative-content'],
    ['实验数据记录表格的格式要求以课程大纲为准吗？', 'normative-content'],
    ['课程报告的排版规范是什么？', 'normative-content'],
    ['学校对实验报告的书写格式有要求吗？', 'normative-content'],
    ['教务处发布的考核要求有哪些？', 'normative-content'],
    // 其余四类在组合措辞族中保持既有行为
    ['这个系统的开环传递函数是怎么得到的？', 'formula-derivation'],
    ['证明该闭环系统稳定的充要条件', 'formula-derivation'],
    ['PID 和 PI 控制该怎么选？', 'concept-comparison'],
    ['开环控制和闭环控制有什么区别？', 'concept-comparison'],
    ['用生活化例子解释超调，并说明适用边界。', 'open-ended-explanation'],
    ['把积分作用讲得更直白一点', 'open-ended-explanation'],
    ['帮我看看这个系统的稳态误差该怎么分析', 'open-ended-explanation'],
    ['什么是超调量？', 'fact-explanation'],
    ['奈奎斯特判据的含义是什么？', 'fact-explanation'],
    // review finding：「课程」是泛学习上下文而非权威出处，不得触发规范组合。
    ['课程要求我们比较 PID 和 PI，我该怎么选？', 'concept-comparison'],
    ['课程要求先推导闭环传递函数', 'formula-derivation'],
  ];

  it('routes combo phrasings for all six intents without fallback capture', () => {
    for (const [query, expected] of comboCases) {
      expect(classify(query), query).toBe(expected);
    }
    const routed = comboCases.map(([query]) => classify(query));
    expect(new Set(routed).size).toBe(STUDY_INTENTS.length);
  });
});

describe('issue #1903 multi-intent primary-intent priority', () => {
  // Priority is fixed and clause-order independent: normative (safety) >
  // formula-derivation > code-debugging > concept-comparison >
  // open-ended-explanation (explicit features) > fact-explanation, with
  // open-ended-explanation as the only default fallback.
  const priorityCases: Array<[string, StudyIntent]> = [
    ['请推导闭环传递函数，另外实验报告封面必须写哪些项才算合格？', 'normative-content'],
    ['实验报告封面必须写哪些项才算合格？另外请推导闭环传递函数', 'normative-content'],
    ['请推导闭环传递函数，这段 PID 代码为什么一直报错？', 'formula-derivation'],
    ['这段 PID 代码为什么一直报错？顺便推导一下闭环传递函数', 'formula-derivation'],
    ['这段代码报错怎么修？再对比一下 PID 和 PI 控制的区别', 'code-debugging'],
    ['对比一下 PID 和 PI 控制的区别，另外这段代码报错怎么修？', 'code-debugging'],
    ['开环和闭环控制有什么区别？能不能换个生活化的例子讲讲', 'concept-comparison'],
    ['能不能换个生活化的例子讲讲？开环和闭环控制有什么区别？', 'concept-comparison'],
    ['什么是超调量？请换一种更直白的说法解释', 'open-ended-explanation'],
    ['请换一种更直白的说法解释，什么是超调量？', 'open-ended-explanation'],
    ['帮我看看这个系统的稳态误差该怎么分析', 'open-ended-explanation'],
    // #1948：组合信号子句同样服从固定优先级，且与子句顺序无关。
    ['请推导闭环传递函数，另外 PID 输出持续饱和超调增大，如何定位和修复？', 'formula-derivation'],
    ['PID 输出持续饱和超调增大，如何定位和修复？顺便推导闭环传递函数', 'formula-derivation'],
    ['实验报告封面有哪些规范要求？另外这段 PID 代码为什么一直报错？', 'normative-content'],
    ['这段 PID 代码为什么一直报错？另外实验报告封面有哪些规范要求？', 'normative-content'],
  ];

  it('resolves the higher-priority intent regardless of clause order', () => {
    for (const [query, expected] of priorityCases) {
      expect(classify(query), query).toBe(expected);
    }
  });
});
