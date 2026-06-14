'use client';

import { useCallback, useState } from 'react';
import { ClipboardList, GitBranch } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface Lesson11SummaryCardProps extends BaseWidgetProps {}

export default function Lesson11SummaryCard({ onComplete, onStateChange }: Lesson11SummaryCardProps) {
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
          <GitBranch className="h-6 w-6 text-violet-500" />
          <h2 className="text-2xl font-bold">参数根轨迹总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          从参数变化出发，完成“等效开环 → 稳定范围 → 性能验证”的图形化思考闭环。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '参数根轨迹将任意参数变化转化为等效开环增益问题。',
            '虚轴交点是稳定范围的边界，必须明确对应参数值。',
            '主导极点选择决定阻尼比与速度指标。',
            '图形化判断后仍需用响应曲线验证性能。',
          ].map((item) => (
            <div
              key={item}
              className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"
            >
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
            <li>尝试从根轨迹图上估算参数变化对稳定范围的影响。</li>
            <li>在 Matlab 中验证主导极点选择对超调与调节时间的影响。</li>
            <li>结合文献案例思考参数变化下的鲁棒性设计。</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button"
            onClick={handleComplete}
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs text-white"
          >
            完成复盘
          </button>
        </div>
      </div>
    </div>
  );
}
