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
          <BookOpen className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-bold">课程总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课建立了频域视角：用正弦稳态响应定义频率特性，用伯德图把“幅值 + 相位”转换为可叠加的斜率语言。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '频率响应 = 正弦输入稳态输出的幅值比与相位差。',
            'Bode 图横轴为对数频率，幅值用 dB 表示，斜率可直接叠加。',
            '一阶极点让斜率 -20 dB/dec，一阶零点让斜率 +20 dB/dec。',
            '绘制流程：标准型 → 转折频率 → 低频特性 → 叠加作图 → 必要修正。',
            '振荡环节会出现共振峰，需在近似曲线外做修正。',
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
            <li>不稳定系统是否仍有稳定的频率响应？它的幅频曲线会呈现怎样的形态？</li>
            <li>手绘伯德图的最大误差通常出现在转折频率附近，如何估计误差范围？</li>
            <li>尝试根据实验频响数据反推传递函数，并说明推理步骤。</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleComplete}
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-xs text-white"
          >
            完成复盘
          </button>
        </div>
      </div>
    </div>
  );
}
