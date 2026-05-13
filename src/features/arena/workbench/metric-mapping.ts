import type { LinkageAnalysisViewModel } from '@/resources/control-system/analysis/multi-representation-linkage-analysis';
import type { ArenaWorkbenchPreviewSummary } from './types';
import type { MetricProfile } from '../types';
import { normalizeMetricValue, scoreMetricSatisfaction } from '../evaluation/scoring';

export function mapLinkageResultToArenaMetrics(
  analysis: LinkageAnalysisViewModel | null,
): Record<string, number> {
  if (!analysis) return {};

  const metrics: Record<string, number> = {};

  if (analysis.timeDomain?.metrics?.overshoot !== undefined) {
    metrics.overshoot = analysis.timeDomain.metrics.overshoot;
  }
  if (analysis.timeDomain?.metrics?.settlingTime !== undefined) {
    metrics.settlingTime = analysis.timeDomain.metrics.settlingTime;
  }
  if (analysis.timeDomain?.metrics?.steadyStateError !== undefined) {
    metrics.steadyStateError = analysis.timeDomain.metrics.steadyStateError;
  }
  if (analysis.stability?.stabilityMargins?.phaseMargin?.value !== undefined) {
    metrics.phaseMargin = analysis.stability.stabilityMargins.phaseMargin.value;
  }
  if (analysis.stability?.stabilityMargins?.gainMargin?.value !== undefined) {
    metrics.gainMargin = analysis.stability.stabilityMargins.gainMargin.value;
  }

  return metrics;
}

export function buildArenaWorkbenchPreviewSummary(
  analysis: LinkageAnalysisViewModel | null,
  metricProfile: MetricProfile,
): ArenaWorkbenchPreviewSummary {
  const rawMetrics = mapLinkageResultToArenaMetrics(analysis);

  const metrics = metricProfile.rankingMetrics.map((def) => {
    const value = rawMetrics[def.id] ?? null;
    let satisfaction: number | null = null;
    let status: 'pass' | 'warning' | 'fail' | 'unknown' = 'unknown';

    if (value !== null) {
      satisfaction = normalizeMetricValue(def, value);
      if (satisfaction >= 0.7) status = 'pass';
      else if (satisfaction >= 0.3) status = 'warning';
      else status = 'fail';
    }

    return { id: def.id, label: def.label, value, unit: def.unit, satisfaction, status };
  });

  const hasAnyMissing = metrics.some((m) => m.satisfaction === null);
  if (hasAnyMissing) {
    return { metrics, previewScore: null, missingOfficialOnlyMetrics };
  }

  const previewScore = scoreMetricSatisfaction(
    Object.fromEntries(metrics.map((m) => [m.id, m.satisfaction!])),
    Object.fromEntries(metrics.map((m) => [m.id, 1])),
  );

  const missingOfficialOnlyMetrics = metricProfile.diagnosticMetrics.filter(
    (id) => rawMetrics[id] === undefined,
  );

  return { metrics, previewScore, missingOfficialOnlyMetrics };
}
