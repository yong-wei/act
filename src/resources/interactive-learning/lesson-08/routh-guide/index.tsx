'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, ListChecks, Sigma, AlertTriangle } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';

interface GuideSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  formula?: string;
}

const SECTIONS: GuideSection[] = [
  {
    id: 'goal',
    title: '判据目标',
    summary: '判断闭环特征根是否全部位于左半平面。',
    bullets: [
      '列出闭环特征方程 Δ(s) = 0',
      '构造劳斯表并观察第一列符号',
      '第一列变号次数 = 右半平面根数',
    ],
    formula: 'Δ(s) = a_n s^n + a_{n-1} s^{n-1} + ... + a_0',
  },
  {
    id: 'table',
    title: '劳斯表构造',
    summary: '用多项式系数填充前两行，后续行按递推公式计算。',
    bullets: [
      '首行：a_n, a_{n-2}, a_{n-4}, ...',
      '次行：a_{n-1}, a_{n-3}, a_{n-5}, ...',
      '后续元素由行列式递推得到',
    ],
    formula: 'b_1 = (a_{n-1} a_{n-2} - a_n a_{n-3}) / a_{n-1}',
  },
  {
    id: 'necessary',
    title: '必要条件',
    summary: '系数全为正是稳定的必要条件，但不是充分条件。',
    bullets: [
      '若系数出现负值，可直接判定不稳定',
      '仍需劳斯表判断是否存在正实部根',
      '必要条件帮助快速筛除不稳定情况',
    ],
  },
  {
    id: 'special',
    title: '特殊情况',
    summary: '首项为 0 或全零行需特殊处理。',
    bullets: [
      '首项为 0：用极小正数 ε 替代继续计算',
      '全零行：由上一行构造辅助方程并求导替换',
      '记录变号次数，判断正实部根数',
    ],
  },
  {
    id: 'parameter',
    title: '参数稳定范围',
    summary: '将未知参数引入劳斯表，求使首列同号的参数区间。',
    bullets: [
      '把参数留在首列元素表达式中',
      '令首列元素同号，得到不等式组',
      '解不等式组得到稳定参数范围',
    ],
  },
];

interface RouthGuideProps extends BaseWidgetProps {}

function MiniRouthTable() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600">
      <div className="text-xs font-semibold text-slate-700">劳斯表示例（四阶）</div>
      <div className="mt-2 grid grid-cols-4 gap-2 text-center">
        {['s^4', 'a4', 'a2', 'a0', 's^3', 'a3', 'a1', '0', 's^2', 'b1', 'b2', '0', 's^1', 'c1', '0', '0', 's^0', 'd1', '0', '0'].map((item) => (
          <div key={item} className="rounded-md bg-slate-50 px-2 py-1">
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RouthGuide({ onComplete, onStateChange }: RouthGuideProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = SECTIONS[0]?.id ?? 'goal';
  const [activeId, setActiveId] = useState(initialActiveId);
  const [visited, setVisited] = useState<string[]>(() => [initialActiveId]);
  const publishedVisitedCountRef = useRef(0);

  const activeSection = useMemo(
    () => SECTIONS.find((section) => section.id === activeId) ?? SECTIONS[0],
    [activeId]
  );

  const recordVisit = useCallback((nextActiveId: string) => {
    setActiveId(nextActiveId);
    setVisited((current) =>
      current.includes(nextActiveId) ? current : [...current, nextActiveId]
    );
  }, []);

  useEffect(() => {
    if (publishedVisitedCountRef.current >= visited.length) return;
    publishedVisitedCountRef.current = visited.length;
    const nextVisited = visited;
    const latestVisitedId = nextVisited[nextVisited.length - 1] ?? initialActiveId;
    const progressValue = Math.round((nextVisited.length / SECTIONS.length) * 100);
    const snapshot = {
      progress: progressValue,
      data: { sectionId: latestVisitedId, visitedCount: nextVisited.length },
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
  }, [initialActiveId, visited, interactive, onComplete, onStateChange]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">劳斯判据速览</h2>
        <p className="text-slate-600">快速掌握劳斯表构造与稳定判别逻辑</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            导航
          </div>
          <div className="mt-4 space-y-2">
            {SECTIONS.map((section) => (
              <button type="button"
                key={section.id}
                onClick={() => recordVisit(section.id)}
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
                <ListChecks className="h-5 w-5 text-emerald-500" />
                <h3 className="text-xl font-semibold">{activeSection.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeSection.summary}</p>
            </div>
            <div className="w-40">
              <MiniRouthTable />
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
            <Sigma className="h-4 w-4" />
            首列同号为稳定必要条件，仍需完整判别。
            <AlertTriangle className="h-4 w-4 ml-2 text-amber-500" />
            遇到特殊情况要及时处理。
          </div>
        </div>
      </div>
    </div>
  );
}
