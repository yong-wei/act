'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Compass, FileText, Radio, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { simulationScenePalette } from '../components/simulation-theme';
import { formatAxisTick, simulationUi, useSimulationChartTheme } from '../components/simulation-ui';
import {
  DESTROYER_CURVE_SERIES,
  DESTROYER_EXPERIMENT_STEPS,
  destroyerFrontierSeq,
  type DestroyerExperimentStep,
  type DestroyerReadings,
  type DestroyerSample,
  type DestroyerSeriesId,
} from './destroyer-experiment';
import { SketchPad } from './sketch-pad';
import { StepNode } from './vessel-experiment-panels';

Chart.register(...registerables);

const SERIES_COLOR: Record<DestroyerSeriesId, string> = {
  desiredHeading: simulationScenePalette.danger,
  actualHeading: simulationScenePalette.success,
  yawRate: simulationScenePalette.headingPrimary,
  rudder: simulationScenePalette.dredgerPrimary,
  manualRudder: simulationScenePalette.cruisePrimary,
  speed: simulationScenePalette.icebreakerPrimary,
  crossTrackError: simulationScenePalette.warning,
};

export function DestroyerStepList({
  activeSeq,
  viewSeq,
  doneSeqs,
  onOpen,
}: {
  activeSeq: number;
  viewSeq: number;
  doneSeqs: number[];
  onOpen: (seq: number) => void;
}) {
  const frontier = destroyerFrontierSeq(doneSeqs);
  const progress = Math.round((doneSeqs.length / DESTROYER_EXPERIMENT_STEPS.length) * 100);
  return (
    <div className="w-full space-y-3" data-destroyer-step-nav>
      <div className="sim-hud-tile p-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-platform-fg-secondary">任务进度</span>
          <span className="sim-hud-value font-semibold">{doneSeqs.length}/{DESTROYER_EXPERIMENT_STEPS.length}</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-platform-fg-primary/10">
          <div className="h-full rounded-full bg-platform-action-primary shadow-[0_0_10px_hsl(var(--platform-action-primary))] transition-[width] duration-500" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[11px] leading-4 text-platform-fg-muted">当前进行第 {activeSeq} 步。已完成的步骤可以回去重做，只保留更好的成绩。还没完成的后续步骤不能打开。</p>
      </div>
      <ol className="relative space-y-1.5 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-platform-fg-primary/10">
        {DESTROYER_EXPERIMENT_STEPS.map((step) => {
          const done = doneSeqs.includes(step.seq);
          const locked = step.seq > frontier;
          const viewing = step.seq === viewSeq;
          return (
            <li key={step.seq} className="relative">
              <button
                type="button"
                disabled={locked}
                onClick={() => onOpen(step.seq)}
                data-destroyer-step={step.seq}
                data-destroyer-step-state={done ? 'done' : locked ? 'locked' : 'current'}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-lg border px-2 py-2 text-left text-xs transition',
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

export function DestroyerStatusPanel({
  heading,
  yawRate,
  rudder,
  manualRudder,
  speed,
  currentError,
  avgError,
  time,
  running,
  mode,
  samples,
  visible,
  onToggle,
}: {
  heading: number;
  yawRate: number;
  rudder: number;
  manualRudder: number;
  speed: number;
  currentError: number;
  avgError: number;
  time: number;
  running: boolean;
  mode: string;
  samples: DestroyerSample[];
  visible: Record<DestroyerSeriesId, boolean>;
  onToggle: (id: DestroyerSeriesId) => void;
}) {
  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="sim-hud-tile flex items-center justify-between gap-3 px-2.5 py-2 text-xs">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'h-2 w-2 rounded-full',
              running ? 'animate-pulse bg-[hsl(var(--platform-brand-success))] shadow-[0_0_8px_hsl(var(--platform-brand-success))]' : 'bg-platform-fg-primary/25',
            )}
          />
          <span className="font-medium text-platform-fg-primary">{running ? '运行中' : '已暂停'}</span>
        </span>
        <span className="rounded border border-platform-action-primary/30 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-platform-action-primary">{mode}</span>
        <span className="text-platform-fg-muted">仿真时间 <span className="sim-hud-value" data-destroyer-readout="time">{`${time.toFixed(1)} s`}</span></span>
      </div>
      <div className="space-y-2">
        <p className={simulationUi.sectionTitle}>
          <span className="flex items-center gap-1.5"><Compass className="h-3 w-3" aria-hidden="true" />导航状态</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <StatusTile label="航向" value={`${heading.toFixed(1)}°`} readout="heading" />
          <StatusTile label="转艏速率" value={`${yawRate.toFixed(2)}°/s`} readout="yaw" />
          <StatusTile label="舵角" value={`${rudder.toFixed(1)}°`} readout="rudder" />
          <StatusTile label="手操舵角" value={`${manualRudder.toFixed(1)}°`} readout="manual-rudder" />
          <StatusTile label="航速" value={`${speed.toFixed(1)} m/s`} readout="speed" />
        </div>
      </div>
      <div className="space-y-2">
        <p className={simulationUi.sectionTitle}>
          <span className="flex items-center gap-1.5"><Target className="h-3 w-3" aria-hidden="true" />航迹误差</span>
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <StatusTile label="当前误差" value={`${currentError.toFixed(1)} m`} />
          <StatusTile label="平均误差" value={`${avgError.toFixed(1)} m`} />
        </div>
      </div>
      <DestroyerCurve samples={samples} visible={visible} onToggle={onToggle} />
    </div>
  );
}

function StatusTile({ label, value, readout }: { label: string; value: string; readout?: string }) {
  return (
    <div className="sim-hud-tile min-w-0 px-2.5 py-2">
      <span className="block truncate text-[10px] tracking-wide text-platform-fg-muted">{label}</span>
      <span className="sim-hud-value mt-0.5 block truncate text-base font-semibold leading-5" data-destroyer-readout={readout}>{value}</span>
    </div>
  );
}

export function DestroyerCurve({
  samples,
  visible,
  onToggle,
}: {
  samples: DestroyerSample[];
  visible: Record<DestroyerSeriesId, boolean>;
  onToggle: (id: DestroyerSeriesId) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const chartTheme = useSimulationChartTheme();

  const last = samples[samples.length - 1];
  const headings = samples.map((sample) => sample.actualHeading);
  const headingMin = headings.length ? Math.min(...headings) : null;
  const headingMax = headings.length ? Math.max(...headings) : null;

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
    const datasets = DESTROYER_CURVE_SERIES.filter((series) => visible[series.id]).map((series) => ({
      label: series.label,
      data: samples.map((sample) => sample[series.id]),
      borderColor: SERIES_COLOR[series.id],
      pointRadius: 0,
      borderWidth: 1.75,
      tension: 0.25,
      fill: false,
    }));
    const values = datasets.flatMap((dataset) => dataset.data);
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
  }, [samples, visible, chartTheme]);

  return (
    <div className="w-full min-w-0 space-y-2">
      <p className={simulationUi.sectionTitle}>
        <span className="flex items-center gap-1.5"><Radio className="h-3 w-3" aria-hidden="true" />实时曲线</span>
      </p>
      <div className="flex flex-wrap gap-1.5" data-destroyer-series>
        {DESTROYER_CURVE_SERIES.map((series) => {
          const on = visible[series.id];
          const color = SERIES_COLOR[series.id];
          return (
            <label
              key={series.id}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 rounded-md border px-1.5 py-1 text-[11px] transition',
                on ? 'border-platform-fg-primary/15 bg-platform-fg-primary/5 text-platform-fg-primary' : 'border-transparent text-platform-fg-muted',
              )}
            >
              <input
                type="checkbox"
                className="h-3 w-3"
                checked={on}
                onChange={() => onToggle(series.id)}
                aria-label={series.label}
              />
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: on ? `0 0 6px ${color}` : undefined }} />
              <span>{series.label}</span>
              <span className="font-mono tabular-nums text-platform-fg-secondary" data-destroyer-series-value={series.id}>
                {formatSeriesValue(last, series.id)}
              </span>
            </label>
          );
        })}
      </div>
      {headingMin !== null && headingMax !== null ? (
        <p className="text-[11px] text-platform-fg-secondary" data-destroyer-heading-range>
          实际航向范围 <span className="sim-hud-value">{headingMin.toFixed(1)}° ~ {headingMax.toFixed(1)}°</span>
        </p>
      ) : null}
      <div className="sim-hud-tile h-44 w-full p-1.5">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

function formatSeriesValue(sample: DestroyerSample | undefined, id: DestroyerSeriesId): string {
  if (!sample) return '—';
  const digits = id === 'yawRate' ? 2 : 1;
  return sample[id].toFixed(digits);
}

export function DestroyerStepForm({
  step,
  readings,
  message,
  busy,
  reportEnabled,
  onChange,
  onSubmit,
  onReport,
  onAsk,
}: {
  step: DestroyerExperimentStep;
  readings: DestroyerReadings;
  message: string;
  busy: boolean;
  reportEnabled: boolean;
  onChange: (key: string, value: string) => void;
  onSubmit: () => void;
  onReport: () => void;
  onAsk: () => void;
}) {
  const showReport = step.scene === 'review';
  return (
    <div className="space-y-2.5">
      {step.fields.map((field) => (
        <label key={field.key} className="block space-y-1 text-xs text-platform-fg-secondary">
          <span className="flex items-baseline justify-between gap-2">
            <span>{field.label}</span>
            {field.unit ? <span className="font-mono text-[10px] text-platform-fg-muted">{field.unit}</span> : null}
          </span>
          {field.kind === 'text' ? (
            <textarea
              value={readings[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
              aria-label={field.label}
              rows={3}
              className="sim-hud-input"
            />
          ) : null}
          {field.kind === 'number' ? (
            <input
              value={readings[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
              aria-label={field.label}
              inputMode="decimal"
              className="sim-hud-input font-mono tabular-nums"
            />
          ) : null}
          {field.kind === 'choice' ? (
            <span className="flex flex-wrap gap-1">
              {field.choices?.map((choice) => (
                <Button
                  key={choice}
                  type="button"
                  size="sm"
                  variant={readings[field.key] === choice ? 'default' : 'outline'}
                  className={readings[field.key] === choice ? simulationUi.buttonPrimary : simulationUi.buttonOutline}
                  onClick={() => onChange(field.key, choice)}
                >
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
        <Button type="button" size="sm" disabled={busy} onClick={onSubmit} data-destroyer-submit className={cn(simulationUi.buttonPrimary, 'col-span-2 h-9')}>
          提交本步
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAsk} className={cn(simulationUi.buttonOutline, showReport ? '' : 'col-span-2')}>
          问控灵这一步
        </Button>
        {showReport ? (
          <Button type="button" size="sm" variant="outline" disabled={!reportEnabled} onClick={onReport} data-destroyer-report className={simulationUi.buttonOutline}>
            查看实验报告
          </Button>
        ) : null}
      </div>
      {message ? (
        <p className="rounded-md border border-platform-action-primary/25 bg-platform-action-primary/10 px-2.5 py-2 text-xs leading-5 text-platform-fg-primary" data-destroyer-message>{message}</p>
      ) : null}
    </div>
  );
}

export function DestroyerReportHistory({
  signedIn,
  reports,
  onOpen,
}: {
  signedIn: boolean;
  reports: Array<{ id: string; score: number; maxScore: number; createdAt: string }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="w-full min-w-0 space-y-2" data-destroyer-report-history>
      <p className={simulationUi.sectionTitle}>过往实验报告</p>
      {!signedIn ? (
        <p className="text-xs text-platform-fg-secondary">登录后可以查看这个实验已经保存的报告和成绩。</p>
      ) : null}
      {signedIn && reports.length === 0 ? (
        <p className="text-xs text-platform-fg-secondary">还没有保存过报告。完成最后一步后，报告会记在当前账号下。</p>
      ) : null}
      {signedIn ? (
        <ul className="space-y-1.5">
          {reports.map((report) => (
            <li key={report.id} className="sim-hud-tile flex items-center gap-2 px-2.5 py-2 text-xs text-platform-fg-secondary">
              <FileText className="h-3.5 w-3.5 shrink-0 text-platform-action-primary" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{new Date(report.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
              <span className="sim-hud-value shrink-0">成绩 {report.score}/{report.maxScore}</span>
              <Button type="button" size="sm" variant="outline" className={cn(simulationUi.buttonOutline, 'h-7 px-2')} onClick={() => onOpen(report.id)}>
                查看
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
