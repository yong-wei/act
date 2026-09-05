import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { KONLING_FAIR_EXPERIMENT_BANK_V2 } from '@/lib/konling-fair-experiment/bank-v2';
import {
  buildKonlingTeachingAssistantRuntimeContract,
  type KonlingRuntimeContext,
  type KonlingRuntimeScope,
} from '@/lib/konling-agent-runtime';
import type { KonlingAnswerIntent } from '@/lib/konling-agent-runtime';

// Issue #2015：V2 分层题库（六意图 × 基础/综合/对抗）表驱动意图路由回归。
// 用例数据全部来自题库导入，不内联题目原文，防止以硬编码题面通过。

const STUDY_INTENTS = [
  'formula-derivation',
  'code-debugging',
  'concept-comparison',
  'normative-content',
  'open-ended-explanation',
  'fact-explanation',
] as const satisfies readonly KonlingAnswerIntent[];

type StudyIntent = (typeof STUDY_INTENTS)[number];

const INTENT_HIT_GATES: Record<StudyIntent, number> = {
  // 验收门槛：规范内容与代码调试 ≥80%，其余意图 ≥90%（3 题满分层下 3/3 与 2/3）。
  'formula-derivation': 0.8,
  'code-debugging': 0.8,
  'concept-comparison': 0.9,
  'normative-content': 0.8,
  'open-ended-explanation': 0.9,
  'fact-explanation': 0.9,
};

const OVERALL_HIT_GATE = 0.9;

const scope: KonlingRuntimeScope = {
  authenticatedUserId: 'student-1',
  targetUserId: 'student-1',
  role: 'student',
  courseId: 'fair-experiment',
  pageId: 'probe',
  privacyScopes: [],
};

const runtimeContext: KonlingRuntimeContext = {
  pageContext: {
    courseId: 'fair-experiment',
    courseTitle: '自动控制原理',
    pageType: 'theory',
    stepId: 'probe',
    topic: '意图路由回归',
    learningObjectives: [],
    knowledgeType: 'C',
  },
  userProfile: { id: 'student-1', name: '回归', profileAvailability: 'missing' },
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

function classify(query: string): StudyIntent {
  const intent = buildKonlingTeachingAssistantRuntimeContract({
    modeId: 'generic-chat',
    runtimeContext,
    scope,
    currentUserQuery: query,
  }).answerIntent;
  if (!(STUDY_INTENTS as readonly string[]).includes(intent)) {
    throw new Error(`unexpected predicted intent: ${intent}`);
  }
  return intent as StudyIntent;
}

interface MatrixCell {
  intent: StudyIntent;
  difficulty: string;
  predicted: StudyIntent;
}

describe('konling study question intent routing on the V2 tiered bank (#2015)', () => {
  const items = KONLING_FAIR_EXPERIMENT_BANK_V2.items;

  it('covers the full eighteen-question tiered bank without inline question text', () => {
    expect(items).toHaveLength(18);
    const intents = new Set(items.map((item) => item.intent));
    expect(intents.size).toBe(6);
    for (const intent of STUDY_INTENTS) {
      expect(items.filter((item) => item.intent === intent)).toHaveLength(3);
    }
  });

  it('meets the overall and per-intent gates reported as a confusion matrix', () => {
    const matrix = new Map<StudyIntent, Map<StudyIntent, number>>();
    const byDifficulty = new Map<string, { total: number; matched: number }>();
    const misses: MatrixCell[] = [];
    let matched = 0;

    for (const item of items) {
      const predicted = classify(item.question);
      const labeled = item.intent as StudyIntent;
      matrix.set(labeled, matrix.get(labeled) ?? new Map());
      const row = matrix.get(labeled) as Map<StudyIntent, number>;
      row.set(predicted, (row.get(predicted) ?? 0) + 1);
      const difficultyRow = byDifficulty.get(item.difficulty) ?? { total: 0, matched: 0 };
      difficultyRow.total += 1;
      if (predicted === labeled) {
        matched += 1;
        difficultyRow.matched += 1;
      } else {
        misses.push({ intent: labeled, difficulty: item.difficulty, predicted });
      }
      byDifficulty.set(item.difficulty, difficultyRow);
    }

    // 按意图报告混淆矩阵、按难度报告一致率：无条件输出，保证任何回归
    // 失败时都能看到完整混淆方向（review P2：报告不得放在不可达分支）。
    const report: Record<string, Record<string, number>> = {};
    for (const intent of STUDY_INTENTS) {
      const row = matrix.get(intent) ?? new Map();
      report[intent] = Object.fromEntries(row);
    }
    const difficultyReport = Object.fromEntries(
      [...byDifficulty.entries()].map(([difficulty, row]) => [
        difficulty,
        `${row.matched}/${row.total}`,
      ]),
    );
    console.log('intent confusion matrix:', JSON.stringify(report));
    console.log('difficulty report:', JSON.stringify(difficultyReport));
    console.log('intent misses:', JSON.stringify(misses));

    const gateFailures: string[] = [];
    if (matched / items.length < OVERALL_HIT_GATE) {
      gateFailures.push(`overall ${(matched / items.length).toFixed(3)} < ${OVERALL_HIT_GATE}`);
    }
    for (const intent of STUDY_INTENTS) {
      const hits = (matrix.get(intent) ?? new Map()).get(intent) ?? 0;
      if (hits / 3 < INTENT_HIT_GATES[intent]) {
        gateFailures.push(`${intent} ${(hits / 3).toFixed(2)} < ${INTENT_HIT_GATES[intent]}`);
      }
    }
    for (const [difficulty, row] of byDifficulty) {
      if (row.matched / row.total < OVERALL_HIT_GATE) {
        gateFailures.push(`difficulty ${difficulty} ${row.matched}/${row.total} < ${OVERALL_HIT_GATE}`);
      }
    }
    if (misses.length > 0) {
      gateFailures.push(`misses: ${JSON.stringify(misses)}`);
    }
    expect(gateFailures).toEqual([]);
  });

  it('routes synthetic composite signals without relying on frozen bank wording', () => {
    // 合成扰动样本（非题库原文）：证明信号面泛化而非题面特判。
    expect(classify('车间设备维护手册要求上电前先检查哪些安全规程？')).toBe('normative-content');
    expect(classify('请说明依据 ISO 13849 给出安全功能等级结论的当前做法。')).toBe('normative-content');
    expect(classify('比较一下教材里的两种整定方法。')).toBe('concept-comparison');
    // review R2 反例：「教材+要求」是教学任务措辞，不得触发规范门禁。
    expect(classify('教材要求我们比较 PID 和 LQR，我该怎么选？')).toBe('concept-comparison');
    expect(classify('教材要求推导单位负反馈闭环传递函数')).toBe('formula-derivation');
    expect(classify('这个设计的缺陷在哪里？')).toBe('open-ended-explanation');
    // review P2 反例：无围栏、无排障动作的「缺陷」概念题不得判为代码调试。
    expect(classify('代码设计缺陷是什么意思？')).toBe('fact-explanation');
    // review R2 反例：无围栏的「代码+解决」是请求写代码，不是调试。
    expect(classify('请用代码解决这个优化问题')).not.toBe('code-debugging');
    expect(classify('请写一段代码解决 PID 参数整定问题')).not.toBe('code-debugging');
    expect(classify('帮我看看这段贴出来的代码为什么 compensator 输出一直不变，找出缺陷并修复。')).toBe('code-debugging');
    expect(classify('帮我看看这段贴出来的代码为什么 compensator 输出一直不变，找出缺陷并修复。')).toBe('code-debugging');
  });

  it('keeps the fact-evidence conflict and open-explanation questions out of the normative gate', () => {
    // 「教材」进入来源词后，不含规范组合词的事实冲突/开放讲解题不被吞并。
    expect(classify('甲教材说调节时间取 ±2%，乙教材说 ±5%，调节时间的定义到底是什么？')).toBe('fact-explanation');
    expect(classify('用生活化例子解释积分饱和的作用。')).toBe('open-ended-explanation');
  });
});
