'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface QuizOption {
  id: string;
  label: string;
}

interface QuizItem {
  id: string;
  title: string;
  prompt: string;
  options: QuizOption[];
  answerId: string;
  explanation: string;
}

const QUIZ_ITEMS: QuizItem[] = [
  {
    id: 'summing-point',
    title: '综合点',
    prompt: '对两个或两个以上信号进行代数运算的结构是？',
    options: [
      { id: 'line', label: '信号线' },
      { id: 'pickoff', label: '引出点' },
      { id: 'sum', label: '综合点' },
      { id: 'block', label: '方框' },
    ],
    answerId: 'sum',
    explanation: '综合点用于信号的加减运算，是结构图的核心节点。',
  },
  {
    id: 'pickoff-point',
    title: '引出点',
    prompt: '从同一信号线上引出的信号，数值和性质相同，这个位置叫？',
    options: [
      { id: 'line', label: '信号线' },
      { id: 'pickoff', label: '引出点' },
      { id: 'sum', label: '综合点' },
      { id: 'block', label: '方框' },
    ],
    answerId: 'pickoff',
    explanation: '引出点是“取样”的位置，信号不发生变化。',
  },
  {
    id: 'series-equivalent',
    title: '串联等效',
    prompt: '两个传递函数 G1、G2 串联后的等效传函是？',
    options: [
      { id: 'add', label: 'G1 + G2' },
      { id: 'mul', label: 'G1 * G2' },
      { id: 'ratio', label: 'G1 / G2' },
      { id: 'feedback', label: 'G1 / (1 + G1G2)' },
    ],
    answerId: 'mul',
    explanation: '串联结构等效为传递函数相乘。',
  },
  {
    id: 'feedback-equivalent',
    title: '负反馈等效',
    prompt: '前向通道 G、反馈通道 H 的负反馈闭环等效传函是？',
    options: [
      { id: 'open', label: 'G' },
      { id: 'sum', label: 'G + H' },
      { id: 'mul', label: 'G * H' },
      { id: 'closed', label: 'G / (1 + GH)' },
    ],
    answerId: 'closed',
    explanation: '标准负反馈闭环传递函数为 G / (1 + GH)。',
  },
];

interface BlockDiagramPrecheckProps extends BaseWidgetProps {}

export default function BlockDiagramPrecheck({ onComplete, onStateChange }: BlockDiagramPrecheckProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = QUIZ_ITEMS[currentIndex];
  const isLast = currentIndex === QUIZ_ITEMS.length - 1;

  const handleCheck = useCallback(() => {
    if (!selected) return;
    if (!checked) {
      const isCorrect = selected === current.answerId;
      if (isCorrect) {
        setScore((prev) => prev + 1);
      }
      setChecked(true);
      const nextScore = isCorrect ? score + 1 : score;
      const answeredCount = currentIndex + 1;
      const progressValue = Math.round((answeredCount / QUIZ_ITEMS.length) * 100);
      const snapshot = {
        progress: progressValue,
        data: { questionId: current.id, selected, isCorrect, score: nextScore },
        timestamp: Date.now(),
      };
      onStateChange?.(snapshot);
      interactive?.progress.setProgress(progressValue);
      interactive?.tracking.emit('submit', snapshot.data);
    }
  }, [selected, checked, current.answerId, current.id, currentIndex, onStateChange, score, interactive]);

  const handleNext = useCallback(() => {
    if (!checked) return;
    setChecked(false);
    setSelected(null);
    setCurrentIndex((prev) => Math.min(prev + 1, QUIZ_ITEMS.length - 1));
    interactive?.tracking.emit('interact', { action: 'next', nextIndex: currentIndex + 1 });
  }, [checked, currentIndex, interactive]);

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
    interactive?.progress.reset();
  }, [interactive, onStateChange]);

  const progressText = useMemo(
    () => `第 ${currentIndex + 1} / ${QUIZ_ITEMS.length} 题`,
    [currentIndex]
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">结构图速判</h2>
          <p className="text-sm text-slate-500">确认结构图元素与等效关系</p>
        </div>
        <div className="text-sm text-slate-500">{progressText}</div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">{current.title}</h3>
          <p className="text-sm text-slate-500">{current.prompt}</p>
        </div>

        <div className="space-y-3">
          {current.options.map((option) => {
            const isSelected = selected === option.id;
            const isCorrect = checked && option.id === current.answerId;
            const isWrong = checked && isSelected && option.id !== current.answerId;
            return (
              <button type="button"
                key={option.id}
                onClick={() => !checked && setSelected(option.id)}
                className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                } ${isCorrect ? 'border-emerald-500 bg-emerald-50' : ''} ${
                  isWrong ? 'border-rose-500 bg-rose-50' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{option.label}</span>
                  {isCorrect && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {isWrong && <XCircle className="h-4 w-4 text-rose-500" />}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button type="button"
            onClick={handleReset}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="flex items-center gap-3">
            {!checked ? (
              <button type="button"
                onClick={handleCheck}
                disabled={!selected}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                确认答案
              </button>
            ) : isLast ? (
              <PathResourceContinueAction
                enabled
                result={{
                  success: true,
                  score: Math.round((score / QUIZ_ITEMS.length) * 100),
                  data: { correct: score, total: QUIZ_ITEMS.length },
                }}
                onComplete={onComplete}
              />
            ) : (
              <button type="button"
                onClick={handleNext}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-40"
              >
                下一题
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {checked && (
          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            {current.explanation}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        当前得分：<span className="font-semibold text-slate-900">{score}</span> / {QUIZ_ITEMS.length}
      </div>
    </div>
  );
}

export { BlockDiagramPrecheck };
