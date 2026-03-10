'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListChecks, Sliders, Zap, Shield, Flag } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface StrategySection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  tag: string;
  icon: React.ElementType;
}

const STRATEGIES: StrategySection[] = [
  {
    id: 'pd',
    title: '串联校正：比例-微分控制',
    summary: '通过引入零点与阻尼改善动态性能。',
    bullets: [
      '提高阻尼比，降低超调量',
      '引入零点，提升响应速度',
      '适用于“稳 + 快”双目标',
    ],
    tag: 'PD',
    icon: Sliders,
  },
  {
    id: 'output-derivative',
    title: '输出微分反馈（测速反馈）',
    summary: '不增加零点，但能提升阻尼。',
    bullets: [
      '结构简单，抑制超调',
      '自然频率基本不变',
      '适合不希望引入零点的系统',
    ],
    tag: '反馈',
    icon: Shield,
  },
  {
    id: 'feedforward',
    title: '前馈补偿（给定输入补偿）',
    summary: '从输入侧抵消误差，提升稳态精度。',
    bullets: [
      '提高一阶无差度，改善斜坡误差',
      '时间常数决定补偿效果',
      '适合输入可预测场景',
    ],
    tag: '前馈',
    icon: Zap,
  },
  {
    id: 'disturbance',
    title: '扰动补偿',
    summary: '减弱扰动通道对输出的影响。',
    bullets: [
      '需要测量或估计扰动',
      '削弱扰动导致的偏差',
      '适合扰动主导工况',
    ],
    tag: '抗扰',
    icon: Flag,
  },
];

interface CorrectionStrategyProps extends BaseWidgetProps {}

export default function CorrectionStrategy({ onComplete, onStateChange }: CorrectionStrategyProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(STRATEGIES[0]?.id ?? 'pd');
  const [visited, setVisited] = useState<string[]>([]);

  const activeSection = useMemo(
    () => STRATEGIES.find((section) => section.id === activeId) ?? STRATEGIES[0],
    [activeId]
  );

  useEffect(() => {
    if (visited.includes(activeId)) return;
    const nextVisited = [...visited, activeId];
    setVisited(nextVisited);
    const progressValue = Math.round((nextVisited.length / STRATEGIES.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { sectionId: activeId, visitedCount: nextVisited.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);

    if (nextVisited.length === STRATEGIES.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { visited: nextVisited, total: STRATEGIES.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [activeId, visited, interactive, onComplete, onStateChange]);

  const ActiveIcon = activeSection.icon;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">校正手段速览</h2>
        <p className="text-slate-600">用结构调整实现“稳、快、准、抗扰”</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <ListChecks className="h-4 w-4" />
            导航
          </div>
          <div className="mt-4 space-y-2">
            {STRATEGIES.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveId(section.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  activeId === section.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
            已浏览 {visited.length}/{STRATEGIES.length}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <ActiveIcon className="h-5 w-5 text-amber-500" />
                <h3 className="text-xl font-semibold">{activeSection.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeSection.summary}</p>
            </div>
            <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700">
              {activeSection.tag}
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {activeSection.bullets.map((bullet) => (
              <div key={bullet} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {bullet}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
