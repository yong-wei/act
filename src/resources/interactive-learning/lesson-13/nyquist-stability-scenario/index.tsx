'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface ScenarioOption {
  id: string;
  label: string;
}

interface ScenarioItem {
  id: string;
  title: string;
  prompt: string;
  plot: ReactElement;
  options: ScenarioOption[];
  answerId: string;
  explanation: string;
}

function AxisPlot({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 320 200" className="h-36 w-full">
      <rect width="320" height="200" rx="14" fill="#0f172a" />
      <line x1="40" y1="100" x2="300" y2="100" stroke="#334155" strokeWidth="2" />
      <line x1="170" y1="20" x2="170" y2="180" stroke="#334155" strokeWidth="2" strokeDasharray="6 6" />
      <circle cx="110" cy="100" r="4" fill="#ef4444" />
      <text x="96" y="118" fill="#f87171" fontSize="10">-1</text>
      <text x="286" y="90" fill="#64748b" fontSize="10">Re</text>
      <text x="178" y="32" fill="#64748b" fontSize="10">Im</text>
      {children}
    </svg>
  );
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: 'case-1',
    title: '场景 1：P=0, N=0',
    prompt: 'Nyquist 曲线未包围 -1 点（N 为逆时针包围次数）。闭环稳定性如何？',
    plot: (
      <AxisPlot>
        <path
          d="M200 100 C240 40, 280 40, 280 100 C280 160, 240 160, 200 100"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="4"
        />
        <circle cx="200" cy="100" r="3" fill="#38bdf8" />
      </AxisPlot>
    ),
    options: [
      { id: 'A', label: '稳定（Z=0）' },
      { id: 'B', label: '不稳定（Z=1）' },
      { id: 'C', label: '不稳定（Z=2）' },
      { id: 'D', label: '无法判断' },
    ],
    answerId: 'A',
    explanation: 'N=0, P=0 → Z=P-N=0，闭环稳定。',
  },
  {
    id: 'case-2',
    title: '场景 2：P=1, N=1',
    prompt: 'Nyquist 曲线逆时针包围 -1 一次（N=1）。闭环稳定性如何？',
    plot: (
      <AxisPlot>
        <path
          d="M110 40 C60 40, 40 90, 60 130 C90 170, 140 160, 150 110 C160 70, 140 40, 110 40"
          fill="none"
          stroke="#22c55e"
          strokeWidth="4"
        />
        <circle cx="110" cy="100" r="3" fill="#22c55e" />
      </AxisPlot>
    ),
    options: [
      { id: 'A', label: '稳定（Z=0）' },
      { id: 'B', label: '不稳定（Z=1）' },
      { id: 'C', label: '不稳定（Z=2）' },
      { id: 'D', label: '无法判断' },
    ],
    answerId: 'A',
    explanation: 'N=1, P=1 → Z=P-N=0，闭环稳定。',
  },
  {
    id: 'case-3',
    title: '场景 3：P=2, N=1',
    prompt: 'Nyquist 曲线逆时针包围 -1 一次（N=1）。闭环稳定性如何？',
    plot: (
      <AxisPlot>
        <path
          d="M110 50 C60 50, 40 95, 55 135 C75 175, 125 170, 145 120 C160 80, 140 50, 110 50"
          fill="none"
          stroke="#f97316"
          strokeWidth="4"
        />
        <path
          d="M215 100 C255 60, 290 60, 290 100 C290 140, 255 140, 215 100"
          fill="none"
          stroke="#f97316"
          strokeWidth="4"
          strokeDasharray="8 6"
        />
      </AxisPlot>
    ),
    options: [
      { id: 'A', label: '稳定（Z=0）' },
      { id: 'B', label: '不稳定（Z=1）' },
      { id: 'C', label: '不稳定（Z=2）' },
      { id: 'D', label: '无法判断' },
    ],
    answerId: 'B',
    explanation: 'N=1, P=2 → Z=P-N=1，闭环仍有 1 个右半平面极点。',
  },
];

interface NyquistStabilityScenarioProps extends BaseWidgetProps {}

export default function NyquistStabilityScenario({ onComplete, onStateChange }: NyquistStabilityScenarioProps) {
  const interactive = useOptionalInteractiveContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);

  const current = SCENARIOS[currentIndex];
  const isLast = currentIndex === SCENARIOS.length - 1;
  const progress = useMemo(
    () => Math.round(((currentIndex + (checked ? 1 : 0)) / SCENARIOS.length) * 100),
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
      data: { scenarioId: current.id, selected, isCorrect, score: nextScore },
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
    setCurrentIndex((prev) => Math.min(prev + 1, SCENARIOS.length - 1));
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
            <p className="text-sm text-slate-500">参与式 · Nyquist 判稳场景</p>
            <h2 className="text-2xl font-bold text-slate-900">稳定性情境判断</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {currentIndex + 1}/{SCENARIOS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-700">
          <p className="text-sm leading-relaxed">{current.prompt}</p>
          <p className="mt-2 text-xs text-slate-500">提示：按 N 为逆时针包围次数，Z = P - N。</p>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
          {current.plot}
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
            <span className="text-xs text-slate-500">当前得分 {score}/{SCENARIOS.length}</span>
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
            >
              下一题
              <ChevronRight className="h-4 w-4" />
            </button>
            {checked && isLast ? (
              <PathResourceContinueAction
                enabled
                result={{
                  success: true,
                  score: Math.round((score / SCENARIOS.length) * 100),
                  data: { correct: score, total: SCENARIOS.length },
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
