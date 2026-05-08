'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, Ref } from 'react';
import type { ECharts, EChartsCoreOption } from 'echarts/core';

import {
  InteractiveSvgPointMarker,
  getInteractiveSvgEChartsPointMarker,
  type InteractiveSvgPointMarkerKind,
} from '@/features/interactive/shared/interactive-svg-markers';
import type {
  ComplexPoint,
  ControlAnalysisResult,
  ControlMetrics,
  CurvePoint,
  RootLocusData,
  RootLocusSamplePoint,
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

// Shared axis presets must stay aligned with case ids like ship_heading/platform_pitch
// and the root-locus variants rootLocusFull/rootLocusZoom used by the workspace.

type ChartSeriesValue = NonNullable<EChartsCoreOption['series']>;
type ChartSeriesItem = ChartSeriesValue extends (infer Item)[] ? Item : ChartSeriesValue;
type ChartSeriesArray = ChartSeriesItem[];

export type RootLocusInteractiveHandle = {
  id: string;
  kind: 'pole' | 'zero';
  point: ComplexPoint;
  renderAs?: 'open-pole' | 'open-zero' | 'closed-pole';
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

function formatGainMargin(value: number | null | undefined): string {
  if (value === Number.POSITIVE_INFINITY) {
    return 'GM ∞';
  }
  return `GM ${formatFixed(value, ' dB')}`;
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
  const gain = Array.isArray(value) && value.length > 2 ? Number(value[2]) : Number.NaN;
  const gainLine = Number.isFinite(gain) ? `<br/>Gain K: ${formatFixed(gain)}` : '';
  return `${params.seriesName ?? '数据点'}<br/>Re(s): ${formatFixed(x)}<br/>Im(s): ${formatFixed(y)}${gainLine}`;
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
    formatGainMargin(metrics.gainMarginDb),
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
      lineStyle: { color: '#2563eb', width: 1.5 },
      data: [[sigmaBoundary, yMin], [sigmaBoundary, yMax]],
    },
    {
      name: 'ζ 边界',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#2563eb', width: 1.5 },
      data: [[0, 0], [xLimit, yLimit]],
    },
    {
      name: '',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#2563eb', width: 1.5 },
      data: [[0, 0], [xLimit, -yLimit]],
    },
  ];
}

function snapRootPoint<T extends ComplexPoint>(point: T): T {
  const scale = Math.max(1, Math.abs(point.re), Math.abs(point.im));
  return Math.abs(point.im) <= 1e-8 * scale ? { ...point, im: 0 } : point;
}

function hasConjugatePoint<T extends ComplexPoint>(points: T[], point: T) {
  const scale = Math.max(1, Math.abs(point.re), Math.abs(point.im));
  const tolerance = 1e-5 * scale;
  return points.some((candidate) =>
    Math.abs(candidate.re - point.re) <= tolerance && Math.abs(candidate.im + point.im) <= tolerance
  );
}

function normalizeConjugatePointSet<T extends ComplexPoint>(points: T[]): T[] {
  const normalized = points.map(snapRootPoint);
  const additions: T[] = [];
  for (const point of normalized) {
    if (point.im === 0 || hasConjugatePoint(normalized, point) || hasConjugatePoint(additions, point)) {
      continue;
    }
    additions.push({ ...point, im: -point.im });
  }
  return [...normalized, ...additions];
}

function buildClosedNyquistClosure(
  positivePoints: ComplexPoint[],
  negativePoints: ComplexPoint[],
  explicitClosurePoints: ComplexPoint[],
): ComplexPoint[] {
  if (positivePoints.length === 0 || negativePoints.length === 0) {
    return [];
  }
  const positiveStart = positivePoints[0];
  const positiveEnd = positivePoints[positivePoints.length - 1];
  const negativeStart = negativePoints[0];
  const negativeEnd = negativePoints[negativePoints.length - 1];
  if (!positiveStart || !positiveEnd || !negativeStart || !negativeEnd) {
    return [];
  }

  const isSamePoint = (lhs: ComplexPoint, rhs: ComplexPoint) =>
    Math.abs(lhs.re - rhs.re) < 1e-9 && Math.abs(lhs.im - rhs.im) < 1e-9;

  if (!isSamePoint(positiveStart, negativeEnd)) {
    return [positiveStart, negativeEnd];
  }

  if (explicitClosurePoints.length > 1) {
    const first = explicitClosurePoints[0];
    const last = explicitClosurePoints[explicitClosurePoints.length - 1];
    if (first && last && !isSamePoint(first, last)) {
      return explicitClosurePoints;
    }
  }

  return isSamePoint(positiveEnd, negativeStart) ? [] : [positiveEnd, negativeStart];
}

function findClosestRootLocusPoint(
  branches: RootLocusSamplePoint[][],
  target: ComplexPoint,
): RootLocusSamplePoint | null {
  let closest: RootLocusSamplePoint | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const branch of branches) {
    for (const point of branch) {
      const distance = Math.hypot(point.re - target.re, point.im - target.im);
      if (distance < closestDistance) {
        closest = point;
        closestDistance = distance;
      }
    }
  }
  return closest;
}

function findRootLocusSnapshot(branches: RootLocusSamplePoint[][], gain: number): ComplexPoint[] {
  return branches
    .map((branch) => {
      if (branch.length === 0) {
        return null;
      }
      return branch.reduce((best, point) => {
        const bestDistance = Math.abs((best.gain ?? 0) - gain);
        const pointDistance = Math.abs((point.gain ?? 0) - gain);
        return pointDistance < bestDistance ? point : best;
      }, branch[0]);
    })
    .filter((point): point is RootLocusSamplePoint => Boolean(point))
    .map((point) => ({ re: point.re, im: point.im }));
}

export function buildRootLocusOption(
  rootLocus: RootLocusData,
  caseId?: string,
  mode: RootLocusMode = 'default',
  axisPresetOverride?: AxisPreset,
): EChartsCoreOption {
  const axisPreset = axisPresetOverride ?? getControlAxisPreset(caseId, getRootLocusAxisKey(mode));
  const showFeasible = mode !== 'full';
  const locusBranches = (mode === 'full' && rootLocus.fullBranches ? rootLocus.fullBranches : rootLocus.branches)
    .map((branch) => branch.map(snapRootPoint));
  const currentPoles = normalizeConjugatePointSet(rootLocus.currentPoles);
  const openLoopPoles = normalizeConjugatePointSet(rootLocus.openLoopPoles);
  const openLoopZeros = normalizeConjugatePointSet(rootLocus.openLoopZeros);
  const xMin = axisPreset?.x[0] ?? -8;
  const xMax = axisPreset?.x[1] ?? 2;
  const yMin = axisPreset?.y[0] ?? -6;
  const yMax = axisPreset?.y[1] ?? 6;
  const xSpan = Math.max(1, xMax - xMin);
  const ySpan = Math.max(1, yMax - yMin);
  const asymptoteLength = Math.max(xSpan, ySpan) * 1.3;
  const series: ChartSeriesArray = [
    {
      name: '实轴',
      type: 'line',
      silent: true,
      showSymbol: false,
      lineStyle: { color: 'rgba(148, 163, 184, 0.42)', width: 1 },
      data: [[xMin, 0], [xMax, 0]],
    },
    {
      name: '虚轴',
      type: 'line',
      silent: true,
      showSymbol: false,
      lineStyle: { color: 'rgba(148, 163, 184, 0.42)', width: 1 },
      data: [[0, yMin], [0, yMax]],
    },
    ...(showFeasible ? buildFeasibleRegionSeries(rootLocus, axisPreset) : []),
    ...(rootLocus.realAxisSegments ?? []).map((segment) => ({
      name: '实轴根轨迹段',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#0f766e', width: 2.4 },
      data: [[segment.start ?? xMin, 0], [segment.end ?? xMax, 0]],
    } satisfies ChartSeriesItem)),
    ...locusBranches.map((branch, index) => ({
      name: index === 0 ? '根轨迹' : '',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#4c78a8', width: 1.7 },
      data: branch.map((point) => [point.re, point.im, point.gain ?? null]),
    })),
    ...(rootLocus.asymptotes ?? []).map((asymptote, index) => {
      const rad = (asymptote.angleDeg * Math.PI) / 180;
      const dx = Math.cos(rad) * asymptoteLength;
      const dy = Math.sin(rad) * asymptoteLength;
      return {
        name: index === 0 ? '根轨迹渐近线' : '',
        type: 'line',
        silent: true,
        showSymbol: false,
        lineStyle: { color: 'rgba(15, 118, 110, 0.5)', width: 1.4 },
        data: [
          [asymptote.centroid - dx, -dy],
          [asymptote.centroid + dx, dy],
        ],
      } satisfies ChartSeriesItem;
    }),
    ...((rootLocus.stationaryPoints?.length ?? 0) > 0
      ? [{
          name: '分离/会合点',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
            size: 9,
            color: '#14b8a6',
          }),
          data: rootLocus.stationaryPoints?.map((point) => [point.re, point.im, point.gain ?? null]) ?? [],
        } satisfies ChartSeriesItem]
      : []),
    ...((rootLocus.imaginaryAxisCrossings?.length ?? 0) > 0
      ? [{
          name: '虚轴交点',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('dot-filled', {
            size: 8,
            color: '#f97316',
            strokeColor: '#ffffff',
            strokeWidth: 1,
          }),
          data: rootLocus.imaginaryAxisCrossings?.map((point) => [point.re, point.im, point.gain ?? null]) ?? [],
        } satisfies ChartSeriesItem]
      : []),
    {
      name: '开环极点',
      type: 'scatter',
      ...getInteractiveSvgEChartsPointMarker('pole-cross', {
        size: 18,
        color: '#c81d25',
        strokeWidth: 2.2,
      }),
      data: openLoopPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      name: '开环零点',
      type: 'scatter',
      ...getInteractiveSvgEChartsPointMarker('dot-hollow', {
        size: 12,
        color: '#d97706',
        strokeWidth: 2.2,
      }),
      data: openLoopZeros.map((zero) => [zero.re, zero.im]),
    },
    {
      id: 'currentClosedLoopPoles',
      name: '当前闭环极点',
      type: 'scatter',
      ...getInteractiveSvgEChartsPointMarker('dot-filled', {
        size: 15,
        color: '#f97316',
        strokeColor: '#ffffff',
        strokeWidth: 2,
      }),
      z: 10,
      data: currentPoles.map((pole) => [pole.re, pole.im]),
    },
  ];
  const legendData = Array.from(new Set(
    series
      .map((item) => (item as { name?: string }).name)
      .filter((name): name is string =>
        typeof name === 'string'
        && name.length > 0
        && !['实轴', '虚轴', '可行域参考', 'σ 边界', 'ζ 边界'].includes(name)
      ),
  ));

  return {
    animation: false,
    legend: {
      show: true,
      data: legendData,
      top: 0,
      right: 8,
      textStyle: { fontSize: 10 },
      itemWidth: 12,
      itemHeight: 12,
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
    dataZoom: [
      { type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
      { type: 'inside', yAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: true, moveOnMouseMove: true },
    ],
    series,
  };
}

export function buildNyquistOption(result: ControlAnalysisResult, caseId?: string): EChartsCoreOption {
  const axisPreset = getControlAxisPreset(caseId, 'nyquist');
  const positivePoints = result.nyquist.positivePoints ?? result.nyquist.points;
  const negativePoints = result.nyquist.negativePoints ?? [];
  const closurePoints = buildClosedNyquistClosure(
    positivePoints,
    negativePoints,
    result.nyquist.infinityClosure?.points ?? [],
  );
  const keyPoints = result.nyquist.keyPoints ?? [];
  const xMin = axisPreset?.x[0] ?? -2;
  const xMax = axisPreset?.x[1] ?? 2;
  const yMin = axisPreset?.y[0] ?? -2;
  const yMax = axisPreset?.y[1] ?? 2;
  const span = Math.max(1, xMax - xMin, yMax - yMin);
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
        name: '实轴',
        type: 'line',
        silent: true,
        showSymbol: false,
        lineStyle: { color: 'rgba(148, 163, 184, 0.42)', width: 1 },
        data: [[xMin, 0], [xMax, 0]],
      },
      {
        name: '虚轴',
        type: 'line',
        silent: true,
        showSymbol: false,
        lineStyle: { color: 'rgba(148, 163, 184, 0.42)', width: 1 },
        data: [[0, yMin], [0, yMax]],
      },
      {
        name: 'Nyquist 正频率支',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#22d3ee', width: 2.5 },
        data: positivePoints.map((point) => [point.re, point.im]),
      },
      ...(negativePoints.length > 0
        ? [
            {
              name: 'Nyquist 负频率支',
              type: 'line',
              showSymbol: false,
              lineStyle: { color: '#22d3ee', width: 2.5 },
              data: negativePoints.map((point) => [point.re, point.im]),
            } as ChartSeriesItem,
          ]
        : []),
      ...(closurePoints.length > 1
        ? [
            {
              name: '无穷远闭合段',
              type: 'line',
              showSymbol: false,
              lineStyle: { color: '#22d3ee', width: 1.6, opacity: 0.72 },
              data: closurePoints.map((point) => [point.re, point.im]),
            } as ChartSeriesItem,
          ]
        : []),
      ...(keyPoints.length > 0
        ? [
            {
              name: 'Nyquist 关键点',
              type: 'scatter',
              ...getInteractiveSvgEChartsPointMarker('dot-filled', {
                size: 7,
                color: '#f59e0b',
                strokeColor: '#ffffff',
                strokeWidth: 1,
              }),
              data: keyPoints.map((point) => [point.point.re, point.point.im, point.frequency]),
            } as ChartSeriesItem,
          ]
        : []),
      ...(result.nyquist.asymptotes ?? []).map((asymptote, index) => {
        const rad = ((asymptote.angleDeg ?? (asymptote.end === 'low_frequency' ? 180 : 0)) * Math.PI) / 180;
        const origin = asymptote.point ?? { re: 0, im: 0 };
        return {
          name: index === 0 ? 'Nyquist 渐近方向' : '',
          type: 'line',
          silent: true,
          showSymbol: false,
          lineStyle: { color: 'rgba(249, 115, 22, 0.55)', type: 'dashed', width: 1.4 },
          data: [
            [origin.re, origin.im],
            [origin.re + Math.cos(rad) * span, origin.im + Math.sin(rad) * span],
          ],
        } as ChartSeriesItem;
      }),
      {
        name: '-1+j0',
        type: 'scatter',
        ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
          size: 10,
          color: '#ef4444',
        }),
        label: { show: true, formatter: '-1+j0', position: 'top' },
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
  const renderAs =
    handle.renderAs ?? (handle.kind === 'zero' ? 'open-zero' : 'open-pole');
  const isClosedPole = handle.renderAs === 'closed-pole' || renderAs === 'closed-pole';
  const markerKind: InteractiveSvgPointMarkerKind = isClosedPole
    ? 'dot-filled'
    : renderAs === 'open-pole'
      ? 'pole-cross'
      : 'dot-hollow';
  const markerSize = renderAs === 'open-pole' ? 20 : 16;
  const markerColor = isClosedPole ? '#1f4e79' : renderAs === 'open-pole' ? '#c81d25' : '#d97706';
  const content = (
    <svg
      viewBox={`0 0 ${markerSize} ${markerSize}`}
      className="pointer-events-none block overflow-visible"
      style={{ width: markerSize, height: markerSize }}
      aria-hidden="true"
    >
      {isClosedPole ? (
        <InteractiveSvgPointMarker
          kind="dot-filled"
          x={markerSize / 2}
          y={markerSize / 2}
          size={markerSize + 2}
          color="#ffffff"
        />
      ) : null}
      <InteractiveSvgPointMarker
        kind={markerKind}
        x={markerSize / 2}
        y={markerSize / 2}
        size={markerSize}
        color={markerColor}
        strokeColor={markerColor}
        strokeWidth={renderAs === 'open-pole' ? 2.2 : 2}
      />
    </svg>
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

export function TimeDomainPanel(props: { result: ControlAnalysisResult; caseId?: string }) {
  return <StepResponsePanel {...props} />;
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
  onClosedLoopGainCommit,
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
  onClosedLoopGainCommit?: (gain: number) => void;
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

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onClosedLoopGainCommit) {
      return undefined;
    }

    const branches = (mode === 'full' && result.rootLocus.fullBranches
      ? result.rootLocus.fullBranches
      : result.rootLocus.branches).map((branch) => branch.map(snapRootPoint));
    let dragging = false;
    let nextGain: number | null = null;

    const previewGain = (gain: number) => {
      const snapshot = findRootLocusSnapshot(branches, gain);
      if (snapshot.length === 0) {
        return;
      }
      chart.setOption({
        series: [{
          id: 'currentClosedLoopPoles',
          data: snapshot.map((pole) => [pole.re, pole.im]),
        }],
      }, { notMerge: false, lazyUpdate: true });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging) {
        return;
      }
      event.preventDefault();
      const dom = chart.getDom();
      const rect = dom.getBoundingClientRect();
      const value = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
        event.clientX - rect.left,
        event.clientY - rect.top,
      ]);
      if (!Array.isArray(value) || value.length < 2) {
        return;
      }
      const target = { re: Number(value[0]), im: Number(value[1]) };
      if (!Number.isFinite(target.re) || !Number.isFinite(target.im)) {
        return;
      }
      const closest = findClosestRootLocusPoint(branches, target);
      if (!closest || closest.gain == null || !Number.isFinite(closest.gain)) {
        return;
      }
      nextGain = closest.gain;
      previewGain(nextGain);
    };

    const handlePointerUp = () => {
      if (!dragging) {
        return;
      }
      dragging = false;
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      if (nextGain != null) {
        onClosedLoopGainCommit(nextGain);
      }
    };

    const handleChartMouseDown = (params: { seriesName?: string; event?: { event?: MouseEvent } }) => {
      if (params.seriesName !== '当前闭环极点') {
        return;
      }
      const sourceEvent = params.event?.event;
      sourceEvent?.preventDefault();
      sourceEvent?.stopPropagation();
      dragging = true;
      nextGain = null;
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
    };

    chart.on('mousedown', handleChartMouseDown as never);
    return () => {
      chart.off('mousedown', handleChartMouseDown as never);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      document.body.style.userSelect = '';
    };
  }, [mode, onClosedLoopGainCommit, overlayVersion, result.rootLocus]);

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

export function BodePanel({
  result,
  caseId,
  showMargins = true,
}: {
  result: ControlAnalysisResult;
  caseId?: string;
  showMargins?: boolean;
}) {
  return (
    <ControlChartPanel
      title="组合 Bode 图"
      meta={buildMarginText(result.metrics)}
      option={buildBodePanelOption(result, caseId, showMargins)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function ControlPerformanceBar({ result }: { result: ControlAnalysisResult }) {
  const metrics = result.metrics;
  const items = [
    ['Mp', formatFixed(metrics.overshootPct, '%')],
    ['tr', formatFixed(metrics.riseTimeSec, ' s')],
    ['ts', formatFixed(metrics.settlingTimeSec, ' s')],
    ['ess', formatFixed(Math.abs(1 - metrics.finalValue))],
    ['PM', formatFixed(metrics.phaseMarginDeg, '°')],
    ['GM', metrics.gainMarginDb === Number.POSITIVE_INFINITY ? '∞' : formatFixed(metrics.gainMarginDb, ' dB')],
    ['ωc', formatFixed(metrics.gainCrossoverRadPerSec, ' rad/s')],
    ['ωg', formatFixed(metrics.phaseCrossoverRadPerSec, ' rad/s')],
    ['闭环稳定性', result.rootLocus.currentPoles.every((pole) => pole.re < 0) ? '稳定' : '不稳定'],
  ];

  return (
    <div className="premium-lesson-tone-block premium-tone-cyan grid gap-3 sm:grid-cols-3 xl:grid-cols-9">
      {items.map(([label, value]) => (
        <div key={label} className="min-w-0" data-testid={`metric-${label}`}>
          <div className="premium-lesson-caption text-[11px]">{label}</div>
          <div className="premium-lesson-title mt-1 truncate text-sm font-semibold" title={value}>
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}
