/**
 * 知识问答公平基线实验合同测试（Issue #1900）。
 *
 * 覆盖：评分口径差异与默认行为不变、三臂 prompt 公平合同、fixture 端到端
 * 断点续跑与 fail-closed 聚合、回放不触发生成、配对差值确定性。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  aggregateKonlingFairExperiment,
  replayKonlingFairExperimentScoring,
  runKonlingFairExperiment,
  buildKonlingFairExperimentTaskKey,
  KONLING_FAIR_EXPERIMENT_BANK_V1,
  buildKonlingFairExperimentSystemPrompt,
  buildKonlingFairExperimentUserPrompt,
  buildKonlingFairExperimentPromptContext,
  konlingFairExperimentRunDir,
  parseKonlingFairExperimentJudgeVerdict,
} from '@/lib/konling-fair-experiment';
import {
  evaluateStudyQuestionStructure,
  STUDY_QUESTION_INTENTS,
  STUDY_QUESTION_SECTIONS,
} from '@/lib/konling-study-question-structure';
import type { KonlingFairExperimentConfig } from '@/lib/konling-fair-experiment';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'konling-fair-experiment-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function fixtureConfig(overrides?: Partial<KonlingFairExperimentConfig>): KonlingFairExperimentConfig {
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
    audit: { enabled: true, promptVersion: 'konling-blind-audit.v1', scoreVersion: 'rubric.v1' },
    ...overrides,
  };
}

function canonicalAnswer(intent: keyof typeof STUDY_QUESTION_SECTIONS): string {
  return STUDY_QUESTION_SECTIONS[intent]
    .map((section) => `## ${section.title}\n正文。`)
    .join('\n');
}

function aliasAnswer(intent: keyof typeof STUDY_QUESTION_SECTIONS): string {
  return STUDY_QUESTION_SECTIONS[intent]
    .map((section) => `## ${section.aliases[0] ?? section.title}\n正文。`)
    .join('\n');
}

/** 三臂确定性 provider：plain 无结构、enhanced 别名标题、full canonical 标题。 */
function armAnswer(arm: 'plain-baseline' | 'enhanced-baseline' | 'full-feature', intent: string): string {
  if (arm === 'plain-baseline') {
    return '把所有内容连贯地写成一段，不使用任何小标题。';
  }
  return arm === 'enhanced-baseline'
    ? aliasAnswer(intent as keyof typeof STUDY_QUESTION_SECTIONS)
    : canonicalAnswer(intent as keyof typeof STUDY_QUESTION_SECTIONS);
}

const generateProvider = async (task: Parameters<Parameters<typeof runKonlingFairExperiment>[0]['generateProvider']>[0]) => ({
  ok: true as const,
  result: { answer: armAnswer(task.arm, task.item.intent), elapsedMs: 1 },
});

const auditProvider = async () => ({
  ok: true as const,
  result: { verdict: 'pass', ruleScore: 0.9, notes: 'fixture' },
});

describe('评分口径（#1900 caliber）', () => {
  it('同回答：别名口径通过、固定标题口径失败', () => {
    const answer = aliasAnswer('formula-derivation');
    expect(evaluateStudyQuestionStructure({ answer, intent: 'formula-derivation' }).passed).toBe(true);
    expect(evaluateStudyQuestionStructure({
      answer,
      intent: 'formula-derivation',
      caliber: 'structure-strict-title.v0',
    }).passed).toBe(false);
  });

  it('canonical 标题回答在两种口径下都通过', () => {
    const answer = canonicalAnswer('fact-explanation');
    expect(evaluateStudyQuestionStructure({ answer, intent: 'fact-explanation' }).passed).toBe(true);
    expect(evaluateStudyQuestionStructure({
      answer,
      intent: 'fact-explanation',
      caliber: 'structure-strict-title.v0',
    }).passed).toBe(true);
  });

  it('默认参数与显式 alias 口径输出一致（产品行为不变）', () => {
    const answer = `${aliasAnswer('code-debugging')}\n## 假设与符号\n多余章节。`;
    const implicit = evaluateStudyQuestionStructure({ answer, intent: 'code-debugging' });
    const explicit = evaluateStudyQuestionStructure({ answer, intent: 'code-debugging', caliber: 'structure-alias.v1' });
    expect(implicit).toEqual(explicit);
  });
});

describe('三臂 prompt 公平合同', () => {
  const item = KONLING_FAIR_EXPERIMENT_BANK_V1.items[0];
  const context = buildKonlingFairExperimentPromptContext();

  it('plain 无结构合同；enhanced 含相同章节要求；full 含专用运行时行', () => {
    const plain = buildKonlingFairExperimentSystemPrompt({ arm: 'plain-baseline', item, context });
    const enhanced = buildKonlingFairExperimentSystemPrompt({ arm: 'enhanced-baseline', item, context });
    const full = buildKonlingFairExperimentSystemPrompt({ arm: 'full-feature', item, context });

    const sections = STUDY_QUESTION_SECTIONS[item.intent].map((section) => section.title).join('、');
    expect(plain.systemPrompt).not.toContain(sections);
    expect(plain.systemPrompt).not.toContain('输出合同');
    expect(enhanced.systemPrompt).toContain(sections);
    expect(enhanced.systemPrompt).toContain('输出合同优先于一般字数上限');
    expect(full.systemPrompt).toContain('专业问答类型');
    expect(full.systemPrompt).toContain('逐单元引用映射');
    // 专用运行时行不出现在 enhanced 基线中。
    expect(enhanced.systemPrompt).not.toContain('逐单元引用映射');
    expect(enhanced.systemPrompt).not.toContain('专业问答类型');
    // 基础提示部分逐字节一致（角色/课程/画像/格式要求共享）。
    expect(enhanced.systemPrompt.startsWith(plain.systemPrompt)).toBe(true);
  });

  it('三臂共用同一用户消息（题面+参考材料）', () => {
    const userPrompt = buildKonlingFairExperimentUserPrompt(item);
    expect(userPrompt).toContain(`问题：${item.question}`);
    expect(userPrompt).toContain(`参考材料：${item.referenceAnswer}`);
  });

  it('full-feature 产出运行时合同意图；分类未命中时如实为 null', () => {
    // 分类一致率本身是被测指标（隐式问法路由偏置见 #1903），
    // 这里只锁定合同意图的取值域，不设分类质量门。
    for (const bankItem of KONLING_FAIR_EXPERIMENT_BANK_V1.items) {
      const full = buildKonlingFairExperimentSystemPrompt({ arm: 'full-feature', item: bankItem, context });
      expect(
        full.contractIntent === null
        || (STUDY_QUESTION_INTENTS as readonly string[]).includes(full.contractIntent),
      ).toBe(true);
      expect(full.systemPrompt).toContain('专业问答类型');
    }
  });

  it('分类未命中时两臂章节要求仍恒等（公平固定）', () => {
    // code-antiwindup 的题面会被关键词分类器判为 open-ended-explanation；
    // 交付的章节合同必须仍按题库标注意图组装，两臂要求一致。
    for (const bankItem of KONLING_FAIR_EXPERIMENT_BANK_V1.items) {
      const enhanced = buildKonlingFairExperimentSystemPrompt({ arm: 'enhanced-baseline', item: bankItem, context });
      const full = buildKonlingFairExperimentSystemPrompt({ arm: 'full-feature', item: bankItem, context });
      const labeledTitles = STUDY_QUESTION_SECTIONS[bankItem.intent].map((section) => section.title).join('、');
      expect(enhanced.systemPrompt).toContain(labeledTitles);
      expect(full.systemPrompt).toContain(labeledTitles);
      expect(full.systemPrompt).toContain(`专业问答类型: ${bankItem.intent}`);
    }
  });
});

describe('端到端：断点续跑与 fail closed', () => {
  it('完整运行产出正式汇总与配对差值', async () => {
    const summary = await runKonlingFairExperiment({
      root,
      runId: 'e2e',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(),
      calibers: ['structure-alias.v1'],
      generateProvider,
      auditProvider,
    });
    expect(summary.aggregateStatus).toBe('complete');
    const official = summary.aggregate.officialSummary;
    expect(official).not.toBeNull();
    expect(official!.perArm['plain-baseline'].structure['structure-alias.v1'].rate).toBe(0);
    expect(official!.perArm['enhanced-baseline'].structure['structure-alias.v1'].rate).toBe(1);
    expect(official!.perArm['full-feature'].structure['structure-alias.v1'].rate).toBe(1);
    // 综合指标并列分项。
    const composite = official!.perArm['full-feature'].composite['structure-alias.v1'];
    expect(composite.components.structure.rate).toBe(1);
    expect(composite.components.audit!.rate).toBe(1);
    // 配对差值含百分点差与 CI。
    const delta = official!.generationDeltas.find(
      (entry) => entry.metric === 'structure@structure-alias.v1'
        && entry.baseline.label === 'plain-baseline'
        && entry.comparison.label === 'enhanced-baseline',
    );
    expect(delta?.percentagePointDifference).toBe(100);
    expect(delta?.pairedCi95.low).toBeLessThanOrEqual(delta!.percentagePointDifference);
    expect(delta?.pairedCi95.high).toBeGreaterThanOrEqual(delta!.percentagePointDifference);
    // full-feature 分类一致率被如实报告（隐式问法偏置是 #1903 的范围）。
    const agreement = official!.perArm['full-feature'].classificationAgreement;
    expect(agreement?.n).toBe(KONLING_FAIR_EXPERIMENT_BANK_V1.items.length * 2);
    expect(agreement!.rate).toBeGreaterThanOrEqual(0);
    expect(agreement!.rate).toBeLessThanOrEqual(1);
  });

  it('续跑不重复生成，回答快照冻结', async () => {
    let calls = 0;
    const countingProvider: typeof generateProvider = async (task) => {
      calls += 1;
      return generateProvider(task);
    };
    await runKonlingFairExperiment({
      root, runId: 'resume', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      generateProvider: countingProvider, auditProvider,
    });
    expect(calls).toBe(KONLING_FAIR_EXPERIMENT_BANK_V1.items.length * 2 * 3);
    await runKonlingFairExperiment({
      root, runId: 'resume', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      generateProvider: countingProvider, auditProvider,
    });
    expect(calls).toBe(KONLING_FAIR_EXPERIMENT_BANK_V1.items.length * 2 * 3);
  });

  it('生成失败：fail closed 不产正式汇总；重跑后恢复', async () => {
    const failingKey = buildKonlingFairExperimentTaskKey({
      bankVersion: KONLING_FAIR_EXPERIMENT_BANK_V1.bankVersion,
      arm: 'plain-baseline',
      itemId: KONLING_FAIR_EXPERIMENT_BANK_V1.items[0].itemId,
      replicate: 1,
    });
    const failingProvider: typeof generateProvider = async (task) => {
      const taskKey = buildKonlingFairExperimentTaskKey({
        bankVersion: KONLING_FAIR_EXPERIMENT_BANK_V1.bankVersion,
        arm: task.arm,
        itemId: task.item.itemId,
        replicate: task.replicate,
      });
      if (taskKey === failingKey) {
        return { ok: false, error: { code: 'insufficient-balance', message: 'injected' } };
      }
      return generateProvider(task);
    };
    const first = await runKonlingFairExperiment({
      root, runId: 'fail', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      generateProvider: failingProvider, auditProvider,
    });
    expect(first.aggregateStatus).toBe('incomplete');
    expect(first.aggregate.incompleteDetail?.missingTaskKeys).toContain(failingKey);
    expect(first.aggregate.officialSummary).toBeNull();
    expect(fs.existsSync(path.join(konlingFairExperimentRunDir(root, 'fail'), 'summary', 'official.json'))).toBe(false);

    const second = await runKonlingFairExperiment({
      root, runId: 'fail', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      generateProvider, auditProvider,
    });
    expect(second.aggregateStatus).toBe('complete');
  });

  it('混配置拒绝：与 manifest 不一致的采样参数被点名', async () => {
    await runKonlingFairExperiment({
      root, runId: 'mixed', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      generateProvider, auditProvider,
    });
    const drifted = aggregateKonlingFairExperiment({
      root, runId: 'mixed', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      arms: ['plain-baseline', 'enhanced-baseline', 'full-feature'],
      config: fixtureConfig({ sampling: { seed: 1, temperature: 0.2, topP: 1, maxOutputTokens: 2048 } }),
      calibers: ['structure-alias.v1'],
      writeOfficial: false,
    });
    expect(drifted.status).toBe('mixed-configuration');
    expect(drifted.mixedConfigurationDetail?.dimension).toBe('sampling');
  });

  it('缺臂或重复臂的配置被拒绝（exactly three arms）', async () => {
    await expect(runKonlingFairExperiment({
      root, runId: 'arms-subset', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      arms: ['plain-baseline', 'full-feature'],
      generateProvider, auditProvider,
    })).rejects.toThrow(/exactly the three standard arms/);
    await expect(runKonlingFairExperiment({
      root, runId: 'arms-duplicate', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      arms: ['plain-baseline', 'plain-baseline', 'full-feature'],
      generateProvider, auditProvider,
    })).rejects.toThrow(/exactly the three standard arms/);
  });
});

describe('评分器口径回放', () => {
  it('回放不触发生成、不修改回答文件，产出独立口径差值', async () => {
    let generateCalls = 0;
    const countingProvider: typeof generateProvider = async (task) => {
      generateCalls += 1;
      return generateProvider(task);
    };
    await runKonlingFairExperiment({
      root, runId: 'replay', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      generateProvider: countingProvider, auditProvider,
    });
    const runDir = konlingFairExperimentRunDir(root, 'replay');
    const answerFilesBefore = fs.readdirSync(path.join(runDir, 'answers', 'enhanced-baseline')).sort()
      .map((file) => fs.readFileSync(path.join(runDir, 'answers', 'enhanced-baseline', file), 'utf8'));

    const replay = replayKonlingFairExperimentScoring({
      root, runId: 'replay', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      calibers: ['structure-alias.v1', 'structure-strict-title.v0'],
      scorerRevision: 'replay-revision',
    });
    expect(replay.status).toBe('complete');
    expect(generateCalls).toBe(KONLING_FAIR_EXPERIMENT_BANK_V1.items.length * 2 * 3);
    const answerFilesAfter = fs.readdirSync(path.join(runDir, 'answers', 'enhanced-baseline')).sort()
      .map((file) => fs.readFileSync(path.join(runDir, 'answers', 'enhanced-baseline', file), 'utf8'));
    expect(answerFilesAfter).toEqual(answerFilesBefore);

    // 别名标题臂在旧口径下地板化；canonical 臂不受影响。
    const enhancedDelta = replay.officialSummary!.caliberDeltas.find(
      (entry) => entry.comparison.label === 'enhanced-baseline@structure-strict-title.v0',
    );
    expect(enhancedDelta?.percentagePointDifference).toBe(-100);
    const fullDelta = replay.officialSummary!.caliberDeltas.find(
      (entry) => entry.comparison.label === 'full-feature@structure-strict-title.v0',
    );
    expect(fullDelta?.percentagePointDifference).toBe(0);
    expect(fs.existsSync(path.join(runDir, 'summary', 'replay-structure-alias.v1+structure-strict-title.v0.json'))).toBe(true);

    // 评分记录按评分器修订隔离：回放修订的命名空间独立存在，
    // 原修订评分不受影响，原配置聚合仍从原命名空间读取。
    expect(fs.existsSync(path.join(runDir, 'scores', 'structure-strict-title.v0', 'replay-revision', 'enhanced-baseline'))).toBe(true);
    expect(fs.existsSync(path.join(runDir, 'scores', 'structure-alias.v1', 'test-revision', 'enhanced-baseline'))).toBe(true);
    const originalAggregate = aggregateKonlingFairExperiment({
      root, runId: 'replay', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      arms: ['plain-baseline', 'enhanced-baseline', 'full-feature'],
      config: fixtureConfig(),
      calibers: ['structure-alias.v1'],
      writeOfficial: false,
    });
    expect(originalAggregate.status).toBe('complete');
  });

  it('同种子同数据得到相同 CI（确定性 bootstrap）', async () => {
    const run = async () => {
      const summary = await runKonlingFairExperiment({
        root, runId: 'determinism', bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
        config: fixtureConfig(), calibers: ['structure-alias.v1'],
        generateProvider, auditProvider,
      });
      return JSON.stringify(summary.aggregate.officialSummary!.generationDeltas);
    };
    expect(await run()).toBe(await run());
  });
});

describe('盲审 judge 判定解析', () => {
  it('接受合法枚举与 0-1 ruleScore；拒绝非法语义', () => {
    expect(parseKonlingFairExperimentJudgeVerdict('{"verdict":"pass","ruleScore":0.9}'))
      .toEqual({ verdict: 'pass', ruleScore: 0.9, notes: null });
    expect(parseKonlingFairExperimentJudgeVerdict('```json\n{"verdict":"needs-improvement","ruleScore":0.5,"notes":"弱"}\n```'))
      .toEqual({ verdict: 'needs-improvement', ruleScore: 0.5, notes: '弱' });
    expect(parseKonlingFairExperimentJudgeVerdict('{"verdict":"PASS","ruleScore":0.9}')).toBeNull();
    expect(parseKonlingFairExperimentJudgeVerdict('{"verdict":"pass","ruleScore":8}')).toBeNull();
    expect(parseKonlingFairExperimentJudgeVerdict('{"verdict":"pass","ruleScore":NaN}')).toBeNull();
    expect(parseKonlingFairExperimentJudgeVerdict('{"verdict":"pass"}')).toBeNull();
    expect(parseKonlingFairExperimentJudgeVerdict('not json')).toBeNull();
  });
});
