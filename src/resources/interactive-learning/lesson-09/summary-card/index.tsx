'use client';

import { useCallback, useState } from 'react';
import { ClipboardList, ShieldCheck } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface LessonSummaryCardProps extends BaseWidgetProps {}

export default function LessonSummaryCard({ onComplete, onStateChange }: LessonSummaryCardProps) {
  const interactive = useOptionalInteractiveContext();
  const [done, setDone] = useState(false);

  const handleComplete = useCallback(() => {
    if (done) return;
    setDone(true);
    const snapshot = {
      progress: 100,
      data: { action: 'summary-complete' },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(100);
    interactive?.tracking.emit('complete', snapshot.data);

    const result: WidgetResult = {
      success: true,
      score: 100,
      data: snapshot.data,
    };
    interactive?.progress.markComplete(result);
    onComplete?.(result);
  }, [done, interactive, onComplete, onStateChange]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-800">
          <ShieldCheck className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-bold">校正与时域综合总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课从校正手段出发，完成“结构改造 → 性能验证”的完整闭环。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            'PD 校正可提升阻尼并引入零点，兼顾速度与超调。',
            '输出微分反馈提升阻尼但不增加零点，结构更简洁。',
            '前馈与扰动补偿用于提升稳态精度与抗扰能力。',
            '时域综合分析关注稳定范围、稳态误差与场景性能。',
          ].map((item) => (
            <div key={item} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {item}
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
            <ClipboardList className="h-4 w-4" />
            课后思考与拓展
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
            <li>比较 PD 与输出反馈在超调和调节时间上的差异。</li>
            <li>尝试调整前馈时间常数 τ，观察稳态误差变化。</li>
            <li>根据不同海况选择最合适的校正策略。</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button"
            onClick={handleComplete}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs text-white"
          >
            完成复盘
          </button>
        </div>
      </div>
    </div>
  );
}
