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
  samples.sort((a, b) => a - b);
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
 * 绝对值用池化比率（Σ分子/Σ分母）；配对单位是题项级比率，差值数组
 * 进入与布尔版同一确定性 bootstrap 内核。
 */
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
  const ratio = ({ numerator, denominator }: { numerator: number; denominator: number }) => (
    denominator === 0 ? 0 : numerator / denominator
  );
  const diffs = input.baselinePairedRatios.map((baseline, index) => (
    ratio(input.comparisonPairedRatios[index]!) - ratio(baseline)
  ));
  const ci = bootstrapCi95ForDiffs(diffs, input.seedParts, input.iterations);
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
