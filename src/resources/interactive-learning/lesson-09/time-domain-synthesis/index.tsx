'use client';

import { useEffect, useMemo, useState } from 'react';
import { Workflow, Compass, GaugeCircle, Waves, Map, type LucideIcon } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface SynthesisStep {
  id: string;
  title: string;
  summary: string;
  details: string[];
  icon: LucideIcon;
}

const STEPS: SynthesisStep[] = [
  {
    id: 'modeling',
    title: '模型与简化',
    summary: '确定航向系统的 G1(s)/G2(s) 与增益 K。',
    details: [
      '建立航向系统传递函数与结构',
      '明确控制通道与扰动通道',
      '得到可用于时域分析的简化模型',
    ],
    icon: Workflow,
  },
  {
    id: 'stability',
    title: '稳定范围',
    summary: '判断闭环稳定的 K 取值范围。',
    details: [
      '构造闭环特征方程',
      '使用劳斯或判别式推导范围',
      '确保 0 < K < 28.0469',
    ],
    icon: Compass,
  },
  {
    id: 'steady-error',
    title: '稳态误差',
    summary: '利用 Kv 与终值定理评估精度。',
    details: [
      '计算静态误差系数 Kv',
      '用终值定理求斜坡稳态误差',
      '比较不同校正方案的精度差异',
    ],
    icon: GaugeCircle,
  },
  {
    id: 'disturbance',
    title: '扰动响应',
    summary: '评估阶跃/等效正弦扰动下的表现。',
    details: [
      '分析单位阶跃扰动响应',
      '等效正弦模拟海浪影响',
      '比较开环与闭环抗扰能力',
    ],
    icon: Waves,
  },
  {
    id: 'scenario',
    title: '场景性能验证',
    summary: '用典型工况验证校正效果。',
    details: [
      '直角转向性能（不同 K）',
      '回转性能评估',
      '避障性能验证',
    ],
    icon: Map,
  },
];

interface TimeDomainSynthesisProps extends BaseWidgetProps {}

export default function TimeDomainSynthesis({ onComplete, onStateChange }: TimeDomainSynthesisProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(STEPS[0]?.id ?? 'modeling');
  const [visited, setVisited] = useState<string[]>([]);

  const activeStep = useMemo(
    () => STEPS.find((step) => step.id === activeId) ?? STEPS[0],
    [activeId]
  );

  useEffect(() => {
    if (visited.includes(activeId)) return;
    const nextVisited = [...visited, activeId];
    setVisited(nextVisited);
    const progressValue = Math.round((nextVisited.length / STEPS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { stepId: activeId, visitedCount: nextVisited.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);

    if (nextVisited.length === STEPS.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { visited: nextVisited, total: STEPS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [activeId, visited, interactive, onComplete, onStateChange]);

  const ActiveIcon = activeStep.icon;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">时域综合分析流程</h2>
        <p className="text-slate-600">从稳定到性能验证的五步路径</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold text-slate-700">步骤导航</div>
          <div className="mt-4 space-y-2">
            {STEPS.map((step, index) => (
              <button
                key={step.id}
                onClick={() => setActiveId(step.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeId === step.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {index + 1}. {step.title}
              </button>
            ))}
          </div>
          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            已完成 {visited.length}/{STEPS.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <ActiveIcon className="h-5 w-5 text-cyan-500" />
                <h3 className="text-xl font-semibold">{activeStep.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeStep.summary}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {activeStep.details.map((detail) => (
              <div key={detail} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {detail}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
