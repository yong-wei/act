import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import type { DataCenterSourceQuality } from './data-center-contracts';

export type DataCenterExportStatus =
  | 'preparing'
  | 'ready'
  | 'downloaded'
  | 'failed'
  | 'retry';

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
  status: Extract<DataCenterExportStatus, 'ready'>;
  metrics: SnapshotMetric[];
  sourceQualitySummary: DataCenterSourceQuality[];
  sourceTableFamilies: string[];
  sourceWindow: {
    label: string;
    from: string;
    to: string;
  };
  requesterRole: PlatformRole;
  sourceQuality: DataCenterSourceQuality;
  redactionPolicy: {
    scope: 'aggregate-only';
    excludedFamilies: string[];
    directIdentifierPolicy: 'removed';
    privateEvidencePolicy: 'removed';
    authorizationScope: 'none';
  };
}

interface SafeSnapshotMetadata {
  exportedAt?: string;
  requesterRole?: PlatformRole;
  sourceTableFamilies?: string[];
  sourceWindow?: SafeSnapshot['sourceWindow'];
  sourceQuality?: DataCenterSourceQuality;
}

export function sanitizeSnapshotMetrics(metrics: SnapshotMetric[]): SnapshotMetric[] {
  return metrics.map((metric) => ({
    label: metric.label,
    value: metric.value,
    sourceQuality: metric.sourceQuality,
  }));
}

export function buildExportSafeSnapshot(
  metrics: SnapshotMetric[],
  metadata: SafeSnapshotMetadata = {},
): SafeSnapshot {
  const sanitized = sanitizeSnapshotMetrics(metrics);
  const sourceQualities = Array.from(new Set(sanitized.map((m) => m.sourceQuality)));
  const sourceQuality = metadata.sourceQuality ?? sourceQualities[0] ?? 'demo';

  return {
    exportedAt: metadata.exportedAt ?? new Date().toISOString(),
    status: 'ready',
    metrics: sanitized,
    sourceQualitySummary: sourceQualities,
    sourceTableFamilies: metadata.sourceTableFamilies ?? [
      'TeachingResource',
      'LessonPlan',
      'ClassSession',
      'StudentProgressAggregate',
      'SimulationActivityAggregate',
    ],
    sourceWindow: metadata.sourceWindow ?? {
      label: '当前聚合快照',
      from: 'semester-start',
      to: 'latest-sync',
    },
    requesterRole: metadata.requesterRole ?? 'teacher',
    sourceQuality,
    redactionPolicy: {
      scope: 'aggregate-only',
      excludedFamilies: [
        'rawLearningFacts',
        'competencySnapshots',
        'riskFlags',
        'classSnapshots',
        'directStudentIds',
        'privateEvidenceBodies',
      ],
      directIdentifierPolicy: 'removed',
      privateEvidencePolicy: 'removed',
      authorizationScope: 'none',
    },
  };
}

export type { SnapshotMetric, SafeSnapshot, SafeSnapshotMetadata };
