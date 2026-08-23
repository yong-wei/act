'use client';

import { AlertTriangle, Database, ShieldCheck, Target } from 'lucide-react';
import type { AiWorkshopEvidenceProjection } from '../ai-workshop-evidence';

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
  const statusClass = evidence.status === 'available'
    ? 'text-emerald-300 bg-emerald-500/15'
    : 'text-amber-300 bg-amber-500/15';

  return (
    <div className="border-b border-cyan-500/30 bg-[#0c3654]/80 px-6 py-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-600 text-xl font-bold">
            {userName.charAt(0)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-medium">{userName}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass}`}>{statusLabel}</span>
            </div>
            <div className="mt-1 text-sm text-slate-400">AI 工坊只展示服务端确认的学习证据。</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <EvidenceMetric icon={Database} label="已验证证据" value={`${evidence.evidence.count}`} />
          <EvidenceMetric icon={ShieldCheck} label="置信度" value={confidenceLabel(evidence.evidence.confidence.level)} />
          <EvidenceMetric icon={Target} label="来源完整度" value={`${Math.round(evidence.evidence.confidence.sourceCompleteness * 100)}%`} />
          <EvidenceMetric icon={Target} label="学习路径" value={`${evidence.path.activeCount} 条`} />
        </div>
      </div>

      {evidence.limitations.length > 0 ? (
        <div className="mt-4 flex items-start gap-2 rounded border border-amber-400/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100" role="status">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <ul className="space-y-1">
            {evidence.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function EvidenceMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Database;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-[92px] rounded border border-cyan-500/20 bg-[#0a2a43]/50 px-3 py-2">
      <div className="flex items-center gap-2 text-xs text-slate-400">
        <Icon className="h-4 w-4 text-cyan-300" />
        {label}
      </div>
      <div className="mt-1 text-base font-medium text-cyan-200">{value}</div>
    </div>
  );
}

function confidenceLabel(level: AiWorkshopEvidenceProjection['evidence']['confidence']['level']): string {
  if (level === 'high') return '高';
  if (level === 'medium') return '中';
  if (level === 'low') return '低';
  return '暂无';
}
