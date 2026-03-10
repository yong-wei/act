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
    id: 'freq-response-meaning',
    title: '频率响应含义',
    prompt: '频率响应描述的是系统在什么输入下的稳态输出特性？',
    options: [
      { id: 'A', label: '脉冲输入' },
      { id: 'B', label: '单位阶跃' },
      { id: 'C', label: '正弦输入' },
      { id: 'D', label: '随机噪声' },
    ],
    answerId: 'C',
    explanation: '频率响应定义于正弦输入的稳态输出，与输入的幅值和相位关系相关。',
  },
  {
    id: 'steady-state',
    title: '稳态部分',
    prompt: '正弦输入下的系统响应可分为暂态与稳态，频率响应关注哪一部分？',
    options: [
      { id: 'A', label: '暂态部分' },
      { id: 'B', label: '稳态部分' },
      { id: 'C', label: '噪声部分' },
      { id: 'D', label: '随机扰动部分' },
    ],
    answerId: 'B',
    explanation: '频率响应关注稳态正弦响应部分，暂态会随时间衰减。',
  },
  {
    id: 'amplitude-definition',
    title: '幅频特性',
    prompt: '幅频特性定义为：',
    options: [
      { id: 'A', label: '输出相位与输入相位之差' },
      { id: 'B', label: '输出与输入幅值之比随频率变化' },
      { id: 'C', label: '输出相位对时间的导数' },
      { id: 'D', label: '输出幅值的绝对值' },
    ],
    answerId: 'B',
    explanation: '幅频特性是输出幅值与输入幅值之比随频率变化的函数。',
  },
  {
    id: 'bode-axis',
    title: 'Bode 图坐标',
    prompt: 'Bode 图的横轴和纵轴分别采用什么坐标？',
    options: [
      { id: 'A', label: '频率线性坐标，幅值线性坐标' },
      { id: 'B', label: '频率对数坐标，幅值分贝坐标' },
      { id: 'C', label: '频率线性坐标，幅值分贝坐标' },
      { id: 'D', label: '频率对数坐标，幅值线性坐标' },
    ],
    answerId: 'B',
    explanation: 'Bode 图横轴采用对数频率，纵轴采用 dB 幅值。',
  },
  {
    id: 'integrator-slope',
    title: '积分环节斜率',
    prompt: '积分环节的幅频特性渐近线斜率为：',
    options: [
      { id: 'A', label: '+20 dB/dec' },
      { id: 'B', label: '0 dB/dec' },
      { id: 'C', label: '-20 dB/dec' },
      { id: 'D', label: '-40 dB/dec' },
    ],
    answerId: 'C',
    explanation: '积分环节相当于 1/s，对数幅频斜率为 -20 dB/dec。',
  },
  {
    id: 'decade-meaning',
    title: '十倍频程',
    prompt: '“十倍频程 (decade)” 表示频率变化：',
    options: [
      { id: 'A', label: '增加 10 rad/s' },
      { id: 'B', label: '增加 10 Hz' },
      { id: 'C', label: '增大为原来的 10 倍' },
      { id: 'D', label: '减小为原来的 1/10' },
    ],
    answerId: 'C',
    explanation: '十倍频程表示频率增大为原来的 10 倍。',
  },
];

interface FrequencyPrecheckProps extends BaseWidgetProps {}

function FormulaCard({ formula }: { formula?: string }) {
  if (!formula) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
      <span className="font-semibold text-slate-700">提示公式：</span>
      <span className="ml-2 font-mono">{formula}</span>
    </div>
  );
}

export default function FrequencyPrecheck({ onComplete, onStateChange }: FrequencyPrecheckProps) {
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
            <p className="text-sm text-slate-500">前测 · 频率响应速判</p>
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
