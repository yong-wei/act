'use client';

import { useEffect, useMemo, useState } from 'react';
import { PanelLeft, PanelRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSimulationSceneTheme } from './simulation-theme';

export const simulationUi = {
  root: 'relative h-screen w-full overflow-hidden bg-platform-canvas text-platform-fg-primary',
  topBar:
    'simulation-command-topbar absolute left-4 right-4 top-4 z-30 hidden h-12 items-center justify-between px-3 sm:flex',
  topBarTitleWrap: 'flex min-w-0 flex-col items-center justify-center px-3',
  topBarTitle: 'truncate text-sm font-semibold sm:text-base',
  topBarSubtitle: 'truncate text-[11px] opacity-75 sm:text-xs',
  backButton:
    'inline-flex items-center gap-1.5 rounded-md border border-platform-border bg-platform-surface-overlay/86 px-2.5 py-1.5 text-xs font-medium text-platform-fg-primary shadow-sm backdrop-blur transition hover:bg-platform-action-hover',
  badge:
    'rounded-md border border-platform-border bg-platform-surface-overlay/86 px-2.5 py-1 text-[11px] font-medium text-platform-fg-secondary shadow-sm backdrop-blur',
  panel: 'simulation-light-panel',
  controlPanelPosition: 'absolute inset-x-4 bottom-20 z-20 max-h-[46vh] overflow-y-auto pointer-events-auto lg:inset-auto lg:right-4 lg:top-4 lg:bottom-24 lg:w-[22rem] lg:max-h-none',
  statusPanelPosition: 'absolute inset-x-4 top-4 z-20 max-h-[30vh] overflow-y-auto pointer-events-auto lg:inset-auto lg:left-4 lg:top-4 lg:bottom-24 lg:w-[20rem] lg:max-h-none',
  cameraSwitcherPosition:
    'absolute bottom-4 left-4 right-4 z-20 max-w-[calc(100vw-2rem)] justify-center lg:left-1/2 lg:right-auto lg:max-w-none lg:-translate-x-1/2',
  sectionTitle: 'text-xs font-semibold tracking-wide text-platform-fg-primary',
  mutedText: 'text-xs text-platform-fg-secondary',
  valueText: 'font-mono text-platform-fg-primary',
  infoTile: 'rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2',
  buttonPrimary: 'border-transparent bg-platform-action-primary text-platform-fg-inverse hover:bg-platform-action-primary/90',
  buttonSecondary: 'border-transparent bg-platform-action-subtle text-platform-action-primary hover:bg-platform-action-hover',
  buttonOutline: 'border-platform-border bg-platform-surface text-platform-fg-primary hover:bg-platform-action-hover',
  tabsList: 'border border-platform-border bg-platform-canvas-muted',
  tabsTrigger:
    'text-platform-fg-secondary data-[state=active]:bg-platform-fg-primary data-[state=active]:text-platform-fg-inverse data-[state=active]:shadow-sm',
  dockBody: 'max-h-[calc(100vh-11.5rem)] overflow-y-auto',
  dockHeader: 'mb-3 flex items-center justify-between border-b border-platform-border pb-2',
  dockTitle: 'text-sm font-semibold text-platform-fg-primary',
  dockToggle:
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-platform-border bg-platform-surface-overlay/86 text-platform-fg-primary transition hover:bg-platform-action-hover',
  collapsedDockButton:
    'simulation-command-restore-handle absolute top-4 z-20 flex h-9 w-9 items-center justify-center',
  slider:
    '[&_.bg-secondary]:bg-platform-canvas-muted [&_.bg-primary]:bg-platform-action-primary [&_.bg-background]:bg-platform-surface [&_.border-primary]:border-platform-action-primary [&_.ring-offset-background]:ring-offset-platform-canvas',
  nativeRange: 'w-full cursor-pointer accent-[hsl(var(--platform-action-primary))]',
  statusDockTheme: '',
  controlDockTheme: '',
};

export function SimulationTopBar({
  title,
  subtitle,
  badge,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}) {
  return (
    <div
      className={cn('sr-only', className)}
      data-simulation-scene-local-chrome="removed"
      data-simulation-scene-title={title}
      data-simulation-scene-subtitle={subtitle}
      data-simulation-scene-identity={badge ?? 'AI-OBE 船舶仿真'}
    >
      {title}
      {subtitle ? ` · ${subtitle}` : ''}
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
    const mobileMedia = window.matchMedia('(max-width: 1353px)');
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
      data-command-deck-panel-anchor="top-command-area"
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
          title={`收起${title}`}
          data-simulation-panel-collapse-button={side}
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
  const sceneTheme = useSimulationSceneTheme();
  const score = useMemo(() => {
    if (!metrics.length) return 0;
    const sum = metrics.reduce((acc, metric) => acc + normalizeMetric(metric), 0);
    return sum / metrics.length;
  }, [metrics]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-3" style={{ backgroundColor: sceneTheme.hudOverlay }}>
        <div className="text-xs text-platform-fg-secondary">{title}</div>
        <div className="mt-1 text-2xl font-semibold" style={{ color: sceneTheme.labelColor }}>{score.toFixed(1)}</div>
        <div className="text-xs text-platform-fg-secondary">综合得分（0-100）</div>
      </div>
      <div className="space-y-2">
        {metrics.map((metric) => (
          <div key={metric.id} className="rounded-lg border border-platform-border bg-platform-surface-overlay/86 p-2" style={{ backgroundColor: sceneTheme.labelSurface }}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-platform-fg-secondary">{metric.label}</span>
              <span className="font-mono" style={{ color: sceneTheme.labelColor }}>
                {metric.value.toFixed(metric.precision ?? 1)}
                {metric.unit ?? ''}
              </span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-platform-canvas-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${normalizeMetric(metric)}%`, backgroundColor: sceneTheme.emphasis }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
