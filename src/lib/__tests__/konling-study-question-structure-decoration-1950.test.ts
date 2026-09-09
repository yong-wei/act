/**
 * 结构评分器装饰前缀归一化（Issue #1950）。
 *
 * 覆盖：v2 口径下 emoji/编号/装饰标点前缀标题命中必需章节、v1 冻结
 * 回归、负例不误判、无装饰输入 v1/v2 恒等、固定回答回放产出 v1→v2
 * 评分口径差值且不触发生成。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  KONLING_FAIR_EXPERIMENT_BANK_V1,
  konlingFairExperimentRunDir,
  replayKonlingFairExperimentScoring,
  runKonlingFairExperiment,
} from '@/lib/konling-fair-experiment';
import type { KonlingFairExperimentConfig } from '@/lib/konling-fair-experiment';
import {
  STUDY_QUESTION_SECTIONS,
  detectStudyQuestionSectionHeading,
  evaluateStudyQuestionStructure,
} from '@/lib/konling-study-question-structure';

/** fair-live-20260904-r1 两条失败回答的冻结形态：四章节齐全但标题带装饰前缀。 */
const DECORATED_DEBUGGING_ANSWER = [
  '### 🔍 故障定位',
  '积分饱和导致超调持续增大，舵机在 3 秒后发散（复现条件：给定阶跃 10°）。',
  '### 🧠 原因分析',
  '积分项没有限幅，误差长期同号时积分持续累积。',
  '### 🛠️ 最小修复',
  '在积分器输出处加 clamping 抗饱和，限幅到执行器行程。',
  '### ✅ 验证方法',
  '重跑阶跃响应，观察超调是否回落到 5% 以内。',
].join('\n');

function canonicalAnswer(intent: keyof typeof STUDY_QUESTION_SECTIONS): string {
  return STUDY_QUESTION_SECTIONS[intent]
    .map((section) => `## ${section.title}\n正文。`)
    .join('\n');
}

describe('装饰前缀标题的口径行为（#1950）', () => {
  it('Issue 四个装饰标题在默认（v2）口径下命中 code-debugging 全部章节', () => {
    const result = evaluateStudyQuestionStructure({ answer: DECORATED_DEBUGGING_ANSWER, intent: 'code-debugging' });
    expect(result).toEqual({
      passed: true,
      matchedIds: ['locate', 'cause', 'fix', 'verify'],
      missingIds: [],
    });
  });

  it('v1 口径冻结：同一回答仍判缺少全部必需章节（回放差值基线）', () => {
    const result = evaluateStudyQuestionStructure({
      answer: DECORATED_DEBUGGING_ANSWER,
      intent: 'code-debugging',
      caliber: 'structure-alias.v1',
    });
    expect(result.passed).toBe(false);
    expect(result.missingIds).toEqual(['locate', 'cause', 'fix', 'verify']);
  });

  it('编号与装饰标点前缀同样命中', () => {
    const answer = [
      '### 1. 🔍 故障定位',
      '现象。',
      '### （二）🧠 原因分析',
      '根因。',
      '### 一、🛠️ 最小修复',
      '改法。',
      '## ✅ | 验证方法',
      '步骤。',
    ].join('\n');
    expect(evaluateStudyQuestionStructure({ answer, intent: 'code-debugging' }).passed).toBe(true);
  });

  it('keycap 序列编号标题命中（数字+FE0F+20E3）', () => {
    const answer = [
      '## 1️⃣ 前提与符号',
      'G(s) 为前向通道。',
      '## 2️⃣ 关键变形',
      '闭环为 G/(1+GH)。',
      '## 3️⃣ 适用条件',
      '单位负反馈。',
      '## 10️⃣ 结果校验',
      '分母次数不低于分子。',
    ].join('\n');
    expect(evaluateStudyQuestionStructure({ answer, intent: 'formula-derivation' }).passed).toBe(true);
  });

  it('肤色修饰与旗帜 emoji 序列前缀命中', () => {
    const emojiOnly = [
      '## 👩🏽‍💻 前提与符号',
      'G(s) 为前向通道。',
      '## 🇨🇳 关键变形',
      '闭环为 G/(1+GH)。',
      '## ✅ 适用条件',
      '单位负反馈。',
      '## 🔍 结果校验',
      '分母次数不低于分子。',
    ].join('\n');
    expect(evaluateStudyQuestionStructure({ answer: emojiOnly, intent: 'formula-derivation' }).passed).toBe(true);
  });

  it('无装饰标题在 v1 与 v2 下输出恒等（剥离幂等）', () => {
    const answer = canonicalAnswer('formula-derivation');
    const v1 = evaluateStudyQuestionStructure({ answer, intent: 'formula-derivation', caliber: 'structure-alias.v1' });
    const v2 = evaluateStudyQuestionStructure({ answer, intent: 'formula-derivation', caliber: 'structure-alias.v2' });
    expect(v2).toEqual(v1);
    expect(v2.passed).toBe(true);
  });

  it('加粗与三级以下装饰标题同样命中', () => {
    const answer = [
      '**🔍 故障定位**',
      '现象。',
      '**🛠️ 最小修复**',
      '改法。',
      '## 🧠 原因分析',
      '根因。',
      '## ✅ 验证方法',
      '步骤。',
    ].join('\n');
    expect(evaluateStudyQuestionStructure({ answer, intent: 'code-debugging' }).passed).toBe(true);
  });
});

describe('装饰归一化不制造假阳性（#1950）', () => {
  it('剥离后为空或语义不符的装饰标题仍失败', () => {
    const emojiOnly = evaluateStudyQuestionStructure({
      answer: ['### 🔍', '现象。'].join('\n'),
      intent: 'code-debugging',
    });
    expect(emojiOnly.passed).toBe(false);
    expect(emojiOnly.missingIds).toContain('locate');

    const semanticMismatch = evaluateStudyQuestionStructure({
      answer: ['### 🔍 排障思路', '现象。'].join('\n'),
      intent: 'code-debugging',
    });
    expect(semanticMismatch.passed).toBe(false);
  });

  it('只在正文提及关键词、缺少真实章节的回答仍失败', () => {
    const answer = [
      '### 🔍 故障定位',
      '下面依次说明原因分析、最小修复与验证方法，但这些只是正文提及，没有标题行。',
    ].join('\n');
    const result = evaluateStudyQuestionStructure({ answer, intent: 'code-debugging' });
    expect(result.passed).toBe(false);
    expect(result.missingIds).toEqual(['cause', 'fix', 'verify']);
  });

  it('数字开头的真实标题不被误剥（编号 token 要求终止符）', () => {
    const undecorated = evaluateStudyQuestionStructure({
      answer: ['## 2023 适用范围', '课程实验报告。', '## 规定结论', '结论。', '## 核验来源', '来源。'].join('\n'),
      intent: 'normative-content',
    });
    expect(undecorated.passed).toBe(false);
    expect(undecorated.missingIds).toEqual(['scope']);

    const decorated = evaluateStudyQuestionStructure({
      answer: ['## 1. 适用范围', '课程实验报告。', '## 规定结论', '结论。', '## 核验来源', '来源。'].join('\n'),
      intent: 'normative-content',
    });
    expect(decorated.passed).toBe(true);
  });
});

describe('产品章节检测默认口径（#1950）', () => {
  it('detectStudyQuestionSectionHeading 默认识别装饰标题；显式 v1 冻结', () => {
    expect(detectStudyQuestionSectionHeading('### 🔍 故障定位', 'code-debugging')?.id).toBe('locate');
    expect(detectStudyQuestionSectionHeading('### 🔍 故障定位', 'code-debugging', 'structure-alias.v1')).toBeNull();
    expect(detectStudyQuestionSectionHeading('## 故障定位', 'code-debugging', 'structure-alias.v1')?.id).toBe('locate');
  });
});

describe('固定回答回放的口径差值（#1950）', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'konling-decoration-1950-'));
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  function fixtureConfig(): KonlingFairExperimentConfig {
    return {
      model: 'fixture-generator',
      provider: 'deterministic-fixture-stub',
      sampling: { seed: 20260904, temperature: 0.2, topP: 1, maxOutputTokens: 2048 },
      armPromptVersions: {
        'plain-baseline': 'fair-experiment-plain.v1',
        'enhanced-baseline': 'fair-experiment-enhanced.v1',
        'full-feature': 'konling-generic-chat.v1',
      },
      gitRevision: 'test-revision',
      scorerRevision: 'test-revision',
      bootstrapIterations: 200,
      audit: { enabled: true, promptVersion: 'konling-blind-audit.v1', scoreVersion: 'rubric.v1' },
    };
  }

  /** code-debugging 条目产出 Issue 冻结形态的装饰标题回答，其余条目 canonical。 */
  const generateProvider = async (task: Parameters<Parameters<typeof runKonlingFairExperiment>[0]['generateProvider']>[0]) => ({
    ok: true as const,
    result: {
      answer: task.item.intent === 'code-debugging'
        ? DECORATED_DEBUGGING_ANSWER
        : canonicalAnswer(task.item.intent),
      // #1951：citation 快照与回答同文件冻结；回答无 [n] 标记，
      // 空快照即合法（full-feature 缺字段会令 replay fail closed）。
      citations: [],
      elapsedMs: 1,
    },
  });

  const auditProvider = async () => ({
    ok: true as const,
    result: { verdict: 'pass', ruleScore: 0.95, notes: 'fixture' },
  });

  it('两条冻结回答回放：v1 失败、v2 通过，报告单独呈现口径差值', async () => {
    const runId = 'decoration-replay';
    await runKonlingFairExperiment({
      root, runId, bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(), calibers: ['structure-alias.v1'],
      generateProvider, auditProvider,
    });
    const runDir = konlingFairExperimentRunDir(root, runId);
    const answersBefore = fs.readFileSync(
      path.join(runDir, 'answers', 'full-feature', 'fair-experiment-v1--full-feature--code-antiwindup--1.json'),
      'utf8',
    );

    const replay = replayKonlingFairExperimentScoring({
      root, runId, bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      calibers: ['structure-alias.v1', 'structure-alias.v2'],
      scorerRevision: 'replay-revision',
    });
    expect(replay.status).toBe('complete');

    // 冻结回答未被修改；v1/v2 评分记录按口径命名空间隔离且结论相反。
    const answersAfter = fs.readFileSync(
      path.join(runDir, 'answers', 'full-feature', 'fair-experiment-v1--full-feature--code-antiwindup--1.json'),
      'utf8',
    );
    expect(answersAfter).toBe(answersBefore);
    const scoreOf = (caliber: string) => JSON.parse(fs.readFileSync(
      path.join(runDir, 'scores', caliber, 'replay-revision', 'full-feature', 'fair-experiment-v1--full-feature--code-antiwindup--1.json'),
      'utf8',
    )) as { passed: boolean };
    expect(scoreOf('structure-alias.v1').passed).toBe(false);
    expect(scoreOf('structure-alias.v2').passed).toBe(true);

    // 回放报告单独呈现 v1→v2 口径差值；code-debugging 条目（1/6）由
    // 假阴性转通过，各臂结构通过率出现可归因差值。
    const deltas = replay.officialSummary!.caliberDeltas
      .filter((entry) => entry.metric === 'caliber:structure-alias.v1->structure-alias.v2');
    expect(deltas.length).toBe(3);
    for (const delta of deltas) {
      expect(delta.percentagePointDifference).toBeGreaterThan(0);
    }
    expect(fs.existsSync(path.join(runDir, 'summary', 'replay-structure-alias.v1+structure-alias.v2.json'))).toBe(true);
  });
});
