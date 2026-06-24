'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface WorkshopOption {
  id: string;
  label: string;
}

interface WorkshopCase {
  id: string;
  title: string;
  context: string;
  goal: string;
  options: WorkshopOption[];
  answerId: string;
  explanation: string;
}

const CASES: WorkshopCase[] = [
  {
    id: 'proportional',
    title: '案例 01 · G(s)=K',
    context: '传递函数为常数增益。',
    goal: '识别对应的典型环节。',
    options: [
      { id: 'A', label: '比例环节' },
      { id: 'B', label: '积分环节' },
      { id: 'C', label: '微分环节' },
      { id: 'D', label: '一阶惯性环节' },
    ],
    answerId: 'A',
    explanation: '常数增益对应比例环节，输出与输入成比例。',
  },
  {
    id: 'integral',
    title: '案例 02 · G(s)=K/s',
    context: '分母含 s，系统具有累积效应。',
    goal: '识别对应的典型环节。',
    options: [
      { id: 'A', label: '比例环节' },
      { id: 'B', label: '积分环节' },
      { id: 'C', label: '微分环节' },
      { id: 'D', label: '二阶振荡环节' },
    ],
    answerId: 'B',
    explanation: 'G(s)=K/s 是标准积分环节，对应输入的累积。',
  },
  {
    id: 'first-order',
    title: '案例 03 · G(s)=1/(Ts+1)',
    context: '系统对输入有滞后，存在时间常数 T。',
    goal: '识别对应的典型环节。',
    options: [
      { id: 'A', label: '微分环节' },
      { id: 'B', label: '一阶惯性环节' },
      { id: 'C', label: '二阶振荡环节' },
      { id: 'D', label: '比例环节' },
    ],
    answerId: 'B',
    explanation: '1/(Ts+1) 是一阶惯性环节，体现滞后响应。',
  },
  {
    id: 'second-order',
    title: '案例 04 · 二阶标准型',
    context: 'G(s)=ω_n²/(s²+2ζω_n s+ω_n²)。',
    goal: '识别对应的典型环节。',
    options: [
      { id: 'A', label: '二阶振荡环节' },
      { id: 'B', label: '积分环节' },
      { id: 'C', label: '比例环节' },
      { id: 'D', label: '微分环节' },
    ],
    answerId: 'A',
    explanation: '该形式对应二阶振荡环节，阻尼比决定超调与振荡程度。',
  },
];

interface TransferElementWorkshopProps extends BaseWidgetProps {}

export default function TransferElementWorkshop({ onComplete, onStateChange }: TransferElementWorkshopProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = CASES[currentIndex];
  const isLast = currentIndex === CASES.length - 1;
  const progress = useMemo(
    () => Math.round(((currentIndex + (checked ? 1 : 0)) / CASES.length) * 100),
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
      data: { caseId: current.id, selected, isCorrect, score: nextScore },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progress);
    interactive?.tracking.emit('submit', snapshot.data);

    if (isLast) {
      const result: WidgetResult = {
        success: true,
        score: Math.round((nextScore / CASES.length) * 100),
        data: { correct: nextScore, total: CASES.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [checked, selected, current.answerId, current.id, isLast, onComplete, onStateChange, score, progress, interactive]);

  const handleNext = useCallback(() => {
    if (!checked || isLast) return;
    setChecked(false);
    setSelected(null);
    setCurrentIndex((prev) => Math.min(prev + 1, CASES.length - 1));
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
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">互动 · 典型环节识别</p>
            <h2 className="text-2xl font-bold text-slate-900">环节速判工作坊</h2>
          </div>
          <div className="text-sm text-slate-500">案例 {currentIndex + 1}/{CASES.length}</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-700">{current.title}</div>
            <p className="mt-3 text-sm text-slate-600">{current.context}</p>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              目标：{current.goal}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700">选择环节类型</p>
            <div className="mt-3 grid gap-2">
              {current.options.map((option) => {
                const isSelected = selected === option.id;
                const isCorrect = checked && option.id === current.answerId;
                const isWrong = checked && isSelected && option.id !== current.answerId;
                return (
                  <button type="button"
                    key={option.id}
                    onClick={() => !checked && setSelected(option.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
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
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-700">点评</p>
          <p className="mt-2">{checked ? current.explanation : '完成选择后点击“检查”。'}</p>
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
            <span className="text-xs text-slate-500">当前得分 {score}/{CASES.length}</span>
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
