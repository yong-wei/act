import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import type { DataCenterSourceQuality } from './data-center-contracts';

interface SnapshotMetric {
  label: string;
  value: string | number;
  sourceQuality: DataCenterSourceQuality;
  rawEvidence?: unknown;
  rawTraces?: unknown;
  hiddenEvaluation?: unknown;
  rawAnswers?: unknown;
  privateMemory?: unknown;
}

interface SafeSnapshot {
  exportedAt: string;
  metrics: SnapshotMetric[];
  sourceQualitySummary: DataCenterSourceQuality[];
}

export function sanitizeSnapshotMetrics(metrics: SnapshotMetric[]): SnapshotMetric[] {
  return metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    sourceQuality: metric.sourceQuality,
  }));
}

export function buildExportSafeSnapshot(metrics: SnapshotMetric[]): SafeSnapshot {
  const sanitized = sanitizeSnapshotMetrics(metrics);
  const sourceQualities = Array.from(new Set(sanitized.map((m) => m.sourceQuality)));

  return {
    exportedAt: new Date().toISOString(),
    metrics: sanitized,
    sourceQualitySummary: sourceQualities,
  };
}

export type { SnapshotMetric, SafeSnapshot };
