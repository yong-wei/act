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
  ];

  it('resolves the higher-priority intent regardless of clause order', () => {
    for (const [query, expected] of priorityCases) {
      expect(classify(query), query).toBe(expected);
    }
  });
});
