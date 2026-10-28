'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  Lightbulb,
  PanelLeft,
  PanelRight,
  SlidersHorizontal,
  Trophy,
} from 'lucide-react';
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
  controlPanelPosition: 'absolute inset-x-4 bottom-20 z-20 h-[46vh] max-h-[46vh] overflow-hidden pointer-events-auto lg:inset-auto lg:right-4 lg:top-4 lg:bottom-auto lg:h-[calc(100%-5.25rem)] lg:max-h-[calc(100%-5.25rem)] lg:w-[24rem]',
  statusPanelPosition: 'absolute inset-x-4 top-4 z-20 h-[30vh] max-h-[30vh] overflow-hidden pointer-events-auto lg:inset-auto lg:left-4 lg:top-4 lg:bottom-auto lg:h-[calc(100%-5.25rem)] lg:max-h-[calc(100%-5.25rem)] lg:w-[22rem]',
  cameraSwitcherPosition:
    'absolute bottom-4 left-4 right-4 z-40 max-w-[calc(100vw-2rem)] justify-center lg:left-1/2 lg:right-auto lg:max-w-none lg:-translate-x-1/2',
  sectionTitle: 'sim-hud-section-title',
  mutedText: 'text-xs text-platform-fg-secondary',
  valueText: 'sim-hud-value',
  infoTile: 'sim-hud-tile p-2',
  buttonPrimary:
    'border border-platform-action-primary/70 bg-platform-action-primary font-semibold tracking-wide text-platform-fg-inverse shadow-[0_0_20px_-6px_hsl(var(--platform-action-primary)/0.9)] transition hover:bg-platform-action-primary/90 hover:shadow-[0_0_26px_-4px_hsl(var(--platform-action-primary))] disabled:shadow-none',
  buttonSecondary:
    'border border-platform-action-primary/30 bg-platform-action-primary/12 text-platform-action-primary hover:bg-platform-action-primary/20',
  buttonOutline:
    'border border-platform-fg-primary/15 bg-platform-canvas/40 text-platform-fg-primary hover:border-platform-action-primary/50 hover:bg-platform-action-primary/10',
  tabsList: 'h-9 rounded-lg border border-platform-action-primary/20 bg-platform-canvas/50 p-0.5',
  tabsTrigger:
    'rounded-md text-xs font-medium tracking-wide text-platform-fg-secondary transition data-[state=active]:bg-platform-action-primary/15 data-[state=active]:text-platform-action-primary data-[state=active]:shadow-[inset_0_-2px_0_hsl(var(--platform-action-primary))]',
  dockBody: 'min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pr-1 [&>*]:min-w-0 [&>*]:w-full',
  dockHeader: 'mb-3 flex items-center justify-between gap-3 border-b border-platform-fg-primary/10 pb-2.5',
  dockTitle: 'text-sm font-semibold tracking-wide text-platform-fg-primary',
  dockToggle:
    'inline-flex h-7 w-7 items-center justify-center rounded-md border border-platform-fg-primary/15 bg-platform-canvas/40 text-platform-fg-secondary transition hover:border-platform-action-primary/50 hover:text-platform-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary',
  collapsedDockButton:
    'simulation-command-restore-handle absolute top-4 z-20 flex h-10 items-center gap-2 px-3 text-xs font-semibold text-platform-fg-primary transition hover:text-platform-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-platform-action-primary',
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
  fitContent = false,
}: {
  side: 'left' | 'right';
  title: string;
  tabs: SimulationDockTab[];
  defaultTab?: string;
  className?: string;
  fitContent?: boolean;
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
    const mobileMedia = window.matchMedia('(max-width: 1279px)');
    const applyResponsiveDefault = () => setCollapsed(mobileMedia.matches);

    applyResponsiveDefault();
    mobileMedia.addEventListener('change', applyResponsiveDefault);
    return () => mobileMedia.removeEventListener('change', applyResponsiveDefault);
  }, []);

  const DockIcon = side === 'left' ? Activity : SlidersHorizontal;
  const caption = side === 'left' ? '实时遥测' : '指令与任务';

  if (collapsed) {
    return (
      <button
        type="button"
        className={cn(simulationUi.collapsedDockButton, collapsedPosition)}
        onClick={() => setCollapsed(false)}
        aria-label={`展开${title}`}
        data-simulation-panel-restore-handle={side}
      >
        {side === 'left' ? <PanelLeft className="h-4 w-4 text-platform-action-primary" /> : <PanelRight className="h-4 w-4 text-platform-action-primary" />}
        <span className="max-sm:hidden" aria-hidden="true">{title}</span>
      </button>
    );
  }

  return (
    <div
      className={cn(simulationUi.panel, dockPosition, dockTheme, 'flex flex-col overflow-hidden p-3 text-sm', className)}
      data-simulation-local-panel={side}
      data-simulation-panel-collapsible="true"
      data-command-deck-panel-anchor="top-command-area"
      data-command-deck-glass-surface="true"
      data-task-workspace-zone={side === 'left' ? 'status-rail' : 'local-tools'}
    >
      <div className={simulationUi.dockHeader}>
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-platform-action-primary/35 bg-platform-action-primary/12 text-platform-action-primary shadow-[0_0_16px_-6px_hsl(var(--platform-action-primary))]">
            <DockIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className={simulationUi.dockTitle}>{title}</h3>
            <p className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-platform-fg-muted">
              <span className="sim-hud-led" aria-hidden="true" />
              {caption}
            </p>
          </div>
        </div>
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
        <div className={simulationUi.dockBody} data-dock-scroll>{tabs[0]?.content}</div>
      ) : (
        <Tabs defaultValue={activeDefaultTab} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className={cn('mb-3 shrink-0', fitContent ? 'flex w-full' : 'grid w-full', simulationUi.tabsList)} style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id} className={simulationUi.tabsTrigger}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className={simulationUi.dockBody} data-dock-scroll>
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

export interface ExperimentHostBrief {
  seq: number;
  title: string;
  goal: string;
  watch?: string;
  hint?: string;
}

export function ExperimentStepAreas({
  seq,
  title,
  goal,
  watch,
  hint,
  hintAttribute,
  controls,
  submission,
}: {
  seq: number;
  title: string;
  goal: string;
  watch?: string;
  hint?: string;
  hintAttribute?: string;
  controls: ReactNode;
  submission?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <section className="sim-hud-brief p-3 pl-4" data-step-brief>
        <div className="flex items-start gap-3">
          <div className="flex shrink-0 flex-col items-center rounded-md border border-platform-action-primary/35 bg-platform-canvas/50 px-2 py-1">
            <span className="text-[9px] font-semibold tracking-[0.2em] text-platform-fg-muted">任务</span>
            <span className="sim-hud-value text-lg font-bold leading-none">{String(seq).padStart(2, '0')}</span>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold tracking-[0.2em] text-platform-action-primary">任务简报</p>
            <p className="mt-0.5 text-sm font-semibold leading-5 text-platform-fg-primary">第 {seq} 步 · {title}</p>
          </div>
        </div>
        <div className="mt-3 space-y-1.5 text-xs leading-5">
          <p className="flex gap-2 text-platform-fg-primary" data-step-goal>
            <Crosshair className="mt-0.5 h-3.5 w-3.5 shrink-0 text-platform-action-primary" aria-hidden="true" />
            <span>本步目标：{goal}</span>
          </p>
          {watch ? (
            <p className="flex gap-2 text-platform-fg-primary">
              <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-platform-action-primary" aria-hidden="true" />
              <span>本步要看：{watch}</span>
            </p>
          ) : null}
          {hint ? (
            <p
              className="flex gap-2 rounded-md bg-[hsl(var(--platform-brand-evidence)/0.1)] px-2 py-1.5 text-platform-fg-secondary"
              data-step-hint
              {...(hintAttribute ? { [hintAttribute]: '' } : {})}
            >
              <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(var(--platform-brand-evidence))]" aria-hidden="true" />
              <span>{hint}</span>
            </p>
          ) : null}
        </div>
      </section>
      <section className="space-y-2.5" data-step-controls>
        <p className={simulationUi.sectionTitle}>控制</p>
        {controls}
      </section>
      {submission ? (
        <section className="space-y-2.5" data-step-submit>
          <p className={simulationUi.sectionTitle}>填写与提交</p>
          {submission}
        </section>
      ) : null}
    </div>
  );
}

export function SimulationMissionTracker({
  seq,
  total,
  title,
  doneSeqs,
  earnedPoints,
  maxPoints,
}: {
  seq: number;
  total: number;
  title: string;
  doneSeqs: number[];
  earnedPoints: number;
  maxPoints: number;
}) {
  const ticks = Array.from({ length: total }, (_, index) => index + 1);
  return (
    <div
      className="sim-hud-tracker pointer-events-none absolute left-1/2 top-4 z-10 hidden w-[min(25rem,calc(100%-2rem))] -translate-x-1/2 px-3.5 py-2.5 md:block"
      data-simulation-mission-tracker
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="sim-hud-led" />
          <span className="text-[10px] font-semibold tracking-[0.2em] text-platform-fg-muted">当前任务</span>
          <span className="sim-hud-value text-xs font-bold">{String(seq).padStart(2, '0')}/{String(total).padStart(2, '0')}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-platform-fg-secondary">
          <Trophy className="h-3.5 w-3.5 text-[hsl(var(--platform-brand-evidence))]" />
          <span className="sim-hud-value font-semibold">{earnedPoints}</span>
          <span className="text-platform-fg-muted">/ {maxPoints}</span>
        </span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-platform-fg-primary">{seq}. {title}</p>
      <div className="mt-2 flex gap-[3px]">
        {ticks.map((tick) => {
          const done = doneSeqs.includes(tick);
          const current = tick === seq;
          return (
            <span
              key={tick}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                current
                  ? 'bg-platform-action-primary shadow-[0_0_8px_hsl(var(--platform-action-primary))]'
                  : done
                    ? 'bg-[hsl(var(--platform-brand-success)/0.85)]'
                    : 'bg-platform-fg-primary/15',
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

export interface SimulationChartTheme {
  tick: string;
  grid: string;
  gridFaint: string;
}

export function formatAxisTick(value: number): string {
  const magnitude = Math.abs(value);
  return value.toFixed(magnitude >= 100 ? 0 : magnitude >= 10 ? 1 : 2);
}

export function useSimulationChartTheme(): SimulationChartTheme {
  const sceneTheme = useSimulationSceneTheme();
  return useMemo(
    () => ({ tick: sceneTheme.chartTick, grid: sceneTheme.chartGrid, gridFaint: sceneTheme.chartGridFaint }),
    [sceneTheme],
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

function assessmentGrade(score: number): { grade: string; label: string; tone: string } {
  if (score >= 90) return { grade: 'S', label: '卓越', tone: 'hsl(var(--platform-brand-evidence))' };
  if (score >= 80) return { grade: 'A', label: '优秀', tone: 'hsl(var(--platform-brand-success))' };
  if (score >= 65) return { grade: 'B', label: '良好', tone: 'hsl(var(--platform-action-primary))' };
  if (score >= 50) return { grade: 'C', label: '及格', tone: 'hsl(var(--platform-brand-evidence))' };
  return { grade: 'D', label: '需改进', tone: 'hsl(var(--platform-brand-danger))' };
}

function metricTone(normalized: number): string {
  if (normalized >= 75) return 'hsl(var(--platform-brand-success))';
  if (normalized >= 45) return 'hsl(var(--platform-brand-evidence))';
  return 'hsl(var(--platform-brand-danger))';
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
  const grade = assessmentGrade(score);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="space-y-3">
      <p className={simulationUi.sectionTitle}>{title}</p>
      <div className="sim-hud-tile flex items-center gap-4 p-3" style={{ backgroundColor: sceneTheme.hudOverlay }}>
        <div className="relative h-20 w-20 shrink-0">
          <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden="true">
            <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" strokeWidth="5" className="text-platform-fg-primary/10" />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={grade.tone}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - score / 100)}
              style={{ filter: `drop-shadow(0 0 6px ${grade.tone})`, transition: 'stroke-dashoffset 400ms ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black leading-none" style={{ color: grade.tone, textShadow: `0 0 14px ${grade.tone}` }}>{grade.grade}</span>
            <span className="mt-0.5 text-[10px] text-platform-fg-muted">{grade.label}</span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] tracking-[0.18em] text-platform-fg-muted">综合得分（0-100）</div>
          <div className="sim-hud-value mt-1 text-3xl font-bold leading-none" style={{ color: sceneTheme.labelColor }}>{score.toFixed(1)}</div>
          <div className="mt-1.5 text-[11px] leading-4 text-platform-fg-secondary">按当前运行状态实时计算，提交步骤后以正式成绩为准。</div>
        </div>
      </div>
      <div className="grid gap-2">
        {metrics.map((metric) => {
          const normalized = normalizeMetric(metric);
          const tone = metricTone(normalized);
          return (
            <div key={metric.id} className="sim-hud-tile p-2.5" style={{ backgroundColor: sceneTheme.labelSurface }}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-platform-fg-secondary">{metric.label}</span>
                <span className="sim-hud-value" style={{ color: sceneTheme.labelColor }}>
                  {metric.value.toFixed(metric.precision ?? 1)}
                  <span className="ml-0.5 text-[10px] text-platform-fg-muted">{metric.unit ?? ''}</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-platform-fg-primary/10">
                <div
                  className="h-full rounded-full transition-[width] duration-300"
                  style={{ width: `${normalized}%`, backgroundColor: tone, boxShadow: `0 0 10px ${tone}` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
