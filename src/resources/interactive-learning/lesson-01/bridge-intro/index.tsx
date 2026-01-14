'use client';

import { useCallback, useMemo, useState } from 'react';
import { Flame, CheckCircle2, Droplet, Thermometer } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

const OPTIONS = [
  {
    id: 'feedback',
    title: '用温度反馈调节火力',
    description: '实时测温 → 误差 → 调整火力。',
  },
  {
    id: 'open-loop',
    title: '固定火力计时加热',
    description: '不测温度，靠经验设定。',
  },
  {
    id: 'disturbance',
    title: '考虑外界扰动',
    description: '锅盖开合、环境温度变化。',
  },
];

interface FeedbackBridgeIntroProps extends BaseWidgetProps {}

export default function FeedbackBridgeIntro({ onComplete, onStateChange }: FeedbackBridgeIntroProps) {
  const interactive = useOptionalInteractiveContext();
  const [selected, setSelected] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);

  const selectedOption = useMemo(
    () => OPTIONS.find((option) => option.id === selected),
    [selected]
  );

  const handleComplete = useCallback(() => {
    if (!selected || completed) return;
    setCompleted(true);

    const snapshot = {
      progress: 100,
      data: { choice: selected, note: selectedOption?.title },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(100);
    interactive?.tracking.emit('submit', snapshot.data);

    const result: WidgetResult = {
      success: true,
      score: 100,
      data: snapshot.data,
    };
    interactive?.progress.markComplete(result);
    onComplete?.(result);
  }, [completed, interactive, onComplete, onStateChange, selected, selectedOption]);

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">导入 · 生活中的反馈</p>
            <h2 className="text-2xl font-bold text-slate-900">你能用控制的语言描述烧水吗？</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
            <Thermometer className="h-3.5 w-3.5" />
            5 分钟
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Droplet className="h-4 w-4 text-emerald-500" />
              场景提示
            </div>
            <p className="mt-3 leading-relaxed">
              想让水温稳定在 95°C。你会如何设置火力、测温，并根据误差调整？
              这就是反馈思想进入控制系统的起点。
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Flame className="h-3.5 w-3.5" />
              选出你认为最关键的控制动作
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">你会强调哪一步？</p>
            <div className="mt-4 space-y-3">
              {OPTIONS.map((option) => (
                <button
                  key={option.id}
                  onClick={() => setSelected(option.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    selected === option.id
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="font-semibold">{option.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{option.description}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">选择后进入反馈控制核心概念。</p>
          <button
            onClick={handleComplete}
            disabled={!selected || completed}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs ${
              selected && !completed
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-500'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            进入主线
          </button>
        </div>
      </div>
    </div>
  );
}
