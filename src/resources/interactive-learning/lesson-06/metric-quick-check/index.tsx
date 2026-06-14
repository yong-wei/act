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
  highlight: 'rise' | 'peak' | 'settling' | 'overshoot';
  options: QuizOption[];
  answerId: string;
  explanation: string;
}

const QUIZ_ITEMS: QuizItem[] = [
  {
    id: 'rise-time',
    title: '上升时间',
    prompt: '识别曲线从 10% 上升到 90% 的时间区间。',
    highlight: 'rise',
    options: [
      { id: 'rise', label: '上升时间 t_r' },
      { id: 'peak', label: '峰值时间 t_p' },
      { id: 'settling', label: '调节时间 t_s' },
      { id: 'overshoot', label: '超调量 σ%' },
    ],
    answerId: 'rise',
    explanation: '上升时间衡量系统达到主要目标区间的速度。',
  },
  {
    id: 'peak-time',
    title: '峰值时间',
    prompt: '识别曲线第一次达到最大值时的时间点。',
    highlight: 'peak',
    options: [
      { id: 'rise', label: '上升时间 t_r' },
      { id: 'peak', label: '峰值时间 t_p' },
      { id: 'settling', label: '调节时间 t_s' },
      { id: 'overshoot', label: '超调量 σ%' },
    ],
    answerId: 'peak',
    explanation: '峰值时间记录“冲到最高点”的时刻。',
  },
  {
    id: 'settling-time',
    title: '调节时间',
    prompt: '识别曲线进入并保持在 5% 误差带的时刻。',
    highlight: 'settling',
    options: [
      { id: 'rise', label: '上升时间 t_r' },
      { id: 'peak', label: '峰值时间 t_p' },
      { id: 'settling', label: '调节时间 t_s' },
      { id: 'overshoot', label: '超调量 σ%' },
    ],
    answerId: 'settling',
    explanation: '调节时间代表系统稳定下来的速度。',
  },
  {
    id: 'overshoot',
    title: '超调量',
    prompt: '识别峰值超过目标值的幅度。',
    highlight: 'overshoot',
    options: [
      { id: 'rise', label: '上升时间 t_r' },
      { id: 'peak', label: '峰值时间 t_p' },
      { id: 'settling', label: '调节时间 t_s' },
      { id: 'overshoot', label: '超调量 σ%' },
    ],
    answerId: 'overshoot',
    explanation: '超调量衡量“冲过头”的程度。',
  },
];

interface MetricQuickCheckProps extends BaseWidgetProps {}

function MetricSketch({ highlight }: { highlight: QuizItem['highlight'] }) {
  const points = [
    { x: 20, y: 120 },
    { x: 60, y: 90 },
    { x: 95, y: 55 },
    { x: 130, y: 80 },
    { x: 170, y: 92 },
    { x: 230, y: 95 },
  ];
  const path = points.map((pt, index) => `${index === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const finalY = 95;
  const peak = points[2];

  return (
    <svg viewBox="0 0 260 140" className="w-full h-full">
      <rect x="0" y="0" width="260" height="140" fill="#0f172a" rx="12" />
      <line x1="10" y1={finalY} x2="250" y2={finalY} stroke="#1f2937" strokeDasharray="6 6" />
      <path d={path} stroke="#38bdf8" strokeWidth="3" fill="none" />

      {highlight === 'rise' && (
        <path
          d={`M ${points[0].x} ${points[0].y} L ${points[2].x} ${points[2].y}`}
          stroke="#22c55e"
          strokeWidth="5"
          fill="none"
        />
      )}

      {highlight === 'peak' && (
        <circle cx={peak.x} cy={peak.y} r="7" fill="#f97316" stroke="#fde68a" strokeWidth="3" />
      )}

      {highlight === 'settling' && (
        <rect x="160" y={finalY - 6} width="70" height="12" fill="rgba(59,130,246,0.25)" />
      )}

      {highlight === 'overshoot' && (
        <g>
          <line x1={peak.x + 12} y1={finalY} x2={peak.x + 12} y2={peak.y} stroke="#f43f5e" strokeWidth="3" />
          <circle cx={peak.x + 12} cy={finalY} r="4" fill="#f43f5e" />
          <circle cx={peak.x + 12} cy={peak.y} r="4" fill="#f43f5e" />
        </g>
      )}

      <text x="14" y="22" fill="#94a3b8" fontSize="12">响应曲线</text>
      <text x="180" y="132" fill="#475569" fontSize="10">时间</text>
    </svg>
  );
}

export default function MetricQuickCheck({ onComplete, onStateChange }: MetricQuickCheckProps) {
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
      if (isLast) {
        const result: WidgetResult = {
          success: true,
          score: Math.round((nextScore / QUIZ_ITEMS.length) * 100),
          data: { correct: nextScore, total: QUIZ_ITEMS.length },
        };
        interactive?.progress.markComplete(result);
        onComplete?.(result);
      }
    }
  }, [
    selected,
    checked,
    current.answerId,
    current.id,
    currentIndex,
    isLast,
    onComplete,
    onStateChange,
    score,
    interactive,
  ]);

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
          <h2 className="text-2xl font-bold text-slate-900">指标速判</h2>
          <p className="text-sm text-slate-500">快速识别时域性能指标位置</p>
        </div>
        <div className="text-sm text-slate-500">{progressText}</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="aspect-[13/7] rounded-xl overflow-hidden">
            <MetricSketch highlight={current.highlight} />
          </div>
          <div className="mt-4">
            <div className="text-xs uppercase tracking-wide text-slate-400">裁判提示</div>
            <p className="mt-2 text-sm text-slate-600">{current.prompt}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-slate-900">{current.title}</h3>
            <p className="text-sm text-slate-500">选择最符合的指标名称</p>
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
              ) : (
                <button type="button"
                  onClick={handleNext}
                  disabled={isLast}
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
      </div>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
        当前得分：<span className="font-semibold text-slate-900">{score}</span> / {QUIZ_ITEMS.length}
      </div>
    </div>
  );
}

export { MetricQuickCheck };
