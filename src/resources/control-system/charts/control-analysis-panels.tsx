'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  NyquistSegment,
  RootLocusData,
  RootLocusSegment,
  RootLocusSamplePoint,
} from '../analysis/types';
import {
  axisTooltipFormatter,
  buildBodeComparisonOption,
  buildBodePanelOption,
  buildBodeTurnFrequencySeries,
  buildMarginSeries,
  CONTROL_CHART_AUXILIARY_LINE_WIDTH,
  CONTROL_CHART_KEY_POINT_MARKER_SIZE,
  CONTROL_CHART_MAIN_LINE_WIDTH,
  formatAxisValue,
  getControlAxisPreset,
  getRootLocusAxisKey,
  type AxisPreset,
  type BodeTurnFrequencyHandle,
  type RootLocusMode,
} from './control-bode-options';
import { ControlChartPanel } from './control-chart-panel';

// Shared axis presets must stay aligned with case ids like ship_heading/platform_pitch
// and the root-locus variants rootLocusFull/rootLocusZoom used by the workspace.

export { buildBodeTurnFrequencySeries };

type ChartSeriesValue = NonNullable<EChartsCoreOption['series']>;
type ChartSeriesItem = ChartSeriesValue extends (infer Item)[] ? Item : ChartSeriesValue;
type ChartSeriesArray = ChartSeriesItem[];

const ROOT_LOCUS_LINE_COLOR = '#2563eb';
const ROOT_LOCUS_ASYMPTOTE_COLOR = '#64748b';
const ROOT_LOCUS_STATIONARY_POINT_COLOR = '#7c3aed';
const ROOT_LOCUS_CROSSING_POINT_COLOR = '#f97316';
const ROOT_LOCUS_OPEN_POLE_COLOR = '#dc2626';
const ROOT_LOCUS_OPEN_ZERO_COLOR = '#d97706';
const ROOT_LOCUS_CORRECTION_POLE_COLOR = '#0f766e';
const ROOT_LOCUS_CORRECTION_ZERO_COLOR = '#7c3aed';
const ROOT_LOCUS_OPEN_ZERO_STROKE_WIDTH = 2.2;
const ROOT_LOCUS_LEGEND_LINE_ICON = 'path://M0 -1.2 L28 -1.2 L28 1.2 L0 1.2 Z';
const ROOT_LOCUS_LEGEND_DASHED_LINE_ICON = 'path://M0 -1 L6 -1 L6 1 L0 1 Z M10 -1 L17 -1 L17 1 L10 1 Z M21 -1 L28 -1 L28 1 L21 1 Z';

export type RootLocusInteractiveHandle = {
  id: string;
  kind: 'pole' | 'zero';
  point: ComplexPoint;
  renderAs?: 'open-pole' | 'open-zero' | 'closed-pole' | 'correction-pole' | 'correction-zero';
  draggable?: boolean;
  ariaLabel: string;
  cursor?: string;
};

interface CartesianRange {
  x: [number, number];
  y: [number, number];
}

type PartialAxisPreset = Partial<AxisPreset>;

export interface CartesianDragRangeInput extends CartesianRange {
  width: number;
  height: number;
  deltaX: number;
  deltaY: number;
}

export interface CartesianAspectRangeInput extends CartesianRange {
  width: number;
  height: number;
}

function roundRangeValue(value: number): number {
  if (Math.abs(value) < 1e-12) {
    return 0;
  }
  return Math.round(value * 1e12) / 1e12;
}

export function calculateCartesianDragRange(input: CartesianDragRangeInput): CartesianRange {
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const xSpan = input.x[1] - input.x[0];
  const ySpan = input.y[1] - input.y[0];
  const xShift = -(input.deltaX / width) * xSpan;
  const yShift = (input.deltaY / height) * ySpan;
  return {
    x: [roundRangeValue(input.x[0] + xShift), roundRangeValue(input.x[1] + xShift)],
    y: [roundRangeValue(input.y[0] + yShift), roundRangeValue(input.y[1] + yShift)],
  };
}

export function calculateEqualAspectCartesianRange(input: CartesianAspectRangeInput): CartesianRange {
  const width = Math.max(1, input.width);
  const height = Math.max(1, input.height);
  const xSpan = input.x[1] - input.x[0];
  const ySpan = input.y[1] - input.y[0];
  if (xSpan <= 0 || ySpan <= 0) {
    return { x: input.x, y: input.y };
  }

  const xUnitsPerPixel = xSpan / width;
  const yUnitsPerPixel = ySpan / height;
  if (Math.abs(xUnitsPerPixel - yUnitsPerPixel) <= Math.max(xUnitsPerPixel, yUnitsPerPixel) * 1e-6) {
    return { x: input.x, y: input.y };
  }

  if (xUnitsPerPixel > yUnitsPerPixel) {
    const targetYSpan = xUnitsPerPixel * height;
    const centerY = 0.5 * (input.y[0] + input.y[1]);
    return {
      x: input.x,
      y: [
        roundRangeValue(centerY - targetYSpan * 0.5),
        roundRangeValue(centerY + targetYSpan * 0.5),
      ],
    };
  }

  const targetXSpan = yUnitsPerPixel * width;
  const centerX = 0.5 * (input.x[0] + input.x[1]);
  return {
    x: [
      roundRangeValue(centerX - targetXSpan * 0.5),
      roundRangeValue(centerX + targetXSpan * 0.5),
    ],
    y: input.y,
  };
}

function calculateCartesianZoomRange(range: CartesianRange, anchor: ComplexPoint, factor: number): CartesianRange {
  return {
    x: [
      roundRangeValue(anchor.re - (anchor.re - range.x[0]) * factor),
      roundRangeValue(anchor.re + (range.x[1] - anchor.re) * factor),
    ],
    y: [
      roundRangeValue(anchor.im - (anchor.im - range.y[0]) * factor),
      roundRangeValue(anchor.im + (range.y[1] - anchor.im) * factor),
    ],
  };
}

function getDisplayedCartesianRange(chart: ECharts): CartesianRange | null {
  const model = (chart as unknown as { getModel?: () => unknown }).getModel?.() as
    | { getComponent?: (type: string, index: number) => { axis?: { scale?: { getExtent?: () => number[] } } } }
    | undefined;
  const xExtent = model?.getComponent?.('xAxis', 0)?.axis?.scale?.getExtent?.();
  const yExtent = model?.getComponent?.('yAxis', 0)?.axis?.scale?.getExtent?.();

  if (
    Array.isArray(xExtent)
    && Array.isArray(yExtent)
    && xExtent.length >= 2
    && yExtent.length >= 2
    && xExtent.every(Number.isFinite)
    && yExtent.every(Number.isFinite)
  ) {
    return {
      x: [xExtent[0], xExtent[1]],
      y: [yExtent[0], yExtent[1]],
    };
  }

  return null;
}

function getCartesianPlotSize(chart: ECharts, range: CartesianRange): { width: number; height: number } | null {
  const leftBottom = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [range.x[0], range.y[0]]);
  const rightBottom = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [range.x[1], range.y[0]]);
  const leftTop = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [range.x[0], range.y[1]]);

  if (
    !Array.isArray(leftBottom)
    || !Array.isArray(rightBottom)
    || !Array.isArray(leftTop)
    || leftBottom.length < 2
    || rightBottom.length < 2
    || leftTop.length < 2
  ) {
    return null;
  }

  const width = Math.abs(Number(rightBottom[0]) - Number(leftBottom[0]));
  const height = Math.abs(Number(leftBottom[1]) - Number(leftTop[1]));
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? { width, height }
    : null;
}

function applyCartesianRange(chart: ECharts, range: CartesianRange): void {
  chart.setOption({
    xAxis: { min: range.x[0], max: range.x[1] },
    yAxis: { min: range.y[0], max: range.y[1] },
  }, { notMerge: false, lazyUpdate: false });
}

function enforceEqualAspectOnChart(chart: ECharts, onRangeChange?: () => void): void {
  const range = getDisplayedCartesianRange(chart);
  if (!range) {
    return;
  }
  const plotSize = getCartesianPlotSize(chart, range);
  if (!plotSize) {
    return;
  }
  const nextRange = calculateEqualAspectCartesianRange({ ...range, ...plotSize });
  if (
    nextRange.x[0] !== range.x[0]
    || nextRange.x[1] !== range.x[1]
    || nextRange.y[0] !== range.y[0]
    || nextRange.y[1] !== range.y[1]
  ) {
    applyCartesianRange(chart, nextRange);
    onRangeChange?.();
  }
}

function shouldIgnoreCartesianPanZoom(event?: MouseEvent | WheelEvent): boolean {
  const target = event?.target;
  return target instanceof Element && Boolean(target.closest('[data-cartesian-pan-zoom-ignore="true"]'));
}

function installCartesianPanZoom(chart: ECharts, onRangeChange?: () => void): () => void {
  const zr = chart.getZr();
  let dragState: {
    startX: number;
    startY: number;
    range: CartesianRange;
    plotSize: { width: number; height: number };
  } | null = null;

  const containsPoint = (event: { offsetX?: number; offsetY?: number }) =>
    typeof event.offsetX === 'number'
    && typeof event.offsetY === 'number'
    && chart.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY]);

  const handleMouseDown = (event: { offsetX?: number; offsetY?: number; event?: MouseEvent }) => {
    if (event.event && event.event.button !== 0) {
      return;
    }
    if (shouldIgnoreCartesianPanZoom(event.event)) {
      return;
    }
    if (!containsPoint(event)) {
      return;
    }
    const range = getDisplayedCartesianRange(chart);
    if (!range) {
      return;
    }
    const plotSize = getCartesianPlotSize(chart, range);
    if (!plotSize || typeof event.offsetX !== 'number' || typeof event.offsetY !== 'number') {
      return;
    }
    event.event?.preventDefault();
    dragState = {
      startX: event.offsetX,
      startY: event.offsetY,
      range,
      plotSize,
    };
  };

  const handleMouseMove = (event: { offsetX?: number; offsetY?: number; event?: MouseEvent }) => {
    if (!dragState || typeof event.offsetX !== 'number' || typeof event.offsetY !== 'number') {
      return;
    }
    event.event?.preventDefault();
    const nextRange = calculateCartesianDragRange({
      ...dragState.range,
      ...dragState.plotSize,
      deltaX: event.offsetX - dragState.startX,
      deltaY: event.offsetY - dragState.startY,
    });
    applyCartesianRange(chart, nextRange);
    onRangeChange?.();
  };

  const handleMouseUp = () => {
    dragState = null;
  };

  const handleMouseWheel = (event: {
    offsetX?: number;
    offsetY?: number;
    wheelDelta?: number;
    event?: WheelEvent;
  }) => {
    if (shouldIgnoreCartesianPanZoom(event.event)) {
      return;
    }
    if (!containsPoint(event) || typeof event.offsetX !== 'number' || typeof event.offsetY !== 'number') {
      return;
    }
    const range = getDisplayedCartesianRange(chart);
    if (!range) {
      return;
    }
    const anchorValue = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [event.offsetX, event.offsetY]);
    if (!Array.isArray(anchorValue) || anchorValue.length < 2) {
      return;
    }
    const anchor = { re: Number(anchorValue[0]), im: Number(anchorValue[1]) };
    if (!Number.isFinite(anchor.re) || !Number.isFinite(anchor.im)) {
      return;
    }
    event.event?.preventDefault();
    const wheelDelta = typeof event.wheelDelta === 'number'
      ? event.wheelDelta
      : -(event.event?.deltaY ?? 0);
    const factor = wheelDelta > 0 ? 0.84 : 1.18;
    applyCartesianRange(chart, calculateCartesianZoomRange(range, anchor, factor));
    onRangeChange?.();
  };

  zr.on('mousedown', handleMouseDown);
  zr.on('mousemove', handleMouseMove);
  zr.on('mouseup', handleMouseUp);
  zr.on('globalout', handleMouseUp);
  zr.on('mousewheel', handleMouseWheel);
  enforceEqualAspectOnChart(chart, onRangeChange);

  return () => {
    zr.off('mousedown', handleMouseDown);
    zr.off('mousemove', handleMouseMove);
    zr.off('mouseup', handleMouseUp);
    zr.off('globalout', handleMouseUp);
    zr.off('mousewheel', handleMouseWheel);
  };
}

function getDisplayedLogFrequencyRange(chart: ECharts): [number, number] | null {
  const model = (chart as unknown as { getModel?: () => unknown }).getModel?.() as
    | { getComponent?: (type: string, index: number) => { axis?: { scale?: { getExtent?: () => number[] } } } }
    | undefined;
  const extent = model?.getComponent?.('xAxis', 0)?.axis?.scale?.getExtent?.();
  if (
    Array.isArray(extent)
    && extent.length >= 2
    && extent.every(Number.isFinite)
    && extent[0] > 0
    && extent[1] > extent[0]
  ) {
    return [extent[0], extent[1]];
  }
  return null;
}

function applyLogFrequencyRange(chart: ECharts, range: [number, number]): void {
  chart.setOption({
    xAxis: [
      { min: range[0], max: range[1] },
      { min: range[0], max: range[1] },
    ],
  }, { notMerge: false, lazyUpdate: false });
}

function findBodeTurnHandleAt(
  chart: ECharts,
  handles: BodeTurnFrequencyHandle[],
  event: { offsetX?: number; offsetY?: number },
): BodeTurnFrequencyHandle | null {
  if (typeof event.offsetX !== 'number' || typeof event.offsetY !== 'number') {
    return null;
  }
  for (const handle of handles) {
    const pixel = chart.convertToPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [handle.frequency, 0]);
    if (!Array.isArray(pixel) || pixel.length < 2) {
      continue;
    }
    if (Math.hypot(Number(pixel[0]) - event.offsetX, Number(pixel[1]) - event.offsetY) <= 18) {
      return handle;
    }
  }
  return null;
}

function installBodeFrequencyPanZoom(
  chart: ECharts,
  onRangeChange?: () => void,
  turnFrequencyHandles: BodeTurnFrequencyHandle[] = [],
): () => void {
  const zr = chart.getZr();
  let dragState: { startX: number; range: [number, number]; width: number } | null = null;

  const containsPoint = (event: { offsetX?: number; offsetY?: number }) =>
    typeof event.offsetX === 'number'
    && typeof event.offsetY === 'number'
    && (
      chart.containPixel({ gridIndex: 0 }, [event.offsetX, event.offsetY])
      || chart.containPixel({ gridIndex: 1 }, [event.offsetX, event.offsetY])
    );

  const handleMouseDown = (event: { offsetX?: number; offsetY?: number; event?: MouseEvent }) => {
    if (event.event && event.event.button !== 0) {
      return;
    }
    if (
      shouldIgnoreCartesianPanZoom(event.event)
      || !containsPoint(event)
      || typeof event.offsetX !== 'number'
      || findBodeTurnHandleAt(chart, turnFrequencyHandles, event)
    ) {
      return;
    }
    const range = getDisplayedLogFrequencyRange(chart);
    if (!range) {
      return;
    }
    const dom = chart.getDom();
    dragState = { startX: event.offsetX, range, width: Math.max(1, dom.clientWidth) };
    event.event?.preventDefault();
  };

  const handleMouseMove = (event: { offsetX?: number; event?: MouseEvent }) => {
    if (!dragState || typeof event.offsetX !== 'number') {
      return;
    }
    event.event?.preventDefault();
    const logMin = Math.log10(dragState.range[0]);
    const logMax = Math.log10(dragState.range[1]);
    const span = logMax - logMin;
    const shift = -((event.offsetX - dragState.startX) / dragState.width) * span;
    applyLogFrequencyRange(chart, [10 ** (logMin + shift), 10 ** (logMax + shift)]);
    onRangeChange?.();
  };

  const handleMouseUp = () => {
    dragState = null;
  };

  const handleMouseWheel = (event: { offsetX?: number; offsetY?: number; wheelDelta?: number; event?: WheelEvent }) => {
    if (shouldIgnoreCartesianPanZoom(event.event) || !containsPoint(event) || typeof event.offsetX !== 'number') {
      return;
    }
    const range = getDisplayedLogFrequencyRange(chart);
    if (!range) {
      return;
    }
    const anchorValue = chart.convertFromPixel({ xAxisIndex: 0 }, [event.offsetX, event.offsetY ?? 0]);
    const anchor = Array.isArray(anchorValue) ? Number(anchorValue[0]) : Number(anchorValue);
    if (!Number.isFinite(anchor) || anchor <= 0) {
      return;
    }
    event.event?.preventDefault();
    const wheelDelta = typeof event.wheelDelta === 'number'
      ? event.wheelDelta
      : -(event.event?.deltaY ?? 0);
    const factor = wheelDelta > 0 ? 0.84 : 1.18;
    const anchorLog = Math.log10(anchor);
    const nextRange: [number, number] = [
      10 ** (anchorLog - (anchorLog - Math.log10(range[0])) * factor),
      10 ** (anchorLog + (Math.log10(range[1]) - anchorLog) * factor),
    ];
    applyLogFrequencyRange(chart, nextRange);
    onRangeChange?.();
  };

  zr.on('mousedown', handleMouseDown);
  zr.on('mousemove', handleMouseMove);
  zr.on('mouseup', handleMouseUp);
  zr.on('globalout', handleMouseUp);
  zr.on('mousewheel', handleMouseWheel);

  return () => {
    zr.off('mousedown', handleMouseDown);
    zr.off('mousemove', handleMouseMove);
    zr.off('mouseup', handleMouseUp);
    zr.off('globalout', handleMouseUp);
    zr.off('mousewheel', handleMouseWheel);
  };
}

function installBodeTurnFrequencyDrag(
  chart: ECharts,
  handles: BodeTurnFrequencyHandle[],
  onCommit: ((id: string, frequency: number) => void) | undefined,
  onRangeChange?: () => void,
): () => void {
  if (!onCommit || handles.length === 0) {
    return () => {};
  }
  const zr = chart.getZr();
  let activeHandleId: string | null = null;
  let nextFrequency: number | null = null;

  const handleMouseDown = (event: { offsetX?: number; offsetY?: number; event?: MouseEvent }) => {
    const handle = findBodeTurnHandleAt(chart, handles, event);
    if (!handle) {
      return;
    }
    activeHandleId = handle.id;
    nextFrequency = handle.frequency;
    event.event?.preventDefault();
    event.event?.stopPropagation();
  };

  const handleMouseMove = (event: { offsetX?: number; offsetY?: number; event?: MouseEvent }) => {
    if (!activeHandleId || typeof event.offsetX !== 'number') {
      return;
    }
    const value = chart.convertFromPixel({ xAxisIndex: 0 }, [event.offsetX, event.offsetY ?? 0]);
    const frequency = Array.isArray(value) ? Number(value[0]) : Number(value);
    if (!Number.isFinite(frequency) || frequency <= 0) {
      return;
    }
    nextFrequency = frequency;
    chart.setOption({
      series: [{
        id: activeHandleId,
        data: [[frequency, 0]],
      }],
    }, { notMerge: false, lazyUpdate: true });
    event.event?.preventDefault();
    event.event?.stopPropagation();
    onRangeChange?.();
  };

  const handleMouseUp = () => {
    if (activeHandleId && nextFrequency != null) {
      onCommit(activeHandleId, nextFrequency);
    }
    activeHandleId = null;
    nextFrequency = null;
  };

  zr.on('mousedown', handleMouseDown);
  zr.on('mousemove', handleMouseMove);
  zr.on('mouseup', handleMouseUp);
  zr.on('globalout', handleMouseUp);

  return () => {
    zr.off('mousedown', handleMouseDown);
    zr.off('mousemove', handleMouseMove);
    zr.off('mouseup', handleMouseUp);
    zr.off('globalout', handleMouseUp);
  };
}

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
  const magnitudeDb = Array.isArray(value) && value.length > 3 ? Number(value[3]) : Number.NaN;
  const phaseDeg = Array.isArray(value) && value.length > 4 ? Number(value[4]) : Number.NaN;
  const gainLine = Number.isFinite(gain) ? `<br/>Gain K: ${formatFixed(gain)}` : '';
  const damping = Math.hypot(x, y) > 1e-9 ? -x / Math.hypot(x, y) : 1;
  const rootLine = `<br/>阻尼比: ${formatFixed(damping)}<br/>自然频率: ${formatFixed(Math.hypot(x, y))}`;
  const nyquistLine = Number.isFinite(magnitudeDb) || Number.isFinite(phaseDeg)
    ? `<br/>|L(jω)|: ${formatFixed(magnitudeDb, ' dB')}<br/>相角: ${formatFixed(phaseDeg, '°')}`
    : '';
  return `${params.seriesName ?? '数据点'}<br/>Re(s): ${formatFixed(x)}<br/>Im(s): ${formatFixed(y)}${gainLine}${rootLine}${nyquistLine}`;
}

function nyquistTooltipFormatter(params: { seriesName?: string; value?: number[] | string | number }): string {
  const value = params.value;
  const x = Array.isArray(value) ? Number(value[0]) : Number(value);
  const y = Array.isArray(value) ? Number(value[1]) : Number(value);
  const frequency = Array.isArray(value) && value.length > 2 ? Number(value[2]) : Number.NaN;
  const magnitudeDb = Array.isArray(value) && value.length > 3 ? Number(value[3]) : Number.NaN;
  const phaseDeg = Array.isArray(value) && value.length > 4 ? Number(value[4]) : Number.NaN;
  const frequencyLine = Number.isFinite(frequency) ? `<br/>ω: ${formatFixed(frequency, ' rad/s')}` : '';
  const nyquistLine = Number.isFinite(magnitudeDb) || Number.isFinite(phaseDeg)
    ? `<br/>|L(jω)|: ${formatFixed(magnitudeDb, ' dB')}<br/>相角: ${formatFixed(phaseDeg, '°')}`
    : '';
  return `${params.seriesName ?? 'Nyquist 点'}<br/>Re: ${formatFixed(x)}<br/>Im: ${formatFixed(y)}${frequencyLine}${nyquistLine}`;
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

function buildNyquistCriterionText(result: ControlAnalysisResult): string | null {
  const criterion = result.nyquist.criterion;
  if (!criterion) {
    return null;
  }
  return `N/P/Z ${criterion.n}/${criterion.p}/${criterion.z} · ${criterion.relation}`;
}

function buildNyquistMetaText(result: ControlAnalysisResult): ReactNode {
  return [buildMarginText(result.metrics), buildNyquistCriterionText(result)]
    .filter((item): item is string => Boolean(item))
    .join(' | ');
}

function buildPointText(prefix: string, points: ComplexPoint[]): string {
  return points.map((point, index) => `${prefix}${index + 1}=${formatComplex(point)}`).join(' | ');
}

function buildRootLocusMetaText(rootLocus: RootLocusData, correctionHandles: RootLocusInteractiveHandle[] = []): ReactNode {
  const correctionPoles = correctionHandles.filter((handle) => handle.kind === 'pole').map((handle) => handle.point);
  const correctionZeros = correctionHandles.filter((handle) => handle.kind === 'zero').map((handle) => handle.point);
  const openLoopZeros = removeMatchingPoints(rootLocus.openLoopZeros, correctionZeros);
  const currentGainText = rootLocus.currentGain == null
    ? ''
    : `当前开环增益：K=${rootLocus.currentGain.toFixed(3)}`;
  const rows = [
    currentGainText,
    buildPointText('p', rootLocus.currentPoles),
    openLoopZeros.length > 0 ? buildPointText('z', openLoopZeros) : '',
  ].filter(Boolean);
  const correctionParts = [
    correctionPoles.length > 0 ? `校正极点 ${buildPointText('pc', correctionPoles)}` : '',
    correctionZeros.length > 0 ? `校正零点 ${buildPointText('zc', correctionZeros)}` : '',
  ].filter(Boolean);

  if (correctionParts.length === 0) {
    return rows.join(' | ');
  }

  return (
    <span className="inline-flex flex-col items-end gap-0.5">
      <span>{rows.join(' | ')}</span>
      <span>{correctionParts.join(' | ')}</span>
    </span>
  );
}

export function calculateStableResponseAxisPreset(
  points: CurvePoint[],
  isStable: boolean,
): { y: [number, number] } | undefined {
  if (!isStable || points.length === 0) {
    return undefined;
  }
  const maxAbs = points.reduce((max, point) => {
    const value = Math.abs(point.y);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
  if (maxAbs <= 0) {
    return undefined;
  }
  const limit = roundRangeValue(maxAbs * 1.1);
  return { y: [-limit, limit] };
}

export function buildLineOption(
  points: CurvePoint[],
  color: string,
  xAxisName: string,
  yAxisName: string,
  opts?: {
    xAxisType?: 'value' | 'log';
    axisPreset?: PartialAxisPreset;
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
      min: axisPreset?.x?.[0],
      max: axisPreset?.x?.[1],
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
      min: axisPreset?.y?.[0],
      max: axisPreset?.y?.[1],
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
        lineStyle: { color, width: CONTROL_CHART_MAIN_LINE_WIDTH },
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
      lineStyle: { color: '#2563eb', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
      data: [[sigmaBoundary, yMin], [sigmaBoundary, yMax]],
    },
    {
      name: 'ζ 边界',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#2563eb', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
      data: [[0, 0], [xLimit, yLimit]],
    },
    {
      name: '',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#2563eb', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
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

function rootLocusSegmentName(segment: RootLocusSegment): string {
  if (segment.type === 'asymptote') {
    return '根轨迹渐近线';
  }
  return '根轨迹';
}

function rootLocusSegmentWidth(segment: RootLocusSegment): number {
  if (segment.type === 'asymptote') {
    return CONTROL_CHART_AUXILIARY_LINE_WIDTH;
  }
  return CONTROL_CHART_MAIN_LINE_WIDTH;
}

function buildRootLocusSegmentSeries(segments: RootLocusSegment[]): ChartSeriesArray {
  return segments
    .filter((segment) => segment.points.length > 1)
    .map((segment) => {
      const isAsymptote = segment.type === 'asymptote';
      return {
        name: rootLocusSegmentName(segment),
        type: 'line',
        silent: isAsymptote,
        showSymbol: false,
        lineStyle: {
          color: isAsymptote ? ROOT_LOCUS_ASYMPTOTE_COLOR : ROOT_LOCUS_LINE_COLOR,
          type: segment.lineStyle,
          width: rootLocusSegmentWidth(segment),
        },
        data: segment.points.map((point) =>
          Number.isFinite(point.gain) ? [point.re, point.im, point.gain] : [point.re, point.im],
        ),
      } satisfies ChartSeriesItem;
    });
}

function rootPointKey(point: ComplexPoint): string {
  return `${point.re.toFixed(6)}:${point.im.toFixed(6)}`;
}

function removeMatchingPoints(points: ComplexPoint[], pointsToRemove: ComplexPoint[]): ComplexPoint[] {
  const counts = new Map<string, number>();
  for (const point of pointsToRemove) {
    const key = rootPointKey(point);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return points.filter((point) => {
    const key = rootPointKey(point);
    const count = counts.get(key) ?? 0;
    if (count <= 0) {
      return true;
    }
    counts.set(key, count - 1);
    return false;
  });
}

export function buildRootLocusOption(
  rootLocus: RootLocusData,
  caseId?: string,
  mode: RootLocusMode = 'default',
  axisPresetOverride?: AxisPreset,
  correctionHandles: RootLocusInteractiveHandle[] = [],
): EChartsCoreOption {
  const autoView = mode === 'full' ? rootLocus.views?.full : rootLocus.views?.feature;
  const caseAxisPreset = getControlAxisPreset(caseId, getRootLocusAxisKey(mode));
  const autoAxisPreset = autoView ? { x: autoView.x, y: autoView.y } : undefined;
  const axisPreset = axisPresetOverride ?? caseAxisPreset ?? autoAxisPreset;
  const applyAutoViewSegmentFilter = !axisPresetOverride && !caseAxisPreset && mode !== 'full';
  const excludedAutoSegmentTypes = applyAutoViewSegmentFilter
    ? new Set(autoView?.excludeSegmentTypes ?? [])
    : null;
  const showFeasible = mode !== 'full';
  const locusBranches = (mode === 'full' && rootLocus.fullBranches ? rootLocus.fullBranches : rootLocus.branches)
    .map((branch) => branch.map(snapRootPoint));
  const currentPoles = normalizeConjugatePointSet(rootLocus.currentPoles);
  const correctionPoles = normalizeConjugatePointSet(correctionHandles.filter((handle) => handle.kind === 'pole').map((handle) => handle.point));
  const correctionZeros = normalizeConjugatePointSet(correctionHandles.filter((handle) => handle.kind === 'zero').map((handle) => handle.point));
  const openLoopPoles = removeMatchingPoints(normalizeConjugatePointSet(rootLocus.openLoopPoles), correctionPoles);
  const openLoopZeros = removeMatchingPoints(normalizeConjugatePointSet(rootLocus.openLoopZeros), correctionZeros);
  const xMin = axisPreset?.x[0] ?? -8;
  const xMax = axisPreset?.x[1] ?? 2;
  const yMin = axisPreset?.y[0] ?? -6;
  const yMax = axisPreset?.y[1] ?? 6;
  const xSpan = Math.max(1, xMax - xMin);
  const ySpan = Math.max(1, yMax - yMin);
  const asymptoteLength = Math.max(xSpan, ySpan) * 1.3;
  const rootSegments = excludedAutoSegmentTypes
    ? rootLocus.segments?.filter((segment) => !excludedAutoSegmentTypes.has(segment.type))
    : rootLocus.segments;
  const rootLineSegments = rootSegments?.length
    ? buildRootLocusSegmentSeries(rootSegments)
    : [
        ...(rootLocus.realAxisSegments ?? []).map((segment) => ({
          name: '根轨迹',
          type: 'line',
          showSymbol: false,
          lineStyle: { color: ROOT_LOCUS_LINE_COLOR, type: 'solid', width: CONTROL_CHART_MAIN_LINE_WIDTH },
          data: [[segment.start ?? xMin, 0], [segment.end ?? xMax, 0]],
        } satisfies ChartSeriesItem)),
        ...locusBranches.map((branch, index) => ({
          name: index === 0 ? '根轨迹' : '',
          type: 'line',
          showSymbol: false,
          lineStyle: { color: ROOT_LOCUS_LINE_COLOR, type: 'solid', width: CONTROL_CHART_MAIN_LINE_WIDTH },
          data: branch.map((point) => [point.re, point.im, point.gain ?? null]),
        } satisfies ChartSeriesItem)),
        ...(rootLocus.asymptotes ?? []).map((asymptote, index) => {
          const rad = (asymptote.angleDeg * Math.PI) / 180;
          const dx = Math.cos(rad) * asymptoteLength;
          const dy = Math.sin(rad) * asymptoteLength;
          return {
            name: index === 0 ? '根轨迹渐近线' : '',
            type: 'line',
            silent: true,
            showSymbol: false,
            lineStyle: { color: ROOT_LOCUS_ASYMPTOTE_COLOR, type: 'dashed', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
            data: [
              [asymptote.centroid, 0],
              [asymptote.centroid + dx, dy],
            ],
          } satisfies ChartSeriesItem;
        }),
      ];
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
    ...rootLineSegments,
    ...((rootLocus.stationaryPoints?.length ?? 0) > 0
      ? [{
          name: '分离/会合点',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
            size: CONTROL_CHART_KEY_POINT_MARKER_SIZE,
            color: ROOT_LOCUS_STATIONARY_POINT_COLOR,
          }),
          data: rootLocus.stationaryPoints?.map((point) => [point.re, point.im, point.gain ?? null]) ?? [],
        } satisfies ChartSeriesItem]
      : []),
    ...((rootLocus.imaginaryAxisCrossings?.length ?? 0) > 0
      ? [{
          name: '虚轴交点',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
            size: CONTROL_CHART_KEY_POINT_MARKER_SIZE,
            color: ROOT_LOCUS_CROSSING_POINT_COLOR,
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
        size: 11,
        color: ROOT_LOCUS_OPEN_POLE_COLOR,
        strokeWidth: 1.4,
      }),
      data: openLoopPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      name: '开环零点',
      type: 'scatter',
      ...getInteractiveSvgEChartsPointMarker('dot-hollow', {
        size: 13,
        color: ROOT_LOCUS_OPEN_ZERO_COLOR,
        fillColor: 'rgba(255, 255, 255, 0)',
        strokeWidth: ROOT_LOCUS_OPEN_ZERO_STROKE_WIDTH,
      }),
      data: openLoopZeros.map((zero) => [zero.re, zero.im]),
    },
    ...(correctionPoles.length > 0
      ? [{
          name: '校正装置极点',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('pole-cross', {
            size: 12,
            color: ROOT_LOCUS_CORRECTION_POLE_COLOR,
            strokeWidth: 2.2,
          }),
          z: 11,
          data: correctionPoles.map((pole) => [pole.re, pole.im]),
        } satisfies ChartSeriesItem]
      : []),
    ...(correctionZeros.length > 0
      ? [{
          name: '校正装置零点',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('dot-hollow', {
            size: 13,
            color: ROOT_LOCUS_CORRECTION_ZERO_COLOR,
            fillColor: 'rgba(255, 255, 255, 0)',
            strokeWidth: ROOT_LOCUS_OPEN_ZERO_STROKE_WIDTH,
          }),
          z: 11,
          data: correctionZeros.map((zero) => [zero.re, zero.im]),
        } satisfies ChartSeriesItem]
      : []),
    {
      id: 'currentClosedLoopPoles',
      name: '当前闭环极点',
      type: 'scatter',
      ...getInteractiveSvgEChartsPointMarker('dot-filled', {
        size: 13,
        color: ROOT_LOCUS_LINE_COLOR,
      }),
      z: 10,
      data: currentPoles.map((pole) => [pole.re, pole.im]),
    },
  ];
  const legendNames = Array.from(new Set(
    series
      .map((item) => (item as { name?: string }).name)
      .filter((name): name is string =>
        typeof name === 'string'
        && name.length > 0
        && !['实轴', '虚轴', '可行域参考', 'σ 边界', 'ζ 边界'].includes(name)
      ),
  ));
  const legendData = legendNames.map((name) => {
    if (name === '根轨迹') {
      return { name, icon: ROOT_LOCUS_LEGEND_LINE_ICON, symbolKeepAspect: true };
    }
    if (name === '根轨迹渐近线') {
      return { name, icon: ROOT_LOCUS_LEGEND_DASHED_LINE_ICON, symbolKeepAspect: true };
    }
    if (name === '当前闭环极点') {
      return { name, icon: 'circle' };
    }
    if (name === '校正装置极点') {
      return { name, icon: 'path://M-6 -6 L6 6 M6 -6 L-6 6' };
    }
    if (name === '校正装置零点') {
      return { name, icon: 'circle' };
    }
    if (name === '分离/会合点' || name === '虚轴交点') {
      return { name, icon: 'diamond' };
    }
    return name;
  });

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
      min: axisPreset?.x?.[0],
      max: axisPreset?.x?.[1],
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
      min: axisPreset?.y?.[0],
      max: axisPreset?.y?.[1],
      name: 'Im(s)',
      nameLocation: 'middle',
      nameGap: 36,
      axisLabel: {
        formatter: formatAxisValue,
      },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series,
    graphic: rootLocus.currentGain == null ? [] : [
      {
        type: 'text',
        right: 20,
        top: 30,
        style: {
          text: `K=${rootLocus.currentGain.toFixed(3)}`,
          fill: 'rgba(71, 85, 105, 0.92)',
          font: '12px sans-serif',
        },
      },
    ],
  };
}

function buildNyquistUnitCircleData(): Array<[number, number]> {
  const sampleCount = 160;
  return Array.from({ length: sampleCount + 1 }, (_, index) => {
    const angle = (index / sampleCount) * Math.PI * 2;
    return [Math.cos(angle), Math.sin(angle)];
  });
}

function nyquistSegmentName(segment: NyquistSegment): string {
  if (segment.type === 'regular_positive') {
    return 'Nyquist 正频率支';
  }
  if (segment.type === 'regular_negative') {
    return 'Nyquist 负频率支';
  }
  if (segment.type === 'infinity_arc') {
    return '无穷远闭合段';
  }
  if (segment.type === 'big_arc') {
    return 'Nyquist 大圆弧';
  }
  return 'Nyquist 辅助段';
}

function shouldRenderNyquistSegment(segment: NyquistSegment): boolean {
  return segment.points.length > 1 && segment.metadata?.collapsed !== true;
}

function buildNyquistSegmentSeries(segments: NyquistSegment[]): ChartSeriesArray {
  return segments
    .filter(shouldRenderNyquistSegment)
    .map((segment) => {
      const isAuxiliary = segment.type === 'infinity_arc' || segment.type === 'big_arc' || segment.lineStyle === 'dashed';
      return {
        name: nyquistSegmentName(segment),
        type: 'line',
        showSymbol: false,
        lineStyle: {
          color: '#22d3ee',
          type: isAuxiliary ? 'dashed' : 'solid',
          width: isAuxiliary ? CONTROL_CHART_AUXILIARY_LINE_WIDTH : CONTROL_CHART_MAIN_LINE_WIDTH,
          opacity: isAuxiliary ? 0.94 : 1,
        },
        z: isAuxiliary ? 6 : 3,
        data: segment.points.map((point) => [point.re, point.im]),
      } satisfies ChartSeriesItem;
    });
}

function toNyquistSeriesData(points: Array<ComplexPoint & {
  frequency?: number;
  magnitudeDb?: number;
  phaseDeg?: number;
}>): number[][] {
  return points.map((point) => [
    point.re,
    point.im,
    ...(Number.isFinite(point.frequency ?? NaN)
      ? [point.frequency as number, point.magnitudeDb ?? 0, point.phaseDeg ?? 0]
      : []),
  ]);
}

function buildLegacyNyquistSegmentSeries(
  positivePoints: ComplexPoint[],
  negativePoints: ComplexPoint[],
  infinityClosure?: { segments?: ComplexPoint[][]; points?: ComplexPoint[] },
): ChartSeriesArray {
  const closureSegments = infinityClosure?.segments?.length
    ? infinityClosure.segments
    : infinityClosure?.points?.length
      ? [infinityClosure.points]
      : [];

  return [
    {
      name: 'Nyquist 正频率支',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#22d3ee', width: CONTROL_CHART_MAIN_LINE_WIDTH },
      data: toNyquistSeriesData(positivePoints),
    } satisfies ChartSeriesItem,
    ...(negativePoints.length > 0
      ? [{
          name: 'Nyquist 负频率支',
          type: 'line',
          showSymbol: false,
          lineStyle: { color: '#22d3ee', width: CONTROL_CHART_MAIN_LINE_WIDTH },
          data: toNyquistSeriesData(negativePoints),
        } satisfies ChartSeriesItem]
      : []),
    ...closureSegments.map((points) => ({
      name: '无穷远闭合段',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#22d3ee', type: 'dashed', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH, opacity: 0.94 },
      z: 6,
      data: points.map((point) => [point.re, point.im]),
    } satisfies ChartSeriesItem)),
  ];
}

function findNyquistKeyPoint(
  result: ControlAnalysisResult,
  kind: string,
  targetFrequency: number | null | undefined,
): ComplexPoint | null {
  const candidates = (result.nyquist.keyPoints ?? []).filter((point) => point.kind === kind);
  if (candidates.length === 0) {
    return null;
  }
  if (targetFrequency == null || !Number.isFinite(targetFrequency)) {
    return candidates[0].point;
  }
  return candidates.reduce((best, point) =>
    Math.abs(point.frequency - targetFrequency) < Math.abs(best.frequency - targetFrequency) ? point : best,
  ).point;
}

function buildNyquistPhaseSectorData(point: ComplexPoint): Array<[number, number]> {
  const radius = Math.max(0.18, Math.hypot(point.re, point.im));
  const startAngle = Math.PI;
  let endAngle = Math.atan2(point.im, point.re);
  if (endAngle < 0) {
    endAngle += Math.PI * 2;
  }
  if (endAngle < startAngle) {
    endAngle += Math.PI * 2;
  }
  const sampleCount = 24;
  return [
    [0, 0],
    ...Array.from({ length: sampleCount + 1 }, (_, index) => {
      const ratio = index / sampleCount;
      const angle = startAngle + (endAngle - startAngle) * ratio;
      return [Math.cos(angle) * radius, Math.sin(angle) * radius] as [number, number];
    }),
  ];
}

function buildNyquistMarginAnnotationSeries(result: ControlAnalysisResult): ChartSeriesArray {
  const unitCirclePoint = findNyquistKeyPoint(result, 'unit_circle_crossing', result.metrics.gainCrossoverRadPerSec);
  const realAxisPoint = findNyquistKeyPoint(result, 'real_axis_crossing', result.metrics.phaseCrossoverRadPerSec);
  const sectorData = unitCirclePoint ? buildNyquistPhaseSectorData(unitCirclePoint) : [];

  return [
    ...(unitCirclePoint
      ? [{
          name: 'PM 相位裕度扇区',
          type: 'custom',
          silent: true,
          z: 1,
          itemStyle: { color: 'rgba(14, 165, 233, 0.13)' },
          data: [0],
          renderItem: (_params: unknown, api: { coord: (value: [number, number]) => number[] }) => ({
            type: 'polygon',
            shape: { points: sectorData.map((point) => api.coord(point)) },
            style: {
              fill: 'rgba(14, 165, 233, 0.13)',
              stroke: 'rgba(14, 165, 233, 0.28)',
              lineWidth: 1,
            },
          }),
        } satisfies ChartSeriesItem]
      : []),
    ...(unitCirclePoint
      ? [{
          name: 'PM 相位裕度半径',
          type: 'line',
          silent: true,
          showSymbol: false,
          z: 4,
          lineStyle: { color: 'rgba(14, 165, 233, 0.72)', type: 'dashed', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
          data: [[0, 0], [unitCirclePoint.re, unitCirclePoint.im]],
        } satisfies ChartSeriesItem]
      : []),
    ...(realAxisPoint
      ? [{
          name: 'GM 增益裕度连线',
          type: 'line',
          silent: true,
          showSymbol: false,
          z: 4,
          lineStyle: { color: 'rgba(245, 158, 11, 0.78)', type: 'dashed', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
          data: [[realAxisPoint.re, realAxisPoint.im], [-1, 0]],
        } satisfies ChartSeriesItem]
      : []),
  ];
}

export function buildNyquistOption(
  result: ControlAnalysisResult,
  caseId?: string,
  axisPresetOverride?: AxisPreset,
): EChartsCoreOption {
  const axisPreset = axisPresetOverride ?? getControlAxisPreset(caseId, 'nyquist');
  const positivePoints = result.nyquist.positiveSamples ?? result.nyquist.positivePoints ?? result.nyquist.points;
  const negativePoints = result.nyquist.negativeSamples ?? result.nyquist.negativePoints ?? [];
  const hasSampleMetadata = Boolean(result.nyquist.positiveSamples?.length || result.nyquist.negativeSamples?.length);
  const contourSeries = result.nyquist.segments?.length && !hasSampleMetadata
    ? buildNyquistSegmentSeries(result.nyquist.segments)
    : buildLegacyNyquistSegmentSeries(
        positivePoints,
        negativePoints,
        result.nyquist.infinityClosure,
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
      formatter: nyquistTooltipFormatter,
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
      ...buildNyquistMarginAnnotationSeries(result),
      {
        name: '单位圆',
        type: 'line',
        silent: true,
        showSymbol: false,
        lineStyle: { color: 'rgba(124, 58, 237, 0.58)', type: 'dotted', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
        data: buildNyquistUnitCircleData(),
      },
      ...contourSeries,
      ...(keyPoints.length > 0
        ? [
            {
              name: 'Nyquist 关键点',
              type: 'scatter',
              ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
                size: CONTROL_CHART_KEY_POINT_MARKER_SIZE,
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
          lineStyle: { color: 'rgba(249, 115, 22, 0.55)', type: 'dashed', width: CONTROL_CHART_AUXILIARY_LINE_WIDTH },
          data: [
            [origin.re, origin.im],
            [origin.re + Math.cos(rad) * span, origin.im + Math.sin(rad) * span],
          ],
        } as ChartSeriesItem;
      }),
      {
        name: '-1+j0',
        type: 'scatter',
        ...getInteractiveSvgEChartsPointMarker('dot-filled', {
          size: 15,
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
    : renderAs === 'open-pole' || renderAs === 'correction-pole'
      ? 'pole-cross'
      : 'dot-hollow';
  const markerSize = renderAs === 'open-pole' || renderAs === 'correction-pole'
    ? 12
    : renderAs === 'open-zero' || renderAs === 'correction-zero'
      ? 13
      : 16;
  const markerColor = isClosedPole
    ? '#1f4e79'
    : renderAs === 'correction-pole'
      ? ROOT_LOCUS_CORRECTION_POLE_COLOR
      : renderAs === 'correction-zero'
        ? ROOT_LOCUS_CORRECTION_ZERO_COLOR
        : renderAs === 'open-pole'
          ? '#c81d25'
          : '#d97706';
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
        strokeWidth={renderAs === 'open-pole' || renderAs === 'correction-pole'
          ? 2.2
          : renderAs === 'open-zero' || renderAs === 'correction-zero'
            ? ROOT_LOCUS_OPEN_ZERO_STROKE_WIDTH
            : 2}
      />
    </svg>
  );
  const visibleContent = isClosedPole && handle.draggable ? null : content;

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
          className="pointer-events-auto relative flex h-7 w-7 items-center justify-center rounded-full bg-transparent p-0"
          style={{ cursor: handle.cursor ?? 'grab' }}
          aria-label={handle.ariaLabel}
          data-cartesian-pan-zoom-ignore="true"
        >
          {visibleContent}
          <span className="sr-only">{handle.ariaLabel}</span>
        </button>
      ) : (
        <div className="pointer-events-none" aria-label={handle.ariaLabel}>
          {visibleContent}
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

export function TimeDomainPanel({
  result,
  caseId,
  onRefreshRange,
}: {
  result: ControlAnalysisResult;
  caseId?: string;
  onRefreshRange?: (range: CartesianRange) => void;
}) {
  const axisPreset = getControlAxisPreset(caseId, 'step');
  const stableAxisPreset = calculateStableResponseAxisPreset(
    result.stepResponse.points,
    result.metrics.settlingTimeSec != null,
  );
  const chartRef = useRef<ECharts | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const preservedRangeRef = useRef<CartesianRange | null>(null);
  const displayedAxisPreset = preservedRangeRef.current ?? axisPreset ?? stableAxisPreset;
  const option = useMemo(
    () => buildLineOption(result.stepResponse.points, '#22d3ee', '时间 / s', '响应', {
      axisPreset: displayedAxisPreset,
    }),
    [displayedAxisPreset, result.stepResponse.points],
  );
  const handleChartReady = useCallback((chart: ECharts) => {
    chartRef.current = chart;
    cleanupRef.current?.();
    const refreshRange = () => {
      preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
    };
    cleanupRef.current = installCartesianPanZoom(chart, refreshRange);
  }, []);
  const handleRefresh = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !onRefreshRange) {
      return;
    }
    const range = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
    if (range) {
      preservedRangeRef.current = range;
      onRefreshRange(range);
    }
  }, [onRefreshRange]);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    chartRef.current = null;
  }, []);

  return (
    <ControlChartPanel
      title="时域响应"
      meta={buildMetricText(result.metrics)}
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
      onChartReady={handleChartReady}
      onRefresh={onRefreshRange ? handleRefresh : undefined}
      refreshLabel="按当前时域范围刷新"
    />
  );
}

function buildTimeDomainComparisonOption(
  panels: Array<{ label: string; color: string; result: ControlAnalysisResult }>,
  axisPreset?: PartialAxisPreset,
): EChartsCoreOption {
  return {
    animation: false,
    legend: {
      top: 0,
      icon: ROOT_LOCUS_LEGEND_LINE_ICON,
      data: panels.map((panel) => panel.label),
    },
    grid: { top: 34, right: 18, bottom: 42, left: 58 },
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltipFormatter,
    },
    xAxis: {
      type: 'value',
      min: axisPreset?.x?.[0],
      max: axisPreset?.x?.[1],
      name: '时间 / s',
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      min: axisPreset?.y?.[0],
      max: axisPreset?.y?.[1],
      name: '响应',
      nameLocation: 'middle',
      nameGap: 42,
      axisLabel: { formatter: formatAxisValue },
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: panels.map((panel) => ({
      name: panel.label,
      type: 'line',
      showSymbol: false,
      smooth: false,
      lineStyle: { color: panel.color, width: CONTROL_CHART_MAIN_LINE_WIDTH },
      data: panel.result.stepResponse.points.map((point) => [point.x, point.y]),
    } satisfies ChartSeriesItem)),
  };
}

export function TimeDomainComparisonPanel({
  panels,
  caseId,
  onRefreshRange,
}: {
  panels: Array<{ label: string; color: string; result: ControlAnalysisResult }>;
  caseId?: string;
  onRefreshRange?: (range: CartesianRange) => void;
}) {
  const axisPreset = getControlAxisPreset(caseId, 'step');
  const stableAxisPreset = calculateStableResponseAxisPreset(
    panels.flatMap((panel) => panel.result.stepResponse.points),
    panels.every((panel) => panel.result.metrics.settlingTimeSec != null),
  );
  const chartRef = useRef<ECharts | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const preservedRangeRef = useRef<CartesianRange | null>(null);
  const displayedAxisPreset = preservedRangeRef.current ?? axisPreset ?? stableAxisPreset;
  const option = useMemo(
    () => buildTimeDomainComparisonOption(panels, displayedAxisPreset),
    [displayedAxisPreset, panels],
  );
  const handleChartReady = useCallback((chart: ECharts) => {
    chartRef.current = chart;
    cleanupRef.current?.();
    const refreshRange = () => {
      preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
    };
    cleanupRef.current = installCartesianPanZoom(chart, refreshRange);
  }, []);
  const handleRefresh = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !onRefreshRange) {
      return;
    }
    const range = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
    if (range) {
      preservedRangeRef.current = range;
      onRefreshRange(range);
    }
  }, [onRefreshRange]);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    chartRef.current = null;
  }, []);

  return (
    <ControlChartPanel
      title="时域响应"
      meta={panels.map((panel) => panel.label).join(' / ')}
      option={option}
      fallback={panels.find((panel) => panel.result.isFallback)?.result.fallbackMessage ?? null}
      isFallback={panels.some((panel) => panel.result.isFallback)}
      onChartReady={handleChartReady}
      onRefresh={onRefreshRange ? handleRefresh : undefined}
      refreshLabel="按当前时域范围刷新"
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
  const axisPreset = getControlAxisPreset(caseId, 'nyquist');
  const chartRef = useRef<ECharts | null>(null);
  const panZoomCleanupRef = useRef<(() => void) | null>(null);
  const aspectFrameRef = useRef<number | null>(null);
  const preservedRangeRef = useRef<CartesianRange | null>(null);
  const axisScopeKeyRef = useRef<string | null>(null);
  const axisScopeKey = [
    caseId ?? '',
    axisPreset?.x[0] ?? '',
    axisPreset?.x[1] ?? '',
    axisPreset?.y[0] ?? '',
    axisPreset?.y[1] ?? '',
  ].join('|');
  if (axisScopeKeyRef.current !== axisScopeKey) {
    axisScopeKeyRef.current = axisScopeKey;
    preservedRangeRef.current = null;
  }
  const displayedAxisPreset = preservedRangeRef.current ?? axisPreset;
  const option = useMemo(
    () => buildNyquistOption(result, caseId, displayedAxisPreset),
    [displayedAxisPreset, caseId, result],
  );
  const scheduleNyquistEqualAspect = useCallback((chart: ECharts | null = chartRef.current) => {
    if (!chart || typeof window === 'undefined') {
      return;
    }
    if (aspectFrameRef.current !== null) {
      window.cancelAnimationFrame(aspectFrameRef.current);
    }
    aspectFrameRef.current = window.requestAnimationFrame(() => {
      enforceEqualAspectOnChart(chart, () => {
        preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
      });
      aspectFrameRef.current = null;
    });
  }, []);
  const handleChartReady = useCallback((chart: ECharts) => {
    chartRef.current = chart;
    panZoomCleanupRef.current?.();
    const refreshRange = () => {
      preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
    };
    panZoomCleanupRef.current = installCartesianPanZoom(chart, refreshRange);
    scheduleNyquistEqualAspect(chart);
  }, [scheduleNyquistEqualAspect]);

  useEffect(() => {
    scheduleNyquistEqualAspect();
    return () => {
      if (aspectFrameRef.current !== null) {
        window.cancelAnimationFrame(aspectFrameRef.current);
        aspectFrameRef.current = null;
      }
    };
  }, [option, scheduleNyquistEqualAspect]);

  useEffect(() => () => {
    if (aspectFrameRef.current !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(aspectFrameRef.current);
      aspectFrameRef.current = null;
    }
    panZoomCleanupRef.current?.();
    panZoomCleanupRef.current = null;
    chartRef.current = null;
  }, []);

  return (
    <ControlChartPanel
      title="Nyquist 图"
      meta={buildNyquistMetaText(result)}
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
      onChartReady={handleChartReady}
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
  onInteractiveHandleCommit,
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
  onInteractiveHandleCommit?: (id: string, point: ComplexPoint) => void;
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
  const chartEventCleanupRef = useRef<(() => void) | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const aspectFrameRef = useRef<number | null>(null);
  const preservedRangeRef = useRef<CartesianRange | null>(null);
  const axisScopeKeyRef = useRef<string | null>(null);
  const axisScopeKey = [
    caseId ?? '',
    mode,
    axisPreset?.x[0] ?? '',
    axisPreset?.x[1] ?? '',
    axisPreset?.y[0] ?? '',
    axisPreset?.y[1] ?? '',
  ].join('|');
  if (axisScopeKeyRef.current !== axisScopeKey) {
    axisScopeKeyRef.current = axisScopeKey;
    preservedRangeRef.current = null;
  }
  const displayedAxisPreset = preservedRangeRef.current ?? axisPreset;
  const option = useMemo(
    () => buildRootLocusOption(result.rootLocus, caseId, mode, displayedAxisPreset, interactiveHandles ?? []),
    [displayedAxisPreset, caseId, mode, result.rootLocus, interactiveHandles],
  );
  const [dragPreviewHandle, setDragPreviewHandle] = useState<{ id: string; point: ComplexPoint } | null>(null);
  const [overlayVersion, setOverlayVersion] = useState(0);
  const rootLocusBranches = useMemo(
    () => (mode === 'full' && result.rootLocus.fullBranches
      ? result.rootLocus.fullBranches
      : result.rootLocus.branches).map((branch) => branch.map(snapRootPoint)),
    [mode, result.rootLocus.branches, result.rootLocus.fullBranches],
  );
  const closedLoopPoleHandles = useMemo<RootLocusInteractiveHandle[]>(
    () => onClosedLoopGainCommit
      ? normalizeConjugatePointSet(result.rootLocus.currentPoles).map((point, index) => ({
          id: `closed-loop-pole-${index}`,
          kind: 'pole',
          point,
          renderAs: 'closed-pole',
          draggable: true,
          ariaLabel: `拖动闭环极点 ${index + 1}`,
          cursor: 'grab',
        }))
      : [],
    [onClosedLoopGainCommit, result.rootLocus.currentPoles],
  );
  const handleChartReady = useCallback((chart: ECharts, container: HTMLDivElement) => {
    chartRef.current = chart;
    chartEventCleanupRef.current?.();
    const refreshOverlay = () => {
      preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
      setOverlayVersion((version) => version + 1);
    };
    chartEventCleanupRef.current = installCartesianPanZoom(chart, refreshOverlay);
    setOverlayVersion((version) => version + 1);
    onChartReady?.(chart, container);
  }, [onChartReady]);

  useEffect(() => {
    return () => {
      if (aspectFrameRef.current !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(aspectFrameRef.current);
        aspectFrameRef.current = null;
      }
      chartEventCleanupRef.current?.();
      chartEventCleanupRef.current = null;
      dragCleanupRef.current?.();
      dragCleanupRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || typeof window === 'undefined') {
      return undefined;
    }
    if (aspectFrameRef.current !== null) {
      window.cancelAnimationFrame(aspectFrameRef.current);
    }
    aspectFrameRef.current = window.requestAnimationFrame(() => {
      enforceEqualAspectOnChart(chart, () => {
        preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
        setOverlayVersion((version) => version + 1);
      });
      aspectFrameRef.current = null;
    });
    return () => {
      if (aspectFrameRef.current !== null) {
        window.cancelAnimationFrame(aspectFrameRef.current);
        aspectFrameRef.current = null;
      }
    };
  }, [option]);

  useEffect(() => {
    setOverlayVersion((version) => version + 1);
  }, [result.rootLocus.currentPoles]);

  const startClosedLoopPoleDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const chart = chartRef.current;
    if (!chart || !onClosedLoopGainCommit) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragCleanupRef.current?.();

    let nextGain: number | null = null;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const previewGain = (gain: number) => {
      const snapshot = findRootLocusSnapshot(rootLocusBranches, gain);
      if (snapshot.length === 0) {
        return;
      }
      chart.setOption({
        series: [{
          id: 'currentClosedLoopPoles',
          data: snapshot.map((pole) => [pole.re, pole.im]),
        }],
      }, { notMerge: false, lazyUpdate: true });
      setOverlayVersion((version) => version + 1);
    };

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      const dom = chart.getDom();
      const rect = dom.getBoundingClientRect();
      const value = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
        pointerEvent.clientX - rect.left,
        pointerEvent.clientY - rect.top,
      ]);
      if (!Array.isArray(value) || value.length < 2) {
        return;
      }
      const target = { re: Number(value[0]), im: Number(value[1]) };
      if (!Number.isFinite(target.re) || !Number.isFinite(target.im)) {
        return;
      }
      const closest = findClosestRootLocusPoint(rootLocusBranches, target);
      if (!closest || closest.gain == null || !Number.isFinite(closest.gain)) {
        return;
      }
      nextGain = closest.gain;
      previewGain(nextGain);
    };

    const stopDrag = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      document.body.style.userSelect = previousUserSelect;
      dragCleanupRef.current = null;
      if (nextGain != null) {
        preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
        onClosedLoopGainCommit(nextGain);
      }
    };

    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      document.body.style.userSelect = previousUserSelect;
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', stopDrag, { once: true });
    window.addEventListener('pointercancel', stopDrag, { once: true });
  }, [onClosedLoopGainCommit, rootLocusBranches]);

  const startInteractiveHandleDrag = useCallback((id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
    const chart = chartRef.current;
    if (!chart || !onInteractiveHandleCommit) {
      onHandlePointerDown?.(id, event);
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragCleanupRef.current?.();

    let nextPoint: ComplexPoint | null = null;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const handlePointerMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault();
      pointerEvent.stopPropagation();
      const dom = chart.getDom();
      const rect = dom.getBoundingClientRect();
      const value = chart.convertFromPixel({ xAxisIndex: 0, yAxisIndex: 0 }, [
        pointerEvent.clientX - rect.left,
        pointerEvent.clientY - rect.top,
      ]);
      if (!Array.isArray(value) || value.length < 2) {
        return;
      }
      const point = { re: Number(value[0]), im: Number(value[1]) };
      if (Number.isFinite(point.re) && Number.isFinite(point.im)) {
        nextPoint = point;
        setDragPreviewHandle({ id, point });
        setOverlayVersion((version) => version + 1);
      }
    };

    const stopDrag = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      document.body.style.userSelect = previousUserSelect;
      dragCleanupRef.current = null;
      setDragPreviewHandle(null);
      if (nextPoint) {
        preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;
        onInteractiveHandleCommit(id, nextPoint);
      }
    };

    dragCleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
      document.body.style.userSelect = previousUserSelect;
      setDragPreviewHandle(null);
    };
    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', stopDrag, { once: true });
    window.addEventListener('pointercancel', stopDrag, { once: true });
  }, [onHandlePointerDown, onInteractiveHandleCommit]);

  const handleInteractiveHandlePointerDown = useCallback(
    (id: string, event: ReactPointerEvent<HTMLButtonElement>) => {
      if (id.startsWith('closed-loop-pole-')) {
        startClosedLoopPoleDrag(event);
        return;
      }
      if (onInteractiveHandleCommit) {
        startInteractiveHandleDrag(id, event);
        return;
      }
      onHandlePointerDown?.(id, event);
    },
    [onHandlePointerDown, onInteractiveHandleCommit, startClosedLoopPoleDrag, startInteractiveHandleDrag],
  );

  const allInteractiveHandles = useMemo(
    () => [...(interactiveHandles ?? []), ...closedLoopPoleHandles].map((handle) =>
      dragPreviewHandle?.id === handle.id
        ? { ...handle, point: dragPreviewHandle.point }
        : handle,
    ),
    [closedLoopPoleHandles, dragPreviewHandle, interactiveHandles],
  );

  const interactiveOverlay = allInteractiveHandles.length > 0 ? (
    <div
      ref={interactiveLayerRef}
      className="pointer-events-none absolute inset-0"
      data-overlay-version={overlayVersion}
    >
      {allInteractiveHandles.map((handle) =>
        renderInteractiveHandle(
          handle,
          getInteractiveHandlePixelPosition(handle.point, chartRef.current),
          handleInteractiveHandlePointerDown,
        ),
      )}
    </div>
  ) : null;

  return (
    <ControlChartPanel
      title={title}
      meta={buildRootLocusMetaText(result.rootLocus, interactiveHandles)}
      option={option}
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
  turnFrequencyHandles = [],
  onTurnFrequencyCommit,
  onRefreshRange,
}: {
  result: ControlAnalysisResult;
  caseId?: string;
  showMargins?: boolean;
  turnFrequencyHandles?: BodeTurnFrequencyHandle[];
  onTurnFrequencyCommit?: (id: string, frequency: number) => void;
  onRefreshRange?: (range: [number, number]) => void;
}) {
  const chartRef = useRef<ECharts | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const preservedFrequencyRangeRef = useRef<[number, number] | null>(null);
  const displayedFrequencyRange = preservedFrequencyRangeRef.current;
  const option = useMemo(
    () => buildBodePanelOption(result, caseId, showMargins, displayedFrequencyRange, turnFrequencyHandles),
    [caseId, displayedFrequencyRange, result, showMargins, turnFrequencyHandles],
  );
  const handleChartReady = useCallback((chart: ECharts) => {
    chartRef.current = chart;
    cleanupRef.current?.();
    const refreshRange = () => {
      preservedFrequencyRangeRef.current = getDisplayedLogFrequencyRange(chart) ?? preservedFrequencyRangeRef.current;
    };
    const cleanupPanZoom = installBodeFrequencyPanZoom(chart, refreshRange, turnFrequencyHandles);
    const cleanupTurnDrag = installBodeTurnFrequencyDrag(chart, turnFrequencyHandles, onTurnFrequencyCommit, refreshRange);
    cleanupRef.current = () => {
      cleanupPanZoom();
      cleanupTurnDrag();
    };
  }, [onTurnFrequencyCommit, turnFrequencyHandles]);
  const handleRefresh = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !onRefreshRange) {
      return;
    }
    const range = getDisplayedLogFrequencyRange(chart) ?? preservedFrequencyRangeRef.current;
    if (range) {
      preservedFrequencyRangeRef.current = range;
      onRefreshRange(range);
    }
  }, [onRefreshRange]);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    chartRef.current = null;
  }, []);

  return (
    <ControlChartPanel
      title="组合 Bode 图"
      meta={buildMarginText(result.metrics)}
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
      onChartReady={handleChartReady}
      onRefresh={onRefreshRange ? handleRefresh : undefined}
      refreshLabel="按当前频率范围刷新"
    />
  );
}

export function BodeComparisonPanel({
  panels,
  caseId,
  turnFrequencyHandles = [],
  onTurnFrequencyCommit,
  onRefreshRange,
}: {
  panels: Array<{ label: string; color: string; result: ControlAnalysisResult }>;
  caseId?: string;
  turnFrequencyHandles?: BodeTurnFrequencyHandle[];
  onTurnFrequencyCommit?: (id: string, frequency: number) => void;
  onRefreshRange?: (range: [number, number]) => void;
}) {
  const chartRef = useRef<ECharts | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const preservedFrequencyRangeRef = useRef<[number, number] | null>(null);
  const displayedFrequencyRange = preservedFrequencyRangeRef.current;
  const option = useMemo(
    () => buildBodeComparisonOption(panels, caseId, displayedFrequencyRange, turnFrequencyHandles),
    [caseId, displayedFrequencyRange, panels, turnFrequencyHandles],
  );
  const handleChartReady = useCallback((chart: ECharts) => {
    chartRef.current = chart;
    cleanupRef.current?.();
    const refreshRange = () => {
      preservedFrequencyRangeRef.current = getDisplayedLogFrequencyRange(chart) ?? preservedFrequencyRangeRef.current;
    };
    const cleanupPanZoom = installBodeFrequencyPanZoom(chart, refreshRange, turnFrequencyHandles);
    const cleanupTurnDrag = installBodeTurnFrequencyDrag(chart, turnFrequencyHandles, onTurnFrequencyCommit, refreshRange);
    cleanupRef.current = () => {
      cleanupPanZoom();
      cleanupTurnDrag();
    };
  }, [onTurnFrequencyCommit, turnFrequencyHandles]);
  const handleRefresh = useCallback(() => {
    const chart = chartRef.current;
    if (!chart || !onRefreshRange) {
      return;
    }
    const range = getDisplayedLogFrequencyRange(chart) ?? preservedFrequencyRangeRef.current;
    if (range) {
      preservedFrequencyRangeRef.current = range;
      onRefreshRange(range);
    }
  }, [onRefreshRange]);

  useEffect(() => () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    chartRef.current = null;
  }, []);

  return (
    <ControlChartPanel
      title="组合 Bode 图"
      meta={panels.map((panel) => panel.label).join(' / ')}
      option={option}
      fallback={panels.find((panel) => panel.result.isFallback)?.result.fallbackMessage ?? null}
      isFallback={panels.some((panel) => panel.result.isFallback)}
      onChartReady={handleChartReady}
      onRefresh={onRefreshRange ? handleRefresh : undefined}
      refreshLabel="按当前频率范围刷新"
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
    ['N', result.nyquist.criterion ? String(result.nyquist.criterion.n) : '--'],
    ['P', result.nyquist.criterion ? String(result.nyquist.criterion.p) : '--'],
    ['Z', result.nyquist.criterion ? String(result.nyquist.criterion.z) : '--'],
    ['ωc', formatFixed(metrics.gainCrossoverRadPerSec, ' rad/s')],
    ['ωg', formatFixed(metrics.phaseCrossoverRadPerSec, ' rad/s')],
    ['闭环稳定性', result.rootLocus.currentPoles.every((pole) => pole.re < 0) ? '稳定' : '不稳定'],
  ];

  return (
    <div className="premium-lesson-tone-block premium-tone-cyan grid gap-3 sm:grid-cols-3 xl:grid-cols-12">
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
