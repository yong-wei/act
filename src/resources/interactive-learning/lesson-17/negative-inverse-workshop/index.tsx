'use client';

import { useEffect, useMemo, useState } from 'react';
import { ListChecks, GitBranch, TrendingDown, Signal, Layers } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface WorkshopSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  tag: string;
  icon: React.ElementType;
}

const SECTIONS: WorkshopSection[] = [
  {
    id: 'relay',
    title: '理想继电器',
    summary: '-1/N(A) 落在负实轴，A 增大时向左移动。',
    bullets: [
      'N(A)=4M/(πA)',
      '负倒描述函数是一条负实轴射线',
      '交点通常只影响振幅大小',
    ],
    tag: '负实轴',
    icon: Signal,
  },
  {
    id: 'saturation',
    title: '饱和特性',
    summary: '轨迹从 -1/k 向左延伸，幅值越大越靠左。',
    bullets: [
      'A=a 时起点为 -1/k',
      'A→∞ 时趋向 -∞',
      '与线性增益有关',
    ],
    tag: '单调',
    icon: TrendingDown,
  },
  {
    id: 'dead-zone',
    title: '死区特性',
    summary: '负倒描述函数同样位于负实轴，但起点与饱和不同。',
    bullets: [
      'A=a 时轨迹趋向 -∞',
      'A→∞ 时趋向 -1/k',
      '体现“无响应”区间',
    ],
    tag: '反向起点',
    icon: GitBranch,
  },
  {
    id: 'hysteresis',
    title: '滞环/间隙特性',
    summary: '-1/N(A) 含虚部，轨迹进入第三象限。',
    bullets: [
      'N(A) 为复数，出现相位滞后',
      '轨迹不再仅在负实轴',
      '交点需要同时看幅值与相位',
    ],
    tag: '复轨迹',
    icon: Layers,
  },
];

interface NegativeInverseWorkshopProps extends BaseWidgetProps {}

export default function NegativeInverseWorkshop({ onComplete, onStateChange }: NegativeInverseWorkshopProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(SECTIONS[0]?.id ?? 'relay');
  const [visited, setVisited] = useState<string[]>([]);

  const activeSection = useMemo(
    () => SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0],
    [activeId]
  );

  useEffect(() => {
    if (visited.includes(activeId)) return;
    const nextVisited = [...visited, activeId];
    setVisited(nextVisited);
    const progressValue = Math.round((nextVisited.length / SECTIONS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { sectionId: activeId, visitedCount: nextVisited.length },
      timestamp: Date.now(),
    };
    onStateChange?.(snapshot);
    interactive?.progress.setProgress(progressValue);
    interactive?.tracking.emit('interact', snapshot.data);

    if (nextVisited.length === SECTIONS.length && !interactive?.progress.isComplete) {
      const result: WidgetResult = {
        success: true,
        score: 100,
        data: { visited: nextVisited, total: SECTIONS.length },
      };
      interactive?.progress.markComplete(result);
      onComplete?.(result);
    }
  }, [activeId, visited, interactive, onComplete, onStateChange]);

  const ActiveIcon = activeSection.icon;

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">负倒描述函数工作坊</h2>
        <p className="text-slate-600">掌握典型非线性特性的 -1/N(A) 轨迹形态</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <ListChecks className="h-4 w-4" />
            类型导航
          </div>
          <div className="mt-4 space-y-2">
            {SECTIONS.map((section) => (
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
            已浏览 {visited.length}/{SECTIONS.length}
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
