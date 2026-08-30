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
    id: 'model-steps',
    title: '概念速判',
    prompt: '微分方程建模的一般步骤中，排在第一的是：',
    options: [
      { id: 'A', label: '消去中间变量得到标准形式' },
      { id: 'B', label: '确定输入量、输出量和扰动量' },
      { id: 'C', label: '直接写出传递函数' },
      { id: 'D', label: '选择控制器参数' },
    ],
    answerId: 'B',
    explanation: '建模通常从确定输入、输出和扰动开始，再列方程并消去中间变量。',
  },
  {
    id: 'modeling-method',
    title: '概念速判',
    prompt: '下列哪一项属于黑箱建模（系统辨识）？',
    options: [
      { id: 'A', label: '利用牛顿定律推导运动方程' },
      { id: 'B', label: '利用基尔霍夫定律建立电路方程' },
      { id: 'C', label: '施加测试信号并用数据拟合模型' },
      { id: 'D', label: '在平衡点做泰勒展开线性化' },
    ],
    answerId: 'C',
    explanation: '系统辨识通过输入输出数据拟合模型，属于黑箱建模。',
  },
  {
    id: 'model-types',
    title: '模型类型',
    prompt: '控制系统模型中，描述输入输出微分关系的是：',
    options: [
      { id: 'A', label: '频率特性' },
      { id: 'B', label: '传递函数' },
      { id: 'C', label: '微分方程' },
      { id: 'D', label: '结构图' },
    ],
    answerId: 'C',
    explanation: '微分方程在时域直接描述输入输出及其导数之间的关系。',
  },
  {
    id: 'linearization',
    title: '线性化',
    prompt: '非线性系统线性化的核心思想是：',
    options: [
      { id: 'A', label: '在均衡点附近做泰勒展开并忽略高阶项' },
      { id: 'B', label: '改变系统参数使其恒定' },
      { id: 'C', label: '只保留输入信号' },
      { id: 'D', label: '用实验数据替换模型' },
    ],
    answerId: 'A',
    explanation: '线性化是在工作点附近泰勒展开，保留一阶项。',
  },
];

interface DiffPrecheckProps extends BaseWidgetProps {}

export default function DiffPrecheck({ onComplete, onStateChange }: DiffPrecheckProps) {
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
            <p className="text-sm text-slate-500">前测 · 微分方程建模</p>
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
