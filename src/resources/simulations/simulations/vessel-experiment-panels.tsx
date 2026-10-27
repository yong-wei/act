'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Chart, registerables } from 'chart.js';

import { Button } from '@/components/ui/button';
import { simulationScenePalette } from '../components/simulation-theme';
import { ExperimentStepAreas, SimulationDock, simulationUi, type ExperimentHostBrief } from '../components/simulation-ui';
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
  return (
    <div className="w-full space-y-2" data-vessel-experiment={experiment.key} data-vessel-step-nav={experiment.key}>
      <p className="text-xs text-platform-fg-secondary">当前进行第 {activeSeq} 步。已完成的步骤可以回去重做，只保留更好的成绩。还没完成的后续步骤不能打开。</p>
      <ol className="space-y-1">
        {experiment.steps.map((step) => {
          const done = doneSeqs.includes(step.seq);
          const locked = step.seq > frontier;
          const viewing = step.seq === viewSeq;
          return (
            <li key={step.seq}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onOpen(step.seq)}
                data-vessel-step={step.seq}
                data-vessel-step-state={done ? 'done' : locked ? 'locked' : 'current'}
                className={`block w-full rounded-md border px-2 py-1.5 text-left text-xs ${viewing ? 'border-platform-action-primary bg-platform-action-subtle' : 'border-platform-border bg-platform-surface-overlay/86'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="font-medium">{step.seq}. {step.title}</span>
                <span className="mt-0.5 block text-platform-fg-secondary">{done ? '已完成，可重做' : locked ? '未解锁' : '进行中'} · {step.goal}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
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
        plugins: { legend: { position: 'bottom', labels: { color: simulationScenePalette.chartText, boxWidth: 10 } } },
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
    const datasets = experiment.series.filter((series) => visible[series.id] !== false).map((series, index) => ({
      label: series.label,
      data: samples.map((sample) => vesselValue(sample, series.id)),
      borderColor: SERIES_COLORS[index % SERIES_COLORS.length],
      pointRadius: 0,
      borderWidth: 1.5,
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
    const y = chart.options.scales?.y;
    if (y) {
      y.min = min;
      y.max = max;
    }
    chart.update('none');
  }, [experiment.series, samples, visible]);

  return (
    <div className="w-max max-w-[calc(100vw-2rem)] space-y-2">
      <div className="flex w-max max-w-[calc(100vw-2rem)] flex-wrap gap-x-3 gap-y-1" data-vessel-series>
        {experiment.series.map((series) => (
          <label key={series.id} className="flex w-max items-center gap-1 text-xs text-platform-fg-secondary">
            <input type="checkbox" checked={visible[series.id] !== false} onChange={() => onToggle(series.id)} aria-label={series.label} />
            <span>{series.label}</span>
            <span className="font-mono text-platform-fg-primary" data-vessel-series-value={series.id}>
              {Number.isFinite(vesselValue(last, series.id)) ? vesselValue(last, series.id).toFixed(series.digits ?? 1) : '—'}
            </span>
          </label>
        ))}
      </div>
      <div className="h-40 w-full min-w-64">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export function VesselStatusReadouts({ rows }: { rows: Array<{ label: string; value: string; readout?: string }> }) {
  return (
    <div className="grid w-max grid-cols-[max-content_max-content] gap-x-4 gap-y-1 text-xs">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <span className="text-platform-fg-muted">{row.label}</span>
          <span className="font-mono text-platform-action-primary" data-vessel-readout={row.readout}>{row.value}</span>
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
    <div className="w-full space-y-2">
      {step.fields.map((field) => (
        <label key={field.key} className="block space-y-1 text-xs text-platform-fg-secondary">
          <span>{field.label}{field.unit ? `（${field.unit}）` : ''}</span>
          {field.kind === 'text' ? (
            <textarea value={readings[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)} aria-label={field.label} rows={3} className="w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1 text-sm text-platform-fg-primary" />
          ) : null}
          {field.kind === 'number' ? (
            <input value={readings[field.key] ?? ''} onChange={(event) => onChange(field.key, event.target.value)} aria-label={field.label} inputMode="decimal" className="w-full rounded-md border border-platform-border bg-platform-surface px-2 py-1 text-sm text-platform-fg-primary" />
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
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={onSubmit} data-vessel-submit className={simulationUi.buttonPrimary}>提交本步</Button>
        <Button type="button" size="sm" variant="outline" onClick={onAsk} className={simulationUi.buttonOutline}>问控灵这一步</Button>
        {showReport ? (
          <Button type="button" size="sm" variant="outline" disabled={!reportEnabled} onClick={onReport} data-vessel-report className={simulationUi.buttonOutline}>查看实验报告</Button>
        ) : null}
      </div>
      {message ? <p className="text-xs text-platform-fg-primary" data-vessel-message>{message}</p> : null}
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
    <div className="w-max max-w-[calc(100vw-2rem)] space-y-2" data-vessel-report-history>
      <p className="text-sm font-medium text-platform-fg-primary">过往实验报告</p>
      {!signedIn ? <p className="text-xs text-platform-fg-secondary">登录后可以查看这个实验已经保存的报告和成绩。</p> : null}
      {signedIn && reports.length === 0 ? <p className="text-xs text-platform-fg-secondary">还没有保存过报告。完成最后一步后，报告会记在当前账号下。</p> : null}
      {signedIn ? (
        <ul className="space-y-1">
          {reports.map((report) => (
            <li key={report.id} className="flex w-max max-w-full items-center gap-2 text-xs text-platform-fg-secondary">
              <span>{new Date(report.createdAt).toLocaleString('zh-CN', { hour12: false })}</span>
              <span>成绩 {report.score}/{report.maxScore}</span>
              <Button type="button" size="sm" variant="outline" className={simulationUi.buttonOutline} onClick={() => onOpen(report.id)}>查看</Button>
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
              <div className="w-max max-w-[calc(100vw-2rem)] space-y-3">
                {status}
                <VesselStatusReadouts
                  rows={experiment.series.map((series) => ({
                    label: series.label,
                    readout: series.id,
                    value: Number.isFinite(vesselValue(last, series.id))
                      ? vesselValue(last, series.id).toFixed(series.digits ?? 1)
                      : '—',
                  }))}
                />
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
              <div className="w-max max-w-[calc(100vw-2rem)] space-y-3">
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
