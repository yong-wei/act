export type GovernanceQueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
};

export type GovernanceStatusPayload = {
  status: string;
  timestamp: string;
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
  recentRiskFlags: Array<{
    id: string;
    userId: string;
    userName: string;
    flagType: string;
    severity: string;
    description: string;
    triggeredAt: string;
    isResolved: boolean;
  }>;
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

export function buildGovernanceOverview(payload: GovernanceStatusPayload) {
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

  const queueCards: QueueCard[] = Object.entries(payload.queues).map(([key, stats]) => ({
    title: QUEUE_LABELS[key as keyof GovernanceStatusPayload['queues']],
    waiting: stats.waiting,
    active: stats.active,
    completed: stats.completed,
    failed: stats.failed,
  }));

  const riskRows: RiskRow[] = payload.recentRiskFlags.map((risk) => ({
    ...risk,
    severityLabel: RISK_SEVERITY_LABELS[risk.severity] || risk.severity,
    flagLabel: RISK_TYPE_LABELS[risk.flagType] || risk.flagType,
  }));

  return {
    summaryCards,
    queueCards,
    factPanel: {
      title: '事实类型分布',
      items: payload.factTypeDistribution,
    },
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
