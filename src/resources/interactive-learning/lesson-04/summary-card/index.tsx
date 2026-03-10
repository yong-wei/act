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
          本节课以传递函数为主线，把“微分方程 → 拉氏变换 → 零极点判读”串成一条统一的
          s 域建模路径，为后续根轨迹与频域分析打下基础。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '传递函数定义成立的前提是零初始条件，关注输入输出的比例关系。',
            '分母多项式阶次对应系统阶次，极点位置决定稳定性与响应形态。',
            '典型环节的传函形式帮助快速判断系统动态特征。',
            'RLC、电机、机械系统都可归一为标准的 s 域模型。',
            'MATLAB 的 tf/zpk/step/bode 能高效完成建模与验证。',
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
            <li>当初始条件不为零时，传递函数还能直接使用吗？应如何处理？</li>
            <li>若系统存在右半平面零点，响应会出现什么特征？</li>
            <li>如何通过实验数据验证推导出的传递函数模型是否合理？</li>
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
