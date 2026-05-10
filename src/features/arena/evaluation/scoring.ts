import type { MetricDefinition } from '../types';

type MetricScale = Pick<MetricDefinition, 'direction' | 'idealValue' | 'unacceptableValue'>;

export function normalizeMetricValue(metric: MetricScale, value: number): number {
  if (!Number.isFinite(value)) return 0;

  if (metric.direction === 'minimize') {
    if (value <= metric.idealValue) return 1;
    if (value >= metric.unacceptableValue) return 0;
    return (metric.unacceptableValue - value) / (metric.unacceptableValue - metric.idealValue);
  }

  if (metric.direction === 'maximize') {
    if (value >= metric.idealValue) return 1;
    if (value <= metric.unacceptableValue) return 0;
    return (value - metric.unacceptableValue) / (metric.idealValue - metric.unacceptableValue);
  }

  const tolerance = Math.abs(metric.unacceptableValue - metric.idealValue);
  if (tolerance === 0) return value === metric.idealValue ? 1 : 0;
  return Math.max(0, 1 - Math.abs(value - metric.idealValue) / tolerance);
}

export function scoreMetricSatisfaction(
  satisfaction: Record<string, number>,
  weights: Record<string, number>,
): number {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
  if (entries.length === 0) return 0;

  const totalWeight = entries.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedLogSum = entries.reduce((sum, [metricId, weight]) => {
    const value = Math.max(0.0001, Math.min(1, satisfaction[metricId] ?? 0));
    return sum + (weight / totalWeight) * Math.log(value);
  }, 0);

  return Math.round(Math.exp(weightedLogSum) * 1000) / 10;
}

export function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value * 10) / 10));
}
