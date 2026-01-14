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
          <BookOpen className="h-6 w-6 text-emerald-500" />
          <h2 className="text-2xl font-bold">课程总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课聚焦微分方程建模的核心流程与典型案例，理解机理建模与黑箱建模的分工，并用线性化思路连接后续的传递函数分析。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '微分方程模型是控制系统最基础的时域描述形式。',
            '机理建模强调“定律驱动”，黑箱建模强调“数据驱动”。',
            '建模步骤：变量确定 → 列方程 → 消元 → 标准化 → 验证。',
            'RLC、电机与机械系统建模都遵循同样的消元链路。',
            '线性化让非线性系统在工作点附近可用线性工具分析。',
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
            <li>为什么传递函数分母阶次通常高于分子阶次？</li>
            <li>寻找一个跨学科系统，写出与 RLC 相同结构的模型。</li>
            <li>线性化误差主要来自哪一类项？如何评估其影响？</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleComplete}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs text-white"
          >
            <CheckCircle2 className="h-4 w-4" />
            完成复盘
          </button>
        </div>
      </div>
    </div>
  );
}
