'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
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
  chartId: string;
  options: QuizOption[];
  answerId: string;
  explanation: string;
}

const QUIZ_ITEMS: QuizItem[] = [
  {
    id: 'lowpass',
    title: '典型环节识别',
    prompt: '幅频斜率从 0 变为 -20 dB/dec 的曲线通常对应：',
    chartId: 'lowpass',
    options: [
      { id: 'A', label: '比例环节' },
      { id: 'B', label: '一阶惯性环节' },
      { id: 'C', label: '积分环节' },
      { id: 'D', label: '二阶振荡环节' },
    ],
    answerId: 'B',
    explanation: '一阶惯性环节在转折频率后斜率下降 20 dB/dec。',
  },
  {
    id: 'integrator-pole',
    title: '多环节叠加',
    prompt: '低频段斜率 -20 dB/dec，高频段 -40 dB/dec 的组合更像：',
    chartId: 'integrator-pole',
    options: [
      { id: 'A', label: '积分环节 + 一阶惯性' },
      { id: 'B', label: '比例环节 + 一阶微分' },
      { id: 'C', label: '二阶振荡环节' },
      { id: 'D', label: '纯比例环节' },
    ],
    answerId: 'A',
    explanation: '积分环节提供 -20 dB/dec，再叠加一阶惯性使斜率下降至 -40 dB/dec。',
  },
  {
    id: 'lead',
    title: '零点影响',
    prompt: '幅频斜率从 0 增加到 +20 dB/dec 的曲线说明存在：',
    chartId: 'lead',
    options: [
      { id: 'A', label: '一阶极点' },
      { id: 'B', label: '一阶零点' },
      { id: 'C', label: '积分环节' },
      { id: 'D', label: '纯比例' },
    ],
    answerId: 'B',
    explanation: '一阶零点会让斜率在转折频率后上升 +20 dB/dec。',
  },
  {
    id: 'resonance',
    title: '谐振峰识别',
    prompt: '幅频曲线出现明显峰值且相位急剧变化的情形常见于：',
    chartId: 'resonance',
    options: [
      { id: 'A', label: '一阶惯性环节' },
      { id: 'B', label: '二阶振荡环节' },
      { id: 'C', label: '积分环节' },
      { id: 'D', label: '比例环节' },
    ],
    answerId: 'B',
    explanation: '欠阻尼二阶系统会在共振频率附近出现幅值峰值。',
  },
];

const CHARTS: Record<string, ReactElement> = {
  lowpass: (
    <svg viewBox="0 0 320 160" className="h-32 w-full">
      <rect width="320" height="160" rx="12" fill="#0f172a" />
      <polyline
        points="40,50 160,50 280,110"
        fill="none"
        stroke="#38bdf8"
        strokeWidth="4"
      />
      <line x1="160" y1="30" x2="160" y2="130" stroke="#334155" strokeDasharray="6 6" />
      <text x="14" y="140" fill="#64748b" fontSize="10">log ω</text>
      <text x="10" y="20" fill="#64748b" fontSize="10">|G| dB</text>
    </svg>
  ),
  'integrator-pole': (
    <svg viewBox="0 0 320 160" className="h-32 w-full">
      <rect width="320" height="160" rx="12" fill="#0f172a" />
      <polyline
        points="40,50 120,90 220,130"
        fill="none"
        stroke="#f97316"
        strokeWidth="4"
      />
      <line x1="120" y1="30" x2="120" y2="130" stroke="#334155" strokeDasharray="6 6" />
      <text x="14" y="140" fill="#64748b" fontSize="10">log ω</text>
      <text x="10" y="20" fill="#64748b" fontSize="10">|G| dB</text>
    </svg>
  ),
  lead: (
    <svg viewBox="0 0 320 160" className="h-32 w-full">
      <rect width="320" height="160" rx="12" fill="#0f172a" />
      <polyline
        points="40,110 160,110 280,60"
        fill="none"
        stroke="#22c55e"
        strokeWidth="4"
      />
      <line x1="160" y1="30" x2="160" y2="130" stroke="#334155" strokeDasharray="6 6" />
      <text x="14" y="140" fill="#64748b" fontSize="10">log ω</text>
      <text x="10" y="20" fill="#64748b" fontSize="10">|G| dB</text>
    </svg>
  ),
  resonance: (
    <svg viewBox="0 0 320 160" className="h-32 w-full">
      <rect width="320" height="160" rx="12" fill="#0f172a" />
      <polyline
        points="40,110 120,90 180,40 240,90 300,110"
        fill="none"
        stroke="#a855f7"
        strokeWidth="4"
      />
      <line x1="180" y1="30" x2="180" y2="130" stroke="#334155" strokeDasharray="6 6" />
      <text x="14" y="140" fill="#64748b" fontSize="10">log ω</text>
      <text x="10" y="20" fill="#64748b" fontSize="10">|G| dB</text>
    </svg>
  ),
};

interface BodePlotRecognitionProps extends BaseWidgetProps {}

export default function BodePlotRecognition({ onComplete, onStateChange }: BodePlotRecognitionProps) {
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
            <p className="text-sm text-slate-500">参与式 · 读图反推</p>
            <h2 className="text-2xl font-bold text-slate-900">伯德图识别练习</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {currentIndex + 1}/{QUIZ_ITEMS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-700">
          <p className="text-sm leading-relaxed">{current.prompt}</p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-900 p-4">
          {CHARTS[current.chartId]}
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
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
                checked && !isLast
                  ? 'bg-emerald-600 text-white'
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
