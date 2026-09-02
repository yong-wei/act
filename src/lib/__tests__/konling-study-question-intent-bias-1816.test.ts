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

function classify(query: string): KonlingAnswerIntent {
  return buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext: createRuntimeContext(),
    scope: createScope(),
    currentUserQuery: query,
  }).answerIntent;
}

function isStudyIntent(value: string): value is StudyIntent {
  return (STUDY_INTENTS as readonly string[]).includes(value);
}

function evaluateIntentCases(cases: readonly { intent: string; query: string }[]) {
  const labels = [...STUDY_INTENTS];
  const matrix = Object.fromEntries(
    labels.map((row) => [row, Object.fromEntries(labels.map((column) => [column, 0]))]),
  ) as Record<StudyIntent, Record<StudyIntent, number>>;
  for (const item of cases) {
    if (!isStudyIntent(item.intent)) {
      throw new Error(`unexpected gold intent: ${item.intent}`);
    }
    const predicted = classify(item.query);
    if (!isStudyIntent(predicted)) {
      throw new Error(`unexpected predicted intent: ${predicted}`);
    }
    matrix[item.intent][predicted] += 1;
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
  return { matrix, perClass, accuracy, macroF1 };
}

describe('issue #1816 study-question intent bias', () => {
  it('keeps a frozen 120-case set with ten standard and ten implicit items per intent', () => {
    expect(intentCases).toHaveLength(120);
    for (const intent of STUDY_INTENTS) {
      const items = intentCases.filter((item) => item.intent === intent);
      expect(items.filter((item) => item.phrasing === 'standard')).toHaveLength(10);
      expect(items.filter((item) => item.phrasing === 'implicit')).toHaveLength(10);
    }
  });

  it('classifies implicit non-fact study questions away from the fact-explanation residual bucket', () => {
    expect(classify('闭环传递函数是怎么一步步得到的？')).toBe('formula-derivation');
    expect(classify('这个 PID 仿真超调一直下不来，我改了参数还是这样')).toBe('code-debugging');
    expect(classify('开环控制和闭环控制我该怎么选？')).toBe('concept-comparison');
    expect(classify('实验报告封面必须写哪些项才算合格？')).toBe('normative-content');
    expect(classify('能不能用船上的舵把超调讲得更直白一点？')).toBe('open-ended-explanation');
    expect(classify('超调量大概表示什么？')).toBe('fact-explanation');
  });

  it('meets frozen-set accuracy, macro-F1, and recall gates', () => {
    const report = evaluateIntentCases(intentCases);
    expect(report.accuracy).toBeGreaterThanOrEqual(0.8);
    expect(report.macroF1).toBeGreaterThanOrEqual(0.8);
    for (const intent of STUDY_INTENTS) {
      expect(report.perClass[intent].recall, intent).toBeGreaterThanOrEqual(0.75);
    }
    expect(report.perClass['normative-content'].recall).toBeGreaterThanOrEqual(0.9);
  });
});
