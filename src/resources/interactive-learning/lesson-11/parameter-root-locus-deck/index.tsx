'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { BookOpen, Compass, Target, GitBranch } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps } from '@/resources/widgets/widget-props';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

interface DeckSection {
  id: string;
  title: string;
  summary: string;
  bullets: string[];
  formula?: string;
}

const SECTIONS: DeckSection[] = [
  {
    id: 'definition',
    title: '参数根轨迹的广义定义',
    summary: '当系统中除开环增益之外的参数变化时，闭环特征根的轨迹。',
    bullets: [
      '传统根轨迹研究 K 从 0 到无穷的闭环极点变化。',
      '参数根轨迹将“变化量”替换为任意参数 p。',
      '目标：找出参数范围、稳定边界与性能落点。',
    ],
    formula: '1 + K_eq G_eq(s) = 0',
  },
  {
    id: 'equivalent-loop',
    title: '等效开环思想',
    summary: '把包含参数的特征方程整理为标准根轨迹形式。',
    bullets: [
      '从闭环特征方程出发，提取参数 p。',
      '将方程改写为 1 + K_eq G_eq(s) = 0。',
      'K_eq 即参数的等效增益，G_eq 为等效开环传函。',
    ],
    formula: 'K_eq = f(p)',
  },
  {
    id: 'rules',
    title: '参数根轨迹绘制要点',
    summary: '传统根轨迹的判别法则依旧适用。',
    bullets: [
      '实轴轨迹：右侧极点/零点数量为奇数。',
      '渐近线：n-m 条，角度 (2k+1)180/(n-m)。',
      '分离点：dK/ds = 0 且在轨迹上。',
      '虚轴交点：用劳斯判据或代入求解。',
      '出射/入射角：复共轭分支方向修正。',
    ],
  },
  {
    id: 'stability-range',
    title: '稳定范围判定',
    summary: '根轨迹与虚轴交点决定稳定参数区间。',
    bullets: [
      '找出虚轴交点对应的参数值。',
      '比较虚轴左右的极点分布，确定稳定区间。',
      '用范围表达：p_min < p < p_max。',
    ],
    formula: 'Re(s) < 0',
  },
  {
    id: 'dominant-pole',
    title: '图形化思考：主导极点选择',
    summary: '先锁定主导极点，再反推参数区间。',
    bullets: [
      '主导极点决定阻尼比与速度指标。',
      '阻尼比由极点角度决定；自然频率由距离决定。',
      '在根轨迹上选取满足指标的极点对。',
    ],
  },
  {
    id: 'gain-mapping',
    title: '参数到增益的映射',
    summary: '把选定的根轨迹增益转回原参数。',
    bullets: [
      '先在根轨迹图上读出 K_eq。',
      '使用 K_eq = f(p) 反推出参数范围。',
      '检查参数是否落在工程约束区间。',
    ],
  },
  {
    id: 'validation',
    title: '仿真验证流程',
    summary: '用计算工具检验指标与超调。',
    bullets: [
      '用 Matlab/Simulink 绘制根轨迹并读取 K_eq。',
      '构造闭环系统，查看阶跃响应与超调。',
      '如不满足指标，回到根轨迹调整主导极点。',
    ],
  },
  {
    id: 'extension',
    title: '工程拓展',
    summary: '参数根轨迹用于鲁棒性与多参数分析。',
    bullets: [
      '区间多项式的稳定性分析可转化为参数根轨迹。',
      '关注“范围”而非单点，是工程图形化思考核心。',
      '可结合频域方法进行交叉验证。',
    ],
  },
];

interface ParameterRootLocusDeckProps extends BaseWidgetProps {}

export default function ParameterRootLocusDeck({ onComplete, onStateChange }: ParameterRootLocusDeckProps) {
  const interactive = useOptionalInteractiveContext();
  const initialActiveId = SECTIONS[0]?.id ?? 'definition';
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
  }, [initialActiveId, visited, interactive, onStateChange]);

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">参数根轨迹知识卡</h2>
        <p className="text-slate-600">掌握广义定义、稳定范围与图形化思考流程</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
            <BookOpen className="h-4 w-4" />
            知识导航
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
          <PathResourceContinueAction
            enabled={visited.length === SECTIONS.length}
            result={{ success: true, score: 100, data: { visited, total: SECTIONS.length } }}
            onComplete={onComplete}
          />

        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-slate-700">
                <Compass className="h-5 w-5 text-violet-500" />
                <h3 className="text-xl font-semibold">{activeSection.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-600">{activeSection.summary}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <GitBranch className="mr-1 inline h-3 w-3 text-violet-500" />
              轨迹思维
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {activeSection.bullets.map((item) => (
              <div
                key={item}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-600"
              >
                {item}
              </div>
            ))}
          </div>

          {activeSection.formula && (
            <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              关键表达式：{activeSection.formula}
            </div>
          )}

          <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Target className="h-4 w-4 text-emerald-500" />
              实操提示
            </div>
            <p className="mt-2 text-sm text-slate-600">
              每浏览完一张卡片，请尝试用一句话总结“它如何帮助你判断参数范围或性能”。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
