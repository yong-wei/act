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
    id: 'structure',
    title: '结构前提',
    prompt: '描述函数法适用于下列哪种结构？',
    options: [
      { id: 'A', label: '多个非线性环节串联的系统' },
      { id: 'B', label: '一个非线性环节 + 线性部分串联' },
      { id: 'C', label: '纯线性系统' },
      { id: 'D', label: '纯非线性系统无反馈' },
    ],
    answerId: 'B',
    explanation: '典型描述函数法假设系统可化为单一非线性环节与线性部分串联。',
  },
  {
    id: 'negative-inverse',
    title: '负倒描述函数',
    prompt: '负倒描述函数 -1/N(A) 的几何意义是：',
    options: [
      { id: 'A', label: '输入的频率响应' },
      { id: 'B', label: '描述函数在复平面上的等效轨迹' },
      { id: 'C', label: '线性部分的 Bode 曲线' },
      { id: 'D', label: '系统的根轨迹' },
    ],
    answerId: 'B',
    explanation: '把 N(A) 的负倒数绘制在复平面上，用于与 G(jω) 进行交点判别。',
  },
  {
    id: 'limit-cycle',
    title: '自振条件',
    prompt: '自振存在的必要条件是：',
    options: [
      { id: 'A', label: 'G(jω) 与 -1/N(A) 有交点' },
      { id: 'B', label: 'G(jω) 不包围 -1/N(A)' },
      { id: 'C', label: '系统相位裕度大于 60°' },
      { id: 'D', label: '系统一定稳定' },
    ],
    answerId: 'A',
    explanation: '交点表示满足 N(A)G(jω)=-1，是自振的必要条件。',
  },
  {
    id: 'stability',
    title: '稳定性判断',
    prompt: '自振稳定性常用的判断方法是：',
    options: [
      { id: 'A', label: '微小扰动分析法' },
      { id: 'B', label: '零极点映射' },
      { id: 'C', label: '梅森公式' },
      { id: 'D', label: '高频增益法' },
    ],
    answerId: 'A',
    explanation: '微小扰动分析用于判断交点对应的振幅是否稳定收敛。',
  },
];

interface DfPrecheckProps extends BaseWidgetProps {}

export default function DfPrecheck({ onComplete, onStateChange }: DfPrecheckProps) {
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

  }, [checked, selected, current.answerId, current.id, onStateChange, score, progress, interactive]);

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
            <p className="text-sm text-slate-500">前测 · 描述函数分析</p>
            <h2 className="text-2xl font-bold text-slate-900">判别要点速查</h2>
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
              <button type="button"
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
          <button type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">当前得分 {score}/{QUIZ_ITEMS.length}</span>
            <button type="button"
              onClick={handleCheck}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white"
            >
              检查
            </button>
            <button type="button"
              onClick={handleNext}
              disabled={!checked || isLast}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white disabled:opacity-40"
            >
              下一题
              <ChevronRight className="h-4 w-4" />
            </button>
            {checked && isLast ? (
              <PathResourceContinueAction
                enabled
                result={{
                  success: true,
                  score: Math.round((score / QUIZ_ITEMS.length) * 100),
                  data: { correct: score, total: QUIZ_ITEMS.length },
                }}
                onComplete={onComplete}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
