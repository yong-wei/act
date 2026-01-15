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
          本节课完成了“非线性现象 → 谐波线性化 → 描述函数”的认知链路，为后续自振判别打下基础。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '非线性系统不满足叠加原理，稳定性与初始条件和外作用相关。',
            '描述函数以输出基波近似非线性响应，得到幅值相关的等效频率特性。',
            '继电器、饱和、死区、间隙等特性决定 N(A) 的形态。',
            '描述函数法适用于单一非线性 + 低通线性环节的系统。',
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
            <li>列举你所在专业中常见的非线性环节，并说明它们的影响。</li>
            <li>为什么描述函数法要求线性部分具备低通特性？</li>
            <li>尝试用 N(A) 表达一个非线性环节，并讨论其随 A 的变化趋势。</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button
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
