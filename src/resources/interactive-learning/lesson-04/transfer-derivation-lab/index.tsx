'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface ScenarioOption {
  id: string;
  label: string;
}

interface DerivationScenario {
  id: string;
  title: string;
  context: string;
  goal: string;
  options: ScenarioOption[];
  answerId: string;
  explanation: string;
}

const SCENARIOS: DerivationScenario[] = [
  {
    id: 'rlc-series',
    title: '案例 01 · RLC 串联电路',
    context: '微分方程：L d²q/dt² + R dq/dt + (1/C) q = u(t)。',
    goal: '选择 Q(s)/U(s) 的正确传递函数形式。',
    options: [
      { id: 'A', label: '1 / (L s² + R s + 1/C)' },
      { id: 'B', label: 's / (L s² + R s + 1/C)' },
      { id: 'C', label: '(L s² + R s) / (1/C)' },
      { id: 'D', label: '1 / (L s + R + 1/C)' },
    ],
    answerId: 'A',
    explanation: '零初始条件下拉氏变换得到 Q(s)/U(s)=1/(Ls²+Rs+1/C)。',
  },
  {
    id: 'spring-damper',
    title: '案例 02 · 弹簧-阻尼系统',
    context: '微分方程：m x¨ + c x˙ + k x = f(t)。',
    goal: '选择 X(s)/F(s) 的正确传递函数形式。',
    options: [
      { id: 'A', label: '1 / (m s² + c s + k)' },
      { id: 'B', label: 's / (m s² + c s + k)' },
      { id: 'C', label: '(m s² + c s) / k' },
      { id: 'D', label: '1 / (m s + c + k)' },
    ],
    answerId: 'A',
    explanation: '机械系统二阶传函形式为 1/(m s² + c s + k)。',
  },
  {
    id: 'motor-speed',
    title: '案例 03 · 电机角速度模型',
    context: '微分方程：J ω˙ + B ω = K u(t)。',
    goal: '选择 Ω(s)/U(s) 的正确传递函数形式。',
    options: [
      { id: 'A', label: 'K / (J s + B)' },
      { id: 'B', label: '1 / (J s + B)' },
      { id: 'C', label: 'K s / (J s + B)' },
      { id: 'D', label: 'K / (J s² + B s)' },
    ],
    answerId: 'A',
    explanation: '整理后 Ω(s)/U(s)=K/(J s + B)，为一阶惯性环节。',
  },
];

interface TransferDerivationLabProps extends BaseWidgetProps {}

export default function TransferDerivationLab({ onComplete, onStateChange }: TransferDerivationLabProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = SCENARIOS[currentIndex];
  const isLast = currentIndex === SCENARIOS.length - 1;
  const progress = useMemo(
    () => Math.round(((currentIndex + (checked ? 1 : 0)) / SCENARIOS.length) * 100),
    [currentIndex, checked]
  );

  const handleCheck = useCallback(() => {
    if (!selected || checked) return;
    const isCorrect = selected === current.answerId;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setChecked(true);

    const nextScore = isCorrect ? score + 1 : score;
    const snapshot = {
      progress,
      data: { scenarioId: current.id, selected, isCorrect, score: nextScore },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progress);
    interactive?.tracking.emit('submit', snapshot.data);

    if (isLast) {
      const result: WidgetResult = {
        success: true,
        score: Math.round((nextScore / SCENARIOS.length) * 100),
        data: { correct: nextScore, total: SCENARIOS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [checked, selected, current.answerId, current.id, isLast, onComplete, onStateChange, score, progress, interactive]);

  const handleNext = useCallback(() => {
    if (!checked || isLast) return;
    setChecked(false);
    setSelected(null);
    setCurrentIndex((prev) => Math.min(prev + 1, SCENARIOS.length - 1));
    interactive?.tracking.emit('interact', { action: 'next', nextIndex: currentIndex + 1 });
  }, [checked, isLast, currentIndex, interactive]);

  const handleReset = useCallback(() => {
    setCurrentIndex(0);
    setSelected(null);
    setChecked(false);
    setScore(0);
    onStateChange?.({
      progress: 0,
      data: { action: 'reset' },
      timestamp: Date.now(),
    });
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [onStateChange, interactive]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">互动 · 传递函数推导演练</p>
            <h2 className="text-2xl font-bold text-slate-900">传函推导演练</h2>
          </div>
          <div className="text-sm text-slate-500">案例 {currentIndex + 1}/{SCENARIOS.length}</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-700">{current.title}</div>
            <p className="mt-3 text-sm text-slate-600">{current.context}</p>
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              目标：{current.goal}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700">选择传递函数</p>
            <div className="mt-3 grid gap-2">
              {current.options.map((option) => {
                const isSelected = selected === option.id;
                const isCorrect = checked && option.id === current.answerId;
                const isWrong = checked && isSelected && option.id !== current.answerId;
                return (
                  <button type="button"
                    key={option.id}
                    onClick={() => !checked && setSelected(option.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      isCorrect
                        ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                        : isWrong
                        ? 'border-rose-400 bg-rose-50 text-rose-600'
                        : isSelected
                        ? 'border-slate-400 bg-slate-50 text-slate-800'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <span>{option.label}</span>
                    {isCorrect && <CheckCircle2 className="h-4 w-4" />}
                    {isWrong && <XCircle className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">点评</p>
          <p className="mt-2">{checked ? current.explanation : '完成选择后点击“检查”。'}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">当前得分 {score}/{SCENARIOS.length}</span>
            <button type="button"
              onClick={handleCheck}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
            >
              检查
            </button>
            <button type="button"
              onClick={handleNext}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
                checked && !isLast
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
              disabled={!checked || isLast}
            >
              下一题
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
