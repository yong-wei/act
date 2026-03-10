'use client';

import { useCallback, useState } from 'react';
import { BookOpen, ClipboardList, CheckCircle2 } from 'lucide-react';
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
          <BookOpen className="h-6 w-6 text-amber-500" />
          <h2 className="text-2xl font-bold">课程总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课从“稳定裕度”切入频域性能评估，再用“三频段分工”理解稳态、动态与抗噪的频率配比。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '稳定裕度由相角裕度与幅值裕度组成，描述距离失稳边界的安全储备。',
            '在 Bode 图上通过 0 dB 与 -180° 穿越频率快速估算裕度。',
            '低频段决定稳态误差，中频段决定动态性能，高频段决定抗噪鲁棒性。',
            '扩大带宽能提升速度，但也会压缩稳定裕度，需平衡权衡。',
            '频域设计的核心是“宽备窄用”：在关键频段留足余量。',
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
            课后思考
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
            <li>相位滞后导致穿越频率变化时，对时域响应意味着什么？</li>
            <li>当幅值等于 1 且相位反相时，系统处于怎样的稳定边界？</li>
            <li>三频段中哪一段的调整最容易影响超调？为什么？</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleComplete}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-xs text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            完成复盘
          </button>
        </div>
      </div>
    </div>
  );
}
