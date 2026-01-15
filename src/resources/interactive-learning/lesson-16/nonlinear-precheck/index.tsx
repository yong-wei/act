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
  options: QuizOption[];
  answerId: string;
  explanation: string;
}

const QUIZ_ITEMS: QuizItem[] = [
  {
    id: 'nonlinear-superposition',
    title: '性质判断',
    prompt: '非线性系统区别于线性系统的核心特征是：',
    options: [
      { id: 'A', label: '不满足叠加原理' },
      { id: 'B', label: '只能用频域方法分析' },
      { id: 'C', label: '只能有一个平衡点' },
      { id: 'D', label: '响应一定为正弦波' },
    ],
    answerId: 'A',
    explanation: '非线性系统不满足叠加原理，因此线性系统的频域工具不能直接套用。',
  },
  {
    id: 'nonlinear-equilibrium',
    title: '稳定性判断',
    prompt: '关于非线性系统稳定性，下列说法正确的是：',
    options: [
      { id: 'A', label: '仅由结构参数决定，与初始条件无关' },
      { id: 'B', label: '与外作用、初始条件均有关' },
      { id: 'C', label: '稳定性只与输入频率有关' },
      { id: 'D', label: '所有平衡点稳定性一致' },
    ],
    answerId: 'B',
    explanation: '非线性系统可能存在多个平衡点，稳定性与初始条件和外作用有关。',
  },
  {
    id: 'nonlinear-oscillation',
    title: '自振识别',
    prompt: '非线性系统特有的运动现象是：',
    options: [
      { id: 'A', label: '稳态误差' },
      { id: 'B', label: '自持振荡' },
      { id: 'C', label: '过渡过程' },
      { id: 'D', label: '稳定性' },
    ],
    answerId: 'B',
    explanation: '非线性系统可在无外输入下产生稳定的周期运动，即自持振荡。',
  },
  {
    id: 'describing-function',
    title: '描述函数',
    prompt: '描述函数方法的核心近似是：',
    options: [
      { id: 'A', label: '只保留输出的基波分量' },
      { id: 'B', label: '只保留直流分量' },
      { id: 'C', label: '将系统等效为纯积分' },
      { id: 'D', label: '忽略非线性环节' },
    ],
    answerId: 'A',
    explanation: '描述函数法以输出的基波分量近似整体响应，得到幅值相关的等效频率特性。',
  },
];

interface NonlinearPrecheckProps extends BaseWidgetProps {}

export default function NonlinearPrecheck({ onComplete, onStateChange }: NonlinearPrecheckProps) {
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
            <p className="text-sm text-slate-500">前测 · 非线性系统基础</p>
            <h2 className="text-2xl font-bold text-slate-900">概念速判</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {currentIndex + 1}/{QUIZ_ITEMS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-700">
          <p className="text-sm leading-relaxed">{current.prompt}</p>
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
                className={`flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
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

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">解析</p>
          <p className="mt-2">{checked ? current.explanation : '请选择答案并点击“检查”。'}</p>
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
            <span className="text-xs text-slate-500">当前得分 {score}/{QUIZ_ITEMS.length}</span>
            <button
              onClick={handleCheck}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
            >
              检查
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
      </div>
    </div>
  );
}
