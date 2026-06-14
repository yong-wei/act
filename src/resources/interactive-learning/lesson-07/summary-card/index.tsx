'use client';

import { useCallback, useState } from 'react';
import { BookOpen, ClipboardList } from 'lucide-react';
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
          <BookOpen className="h-6 w-6 text-emerald-500" />
          <h2 className="text-2xl font-bold">课程总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课聚焦欠阻尼二阶系统的衰减振荡特性，建立“阻尼比—频率—指标”的完整链路。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '欠阻尼条件 0 < ζ < 1，响应具有衰减振荡特征。',
            'ω_n 控制响应速度，ζ 控制超调与衰减速度。',
            '关键指标：t_p、t_r、t_s 与超调量 M_p。',
            '极点越靠左，系统衰减越快；虚部越大，振荡频率越高。',
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
            <li>尝试给定超调量与调节时间，反算 ζ 与 ω_n 的取值范围。</li>
            <li>阅读文献：Rake (1979) Step response and frequency response methods。</li>
            <li>预习：根轨迹法如何描绘极点随增益变化的轨迹。</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button type="button"
            onClick={handleComplete}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white"
          >
            完成复盘
          </button>
        </div>
      </div>
    </div>
  );
}
