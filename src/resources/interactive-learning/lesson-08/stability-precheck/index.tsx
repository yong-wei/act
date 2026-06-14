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
    id: 'stability-definition',
    title: '稳定性定义',
    prompt: '下列哪一项最符合控制系统稳定性的定义？',
    options: [
      { id: 'A', label: '扰动消失后系统能恢复到原平衡状态' },
      { id: 'B', label: '系统对所有输入都无超调' },
      { id: 'C', label: '系统响应速度始终最快' },
      { id: 'D', label: '稳态误差一定为零' },
    ],
    answerId: 'A',
    explanation: '稳定强调扰动消失后能否回到平衡状态，与超调或速度不是同一概念。',
  },
  {
    id: 'stability-condition',
    title: '充要条件',
    prompt: '连续系统稳定的充要条件是闭环特征根满足：',
    formula: 'Re(s_i) < 0',
    options: [
      { id: 'A', label: '全部位于左半 s 平面' },
      { id: 'B', label: '全部位于右半 s 平面' },
      { id: 'C', label: '全部位于虚轴上' },
      { id: 'D', label: '只要系数为正即可' },
    ],
    answerId: 'A',
    explanation: '闭环所有特征根实部为负是稳定的充要条件。',
  },
  {
    id: 'routh-sign',
    title: '劳斯判据',
    prompt: '劳斯表第一列元素符号变化次数代表什么？',
    options: [
      { id: 'A', label: '左半平面根的个数' },
      { id: 'B', label: '右半平面根的个数' },
      { id: 'C', label: '虚轴根的个数' },
      { id: 'D', label: '系统阶数' },
    ],
    answerId: 'B',
    explanation: '劳斯判据给出第一列变号次数 = 正实部根数。',
  },
  {
    id: 'routh-zero-leading',
    title: '特殊情况：首项为 0',
    prompt: '劳斯表某行第一列为 0，但该行不全为 0 时，应如何处理？',
    options: [
      { id: 'A', label: '将 0 替换为一个很小的 ε 并继续计算' },
      { id: 'B', label: '直接判定系统稳定' },
      { id: 'C', label: '整行删除' },
      { id: 'D', label: '将该行全部置零' },
    ],
    answerId: 'A',
    explanation: '首项为 0 时用 ε 代替，避免计算中断。',
  },
  {
    id: 'routh-zero-row',
    title: '特殊情况：全零行',
    prompt: '劳斯表出现全零行时，通常说明系统可能存在：',
    options: [
      { id: 'A', label: '共轭虚根或对称根' },
      { id: 'B', label: '全部实根均为负' },
      { id: 'C', label: '必定不稳定' },
      { id: 'D', label: '根全部为零' },
    ],
    answerId: 'A',
    explanation: '全零行意味着可能有成对虚轴根，需要用辅助多项式继续计算。',
  },
  {
    id: 'final-value',
    title: '终值定理',
    prompt: '稳定系统稳态误差 e_ss 的常用计算公式是：',
    formula: 'e_ss = lim_{s->0} sE(s)',
    options: [
      { id: 'A', label: 'e_ss = lim_{s->0} sE(s)' },
      { id: 'B', label: 'e_ss = lim_{s->\infty} E(s)' },
      { id: 'C', label: 'e_ss = lim_{t->0} e(t)' },
      { id: 'D', label: 'e_ss = lim_{s->0} E(s)/s' },
    ],
    answerId: 'A',
    explanation: '终值定理给出稳态误差 e_ss = lim_{s->0} sE(s)，前提是系统稳定。',
  },
];

interface StabilityPrecheckProps extends BaseWidgetProps {}

function FormulaCard({ formula }: { formula?: string }) {
  if (!formula) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">提示公式：</span>
      <span className="ml-2 font-mono">{formula}</span>
    </div>
  );
}

export default function StabilityPrecheck({ onComplete, onStateChange }: StabilityPrecheckProps) {
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
            <p className="text-sm text-slate-500">前测 · 稳定与误差基础</p>
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

        <div className="mt-4 text-sm text-slate-500">已答对 {score} / {QUIZ_ITEMS.length}</div>
      </div>
    </div>
  );
}
