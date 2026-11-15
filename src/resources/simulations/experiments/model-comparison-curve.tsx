'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { Sparkles } from 'lucide-react';
import { useOptionalGlobalAI } from '@/components/providers/global-ai-provider';
import { useSimulationChartTheme } from '../components/simulation-ui';
import {
  evaluateLinearReferenceSeries,
  type FrozenVesselStudentModel,
  type VesselModelComparison,
} from './student-analysis';
import { VESSEL_FACTOR_LABELS } from './comparison-factors';
import { computeResidualDiagnostics, downsampleSeriesIndices } from './mismatch-diagnostics';
import { ThreeLayerTopology } from './three-layer-topology';
import { detectComparisonAnomalies, type CurveAnomalySnapshot } from './curve-anomaly-detector';

Chart.register(...registerables);

export function ModelComparisonCurve({
  comparison,
  studentModel,
  linearBaseline,
  onAskAnomaly,
}: {
  comparison: VesselModelComparison;
  studentModel?: FrozenVesselStudentModel | null;
  linearBaseline?: Array<number | null> | null;
  onAskAnomaly?: (anomaly: CurveAnomalySnapshot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ai = useOptionalGlobalAI();
  const [channel, setChannel] = useState<'output' | 'heading' | 'distance'>('output');
  const [showResidualBand, setShowResidualBand] = useState(true);
  const [showLinearBaseline, setShowLinearBaseline] = useState(true);
  const chartTheme = useSimulationChartTheme();

  const heading = channel === 'heading' && Boolean(comparison.predictedHeadingDeg);
  const distance = channel === 'distance' && Boolean(comparison.predictedBowClearanceM);
  const activeUnit = heading ? '°' : distance ? 'm' : comparison.outputUnit ?? '输出量';
  const activeChannelLabel = heading
    ? '航向'
    : distance
      ? '船艏剩余距离'
      : comparison.outputChannel === 'SpeedLog'
        ? '对水航速'
        : comparison.outputChannel === 'EstimatedRoll'
          ? '横摇姿态'
          : '模型对照输出';

  const actualSeries = useMemo<Array<number | null>>(
    () =>
      heading
        ? comparison.actualHeadingDeg ?? []
        : distance
          ? comparison.actualBowClearanceM ?? []
          : comparison.actual,
    [comparison, heading, distance],
  );
  const predictedSeries = useMemo<Array<number | null>>(
    () =>
      heading
        ? comparison.predictedHeadingDeg ?? []
        : distance
          ? comparison.predictedBowClearanceM ?? []
          : comparison.predicted,
    [comparison, heading, distance],
  );

  const resolvedLinearBaseline = useMemo<Array<number | null> | null>(() => {
    if (linearBaseline && linearBaseline.length === comparison.timeS.length) return linearBaseline;
    if (
      channel === 'output' &&
      comparison.mode !== 'hull_model' &&
      studentModel &&
      comparison.measuredInput.length === comparison.timeS.length
    ) {
      const origin = typeof actualSeries[0] === 'number' ? actualSeries[0] : 0;
      return evaluateLinearReferenceSeries(studentModel, comparison.timeS, comparison.measuredInput, origin);
    }
    return null;
  }, [linearBaseline, channel, comparison, studentModel, actualSeries]);

  const diagnostics = useMemo(
    () =>
      computeResidualDiagnostics({
        timeS: comparison.timeS,
        actual: actualSeries,
        predicted: predictedSeries,
        outputUnit: activeUnit,
        outputChannel: heading ? 'heading' : distance ? 'clearance' : comparison.outputChannel,
      }),
    [comparison.timeS, comparison.outputChannel, actualSeries, predictedSeries, activeUnit, heading, distance],
  );

  const anomalies = useMemo(
    () =>
      detectComparisonAnomalies({
        comparison,
        actual: actualSeries,
        predicted: predictedSeries,
        diagnostics,
        unit: activeUnit,
        channelLabel: activeChannelLabel,
        linearBaseline: resolvedLinearBaseline,
      }),
    [comparison, actualSeries, predictedSeries, diagnostics, activeUnit, activeChannelLabel, resolvedLinearBaseline],
  );

  const primaryAnomaly = anomalies[0] ?? null;

  const triggerAnomalyInquiry = (targetAnomaly?: CurveAnomalySnapshot | null) => {
    const anomaly = targetAnomaly ?? primaryAnomaly;
    if (!anomaly) return;
    if (onAskAnomaly) {
      onAskAnomaly(anomaly);
      return;
    }
    ai?.triggerSimulationAnomalyInquiry?.({
      title: `${activeChannelLabel} · ${anomaly.badgeLabel}`,
      shipKey: studentModel?.payload.experimentKey ?? 'vessel',
      stepSeq: 0,
      timeS: anomaly.timeS,
      snapshotSummary: anomaly.snapshotSummary,
      question: anomaly.socraticQuestion,
    });
  };

  useEffect(() => {
    if (!canvasRef.current) return;
    const indices = downsampleSeriesIndices(comparison.timeS.length, 800);
    const bandColor = chartTheme.mode === 'light' ? 'rgba(217, 119, 6, 0.22)' : 'rgba(251, 191, 36, 0.18)';
    const datasets: Array<Record<string, unknown>> = [
      {
        label: '仪器量测',
        data: indices.map((index) => actualSeries[index] ?? null),
        borderColor: '#22d3ee',
        pointRadius: 0,
        borderWidth: 1.6,
        spanGaps: true,
      },
      {
        label: '学生模型预测',
        data: indices.map((index) => predictedSeries[index] ?? null),
        borderColor: '#fbbf24',
        pointRadius: 0,
        borderWidth: 1.6,
        spanGaps: true,
        fill: showResidualBand && actualSeries.length > 0 ? { target: 0, above: bandColor, below: bandColor } : false,
      },
    ];
    if (showLinearBaseline && resolvedLinearBaseline && resolvedLinearBaseline.length >= comparison.timeS.length) {
      datasets.push({
        label: '纯线性基线',
        data: indices.map((index) => resolvedLinearBaseline[index] ?? null),
        borderColor: chartTheme.mode === 'light' ? '#64748b' : '#94a3b8',
        borderDash: [5, 4],
        pointRadius: 0,
        borderWidth: 1.25,
        spanGaps: true,
      });
    }

    const chart = new Chart(canvasRef.current, {
      type: 'line',
      data: {
        labels: indices.map((index) => comparison.timeS[index].toFixed(1)),
        datasets: datasets as never,
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: chartTheme.tick, boxWidth: 10, font: { size: 10 } } } },
        scales: {
          x: {
            title: { display: true, text: '时间 / s', color: chartTheme.tick },
            ticks: { color: chartTheme.tick, maxTicksLimit: 5 },
            grid: { color: chartTheme.grid },
          },
          y: {
            title: { display: true, text: activeUnit, color: chartTheme.tick },
            ticks: { color: chartTheme.tick, maxTicksLimit: 5 },
            grid: { color: chartTheme.grid },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [
    comparison.timeS,
    chartTheme,
    actualSeries,
    predictedSeries,
    resolvedLinearBaseline,
    showResidualBand,
    showLinearBaseline,
    activeUnit,
  ]);

  const metric = (key: string, digits: number) => {
    const value = comparison.metrics[key];
    return typeof value === 'number' ? value.toFixed(digits) : '不适用';
  };

  return (
    <div className="space-y-2" data-vessel-comparison>
      <ThreeLayerTopology
        compact
        truthActive
        observerActive
        studentModelLabel={studentModel?.label}
        studentModelActive
        diagnostics={diagnostics}
        onInspectMismatch={primaryAnomaly ? () => triggerAnomalyInquiry(primaryAnomaly) : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex flex-wrap items-center gap-3 text-platform-fg-secondary">
          <label className="inline-flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={showResidualBand}
              onChange={(event) => setShowResidualBand(event.target.checked)}
            />
            <span>|Truth - Model| 残差阴影带</span>
          </label>
          {resolvedLinearBaseline ? (
            <label className="inline-flex items-center gap-1 cursor-pointer">
              <input
                type="checkbox"
                checked={showLinearBaseline}
                onChange={(event) => setShowLinearBaseline(event.target.checked)}
              />
              <span>纯线性基线对照</span>
            </label>
          ) : null}
        </div>
        {primaryAnomaly ? (
          <button
            type="button"
            data-anomaly-trigger
            onClick={() => triggerAnomalyInquiry(primaryAnomaly)}
            className="inline-flex items-center gap-1 rounded border border-cyan-500/40 bg-cyan-500/12 px-2 py-0.5 text-[11px] font-medium text-cyan-800 transition hover:bg-cyan-500/20 dark:text-cyan-200"
          >
            <Sparkles className="size-3" aria-hidden="true" />
            <span>⚡ 异常拐点：问控灵成因（{primaryAnomaly.badgeLabel}）</span>
          </button>
        ) : null}
      </div>

      {comparison.predictedHeadingDeg || comparison.predictedBowClearanceM ? (
        <select
          aria-label="独立闭环对照通道"
          className="sim-hud-input text-xs"
          value={channel}
          onChange={(event) => setChannel(event.target.value as typeof channel)}
        >
          <option value="output">{comparison.outputChannel === 'SpeedLog' ? '航速 / m/s' : '转艏速率 / °/s'}</option>
          {comparison.predictedHeadingDeg ? <option value="heading">航向 / °</option> : null}
          {comparison.predictedBowClearanceM ? <option value="distance">船艏剩余距离 / m</option> : null}
        </select>
      ) : null}
      <div className="h-44">
        <canvas ref={canvasRef} aria-label="仪器量测与学生模型独立预测对照" role="img" />
      </div>
      <p className="text-xs text-platform-fg-secondary">
        {comparison.purpose === 'forecast'
          ? '运行前预测已冻结，误差待独立验证后生成。'
          : `${comparison.predictedHeadingDeg ? '转艏速率验证 ' : ''}RMSE ${metric('rmse', 4)} ${comparison.outputUnit ?? ''} · FIT ${metric('fit_percent', 1)}${comparison.metrics.fit_percent == null ? '' : '%'} · 峰值误差 ${metric('peak_error', 4)} ${comparison.outputUnit ?? ''}`}
      </p>
      <p className="text-xs text-platform-fg-muted">
        窗口 {comparison.startS.toFixed(1)}–{comparison.endS.toFixed(1)} s · 量测与模型保持各自状态
      </p>
      {comparison.metrics.outside_local_speed_domain === 1 ? (
        <p role="status" className="text-xs text-platform-fg-secondary">
          局部航速模型的预测已超出0至4m/s适用范围，请结合外推误差说明边界。
        </p>
      ) : null}
      {comparison.factorFlags ? (
        <div className="space-y-1 text-xs text-platform-fg-muted">
          <p>物理后台包含 {comparison.factorFlags.physical.map((key) => VESSEL_FACTOR_LABELS[key] ?? '其他现实因素').join('、')}</p>
          <p>学生模型包含 {comparison.factorFlags.student.map((key) => VESSEL_FACTOR_LABELS[key] ?? '其他模型环节').join('、')}</p>
          <p>模型适用边界涉及 {comparison.factorFlags.unmodeled.map((key) => VESSEL_FACTOR_LABELS[key] ?? '其他现实因素').join('、')}</p>
        </div>
      ) : null}
    </div>
  );
}
