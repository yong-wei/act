/**
 * 公平实验分级盲审判别力合同测试（Issue #1952）。
 *
 * 覆盖：题库 V2 覆盖矩阵与 V1/V2 哈希冻结、分级解析器 fail closed、
 * 判别力报告（五子分/verdict 分布/天花板地板/分层/分层差值确定性）、
 * 教师双人复核一致率与 pending 语义、二元 rubric 向后兼容与混合
 * rubric fail closed。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  aggregateKonlingFairExperiment,
  isKonlingFairExperimentGradedAuditResult,
  konlingFairExperimentBankHash,
  konlingFairExperimentRunDir,
  KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS,
  KONLING_FAIR_EXPERIMENT_BANK_DIFFICULTIES,
  KONLING_FAIR_EXPERIMENT_BANK_RISK_TYPES,
  KONLING_FAIR_EXPERIMENT_BANK_V1,
  KONLING_FAIR_EXPERIMENT_BANK_V2,
  KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS,
  KONLING_FAIR_EXPERIMENT_SYNTHETIC_DISCLAIMER,
  parseKonlingFairExperimentGradedVerdict,
  parseKonlingFairExperimentJudgeVerdict,
  runKonlingFairExperiment,
  selectKonlingFairExperimentExpertSubset,
} from '@/lib/konling-fair-experiment';
import { STUDY_QUESTION_SECTIONS } from '@/lib/konling-study-question-structure';
import type {
  KonlingFairExperimentArm,
  KonlingFairExperimentBankItem,
  KonlingFairExperimentConfig,
  KonlingFairExperimentGradedAuditResult,
  KonlingFairExperimentGradedVerdictName,
} from '@/lib/konling-fair-experiment';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'konling-fair-graded-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function gradedConfig(overrides?: Partial<KonlingFairExperimentConfig>): KonlingFairExperimentConfig {
  return {
    model: 'fixture-generator',
    provider: 'deterministic-fixture-stub',
    sampling: { seed: 20260903, temperature: 0.2, topP: 1, maxOutputTokens: 2048 },
    armPromptVersions: {
      'plain-baseline': 'fair-experiment-plain.v1',
      'enhanced-baseline': 'fair-experiment-enhanced.v1',
      'full-feature': 'konling-generic-chat.v1',
    },
    gitRevision: 'test-revision',
    scorerRevision: 'test-revision',
    bootstrapIterations: 200,
    audit: { enabled: true, promptVersion: 'konling-blind-audit-graded.v2', scoreVersion: 'rubric-graded.v2' },
    ...overrides,
  };
}

/** 与 run-fixture 同构的确定性分级 provider：内容驱动的可预期分层差异。 */
function gradedAnswer(arm: KonlingFairExperimentArm, item: KonlingFairExperimentBankItem, replicate: number): string {
  const sections = STUDY_QUESTION_SECTIONS[item.intent];
  const suffix = `（${item.itemId}#${replicate}）`;
  if (arm === 'plain-baseline') {
    const lines = [
      `${sections.map((section) => section.title).join('、')}这些内容合在一起讲：`,
      `${sections.map((section) => `${section.title}方面按参考材料回答${suffix}。`).join('')}`,
    ];
    if (item.difficulty === 'adversarial') lines.push('前提无需核验，按题设直接作答。');
    return lines.join('\n');
  }
  const headingOf = arm === 'enhanced-baseline'
    ? (section: (typeof sections)[number]) => section.aliases[0] ?? section.title
    : (section: (typeof sections)[number]) => section.title;
  return sections
    .map((section) => `## ${headingOf(section)}\n按参考材料作答${suffix}。`)
    .join('\n');
}

function gradedAuditProvider(bankItems: readonly KonlingFairExperimentBankItem[]) {
  return async (item: { itemId: string; intent: string; candidateAnswer: string }, replicate: number) => {
    const sections = STUDY_QUESTION_SECTIONS[item.intent as keyof typeof STUDY_QUESTION_SECTIONS];
    const canonicalHeading = `## ${sections[0].title}`;
    const aliasHeading = `## ${sections[0].aliases[0] ?? sections[0].title}`;
    const difficulty = bankItems.find((candidate) => candidate.itemId === item.itemId)?.difficulty
      ?? 'foundational';
    const answer = item.candidateAnswer;
    let verdict: KonlingFairExperimentGradedVerdictName;
    let ruleScore: number;
    if (answer.includes('前提无需核验')) {
      verdict = 'major-error';
      ruleScore = 0;
    } else if (!answer.includes('## ')) {
      verdict = 'minor-flaw';
      ruleScore = 0.5;
    } else if (answer.includes(canonicalHeading)) {
      verdict = 'correct';
      ruleScore = difficulty === 'adversarial' ? 0.95 : 1;
    } else if (answer.includes(aliasHeading)) {
      verdict = difficulty === 'adversarial' ? 'minor-flaw' : 'correct';
      ruleScore = difficulty === 'adversarial' ? 0.7 : 0.9;
    } else {
      verdict = 'minor-flaw';
      ruleScore = 0.6;
    }
    const seed = [...`${item.itemId}:${replicate}`].reduce((sum, ch) => sum + ch.codePointAt(0)!, 0);
    const subscores = Object.fromEntries(
      KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS.map((dimension, index) => {
        const base = verdict === 'correct' ? 0.92 : verdict === 'minor-flaw' ? 0.6 : 0.15;
        const jitter = (((seed + index) % 5) - 2) * 0.02;
        return [dimension, Math.min(1, Math.max(0, base + jitter))];
      }),
    );
    return { ok: true as const, result: { verdict, ruleScore, subscores, notes: 'fixture graded judge' } };
  };
}

async function runGradedFixture(runId: string) {
  return runKonlingFairExperiment({
    root,
    runId,
    bank: KONLING_FAIR_EXPERIMENT_BANK_V2,
    config: gradedConfig(),
    calibers: ['structure-alias.v2'],
    generateProvider: async (task) => ({
      ok: true as const,
      result: { answer: gradedAnswer(task.arm, task.item, task.replicate), elapsedMs: 1 },
    }),
    auditProvider: gradedAuditProvider(KONLING_FAIR_EXPERIMENT_BANK_V2.items),
  });
}

describe('题库 V2 结构契约（#1952）', () => {
  it('覆盖矩阵：意图×难度各一条、意图内知识点互异、六风险类型各一次', () => {
    const items = KONLING_FAIR_EXPERIMENT_BANK_V2.items;
    expect(items).toHaveLength(18);
    const intents = [...new Set(items.map((item) => item.intent))];
    expect(intents).toHaveLength(6);
    for (const intent of intents) {
      const ofIntent = items.filter((item) => item.intent === intent);
      expect(ofIntent, intent).toHaveLength(3);
      expect([...new Set(ofIntent.map((item) => item.difficulty))].sort(), intent)
        .toEqual([...KONLING_FAIR_EXPERIMENT_BANK_DIFFICULTIES].sort());
      expect(new Set(ofIntent.map((item) => item.topic)).size, intent).toBe(3);
    }
    const adversarial = items.filter((item) => item.difficulty === 'adversarial');
    expect(adversarial).toHaveLength(6);
    expect([...new Set(adversarial.map((item) => item.riskType))].sort())
      .toEqual([...KONLING_FAIR_EXPERIMENT_BANK_RISK_TYPES].sort());
    // 风险类型只出现在对抗题；非对抗题不带风险标注。
    for (const item of items) {
      if (item.difficulty !== 'adversarial') expect(item.riskType, item.itemId).toBeUndefined();
    }
  });

  it('对抗题参考答案多要点并显式处置风险', () => {
    for (const item of KONLING_FAIR_EXPERIMENT_BANK_V2.items) {
      if (item.difficulty !== 'adversarial') continue;
      // 多要点参考答案（≥3 行）；显式处置断言不锁措辞，锁定要点数与长度下限。
      expect(item.referenceAnswer.split('\n').length, item.itemId).toBeGreaterThanOrEqual(3);
      expect(item.referenceAnswer.length, item.itemId).toBeGreaterThan(60);
    }
  });

  it('V1 条目不带分层标注；V1/V2 哈希冻结', () => {
    for (const item of KONLING_FAIR_EXPERIMENT_BANK_V1.items) {
      expect(item.difficulty).toBeUndefined();
      expect(item.topic).toBeUndefined();
      expect(item.riskType).toBeUndefined();
    }
    expect(konlingFairExperimentBankHash(KONLING_FAIR_EXPERIMENT_BANK_V1))
      .toBe('f486084cdce268ba6f04157a149affe48eb014edc70d0cdb5d155f137bf6d4f8');
    expect(konlingFairExperimentBankHash(KONLING_FAIR_EXPERIMENT_BANK_V2))
      .toBe('66cd10a811212de129eb99de3da42e84c25ea734661bd83e48b06c25225196e2');
    // 哈希对同输入稳定（冻结是确定性的）。
    expect(konlingFairExperimentBankHash(KONLING_FAIR_EXPERIMENT_BANK_V2))
      .toBe(konlingFairExperimentBankHash(KONLING_FAIR_EXPERIMENT_BANK_V2));
  });
});

describe('分级解析器（rubric-graded.v2）', () => {
  const validSubscores = {
    accuracy: 1, evidenceFaithfulness: 0.95, pedagogy: 0.5, structureCompliance: 0, traceCoverage: 0.25,
  };

  it('接受三级枚举与 0-1 五子分（含边界与 code fence）', () => {
    for (const verdict of KONLING_FAIR_EXPERIMENT_GRADED_VERDICTS) {
      const parsed = parseKonlingFairExperimentGradedVerdict(
        JSON.stringify({ verdict, ruleScore: 0.8, subscores: validSubscores }),
      );
      expect(parsed?.verdict).toBe(verdict);
      expect(parsed?.subscores).toEqual(validSubscores);
      expect(parsed?.notes).toBeNull();
    }
    const fenced = parseKonlingFairExperimentGradedVerdict(
      '```json\n{"verdict":"minor-flaw","ruleScore":0.6,"subscores":{"accuracy":0.6,"evidenceFaithfulness":0.6,"pedagogy":0.7,"structureCompliance":0.6,"traceCoverage":0.5},"notes":"轻微"}\n```',
    );
    expect(fenced?.notes).toBe('轻微');
  });

  it('非法语义 fail closed：未知枚举、越界/非有限子分、缺维度、缺 ruleScore', () => {
    const withSubscores = (patch: Record<string, unknown>) => JSON.stringify({
      verdict: 'correct', ruleScore: 0.9, subscores: { ...validSubscores, ...patch },
    });
    expect(parseKonlingFairExperimentGradedVerdict('{"verdict":"pass","ruleScore":0.9,"subscores":' + JSON.stringify(validSubscores) + '}')).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict('{"verdict":"CORRECT","ruleScore":0.9,"subscores":' + JSON.stringify(validSubscores) + '}')).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict(withSubscores({ accuracy: 1.01 }))).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict(withSubscores({ accuracy: -0.01 }))).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict('{"verdict":"correct","ruleScore":0.9,"subscores":' + JSON.stringify({ ...validSubscores, accuracy: 'NaN' }) + '}')).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict('{"verdict":"correct","ruleScore":0.9,"subscores":{"accuracy":0.9,"evidenceFaithfulness":0.9,"pedagogy":0.9,"structureCompliance":0.9}}')).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict('{"verdict":"correct","subscores":' + JSON.stringify(validSubscores) + '}')).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict('{"verdict":"correct","ruleScore":1.2,"subscores":' + JSON.stringify(validSubscores) + '}')).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict('{"verdict":"correct","ruleScore":0.9}')).toBeNull();
    expect(parseKonlingFairExperimentGradedVerdict('not json')).toBeNull();
  });

  it('旧二元解析器保持冻结：graded JSON 不被二元语义接受', () => {
    expect(parseKonlingFairExperimentJudgeVerdict('{"verdict":"pass","ruleScore":0.9}')).toEqual({
      verdict: 'pass', ruleScore: 0.9, notes: null,
    });
    expect(parseKonlingFairExperimentJudgeVerdict('{"verdict":"correct","ruleScore":0.9}')).toBeNull();
  });

  it('分级结果守卫只接受完整合法形态', () => {
    const full: KonlingFairExperimentGradedAuditResult = {
      verdict: 'correct', ruleScore: 1, subscores: validSubscores as KonlingFairExperimentGradedAuditResult['subscores'], notes: null,
    };
    expect(isKonlingFairExperimentGradedAuditResult(full)).toBe(true);
    expect(isKonlingFairExperimentGradedAuditResult({ ...full, verdict: 'pass' })).toBe(false);
    expect(isKonlingFairExperimentGradedAuditResult({ ...full, subscores: { ...validSubscores, pedagogy: 2 } })).toBe(false);
    expect(isKonlingFairExperimentGradedAuditResult({ verdict: 'correct', ruleScore: 0.9 })).toBe(false);
  });
});

describe('判别力报告（#1952 fixture 端到端）', () => {
  it('三臂跑通：verdict 分布、五子分均值、天花板/地板与分层结构', async () => {
    const summary = await runGradedFixture('graded-e2e');
    expect(summary.aggregateStatus).toBe('complete');
    const official = summary.aggregate.officialSummary!;

    const plain = official.perArm['plain-baseline'].auditDimensions!;
    expect(plain.verdictDistribution).toEqual({ correct: 0, 'minor-flaw': 24, 'major-error': 12 });
    expect(plain.ceilingProportion).toBe(0);
    expect(plain.floorProportion).toBe(12 / 36);
    expect(Object.keys(plain.meanSubscores).sort()).toEqual([...KONLING_FAIR_EXPERIMENT_AUDIT_DIMENSIONS].sort());
    expect(plain.meanSubscores.accuracy).toBeGreaterThan(0);
    expect(plain.meanSubscores.accuracy).toBeLessThan(0.6);

    const full = official.perArm['full-feature'].auditDimensions!;
    expect(full.verdictDistribution).toEqual({ correct: 36, 'minor-flaw': 0, 'major-error': 0 });
    // full 臂全部 ≥0.95：天花板效应显式可见，而不是只看均值。
    expect(full.ceilingProportion).toBe(1);
    expect(full.floorProportion).toBe(0);

    const enhanced = official.perArm['enhanced-baseline'].auditDimensions!;
    expect(enhanced.verdictDistribution['major-error']).toBe(0);
    expect(enhanced.verdictDistribution['minor-flaw']).toBe(12);

    // graded pass 等价：非 major-error 才计入 audit 通过率（plain 24/36）。
    expect(official.perArm['plain-baseline'].audit!.rate).toBe(24 / 36);
    expect(official.perArm['full-feature'].audit!.rate).toBe(1);

    // 分层：18 层（3 难度 × 6 意图），层内五子分非空，分层差值带层标识。
    expect(official.stratified.layers).toHaveLength(18);
    for (const layer of official.stratified.layers) {
      expect(layer.itemCount).toBe(1);
      expect(layer.structure['structure-alias.v2'].n).toBe(6);
      expect(layer.meanSubscores).not.toBeNull();
    }
    expect(official.stratified.stratifiedDeltas).toHaveLength(54);
    const delta = official.stratified.stratifiedDeltas.find(
      (entry) => entry.metric === 'stratified-structure@structure-alias.v2:adversarial/formula-derivation'
        && entry.baseline.label === 'plain-baseline'
        && entry.comparison.label === 'full-feature',
    );
    expect(delta).toBeDefined();
    expect(delta!.pairedN).toBe(2);
    expect(delta!.percentagePointDifference).toBe(100);

    expect(official.syntheticDisclaimer).toBe(KONLING_FAIR_EXPERIMENT_SYNTHETIC_DISCLAIMER);
    expect(official.syntheticDisclaimer).toContain('不得表述');
  });

  it('分层差值与子集确定性：同种子两次运行恒等', async () => {
    await runGradedFixture('determinism-a');
    await runGradedFixture('determinism-b');
    const read = (runId: string) => fs.readFileSync(
      path.join(konlingFairExperimentRunDir(root, runId), 'summary', 'official.json'), 'utf8',
    );
    const a = JSON.parse(read('determinism-a'));
    const b = JSON.parse(read('determinism-b'));
    expect(a.stratified).toEqual(b.stratified);
    expect(a.expertReview).toEqual(b.expertReview);
    expect(a.perArm['plain-baseline'].auditDimensions).toEqual(b.perArm['plain-baseline'].auditDimensions);
  });

  it('专家复核子集：每意图一条且同种子恒等；缺记录 pending 不阻塞', async () => {
    const subsetA = selectKonlingFairExperimentExpertSubset({
      bank: KONLING_FAIR_EXPERIMENT_BANK_V2, seed: 20260903,
    });
    const subsetB = selectKonlingFairExperimentExpertSubset({
      bank: KONLING_FAIR_EXPERIMENT_BANK_V2, seed: 20260903,
    });
    expect(subsetA).toEqual(subsetB);
    expect(subsetA).toHaveLength(6);
    for (const itemId of subsetA) {
      const item = KONLING_FAIR_EXPERIMENT_BANK_V2.items.find((candidate) => candidate.itemId === itemId)!;
      expect(item).toBeDefined();
    }
    // 不同种子可改变抽样（分层确定性而非固定常量）。
    const subsetC = selectKonlingFairExperimentExpertSubset({
      bank: KONLING_FAIR_EXPERIMENT_BANK_V2, seed: 1,
    });
    expect(new Set(subsetC).size).toBe(6);
    expect(subsetC).not.toEqual(subsetA);

    const summary = await runGradedFixture('expert-pending');
    expect(summary.aggregateStatus).toBe('complete');
    const review = summary.aggregate.officialSummary!.expertReview;
    expect(review.status).toBe('pending');
    expect(review.subsetItemIds).toEqual(subsetA);
    expect(review.agreementProportion).toBeNull();
    expect(review.disagreements).toEqual([]);
  });

  it('双人复核记录：一致率与分歧（pending-teacher）；无效条目忽略', async () => {
    await runGradedFixture('expert-reported');
    const runDir = konlingFairExperimentRunDir(root, 'expert-reported');
    const subset = selectKonlingFairExperimentExpertSubset({
      bank: KONLING_FAIR_EXPERIMENT_BANK_V2, seed: 20260903,
    });
    fs.mkdirSync(path.join(runDir, 'expert-review'), { recursive: true });
    fs.writeFileSync(path.join(runDir, 'expert-review', 'records.json'), JSON.stringify({
      records: [
        { itemId: subset[0], reviewerA: 'correct', reviewerB: 'correct' },
        { itemId: subset[1], reviewerA: 'correct', reviewerB: 'minor-flaw' },
        { itemId: subset[2], reviewerA: 'major-error', reviewerB: 'major-error' },
        // 清单外与非法 verdict 的条目不参与统计。
        { itemId: 'not-in-subset', reviewerA: 'correct', reviewerB: 'correct' },
        { itemId: subset[3], reviewerA: 'correct', reviewerB: 123 },
      ],
    }));
    const reaggregated = aggregateKonlingFairExperiment({
      root,
      runId: 'expert-reported',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V2,
      arms: ['plain-baseline', 'enhanced-baseline', 'full-feature'],
      config: gradedConfig(),
      calibers: ['structure-alias.v2'],
      writeOfficial: false,
    });
    expect(reaggregated.status).toBe('complete');
    const review = reaggregated.officialSummary!.expertReview;
    expect(review.status).toBe('reported');
    expect(review.agreementProportion).toBe(2 / 3);
    expect(review.disagreements).toEqual([{
      itemId: subset[1],
      reviewerA: 'correct',
      reviewerB: 'minor-flaw',
      resolution: 'pending-teacher',
    }]);
  });

  it('二元 rubric 向后兼容：V1 运行 auditDimensions 为 null、分层为空', async () => {
    const summary = await runKonlingFairExperiment({
      root,
      runId: 'legacy-v1',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: gradedConfig({
        audit: { enabled: true, promptVersion: 'konling-blind-audit.v1', scoreVersion: 'rubric.v1' },
      }),
      calibers: ['structure-alias.v2'],
      generateProvider: async (task) => ({
        ok: true as const,
        result: { answer: gradedAnswer(task.arm, task.item, task.replicate), elapsedMs: 1 },
      }),
      auditProvider: async () => ({
        ok: true as const,
        result: { verdict: 'pass', ruleScore: 0.9, notes: 'fixture' },
      }),
    });
    expect(summary.aggregateStatus).toBe('complete');
    const official = summary.aggregate.officialSummary!;
    for (const arm of ['plain-baseline', 'enhanced-baseline', 'full-feature'] as const) {
      expect(official.perArm[arm].auditDimensions).toBeNull();
    }
    expect(official.stratified.layers).toEqual([]);
    expect(official.stratified.stratifiedDeltas).toEqual([]);
    expect(official.expertReview.status).toBe('pending');
    expect(official.syntheticDisclaimer).toBe(KONLING_FAIR_EXPERIMENT_SYNTHETIC_DISCLAIMER);
  });

  it('rubric 形态门禁 fail closed：记录形态与 manifest 声明的 rubric 不符不产正式摘要', async () => {
    await runGradedFixture('rubric-mismatch');
    // 将一条 graded 盲审记录改写为二元形态，模拟 graded 配置误接二元
    // 评审器（review finding：静默按 legacy 聚合并置 auditDimensions null）。
    const auditDir = path.join(
      root, 'artifacts', 'konling-blind-audit', 'rubric-mismatch--audit--plain-baseline--r1', 'records', 'blind-audit',
    );
    const firstRecord = fs.readdirSync(auditDir).sort()[0];
    const recordPath = path.join(auditDir, firstRecord);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    record.result = { verdict: 'pass', ruleScore: 0.9, notes: 'spliced binary verdict' };
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));

    const result = aggregateKonlingFairExperiment({
      root,
      runId: 'rubric-mismatch',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V2,
      arms: ['plain-baseline', 'enhanced-baseline', 'full-feature'],
      config: gradedConfig(),
      calibers: ['structure-alias.v2'],
      writeOfficial: false,
    });
    expect(result.status).toBe('incomplete');
    expect(result.incompleteDetail?.phase).toBe('audit');
    expect(result.officialSummary).toBeNull();
  });

  it('反向形态同样 fail closed：二元 rubric 配置混入分级记录', async () => {
    const summary = await runKonlingFairExperiment({
      root,
      runId: 'rubric-mismatch-reverse',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: gradedConfig({
        audit: { enabled: true, promptVersion: 'konling-blind-audit.v1', scoreVersion: 'rubric.v1' },
      }),
      calibers: ['structure-alias.v2'],
      generateProvider: async (task) => ({
        ok: true as const,
        result: { answer: gradedAnswer(task.arm, task.item, task.replicate), elapsedMs: 1 },
      }),
      auditProvider: async () => ({
        ok: true as const,
        result: { verdict: 'pass', ruleScore: 0.9, notes: 'fixture' },
      }),
    });
    expect(summary.aggregateStatus).toBe('complete');
    const auditDir = path.join(
      root, 'artifacts', 'konling-blind-audit', 'rubric-mismatch-reverse--audit--plain-baseline--r1', 'records', 'blind-audit',
    );
    const firstRecord = fs.readdirSync(auditDir).sort()[0];
    const recordPath = path.join(auditDir, firstRecord);
    const record = JSON.parse(fs.readFileSync(recordPath, 'utf8'));
    record.result = {
      verdict: 'correct', ruleScore: 0.9,
      subscores: { accuracy: 0.9, evidenceFaithfulness: 0.9, pedagogy: 0.9, structureCompliance: 0.9, traceCoverage: 0.9 },
      notes: 'spliced graded verdict',
    };
    fs.writeFileSync(recordPath, JSON.stringify(record, null, 2));

    const result = aggregateKonlingFairExperiment({
      root,
      runId: 'rubric-mismatch-reverse',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      arms: ['plain-baseline', 'enhanced-baseline', 'full-feature'],
      config: gradedConfig({
        audit: { enabled: true, promptVersion: 'konling-blind-audit.v1', scoreVersion: 'rubric.v1' },
      }),
      calibers: ['structure-alias.v2'],
      writeOfficial: false,
    });
    expect(result.status).toBe('incomplete');
    expect(result.incompleteDetail?.phase).toBe('audit');
    expect(result.officialSummary).toBeNull();
  });
});
