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
          本节课从串联校正出发，理解超前与滞后网络如何分别改善相角裕度与稳态精度，并掌握滞后-超前联合设计的流程逻辑。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '超前网络提供相角超前与幅值抬升，用于提升动态性能与相角裕度。',
            '滞后网络提高低频增益，改善稳态误差，但需避开相角裕度敏感区。',
            '滞后-超前联合校正适用于稳态精度与相角裕度同时不足的场景。',
            '联合设计通常先超前后滞后，确保带宽与稳态精度协同达标。',
            '频域设计关键是“目标-参数-验算”的闭环迭代。',
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
            <li>如果相角裕度足够但稳态误差仍偏大，应优先调整哪一段频率？</li>
            <li>滞后网络零极点布置在穿越频率附近会带来什么风险？</li>
            <li>滞后-超前联合设计如何判断“先超前”的合理性？</li>
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
