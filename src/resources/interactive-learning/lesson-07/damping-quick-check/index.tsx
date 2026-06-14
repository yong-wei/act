'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface QuizOption {
  id: string;
  label: string;
}

interface QuizItem {
  id: string;
  title: string;
  prompt: string;
  formula?: string;
  options: QuizOption[];
  answerId: string;
  explanation: string;
}

const QUIZ_ITEMS: QuizItem[] = [
  {
    id: 'standard-form',
    title: '标准型识别',
    prompt: '二阶系统标准型传递函数的分母是哪一项？',
    formula: 'G(s) = ω_n^2 / (s^2 + 2ζω_n s + ω_n^2)',
    options: [
      { id: 'A', label: 's^2 + 2ζω_n s + ω_n^2' },
      { id: 'B', label: 's^2 + 2ζ s + ω_n' },
      { id: 'C', label: 's^2 + ω_n s + 2ζ' },
      { id: 'D', label: 's^2 + 2ζω_n + ω_n^2 s' },
    ],
    answerId: 'A',
    explanation: '二阶标准型分母是 s^2 + 2ζω_n s + ω_n^2。',
  },
  {
    id: 'underdamped-condition',
    title: '欠阻尼判据',
    prompt: '欠阻尼二阶系统的阻尼比范围是？',
    options: [
      { id: 'A', label: 'ζ = 0' },
      { id: 'B', label: '0 < ζ < 1' },
      { id: 'C', label: 'ζ = 1' },
      { id: 'D', label: 'ζ > 1' },
    ],
    answerId: 'B',
    explanation: '欠阻尼系统阻尼比位于 0 与 1 之间。',
  },
  {
    id: 'damped-frequency',
    title: '阻尼频率',
    prompt: '欠阻尼系统的阻尼振荡频率 ω_d 表达式为？',
    options: [
      { id: 'A', label: 'ω_d = ω_n √(1-ζ^2)' },
      { id: 'B', label: 'ω_d = ω_n / ζ' },
      { id: 'C', label: 'ω_d = ω_n ζ' },
      { id: 'D', label: 'ω_d = ω_n^2 - ζ^2' },
    ],
    answerId: 'A',
    explanation: '欠阻尼系统的振荡频率为 ω_d = ω_n√(1-ζ^2)。',
  },
  {
    id: 'overshoot',
    title: '超调量趋势',
    prompt: '在自然频率不变时，提高阻尼比会怎样影响超调量？',
    options: [
      { id: 'A', label: '超调量增大' },
      { id: 'B', label: '超调量减小' },
      { id: 'C', label: '超调量不变' },
      { id: 'D', label: '超调量先减小再增大' },
    ],
    answerId: 'B',
    explanation: '阻尼比越大，振荡越弱，超调量越小。',
  },
  {
    id: 'settling-time',
    title: '调节时间估算',
    prompt: '欠阻尼系统 2% 调节时间近似公式是？',
    options: [
      { id: 'A', label: 't_s ≈ 4/(ζ ω_n)' },
      { id: 'B', label: 't_s ≈ π/ω_d' },
      { id: 'C', label: 't_s ≈ 1/ω_n' },
      { id: 'D', label: 't_s ≈ 2ζ/ω_n' },
    ],
    answerId: 'A',
    explanation: '工程常用近似：t_s ≈ 4/(ζ ω_n)。',
  },
  {
    id: 'natural-frequency',
    title: '自然频率作用',
    prompt: '在阻尼比不变时，提高自然频率 ω_n 的主要效果是？',
    options: [
      { id: 'A', label: '响应整体变慢' },
      { id: 'B', label: '响应加快、峰值更早出现' },
      { id: 'C', label: '超调量显著降低' },
      { id: 'D', label: '振荡完全消失' },
    ],
    answerId: 'B',
    explanation: '自然频率提升意味着系统响应速度更快，峰值时间更短。',
  },
];

interface DampingQuickCheckProps extends BaseWidgetProps {}

function FormulaCard({ formula }: { formula?: string }) {
  if (!formula) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">提示公式：</span>
      <span className="ml-2 font-mono">{formula}</span>
    </div>
  );
}

export default function DampingQuickCheck({ onComplete, onStateChange }: DampingQuickCheckProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = QUIZ_ITEMS[currentIndex];
  const isLast = currentIndex === QUIZ_ITEMS.length - 1;
  const progress = useMemo(() => Math.round(((currentIndex + (checked ? 1 : 0)) / QUIZ_ITEMS.length) * 100), [
    currentIndex,
    checked,
  ]);

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
      data: { questionId: current.id, selected, isCorrect, score: nextScore },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progress);
    interactive?.tracking.emit('submit', snapshot.data);

    if (isLast) {
      const result: WidgetResult = {
        success: true,
        score: Math.round((nextScore / QUIZ_ITEMS.length) * 100),
        data: { correct: nextScore, total: QUIZ_ITEMS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [checked, selected, current.answerId, current.id, isLast, onComplete, onStateChange, score, progress, interactive]);

  const handleNext = useCallback(() => {
    if (!checked || isLast) return;
    setChecked(false);
    setSelected(null);
    setCurrentIndex((prev) => Math.min(prev + 1, QUIZ_ITEMS.length - 1));
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
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">前测 · 欠阻尼速判</p>
            <h2 className="text-2xl font-bold text-slate-900">{current.title}</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {currentIndex + 1}/{QUIZ_ITEMS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-700">
          <p className="text-sm leading-relaxed">{current.prompt}</p>
        </div>

        <div className="mt-4">
          <FormulaCard formula={current.formula} />
        </div>

        <div className="mt-6 grid gap-3">
          {current.options.map((option) => {
            const isCorrect = checked && option.id === current.answerId;
            const isWrong = checked && option.id === selected && option.id !== current.answerId;

            return (
              <button type="button"
                key={option.id}
                onClick={() => !checked && setSelected(option.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  selected === option.id
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                } ${isCorrect ? 'border-emerald-500 bg-emerald-500 text-white' : ''} ${
                  isWrong ? 'border-rose-500 bg-rose-500 text-white' : ''
                }`}
              >
                <span>{option.label}</span>
                {isCorrect && <CheckCircle2 className="h-4 w-4" />}
                {isWrong && <XCircle className="h-4 w-4" />}
              </button>
            );
          })}
        </div>

        {checked && (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {current.explanation}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">当前得分：{score}/{QUIZ_ITEMS.length}</div>
          <div className="flex flex-wrap gap-2">
            <button type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-500 hover:border-slate-400"
            >
              <RotateCcw className="h-4 w-4" />
              重新开始
            </button>
            <button type="button"
              onClick={handleCheck}
              disabled={!selected || checked}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white transition disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              检查答案
            </button>
            {!isLast && (
              <button type="button"
                onClick={handleNext}
                disabled={!checked}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white transition disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                下一题
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
