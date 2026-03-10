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
          <BookOpen className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold">课程总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课以“结构图到信号流图再到梅森公式”为主线，完成从图形化建模到公式化求解的
          一体化流程，为后续根轨迹与频域分析奠定拓扑基础。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '结构图四元素明确系统信号关系，典型连接提供快速等效化简。',
            '信号流图强调拓扑不变性，节点是变量、支路是增益。',
            '前向通路与回路增益是梅森公式的核心输入。',
            '特征式 Delta 需要正确数出互不接触回路。',
            '从方程到信号流图时，初始条件应作为输入信号处理。',
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
            <li>结构图与信号流图在信息表达上有哪些差异与优势？</li>
            <li>互不接触回路判断时最容易遗漏的情形是什么？</li>
            <li>若加入非零初始条件，输出响应如何变化？</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleComplete}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            完成复盘
          </button>
        </div>
      </div>
    </div>
  );
}
