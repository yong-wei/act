'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
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
    id: 'stability-sign',
    title: '稳定判别',
    prompt: '劳斯表第一列出现 2 次变号，系统的正实部根个数为：',
    options: [
      { id: 'A', label: '0' },
      { id: 'B', label: '1' },
      { id: 'C', label: '2' },
      { id: 'D', label: '无法判断' },
    ],
    answerId: 'C',
    explanation: '变号次数等于右半平面根数，故为 2 个。',
  },
  {
    id: 'type-1-step',
    title: '型别与阶跃误差',
    prompt: '型别为 1 的单位负反馈系统，对单位阶跃输入的稳态误差为：',
    options: [
      { id: 'A', label: '0' },
      { id: 'B', label: '1/(1+Kp)' },
      { id: 'C', label: '1/Kv' },
      { id: 'D', label: '∞' },
    ],
    answerId: 'A',
    explanation: '型别 1 系统对阶跃输入无稳态误差。',
  },
  {
    id: 'type-0-ramp',
    title: '型别与斜坡误差',
    prompt: '型别为 0 的系统对单位斜坡输入的稳态误差为：',
    options: [
      { id: 'A', label: '0' },
      { id: 'B', label: '有限常数' },
      { id: 'C', label: '∞' },
      { id: 'D', label: '无法判断' },
    ],
    answerId: 'C',
    explanation: '型别 0 对斜坡输入产生无穷大稳态误差。',
  },
  {
    id: 'final-value',
    title: '终值定理',
    prompt: '稳态误差的终值定理表达式是：',
    formula: 'e_ss = lim_{s->0} sE(s)',
    options: [
      { id: 'A', label: 'e_ss = lim_{s->0} sE(s)' },
      { id: 'B', label: 'e_ss = lim_{s->\infty} sE(s)' },
      { id: 'C', label: 'e_ss = lim_{s->0} E(s)/s' },
      { id: 'D', label: 'e_ss = lim_{t->0} e(t)' },
    ],
    answerId: 'A',
    explanation: '稳定条件下可用 e_ss = lim_{s->0} sE(s)。',
  },
];

interface PostQuizProps extends BaseWidgetProps {}

function FormulaCard({ formula }: { formula?: string }) {
  if (!formula) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">提示公式：</span>
      <span className="ml-2 font-mono">{formula}</span>
    </div>
  );
}

export default function PostQuiz({ onComplete, onStateChange }: PostQuizProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = QUIZ_ITEMS[currentIndex];
  const isLast = currentIndex === QUIZ_ITEMS.length - 1;
  const progress = useMemo(
    () => Math.round(((currentIndex + (checked ? 1 : 0)) / QUIZ_ITEMS.length) * 100),
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
            <p className="text-sm text-slate-500">后测 · 综合挑战</p>
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

        <div className="mt-4 grid gap-3">
          {current.options.map((option) => {
            const isSelected = selected === option.id;
            const isCorrect = checked && option.id === current.answerId;
            const isWrong = checked && isSelected && option.id !== current.answerId;

            return (
              <button
                key={option.id}
                onClick={() => !checked && setSelected(option.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition-all ${
                  isCorrect
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                    : isWrong
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : isSelected
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                <span>{option.id}. {option.label}</span>
                {isCorrect && <CheckCircle2 className="h-4 w-4" />}
                {isWrong && <XCircle className="h-4 w-4" />}
              </button>
            );
          })}
        </div>

        {checked && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700">
            {current.explanation}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCheck}
              disabled={!selected || checked}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white disabled:opacity-40"
            >
              提交答案
            </button>
            <button
              onClick={handleNext}
              disabled={!checked || isLast}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white disabled:opacity-40"
            >
              下一题
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-500">已答对 {score} / {QUIZ_ITEMS.length}</div>
      </div>
    </div>
  );
}
