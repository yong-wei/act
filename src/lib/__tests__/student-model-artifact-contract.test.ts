/**
 * 学生辨识工件契约测试（issue-2152-p1）。
 *
 * 覆盖：Rust serde 样例逐字对齐、非有限值拒绝、窗口重叠拒绝、
 * 规范序哈希确定性（server-hash 仅服务端路径，测试直接 import）。
 */
import { describe, expect, it } from 'vitest';

import {
  comparisonSaveSchema,
  modelStructureSchema,
  studentModelSaveSchema,
} from '@/lib/student-model-artifact-contract';
import {
  canonicalJson,
  studentModelContentHash,
} from '@/lib/student-model-artifact-contract/server-hash';

/** Rust `ModelStructure` serde 输出样例（snake_case kind 标签）。 */
const rustSerdeSamples = [
  { kind: 'nomoto1', k: 0.08, t_s: 25.0 },
  { kind: 'nomoto2', k: 0.05, t1_s: 8.0, t2_s: 1.5 },
  { kind: 'fopdt', k: 0.5, t_s: 10.0, delay_s: 3.0 },
  { kind: 'roll_oscillator', natural_freq_rad_s: 0.6, damping: 0.12, control_gain: 0.02 },
  { kind: 'dp_low_freq3', a: Array.from({ length: 9 }, (_, i) => 0.1 * i), b: Array.from({ length: 9 }, () => 0.01) },
];

describe('modelStructureSchema 与 Rust serde 对齐', () => {
  it('接受全部 Rust 结构样例', () => {
    for (const sample of rustSerdeSamples) {
      const parsed = modelStructureSchema.safeParse(sample);
      expect(parsed.success, JSON.stringify(sample)).toBe(true);
    }
  });

  it('拒绝未知 kind 与缺失字段', () => {
    expect(modelStructureSchema.safeParse({ kind: 'magic', k: 1 }).success).toBe(false);
    expect(modelStructureSchema.safeParse({ kind: 'nomoto1', k: 1 }).success).toBe(false);
  });

  it('拒绝非有限数值', () => {
    expect(modelStructureSchema.safeParse({ kind: 'nomoto1', k: Number.NaN, t_s: 10 }).success).toBe(false);
    expect(
      modelStructureSchema.safeParse({ kind: 'nomoto1', k: 1, t_s: Number.POSITIVE_INFINITY }).success,
    ).toBe(false);
    const badMatrix = { kind: 'dp_low_freq3', a: Array.from({ length: 9 }, () => Number.NaN), b: Array.from({ length: 9 }, () => 0) };
    expect(modelStructureSchema.safeParse(badMatrix).success).toBe(false);
  });

  it('dp_low_freq3 矩阵必须恰好 9 元素', () => {
    const short = { kind: 'dp_low_freq3', a: [0, 1, 2], b: Array.from({ length: 9 }, () => 0) };
    expect(modelStructureSchema.safeParse(short).success).toBe(false);
  });
});

describe('studentModelSaveSchema', () => {
  const base = {
    experimentKey: 'exp-055-heading',
    lineageKey: 'heading@cruise15',
    ioContract: { inputChannel: 'rudder_deg', outputChannel: 'yaw_rate_deg_s', inputUnit: 'deg', outputUnit: 'deg/s' },
    operatingPoint: { speedMps: 15 },
    identification: { algorithm: 'nomoto1_arx', settings: {}, identifiedOk: true, residualRms: 0.01 },
    trainingRuns: [{ runRef: 'run-a', startS: 0, endS: 60 }],
    validationRuns: [{ runRef: 'run-a', startS: 60, endS: 120 }],
    sampleDt: 0.2,
  };

  it('接受合法载荷', () => {
    const parsed = studentModelSaveSchema.safeParse({ ...base, structure: rustSerdeSamples[0] });
    expect(parsed.success).toBe(true);
  });

  it('拒绝同 runRef 上重叠的训练/验证窗口', () => {
    const parsed = studentModelSaveSchema.safeParse({
      ...base,
      structure: rustSerdeSamples[0],
      validationRuns: [{ runRef: 'run-a', startS: 30, endS: 90 }],
    });
    expect(parsed.success).toBe(false);
  });

  it('跨 run 窗口天然不重叠', () => {
    const parsed = studentModelSaveSchema.safeParse({
      ...base,
      structure: rustSerdeSamples[0],
      validationRuns: [{ runRef: 'run-b', startS: 0, endS: 60 }],
    });
    expect(parsed.success).toBe(true);
  });

  it('拒绝非法采样周期与倒置窗口', () => {
    expect(studentModelSaveSchema.safeParse({ ...base, structure: rustSerdeSamples[0], sampleDt: 0 }).success).toBe(false);
    expect(
      studentModelSaveSchema.safeParse({
        ...base,
        structure: rustSerdeSamples[0],
        trainingRuns: [{ runRef: 'run-a', startS: 60, endS: 0 }],
      }).success,
    ).toBe(false);
  });
});

describe('comparisonSaveSchema', () => {
  const base = {
    experimentKey: 'exp-055-heading',
    stepKey: 'step-08',
    mode: 'command_to_output',
    studentModelId: 'ck123456',
    physicalRunRef: 'ilab-run-xyz',
    inputSource: 'actuator_measurement',
    alignmentWindow: { startS: 0, endS: 120 },
    factorFlags: { physical: ['wave_v1'], student: [], unmodeled: ['wind'] },
    metrics: { rmse: 0.12, fitPercent: 82.5 },
    curveRefs: { predicted: 'inline', measured: 'inline' },
  };

  it('接受合法载荷与三种模式', () => {
    for (const mode of ['hull_model', 'command_to_output', 'independent_closed_loop'] as const) {
      expect(comparisonSaveSchema.safeParse({ ...base, mode }).success).toBe(true);
    }
  });

  it('拒绝非法模式与非法输入来源', () => {
    expect(comparisonSaveSchema.safeParse({ ...base, mode: 'telepathy' }).success).toBe(false);
    expect(comparisonSaveSchema.safeParse({ ...base, inputSource: 'vibes' }).success).toBe(false);
  });
});

describe('服务端规范序哈希', () => {
  it('键序无关、数值归一（-0 与 0 同哈希）', () => {
    const a = studentModelContentHash({
      structure: { kind: 'nomoto1', k: 0.08, t_s: 25 },
      ioContract: { input: 'rudder' },
      operatingPoint: { speed: 15 },
      identification: { ok: true },
      trainingRuns: [{ runRef: 'a', startS: 0, endS: 1 }],
      validationRuns: [],
      sampleDt: 0.2,
    });
    const b = studentModelContentHash({
      sampleDt: 0.2,
      validationRuns: [],
      trainingRuns: [{ endS: 1, startS: 0, runRef: 'a' }],
      identification: { ok: true },
      operatingPoint: { speed: 15 },
      ioContract: { input: 'rudder' },
      structure: { t_s: 25, k: 0.08, kind: 'nomoto1' },
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('内容变化改变哈希；-0 归一化', () => {
    const base = {
      ioContract: {},
      operatingPoint: {},
      identification: {},
      trainingRuns: [],
      validationRuns: [],
      sampleDt: 0.2,
    };
    const h1 = studentModelContentHash({ ...base, structure: { k: 1 } });
    const h2 = studentModelContentHash({ ...base, structure: { k: 2 } });
    expect(h1).not.toBe(h2);
    expect(canonicalJson(-0)).toBe(canonicalJson(0));
  });
});
