'use client';

import { AlertTriangle, CheckCircle2, Circle, Target } from 'lucide-react';
import Link from 'next/link';
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
    <aside className="w-full max-w-none shrink-0 overflow-y-visible border-b border-border bg-card p-5 md:w-[20%] md:min-w-[240px] md:max-w-[300px] md:overflow-y-auto md:border-b-0 md:border-r">
      <div className="mb-6">
        <h2 className="flex items-center gap-2 text-lg font-medium text-foreground">
          <Target className="h-5 w-5" />
          学习罗盘
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">成长航线进度追踪</p>
      </div>

      <div className="mb-6 rounded border border-border bg-background p-4">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">航线进度</span>
          <span className="font-medium text-foreground">{milestones.length > 0 ? `${progressPercent}%` : '暂无'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {milestones.length > 0 ? `已完成 ${completedCount} / ${milestones.length} 个里程碑` : '没有已验证的里程碑记录'}
        </div>
      </div>

      {milestones.length === 0 ? (
        <div className="rounded border border-border bg-muted p-4 text-sm text-muted-foreground" data-ai-workshop-empty="milestones">
          {evidence.status === 'unavailable'
            ? '学习路径暂时不可用，请稍后重试。'
            : '暂无已验证的学习路径记录。完成学习活动后，这里会显示真实进度。'}
          <Link className="mt-3 inline-flex font-medium text-foreground underline" href="/interactive-learning" data-ai-workshop-action="milestones">
            开始学习
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {milestones.map((milestone, index) => (
            <div
              key={milestone.id}
              className={`relative rounded border border-border bg-background p-4 transition-all ${milestone.status === 'PENDING' ? 'opacity-60' : ''}`}
            >
              {index < milestones.length - 1 ? <div className="absolute left-6 top-full h-3 w-0.5 bg-border" /> : null}
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {milestone.status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5 text-foreground" /> : <Circle className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">{milestone.title}</div>
                  {milestone.description ? <p className="mt-1 text-xs text-muted-foreground">{milestone.description}</p> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {evidence.limitations.length > 0 ? (
        <div className="mt-6 rounded border border-border bg-muted p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{evidence.limitations[0]}</p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
