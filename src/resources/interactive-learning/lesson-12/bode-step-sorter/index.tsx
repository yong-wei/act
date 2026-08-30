'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, RefreshCw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface StepItem {
  id: string;
  title: string;
  detail: string;
}

const STEPS: StepItem[] = [
  {
    id: 'normalize',
    title: '化为尾 1 标准型',
    detail: '将传递函数因子化，提取常数，使低频基准明确。',
  },
  {
    id: 'breakpoints',
    title: '列出转折频率',
    detail: '按零点/极点顺序列出所有转折频率。',
  },
  {
    id: 'low-frequency',
    title: '确定低频特性',
    detail: '在最低频段确定初始斜率与基准点。',
  },
  {
    id: 'overlay',
    title: '叠加作图',
    detail: '逐段累加斜率，绘制渐近线。',
  },
  {
    id: 'refine',
    title: '必要时修正',
    detail: '对振荡环节或误差较大处进行修正。',
  },
];

function shuffleArray<T>(items: T[]) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

interface BodeStepSorterProps extends BaseWidgetProps {}

export default function BodeStepSorter({ onComplete, onStateChange }: BodeStepSorterProps) {
  const interactive = useOptionalInteractiveContext();
  const [orderedSteps, setOrderedSteps] = useState<StepItem[]>(() => shuffleArray(STEPS));
  const [checked, setChecked] = useState(false);

  const correctCount = useMemo(
    () => orderedSteps.reduce((acc, step, index) => acc + (step.id === STEPS[index].id ? 1 : 0), 0),
    [orderedSteps]
  );

  const progress = useMemo(
    () => Math.round((correctCount / STEPS.length) * 100),
    [correctCount]
  );

  const isCorrect = correctCount === STEPS.length;

  const moveStep = useCallback((index: number, direction: 'up' | 'down') => {
    setOrderedSteps((prev) => {
      const next = [...prev];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= next.length) return prev;
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
    setChecked(false);
  }, []);

  const handleCheck = useCallback(() => {
    setChecked(true);
    const snapshot = {
      progress,
      data: { correctCount, total: STEPS.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progress);
    interactive?.tracking.emit('submit', snapshot.data);
  }, [progress, correctCount, onStateChange, interactive]);

  const handleShuffle = useCallback(() => {
    setOrderedSteps(shuffleArray(STEPS));
    setChecked(false);
    onStateChange?.({
      progress: 0,
      data: { action: 'shuffle' },
      timestamp: Date.now(),
    });
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'shuffle' });
  }, [interactive, onStateChange]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">参与式 · 绘制步骤排序</p>
            <h2 className="text-2xl font-bold text-slate-900">伯德图绘制步骤</h2>
          </div>
          <div className="text-sm text-slate-500">正确 {correctCount}/{STEPS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          按正确顺序排列伯德图绘制步骤，完成后点击“检查”。
        </div>

        <div className="mt-6 space-y-3">
          {orderedSteps.map((step, index) => (
            <div
              key={step.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors ${
                checked && step.id === STEPS[index].id
                  ? 'border-emerald-300 bg-emerald-50'
                  : checked
                  ? 'border-rose-200 bg-rose-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <div>
                <div className="text-sm font-semibold text-slate-800">{step.title}</div>
                <div className="text-xs text-slate-500 mt-1">{step.detail}</div>
              </div>
              <div className="flex flex-col gap-2">
                <button type="button"
                  onClick={() => moveStep(index, 'up')}
                  className="rounded-md border border-slate-200 p-1 text-slate-500 hover:text-slate-700"
                  aria-label="向上移动"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button"
                  onClick={() => moveStep(index, 'down')}
                  className="rounded-md border border-slate-200 p-1 text-slate-500 hover:text-slate-700"
                  aria-label="向下移动"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button"
            onClick={handleShuffle}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <RefreshCw className="h-4 w-4" />
            重新打乱
          </button>
          <button type="button"
            onClick={handleCheck}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
              checked && isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            检查顺序
          </button>
          {checked && isCorrect ? (
            <PathResourceContinueAction
              enabled
              result={{ success: true, score: 100, data: { correctCount, total: STEPS.length } }}
              onComplete={onComplete}
            />
          ) : null}
        </div>

        {checked && (
          <div className={`mt-4 rounded-lg border p-4 text-sm ${
            isCorrect ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-600'
          }`}>
            {isCorrect ? '排序正确，可以开始叠加绘图。' : '仍有步骤不在正确位置，请继续调整。'}
          </div>
        )}
      </div>
    </div>
  );
}
