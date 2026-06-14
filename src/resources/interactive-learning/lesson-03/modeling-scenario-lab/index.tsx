'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface ScenarioOption {
  id: string;
  label: string;
}

interface ModelingScenario {
  id: string;
  title: string;
  context: string;
  goal: string;
  options: ScenarioOption[];
  answerId: string;
  explanation: string;
}

const SCENARIOS: ModelingScenario[] = [
  {
    id: 'rlc-circuit',
    title: '场景 01 · RLC 串联电路',
    context: '已知电阻、电感、电容参数，目标推导电压-电流微分关系。',
    goal: '选择最合适的建模方法。',
    options: [
      { id: 'kvl', label: '基尔霍夫电压定律建模' },
      { id: 'newton', label: '牛顿定律建模' },
      { id: 'blackbox', label: '系统辨识建模' },
      { id: 'linearization', label: '直接线性化' },
    ],
    answerId: 'kvl',
    explanation: '电路系统优先采用基尔霍夫定律列方程。',
  },
  {
    id: 'mechanical',
    title: '场景 02 · 机械位移系统',
    context: '质量-弹簧-阻尼系统已知参数，目标建立位移微分方程。',
    goal: '选择最合适的建模方法。',
    options: [
      { id: 'newton', label: '牛顿定律建模' },
      { id: 'kvl', label: '基尔霍夫电压定律建模' },
      { id: 'blackbox', label: '系统辨识建模' },
      { id: 'frequency', label: '直接频域建模' },
    ],
    answerId: 'newton',
    explanation: '机械系统通常从牛顿第二定律出发列受力方程。',
  },
  {
    id: 'unknown-system',
    title: '场景 03 · 复杂未知系统',
    context: '系统结构复杂、机理不明确，但可获取输入输出数据。',
    goal: '选择最合适的建模方法。',
    options: [
      { id: 'blackbox', label: '系统辨识/黑箱建模' },
      { id: 'kvl', label: '基尔霍夫电压定律建模' },
      { id: 'newton', label: '牛顿定律建模' },
      { id: 'modal', label: '模态叠加建模' },
    ],
    answerId: 'blackbox',
    explanation: '机理未知时应采用数据驱动的系统辨识。',
  },
];

interface ModelingScenarioLabProps extends BaseWidgetProps {}

export default function ModelingScenarioLab({ onComplete, onStateChange }: ModelingScenarioLabProps) {
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

    if (isLast) {
      const result: WidgetResult = {
        success: true,
        score: Math.round((nextScore / SCENARIOS.length) * 100),
        data: { correct: nextScore, total: SCENARIOS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [checked, selected, current.answerId, current.id, isLast, onComplete, onStateChange, score, progress, interactive]);

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
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">互动 · 建模方法选择</p>
            <h2 className="text-2xl font-bold text-slate-900">建模场景决策</h2>
          </div>
          <div className="text-sm text-slate-500">场景 {currentIndex + 1}/{SCENARIOS.length}</div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-5">
            <div className="text-sm font-semibold text-slate-700">{current.title}</div>
            <p className="mt-3 text-sm text-slate-600">{current.context}</p>
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              目标：{current.goal}
            </div>
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-5">
            <p className="text-sm font-semibold text-slate-700">选择建模方法</p>
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
              disabled={!checked || isLast}
            >
              下一场景
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
