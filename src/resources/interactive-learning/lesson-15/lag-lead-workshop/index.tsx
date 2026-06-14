'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, RotateCcw, Flag } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'target',
    title: '确定设计目标',
    description: '明确相角裕度、稳态误差与带宽要求。',
  },
  {
    id: 'lead-phase',
    title: '估算所需超前角',
    description: '根据目标裕度与原系统不足量确定相角超前。',
  },
  {
    id: 'lead-params',
    title: '配置超前参数',
    description: '由 a 与峰值频率确定超前网络零极点。',
  },
  {
    id: 'lag-gain',
    title: '计算滞后系数',
    description: '依据超前后幅值水平确定低频增益需求。',
  },
  {
    id: 'lag-params',
    title: '布置滞后零极点',
    description: '将滞后零极点放在相角裕度充足的低频区。',
  },
  {
    id: 'verify',
    title: '统一验算与修正',
    description: '检查裕度、带宽与稳态误差并微调参数。',
  },
];

interface LagLeadWorkshopProps extends BaseWidgetProps {}

export default function LagLeadWorkshop({ onComplete, onStateChange }: LagLeadWorkshopProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedSteps, setSelectedSteps] = useState<WorkflowStep[]>([]);
  const [lastResult, setLastResult] = useState<'correct' | 'wrong' | null>(null);

  const progress = useMemo(
    () => Math.round((selectedSteps.length / WORKFLOW_STEPS.length) * 100),
    [selectedSteps.length]
  );

  const handleSelect = useCallback(
    (step: WorkflowStep) => {
      const expected = WORKFLOW_STEPS[currentIndex];
      if (!expected) return;

      if (step.id !== expected.id) {
        setLastResult('wrong');
        interactive?.tracking.emit('error', { stepId: step.id, expected: expected.id });
        return;
      }

      const nextSteps = [...selectedSteps, step];
      setSelectedSteps(nextSteps);
      setCurrentIndex((prev) => Math.min(prev + 1, WORKFLOW_STEPS.length));
      setLastResult('correct');

      const snapshot = {
        progress: Math.round((nextSteps.length / WORKFLOW_STEPS.length) * 100),
        data: { stepId: step.id, order: nextSteps.length },
        timestamp: Date.now(),
      };
      onStateChange?.(snapshot);
      interactive?.progress.setProgress(snapshot.progress);
      interactive?.tracking.emit('interact', snapshot.data);

      if (nextSteps.length === WORKFLOW_STEPS.length && !interactive?.progress.isComplete) {
        const result: WidgetResult = {
          success: true,
          score: 100,
          data: { steps: nextSteps.map((item) => item.id) },
        };
        interactive?.progress.markComplete(result);
        onComplete?.(result);
      }
    },
    [currentIndex, selectedSteps, interactive, onComplete, onStateChange]
  );

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setSelectedSteps([]);
    setLastResult(null);
    onStateChange?.({
      progress: 0,
      data: { action: 'reset' },
      timestamp: Date.now(),
    });
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [onStateChange, interactive]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">互动 · 联合设计流程</p>
            <h2 className="text-2xl font-bold text-slate-900">滞后-超前流程拼图</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {selectedSteps.length}/{WORKFLOW_STEPS.length}</div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Flag className="h-4 w-4 text-amber-500" />
              已完成步骤
            </div>
            <div className="mt-3 space-y-2">
              {selectedSteps.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                  从右侧选择第 1 步开始。
                </div>
              ) : (
                selectedSteps.map((step, index) => (
                  <div
                    key={step.id}
                    className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                  >
                    {index + 1}. {step.title}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700">待选步骤</p>
            <div className="mt-3 grid gap-2">
              {WORKFLOW_STEPS.map((step) => {
                const isChosen = selectedSteps.some((item) => item.id === step.id);
                return (
                  <button type="button"
                    key={step.id}
                    onClick={() => !isChosen && handleSelect(step)}
                    className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                      isChosen
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                    disabled={isChosen}
                  >
                    <div className="font-medium">{step.title}</div>
                    <div className="mt-1 text-xs text-slate-500">{step.description}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          {lastResult === 'correct' && (
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              顺序正确，继续下一步。
            </div>
          )}
          {lastResult === 'wrong' && (
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
              这个步骤放置顺序不对，再想想。
            </div>
          )}
          {lastResult === null && (
            <div className="text-slate-500">按流程完成全部步骤即可解锁满分。</div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <button type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="text-xs text-slate-500">当前完成度 {progress}%</div>
        </div>
      </div>
    </div>
  );
}
