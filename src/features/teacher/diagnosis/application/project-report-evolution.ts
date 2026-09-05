import { diagnosisClassMetricDataSchema, type DiagnosisClassMetricData } from '@/lib/diagnosis-metrics';

import type { DiagnosisEvolutionApiItem } from '../public-api';

/**
 * 班级诊断报告演变板块投影（Issue #1963）。
 *
 * 纯函数：只消费已冻结的指标快照，不做任何重算；相邻快照仅在报告范围、
 * 成员集合身份、证据覆盖口径、指标 schema 版本与计算版本一致时连成趋
 * 势，否则断开并给出原因。差值与趋势不携带改善/恶化判断。
 */
export type EvolutionBreakReason =
  | 'scope-changed'
  | 'member-set-changed'
  | 'coverage-basis-changed'
  | 'schema-version-changed'
  | 'computation-version-changed'
  | 'snapshot-unavailable';

const BREAK_REASON_LABELS: Record<EvolutionBreakReason, string> = {
  'scope-changed': '报告范围发生变化，趋势在此断开',
  'member-set-changed': '班级成员集合发生变化，趋势在此断开',
  'coverage-basis-changed': '证据覆盖口径发生变化，趋势在此断开',
  'schema-version-changed': '指标结构版本变化，趋势在此断开',
  'computation-version-changed': '指标计算版本变化，趋势在此断开',
  'snapshot-unavailable': '历史报告无指标快照，趋势在此断开',
};

export interface MetricEvolutionBreak {
  olderReportId: string;
  newerReportId: string;
  reason: EvolutionBreakReason;
  reasonLabel: string;
}

export interface MetricEvolutionPoint {
  reportId: string;
  generatedAt: string;
  value: number | null;
  /** 与时间上相邻的上一个点可比且两侧均有值；首点与断连处为 false。 */
  connectedToPrevious: boolean;
}

export interface MetricEvolutionSeries {
  key: string;
  label: string;
  unit: 'score' | 'count';
  points: MetricEvolutionPoint[];
}

export interface DiagnosisEvolutionKeyDelta {
  key: string;
  label: string;
  previousValue: number;
  currentValue: number;
  deltaDisplay: string;
}

export interface DiagnosisEvolutionSnapshotDetail {
  reportId: string;
  generatedAt: string;
  evidenceCutoff: string;
  memberCount: number | null;
  schemaVersion: string | null;
  computationVersion: string | null;
  historicalUnavailable: boolean;
}

export interface DiagnosisEvolutionBoardModel {
  /** 时间从旧到新。 */
  snapshots: DiagnosisEvolutionSnapshotDetail[];
  series: MetricEvolutionSeries[];
  deltas: DiagnosisEvolutionKeyDelta[];
  breaks: MetricEvolutionBreak[];
  latestReportId: string | null;
  previousComparableReportId: string | null;
}

interface TimelineEntry {
  report: DiagnosisEvolutionApiItem;
  metrics: DiagnosisClassMetricData | null;
}

function parseTimeline(reports: DiagnosisEvolutionApiItem[]): TimelineEntry[] {
  // 输入为最新在前；时间轴统一翻转为从旧到新。
  return [...reports].reverse().map((report) => {
    const parsed = report.metricSnapshot
      ? diagnosisClassMetricDataSchema.safeParse(report.metricSnapshot.metrics)
      : null;
    return { report, metrics: parsed?.success ? parsed.data : null };
  });
}

function snapshotIdentity(entry: TimelineEntry) {
  if (!entry.report.metricSnapshot || !entry.metrics) return null;
  return {
    scopeType: entry.report.metricSnapshot.scopeType,
    scopeId: entry.report.metricSnapshot.scopeId,
    memberSetFingerprint: entry.report.metricSnapshot.memberSetFingerprint,
    coverageBasis: entry.metrics.coverageBasis,
    schemaVersion: entry.report.metricSnapshot.schemaVersion,
    computationVersion: entry.report.metricSnapshot.computationVersion,
  };
}

/** 相邻对的断连原因；两侧均有效且五元组一致时返回 null（可连）。 */
function breakReasonBetween(older: TimelineEntry, newer: TimelineEntry): MetricEvolutionBreak | null {
  const olderIdentity = snapshotIdentity(older);
  const newerIdentity = snapshotIdentity(newer);
  if (!olderIdentity || !newerIdentity) {
    if (olderIdentity === newerIdentity) return null;
    return {
      olderReportId: older.report.id,
      newerReportId: newer.report.id,
      reason: 'snapshot-unavailable',
      reasonLabel: BREAK_REASON_LABELS['snapshot-unavailable'],
    };
  }
  let reason: EvolutionBreakReason | null = null;
  if (olderIdentity.scopeType !== newerIdentity.scopeType || olderIdentity.scopeId !== newerIdentity.scopeId) {
    reason = 'scope-changed';
  } else if (olderIdentity.memberSetFingerprint !== newerIdentity.memberSetFingerprint) {
    reason = 'member-set-changed';
  } else if (olderIdentity.coverageBasis !== newerIdentity.coverageBasis) {
    reason = 'coverage-basis-changed';
  } else if (olderIdentity.schemaVersion !== newerIdentity.schemaVersion) {
    reason = 'schema-version-changed';
  } else if (olderIdentity.computationVersion !== newerIdentity.computationVersion) {
    reason = 'computation-version-changed';
  }
  if (!reason) return null;
  return {
    olderReportId: older.report.id,
    newerReportId: newer.report.id,
    reason,
    reasonLabel: BREAK_REASON_LABELS[reason],
  };
}

interface SeriesDefinition {
  key: string;
  label: string;
  unit: 'score' | 'count';
  read: (metrics: DiagnosisClassMetricData) => number | null;
}

function buildSeriesDefinitions(timeline: TimelineEntry[]): SeriesDefinition[] {
  const definitions: SeriesDefinition[] = [];
  const dimensionLabels = new Map<string, string>();
  for (const entry of timeline) {
    for (const dimension of entry.metrics?.abilityDimensions ?? []) {
      if (!dimensionLabels.has(dimension.id)) dimensionLabels.set(dimension.id, dimension.label);
    }
  }
  for (const [dimensionId, label] of dimensionLabels) {
    definitions.push({
      key: `ability:${dimensionId}`,
      label,
      unit: 'score',
      read: (metrics) => metrics.abilityDimensions.find((dimension) => dimension.id === dimensionId)?.mean ?? null,
    });
  }
  definitions.push(
    {
      key: 'assignment-mean',
      label: '作业成绩均值',
      unit: 'score',
      read: (metrics) => metrics.assignmentOutcomes.mean,
    },
    {
      key: 'assessment-mean',
      label: '测评成绩均值',
      unit: 'score',
      read: (metrics) => metrics.assessmentOutcomes.mean,
    },
    {
      key: 'risk-flagged-students',
      label: '风险学生人数',
      unit: 'count',
      read: (metrics) => (metrics.riskDistribution.availability === 'available'
        ? metrics.riskDistribution.flaggedStudents
        : null),
    },
  );
  const weakNodeIds = new Set<string>();
  for (const entry of timeline) {
    for (const weakPoint of entry.metrics?.weakKnowledgePoints ?? []) {
      weakNodeIds.add(weakPoint.nodeId);
    }
  }
  for (const nodeId of [...weakNodeIds].sort()) {
    definitions.push({
      key: `weak:${nodeId}`,
      label: `薄弱点 ${nodeId} 弱势人数`,
      unit: 'count',
      read: (metrics) => metrics.weakKnowledgePoints.find((point) => point.nodeId === nodeId)
        ?.weakStudentCount ?? null,
    });
  }
  return definitions;
}

function formatDelta(delta: number): string {
  const fixed = Math.abs(delta).toFixed(2).replace(/\.?0+$/, '');
  return `${delta >= 0 ? '+' : '-'}${fixed}`;
}

export function projectDiagnosisMetricEvolution(reports: DiagnosisEvolutionApiItem[]): DiagnosisEvolutionBoardModel {
  const timeline = parseTimeline(reports);
  const breaks: MetricEvolutionBreak[] = [];
  const comparableWithPrevious: boolean[] = timeline.map((_, index) => {
    if (index === 0) return false;
    const pairBreak = breakReasonBetween(timeline[index - 1], timeline[index]);
    if (pairBreak) {
      breaks.push(pairBreak);
      return false;
    }
    return true;
  });

  const snapshots = timeline.map((entry) => ({
    reportId: entry.report.id,
    generatedAt: entry.report.generatedAt,
    evidenceCutoff: entry.report.evidenceCutoff,
    memberCount: entry.metrics?.memberCount ?? null,
    schemaVersion: entry.report.metricSnapshot?.schemaVersion ?? null,
    computationVersion: entry.report.metricSnapshot?.computationVersion ?? null,
    historicalUnavailable: !entry.metrics,
  }));

  const series = buildSeriesDefinitions(timeline)
    .map((definition) => ({
      key: definition.key,
      label: definition.label,
      unit: definition.unit,
      points: timeline.map((entry, index) => ({
        reportId: entry.report.id,
        generatedAt: entry.report.generatedAt,
        value: entry.metrics ? definition.read(entry.metrics) : null,
        connectedToPrevious: comparableWithPrevious[index]
          && entry.metrics !== null
          && timeline[index - 1].metrics !== null
          && definition.read(timeline[index - 1].metrics!) !== null
          && definition.read(entry.metrics) !== null,
      })),
    }))
    .filter((series) => series.points.some((point) => point.value !== null));

  const deltas: DiagnosisEvolutionKeyDelta[] = [];
  const lastIndex = timeline.length - 1;
  if (lastIndex >= 1 && comparableWithPrevious[lastIndex]) {
    const latest = timeline[lastIndex];
    const previous = timeline[lastIndex - 1];
    for (const definition of buildSeriesDefinitions(timeline)) {
      const previousValue = previous.metrics ? definition.read(previous.metrics) : null;
      const currentValue = latest.metrics ? definition.read(latest.metrics) : null;
      if (previousValue === null || currentValue === null) continue;
      deltas.push({
        key: definition.key,
        label: definition.label,
        previousValue,
        currentValue,
        deltaDisplay: formatDelta(currentValue - previousValue),
      });
    }
  }

  return {
    snapshots,
    series,
    deltas,
    breaks,
    latestReportId: timeline.length > 0 ? timeline[timeline.length - 1].report.id : null,
    previousComparableReportId: lastIndex >= 1 && comparableWithPrevious[lastIndex]
      ? timeline[lastIndex - 1].report.id
      : null,
  };
}
