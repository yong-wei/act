'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface StrategyOption {
  id: string;
  label: string;
}

interface StrategyScenario {
  id: string;
  title: string;
  context: string;
  goal: string;
  options: StrategyOption[];
  answerId: string;
  explanation: string;
}

const SCENARIOS: StrategyScenario[] = [
  {
    id: 'fast-response',
    title: '场景 01 · 速度不足',
    context: '系统相角裕度不足，超调明显，稳态误差可接受。',
    goal: '优先提升相角裕度与响应速度。',
    options: [
      { id: 'lead', label: '超前校正' },
      { id: 'lag', label: '滞后校正' },
      { id: 'lag-lead', label: '滞后-超前联合' },
      { id: 'none', label: '不校正' },
    ],
    answerId: 'lead',
    explanation: '相角裕度不足更适合超前校正，带来相位超前与带宽提升。',
  },
  {
    id: 'steady-error',
    title: '场景 02 · 精度不足',
    context: '稳态误差偏大，但相角裕度已有余量。',
    goal: '提高低频增益，改善稳态精度。',
    options: [
      { id: 'lead', label: '超前校正' },
      { id: 'lag', label: '滞后校正' },
      { id: 'lag-lead', label: '滞后-超前联合' },
      { id: 'none', label: '不校正' },
    ],
    answerId: 'lag',
    explanation: '滞后校正通过低频增益提升稳态精度，前提是相角裕度有余。',
  },
  {
    id: 'dual-target',
    title: '场景 03 · 双目标不足',
    context: '稳态误差偏大且相角裕度不足。',
    goal: '同时兼顾稳态精度与相角裕度。',
    options: [
      { id: 'lead', label: '超前校正' },
      { id: 'lag', label: '滞后校正' },
      { id: 'lag-lead', label: '滞后-超前联合' },
      { id: 'none', label: '不校正' },
    ],
    answerId: 'lag-lead',
    explanation: '单一校正难以满足双目标，需要滞后-超前联合分阶段达标。',
  },
];

interface SeriesStrategyLabProps extends BaseWidgetProps {}

export default function SeriesStrategyLab({ onComplete, onStateChange }: SeriesStrategyLabProps) {
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
            <p className="text-sm text-slate-500">互动 · 校正策略决策</p>
            <h2 className="text-2xl font-bold text-slate-900">串联校正策略实验室</h2>
          </div>
          <div className="text-sm text-slate-500">场景 {currentIndex + 1}/{SCENARIOS.length}</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-700">{current.title}</div>
            <p className="mt-3 text-sm text-slate-600">{current.context}</p>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              目标：{current.goal}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700">选择校正方案</p>
            <div className="mt-3 grid gap-2">
              {current.options.map((option) => {
                const isSelected = selected === option.id;
                const isCorrect = checked && option.id === current.answerId;
                const isWrong = checked && isSelected && option.id !== current.answerId;
                return (
                  <button
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
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">当前得分 {score}/{SCENARIOS.length}</span>
            <button
              onClick={handleCheck}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
            >
              检查
            </button>
            <button
              onClick={handleNext}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
                checked && !isLast
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
              disabled={!checked || isLast}
            >
              下一场景
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
