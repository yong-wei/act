'use client';

import { useMemo, useState } from 'react';
import { Activity, Timer, Zap } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

const OPTIONS = [
  {
    id: 'algebra',
    title: '把微分方程“代数化”',
    description: '把复杂的求解转换为代数运算。',
  },
  {
    id: 'response',
    title: '直接求出系统响应',
    description: '快速得到时域响应的直观形态。',
  },
  {
    id: 's-plane',
    title: '在 s 平面看系统性格',
    description: '用 σ 与 ω 描述衰减和振荡。',
  },
];

interface LaplaceBridgeIntroProps extends BaseWidgetProps {}

export default function LaplaceBridgeIntro({ onComplete, onStateChange }: LaplaceBridgeIntroProps) {
  const interactive = useOptionalInteractiveContext();
  const [selected, setSelected] = useState<string | null>(null);

  const selectedOption = useMemo(
    () => OPTIONS.find((option) => option.id === selected),
    [selected]
  );

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">导入 · RLC 微分方程</p>
            <h2 className="text-2xl font-bold text-slate-900">传统求解太慢，有没有捷径？</h2>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500">
            <Timer className="h-3.5 w-3.5" />
            5 分钟
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex items-center gap-2 text-slate-800 font-semibold">
              <Activity className="h-4 w-4 text-amber-500" />
              场景提示
            </div>
            <p className="mt-3 leading-relaxed">
              RLC 串联电路的微分方程推导完成了，但要解出响应需要长时间的计算。
              工程上更需要一种“把微分方程变成代数题”的方法。
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <Zap className="h-3.5 w-3.5" />
              选择你对拉氏变换的第一直觉
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4">
            <p className="text-sm font-semibold text-slate-700">你认为拉普拉斯变换最核心的作用是？</p>
            <div className="mt-4 space-y-3">
              {OPTIONS.map((option) => (
                <button type="button"
                  key={option.id}
                  onClick={() => setSelected(option.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                    selected === option.id
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
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
          <p className="text-xs text-slate-500">
            选择后即可进入拉氏变换的工程直觉。
          </p>
          <PathResourceContinueAction
            enabled={Boolean(selected)}
            result={{
              success: true,
              score: 100,
              data: { choice: selected, note: selectedOption?.title },
            }}
            onBeforeComplete={() => {
              const snapshot = {
                progress: 100,
                data: { choice: selected, note: selectedOption?.title },
                timestamp: Date.now(),
              };
              onStateChange?.(snapshot);
              interactive?.progress.setProgress(100);
              interactive?.tracking.emit('submit', snapshot.data);
            }}
            onComplete={onComplete}
          />
        </div>
      </div>
    </div>
  );
}
