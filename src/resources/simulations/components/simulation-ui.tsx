'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PanelLeft, PanelRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const simulationUi = {
  root: 'relative h-screen w-full overflow-hidden bg-slate-950',
  topBar:
    'absolute left-4 right-4 top-4 z-30 flex h-12 items-center justify-between rounded-2xl border border-slate-200/90 bg-slate-50/90 px-3 shadow-xl shadow-slate-950/30 backdrop-blur-md',
  topBarTitleWrap: 'flex min-w-0 flex-col items-center justify-center px-3',
  topBarTitle: 'truncate text-sm font-semibold text-slate-900 sm:text-base',
  topBarSubtitle: 'truncate text-[11px] text-slate-700 sm:text-xs',
  backButton:
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 transition hover:bg-slate-100',
  badge:
    'rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-slate-800',
  panel:
    'rounded-2xl border border-slate-200/90 bg-slate-50/92 text-slate-900 shadow-2xl shadow-slate-950/30 backdrop-blur-md [&_.border-slate-700]:border-slate-300 [&_.border-slate-700\\/60]:border-slate-300 [&_.border-slate-700\\/70]:border-slate-300 [&_.border-slate-700\\/80]:border-slate-300 [&_.bg-slate-700]:bg-slate-200 [&_.bg-slate-800]:bg-white/90 [&_.bg-slate-800\\/60]:bg-white/90 [&_.bg-slate-800\\/70]:bg-white/90 [&_.bg-slate-800\\/80]:bg-white/90 [&_.bg-slate-900\\/80]:bg-slate-100 [&_.bg-slate-900\\/88]:bg-slate-100 [&_.bg-slate-950]:bg-slate-100 [&_.bg-slate-950\\/70]:bg-slate-100 [&_.bg-slate-950\\/80]:bg-slate-100 [&_.text-slate-100]:text-slate-900 [&_.text-slate-200]:text-slate-900 [&_.text-slate-300]:text-slate-800 [&_.text-slate-400]:text-slate-700 [&_.text-slate-500]:text-slate-600 [&_.text-white]:text-slate-900 [&_.text-cyan-300]:text-slate-900 [&_.text-cyan-400]:text-slate-900 [&_.text-cyan-500]:text-slate-900 [&_.text-blue-400]:text-slate-900 [&_.text-purple-400]:text-slate-900',
  controlPanelPosition: 'absolute right-4 top-20 z-20 w-[22rem] pointer-events-auto',
  statusPanelPosition: 'absolute left-4 top-20 z-20 w-[20rem] pointer-events-auto',
  cameraSwitcherPosition: 'absolute bottom-4 left-1/2 z-20 -translate-x-1/2',
  sectionTitle: 'text-xs font-semibold tracking-wide text-slate-700',
  mutedText: 'text-xs text-slate-600',
  valueText: 'font-mono text-slate-900',
  infoTile: 'rounded-lg border border-slate-200 bg-white/90 p-2',
  buttonPrimary: 'border-transparent bg-sky-700 text-white hover:bg-sky-600',
  buttonSecondary: 'border-transparent bg-amber-600 text-white hover:bg-amber-500',
  buttonOutline: 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100',
  tabsList: 'border border-slate-300 bg-slate-100',
  tabsTrigger:
    'text-slate-700 data-[state=active]:bg-slate-900 data-[state=active]:text-white data-[state=active]:shadow-sm',
  dockBody: 'max-h-[calc(100vh-11.5rem)] overflow-y-auto',
  dockHeader: 'mb-3 flex items-center justify-between border-b border-slate-300/90 pb-2',
  dockTitle: 'text-sm font-semibold text-slate-900',
  dockToggle:
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100',
  collapsedDockButton:
    'absolute top-20 z-20 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50/95 text-slate-800 shadow-xl shadow-slate-950/30 backdrop-blur-md',
  slider:
    '[&_.bg-secondary]:bg-slate-300 [&_.bg-primary]:bg-sky-700 [&_.bg-background]:bg-white [&_.border-primary]:border-sky-700 [&_.ring-offset-background]:ring-offset-slate-50',
  nativeRange: 'w-full cursor-pointer accent-sky-700',
  statusDockTheme:
    'text-slate-900 [&_*]:text-slate-900 [&_.text-muted-foreground]:text-slate-900 [&_.text-red-300]:text-slate-900 [&_.text-red-400]:text-slate-900 [&_.text-red-500]:text-slate-900 [&_.text-red-600]:text-slate-900 [&_.text-amber-600]:text-slate-900 [&_.text-amber-700]:text-slate-900 [&_.text-yellow-400]:text-slate-900 [&_.text-green-400]:text-slate-900 [&_.text-green-500]:text-slate-900 [&_.text-green-600]:text-slate-900 [&_.text-sky-700]:text-slate-900 [&_.text-blue-400]:text-slate-900 [&_.text-purple-400]:text-slate-900 [&_.text-cyan-300]:text-slate-900 [&_.text-cyan-400]:text-slate-900 [&_.text-cyan-500]:text-slate-900',
  controlDockTheme:
    '[&_.text-red-300]:text-red-700 [&_.text-red-400]:text-red-700 [&_.text-red-500]:text-red-700 [&_.text-yellow-400]:text-amber-700 [&_.text-green-400]:text-emerald-700 [&_.text-green-500]:text-emerald-700 [&_.text-blue-400]:text-sky-700 [&_.text-purple-400]:text-slate-700 [&_.text-cyan-300]:text-slate-900 [&_.text-cyan-400]:text-slate-900 [&_.text-cyan-500]:text-slate-900',
};

export function SimulationTopBar({
  title,
  subtitle,
  badge,
  backHref = '/simulations',
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  backHref?: string;
  className?: string;
}) {
  return (
    <div className={cn(simulationUi.topBar, className)}>
      <Link href={backHref} className={simulationUi.backButton}>
        <ArrowLeft className="h-3.5 w-3.5" />
        返回上一层
      </Link>

      <div className={simulationUi.topBarTitleWrap}>
        <h1 className={simulationUi.topBarTitle}>{title}</h1>
        {subtitle ? <p className={simulationUi.topBarSubtitle}>{subtitle}</p> : null}
      </div>

      <div className={cn(simulationUi.badge, 'max-w-[40%] truncate text-right')}>
        {badge ?? 'AI-OBE 船舶仿真'}
      </div>
    </div>
  );
}

export interface SimulationDockTab {
  id: string;
  label: string;
  content: React.ReactNode;
}

export function SimulationDock({
  side,
  title,
  tabs,
  defaultTab,
  className,
}: {
  side: 'left' | 'right';
  title: string;
  tabs: SimulationDockTab[];
  defaultTab?: string;
  className?: string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const singleTab = tabs.length <= 1;
  const activeDefaultTab = defaultTab ?? tabs[0]?.id;
  const dockPosition = side === 'left' ? simulationUi.statusPanelPosition : simulationUi.controlPanelPosition;
  const dockTheme = side === 'left' ? simulationUi.statusDockTheme : simulationUi.controlDockTheme;
  const collapsedPosition =
    side === 'left'
      ? 'left-4'
      : 'right-4';

  if (collapsed) {
    return (
      <button
        type="button"
        className={cn(simulationUi.collapsedDockButton, collapsedPosition)}
        onClick={() => setCollapsed(false)}
        aria-label={`展开${title}`}
      >
        {side === 'left' ? <PanelLeft className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div className={cn(simulationUi.panel, dockPosition, dockTheme, 'p-3 text-sm', className)}>
      <div className={simulationUi.dockHeader}>
        <h3 className={simulationUi.dockTitle}>{title}</h3>
        <button
          type="button"
          className={simulationUi.dockToggle}
          onClick={() => setCollapsed(true)}
          aria-label={`收起${title}`}
        >
          {side === 'left' ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {singleTab ? (
        <div className={simulationUi.dockBody}>{tabs[0]?.content}</div>
      ) : (
        <Tabs defaultValue={activeDefaultTab}>
          <TabsList className={cn('mb-3 grid w-full', simulationUi.tabsList)} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className={simulationUi.tabsTrigger}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className={simulationUi.dockBody}>
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-0">
                {tab.content}
              </TabsContent>
            ))}
          </div>
        </Tabs>
      )}
    </div>
  );
}

export interface SimulationAssessmentMetric {
  id: string;
  label: string;
  value: number;
  max: number;
  better: 'higher' | 'lower';
  unit?: string;
  precision?: number;
}

function normalizeMetric(metric: SimulationAssessmentMetric): number {
  const max = Math.max(metric.max, 0.0001);
  const ratio = metric.value / max;
  if (metric.better === 'higher') {
    return Math.min(Math.max(ratio * 100, 0), 100);
  }
  return Math.min(Math.max(100 - ratio * 100, 0), 100);
}

export function SimulationAssessmentPanel({
  title = '多目标评估',
  metrics,
}: {
  title?: string;
  metrics: SimulationAssessmentMetric[];
}) {
  const score = useMemo(() => {
    if (!metrics.length) return 0;
    const sum = metrics.reduce((acc, metric) => acc + normalizeMetric(metric), 0);
    return sum / metrics.length;
  }, [metrics]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-slate-300 bg-white p-3">
        <div className="text-xs text-slate-600">{title}</div>
        <div className="mt-1 text-2xl font-semibold text-slate-900">{score.toFixed(1)}</div>
        <div className="text-xs text-slate-600">综合得分（0-100）</div>
      </div>
      <div className="space-y-2">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-lg border border-slate-300 bg-white p-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-700">{metric.label}</span>
              <span className="font-mono text-slate-900">
                {metric.value.toFixed(metric.precision ?? 1)}
                {metric.unit ?? ''}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-700"
                style={{ width: `${normalizeMetric(metric)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
