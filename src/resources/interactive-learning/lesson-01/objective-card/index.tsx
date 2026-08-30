'use client';

import { Flag, Target } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

const OBJECTIVES = [
  '了解控制系统的基本组成与信号流向。',
  '理解反馈思想与误差信号的作用。',
  '能用典型控制结构分析实际工程问题。',
  '能将控制思想迁移到多学科场景。',
];

interface FeedbackObjectiveCardProps extends BaseWidgetProps {}

export default function FeedbackObjectiveCard({ onComplete, onStateChange }: FeedbackObjectiveCardProps) {
  const interactive = useOptionalInteractiveContext();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <Flag className="h-6 w-6 text-emerald-500" />
          <div>
            <p className="text-sm text-slate-500">学习目标</p>
            <h2 className="text-2xl font-bold text-slate-900">反馈控制的核心能力</h2>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {OBJECTIVES.map((item, index) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-700">
                {index + 1}
              </div>
              <p className="text-sm text-slate-700">{item}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Target className="h-4 w-4" />
            目标确认后进入前测。
          </div>
          <PathResourceContinueAction
            enabled
            result={{ success: true, score: 100, data: { action: 'objective-confirmed' } }}
            onBeforeComplete={() => {
              const snapshot = {
                progress: 100,
                data: { action: 'objective-confirmed' },
                timestamp: Date.now(),
              };
              onStateChange?.(snapshot);
              interactive?.progress.setProgress(100);
              interactive?.tracking.emit('complete', snapshot.data);
            }}
            onComplete={onComplete}
          />
        </div>
      </div>
    </div>
  );
}
