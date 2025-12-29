'use client';

/**
 * ExperimentArchive - 实验档案（右侧面板）
 */

import { Archive, Beaker, Scale, AlertTriangle, Star } from 'lucide-react';
import type { ExperimentRecord } from '../personal-learning-center';

interface ExperimentArchiveProps {
  experiments: ExperimentRecord[];
}

const typeConfig = {
  PID_TUNING: { icon: Beaker, label: 'PID 调参', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  ETHICS_SANDBOX: { icon: Scale, label: '伦理沙盘', color: 'text-green-400', bg: 'bg-green-500/20' },
  ANOMALY_EVENT: { icon: AlertTriangle, label: '异常事件', color: 'text-red-400', bg: 'bg-red-500/20' },
};

export function ExperimentArchive({ experiments }: ExperimentArchiveProps) {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 75) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <aside className="w-[20%] min-w-[240px] max-w-[300px] overflow-y-auto border-l border-cyan-500/30 bg-[#0c3654]/50 p-5">
      {/* 标题 */}
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-cyan-400">
          <Archive className="h-5 w-5" />
          实验档案
        </h2>
        <p className="mt-1 text-sm text-slate-400">近期实验记录</p>
      </div>

      {/* 统计概览 */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-cyan-500/20 bg-[#0a2a43]/50 p-3 text-center">
          <div className="text-2xl font-bold text-cyan-400">{experiments.length}</div>
          <div className="text-xs text-slate-400">实验总数</div>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-[#0a2a43]/50 p-3 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {Math.round(experiments.reduce((sum, e) => sum + e.score, 0) / experiments.length)}
          </div>
          <div className="text-xs text-slate-400">平均分</div>
        </div>
      </div>

      {/* 实验记录列表 */}
      <div className="space-y-3">
        {experiments.map((experiment) => {
          const config = typeConfig[experiment.type];
          const Icon = config.icon;

          return (
            <div
              key={experiment.id}
              className="cursor-pointer rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition-all hover:border-cyan-500/30 hover:bg-cyan-500/5"
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

              <div className="font-medium text-slate-200">{experiment.title}</div>

              <div className="mt-2 text-xs text-slate-500">
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
                      className="rounded-full bg-slate-700 px-2 py-0.5 text-slate-400"
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
      <button className="mt-4 w-full rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-2 text-sm text-cyan-400 transition-colors hover:bg-cyan-500/20">
        查看完整档案
      </button>
    </aside>
  );
}
