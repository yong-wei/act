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
          本节课完成了“负倒描述函数 → 交点判别 → 自振稳定性”的分析闭环，形成非线性系统的频域判稳思路。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '描述函数法适用于单一非线性 + 低通线性部分的结构。',
            'G(jω) 与 -1/N(A) 交点是自振存在的必要条件。',
            '微小扰动分析可判断交点对应的自振是否稳定。',
            '通过幅值/相位方程可求得自振的振幅与频率。',
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
            <li>绘制典型非线性环节的 -1/N(A) 轨迹，并解释其物理含义。</li>
            <li>交点数量与自振稳定性之间是否存在必然关系？</li>
            <li>尝试用描述函数法估算一个实际系统的自振频率。</li>
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
