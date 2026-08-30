'use client';

import { BookOpen, ClipboardList } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface FeedbackSummaryCardProps extends BaseWidgetProps {}

export default function FeedbackSummaryCard({ onComplete, onStateChange }: FeedbackSummaryCardProps) {
  const interactive = useOptionalInteractiveContext();

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3 text-slate-800">
          <BookOpen className="h-6 w-6 text-emerald-500" />
          <h2 className="text-2xl font-bold">课程总结</h2>
        </div>
        <p className="mt-3 text-sm text-slate-600">
          本节课从“烧水问题”切入，建立反馈控制的基本语言与系统组成结构。
        </p>

        <div className="mt-6 grid gap-3">
          {[
            '反馈控制以误差信号驱动控制器自我修正。',
            '控制系统由对象、控制器、执行器与传感器构成。',
            '闭环控制可抵御扰动，提高稳定性与鲁棒性。',
            '开环控制结构简单，但抗扰动能力弱。',
            '典型工程系统都可以用控制结构语言描述。',
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
            <li>如果传感器测量存在噪声，你会如何解释反馈的利弊？</li>
            <li>在工业控制场景中，反馈环节最容易失败的环节是什么？</li>
            <li>你能用反馈语言描述一个社会系统吗？</li>
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
