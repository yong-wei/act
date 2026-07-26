'use client';

import { useCallback, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, XCircle, RotateCcw, ChevronRight, Loader2 } from 'lucide-react';
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
    id: 'lead-feature',
    title: '概念速判',
    prompt: '超前网络对开环频率特性的主要影响是：',
    options: [
      { id: 'A', label: '相角超前且幅值抬升，提高相角裕度' },
      { id: 'B', label: '相角滞后且幅值衰减，提高稳态精度' },
      { id: 'C', label: '仅改变稳态误差，不影响相位' },
      { id: 'D', label: '仅改变高频噪声，不影响穿越频率' },
    ],
    answerId: 'A',
    explanation: '超前网络带来相角超前并抬升幅值曲线，用于提升相角裕度与响应速度。',
  },
  {
    id: 'lag-purpose',
    title: '概念速判',
    prompt: '滞后网络更适合用于：',
    options: [
      { id: 'A', label: '相角裕度不足、需提高动态速度' },
      { id: 'B', label: '稳态误差偏大、相角裕度已有余量' },
      { id: 'C', label: '带宽过高、需要相位超前' },
      { id: 'D', label: '希望增加高频噪声放大' },
    ],
    answerId: 'B',
    explanation: '滞后网络通过低频增益提升稳态精度，但会带来相位滞后，适用于相角裕度有余的场景。',
  },
  {
    id: 'lead-max-phase',
    title: '设计要点',
    prompt: '超前网络最大相角超前 phi_max 与参数 a 的关系为：',
    options: [
      { id: 'A', label: 'phi_max = -pi/2' },
      { id: 'B', label: 'phi_max = pi/4' },
      { id: 'C', label: 'phi_max = sin^{-1}((1-a)/(1+a))' },
      { id: 'D', label: 'phi_max = cos^{-1}((1-a)/(1+a))' },
    ],
    answerId: 'C',
    explanation: '一级超前网络最大超前角满足 phi_max = sin^{-1}((1-a)/(1+a))。',
  },
  {
    id: 'lag-lead-use',
    title: '策略判断',
    prompt: '当“稳态误差偏大且相角裕度不足”时，最合适的校正策略是：',
    options: [
      { id: 'A', label: '仅使用超前网络' },
      { id: 'B', label: '仅使用滞后网络' },
      { id: 'C', label: '滞后-超前联合校正' },
      { id: 'D', label: '不做校正' },
    ],
    answerId: 'C',
    explanation: '滞后-超前联合校正兼顾稳态精度与相角裕度，适合双目标同时不足的情况。',
  },
];

interface SeriesPrecheckProps extends BaseWidgetProps {}

export default function SeriesPrecheck({ onComplete, onStateChange }: SeriesPrecheckProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const completionInFlight = useRef(false);

  const current = QUIZ_ITEMS[currentIndex];
  const isLast = currentIndex === QUIZ_ITEMS.length - 1;
  const handleCheck = useCallback(() => {
    if (!selected || checked) return;
    const isCorrect = selected === current.answerId;
    if (isCorrect) {
      setScore((prev) => prev + 1);
    }
    setChecked(true);

    const nextScore = isCorrect ? score + 1 : score;
    const answeredProgress = Math.round(((currentIndex + 1) / QUIZ_ITEMS.length) * 100);
    const snapshot = {
      progress: answeredProgress,
      data: { questionId: current.id, selected, isCorrect, score: nextScore },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(answeredProgress);
    interactive?.tracking.emit('submit', snapshot.data);
  }, [checked, selected, current.answerId, current.id, currentIndex, onStateChange, score, interactive]);

  const handleComplete = useCallback(async () => {
    if (!checked || !isLast || completionInFlight.current || completionStatus === 'success') return;

    completionInFlight.current = true;
    setCompletionStatus('submitting');
    const result: WidgetResult = {
      success: true,
      score: Math.round((score / QUIZ_ITEMS.length) * 100),
      data: { correct: score, total: QUIZ_ITEMS.length },
    };

    try {
      await onComplete?.(result);
      interactive?.progress.markComplete(result);
      interactive?.tracking.emit('complete', result.data);
      setCompletionStatus('success');
    } catch (error) {
      console.error('Failed to complete series precheck', error);
      completionInFlight.current = false;
      setCompletionStatus('error');
    }
  }, [checked, completionStatus, interactive, isLast, onComplete, score]);

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
    setCompletionStatus('idle');
    completionInFlight.current = false;
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
            <p className="text-sm text-slate-500">前测 · 串联校正基础</p>
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
            disabled={completionStatus === 'submitting'}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs text-slate-500 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            重新开始
          </button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">当前得分 {score}/{QUIZ_ITEMS.length}</span>
            {!checked ? (
              <button type="button"
                onClick={handleCheck}
                disabled={!selected}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs text-white disabled:bg-slate-200 disabled:text-slate-500"
              >
                检查
              </button>
            ) : isLast ? (
              <button type="button"
                onClick={handleComplete}
                disabled={completionStatus === 'submitting' || completionStatus === 'success'}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white disabled:bg-slate-200 disabled:text-slate-500"
              >
                {completionStatus === 'submitting' && <Loader2 className="h-4 w-4 animate-spin" />}
                {completionStatus === 'submitting'
                  ? '正在提交'
                  : completionStatus === 'error'
                    ? '重试完成检测'
                    : completionStatus === 'success'
                      ? '检测已完成'
                      : '完成检测'}
              </button>
            ) : (
              <button type="button"
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs text-white"
              >
                下一题
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {completionStatus === 'success' && (
          <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <div className="flex items-center gap-2 font-medium">
              <CheckCircle2 className="h-4 w-4" />
              检测结果已保存
            </div>
            <p className="mt-1">本次得分 {score}/{QUIZ_ITEMS.length}，可以返回学习路径继续学习。</p>
          </div>
        )}
        {completionStatus === 'error' && (
          <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <div className="flex items-center gap-2 font-medium">
              <AlertCircle className="h-4 w-4" />
              检测结果提交失败
            </div>
            <p className="mt-1">请检查网络后点击“重试完成检测”。</p>
          </div>
        )}
      </div>
    </div>
  );
}
