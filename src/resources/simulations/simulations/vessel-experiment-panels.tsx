'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Chart, registerables } from 'chart.js';
import { CheckCircle2, FileText, Lock, Radio } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { simulationScenePalette } from '../components/simulation-theme';
import {
  ExperimentStepAreas,
  SimulationDock,
  SimulationMissionTracker,
  formatAxisTick,
  simulationUi,
  useSimulationChartTheme,
  type ExperimentHostBrief,
} from '../components/simulation-ui';
import {
  vesselFrontierSeq,
  vesselValue,
  type VesselExperiment,
  type VesselReadings,
  type VesselSample,
  type VesselStep,
} from './vessel-experiment';
import { SketchPad } from './sketch-pad';
import type { VesselExperimentController } from './use-vessel-experiment';

Chart.register(...registerables);

const SERIES_COLORS = [
  simulationScenePalette.danger,
  simulationScenePalette.success,
  simulationScenePalette.headingPrimary,
  simulationScenePalette.dredgerPrimary,
  simulationScenePalette.cruisePrimary,
  simulationScenePalette.icebreakerPrimary,
  simulationScenePalette.warning,
  simulationScenePalette.containerPrimary,
];

function seriesColor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

export function VesselStepList({
  experiment,
  activeSeq,
  viewSeq,
  doneSeqs,
  onOpen,
}: {
  experiment: VesselExperiment;
  activeSeq: number;
  viewSeq: number;
  doneSeqs: number[];
  onOpen: (seq: number) => void;
}) {
  const frontier = vesselFrontierSeq(experiment.steps, doneSeqs);
  const progress = Math.round((doneSeqs.length / Math.max(experiment.steps.length, 1)) * 100);
  return (
    <div className="w-full space-y-3" data-vessel-experiment={experiment.key} data-vessel-step-nav={experiment.key}>
      <div className="sim-hud-tile p-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-platform-fg-secondary">任务进度</span>
          <span className="sim-hud-value font-semibold">{doneSeqs.length}/{experiment.steps.length}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-platform-fg-primary/10">
          <div className="h-full rounded-full bg-platform-action-primary shadow-[0_0_10px_hsl(var(--platform-action-primary))] transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[11px] leading-4 text-platform-fg-muted">当前进行第 {activeSeq} 步。已完成的步骤可以回去重做，只保留更好的成绩。还没完成的后续步骤不能打开。</p>
      </div>
      <ol className="relative space-y-1.5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-platform-fg-primary/10">
        {experiment.steps.map((step) => {
          const done = doneSeqs.includes(step.seq);
          const locked = step.seq > frontier;
          const viewing = step.seq === viewSeq;
          return (
            <li key={step.seq} className="relative">
              <button
                type="button"
                disabled={locked}
                onClick={() => onOpen(step.seq)}
                data-vessel-step={step.seq}
                data-vessel-step-state={done ? 'done' : locked ? 'locked' : 'current'}
                className={cn(
                  'group flex w-full items-start gap-2.5 rounded-lg border px-2 py-2 text-left text-xs transition',
                  viewing
                    ? 'border-platform-action-primary/60 bg-platform-action-primary/12 shadow-[0_0_18px_-8px_hsl(var(--platform-action-primary))]'
                    : 'border-transparent hover:border-platform-fg-primary/15 hover:bg-platform-fg-primary/5',
                  'disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-transparent disabled:hover:bg-transparent',
                )}
              >
                <StepNode done={done} locked={locked} viewing={viewing} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-platform-fg-primary">{step.seq}. {step.title}</span>
                  <span className="mt-0.5 block leading-4 text-platform-fg-secondary">
                    <span className={done ? 'text-[hsl(var(--platform-brand-success))]' : locked ? '' : 'text-platform-action-primary'}>
                      {done ? '已完成，可重做' : locked ? '未解锁' : '进行中'}
                    </span>
                    {' · '}{step.goal}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function StepNode({ done, locked, viewing }: { done: boolean; locked: boolean; viewing: boolean }) {
  return (
    <span
      className={cn(
        'relative z-[1] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[9px] font-bold',
        done
          ? 'border-[hsl(var(--platform-brand-success))] bg-[hsl(var(--platform-brand-success)/0.18)] text-[hsl(var(--platform-brand-success))]'
          : locked
            ? 'border-platform-fg-primary/20 bg-platform-canvas text-platform-fg-muted'
            : 'border-platform-action-primary bg-platform-canvas text-platform-action-primary shadow-[0_0_10px_hsl(var(--platform-action-primary))]',
        viewing && !done && !locked ? 'ring-2 ring-platform-action-primary/30' : null,
      )}
      aria-hidden="true"
    >
      {done ? <CheckCircle2 className="h-3 w-3" /> : locked ? <Lock className="h-2.5 w-2.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-platform-action-primary" />}
    </span>
  );
}

export function VesselCurve({
  experiment,
  samples,
  visible,
  onToggle,
}: {
  experiment: VesselExperiment;
  samples: VesselSample[];
  visible: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const chartTheme = useSimulationChartTheme();
  const last = samples[samples.length - 1];

  useEffect(() => {
    if (!canvasRef.current) return;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type: 'line',
      data: { labels: [], datasets: [] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxTicksLimit: 6, font: { size: 10 } }, grid: {}, border: { display: false } },
          y: { ticks: { maxTicksLimit: 5, font: { size: 10 }, callback: (value) => formatAxisTick(Number(value)) }, grid: {}, border: { display: false } },
        },
      },
    });
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const datasets = experiment.series
      .map((series, index) => ({ series, color: seriesColor(index) }))
      .filter(({ series }) => visible[series.id] !== false)
      .map(({ series, color }) => ({
        label: series.label,
        data: samples.map((sample) => vesselValue(sample, series.id)),
        borderColor: color,
        pointRadius: 0,
        borderWidth: 1.75,
        tension: 0.25,
        fill: false,
      }));
    const values = datasets.flatMap((dataset) => dataset.data).filter((value) => Number.isFinite(value));
    let min = 0;
    let max = 1;
    if (values.length > 0) {
      min = Math.min(...values);
      max = Math.max(...values);
      if (min === max) {
        min -= 1;
        max += 1;
      } else {
        const pad = (max - min) * 0.08;
        min -= pad;
        max += pad;
      }
    }
    chart.data.labels = samples.map((sample) => sample.time.toFixed(0));
    chart.data.datasets = datasets;
    const { x, y } = chart.options.scales ?? {};
    if (x) {
      if (x.ticks) x.ticks.color = chartTheme.tick;
      if (x.grid) x.grid.color = chartTheme.gridFaint;
    }
    if (y) {
      y.min = min;
      y.max = max;
      if (y.ticks) y.ticks.color = chartTheme.tick;
      if (y.grid) y.grid.color = chartTheme.grid;
    }
    chart.update('none');
  }, [experiment.series, samples, visible, chartTheme]);

  return (
    <div className="w-full min-w-0 space-y-2">
      <p className={simulationUi.sectionTitle}>
        <span className="flex items-center gap-1.5"><Radio className="h-3 w-3" aria-hidden="true" />实时曲线</span>
      </p>
      <div className="flex flex-wrap gap-1.5" data-vessel-series>
        {experiment.series.map((series, index) => {
          const on = visible[series.id] !== false;
          return (
            <label
              key={series.id}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] transition',
                on ? 'border-platform-fg-primary/15 bg-platform-fg-primary/5 text-platform-fg-primary' : 'border-transparent text-platform-fg-muted',
              )}
            >
              <input type="checkbox" className="h-3 w-3" checked={on} onChange={() => onToggle(series.id)} aria-label={series.label} />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: seriesColor(index), boxShadow: on ? `0 0 6px ${seriesColor(index)}` : undefined }} />
              <span>{series.label}</span>
              <span className="font-mono tabular-nums text-platform-fg-secondary" data-vessel-series-value={series.id}>
                {Number.isFinite(vesselValue(last, series.id)) ? vesselValue(last, series.id).toFixed(series.digits ?? 1) : '—'}
              </span>
            </label>
          );
        })}
      </div>
      <div className="sim-hud-tile h-44 w-full p-1.5">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export function VesselStatusReadouts({ rows }: { rows: Array<{ label: string; value: string; readout?: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {rows.map((row) => (
        <div key={row.label} className="sim-hud-tile min-w-0 px-2.5 py-2">
          <span className="block truncate text-[10px] tracking-wide text-platform-fg-muted">{row.label}</span>
          <span className="sim-hud-value mt-0.5 block truncate text-base font-semibold leading-5" data-vessel-readout={row.readout}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function VesselStepForm({
  step,
  readings,
  message,
  busy,
  reportEnabled,
  showReport,
  onChange,
  onSubmit,
  onReport,
  onAsk,
}: {
  step: VesselStep;
  readings: VesselReadings;
  message: string;
  busy: boolean;
  reportEnabled: boolean;
  showReport: boolean;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onReport: () => void;
  onAsk: () => void;
}) {
  return (
    <div className="w-full space-y-2.5">
      {step.fields.map((field) => (
        <label key={field.key} className="block space-y-1 text-xs text-platform-fg-secondary">
          <span className="flex items-baseline justify-between gap-2">
            <span>{field.label}</span>
            {field.unit ? <span className="font-mono text-[10px] text-platform-fg-muted">{field.unit}</span> : null}
          </span>
          {field.kind === 'text' ? (
            <textarea value={readings[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)} aria-label={field.label} rows={3} className="sim-hud-input" />
          ) : null}
          {field.kind === 'number' ? (
            <input value={readings[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)} aria-label={field.label} inputMode="decimal" className="sim-hud-input font-mono tabular-nums" />
          ) : null}
          {field.kind === 'choice' ? (
            <span className="flex flex-wrap gap-1">
              {field.choices?.map((choice) => (
                <Button key={choice} type="button" size="sm" variant={readings[field.key] === choice ? 'default' : 'outline'} className={readings[field.key] === choice ? simulationUi.buttonPrimary : simulationUi.buttonOutline} onClick={() => onChange(field.key, choice)}>
                  {choice}
                </Button>
              ))}
            </span>
          ) : null}
          {field.kind === 'sketch' ? (
            <SketchPad label={field.label} hint="画出奈奎斯特图、伯德图、根轨迹图或时域响应图。" onChange={(dataUrl) => onChange('sketchImage', dataUrl)} />
          ) : null}
        </label>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onSubmit} data-vessel-submit className={cn(simulationUi.buttonPrimary, 'col-span-2 h-9')}>提交本步</Button>
        <Button type="button" size="sm" variant="outline" onClick={onAsk} className={cn(simulationUi.buttonOutline, showReport ? '' : 'col-span-2')}>问控灵这一步</Button>
        {showReport ? (
          <Button type="button" size="sm" variant="outline" disabled={!reportEnabled} onClick={onReport} data-vessel-report className={simulationUi.buttonOutline}>查看实验报告</Button>
        ) : null}
      </div>
      {message ? <p className="rounded-md border border-platform-action-primary/25 bg-platform-action-primary/10 px-2.5 py-2 text-xs leading-5 text-platform-fg-primary" data-vessel-message>{message}</p> : null}
    </div>
  );
}

export function VesselReportHistory({
  signedIn,
  reports,
  onOpen,
}: {
  signedIn: boolean;
  reports: Array<{ id: string; score: number; maxScore: number; createdAt: string }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="w-full min-w-0 space-y-2" data-vessel-report-history>
      <p className={simulationUi.sectionTitle}>过往实验报告</p>
      {!signedIn ? <p className="text-xs text-platform-fg-secondary">登录后可以查看这个实验已经保存的报告和成绩。</p> : null}
      {signedIn && reports.length === 0 ? <p className="text-xs text-platform-fg-secondary">还没有保存过报告。完成最后一步后，报告会记在当前账号下。</p> : null}
      {signedIn ? (
        <ul className="space-y-1.5">
          {reports.map((report) => (
            <li key={report.id} className="sim-hud-tile flex items-center gap-2 px-2.5 py-2 text-xs text-platform-fg-secondary">
              <FileText className="h-3.5 w-3.5 shrink-0 text-platform-action-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{new Date(report.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
              <span className="sim-hud-value shrink-0">成绩 {report.score}/{report.maxScore}</span>
              <Button type="button" size="sm" variant="outline" className={cn(simulationUi.buttonOutline, 'h-7 px-2')} onClick={() => onOpen(report.id)}>查看</Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function VesselExperimentDocks({
  experiment,
  session,
  status,
  controls,
  assessment,
  stepNav,
  hostBrief,
  hostSubmission,
}: {
  experiment: VesselExperiment;
  session: VesselExperimentController;
  status?: ReactNode;
  controls: ReactNode;
  assessment?: ReactNode;
  stepNav?: ReactNode;
  hostBrief?: ExperimentHostBrief;
  hostSubmission?: ReactNode;
}) {
  const last = session.shownSamples[session.shownSamples.length - 1];
  return (
    <>
      {stepNav ? null : (
        <SimulationMissionTracker
          seq={session.activeSeq}
          total={experiment.steps.length}
          title={session.step.title}
          doneSeqs={session.doneSeqs}
          earnedPoints={session.earnedPoints}
          maxPoints={session.maxPoints}
        />
      )}
      <SimulationDock
        side="left"
        title="实验状态"
        fitContent
        defaultTab="status"
        tabs={[
          {
            id: 'steps',
            label: '实验步骤',
            content: stepNav ?? (
              <VesselStepList
                experiment={experiment}
                activeSeq={session.activeSeq}
                viewSeq={session.viewSeq}
                doneSeqs={session.doneSeqs}
                onOpen={session.openStep}
              />
            ),
          },
          {
            id: 'status',
            label: '状态',
            content: (
              <div className="w-full min-w-0 space-y-4">
                {status ? <div className="sim-hud-tile p-2.5">{status}</div> : null}
                <div className="space-y-2">
                  <p className={simulationUi.sectionTitle}>关键读数</p>
                  <VesselStatusReadouts
                    rows={experiment.series.map((series) => ({
                      label: series.label,
                      readout: series.id,
                      value: Number.isFinite(vesselValue(last, series.id))
                        ? vesselValue(last, series.id).toFixed(series.digits ?? 1)
                        : '—',
                    }))}
                  />
                </div>
                <VesselCurve
                  experiment={experiment}
                  samples={session.shownSamples}
                  visible={session.seriesVisible}
                  onToggle={session.toggleSeries}
                />
              </div>
            ),
          },
        ]}
      />
      <SimulationDock
        side="right"
        title="控制与探究"
        fitContent
        tabs={[
          {
            id: 'control',
            label: '控制',
            content: (
              <ExperimentStepAreas
                seq={hostBrief?.seq ?? session.step.seq}
                title={hostBrief?.title ?? session.step.title}
                goal={hostBrief?.goal ?? session.step.goal}
                watch={hostBrief ? hostBrief.watch : session.step.watch}
                hint={hostBrief ? hostBrief.hint : session.step.suggestion}
                controls={controls}
                submission={hostSubmission ?? (stepNav ? undefined : (
                  <VesselStepForm
                    step={session.step}
                    readings={session.readings}
                    message={session.message}
                    busy={session.busy}
                    reportEnabled={session.reportEnabled}
                    showReport={session.step.seq === experiment.steps.length}
                    onChange={session.setReading}
                    onSubmit={() => { void session.submitStep(); }}
                    onReport={session.openReport}
                    onAsk={session.ask}
                  />
                ))}
              />
            ),
          },
          {
            id: 'evaluate',
            label: '评估',
            content: (
              <div className="w-full min-w-0 space-y-4">
                <VesselReportHistory
                  signedIn={session.sessionStatus === 'authenticated'}
                  reports={session.pastReports ?? []}
                  onOpen={(id) => { void session.openStoredReport(id); }}
                />
                {assessment}
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
