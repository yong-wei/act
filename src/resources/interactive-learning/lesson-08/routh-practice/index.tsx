'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface PracticeOption {
  id: string;
  label: string;
}

interface PracticeItem {
  id: string;
  title: string;
  prompt: string;
  formula?: string;
  options: PracticeOption[];
  answerId: string;
  explanation: string;
}

const PRACTICE_ITEMS: PracticeItem[] = [
  {
    id: 'case-stable',
    title: '判别稳定性',
    prompt: '判断系统是否稳定（可简单使用劳斯判据）。',
    formula: 'Δ(s) = s^3 + 2s^2 + 3s + 4',
    options: [
      { id: 'A', label: '稳定' },
      { id: 'B', label: '不稳定' },
      { id: 'C', label: '临界稳定' },
      { id: 'D', label: '无法判断' },
    ],
    answerId: 'A',
    explanation: '劳斯表第一列均为正，系统稳定。',
  },
  {
    id: 'case-unstable',
    title: '右半平面根数',
    prompt: '右半平面根的个数为多少？',
    formula: 'Δ(s) = s^3 + 2s^2 + s - 2',
    options: [
      { id: 'A', label: '0' },
      { id: 'B', label: '1' },
      { id: 'C', label: '2' },
      { id: 'D', label: '3' },
    ],
    answerId: 'B',
    explanation: '劳斯表第一列出现 1 次变号，因此有 1 个正实部根。',
  },
  {
    id: 'case-zero-leading',
    title: '首项为 0 的处理',
    prompt: '劳斯表某行第一列为 0，但该行不全为 0。下一步应该：',
    options: [
      { id: 'A', label: '用极小正数 ε 替换 0' },
      { id: 'B', label: '直接判定为不稳定' },
      { id: 'C', label: '整行删除' },
      { id: 'D', label: '该行全部置零' },
    ],
    answerId: 'A',
    explanation: '用 ε 代替首项，保证计算继续进行。',
  },
  {
    id: 'case-zero-row',
    title: '全零行处理',
    prompt: '劳斯表出现全零行时，应如何继续？',
    options: [
      { id: 'A', label: '由上一行构造辅助方程并求导' },
      { id: 'B', label: '将全零行视为稳定' },
      { id: 'C', label: '直接终止计算' },
      { id: 'D', label: '将全零行替换为随机值' },
    ],
    answerId: 'A',
    explanation: '全零行意味着对称根，需要用辅助方程的导数继续。',
  },
];

interface RouthPracticeProps extends BaseWidgetProps {}

function FormulaTag({ formula }: { formula?: string }) {
  if (!formula) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">特征方程：</span>
      <span className="ml-2 font-mono">{formula}</span>
    </div>
  );
}

export default function RouthPractice({ onComplete, onStateChange }: RouthPracticeProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = PRACTICE_ITEMS[currentIndex];
  const isLast = currentIndex === PRACTICE_ITEMS.length - 1;
  const progress = useMemo(
    () => Math.round(((currentIndex + (checked ? 1 : 0)) / PRACTICE_ITEMS.length) * 100),
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
        score: Math.round((nextScore / PRACTICE_ITEMS.length) * 100),
        data: { correct: nextScore, total: PRACTICE_ITEMS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [checked, selected, current.answerId, current.id, isLast, onComplete, onStateChange, score, progress, interactive]);

  const handleNext = useCallback(() => {
    if (!checked || isLast) return;
    setChecked(false);
    setSelected(null);
    setCurrentIndex((prev) => Math.min(prev + 1, PRACTICE_ITEMS.length - 1));
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
            <p className="text-sm text-slate-500">练习 · 劳斯判据应用</p>
            <h2 className="text-2xl font-bold text-slate-900">{current.title}</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {currentIndex + 1}/{PRACTICE_ITEMS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-700">
          <p className="text-sm leading-relaxed">{current.prompt}</p>
        </div>

        <div className="mt-4">
          <FormulaTag formula={current.formula} />
        </div>

        <div className="mt-4 grid gap-3">
          {current.options.map((option) => {
            const isSelected = selected === option.id;
            const isCorrect = checked && option.id === current.answerId;
            const isWrong = checked && isSelected && option.id !== current.answerId;

            return (
              <button type="button"
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
          <button type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>

          <div className="flex items-center gap-3">
            <button type="button"
              onClick={handleCheck}
              disabled={!selected || checked}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white disabled:opacity-40"
            >
              提交答案
            </button>
            <button type="button"
              onClick={handleNext}
              disabled={!checked || isLast}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white disabled:opacity-40"
            >
              下一题
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-500">已答对 {score} / {PRACTICE_ITEMS.length}</div>
      </div>
    </div>
  );
}
