import type { EChartsCoreOption } from 'echarts/core';

import { getInteractiveSvgEChartsPointMarker } from '@/features/interactive/shared/interactive-svg-markers';
import type { ControlAnalysisResult, ControlMetrics } from '../analysis/types';

type ChartSeriesValue = NonNullable<EChartsCoreOption['series']>;
type ChartSeriesItem = ChartSeriesValue extends (infer Item)[] ? Item : ChartSeriesValue;
type ChartSeriesArray = ChartSeriesItem[];

export type AxisKey = 'step' | 'magnitude' | 'phase' | 'rootLocus' | 'rootLocusFull' | 'rootLocusZoom' | 'nyquist';
export type RootLocusMode = 'default' | 'full' | 'zoom';

export interface AxisPreset {
  x: [number, number];
  y: [number, number];
}

export const UNIT_37_LOW_FREQUENCY_BODE_CASE_ID = 'unit37_low_frequency_bode';

const CONTROL_AXIS_PRESETS: Record<string, Partial<Record<AxisKey, AxisPreset>>> = {
  ship_heading: {
    step: { x: [0, 160], y: [0, 1.4] },
    magnitude: { x: [1e-3, 10], y: [-90, 50] },
    phase: { x: [1e-3, 10], y: [-270, -90] },
    rootLocus: { x: [-3.2, 0.4], y: [-0.8, 0.8] },
    rootLocusFull: { x: [-3.2, 0.4], y: [-0.8, 0.8] },
    rootLocusZoom: { x: [-3.2, 0.4], y: [-0.8, 0.8] },
    nyquist: { x: [-1.6, 1.2], y: [-1.6, 1.6] },
  },
  platform_pitch: {
    step: { x: [0, 2], y: [0, 1.4] },
    magnitude: { x: [1e-1, 1e4], y: [-150, 70] },
    phase: { x: [1e-1, 1e4], y: [-360, -90] },
    rootLocus: { x: [-140, 4], y: [-80, 80] },
    rootLocusFull: { x: [-1100, 50], y: [-80, 80] },
    rootLocusZoom: { x: [-140, 4], y: [-80, 80] },
    nyquist: { x: [-1.6, 1.2], y: [-1.6, 1.6] },
  },
  unit35_step04: {
    rootLocus: { x: [-4.5, 0.5], y: [-2.4, 2.4] },
    rootLocusFull: { x: [-4.5, 0.5], y: [-2.4, 2.4] },
    rootLocusZoom: { x: [-4.5, 0.5], y: [-2.4, 2.4] },
  },
  unit35_step05: {
    rootLocus: { x: [-4.8, 0.5], y: [-3.2, 3.2] },
    rootLocusFull: { x: [-4.8, 0.5], y: [-3.2, 3.2] },
    rootLocusZoom: { x: [-4.8, 0.5], y: [-3.2, 3.2] },
  },
  'unit-3-3-step-05-condition-workspace': {
    rootLocus: { x: [-8, 1], y: [-2.6, 2.6] },
    rootLocusFull: { x: [-8, 1], y: [-2.6, 2.6] },
    rootLocusZoom: { x: [-8, 1], y: [-2.6, 2.6] },
  },
  'unit-3-3-step-06-skeleton-workspace': {
    rootLocus: { x: [-8, 1], y: [-5.5, 5.5] },
    rootLocusFull: { x: [-8, 1], y: [-5.5, 5.5] },
    rootLocusZoom: { x: [-8, 1], y: [-5.5, 5.5] },
  },
  unit31_triple_pole_explorer: {
    step: { x: [0, 8], y: [0, 1.45] },
    magnitude: { x: [1e-1, 1e2], y: [-55, 10] },
    phase: { x: [1e-1, 1e2], y: [-260, 20] },
    rootLocus: { x: [-7, 0.6], y: [-2.8, 2.8] },
    rootLocusFull: { x: [-7, 0.6], y: [-2.8, 2.8] },
    rootLocusZoom: { x: [-7, 0.6], y: [-2.8, 2.8] },
  },
  unit31_reference_model: {
    step: { x: [0, 8], y: [0, 1.45] },
    magnitude: { x: [1e-1, 1e2], y: [-55, 10] },
    phase: { x: [1e-1, 1e2], y: [-260, 20] },
    rootLocus: { x: [-3.2, 0.6], y: [-2.8, 2.8] },
    rootLocusFull: { x: [-3.2, 0.6], y: [-2.8, 2.8] },
    rootLocusZoom: { x: [-3.2, 0.6], y: [-2.8, 2.8] },
  },
  [UNIT_37_LOW_FREQUENCY_BODE_CASE_ID]: {
    magnitude: { x: [1e-2, 1e2], y: [-30, 40] },
    phase: { x: [1e-2, 1e2], y: [-100, 70] },
  },
  unit43_roll_boundary: {
    step: { x: [0, 40], y: [-0.2, 1.2] },
    magnitude: { x: [1e-2, 1e2], y: [-10, 20] },
    phase: { x: [1e-2, 1e2], y: [-240, 30] },
    rootLocus: { x: [-1.2, 0.2], y: [-1.2, 1.2] },
    rootLocusFull: { x: [-6, 0.5], y: [-4.5, 4.5] },
    rootLocusZoom: { x: [-1.2, 0.2], y: [-1.2, 1.2] },
    nyquist: { x: [-1.8, 1.4], y: [-1.8, 1.8] },
  },
};

export function getControlAxisPreset(caseId: string | undefined, axisKey: AxisKey): AxisPreset | undefined {
  return caseId ? CONTROL_AXIS_PRESETS[caseId]?.[axisKey] : undefined;
}

export function getRootLocusAxisKey(mode: RootLocusMode): AxisKey {
  if (mode === 'full') {
    return 'rootLocusFull';
  }
  if (mode === 'zoom') {
    return 'rootLocusZoom';
  }
  return 'rootLocus';
}

function formatFixed(value: number | null | undefined, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }
  return `${value.toFixed(2)}${suffix}`;
}

export function formatAxisValue(value: number): string {
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.01) || absolute >= 1000) {
    return value.toExponential(2);
  }
  return value.toFixed(2);
}

export function axisTooltipFormatter(params: unknown): string {
  const rows = Array.isArray(params) ? params : [params];
  const items = rows as Array<{
    axisValue?: number | string;
    marker?: string;
    seriesName?: string;
    value?: number[] | string | number;
  }>;
  const axisValue = items[0]?.axisValue;
  const header = axisValue == null || !Number.isFinite(Number(axisValue))
    ? ''
    : formatAxisValue(Number(axisValue));
  const body = items
    .map((item) => {
      const rawValue = Array.isArray(item.value) ? item.value[item.value.length - 1] : item.value;
      const numberValue = typeof rawValue === 'number' ? rawValue : Number(rawValue);
      return `${item.marker ?? ''}${item.seriesName ?? ''} ${formatFixed(numberValue)}`;
    })
    .join('<br/>');
  return header ? `${header}<br/>${body}` : body;
}

export function buildMarginSeries(metrics: ControlMetrics, mode: 'magnitude' | 'phase'): ChartSeriesArray {
  const gainCross = metrics.gainCrossoverRadPerSec;
  const phaseCross = metrics.phaseCrossoverRadPerSec;
  const phaseMargin = metrics.phaseMarginDeg;
  const gainMargin = metrics.gainMarginDb;

  if (mode === 'magnitude') {
    return [
      {
        name: '0 dB',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: 'rgba(148, 163, 184, 0.6)', type: 'dashed', width: 1.2 },
        data: [],
        markLine: {
          symbol: 'none',
          label: { formatter: '0 dB' },
          lineStyle: { color: 'rgba(148, 163, 184, 0.6)', type: 'dashed' },
          data: [{ yAxis: 0 }],
        },
      },
      ...(gainCross != null
        ? [{
            name: '相角裕度交越',
            type: 'scatter',
            ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
              size: 10,
              color: '#22d3ee',
            }),
            data: [[gainCross, 0]],
          } satisfies ChartSeriesItem]
        : []),
      ...(phaseCross != null && gainMargin != null
        ? [{
            name: '增益裕度交越',
            type: 'scatter',
            ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
              size: 10,
              color: '#f97316',
            }),
            data: [[phaseCross, -gainMargin]],
          } satisfies ChartSeriesItem]
        : []),
    ];
  }

  return [
    {
      name: '-180°',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: 'rgba(148, 163, 184, 0.6)', type: 'dashed', width: 1.2 },
      data: [],
      markLine: {
        symbol: 'none',
        label: { formatter: '-180°' },
        lineStyle: { color: 'rgba(148, 163, 184, 0.6)', type: 'dashed' },
        data: [{ yAxis: -180 }],
      },
    },
    ...(gainCross != null && phaseMargin != null
      ? [{
          name: '相角裕度交越',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
            size: 10,
            color: '#22d3ee',
          }),
          data: [[gainCross, phaseMargin - 180]],
        } satisfies ChartSeriesItem]
      : []),
    ...(phaseCross != null
      ? [{
          name: '增益裕度交越',
          type: 'scatter',
          ...getInteractiveSvgEChartsPointMarker('diamond-filled', {
            size: 10,
            color: '#f97316',
          }),
          data: [[phaseCross, -180]],
        } satisfies ChartSeriesItem]
      : []),
  ];
}

export function buildBodePanelOption(result: ControlAnalysisResult, caseId?: string): EChartsCoreOption {
  const magnitudeAxis = getControlAxisPreset(caseId, 'magnitude');
  const phaseAxis = getControlAxisPreset(caseId, 'phase');
  const magnitudeMarginSeries = buildMarginSeries(result.metrics, 'magnitude');
  const phaseMarginSeries = buildMarginSeries(result.metrics, 'phase');

  return {
    animation: false,
    tooltip: {
      trigger: 'axis',
      formatter: axisTooltipFormatter,
    },
    grid: [
      { top: 18, right: 18, bottom: '56%', left: 62 },
      { top: '58%', right: 18, bottom: 42, left: 62 },
    ],
    xAxis: [
      {
        type: 'log',
        min: magnitudeAxis?.x[0],
        max: magnitudeAxis?.x[1],
        axisLabel: {
          formatter: formatAxisValue,
        },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'log',
        min: phaseAxis?.x[0],
        max: phaseAxis?.x[1],
        gridIndex: 1,
        name: 'ω / rad/s',
        nameLocation: 'middle',
        nameGap: 28,
        axisLabel: {
          formatter: formatAxisValue,
        },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        min: magnitudeAxis?.y[0],
        max: magnitudeAxis?.y[1],
        name: '幅值 / dB',
        nameLocation: 'middle',
        nameGap: 40,
        axisLabel: {
          formatter: formatAxisValue,
        },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'value',
        min: phaseAxis?.y[0],
        max: phaseAxis?.y[1],
        gridIndex: 1,
        name: '相位 / deg',
        nameLocation: 'middle',
        nameGap: 44,
        axisLabel: {
          formatter: formatAxisValue,
        },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    series: [
      {
        name: '幅频',
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#a78bfa', width: 2.5 },
        data: result.magnitude.points.map((point) => [point.x, point.y]),
      },
      ...magnitudeMarginSeries,
      {
        name: '相频',
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { color: '#fb7185', width: 2.5 },
        data: result.phase.points.map((point) => [point.x, point.y]),
      },
      ...phaseMarginSeries.map((series) => ({
        ...series,
        xAxisIndex: 1,
        yAxisIndex: 1,
      })),
    ],
  };
}

export function buildBodeComparisonOption(
  panels: Array<{
    label: string;
    color: string;
    result: ControlAnalysisResult;
  }>,
  caseId?: string,
): EChartsCoreOption {
  const magnitudeAxis = getControlAxisPreset(caseId, 'magnitude');
  const phaseAxis = getControlAxisPreset(caseId, 'phase');

  return {
    color: panels.map((panel) => panel.color),
    animation: false,
    legend: {
      top: 8,
      data: panels.map((panel) => panel.label),
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: axisTooltipFormatter,
    },
    axisPointer: {
      link: [{ xAxisIndex: [0, 1] }],
    },
    grid: [
      { left: 56, right: 24, top: 52, height: '32%' },
      { left: 56, right: 24, top: '60%', height: '24%' },
    ],
    xAxis: [
      {
        type: 'log',
        min: magnitudeAxis?.x[0],
        max: magnitudeAxis?.x[1],
        gridIndex: 0,
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'log',
        min: phaseAxis?.x[0],
        max: phaseAxis?.x[1],
        gridIndex: 1,
        name: 'ω / rad/s',
        nameLocation: 'middle',
        nameGap: 34,
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        gridIndex: 0,
        name: '幅值 / dB',
        min: magnitudeAxis?.y[0],
        max: magnitudeAxis?.y[1],
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: '相位 / deg',
        min: phaseAxis?.y[0],
        max: phaseAxis?.y[1],
        axisLabel: { formatter: formatAxisValue },
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    series: panels.flatMap((panel) => [
      {
        name: panel.label,
        type: 'line',
        showSymbol: false,
        xAxisIndex: 0,
        yAxisIndex: 0,
        lineStyle: { width: 2.2, color: panel.color },
        data: panel.result.magnitude.points.map((point) => [point.x, point.y]),
      },
      {
        name: panel.label,
        type: 'line',
        showSymbol: false,
        xAxisIndex: 1,
        yAxisIndex: 1,
        lineStyle: { width: 2.2, type: 'dashed', color: panel.color },
        data: panel.result.phase.points.map((point) => [point.x, point.y]),
      },
    ]),
  };
}
