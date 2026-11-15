'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { Crosshair, Sparkles } from 'lucide-react';
import { useOptionalGlobalAI } from '@/components/providers/global-ai-provider';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';
import { useSimulationChartTheme } from '../components/simulation-ui';
import type { VesselSample } from '../simulations/vessel-experiment';
import type { VesselModelComparison } from './student-analysis';
import { computeResidualDiagnostics, downsampleSeriesIndices } from './mismatch-diagnostics';
import { ThreeLayerTopology } from './three-layer-topology';
import { detectVesselCurveAnomalies, type CurveAnomalySnapshot } from './curve-anomaly-detector';

Chart.register(...registerables);
type Channel = 'heading' | 'yawRate' | 'rudder' | 'waterSpeed' | 'groundSpeed' | 'waterLateralSpeed'
  | 'groundLateralSpeed' | 'north' | 'east' | 'roll' | 'rollRate';
const channels: Array<{ value: Channel; label: string; unit: string; measurement?: string }> = [
  { value: 'heading', label: '航向', unit: '°', measurement: 'Heading' },
  { value: 'yawRate', label: '转艏速率', unit: '°/s', measurement: 'YawRate' },
  { value: 'rudder', label: '实际舵角', unit: '°', measurement: 'SurfaceEncoder0' },
  { value: 'waterSpeed', label: '对水航速', unit: 'm/s', measurement: 'SpeedLog' },
  { value: 'groundSpeed', label: '纵向对地速度', unit: 'm/s' },
  { value: 'groundLateralSpeed', label: '横向对地速度', unit: 'm/s' },
  { value: 'waterLateralSpeed', label: '横向对水速度', unit: 'm/s' },
  { value: 'north', label: '北向位置', unit: 'm', measurement: 'North' },
  { value: 'east', label: '东向横偏', unit: 'm', measurement: 'East' },
  { value: 'roll', label: '横摇角', unit: '°' },
  { value: 'rollRate', label: '横摇角速度', unit: '°/s', measurement: 'RollRate' },
];
const sources = [
  { key: 'truth', label: '物理后台仿真', color: '#34d399' },
  { key: 'measurement', label: '仪器量测', color: '#22d3ee' },
  { key: 'estimate', label: '状态估计', color: '#a78bfa' },
  { key: 'model', label: '学生模型预测', color: '#fbbf24' },
] as const;

function physicalValue(point: VesselTracePoint, channel: Channel): number | null {
  if (channel === 'heading') return point.truth.headingDeg;
  if (channel === 'yawRate') return point.truth.yawRateDegS;
  if (channel === 'rudder') return point.truth.surfaceDeg[0] ?? null;
  if (channel === 'waterSpeed') return point.truth.waterSpeedMps;
  if (channel === 'groundSpeed') return point.truth.groundBodySpeedMps;
  if (channel === 'groundLateralSpeed') return point.truth.bodyVelocitySi?.[1] ?? null;
  if (channel === 'waterLateralSpeed') return point.truth.waterLateralSpeedMps ?? null;
  if (channel === 'north') return point.truth.northM;
  if (channel === 'east') return point.truth.eastM;
  if (channel === 'roll') return point.truth.rollDeg;
  return point.truth.rollRateDegS ?? null;
}

function estimatedValue(point: VesselTracePoint, channel: Channel): number | null {
  if (channel === 'heading') return point.estimate?.headingDeg ?? null;
  if (channel === 'yawRate') return point.estimate?.yawRateDegS ?? null;
  if (channel === 'groundSpeed') return point.estimate?.groundBodySpeedMps ?? null;
  if (channel === 'groundLateralSpeed') return point.estimate?.groundBodyLateralSpeedMps ?? null;
  if (channel === 'north') return point.estimate?.northM ?? null;
  if (channel === 'east') return point.estimate?.eastM ?? null;
  return null;
}

export interface PickedCurveSample {
  timeS: number;
  value: number;
  channelLabel: string;
  unit: string;
}

export function VesselSignalCurve({
  trace,
  comparison,
  postRun = false,
  predictionTargetValue = null,
  predictionTargetLabel = '预估目标值',
  studentModelLabel,
  stepSeq = 1,
  stepTitle = '船舶控制实验',
  shipKey = 'vessel',
  allowPicking = false,
  onPickSample,
  onAskAnomaly,
}: {
  trace: VesselTracePoint[];
  comparison?: VesselModelComparison;
  postRun?: boolean;
  predictionTargetValue?: number | null;
  predictionTargetLabel?: string;
  studentModelLabel?: string | null;
  stepSeq?: number;
  stepTitle?: string;
  shipKey?: string;
  allowPicking?: boolean;
  onPickSample?: (pick: PickedCurveSample) => void;
  onAskAnomaly?: (anomaly: CurveAnomalySnapshot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ai = useOptionalGlobalAI();
  const [channel, setChannel] = useState<Channel>('heading');
  const [visible, setVisible] = useState({ truth: true, measurement: true, estimate: true, model: true });
  const [showResidualBand, setShowResidualBand] = useState(true);
  const chartTheme = useSimulationChartTheme();
  const bucket = Math.floor(trace.at(-1)?.timeS ?? 0);
  const selected = channels.find((item) => item.value === channel)!;
  const modelAvailable = selected.measurement === (comparison?.outputChannel ?? 'YawRate') && Boolean(comparison?.predicted.length);
  const available = {
    truth: postRun,
    measurement: Boolean(selected.measurement),
    estimate:
      ['heading', 'yawRate', 'groundSpeed', 'groundLateralSpeed', 'north', 'east'].includes(channel) &&
      (channel !== 'groundLateralSpeed' || trace.some((point) => point.estimate?.groundBodyLateralSpeedMps !== undefined)),
    model: modelAvailable,
  };

  const quickPickSamples = useMemo(() => {
    const pickable = trace
      .map((point) => {
        const measurement = selected.measurement ? point.measurements[selected.measurement] : undefined;
        const val =
          measurement?.quality === 'Good'
            ? measurement.value
            : postRun
              ? physicalValue(point, channel)
              : null;
        return typeof val === 'number' && Number.isFinite(val) ? { timeS: point.timeS, value: val } : null;
      })
      .filter((item): item is { timeS: number; value: number } => item !== null);
    if (pickable.length === 0) return { peak: null, latest: null };
    let peak = pickable[0];
    for (const item of pickable) {
      if (Math.abs(item.value) > Math.abs(peak.value)) peak = item;
    }
    return { peak, latest: pickable[pickable.length - 1] };
  }, [trace, selected, postRun, channel]);

  const diagnostics = useMemo(() => {
    if (!modelAvailable || !comparison || comparison.timeS.length === 0 || comparison.actual.length === 0) return null;
    return computeResidualDiagnostics({
      timeS: comparison.timeS,
      actual: comparison.actual,
      predicted: comparison.predicted,
      outputUnit: comparison.outputUnit ?? selected.unit,
      outputChannel: comparison.outputChannel ?? channel,
    });
  }, [modelAvailable, comparison, selected.unit, channel]);

  const traceAnomalies = useMemo(() => {
    const adapted: VesselSample[] = trace
      .filter((_, index) => index % Math.max(1, Math.ceil(trace.length / 400)) === 0)
      .map((point) => {
        const sample = selected.measurement ? point.measurements[selected.measurement] : undefined;
        const measured = (sample?.quality === 'Good' ? sample.value : physicalValue(point, channel)) ?? 0;
        return {
          time: point.timeS,
          values: {
            active: measured,
            rudderDeg: point.truth.surfaceDeg[0] ?? 0,
            finDeg: point.truth.surfaceDeg[1] ?? 0,
          },
        };
      });
    return detectVesselCurveAnomalies({
      shipKey,
      stepSeq,
      stepTitle,
      samples: adapted,
      targetValue: predictionTargetValue,
      primarySignalKey: 'active',
      primaryLabel: selected.label,
      unit: selected.unit,
    });
  }, [trace, selected, channel, shipKey, stepSeq, stepTitle, predictionTargetValue]);

  const primaryAnomaly = traceAnomalies[0] ?? null;

  const triggerAnomalyInquiry = () => {
    if (!primaryAnomaly) return;
    if (onAskAnomaly) {
      onAskAnomaly(primaryAnomaly);
      return;
    }
    ai?.triggerSimulationAnomalyInquiry?.({
      title: `${selected.label} · ${primaryAnomaly.badgeLabel}`,
      shipKey,
      stepSeq,
      timeS: primaryAnomaly.timeS,
      snapshotSummary: primaryAnomaly.snapshotSummary,
      question: primaryAnomaly.socraticQuestion,
    });
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const indices = downsampleSeriesIndices(trace.length, 800);
    const modelIndices = downsampleSeriesIndices(comparison?.timeS.length ?? 0, 800);
    const points = indices.map((index) => trace[index]);
    const bandColor = chartTheme.mode === 'light' ? 'rgba(217, 119, 6, 0.2)' : 'rgba(251, 191, 36, 0.16)';

    const activeSources = sources.filter((source) => visible[source.key] && (source.key !== 'truth' || postRun));
    const datasets: Array<Record<string, unknown>> = [];

    if (showResidualBand && modelAvailable && comparison && visible.model && comparison.actual.length === comparison.timeS.length) {
      datasets.push({
        label: '_residual_anchor',
        borderColor: 'transparent',
        borderWidth: 0,
        pointRadius: 0,
        spanGaps: true,
        data: modelIndices.map((index) => ({ x: comparison.timeS[index], y: comparison.actual[index] ?? null })),
      });
    }
    const bandAnchorIndex = datasets.length === 1 ? 0 : -1;

    for (const source of activeSources) {
      datasets.push({
        label: source.label,
        borderColor: source.color,
        borderWidth: 1.4,
        pointRadius: 0,
        spanGaps: false,
        fill:
          source.key === 'model' && bandAnchorIndex >= 0
            ? { target: bandAnchorIndex, above: bandColor, below: bandColor }
            : false,
        data:
          source.key === 'model'
            ? modelAvailable && comparison
              ? modelIndices.map((index) => ({ x: comparison.timeS[index], y: comparison.predicted[index] }))
              : []
            : points.map((point) => {
                const sample = selected.measurement ? point.measurements[selected.measurement] : undefined;
                const value =
                  source.key === 'truth'
                    ? physicalValue(point, channel)
                    : source.key === 'estimate'
                      ? estimatedValue(point, channel)
                      : sample?.quality === 'Good'
                        ? sample.value
                        : null;
                return value === null ? null : { x: point.timeS, y: value };
              }),
      });
    }

    if (
      typeof predictionTargetValue === 'number' &&
      Number.isFinite(predictionTargetValue) &&
      points.length >= 2
    ) {
      datasets.push({
        label: predictionTargetLabel,
        borderColor: '#facc15',
        borderWidth: 1.4,
        borderDash: [6, 4],
        pointRadius: 0,
        data: [
          { x: points[0].timeS, y: predictionTargetValue },
          { x: points[points.length - 1].timeS, y: predictionTargetValue },
        ],
      });
    }

    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: { datasets: datasets as never },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        onClick: (_event, elements, chartInstance) => {
          if (!allowPicking || !onPickSample || elements.length === 0) return;
          const active = elements[0];
          const ds = chartInstance.data.datasets[active.datasetIndex];
          const pt = ds?.data?.[active.index] as { x?: number; y?: number } | null | undefined;
          if (pt && typeof pt.x === 'number' && typeof pt.y === 'number') {
            onPickSample({
              timeS: pt.x,
              value: pt.y,
              channelLabel: selected.label,
              unit: selected.unit,
            });
          }
        },
        plugins: { legend: { display: false } },
        scales: {
          x: {
            type: 'linear',
            title: { display: true, text: '时间 / s', color: chartTheme.tick },
            ticks: { maxTicksLimit: 5, color: chartTheme.tick },
            grid: { color: chartTheme.grid },
          },
          y: {
            title: { display: true, text: selected.unit, color: chartTheme.tick },
            ticks: { maxTicksLimit: 5, color: chartTheme.tick },
            grid: { color: chartTheme.grid },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [
    bucket,
    channel,
    selected,
    visible,
    chartTheme,
    comparison,
    trace,
    postRun,
    modelAvailable,
    showResidualBand,
    predictionTargetValue,
    predictionTargetLabel,
    allowPicking,
    onPickSample,
  ]);

  return (
    <div className="space-y-2" data-vessel-signal-curve>
      <ThreeLayerTopology
        compact
        truthActive={postRun || trace.length > 0}
        observerActive
        studentModelLabel={studentModelLabel}
        studentModelActive={modelAvailable}
        diagnostics={diagnostics}
        onInspectMismatch={primaryAnomaly ? triggerAnomalyInquiry : undefined}
      />

      <div className="flex flex-wrap items-center gap-2">
        <select
          className="sim-hud-input flex-1 text-xs"
          aria-label="曲线观测通道"
          value={channel}
          onChange={(event) => setChannel(event.target.value as Channel)}
        >
          {channels.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label} / {item.unit}
            </option>
          ))}
        </select>
        {primaryAnomaly ? (
          <button
            type="button"
            data-anomaly-trigger
            onClick={triggerAnomalyInquiry}
            className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/12 px-2 py-1 text-[11px] font-medium text-cyan-800 transition hover:bg-cyan-500/20 dark:text-cyan-200"
          >
            <Sparkles className="size-3" aria-hidden="true" />
            <span>⚡ 异常拐点：问控灵成因</span>
          </button>
        ) : null}
      </div>

      {channel === 'waterLateralSpeed' && !trace.some((point) => point.truth.waterLateralSpeedMps !== undefined) ? (
        <p role="status" className="text-xs text-platform-fg-secondary">
          此记录的横向对水速度暂无已保存数据。
        </p>
      ) : null}

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {sources.map((source) => (
          <label key={source.key} className="flex items-center gap-1" style={{ color: source.color }}>
            <input
              type="checkbox"
              checked={visible[source.key] && available[source.key]}
              disabled={!available[source.key]}
              onChange={(event) => setVisible((previous) => ({ ...previous, [source.key]: event.target.checked }))}
            />
            {source.label}
            {!available[source.key] ? (source.key === 'truth' ? '（运行结束后复盘）' : '（此通道暂无数据）') : ''}
          </label>
        ))}
        {modelAvailable ? (
          <label className="flex items-center gap-1 text-amber-600 dark:text-amber-300">
            <input
              type="checkbox"
              checked={showResidualBand}
              onChange={(event) => setShowResidualBand(event.target.checked)}
            />
            <span>|Truth - Model| 残差带</span>
          </label>
        ) : null}
      </div>

      {allowPicking && onPickSample && (quickPickSamples.peak || quickPickSamples.latest) ? (
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-platform-fg-secondary">
          <span className="inline-flex items-center gap-1">
            <Crosshair className="size-3 text-cyan-500" aria-hidden="true" />
            <span>点击曲线或快速拾取实测特征点：</span>
          </span>
          {quickPickSamples.peak ? (
            <button
              type="button"
              data-pick-sample="peak"
              onClick={() =>
                onPickSample({
                  timeS: quickPickSamples.peak!.timeS,
                  value: quickPickSamples.peak!.value,
                  channelLabel: selected.label,
                  unit: selected.unit,
                })
              }
              className="rounded border border-cyan-500/35 bg-cyan-500/10 px-1.5 py-0.5 text-[11px] hover:bg-cyan-500/20"
            >
              峰值 {quickPickSamples.peak.value.toFixed(2)} {selected.unit} @ t={quickPickSamples.peak.timeS.toFixed(1)}s
            </button>
          ) : null}
          {quickPickSamples.latest ? (
            <button
              type="button"
              data-pick-sample="latest"
              onClick={() =>
                onPickSample({
                  timeS: quickPickSamples.latest!.timeS,
                  value: quickPickSamples.latest!.value,
                  channelLabel: selected.label,
                  unit: selected.unit,
                })
              }
              className="rounded border border-cyan-500/35 bg-cyan-500/10 px-1.5 py-0.5 text-[11px] hover:bg-cyan-500/20"
            >
              终值 {quickPickSamples.latest.value.toFixed(2)} {selected.unit} @ t={quickPickSamples.latest.timeS.toFixed(1)}s
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="h-44">
        <canvas ref={canvasRef} role="img" aria-label={`${selected.label}的真值、量测、估计与学生模型曲线`} />
      </div>
    </div>
  );
}
