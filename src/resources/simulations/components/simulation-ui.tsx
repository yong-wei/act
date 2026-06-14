'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, PanelLeft, PanelRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export const simulationUi = {
  root: 'relative h-screen w-full overflow-hidden bg-slate-950',
  topBar:
    'simulation-command-topbar absolute left-4 right-4 top-4 z-30 hidden h-12 items-center justify-between px-3 sm:flex',
  topBarTitleWrap: 'flex min-w-0 flex-col items-center justify-center px-3',
  topBarTitle: 'truncate text-sm font-semibold sm:text-base',
  topBarSubtitle: 'truncate text-[11px] opacity-75 sm:text-xs',
  backButton:
    'inline-flex items-center gap-1.5 rounded-md border border-current/20 bg-white/35 px-2.5 py-1.5 text-xs font-medium transition hover:bg-white/50 dark:bg-white/10 dark:hover:bg-white/15',
  badge:
    'rounded-md border border-current/20 bg-white/35 px-2.5 py-1 text-[11px] font-medium dark:bg-white/10',
  panel: 'simulation-light-panel',
  controlPanelPosition: 'absolute inset-x-4 bottom-20 z-20 max-h-[46vh] overflow-y-auto pointer-events-auto lg:inset-auto lg:right-4 lg:top-20 lg:bottom-auto lg:w-[22rem] lg:max-h-[calc(100vh-7rem)]',
  statusPanelPosition: 'absolute inset-x-4 top-4 z-20 max-h-[30vh] overflow-y-auto pointer-events-auto lg:inset-auto lg:left-4 lg:top-20 lg:w-[20rem] lg:max-h-[calc(100vh-7rem)]',
  cameraSwitcherPosition: 'absolute bottom-4 left-4 right-4 z-20 justify-center lg:left-1/2 lg:right-auto lg:-translate-x-1/2',
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
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-current/20 bg-white/35 transition hover:bg-white/50 dark:bg-white/10 dark:hover:bg-white/15',
  collapsedDockButton:
    'simulation-command-restore-handle absolute top-4 z-20 flex h-9 w-9 items-center justify-center lg:top-20',
  slider:
    '[&_.bg-secondary]:bg-slate-300 [&_.bg-primary]:bg-sky-700 [&_.bg-background]:bg-white [&_.border-primary]:border-sky-700 [&_.ring-offset-background]:ring-offset-slate-50',
  nativeRange: 'w-full cursor-pointer accent-sky-700',
  statusDockTheme: '',
  controlDockTheme: '',
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

  useEffect(() => {
    const mobileMedia = window.matchMedia('(max-width: 1023px)');
    const applyResponsiveDefault = () => setCollapsed(mobileMedia.matches);

    applyResponsiveDefault();
    mobileMedia.addEventListener('change', applyResponsiveDefault);
    return () => mobileMedia.removeEventListener('change', applyResponsiveDefault);
  }, []);

  if (collapsed) {
    return (
      <button
        type="button"
        className={cn(simulationUi.collapsedDockButton, collapsedPosition)}
        onClick={() => setCollapsed(false)}
        aria-label={`展开${title}`}
        data-simulation-panel-restore-handle={side}
      >
        {side === 'left' ? <PanelLeft className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
      </button>
    );
  }

  return (
    <div
      className={cn(simulationUi.panel, dockPosition, dockTheme, 'p-3 text-sm', className)}
      data-simulation-local-panel={side}
      data-simulation-panel-collapsible="true"
      data-command-deck-glass-surface="true"
      data-task-workspace-zone={side === 'left' ? 'status-rail' : 'local-tools'}
    >
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
