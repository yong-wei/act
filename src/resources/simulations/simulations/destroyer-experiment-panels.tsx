'use client';

import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Compass, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { simulationScenePalette } from '../components/simulation-theme';
import { simulationUi } from '../components/simulation-ui';
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
  suggestion,
  onOpen,
}: {
  activeSeq: number;
  viewSeq: number;
  doneSeqs: number[];
  suggestion: string;
  onOpen: (seq: number) => void;
}) {
  const frontier = destroyerFrontierSeq(doneSeqs);
  return (
    <div className="w-max max-w-[calc(100vw-2rem)] space-y-2" data-destroyer-step-nav>
      <p className="text-xs text-platform-fg-secondary">当前进行第 {activeSeq} 步。已完成的步骤可以回去重做，只保留更好的成绩。还没完成的后续步骤不能打开。</p>
      <ol className="space-y-1">
        {DESTROYER_EXPERIMENT_STEPS.map((step) => {
          const done = doneSeqs.includes(step.seq);
          const locked = step.seq > frontier;
          const viewing = step.seq === viewSeq;
          return (
            <li key={step.seq}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onOpen(step.seq)}
                data-destroyer-step={step.seq}
                data-destroyer-step-state={done ? 'done' : locked ? 'locked' : 'current'}
                className={`block w-max max-w-full rounded-md border px-2 py-1.5 text-left text-xs ${viewing ? 'border-platform-action-primary bg-platform-action-subtle' : 'border-platform-border bg-platform-surface-overlay/86'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="font-medium">{step.seq}. {step.title}</span>
                <span className="mt-0.5 block text-platform-fg-secondary">{done ? '已完成，可重做' : locked ? '未解锁' : '进行中'} · {step.goal}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="text-xs leading-5 text-platform-fg-primary" data-destroyer-suggestion>{suggestion}</p>
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
    <div className="w-max max-w-[calc(100vw-2rem)] space-y-2">
      <div className="flex flex-wrap gap-2">
        <Card className={simulationUi.panel}>
          <CardHeader className="px-3 py-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Compass className="h-4 w-4 text-platform-action-primary" />
              导航状态
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-3 py-2 text-xs">
            <StatusRow label="航向" value={`${heading.toFixed(1)}°`} readout="heading" />
            <StatusRow label="转艏速率" value={`${yawRate.toFixed(2)}°/s`} readout="yaw" />
            <StatusRow label="舵角" value={`${rudder.toFixed(1)}°`} readout="rudder" />
            <StatusRow label="手操舵角" value={`${manualRudder.toFixed(1)}°`} readout="manual-rudder" />
            <StatusRow label="航速" value={`${speed.toFixed(1)} m/s`} readout="speed" />
          </CardContent>
        </Card>
        <Card className={simulationUi.panel}>
          <CardHeader className="px-3 py-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-[hsl(var(--platform-brand-success))]" />
              航迹误差
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 px-3 py-2 text-xs">
            <StatusRow label="当前误差" value={`${currentError.toFixed(1)} m`} />
            <StatusRow label="平均误差" value={`${avgError.toFixed(1)} m`} />
            <StatusRow label="仿真时间" value={`${time.toFixed(1)} s`} readout="time" />
          </CardContent>
        </Card>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className={`h-2 w-2 rounded-full ${running ? 'animate-pulse bg-[hsl(var(--platform-brand-success))]' : 'bg-platform-canvas-muted'}`} />
        <span className="text-platform-fg-muted">{running ? '运行中' : '已暂停'}</span>
        <span className="text-platform-fg-muted">|</span>
        <span className="uppercase text-platform-action-primary">{mode}</span>
      </div>
      <DestroyerCurve samples={samples} visible={visible} onToggle={onToggle} />
    </div>
  );
}

function StatusRow({ label, value, readout }: { label: string; value: string; readout?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-platform-fg-muted">{label}</span>
      <span className="w-max font-mono text-platform-action-primary" data-destroyer-readout={readout}>{value}</span>
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
        plugins: {
          legend: { position: 'bottom', labels: { color: simulationScenePalette.chartText, boxWidth: 10 } },
        },
        scales: {
          x: { ticks: { color: simulationScenePalette.chartTick, maxTicksLimit: 6 }, grid: { color: simulationScenePalette.chartGridFaint } },
          y: { ticks: { color: simulationScenePalette.chartTick }, grid: { color: simulationScenePalette.chartGrid } },
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
      borderWidth: 1.5,
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
    const y = chart.options.scales?.y;
    if (y) {
      y.min = min;
      y.max = max;
    }
    chart.update('none');
  }, [samples, visible]);

  return (
    <div className="w-max max-w-[calc(100vw-2rem)] space-y-2">
      <div className="flex w-max max-w-[calc(100vw-2rem)] flex-wrap gap-x-3 gap-y-1" data-destroyer-series>
        {DESTROYER_CURVE_SERIES.map((series) => (
          <label key={series.id} className="flex w-max items-center gap-1 text-xs text-platform-fg-secondary">
            <input
              type="checkbox"
              checked={visible[series.id]}
              onChange={() => onToggle(series.id)}
              aria-label={series.label}
            />
            <span>{series.label}</span>
            <span className="font-mono text-platform-fg-primary" data-destroyer-series-value={series.id}>
              {formatSeriesValue(last, series.id)}
            </span>
          </label>
        ))}
      </div>
      {headingMin !== null && headingMax !== null ? (
        <p className="w-max text-xs text-platform-fg-secondary" data-destroyer-heading-range>
          实际航向范围 {headingMin.toFixed(1)}° ~ {headingMax.toFixed(1)}°
        </p>
      ) : null}
      <div className="h-40 w-full">
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
  return (
    <div className="space-y-2 border-t border-platform-border pt-3">
      <p className="text-xs leading-5 text-platform-fg-secondary">{step.suggestion}</p>
      {step.fields.map((field) => (
        <label key={field.key} className="block space-y-1 text-xs text-platform-fg-secondary">
          <span>{field.label}{field.unit ? `（${field.unit}）` : ''}</span>
          {field.kind === 'text' ? (
            <textarea
              value={readings[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
              aria-label={field.label}
              rows={3}
              className="w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1 text-sm text-platform-fg-primary"
            />
          ) : null}
          {field.kind === 'number' ? (
            <input
              value={readings[field.key] ?? ''}
              onChange={(event) => onChange(field.key, event.target.value)}
              aria-label={field.label}
              inputMode="decimal"
              className="w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1 text-sm text-platform-fg-primary"
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
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onSubmit} data-destroyer-submit className={simulationUi.buttonPrimary}>
          提交本步
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onAsk} className={simulationUi.buttonOutline}>
          问控灵这一步
        </Button>
        {step.scene === 'review' ? (
          <Button type="button" size="sm" variant="outline" disabled={!reportEnabled} onClick={onReport} data-destroyer-report className={simulationUi.buttonOutline}>
            查看实验报告
          </Button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-platform-fg-primary" data-destroyer-message>{message}</p> : null}
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
    <div className="w-max max-w-[calc(100vw-2rem)] space-y-2" data-destroyer-report-history>
      <p className="text-sm font-medium text-platform-fg-primary">过往实验报告</p>
      {!signedIn ? (
        <p className="text-xs text-platform-fg-secondary">登录后可以查看这个实验已经保存的报告和成绩。</p>
      ) : null}
      {signedIn && reports.length === 0 ? (
        <p className="text-xs text-platform-fg-secondary">还没有保存过报告。完成最后一步后，报告会记在当前账号下。</p>
      ) : null}
      {signedIn ? (
        <ul className="space-y-1">
          {reports.map((report) => (
            <li key={report.id} className="flex w-max max-w-full items-center gap-2 text-xs text-platform-fg-secondary">
              <span>{new Date(report.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
              <span>成绩 {report.score}/{report.maxScore}</span>
              <Button type="button" size="sm" variant="outline" className={simulationUi.buttonOutline} onClick={() => onOpen(report.id)}>
                查看
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
