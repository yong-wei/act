'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Target, Activity, Sigma } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface ErrorSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  formula?: string;
}

const SECTIONS: ErrorSection[] = [
  {
    id: 'sources',
    title: '误差来源',
    summary: '稳态误差来自结构、输入信号与外部扰动。',
    bullets: [
      '结构误差：反馈结构导致的必然偏差',
      '输入误差：不同输入类型产生不同稳态误差',
      '扰动误差：外部扰动叠加引起偏差',
    ],
  },
  {
    id: 'final-value',
    title: '终值定理流程',
    summary: '稳态误差计算的通用三步法。',
    bullets: [
      '先判定系统稳定，保证终值定理可用',
      '求误差传递函数 E(s)',
      '用 e_ss = lim_{s->0} sE(s) 求稳态误差',
    ],
    formula: 'e_ss = lim_{s->0} sE(s)',
  },
  {
    id: 'type',
    title: '系统型别',
    summary: '系统型别决定对阶跃、斜坡、抛物输入的误差阶次。',
    bullets: [
      '型别 = 开环传函中积分环节的个数',
      '型别 0：阶跃有差、斜坡无穷大',
      '型别 1：阶跃无差、斜坡有差',
      '型别 2：阶跃与斜坡无差、抛物有差',
    ],
  },
  {
    id: 'constants',
    title: '静态误差系数',
    summary: '用 Kp/Kv/Ka 描述稳态误差的量级。',
    bullets: [
      'Kp = lim_{s->0} G(s)',
      'Kv = lim_{s->0} sG(s)',
      'Ka = lim_{s->0} s^2 G(s)',
      '阶跃误差 1/(1+Kp)，斜坡误差 1/Kv',
    ],
    formula: 'e_step = 1/(1+Kp), e_ramp = 1/Kv, e_para = 1/Ka',
  },
  {
    id: 'improve',
    title: '误差改善策略',
    summary: '提升增益与引入积分环节是降低误差的主要手段。',
    bullets: [
      '提高增益可降低误差，但可能影响稳定裕度',
      '增加积分环节可提升型别，消除稳态误差',
      '需在稳定性与精度之间权衡',
    ],
  },
];

interface SteadyErrorDeckProps extends BaseWidgetProps {}

function TypeTable() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="text-xs font-semibold text-slate-700">系统型别与输入误差</div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {['型别', '阶跃', '斜坡', '抛物', '0', '有差', '∞', '∞', '1', '无差', '有差', '∞', '2', '无差', '无差', '有差'].map((item) => (
          <div key={item} className="rounded-md bg-slate-50 px-2 py-1">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SteadyErrorDeck({ onComplete, onStateChange }: SteadyErrorDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const [activeId, setActiveId] = useState(SECTIONS[0]?.id ?? 'sources');
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

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">稳态误差核心卡</h2>
        <p className="text-slate-600">从误差来源到静态误差系数的完整路径</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            知识导航
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
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <Target className="h-5 w-5 text-emerald-500" />
                <h3 className="text-xl font-semibold">{activeSection.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeSection.summary}</p>
            </div>
            <div className="w-40">
              <TypeTable />
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {activeSection.bullets.map((bullet) => (
              <div key={bullet} className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                {bullet}
              </div>
            ))}
          </div>

          {activeSection.formula && (
            <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-700 font-mono">
              {activeSection.formula}
            </div>
          )}

          <div className="mt-6 flex items-center gap-2 text-xs text-slate-500">
            <Activity className="h-4 w-4" />
            误差分析必须建立在稳定基础之上。
            <Sigma className="h-4 w-4 ml-2" />
            型别越高，稳态误差越小。
          </div>
        </div>
      </div>
    </div>
  );
}
