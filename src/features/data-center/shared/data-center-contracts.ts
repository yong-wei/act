import type { PlatformRole } from '@/components/platform/platform-ui-contracts';

export type DataCenterSourceQuality =
  | 'demo'
  | 'real'
  | 'partial'
  | 'stale'
  | 'restricted';

export type DataCenterMode = 'presentation' | 'governance';

export type DataCenterMetricRegion =
  | 'headline-metrics'
  | 'module-activity'
  | 'learning-trajectory'
  | 'simulation-activity'
  | 'classroom-activity'
  | 'demo-snapshots';

export type DataCenterGovernanceRegion =
  | 'source-coverage'
  | 'readiness'
  | 'stale-data'
  | 'missing-context'
  | 'privacy-scope'
  | 'unsupported-states';

export type DataCenterDrilldownTarget =
  | 'admin-governance'
  | 'teacher-governance'
  | 'evidence-browser';

export interface DataCenterSourceMarker {
  quality: DataCenterSourceQuality;
  label: string;
  summary: string;
}

export interface DataCenterChartPanel {
  id: string;
  title: string;
  subtitle?: string;
  source: DataCenterSourceMarker;
  region: DataCenterMetricRegion | DataCenterGovernanceRegion;
  mode: DataCenterMode;
  exportSafe?: boolean;
}

export interface DataCenterDrilldownLink {
  id: string;
  label: string;
  href: string;
  target: DataCenterDrilldownTarget;
  allowedRoles: PlatformRole[];
  restricted?: boolean;
  restrictedReason?: string;
}

export interface DataCenterDateRange {
  from: Date;
  to: Date;
}

export interface DataCenterFilter {
  regions?: (DataCenterMetricRegion | DataCenterGovernanceRegion)[];
  sourceQualities?: DataCenterSourceQuality[];
  dateRange?: DataCenterDateRange;
  searchQuery?: string;
}

export interface ExportSafeSnapshotOptions {
  stripRawEvidence: boolean;
  stripRawTraces: boolean;
  stripHiddenEvaluation: boolean;
  stripRawAnswers: boolean;
  stripPrivateMemory: boolean;
}

export const SOURCE_QUALITY_MARKERS: Record<DataCenterSourceQuality, DataCenterSourceMarker> = {
  demo: {
    quality: 'demo',
    label: '演示数据',
    summary: '基于演示场景生成的示例数据，不代表真实使用情况',
  },
  real: {
    quality: 'real',
    label: '真实数据',
    summary: '来自真实学习活动的正式数据',
  },
  partial: {
    quality: 'partial',
    label: '部分覆盖',
    summary: '数据仅覆盖部分学生或部分时间段',
  },
  stale: {
    quality: 'stale',
    label: '数据过期',
    summary: '最后一次更新距今超过设定阈值',
  },
  restricted: {
    quality: 'restricted',
    label: '受限来源',
    summary: '数据受隐私策略限制，仅展示聚合视图',
  },
};

export const PRESENTATION_METRIC_REGIONS: DataCenterMetricRegion[] = [
  'headline-metrics',
  'module-activity',
  'learning-trajectory',
  'simulation-activity',
  'classroom-activity',
  'demo-snapshots',
];

export const GOVERNANCE_REGIONS: DataCenterGovernanceRegion[] = [
  'source-coverage',
  'readiness',
  'stale-data',
  'missing-context',
  'privacy-scope',
  'unsupported-states',
];

export const DEFAULT_EXPORT_SNAPSHOT_OPTIONS: ExportSafeSnapshotOptions = {
  stripRawEvidence: true,
  stripRawTraces: true,
  stripHiddenEvaluation: true,
  stripRawAnswers: true,
  stripPrivateMemory: true,
};
