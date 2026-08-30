'use client';

import { useCallback, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight, RotateCcw } from 'lucide-react';
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
  options: ScenarioOption[];
  answerId: string;
  explanation: string;
}

const SCENARIOS: ScenarioItem[] = [
  {
    id: 'car-steering',
    title: '场景 01：汽车方向控制',
    prompt: '驾驶员根据实际偏差修正方向盘，这是哪类控制？',
    options: [
      { id: 'A', label: '开环控制' },
      { id: 'B', label: '闭环反馈控制' },
      { id: 'C', label: '前馈控制' },
    ],
    answerId: 'B',
    explanation: '驾驶员通过视觉反馈修正方向，属于闭环反馈控制。',
  },
  {
    id: 'washing',
    title: '场景 02：定时洗衣',
    prompt: '洗衣机按固定时间运行，不检测衣物清洁度。',
    options: [
      { id: 'A', label: '开环控制' },
      { id: 'B', label: '闭环反馈控制' },
      { id: 'C', label: '自适应控制' },
    ],
    answerId: 'A',
    explanation: '不测量输出，按预设策略运行，是开环控制。',
  },
  {
    id: 'thermostat',
    title: '场景 03：空调温控',
    prompt: '空调根据室温与设定温度的差值调节功率。',
    options: [
      { id: 'A', label: '开环控制' },
      { id: 'B', label: '闭环反馈控制' },
      { id: 'C', label: '纯前馈控制' },
    ],
    answerId: 'B',
    explanation: '温度测量形成误差驱动控制器，属于闭环反馈。',
  },
];

interface LoopScenarioLabProps extends BaseWidgetProps {}

export default function LoopScenarioLab({ onComplete, onStateChange }: LoopScenarioLabProps) {
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
            <p className="text-sm text-slate-500">参与式 · 开环与闭环</p>
            <h2 className="text-2xl font-bold text-slate-900">场景分类实验</h2>
          </div>
          <div className="text-sm text-slate-500">进度 {currentIndex + 1}/{SCENARIOS.length}</div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-slate-700">
          <p className="text-sm leading-relaxed">{current.title}</p>
          <p className="mt-2 text-sm text-slate-600">{current.prompt}</p>
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
          <p className="mt-2">{checked ? current.explanation : '选择答案后点击“检查”。'}</p>
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
