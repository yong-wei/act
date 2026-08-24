'use client';

import { AlertTriangle, Database, ShieldCheck, Target } from 'lucide-react';
import type { AiWorkshopEvidenceProjection } from '../ai-workshop-evidence';

function formatWorkshopMetric(
  status: AiWorkshopEvidenceProjection['status'],
  value: string,
): string {
  if (status === 'unavailable') return '不可用';
  if (status === 'empty') return '暂无';
  return value;
}

interface LearningDashboardProps {
  evidence: AiWorkshopEvidenceProjection;
  userName: string;
}

export function LearningDashboard({ evidence, userName }: LearningDashboardProps) {
  const statusLabel = evidence.status === 'available'
    ? '已连接受治理学习证据'
    : evidence.status === 'empty'
      ? '暂无已验证学习记录'
      : '学习证据暂不可用';
  const statusClass = 'bg-muted text-foreground';

  return (
    <div className="border-b border-border bg-card px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
            {userName.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-medium">{userName}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{statusLabel}</span>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">AI 工坊只展示服务端确认的学习证据。</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <EvidenceMetric metricKey="evidence-count" icon={Database} label="已验证证据" value={formatWorkshopMetric(evidence.status, `${evidence.evidence.count}`)} />
          <EvidenceMetric metricKey="confidence" icon={ShieldCheck} label="置信度" value={evidence.status === 'unavailable' ? '不可用' : confidenceLabel(evidence.evidence.confidence.level)} />
          <EvidenceMetric metricKey="source-completeness" icon={Target} label="来源完整度" value={formatWorkshopMetric(evidence.status, `${Math.round(evidence.evidence.confidence.sourceCompleteness * 100)}%`)} />
          <EvidenceMetric metricKey="path-count" icon={Target} label="学习路径" value={formatWorkshopMetric(evidence.status, `${evidence.path.activeCount} 条`)} />
        </div>
      </div>

      {evidence.limitations.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded border border-border bg-muted px-3 py-2 text-sm text-foreground" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <ul className="space-y-1">
            {evidence.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceMetric({
  metricKey,
  icon: Icon,
  label,
  value,
}: {
  metricKey: string;
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[92px] rounded border border-border bg-background px-3 py-2" data-ai-workshop-metric={metricKey}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {label}
      </div>
      <div className="mt-1 text-base font-medium text-foreground">{value}</div>
    </div>
  );
}

function confidenceLabel(level: AiWorkshopEvidenceProjection['evidence']['confidence']['level']): string {
  if (level === 'high') return '高';
  if (level === 'medium') return '中';
  if (level === 'low') return '低';
  return '暂无';
}
