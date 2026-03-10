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
  formula?: string;
  options: QuizOption[];
  answerId: string;
  explanation: string;
}

const QUIZ_ITEMS: QuizItem[] = [
  {
    id: 'pd-zero',
    title: '串联校正要点',
    prompt: '比例-微分控制（PD）对二阶系统的典型影响是：',
    options: [
      { id: 'A', label: '增大阻尼比并引入零点' },
      { id: 'B', label: '减小阻尼比并删除零点' },
      { id: 'C', label: '不改变阻尼比但提高自然频率' },
      { id: 'D', label: '仅改变稳态误差，不改变动态特性' },
    ],
    answerId: 'A',
    explanation: 'PD 相当于串联校正，提升阻尼并引入零点，使响应更快、超调更小。',
  },
  {
    id: 'derivative-feedback',
    title: '输出微分反馈',
    prompt: '输出微分反馈（测速反馈）的主要特点是：',
    options: [
      { id: 'A', label: '增大阻尼比但不增加零点' },
      { id: 'B', label: '减小阻尼比并增加零点' },
      { id: 'C', label: '仅改变稳态误差' },
      { id: 'D', label: '使系统型别提升一级' },
    ],
    answerId: 'A',
    explanation: '测速反馈提高阻尼而不引入零点，结构更简洁。',
  },
  {
    id: 'feedforward-goal',
    title: '前馈补偿目标',
    prompt: '前馈补偿在时域校正中的主要目标是：',
    options: [
      { id: 'A', label: '提高稳态精度，改善斜坡误差' },
      { id: 'B', label: '增加系统阶数以提升速度' },
      { id: 'C', label: '让系统不需要反馈' },
      { id: 'D', label: '只用于抑制高频噪声' },
    ],
    answerId: 'A',
    explanation: '前馈补偿通过输入侧补偿提高稳态精度，尤其改善斜坡输入误差。',
  },
  {
    id: 'disturbance-comp',
    title: '扰动补偿条件',
    prompt: '按扰动补偿一般需要满足的条件是：',
    options: [
      { id: 'A', label: '可测或可估计扰动信号' },
      { id: 'B', label: '系统必须是非线性的' },
      { id: 'C', label: '控制器为纯积分环节' },
      { id: 'D', label: '输入必须为单位阶跃' },
    ],
    answerId: 'A',
    explanation: '扰动补偿依赖对扰动的测量或估计，才能进行抵消或削弱。',
  },
  {
    id: 'gain-range',
    title: '稳定范围判断',
    prompt: '航向系统案例中稳定的增益范围满足：',
    formula: '0 < K < 28.0469',
    options: [
      { id: 'A', label: '0 < K < 28.0469' },
      { id: 'B', label: 'K < 0' },
      { id: 'C', label: 'K > 28.0469' },
      { id: 'D', label: 'K 任意' },
    ],
    answerId: 'A',
    explanation: '由特征方程分析可得稳定增益范围为 0 < K < 28.0469。',
  },
];

interface CorrectionPrecheckProps extends BaseWidgetProps {}

function FormulaCard({ formula }: { formula?: string }) {
  if (!formula) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">提示公式：</span>
      <span className="ml-2 font-mono">{formula}</span>
    </div>
  );
}

export default function CorrectionPrecheck({ onComplete, onStateChange }: CorrectionPrecheckProps) {
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
            <p className="text-sm text-slate-500">前测 · 校正与时域基础</p>
            <h2 className="text-2xl font-bold text-slate-900">{current.title}</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {currentIndex + 1}/{QUIZ_ITEMS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-700">
          <p className="text-sm leading-relaxed">{current.prompt}</p>
        </div>

        <div className="mt-4">
          <FormulaCard formula={current.formula} />
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
                      ? 'border-rose-400 bg-rose-50 text-rose-700'
                      : isSelected
                        ? 'border-blue-400 bg-blue-50 text-blue-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <span>{option.id}. {option.label}</span>
                {checked && isCorrect && <CheckCircle2 className="h-4 w-4" />}
                {checked && isWrong && <XCircle className="h-4 w-4" />}
              </button>
            );
          })}
        </div>

        {checked && (
          <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-semibold text-slate-700">解析：</span>
            {current.explanation}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-500">当前得分 {score}/{QUIZ_ITEMS.length}</div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </button>
            {!checked ? (
              <button
                onClick={handleCheck}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-xs text-white"
              >
                提交
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-xs text-white"
                disabled={isLast}
              >
                {isLast ? '已完成' : '下一题'}
                {!isLast && <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
