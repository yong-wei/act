'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Waves, Sigma, ShieldCheck } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface GuideSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  tag: string;
  icon: React.ElementType;
}

const SECTIONS: GuideSection[] = [
  {
    id: 'input',
    title: '正弦输入假设',
    summary: '假设非线性环节的输入为单一频率正弦信号。',
    bullets: [
      '输入 x(t)=A sin(ωt)',
      '输出为非正弦周期信号',
      '目标是提取基波分量',
    ],
    tag: '假设',
    icon: Waves,
  },
  {
    id: 'fourier',
    title: '傅里叶展开',
    summary: '将输出展开为傅里叶级数。',
    bullets: [
      'y(t)=A0 + Σ(An cos nωt + Bn sin nωt)',
      '高次谐波体现非线性强度',
      '基波信息决定等效频域特性',
    ],
    tag: '展开',
    icon: Sigma,
  },
  {
    id: 'fundamental',
    title: '保留基波',
    summary: '用基波近似输出，忽略高次谐波。',
    bullets: [
      'y(t)≈Y1 sin(ωt+φ1)',
      '幅值与相位成为等效参数',
      '线性部分需具备低通特性',
    ],
    tag: '近似',
    icon: BookOpen,
  },
  {
    id: 'definition',
    title: '描述函数定义',
    summary: '描述函数为基波与输入正弦的复比。',
    bullets: [
      'N(A)=Y1/A ∠ φ1',
      '与输入幅值 A 相关',
      '为频域分析提供入口',
    ],
    tag: '定义',
    icon: ShieldCheck,
  },
];

interface HarmonicLinearizationGuideProps extends BaseWidgetProps {}

export default function HarmonicLinearizationGuide({ onComplete, onStateChange }: HarmonicLinearizationGuideProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(SECTIONS[0]?.id ?? 'input');
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
        <h2 className="text-2xl font-bold text-slate-900">谐波线性化导航</h2>
        <p className="text-slate-600">理解描述函数的关键四步</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            步骤导航
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
