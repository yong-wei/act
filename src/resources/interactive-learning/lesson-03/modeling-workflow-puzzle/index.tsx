'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, RotateCcw, Flag } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'variables',
    title: '确定输入/输出/扰动',
    description: '明确系统的输入量、输出量与扰动量。',
  },
  {
    id: 'intermediate',
    title: '引入中间变量',
    description: '补充必要的中间变量以描述系统内部关系。',
  },
  {
    id: 'laws',
    title: '列出物理方程',
    description: '根据定律写出系统各部分的动态方程。',
  },
  {
    id: 'eliminate',
    title: '消去中间变量',
    description: '化简得到输入与输出的微分关系。',
  },
  {
    id: 'standard',
    title: '整理为标准形式',
    description: '对齐微分方程标准形式并标出参数。',
  },
  {
    id: 'verify',
    title: '核查与解释',
    description: '检查物理意义与量纲，验证模型合理性。',
  },
];

interface ModelingWorkflowPuzzleProps extends BaseWidgetProps {}

export default function ModelingWorkflowPuzzle({ onComplete, onStateChange }: ModelingWorkflowPuzzleProps) {
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
    },
    [currentIndex, selectedSteps, interactive, onStateChange]
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
            <p className="text-sm text-slate-500">互动 · 建模流程拼图</p>
            <h2 className="text-2xl font-bold text-slate-900">微分方程建模流程</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {selectedSteps.length}/{WORKFLOW_STEPS.length}</div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Flag className="h-4 w-4 text-emerald-500" />
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
              顺序不对，请再检查。
            </div>
          )}
          {lastResult === null && (
            <div className="text-slate-500">完成所有步骤即可解锁满分。</div>
          )}
        </div>
        <PathResourceContinueAction
          enabled={selectedSteps.length === WORKFLOW_STEPS.length}
          result={{ success: true, score: 100, data: { steps: selectedSteps.map((item) => item.id) } }}
          onComplete={onComplete}
        />

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
