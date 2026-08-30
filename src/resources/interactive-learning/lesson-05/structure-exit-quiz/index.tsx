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
    id: 'move-rule',
    title: '移位规则',
    prompt: '引出点后移越过传递函数 G，需要怎样处理？',
    options: [
      { id: 'divide', label: '除以 G' },
      { id: 'multiply', label: '乘以 G' },
      { id: 'ignore', label: '无需处理' },
      { id: 'invert', label: '替换为 1/G 并反向' },
    ],
    answerId: 'multiply',
    explanation: '引出点后移时需乘以跨越的传递函数，保持信号不变。',
  },
  {
    id: 'signal-flow',
    title: '信号流图',
    prompt: '信号流图中节点代表的是？',
    options: [
      { id: 'device', label: '物理元件' },
      { id: 'variable', label: '系统变量/信号' },
      { id: 'controller', label: '控制器' },
      { id: 'equation', label: '微分方程' },
    ],
    answerId: 'variable',
    explanation: '信号流图节点是变量，支路是变量之间的传递关系。',
  },
  {
    id: 'mason-cofactor',
    title: '梅森公式',
    prompt: '余子式 Delta_k 的含义是？',
    options: [
      { id: 'loop-sum', label: '所有回路增益之和' },
      { id: 'path-gain', label: '前向通路增益' },
      { id: 'path-delta', label: '去掉与该通路相接触回路后的特征式' },
      { id: 'total-delta', label: '特征式 Delta 本身' },
    ],
    answerId: 'path-delta',
    explanation: 'Delta_k 需排除与该前向通路相接触的回路。',
  },
];

interface StructureExitQuizProps extends BaseWidgetProps {}

export default function StructureExitQuiz({ onComplete, onStateChange }: StructureExitQuizProps) {
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
          <h2 className="text-2xl font-bold text-slate-900">结构图与梅森公式后测</h2>
          <p className="text-sm text-slate-500">3 题快速验收</p>
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
