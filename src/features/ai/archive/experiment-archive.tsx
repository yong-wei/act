'use client';

/**
 * ExperimentArchive - 实验档案（右侧面板）
 */

import { Archive, Beaker, Scale, AlertTriangle, Star } from 'lucide-react';
import type { ExperimentRecord } from '../personal-learning-center';
import type { AiWorkshopEvidenceProjection } from '../ai-workshop-evidence';

interface ExperimentArchiveProps {
  experiments: ExperimentRecord[];
  evidence: AiWorkshopEvidenceProjection;
}

const typeConfig = {
  PID_TUNING: { icon: Beaker, label: 'PID 调参', color: 'text-foreground', bg: 'bg-muted' },
  ETHICS_SANDBOX: { icon: Scale, label: '伦理沙盘', color: 'text-foreground', bg: 'bg-muted' },
  ANOMALY_EVENT: { icon: AlertTriangle, label: '异常事件', color: 'text-foreground', bg: 'bg-muted' },
};

export function ExperimentArchive({ experiments, evidence }: ExperimentArchiveProps) {
  const getScoreColor = (score: number) => {
    return score >= 0 ? 'text-foreground' : 'text-muted-foreground';
  };

  return (
    <aside className="w-full max-w-none shrink-0 overflow-y-visible border-t border-border bg-card p-5 md:w-[20%] md:min-w-[240px] md:max-w-[300px] md:overflow-y-auto md:border-l md:border-t-0">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
          <Archive className="h-5 w-5" />
          实验档案
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">近期实验记录</p>
      </div>

      {/* 统计概览 */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded border border-border bg-background p-3 text-center">
          <div className="text-2xl font-bold text-foreground">{experiments.length}</div>
          <div className="text-xs text-muted-foreground">实验总数</div>
        </div>
        <div className="rounded border border-border bg-background p-3 text-center">
          <div className="text-2xl font-bold text-foreground">
            {experiments.length > 0
              ? Math.round(experiments.reduce((sum, e) => sum + e.score, 0) / experiments.length)
              : '—'}
          </div>
          <div className="text-xs text-muted-foreground">平均分</div>
        </div>
      </div>

      {/* 实验记录列表 */}
      <div className="space-y-3">
        {experiments.length === 0 ? (
          <div className="rounded border border-border bg-muted p-4 text-sm text-muted-foreground" data-ai-workshop-empty="experiments">
            {evidence.status === 'unavailable' ? '仿真记录暂时不可用。' : '暂无已验证的仿真训练记录。'}
          </div>
        ) : null}
        {experiments.map((experiment) => {
          const config = typeConfig[experiment.type];
          const Icon = config.icon;

          return (
            <div
              key={experiment.id}
              className="cursor-pointer rounded border border-border bg-background p-4 transition-all hover:border-primary hover:bg-accent"
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className={`rounded-lg p-1.5 ${config.bg}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <span className={`text-xs ${config.color}`}>{config.label}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Star className={`h-4 w-4 ${getScoreColor(experiment.score)}`} />
                  <span className={`font-medium ${getScoreColor(experiment.score)}`}>
                    {experiment.score}
                  </span>
                </div>
              </div>

              <div className="font-medium text-foreground">{experiment.title}</div>

              <div className="mt-2 text-xs text-muted-foreground">
                {experiment.createdAt.toLocaleDateString('zh-CN', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>

              {/* PID 参数预览 */}
              {experiment.type === 'PID_TUNING' && experiment.parameters && (
                <div className="mt-2 flex gap-2 text-xs">
                  {Object.entries(experiment.parameters).map(([key, value]) => (
                    <span
                      key={key}
                      className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground"
                    >
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 查看更多 */}
      <button type="button" className="mt-4 w-full rounded border border-border bg-background py-2 text-sm text-foreground transition-colors hover:bg-accent">
        查看完整档案
      </button>
    </aside>
  );
}
