import { createHash } from 'node:crypto';

import type {
  KonlingFairExperimentPairedDifference,
  KonlingFairExperimentRateMetric,
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

function derivedSeed(...parts: string[]): number {
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
