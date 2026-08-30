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
    id: 'log-criterion',
    title: '对数判据',
    prompt: '在 Bode 图上，|G(jω)| 穿越 0 dB 时，相位曲线从下向上穿越 -180° 属于：',
    options: [
      { id: 'A', label: '正穿越' },
      { id: 'B', label: '负穿越' },
      { id: 'C', label: '与穿越方向无关' },
      { id: 'D', label: '只表示幅值穿越' },
    ],
    answerId: 'A',
    explanation: '对数判据中，从下向上穿越 -180° 视为正穿越。',
  },
  {
    id: 'half-nyquist',
    title: '半奈奎斯特曲线',
    prompt: '工程上常绘制半 Nyquist 曲线的原因是：',
    options: [
      { id: 'A', label: '负频段与正频段共轭对称，可由一半补齐' },
      { id: 'B', label: '只要右半平面即可' },
      { id: 'C', label: '负频段不影响稳定性' },
      { id: 'D', label: '简化计算但会牺牲准确性' },
    ],
    answerId: 'A',
    explanation: '频率响应满足共轭对称，半曲线即可确定完整轨迹。',
  },
  {
    id: 'stability-condition',
    title: '判稳结论',
    prompt: '若 N 表示逆时针包围 -1 的次数，P 为右半平面开环极点数，闭环稳定条件是：',
    options: [
      { id: 'A', label: 'N = 0' },
      { id: 'B', label: 'N = P' },
      { id: 'C', label: 'N = -P' },
      { id: 'D', label: 'N = Z + P' },
    ],
    answerId: 'B',
    explanation: '稳定需 Z=0，因此 N=P（逆时针包围次数等于右半平面开环极点数）。',
  },
];

interface PhaseStabilityExitQuizProps extends BaseWidgetProps {}

export default function PhaseStabilityExitQuiz({ onComplete, onStateChange }: PhaseStabilityExitQuizProps) {
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
            <p className="text-sm text-slate-500">后测 · 稳定判据复盘</p>
            <h2 className="text-2xl font-bold text-slate-900">结课速测</h2>
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
