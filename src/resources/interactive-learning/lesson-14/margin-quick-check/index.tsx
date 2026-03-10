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
    id: 'phase-margin',
    title: '概念速判',
    prompt: '相角裕度的定义是：',
    options: [
      { id: 'A', label: '相位穿越频率处的增益大小' },
      { id: 'B', label: '增益穿越频率处相位与 -180° 的距离' },
      { id: 'C', label: '0 dB 线与幅频曲线的最大间距' },
      { id: 'D', label: '闭环带宽的大小' },
    ],
    answerId: 'B',
    explanation: '相角裕度是在 |G(jω)|=1 的频率处，距离 -180° 的相位差。',
  },
  {
    id: 'gain-margin',
    title: '概念速判',
    prompt: '幅值裕度（增益裕度）对应的是：',
    options: [
      { id: 'A', label: '相位穿越频率处幅值与 1 (0 dB) 的距离' },
      { id: 'B', label: '增益穿越频率处相位与 0° 的距离' },
      { id: 'C', label: 'Nyquist 曲线与原点距离' },
      { id: 'D', label: 'Bode 图斜率的变化幅度' },
    ],
    answerId: 'A',
    explanation: '在 φ=-180° 的频率处，幅值距离 1 的余量即幅值裕度。',
  },
  {
    id: 'crossover',
    title: '穿越频率',
    prompt: '增益穿越频率 ω_g 的判据是：',
    options: [
      { id: 'A', label: '相位曲线穿越 -90°' },
      { id: 'B', label: '相位曲线穿越 -180°' },
      { id: 'C', label: '幅频曲线穿越 0 dB' },
      { id: 'D', label: '幅频曲线斜率为 -40 dB/dec' },
    ],
    answerId: 'C',
    explanation: '增益穿越频率定义为 |G(jω)| = 1，对应 0 dB。',
  },
  {
    id: 'three-band',
    title: '三频段理解',
    prompt: '三频段对应的主要性能目标组合是：',
    options: [
      { id: 'A', label: '低频段-动态性能，中频段-稳态误差，高频段-稳定裕度' },
      { id: 'B', label: '低频段-稳态误差，中频段-动态性能，高频段-抗噪能力' },
      { id: 'C', label: '低频段-抗噪能力，中频段-稳态误差，高频段-动态性能' },
      { id: 'D', label: '低频段-相角裕度，中频段-幅值裕度，高频段-闭环带宽' },
    ],
    answerId: 'B',
    explanation: '低频段影响稳态误差，中频段决定动态性能，高频段关乎抗噪与鲁棒性。',
  },
];

interface MarginQuickCheckProps extends BaseWidgetProps {}

export default function MarginQuickCheck({ onComplete, onStateChange }: MarginQuickCheckProps) {
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
            <p className="text-sm text-slate-500">前测 · 稳定裕度基础</p>
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
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
                checked && !isLast
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-200 text-slate-500'
              }`}
              disabled={!checked || isLast}
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
