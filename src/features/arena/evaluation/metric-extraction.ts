import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';

export type ArenaMetricSource =
  | 'control-analysis'
  | 'derived-from-response'
  | 'derived-from-controller'
  | 'scenario-evaluation'
  | 'blackbox-official'
  | 'unavailable';

export interface MetricField {
  value: number | null;
  source: ArenaMetricSource;
}

export interface ExtractedMetrics {
  closedLoopStable: boolean;
  overshoot: MetricField;
  settlingTime: MetricField;
  steadyStateError: MetricField;
  itae: MetricField;
  phaseMargin: MetricField;
  gainMargin: MetricField;
  bandwidth: MetricField;
  controlEnergy: MetricField;
}

export function extractMetricsFromAnalysisResult(
  result: ControlAnalysisResult,
): ExtractedMetrics {
  const metrics = result.metrics;
  const currentPoles = result.rootLocus.currentPoles ?? [];
  const closedLoopStable = currentPoles.length > 0
    ? !currentPoles.some((pole) => pole.re > 0)
    : false;

  const controlEnergy = deriveControlEnergy(result);
  const itae = computeITAE(result);

  return {
    closedLoopStable,
    overshoot: { value: metrics.overshootPct ?? null, source: 'control-analysis' },
    settlingTime: {
      value: closedLoopStable ? (metrics.settlingTimeSec ?? null) : null,
      source: 'control-analysis',
    },
    steadyStateError: {
      value: Number.isFinite(metrics.finalValue)
        ? Math.abs(1 - metrics.finalValue)
        : null,
      source: 'derived-from-response',
    },
    itae: { value: itae, source: 'derived-from-response' },
    phaseMargin: { value: metrics.phaseMarginDeg ?? null, source: 'control-analysis' },
    gainMargin: { value: metrics.gainMarginDb ?? null, source: 'control-analysis' },
    bandwidth: { value: metrics.bandwidthRadPerSec ?? null, source: 'control-analysis' },
    controlEnergy: { value: controlEnergy, source: 'derived-from-response' },
  };
}

function computeITAE(result: ControlAnalysisResult): number | null {
  const points = result.stepResponse?.points;
  if (!points || points.length < 2) return null;

  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    const t = points[i].x;
    const error = Math.abs(1 - points[i].y);
    const dt = points[i].x - points[i - 1].x;
    if (dt <= 0) continue;
    sum += t * error * dt;
  }

  return Number.isFinite(sum) ? sum : null;
}

function deriveControlEnergy(result: ControlAnalysisResult): number | null {
  const points = result.stepResponse?.points;
  if (!points || points.length < 2) return null;

  let energy = 0;
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].x - points[i - 1].x;
    if (dt <= 0) continue;
    energy += 0.5 * (Math.abs(points[i].y - points[i - 1].y) / dt) * dt;
  }

  return Number.isFinite(energy) ? energy : null;
}
