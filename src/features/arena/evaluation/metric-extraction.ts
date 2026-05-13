import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';

export interface ExtractedMetrics {
  closedLoopStable: boolean;
  overshoot: number | null;
  settlingTime: number | null;
  steadyStateError: number | null;
  itae: number | null;
  phaseMargin: number | null;
  gainMargin: number | null;
  bandwidth: number | null;
  controlEnergy: number | null;
  controlEnergyDerived: boolean;
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
  const controlEnergyDerived = true;

  return {
    closedLoopStable,
    overshoot: metrics.overshootPct ?? null,
    settlingTime: closedLoopStable ? (metrics.settlingTimeSec ?? null) : null,
    steadyStateError: Number.isFinite(metrics.finalValue)
      ? Math.abs(1 - metrics.finalValue)
      : null,
    itae: null,
    phaseMargin: metrics.phaseMarginDeg ?? null,
    gainMargin: metrics.gainMarginDb ?? null,
    bandwidth: metrics.bandwidthRadPerSec ?? null,
    controlEnergy,
    controlEnergyDerived,
  };
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
