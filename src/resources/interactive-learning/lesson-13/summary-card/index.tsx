'use client';

import { BookOpen, ClipboardList } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface LessonSummaryCardProps extends BaseWidgetProps {}

export default function LessonSummaryCard({ onComplete, onStateChange }: LessonSummaryCardProps) {
  const interactive = useOptionalInteractiveContext();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-800">
          <BookOpen className="h-6 w-6 text-cyan-500" />
          <h2 className="text-2xl font-bold">课程总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课用“幅相特性 → Nyquist 判据 → 对数判据”搭起频域判稳路径，把稳定问题转化为“围绕 -1 点的几何关系”。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '开环幅相特性是 G(jω) 在复平面的轨迹，可直接关联稳定性。',
            '起点/终点/负实轴交点是手绘幅相曲线的三类关键特征点。',
            '幅角原理给出 Z = P - N 的核心关系，Nyquist 判据据此判稳。',
            '对数判据把“包围次数”转换成 Bode 图的 0 dB 与 -180° 穿越。',
            '稳定性判断不仅关乎“能否稳定”，也决定控制器设计边界。',
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
            <li>若开环存在右半平面极点，Nyquist 曲线应如何“补圈”？</li>
            <li>当曲线恰好穿过 -1 点时，系统处于怎样的稳定边界？</li>
            <li>结合 Bode 图，解释相位裕度与 Nyquist 交点位置的关系。</li>
          </ul>
        </div>

        <div className="mt-6 flex justify-end">
          <PathResourceContinueAction
            enabled
            result={{ success: true, score: 100, data: { action: 'summary-complete' } }}
            onBeforeComplete={() => {
              const snapshot = {
                progress: 100,
                data: { action: 'summary-complete' },
                timestamp: Date.now(),
              };
              onStateChange?.(snapshot);
              interactive?.progress.setProgress(100);
              interactive?.tracking.emit('complete', snapshot.data);
            }}
            onComplete={onComplete}
          />
        </div>
      </div>
    </div>
  );
}
