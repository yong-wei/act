import { createHash } from 'node:crypto';

import type {
  KonlingFairExperimentPairedDifference,
  KonlingFairExperimentPairedRatioDifference,
  KonlingFairExperimentRateMetric,
  KonlingFairExperimentRatioMetric,
} from './types';

/**
 * 配对差值指标（#1900）：绝对值、百分点差与配对 bootstrap 95% CI。
 * 随机数用 mulberry32，种子由 manifest 种子与比较身份确定性派生，
 * 同数据同种子得到同区间。
 */

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 身份派生种子（#1952 起导出：专家复核抽样等确定性选择复用同一派生）。 */
export function derivedSeed(...parts: string[]): number {
  const digest = createHash('sha256').update(parts.join('\u0000')).digest();
  return digest.readUInt32BE(0);
}

export function rateMetric(passed: readonly boolean[]): KonlingFairExperimentRateMetric {
  const n = passed.length;
  const passCount = passed.filter(Boolean).length;
  return { n, passed: passCount, rate: n === 0 ? 0 : passCount / n };
}

export function pairedBootstrapCi95(
  pairedOutcomes: ReadonlyArray<{ baseline: boolean; comparison: boolean }>,
  seedParts: readonly string[],
  iterations: number,
): { low: number; high: number } | null {
  if (pairedOutcomes.length === 0) return null;
  const diffs = pairedOutcomes.map((pair) => (pair.comparison ? 1 : 0) - (pair.baseline ? 1 : 0));
  return bootstrapCi95ForDiffs(diffs, seedParts, iterations);
}

function bootstrapCi95ForDiffs(
  diffs: readonly number[],
  seedParts: readonly string[],
  iterations: number,
): { low: number; high: number } | null {
  if (diffs.length === 0) return null;
  const random = mulberry32(derivedSeed(...seedParts));
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    let sum = 0;
    for (let j = 0; j < diffs.length; j += 1) {
      sum += diffs[Math.floor(random() * diffs.length)];
    }
    samples.push(sum / diffs.length);
  }
  return percentileCi95(samples);
}

function percentileCi95(sortedSamples: number[]): { low: number; high: number } {
  const samples = [...sortedSamples].sort((a, b) => a - b);
  const percentile = (p: number): number => {
    const index = Math.min(samples.length - 1, Math.max(0, Math.ceil(p * samples.length) - 1));
    return samples[index];
  };
  return { low: percentile(0.025), high: percentile(0.975) };
}

export function buildPairedDifference(input: {
  metric: string;
  baselineLabel: string;
  comparisonLabel: string;
  baselineOutcomes: readonly boolean[];
  comparisonOutcomes: readonly boolean[];
  seedParts: readonly string[];
  iterations: number;
}): KonlingFairExperimentPairedDifference | null {
  if (input.baselineOutcomes.length !== input.comparisonOutcomes.length
    || input.baselineOutcomes.length === 0) {
    return null;
  }
  const paired = input.baselineOutcomes.map((baseline, index) => ({
    baseline,
    comparison: input.comparisonOutcomes[index],
  }));
  const baseline = rateMetric(input.baselineOutcomes);
  const comparison = rateMetric(input.comparisonOutcomes);
  const ci = pairedBootstrapCi95(paired, input.seedParts, input.iterations);
  if (!ci) return null;
  return {
    metric: input.metric,
    direction: 'higher-is-better',
    baseline: { label: input.baselineLabel, metric: baseline },
    comparison: { label: input.comparisonLabel, metric: comparison },
    percentagePointDifference: (comparison.rate - baseline.rate) * 100,
    pairedCi95: { low: ci.low * 100, high: ci.high * 100 },
    pairedN: paired.length,
  };
}

/**
 * #1951：比率型配对差（百分点 + 配对 bootstrap 95% CI）。
 * 点估计与 CI 同为池化口径（Σ分子/Σ分母）：每次配对重采样内对采到的
 * 题项重新池化两臂分子分母再取差——对逐题未加权比率差取均值会在分母
 * 悬殊时给出不包含点估计甚至反号的区间（#1992 review P1）。
 */
function pairedRatioBootstrapCi95(
  pairs: ReadonlyArray<{ baseline: { numerator: number; denominator: number }; comparison: { numerator: number; denominator: number } }>,
  seedParts: readonly string[],
  iterations: number,
): { low: number; high: number } | null {
  if (pairs.length === 0) return null;
  const random = mulberry32(derivedSeed(...seedParts));
  const pooledRatio = (values: ReadonlyArray<{ numerator: number; denominator: number }>) => {
    let numerator = 0;
    let denominator = 0;
    for (const value of values) {
      numerator += value.numerator;
      denominator += value.denominator;
    }
    return denominator === 0 ? 0 : numerator / denominator;
  };
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const sampledBaseline: { numerator: number; denominator: number }[] = [];
    const sampledComparison: { numerator: number; denominator: number }[] = [];
    for (let j = 0; j < pairs.length; j += 1) {
      const pair = pairs[Math.floor(random() * pairs.length)]!;
      sampledBaseline.push(pair.baseline);
      sampledComparison.push(pair.comparison);
    }
    samples.push(pooledRatio(sampledComparison) - pooledRatio(sampledBaseline));
  }
  return percentileCi95(samples);
}

export function buildPairedRatioDifference(input: {
  metric: string;
  baselineLabel: string;
  comparisonLabel: string;
  baselinePairedRatios: ReadonlyArray<{ numerator: number; denominator: number }>;
  comparisonPairedRatios: ReadonlyArray<{ numerator: number; denominator: number }>;
  seedParts: readonly string[];
  iterations: number;
}): KonlingFairExperimentPairedRatioDifference | null {
  const paired = input.baselinePairedRatios.length;
  if (paired === 0 || paired !== input.comparisonPairedRatios.length) return null;
  const pooled = (values: ReadonlyArray<{ numerator: number; denominator: number }>) => ({
    numerator: values.reduce((sum, value) => sum + value.numerator, 0),
    denominator: values.reduce((sum, value) => sum + value.denominator, 0),
  });
  const baselinePooled = pooled(input.baselinePairedRatios);
  const comparisonPooled = pooled(input.comparisonPairedRatios);
  // 任一臂池化分母为零（如无引用功能臂的精确率恒为 0/0）时指标不可
  // 定义，不得当作 0% 参与百分点差与 CI 比较——不产出该差值
  // （#1992 review P1）。
  if (baselinePooled.denominator === 0 || comparisonPooled.denominator === 0) return null;
  const ratio = ({ numerator, denominator }: { numerator: number; denominator: number }) => (
    denominator === 0 ? 0 : numerator / denominator
  );
  const pairs = input.baselinePairedRatios.map((baseline, index) => ({
    baseline,
    comparison: input.comparisonPairedRatios[index]!,
  }));
  const ci = pairedRatioBootstrapCi95(pairs, input.seedParts, input.iterations);
  if (!ci) return null;
  return {
    metric: input.metric,
    direction: 'higher-is-better',
    baseline: { label: input.baselineLabel, metric: { ...baselinePooled, ratio: ratio(baselinePooled) } },
    comparison: { label: input.comparisonLabel, metric: { ...comparisonPooled, ratio: ratio(comparisonPooled) } },
    percentagePointDifference: (ratio(comparisonPooled) - ratio(baselinePooled)) * 100,
    pairedCi95: { low: ci.low * 100, high: ci.high * 100 },
    pairedN: paired,
  };
}
