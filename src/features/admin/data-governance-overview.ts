import type { AdminOperationLedgerEntry } from '@/lib/admin-operation-ledger';
import type { SarDiagnosticsReport } from '@/lib/data-governance/sar-diagnostics';
import type {
  GovernanceActionAuditRecord,
  GovernanceRiskDispositionStatus,
} from '@/features/admin/admin-governance-action-contract';

export type GovernanceQueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
};

export type GovernanceStatusPayload = {
  status: string;
  timestamp: string;
  operationLedger?: AdminOperationLedgerEntry;
  authoringContext?: {
    surface: 'authoring';
    lessonPlanId: string | null;
    lessonPlanMissing: boolean;
    requestedTab: string | null;
    reportHref: string;
    recoveryHref: string;
  } | null;
  graphCenterAudit?: {
    graphNodeId: string;
    audit: string | null;
    preferredTab: 'sources' | 'cache' | 'overview';
  } | null;
  sarDiagnostics?: SarDiagnosticsReport;
  freshness: {
    lastSnapshotMinutes: number | null;
    status: string;
  };
  data: {
    studentSnapshots: number;
    classSnapshots: number;
    learningFacts: number;
    activeRiskFlags: number;
    bufferedEvents: number;
  };
  queues: {
    eventIngestion: GovernanceQueueStats;
    studentSnapshot: GovernanceQueueStats;
    classSnapshot: GovernanceQueueStats;
  };
  factTypeDistribution: Array<{
    label: string;
    count: number;
  }>;
  sessionQuality?: {
    recentSessions: number;
    green: number;
    yellow: number;
    red: number;
    unknown: number;
    latestReports?: Array<{
      sessionId: string;
      lessonKey: string | null;
      reportStatus: string;
      summary: string | null;
      updatedAt: string;
      qualityStatus: 'green' | 'yellow' | 'red' | 'unknown';
      qualityReasons: string[];
    }>;
  };
  featureCache?: {
    payloadVersion: string;
    totalEntries: number;
    staleEntries: number;
    latestRefreshAt: string | null;
    totalSourceFacts: number;
    totalRebuilds: number;
    coverage: Record<string, Partial<Record<string, number>>>;
  };
  sourceCoverage?: {
    generatedAt: string;
    catalogVersion: string;
    totals: {
      totalRows: number;
      eligibleRows: number;
      excludedRows: number;
      unsupportedRows: number;
      affectedUsers: number;
    };
    sources: unknown[];
    exclusions: Array<{
      sourceId: string;
      reason: string;
      rowCount: number;
      affectedUsers: number;
      sampleSourceReference: string | null;
    }>;
  };
  sourceCatalog?: {
    totalSources: number;
    coverageCommand: string;
    sources: Array<{
      id: string;
      learningScope: string;
      valueLevel: string;
      eligibility: string;
      materializationReadiness: string;
      totalRows?: number;
      eligibleRows?: number;
      excludedRows?: number;
      unsupportedRows?: number;
      affectedUsers?: number;
      provenanceCounts?: Record<string, number>;
      exclusionReasons?: string[];
    }>;
  };
  recentRiskFlags: Array<{
    id: string;
    userId: string;
    userName: string;
    flagType: string;
    severity: string;
    description: string;
    triggeredAt: string;
    isResolved: boolean;
    resolvedAt?: string | null;
    resolutionNote?: string | null;
    safeLabel?: string;
    affectedObjectLabel?: string;
    evidenceHref?: string;
    currentAssignee?: string | null;
    dispositionStatus?: GovernanceRiskDispositionStatus;
    undoAvailable?: boolean;
    auditTrail?: GovernanceActionAuditRecord[];
  }>;
  targetRiskFlag?: {
    id: string;
    userId: string;
    userName: string;
    flagType: string;
    severity: string;
    description: string;
    triggeredAt: string;
    isResolved: boolean;
    resolvedAt?: string | null;
    resolutionNote?: string | null;
    safeLabel?: string;
    affectedObjectLabel?: string;
    evidenceHref?: string;
    currentAssignee?: string | null;
    dispositionStatus?: GovernanceRiskDispositionStatus;
    undoAvailable?: boolean;
    auditTrail?: GovernanceActionAuditRecord[];
  } | null;
  recentSnapshots: Array<{
    userId: string;
    userName: string;
    snapshotAt: string;
    factCount: number;
  }>;
  topSnapshotStudents: Array<{
    userId: string;
    userName: string;
    snapshotAt: string;
    factCount: number;
  }>;
};

type SummaryCard = {
  title: string;
  value: string;
  detail: string;
  tone: 'default' | 'danger' | 'success';
};

type QueueCard = {
  title: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
};

type GovernanceTab = {
  id: 'overview' | 'risks' | 'sessions' | 'sources' | 'cache';
  label: string;
};

type RiskRow = GovernanceStatusPayload['recentRiskFlags'][number] & {
  severityLabel: string;
  flagLabel: string;
};

const QUEUE_LABELS: Record<keyof GovernanceStatusPayload['queues'], string> = {
  eventIngestion: '事件入池队列',
  studentSnapshot: '学生快照队列',
  classSnapshot: '班级快照队列',
};

const RISK_TYPE_LABELS: Record<string, string> = {
  participation: '参与度不足',
  stagnation: '能力停滞',
  ai_misuse: 'AI 依赖风险',
  constraint: '约束违规',
  cross_domain: '跨域迁移薄弱',
};

const RISK_SEVERITY_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
};

function formatStatusLabel(status: string) {
  return status === 'healthy' ? '运行正常' : '存在异常';
}

function formatFreshness(minutes: number | null) {
  if (minutes === null) {
    return '暂无快照';
  }
  return `${minutes} 分钟前`;
}

function buildSessionQualityCard(payload: GovernanceStatusPayload): SummaryCard | null {
  const quality = payload.sessionQuality;
  if (!quality) return null;
  return {
    title: '课堂质量',
    value: `${quality.green}/${quality.recentSessions}`,
    detail: `黄 ${quality.yellow} · 红 ${quality.red} · 未识别 ${quality.unknown}`,
    tone: quality.red > 0 || quality.unknown > 0
      ? 'danger'
      : quality.yellow > 0
        ? 'default'
        : 'success',
  };
}

export function buildGovernanceOverview(payload: GovernanceStatusPayload) {
  const tabs: GovernanceTab[] = [
    { id: 'overview', label: '总览' },
    { id: 'risks', label: '风险治理' },
    { id: 'sessions', label: '课堂质量' },
    { id: 'sources', label: '证据源' },
    { id: 'cache', label: '缓存健康' },
  ];
  const summaryCards: SummaryCard[] = [
    {
      title: '系统状态',
      value: formatStatusLabel(payload.status),
      detail: `状态上报时间 ${new Date(payload.timestamp).toLocaleString('zh-CN')}`,
      tone: payload.status === 'healthy' ? 'success' : 'danger',
    },
    {
      title: '数据新鲜度',
      value: formatFreshness(payload.freshness.lastSnapshotMinutes),
      detail: payload.freshness.status === 'fresh' ? '快照链路正常推进' : '快照链路需要关注',
      tone: payload.freshness.status === 'fresh' ? 'success' : 'danger',
    },
    {
      title: '学习事实总量',
      value: payload.data.learningFacts.toLocaleString(),
      detail: `缓冲事件 ${payload.data.bufferedEvents.toLocaleString()} 条`,
      tone: 'default',
    },
    {
      title: '待处理风险',
      value: payload.data.activeRiskFlags.toLocaleString(),
      detail: `学生快照 ${payload.data.studentSnapshots.toLocaleString()} · 班级快照 ${payload.data.classSnapshots.toLocaleString()}`,
      tone: payload.data.activeRiskFlags > 0 ? 'danger' : 'success',
    },
  ];
  const sessionQualityCard = buildSessionQualityCard(payload);
  if (sessionQualityCard) {
    summaryCards.push(sessionQualityCard);
  }

  const queueCards: QueueCard[] = Object.entries(payload.queues).map(([key, stats]) => ({
    title: QUEUE_LABELS[key as keyof GovernanceStatusPayload['queues']],
    waiting: stats.waiting,
    active: stats.active,
    completed: stats.completed,
    failed: stats.failed,
  }));

  const riskSourceRows = payload.targetRiskFlag
    ? [payload.targetRiskFlag, ...payload.recentRiskFlags.filter((risk) => risk.id !== payload.targetRiskFlag?.id)]
    : payload.recentRiskFlags;
  const riskRows: RiskRow[] = riskSourceRows.map((risk) => ({
    ...risk,
    severityLabel: RISK_SEVERITY_LABELS[risk.severity] || risk.severity,
    flagLabel: RISK_TYPE_LABELS[risk.flagType] || risk.flagType,
  }));

  return {
    tabs,
    summaryCards,
    queueCards,
    factPanel: {
      title: '事实类型分布',
      items: payload.factTypeDistribution,
    },
    sourceCatalogPanel: payload.sourceCatalog
      ? {
          title: '证据源目录',
          totalSources: payload.sourceCatalog.totalSources,
          coverageCommand: payload.sourceCatalog.coverageCommand,
          eligibleSources: payload.sourceCatalog.sources.filter((source) => source.eligibility === 'eligible').length,
          unsupportedSources: payload.sourceCatalog.sources.filter((source) => source.eligibility === 'unsupported').length,
          readySources: payload.sourceCatalog.sources.filter((source) => source.materializationReadiness === 'ready').length,
          sources: payload.sourceCatalog.sources,
        }
      : null,
    sourceCoveragePanel: payload.sourceCoverage
      ? {
          title: '证据源覆盖',
          generatedAt: payload.sourceCoverage.generatedAt,
          catalogVersion: payload.sourceCoverage.catalogVersion,
          totals: payload.sourceCoverage.totals,
          exclusions: payload.sourceCoverage.exclusions,
        }
      : null,
    sessionQualityPanel: payload.sessionQuality
      ? {
          title: '课堂质量分布',
          summary: {
            recentSessions: payload.sessionQuality.recentSessions,
            green: payload.sessionQuality.green,
            yellow: payload.sessionQuality.yellow,
            red: payload.sessionQuality.red,
            unknown: payload.sessionQuality.unknown,
          },
          rows: payload.sessionQuality.latestReports ?? [],
        }
      : null,
    cachePanel: payload.featureCache
      ? {
          title: '特征缓存健康',
          ...payload.featureCache,
        }
      : null,
    riskPanel: {
      title: '最新风险清单',
      rows: riskRows,
    },
    snapshotPanel: {
      title: '最新快照明细',
      rows: payload.recentSnapshots,
      highlights: payload.topSnapshotStudents,
    },
  };
}
