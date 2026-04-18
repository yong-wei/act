'use client';

import { useCallback, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

import type {
  ComplexPoint,
  ControlAnalysisResult,
  ControlMetrics,
  CurvePoint,
  RootLocusData,
} from '../analysis/types';
import {
  axisTooltipFormatter,
  buildBodePanelOption,
  buildMarginSeries,
  formatAxisValue,
  getControlAxisPreset,
  getRootLocusAxisKey,
  type AxisPreset,
  type RootLocusMode,
} from './control-bode-options';
import { ControlChartPanel } from './control-chart-panel';

type ChartSeriesValue = NonNullable<EChartsCoreOption['series']>;
type ChartSeriesItem = ChartSeriesValue extends (infer Item)[] ? Item : ChartSeriesValue;
type ChartSeriesArray = ChartSeriesItem[];

const ROOT_LOCUS_POLE_SYMBOL = 'path://M -0.6 -0.6 L 0.6 0.6 M -0.6 0.6 L 0.6 -0.6';

export type RootLocusInteractiveHandle = {
  id: string;
  kind: 'pole' | 'zero';
  point: ComplexPoint;
  draggable?: boolean;
  ariaLabel: string;
  cursor?: string;
};

function toSeriesArray(series?: EChartsCoreOption['series']): ChartSeriesArray {
  if (!series) {
    return [];
  }
  return Array.isArray(series) ? [...series] as ChartSeriesArray : [series as ChartSeriesItem];
}

function formatFixed(value: number | null | undefined, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }
  return `${value.toFixed(2)}${suffix}`;
}

function formatComplex(point: ComplexPoint): string {
  const imagAbs = Math.abs(point.im);
  const imag = `${point.im >= 0 ? '+' : '-'}j${imagAbs.toFixed(2)}`;
  return `${point.re.toFixed(2)}${imag}`;
}

function pointTooltipFormatter(params: { seriesName?: string; value?: number[] | string | number }): string {
  const value = params.value;
  const x = Array.isArray(value) ? Number(value[0]) : Number(value);
  const y = Array.isArray(value) ? Number(value[1]) : Number(value);
  return `${params.seriesName ?? '数据点'}<br/>Re(s): ${formatFixed(x)}<br/>Im(s): ${formatFixed(y)}`;
}

function buildMetricText(metrics: ControlMetrics): ReactNode {
  return [
    `Mp ${formatFixed(metrics.overshootPct, '%')}`,
    `tr ${formatFixed(metrics.riseTimeSec, ' s')}`,
    `ts ${formatFixed(metrics.settlingTimeSec, ' s')}`,
    `tp ${formatFixed(metrics.peakTimeSec, ' s')}`,
  ].join(' | ');
}

function buildMarginText(metrics: ControlMetrics): ReactNode {
  return [
    `PM ${formatFixed(metrics.phaseMarginDeg, '°')}`,
    `GM ${formatFixed(metrics.gainMarginDb, ' dB')}`,
    `ωc ${formatFixed(metrics.gainCrossoverRadPerSec, ' rad/s')}`,
    `ωg ${formatFixed(metrics.phaseCrossoverRadPerSec, ' rad/s')}`,
  ].join(' | ');
}

function buildPoleText(points: ComplexPoint[]): ReactNode {
  return points.map((point, index) => `p${index + 1}=${formatComplex(point)}`).join(' | ');
}


function buildLineOption(
  points: CurvePoint[],
  color: string,
  xAxisName: string,
  yAxisName: string,
  opts?: {
    xAxisType?: 'value' | 'log';
    axisPreset?: AxisPreset;
    extraSeries?: ChartSeriesArray;
  },
): EChartsCoreOption {
  const axisPreset = opts?.axisPreset;
  return {
    animation: false,
    grid: { top: 18, right: 18, bottom: 42, left: 58 },
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltipFormatter,
    },
    xAxis: {
      type: opts?.xAxisType ?? 'value',
      min: axisPreset?.x[0],
      max: axisPreset?.x[1],
      name: xAxisName,
      nameLocation: 'middle',
      nameGap: 30,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      axisLabel: {
        formatter: formatAxisValue,
      },
    },
    yAxis: {
      type: 'value',
      min: axisPreset?.y[0],
      max: axisPreset?.y[1],
      name: yAxisName,
      nameLocation: 'middle',
      nameGap: 42,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      axisLabel: {
        formatter: formatAxisValue,
      },
    },
    series: [
      {
        name: yAxisName,
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { color, width: 2.4 },
        data: points.map((point) => [point.x, point.y]),
      },
      ...toSeriesArray(opts?.extraSeries),
    ],
  };
}

function buildFeasibleRegionSeries(
  rootLocus: RootLocusData,
  axisPreset: AxisPreset | undefined,
): ChartSeriesArray {
  if (!rootLocus.feasibleRegion || !axisPreset) {
    return [];
  }

  const xMin = axisPreset.x[0];
  const yMin = axisPreset.y[0];
  const yMax = axisPreset.y[1];
  const sigmaBoundary = -rootLocus.feasibleRegion.sigmaMin;
  const zeta = rootLocus.feasibleRegion.zetaMin;
  const tangent = Math.sqrt(Math.max(1e-12, 1 - zeta * zeta)) / zeta;
  const yAtLeftBoundary = Math.min(yMax, (-xMin) * tangent);
  const yAtSigmaBoundary = Math.min(yMax, Math.abs(sigmaBoundary) * tangent);
  const areaStyle = { color: 'rgba(59, 130, 246, 0.12)' };
  const polygon = [
    [xMin, -yAtLeftBoundary],
    [xMin, yAtLeftBoundary],
    [sigmaBoundary, yAtSigmaBoundary],
    [sigmaBoundary, -yAtSigmaBoundary],
  ];
  const xLimit = Math.max(xMin, -yMax / tangent);
  const yLimit = Math.min(yMax, Math.abs(xLimit) * tangent);

  return [
    {
      name: '可行域参考',
      type: 'custom',
      silent: true,
      data: [0],
      renderItem: (_params: unknown, api: { coord: (value: [number, number]) => number[] }) => {
        const points = polygon.map(([x, y]) => api.coord([x, y]));
        return {
          type: 'polygon',
          shape: { points },
          style: {
            fill: areaStyle.color,
            stroke: 'rgba(37, 99, 235, 0.55)',
            lineWidth: 1,
          },
        };
      },
    },
    {
      name: 'σ 边界',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#2563eb', type: 'dotted', width: 1.5 },
      data: [[sigmaBoundary, yMin], [sigmaBoundary, yMax]],
    },
    {
      name: 'ζ 边界',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#2563eb', type: 'dashdot', width: 1.5 },
      data: [[0, 0], [xLimit, yLimit]],
    },
    {
      name: '',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#2563eb', type: 'dashdot', width: 1.5 },
      data: [[0, 0], [xLimit, -yLimit]],
    },
  ];
}

function buildRootLocusOption(
  rootLocus: RootLocusData,
  caseId?: string,
  mode: RootLocusMode = 'default',
  axisPresetOverride?: AxisPreset,
): EChartsCoreOption {
  const axisPreset = axisPresetOverride ?? getControlAxisPreset(caseId, getRootLocusAxisKey(mode));
  const showFeasible = mode !== 'full';
  const locusBranches = mode === 'full' && rootLocus.fullBranches ? rootLocus.fullBranches : rootLocus.branches;
  const series: ChartSeriesArray = [
    ...(showFeasible ? buildFeasibleRegionSeries(rootLocus, axisPreset) : []),
    ...locusBranches.map((branch, index) => ({
      name: index === 0 ? '根轨迹' : '',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#4c78a8', width: 1.7 },
      data: branch.map((point) => [point.re, point.im]),
    })),
    {
      name: '当前闭环极点',
      type: 'scatter',
      symbol: 'circle',
      symbolSize: 9,
      itemStyle: { color: '#1f4e79', borderColor: '#ffffff', borderWidth: 1.2 },
      data: rootLocus.currentPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      name: '开环极点',
      type: 'scatter',
      symbol: ROOT_LOCUS_POLE_SYMBOL,
      symbolSize: 18,
      lineStyle: { color: '#c81d25', width: 2.2 },
      itemStyle: { color: '#c81d25' },
      data: rootLocus.openLoopPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      name: '开环零点',
      type: 'scatter',
      symbol: 'circle',
      symbolSize: 12,
      itemStyle: { color: '#ffffff', borderColor: '#d97706', borderWidth: 2.2 },
      data: rootLocus.openLoopZeros.map((zero) => [zero.re, zero.im]),
    },
  ];

  return {
    animation: false,
    legend: {
      top: 0,
      right: 8,
      textStyle: { fontSize: 10 },
      itemWidth: 10,
      itemHeight: 10,
    },
    grid: { top: 34, right: 18, bottom: 42, left: 58 },
    tooltip: {
      trigger: 'item',
      formatter: pointTooltipFormatter,
    },
    xAxis: {
      type: 'value',
      min: axisPreset?.x[0],
      max: axisPreset?.x[1],
      name: 'Re(s)',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: {
        formatter: formatAxisValue,
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      min: axisPreset?.y[0],
      max: axisPreset?.y[1],
      name: 'Im(s)',
      nameLocation: 'middle',
      nameGap: 36,
      axisLabel: {
        formatter: formatAxisValue,
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series,
  };
}

function buildNyquistOption(result: ControlAnalysisResult, caseId?: string): EChartsCoreOption {
  const axisPreset = getControlAxisPreset(caseId, 'nyquist');
  return {
    animation: false,
    grid: { top: 18, right: 18, bottom: 42, left: 58 },
    tooltip: {
      trigger: 'item',
      formatter: pointTooltipFormatter,
    },
    xAxis: {
      type: 'value',
      min: axisPreset?.x[0],
      max: axisPreset?.x[1],
      name: 'Re',
      nameLocation: 'middle',
      nameGap: 28,
      axisLabel: {
        formatter: formatAxisValue,
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      min: axisPreset?.y[0],
      max: axisPreset?.y[1],
      name: 'Im',
      nameLocation: 'middle',
      nameGap: 36,
      axisLabel: {
        formatter: formatAxisValue,
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: [
      {
        name: 'Nyquist 轨迹',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#22d3ee', width: 2.5 },
        data: result.nyquist.points.map((point) => [point.re, point.im]),
      },
      {
        name: '-1+j0',
        type: 'scatter',
        symbolSize: 10,
        itemStyle: { color: '#ef4444' },
        data: [[-1, 0]],
      },
    ],
  };
}

function fallbackNode(result: ControlAnalysisResult): ReactNode {
  return result.isFallback ? result.fallbackMessage ?? '当前显示离线基线结果。' : null;
}

function getInteractiveHandlePixelPosition(point: ComplexPoint, chart: ECharts | null) {
  if (!chart) {
    return null;
  }
  const pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [point.re, point.im]);
  if (!Array.isArray(pixel) || pixel.length < 2) {
    return null;
  }
  const [left, top] = pixel;
  if (!Number.isFinite(left) || !Number.isFinite(top)) {
    return null;
  }
  return { left, top };
}

function renderInteractiveHandle(
  handle: RootLocusInteractiveHandle,
  pixelPosition: { left: number; top: number } | null,
  onHandlePointerDown?: (id: string, event: ReactPointerEvent<HTMLButtonElement>) => void,
) {
  if (!pixelPosition) {
    return null;
  }
  const content =
    handle.kind === 'pole' ? (
      <div className="pointer-events-none relative h-5 w-5">
        <span className="absolute left-1/2 top-1/2 h-[2.2px] w-5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-full bg-[#c81d25]" />
        <span className="absolute left-1/2 top-1/2 h-[2.2px] w-5 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded-full bg-[#c81d25]" />
      </div>
    ) : (
      <div className="pointer-events-none relative h-4 w-4 rounded-full border-[2.2px] border-[#d97706] bg-transparent" />
    );

  return (
    <div
      key={handle.id}
      className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${pixelPosition.left}px`,
        top: `${pixelPosition.top}px`,
      }}
    >
      {handle.draggable ? (
        <button
          type="button"
          onPointerDown={(event) => onHandlePointerDown?.(handle.id, event)}
          className="pointer-events-auto relative block bg-transparent p-0"
          style={{ cursor: handle.cursor ?? 'grab' }}
          aria-label={handle.ariaLabel}
        >
          {content}
          <span className="sr-only">{handle.ariaLabel}</span>
        </button>
      ) : (
        <div className="pointer-events-none" aria-label={handle.ariaLabel}>
          {content}
        </div>
      )}
    </div>
  );
}

export function StepResponsePanel({ result, caseId }: { result: ControlAnalysisResult; caseId?: string }) {
  const option = buildLineOption(result.stepResponse.points, '#22d3ee', '时间 / s', '响应', {
    axisPreset: getControlAxisPreset(caseId, 'step'),
  });
  return (
    <ControlChartPanel
      title="时域响应"
      meta={buildMetricText(result.metrics)}
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function MagnitudePanel({ result, caseId }: { result: ControlAnalysisResult; caseId?: string }) {
  const option = buildLineOption(result.magnitude.points, '#a78bfa', 'ω / rad/s', '幅值 / dB', {
    xAxisType: 'log',
    axisPreset: getControlAxisPreset(caseId, 'magnitude'),
    extraSeries: buildMarginSeries(result.metrics, 'magnitude'),
  });
  return (
    <ControlChartPanel
      title="幅频特性"
      meta={buildMarginText(result.metrics)}
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function PhasePanel({ result, caseId }: { result: ControlAnalysisResult; caseId?: string }) {
  const option = buildLineOption(result.phase.points, '#fb7185', 'ω / rad/s', '相位 / deg', {
    xAxisType: 'log',
    axisPreset: getControlAxisPreset(caseId, 'phase'),
    extraSeries: buildMarginSeries(result.metrics, 'phase'),
  });
  return (
    <ControlChartPanel
      title="相频特性"
      meta={buildMarginText(result.metrics)}
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function NyquistPanel({ result, caseId }: { result: ControlAnalysisResult; caseId?: string }) {
  return (
    <ControlChartPanel
      title="Nyquist 图"
      meta={buildMarginText(result.metrics)}
      option={buildNyquistOption(result, caseId)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function RootLocusPanel({
  result,
  caseId,
  mode = 'default',
  overlay,
  interactiveHandles,
  onHandlePointerDown,
  interactiveLayerRef,
  onChartReady,
  className,
  chartClassName,
  axisPresetOverride,
}: {
  result: ControlAnalysisResult;
  caseId?: string;
  mode?: RootLocusMode;
  overlay?: ReactNode;
  interactiveHandles?: RootLocusInteractiveHandle[];
  onHandlePointerDown?: (id: string, event: ReactPointerEvent<HTMLButtonElement>) => void;
  interactiveLayerRef?: Ref<HTMLDivElement>;
  onChartReady?: (chart: ECharts, container: HTMLDivElement) => void;
  className?: string;
  chartClassName?: string;
  axisPresetOverride?: AxisPreset;
}) {
  const title = mode === 'full' ? '根轨迹全览' : mode === 'zoom' ? '根轨迹区域放大' : '根轨迹';
  const axisPreset = axisPresetOverride ?? getControlAxisPreset(caseId, getRootLocusAxisKey(mode));
  const chartRef = useRef<ECharts | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);
  const handleChartReady = useCallback((chart: ECharts, container: HTMLDivElement) => {
    chartRef.current = chart;
    setOverlayVersion((version) => version + 1);
    onChartReady?.(chart, container);
  }, [onChartReady]);

  const interactiveOverlay = interactiveHandles && interactiveHandles.length > 0 ? (
    <div
      ref={interactiveLayerRef}
      className="absolute inset-0"
      data-overlay-version={overlayVersion}
    >
      {interactiveHandles.map((handle) =>
        renderInteractiveHandle(
          handle,
          getInteractiveHandlePixelPosition(handle.point, chartRef.current),
          onHandlePointerDown,
        ),
      )}
    </div>
  ) : null;

  return (
    <ControlChartPanel
      title={title}
      meta={buildPoleText(result.rootLocus.currentPoles)}
      option={buildRootLocusOption(result.rootLocus, caseId, mode, axisPreset)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
      onChartReady={handleChartReady}
      overlay={
        <>
          {interactiveOverlay}
          {overlay}
        </>
      }
      className={className}
      chartClassName={chartClassName}
    />
  );
}

export function BodePanel({ result, caseId }: { result: ControlAnalysisResult; caseId?: string }) {
  return (
    <ControlChartPanel
      title="组合 Bode 图"
      meta={buildMarginText(result.metrics)}
      option={buildBodePanelOption(result, caseId)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}
