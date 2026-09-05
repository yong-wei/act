import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { exportKonlingFairExperimentArtifacts } from '@/lib/konling-fair-experiment/export';
import type { KonlingFairExperimentOfficialSummary } from '@/lib/konling-fair-experiment/types';

// Issue #2016：composite 指标人类可见名称统一为「结构与质量联合通过率」，
// 普通基线 0% 附结构性来源解释，0/0 引用指标显示 N/A。内部 schema key
// `composite` 与冻结 official.json 不改写。

function rate(passed: number, n: number) {
  return { rate: n === 0 ? 0 : passed / n, passed, n };
}

function officialFixture(overrides: {
  precision?: { numerator: number; denominator: number };
  coverage?: { numerator: number; denominator: number };
} = {}): KonlingFairExperimentOfficialSummary {
  const precisionDenominator = overrides.precision?.denominator ?? 0;
  const coverageDenominator = overrides.coverage?.denominator ?? 0;
  return {
    schemaVersion: 'konling-fair-experiment.official.v1',
    runId: 'run-2016',
    status: 'complete',
    config: { provider: 'test', model: 'test-model', seed: 1 },
    bank: { version: 'fair-experiment-v1', itemCount: 18, replicates: 2 },
    perArm: {
      'plain-baseline': {
        structure: { 'structure-alias.v1': rate(0, 36) },
        audit: rate(35, 36),
        composite: { 'structure-alias.v1': rate(0, 36) },
        citationAudit: {
          precision: { ratio: 0, numerator: overrides.precision?.numerator ?? 0, denominator: precisionDenominator },
          coverage: { ratio: 0, numerator: overrides.coverage?.numerator ?? 0, denominator: coverageDenominator },
        },
      },
      'enhanced-baseline': {
        structure: { 'structure-alias.v1': rate(1, 36) },
        audit: rate(36, 36),
        composite: { 'structure-alias.v1': rate(1, 36) },
        citationAudit: {
          precision: { ratio: 1, numerator: 6, denominator: 6 },
          coverage: { ratio: 1, numerator: 6, denominator: 6 },
        },
      },
      'full-feature': {
        structure: { 'structure-alias.v1': rate(1, 36) },
        audit: rate(36, 36),
        composite: { 'structure-alias.v1': rate(1, 36) },
        citationAudit: {
          precision: { ratio: 1, numerator: 6, denominator: 6 },
          coverage: { ratio: 1, numerator: 6, denominator: 6 },
        },
      },
    },
    generationDeltas: [{
      metric: 'composite@structure-alias.v1',
      baseline: { arm: 'plain-baseline', label: 'plain' },
      comparison: { arm: 'full-feature', label: 'full' },
      percentagePointDifference: 100,
      pairedCi95: { low: 100, high: 100 },
      pairedN: 36,
    }],
    citationAuditDeltas: [],
    caliberDeltas: [],
  } as unknown as KonlingFairExperimentOfficialSummary;
}

describe('konling fair experiment export naming and interpretation (#2016)', () => {
  it('uses the unified composite display name, plain-baseline note, and N/A for 0/0 citations', async () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fair-export-2016-'));
    fs.mkdirSync(path.join(runDir, 'summary'), { recursive: true });
    const official = officialFixture();
    fs.writeFileSync(
      path.join(runDir, 'summary', 'official.json'),
      JSON.stringify(official, null, 2),
      'utf8',
    );

    const result = await exportKonlingFairExperimentArtifacts(runDir, official);
    const csv = fs.readFileSync(result.csv, 'utf8');
    const slides = fs.readFileSync(result.slides, 'utf8');
    const notes = JSON.parse(fs.readFileSync(result.notes, 'utf8'));

    // 统一的人类可见名称出现在 CSV、工作簿行与幻灯片。
    expect(csv).toContain('composite-structure-and-quality@structure-alias.v1');
    expect(slides).toContain('结构与质量联合通过率@structure-alias.v1');
    expect(slides).toContain('结构通过且盲审质量非 major-error');
    // 普通基线旁的 0% 结构性来源解释。
    expect(slides).toContain('未启用结构合同；联合通过率 0% 不代表知识正确率 0%');
    // 0/0 引用指标显示 N/A 而不是 0%。
    expect(slides).toContain('| 引用精确率 | N/A |');
    expect(slides).toContain('| 追溯覆盖率 | N/A |');
    expect(csv).toContain('"citation-precision","plain-baseline"');
    expect(csv).toContain('"composite-structure-and-quality@structure-alias.v1","plain-baseline"');
    // JSON 派生说明：统一名称、公式与解释。
    expect(notes.metricNames.composite).toBe('结构与质量联合通过率');
    expect(notes.metricNames.compositeFormula).toBe('结构通过且盲审质量非 major-error');
    expect(notes.plainBaselineNote).toContain('不代表知识正确率 0%');
    // 幻灯片不再把联合指标称为泛化的「综合通过率」。
    expect(slides).not.toContain('综合通过率');

    fs.rmSync(runDir, { recursive: true, force: true });
  });

  it('keeps frozen data compatibility: composite values render from official.json without rewriting it', async () => {
    const runDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fair-export-2016b-'));
    fs.mkdirSync(path.join(runDir, 'summary'), { recursive: true });
    const official = officialFixture({
      precision: { numerator: 6, denominator: 6 },
      coverage: { numerator: 6, denominator: 6 },
    });
    const frozenJson = JSON.stringify(official, null, 2);
    fs.writeFileSync(path.join(runDir, 'summary', 'official.json'), frozenJson, 'utf8');

    const result = await exportKonlingFairExperimentArtifacts(runDir, official);
    const slides = fs.readFileSync(result.slides, 'utf8');
    const frozenAfter = fs.readFileSync(path.join(runDir, 'summary', 'official.json'), 'utf8');

    // 真源不被改写；有分母的引用指标仍显示百分比。
    expect(frozenAfter).toBe(frozenJson);
    expect(slides).toContain('| 引用精确率 | 100.0% (6/6) |');
    expect(slides).toContain('composite@structure-alias.v1'.replace('composite@', '结构与质量联合通过率@'));
    // JSON 中的 metric 字符串保持 composite 机器名（delta 来源冻结）。
    expect(frozenAfter).toContain('"composite@structure-alias.v1"');

    fs.rmSync(runDir, { recursive: true, force: true });
  });
});
