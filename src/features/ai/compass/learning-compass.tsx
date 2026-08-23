'use client';

import { AlertTriangle, CheckCircle2, Circle, Target } from 'lucide-react';
import type { AiWorkshopEvidenceProjection } from '../ai-workshop-evidence';
import type { MilestoneData } from '../personal-learning-center';

interface LearningCompassProps {
  milestones: MilestoneData[];
  evidence: AiWorkshopEvidenceProjection;
}

export function LearningCompass({ milestones, evidence }: LearningCompassProps) {
  const completedCount = milestones.filter((milestone) => milestone.status === 'COMPLETED').length;
  const progressPercent = milestones.length === 0 ? 0 : Math.round((completedCount / milestones.length) * 100);

  return (
    <aside className="w-full max-w-none shrink-0 overflow-y-visible border-b border-cyan-500/30 bg-[#0c3654]/50 p-5 md:w-[20%] md:min-w-[240px] md:max-w-[300px] md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-cyan-400">
          <Target className="h-5 w-5" />
          学习罗盘
        </h2>
        <p className="mt-1 text-sm text-slate-400">成长航线进度追踪</p>
      </div>

      <div className="mb-6 rounded border border-cyan-500/20 bg-[#0a2a43]/50 p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-slate-400">航线进度</span>
          <span className="font-medium text-cyan-400">{milestones.length > 0 ? `${progressPercent}%` : '暂无'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="mt-2 text-xs text-slate-500">
          {milestones.length > 0 ? `已完成 ${completedCount} / ${milestones.length} 个里程碑` : '没有已验证的里程碑记录'}
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-slate-300" data-ai-workshop-empty="milestones">
          {evidence.status === 'unavailable'
            ? '学习路径暂时不可用，请稍后重试。'
            : '暂无已验证的学习路径记录。完成学习活动后，这里会显示真实进度。'}
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <div
              key={milestone.id}
              className={`relative rounded border p-4 transition-all ${milestone.status === 'CURRENT' ? 'border-cyan-500/50 bg-cyan-500/10' : milestone.status === 'COMPLETED' ? 'border-green-500/30 bg-green-500/5' : 'border-slate-700 bg-slate-800/30 opacity-60'}`}
            >
              {index < milestones.length - 1 ? <div className={`absolute left-6 top-full h-3 w-0.5 ${milestone.status === 'COMPLETED' ? 'bg-green-500/50' : 'bg-slate-600'}`} /> : null}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {milestone.status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5 text-green-400" /> : milestone.status === 'CURRENT' ? <Circle className="h-5 w-5 text-cyan-400" /> : <Circle className="h-5 w-5 text-slate-500" />}
                </div>
                <div className="flex-1">
                  <div className={`font-medium ${milestone.status === 'CURRENT' ? 'text-cyan-400' : 'text-slate-200'}`}>{milestone.title}</div>
                  {milestone.description ? <p className="mt-1 text-xs text-slate-400">{milestone.description}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {evidence.limitations.length > 0 ? (
        <div className="mt-6 rounded border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-400" />
            <p className="text-xs text-slate-400">{evidence.limitations[0]}</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
