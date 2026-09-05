/**
 * #1951：公平实验引用精确率与答案单元追溯覆盖率的确定性审计。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  aggregateKonlingFairCitationAudit,
  auditKonlingFairCitationRecord,
  exportKonlingFairExperimentArtifacts,
  runKonlingFairExperiment,
  type KonlingFairExperimentCitationSnapshot,
  type KonlingFairExperimentConfig,
} from '@/lib/konling-fair-experiment';
import { KONLING_FAIR_EXPERIMENT_BANK_V1 } from '@/lib/konling-fair-experiment';
import { STUDY_QUESTION_SECTIONS } from '@/lib/konling-study-question-structure';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'konling-fair-citation-1951-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function citation(overrides: Partial<KonlingFairExperimentCitationSnapshot> & { id: string }): KonlingFairExperimentCitationSnapshot {
  return {
    citationTargetId: 'kb:target',
    verified: true,
    displayNumber: 1,
    sourceType: 'knowledge-graph',
    href: 'https://act.example/kb/target',
    answerRelevanceMatch: 'query-exact',
    answerRelevanceBasis: 'query-exact',
    ...overrides,
  };
}

function audited(answer: string, citations: readonly KonlingFairExperimentCitationSnapshot[], intent: 'formula-derivation' = 'formula-derivation') {
  return auditKonlingFairCitationRecord({
    taskKey: 'test--full-feature--item--1',
    arm: 'full-feature',
    itemId: 'item',
    replicate: 1,
    intent,
    answer,
    citations,
  });
}

function canonicalBodyWithMarkers(intent: 'formula-derivation', marker: (sectionId: string) => string): string {
  return STUDY_QUESTION_SECTIONS[intent]
    .map((section) => `## ${section.title}\n按参考材料作答。${marker(section.id)}`)
    .join('\n');
}

describe('auditKonlingFairCitationRecord', () => {
  it('verified bound citations cover all evidence-required units', () => {
    const answer = canonicalBodyWithMarkers('formula-derivation', (section) => (
      STUDY_QUESTION_SECTIONS['formula-derivation'].find((candidate) => candidate.id === section)?.citationPolicy === 'evidence-required' ? ' [1]' : ''
    ));
    const record = audited(answer, [citation({ id: 'cit-1' })]);

    const evidenceSections = STUDY_QUESTION_SECTIONS['formula-derivation'].filter((section) => section.citationPolicy === 'evidence-required');
    expect(record.presentedCitationCount).toBe(1);
    expect(record.verifiedSupportingCount).toBe(1);
    expect(record.requiredUnitCount).toBe(evidenceSections.length);
    expect(record.coveredUnitCount).toBe(evidenceSections.length);
    expect(record.citationClasses.realVerifiedSupporting).toBe(1);
    expect(record.missReasons).toEqual({});
  });

  it('unverified citations do not count as coverage and are bucketed separately', () => {
    const answer = canonicalBodyWithMarkers('formula-derivation', () => ' [2]');
    const record = audited(answer, [
      citation({ id: 'cit-2', displayNumber: 2, verified: false, href: null }),
    ]);

    expect(record.presentedCitationCount).toBe(1);
    expect(record.verifiedSupportingCount).toBe(0);
    expect(record.coveredUnitCount).toBe(0);
    expect(record.requiredUnitCount).toBeGreaterThan(0);
    expect(record.citationClasses.citationUnverified).toBe(1);
    expect(record.missReasons['citation-unverified']).toBe(record.requiredUnitCount);
  });

  it('markers without an assigned citation and no-target citations are bucketed', () => {
    const unassigned = audited(canonicalBodyWithMarkers('formula-derivation', () => ' [3]'), []);
    expect(unassigned.citationClasses.markerUnassigned).toBe(1);
    expect(unassigned.verifiedSupportingCount).toBe(0);

    const noTarget = audited(
      canonicalBodyWithMarkers('formula-derivation', () => ' [1]'),
      [citation({ id: 'cit-1', citationTargetId: null })],
    );
    expect(noTarget.citationClasses.citationNoTarget).toBe(1);
    expect(noTarget.coveredUnitCount).toBe(0);
  });

  it('inaccessible citations (empty href) fall into the no-target bucket and never cover units', () => {
    const record = audited(
      canonicalBodyWithMarkers('formula-derivation', () => ' [1]'),
      [citation({ id: 'cit-1', href: null })],
    );
    expect(record.presentedCitationCount).toBe(1);
    expect(record.citationClasses.citationNoTarget).toBe(1);
    expect(record.verifiedSupportingCount).toBe(0);
    expect(record.coveredUnitCount).toBe(0);
    expect(record.requiredUnitCount).toBeGreaterThan(0);
  });

  it('related-only citations without direct-support evidence never count toward precision or coverage', () => {
    const record = audited(
      canonicalBodyWithMarkers('formula-derivation', () => ' [1]'),
      [citation({ id: 'cit-1', answerRelevanceMatch: null, answerRelevanceBasis: null })],
    );
    expect(record.presentedCitationCount).toBe(1);
    expect(record.citationClasses.citationNoDirectSupport).toBe(1);
    expect(record.citationClasses.realVerifiedSupporting).toBe(0);
    expect(record.verifiedSupportingCount).toBe(0);
    expect(record.coveredUnitCount).toBe(0);
  });

  it('pure semantic relevance (semantic-score) is retrieval-level only and never counts as direct support', () => {
    const record = audited(
      canonicalBodyWithMarkers('formula-derivation', () => ' [1]'),
      [citation({ id: 'cit-1', answerRelevanceMatch: 'semantic:strong', answerRelevanceBasis: 'semantic-score' })],
    );
    expect(record.citationClasses.citationNoDirectSupport).toBe(1);
    expect(record.verifiedSupportingCount).toBe(0);
    expect(record.coveredUnitCount).toBe(0);
  });

  it('structural-line markers never enter the precision numerator', () => {
    const answer = STUDY_QUESTION_SECTIONS['formula-derivation']
      .map((section) => section.citationPolicy === 'evidence-required'
        ? `## ${section.title}\n下面给出依据： [1]\n按参考材料作答。`
        : `## ${section.title}\n按推导作答。`)
      .join('\n');
    const record = audited(answer, [citation({ id: 'cit-1' })]);

    expect(record.presentedCitationCount).toBe(1);
    expect(record.verifiedSupportingCount).toBe(0);
    expect(record.citationClasses.realVerifiedSupporting).toBe(0);
    expect(record.coveredUnitCount).toBe(0);
    expect(record.requiredUnitCount).toBeGreaterThan(0);
    expect(record.missReasons['no-marker']).toBe(record.requiredUnitCount);
    // 已核验可访问有直接证据，但只标在结构行上——未支撑任何实质单元，
    // 按漂移计（唯一编号口径）。
    expect(record.driftedMarkerCount).toBe(1);
  });

  it('model-derived sections never enter the coverage denominator', () => {
    const answer = canonicalBodyWithMarkers('formula-derivation', (section) => (
      STUDY_QUESTION_SECTIONS['formula-derivation'].find((candidate) => candidate.id === section)?.citationPolicy === 'model-derived' ? ' [1]' : ''
    ));
    const record = audited(answer, [citation({ id: 'cit-1' })]);

    const evidenceCount = STUDY_QUESTION_SECTIONS['formula-derivation']
      .filter((section) => section.citationPolicy === 'evidence-required').length;
    expect(record.requiredUnitCount).toBe(evidenceCount);
    expect(record.coveredUnitCount).toBe(0);
    expect(record.verifiedSupportingCount).toBe(0);
    // 唯一编号口径：同一编号在多个 model-derived 章节出现也只计一次，
    // 不得与 scan 的出现次数口径叠加（#1992 review P2 回归）。
    expect(record.driftedMarkerCount).toBe(1);
  });
});

describe('aggregateKonlingFairCitationAudit', () => {
  it('pools numerators and denominators across records', () => {
    const recordA = audited(canonicalBodyWithMarkers('formula-derivation', () => ' [1]'), [citation({ id: 'cit-1' })]);
    const recordB = audited(canonicalBodyWithMarkers('formula-derivation', () => ' [2]'), [
      citation({ id: 'cit-2', displayNumber: 2, verified: false }),
    ]);
    const aggregate = aggregateKonlingFairCitationAudit([recordA, recordB]);

    expect(aggregate.precision).toEqual({ numerator: 1, denominator: 2, ratio: 0.5 });
    expect(aggregate.coverage.numerator).toBe(recordA.coveredUnitCount);
    expect(aggregate.coverage.denominator).toBe(recordA.requiredUnitCount + recordB.requiredUnitCount);
    expect(aggregate.byIntent).toHaveLength(1);
    expect(aggregate.byIntent[0]!.intent).toBe('formula-derivation');
  });
});

describe('端到端：official 汇总与同源导出', () => {
  function fixtureConfig(): KonlingFairExperimentConfig {
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
    };
  }

  function fullAnswerWithCitations(intent: string): { answer: string; citations: readonly KonlingFairExperimentCitationSnapshot[] } {
    const sections = STUDY_QUESTION_SECTIONS[intent as 'formula-derivation'];
    return {
      answer: sections
        .map((section) => `## ${section.title}\n正文表述。${section.citationPolicy === 'evidence-required' ? ' [1]' : ''}`)
        .join('\n'),
      citations: [citation({ id: 'cit-1' })],
    };
  }

  async function runFullExperiment(runId: string) {
    return runKonlingFairExperiment({
      root,
      runId,
      bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(),
      calibers: ['structure-alias.v1'],
      generateProvider: async (task) => {
        if (task.arm !== 'full-feature') {
          return { ok: true as const, result: { answer: '连贯段落，无小标题。', citations: [], elapsedMs: 1 } };
        }
        const full = fullAnswerWithCitations(task.item.intent);
        return { ok: true as const, result: { answer: full.answer, citations: full.citations, elapsedMs: 1 } };
      },
      auditProvider: async () => ({ ok: true as const, result: { verdict: 'pass', ruleScore: 0.9, notes: 'fixture' } }),
    });
  }

  it('official 汇总含两指标、逐回答记录与配对差', async () => {
    const summary = await runFullExperiment('e2e-1951');
    expect(summary.aggregateStatus).toBe('complete');
    const official = summary.aggregate.officialSummary!;

    const full = official.perArm['full-feature'].citationAudit;
    expect(full.precision.ratio).toBeGreaterThan(0);
    expect(full.coverage.ratio).toBeGreaterThan(0);
    expect(official.perArm['plain-baseline'].citationAudit.precision.denominator).toBe(0);

    expect(official.citationAuditRecords.length).toBe(KONLING_FAIR_EXPERIMENT_BANK_V1.items.length * KONLING_FAIR_EXPERIMENT_BANK_V1.replicates * 3);
    // 基线臂无引用功能（精确率恒 0/0）且其回答无章节结构（coverage 分母
    // 也为 0）：两指标的配对差都不可定义，均不产出——不得报告「0% 对
    // X%」的百分点差与 CI（#1992 review P1）。
    expect(official.citationAuditDeltas).toEqual([]);
  });

  it('冻结回答缺失 citation 快照时 fail closed', async () => {
    const summary = await runFullExperiment('legacy-1951');
    expect(summary.aggregateStatus).toBe('complete');

    // 模拟旧 run：抹掉一条冻结回答的 citations 字段后重新聚合。
    const runDir = path.join(root, 'artifacts/konling-fair-experiment', 'legacy-1951');
    const answerFiles: string[] = [];
    const plainDir = path.join(runDir, 'answers/plain-baseline');
    for (const entry of fs.readdirSync(plainDir)) answerFiles.push(path.join(plainDir, entry));
    const first = JSON.parse(fs.readFileSync(answerFiles[0]!, 'utf8'));
    delete first.citations;
    fs.writeFileSync(answerFiles[0]!, JSON.stringify(first, null, 2));

    const { aggregateKonlingFairExperiment } = await import('@/lib/konling-fair-experiment');
    const replayed = aggregateKonlingFairExperiment({
      root,
      runId: 'legacy-1951',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      arms: ['plain-baseline', 'enhanced-baseline', 'full-feature'],
      config: fixtureConfig(),
      calibers: ['structure-alias.v1'],
      writeOfficial: false,
    });
    expect(replayed.status).toBe('incomplete');
    expect(replayed.incompleteDetail?.phase).toBe('citation-audit');
    expect(replayed.officialSummary).toBeNull();
  });

  it('导出与冻结真源同源，真源漂移即拒绝', async () => {
    const summary = await runFullExperiment('export-1951');
    const official = summary.aggregate.officialSummary!;
    const runDir = path.join(root, 'artifacts/konling-fair-experiment', 'export-1951');

    const exported = await exportKonlingFairExperimentArtifacts(runDir, official);
    expect(fs.existsSync(exported.csv)).toBe(true);
    expect(fs.existsSync(exported.workbook)).toBe(true);
    expect(fs.existsSync(exported.slides)).toBe(true);
    const csv = fs.readFileSync(exported.csv, 'utf8');
    expect(csv).toContain('"citation-precision","full-feature"');
    expect(csv).toContain('"citation-coverage"');
    const slides = fs.readFileSync(exported.slides, 'utf8');
    expect(slides).toContain('引用精确率');
    expect(slides).toContain('追溯覆盖率');

    const tampered = { ...official, runId: 'tampered' };
    await expect(exportKonlingFairExperimentArtifacts(runDir, tampered as never)).rejects.toThrow(/drifted/);
  });

  it('full-feature 臂 citation 不可得（无 citations 字段）时 fail closed，不发布零值指标', async () => {
    const summary = await runKonlingFairExperiment({
      root,
      runId: 'live-unavailable-1951',
      bank: KONLING_FAIR_EXPERIMENT_BANK_V1,
      config: fixtureConfig(),
      calibers: ['structure-alias.v1'],
      generateProvider: async (task) => {
        if (task.arm !== 'full-feature') {
          return { ok: true as const, result: { answer: '连贯段落，无小标题。', citations: [], elapsedMs: 1 } };
        }
        // live full-feature 语义：citationContext 不可得 → 不写 citations 字段
        const full = fullAnswerWithCitations(task.item.intent);
        return { ok: true as const, result: { answer: full.answer, elapsedMs: 1 } };
      },
      auditProvider: async () => ({ ok: true as const, result: { verdict: 'pass', ruleScore: 0.9, notes: 'fixture' } }),
    });
    expect(summary.aggregateStatus).toBe('incomplete');
    expect(summary.aggregate.incompleteDetail?.phase).toBe('citation-audit');
    expect(summary.aggregate.officialSummary).toBeNull();
    const runDir = path.join(root, 'artifacts/konling-fair-experiment', 'live-unavailable-1951');
    expect(fs.existsSync(path.join(runDir, 'summary/official.csv'))).toBe(false);
  });
});

describe('buildPairedRatioDifference：CI 与点估计同为池化口径', () => {
  it('分母悬殊时点估计落在配对 CI 内且同向（#1992 review P1 回归）', async () => {
    const { buildPairedRatioDifference } = await import('@/lib/konling-fair-experiment');
    // 1 对 baseline 分母 1000（全未通过）vs comparison 分母 1（通过）；
    // 其余 19 对双方各 1/1。池化点估计 ≈ +98.1pp；旧逐题未加权均值
    // 只有 1/20，CI 会远离甚至反号——池化重采样必须覆盖点估计。
    const baselinePairedRatios = [
      { numerator: 0, denominator: 1000 },
      ...Array.from({ length: 19 }, () => ({ numerator: 1, denominator: 1 })),
    ];
    const comparisonPairedRatios = [
      { numerator: 1, denominator: 1 },
      ...Array.from({ length: 19 }, () => ({ numerator: 1, denominator: 1 })),
    ];
    const delta = buildPairedRatioDifference({
      metric: 'citation-precision',
      baselineLabel: 'plain-baseline',
      comparisonLabel: 'full-feature',
      baselinePairedRatios,
      comparisonPairedRatios,
      seedParts: ['test', 'citation-precision'],
      iterations: 2000,
    });
    expect(delta).not.toBeNull();
    expect(delta!.percentagePointDifference).toBeGreaterThan(90);
    expect(delta!.pairedCi95.low).toBeLessThanOrEqual(delta!.percentagePointDifference + 1e-9);
    expect(delta!.pairedCi95.high).toBeGreaterThanOrEqual(delta!.percentagePointDifference - 1e-9);
    expect(delta!.pairedCi95.high).toBeGreaterThan(50);
  });

  it('任一臂池化分母为零（无引用功能臂的精确率）不产出配对差（N/A）', async () => {
    const { buildPairedRatioDifference } = await import('@/lib/konling-fair-experiment');
    const delta = buildPairedRatioDifference({
      metric: 'citation-precision',
      baselineLabel: 'plain-baseline',
      comparisonLabel: 'full-feature',
      baselinePairedRatios: Array.from({ length: 4 }, () => ({ numerator: 0, denominator: 0 })),
      comparisonPairedRatios: Array.from({ length: 4 }, () => ({ numerator: 1, denominator: 1 })),
      seedParts: ['test', 'citation-precision'],
      iterations: 100,
    });
    expect(delta).toBeNull();
  });

  it('同种子同数据 CI 可复现', async () => {
    const { buildPairedRatioDifference } = await import('@/lib/konling-fair-experiment');
    const input = {
      metric: 'citation-coverage',
      baselineLabel: 'plain-baseline',
      comparisonLabel: 'full-feature',
      baselinePairedRatios: Array.from({ length: 12 }, (_, index) => ({ numerator: index % 3, denominator: 4 })),
      comparisonPairedRatios: Array.from({ length: 12 }, (_, index) => ({ numerator: index % 2, denominator: 3 })),
      seedParts: ['test', 'citation-coverage'],
      iterations: 500,
    } as const;
    const first = buildPairedRatioDifference(input);
    const second = buildPairedRatioDifference(input);
    expect(first).toEqual(second);
  });
});
