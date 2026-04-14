'use client';

import type { ReactNode } from 'react';
import type { EChartsCoreOption } from 'echarts/core';

import type {
  ComplexPoint,
  ControlAnalysisResult,
  ControlMetrics,
  CurvePoint,
  RootLocusData,
} from '../analysis/types';
import { ControlChartPanel } from './control-chart-panel';

type ChartSeriesValue = NonNullable<EChartsCoreOption['series']>;
type ChartSeriesItem = ChartSeriesValue extends (infer Item)[] ? Item : ChartSeriesValue;
type ChartSeriesArray = ChartSeriesItem[];
type ControlCaseId = 'ship_heading' | 'platform_pitch';
type AxisKey = 'step' | 'magnitude' | 'phase' | 'rootLocus' | 'nyquist';

interface AxisPreset {
  x: [number, number];
  y: [number, number];
}

const CONTROL_AXIS_PRESETS: Record<ControlCaseId, Record<AxisKey, AxisPreset>> = {
  ship_heading: {
    step: { x: [0, 160], y: [0, 1.4] },
    magnitude: { x: [1e-3, 10], y: [-90, 50] },
    phase: { x: [1e-3, 10], y: [-270, -90] },
    rootLocus: { x: [-3.2, 0.4], y: [-0.8, 0.8] },
    nyquist: { x: [-1.6, 1.2], y: [-1.6, 1.6] },
  },
  platform_pitch: {
    step: { x: [0, 2], y: [0, 1.4] },
    magnitude: { x: [1e-1, 1e4], y: [-150, 70] },
    phase: { x: [1e-1, 1e4], y: [-360, -90] },
    rootLocus: { x: [-140, 5], y: [-80, 80] },
    nyquist: { x: [-1.6, 1.2], y: [-1.6, 1.6] },
  },
};

function toSeriesArray(series?: EChartsCoreOption['series']): ChartSeriesArray {
  if (!series) {
    return [];
  }
  return Array.isArray(series) ? [...series] as ChartSeriesArray : [series as ChartSeriesItem];
}

function getAxisPreset(caseId: string | undefined, axisKey: AxisKey): AxisPreset | undefined {
  if (caseId === 'ship_heading' || caseId === 'platform_pitch') {
    return CONTROL_AXIS_PRESETS[caseId][axisKey];
  }
  return undefined;
}

function formatFixed(value: number | null | undefined, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) {
    return '--';
  }
  return `${value.toFixed(2)}${suffix}`;
}

function formatAxisValue(value: number): string {
  const absolute = Math.abs(value);
  if ((absolute > 0 && absolute < 0.01) || absolute >= 1000) {
    return value.toExponential(2);
  }
  return value.toFixed(2);
}

function formatComplex(point: ComplexPoint): string {
  const imagAbs = Math.abs(point.im);
  const imag = `${point.im >= 0 ? '+' : '-'}j${imagAbs.toFixed(2)}`;
  return `${point.re.toFixed(2)}${imag}`;
}

function axisTooltipFormatter(params: unknown): string {
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

function buildMarginSeries(metrics: ControlMetrics, mode: 'magnitude' | 'phase'): ChartSeriesArray {
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
            symbolSize: 10,
            itemStyle: { color: '#22d3ee' },
            data: [[gainCross, 0]],
          } satisfies ChartSeriesItem]
        : []),
      ...(phaseCross != null && gainMargin != null
        ? [{
            name: '增益裕度交越',
            type: 'scatter',
            symbolSize: 10,
            itemStyle: { color: '#f97316' },
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
          symbolSize: 10,
          itemStyle: { color: '#22d3ee' },
          data: [[gainCross, phaseMargin - 180]],
        } satisfies ChartSeriesItem]
      : []),
    ...(phaseCross != null
      ? [{
          name: '增益裕度交越',
          type: 'scatter',
          symbolSize: 10,
          itemStyle: { color: '#f97316' },
          data: [[phaseCross, -180]],
        } satisfies ChartSeriesItem]
      : []),
  ];
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
  const xLimit = Math.max(xMin, -yMax / tangent);
  const yLimit = Math.min(yMax, Math.abs(xLimit) * tangent);

  return [
    {
      name: '可行域参考',
      type: 'line',
      showSymbol: false,
      lineStyle: { opacity: 0 },
      data: [],
      markArea: {
        itemStyle: { color: 'rgba(34, 197, 94, 0.08)' },
        data: [[
          { xAxis: xMin, yAxis: yMin },
          { xAxis: sigmaBoundary, yAxis: yMax },
        ]],
      },
    },
    {
      name: 'σ 边界',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#22c55e', type: 'dashed', width: 1.3 },
      data: [[sigmaBoundary, yMin], [sigmaBoundary, yMax]],
    },
    {
      name: 'ζ 边界',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#10b981', type: 'dotted', width: 1.3 },
      data: [[0, 0], [xLimit, yLimit]],
    },
    {
      name: '',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#10b981', type: 'dotted', width: 1.3 },
      data: [[0, 0], [xLimit, -yLimit]],
    },
  ];
}

function buildRootLocusOption(rootLocus: RootLocusData, caseId?: string): EChartsCoreOption {
  const axisPreset = getAxisPreset(caseId, 'rootLocus');
  const series: ChartSeriesArray = [
    ...buildFeasibleRegionSeries(rootLocus, axisPreset),
    ...rootLocus.branches.map((branch, index) => ({
      name: index === 0 ? '根轨迹' : '',
      type: 'line',
      showSymbol: false,
      lineStyle: { color: '#38bdf8', width: 1.8 },
      data: branch.map((point) => [point.re, point.im]),
    })),
    {
      name: '当前闭环极点',
      type: 'scatter',
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { color: '#fb923c' },
      data: rootLocus.currentPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      name: '开环极点',
      type: 'scatter',
      symbol: 'diamond',
      symbolSize: 10,
      itemStyle: { color: '#f87171' },
      data: rootLocus.openLoopPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      name: '开环零点',
      type: 'scatter',
      symbol: 'rect',
      symbolSize: 10,
      itemStyle: { color: '#facc15' },
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
      data: ['可行域参考', 'σ 边界', 'ζ 边界', '根轨迹', '当前闭环极点', '开环极点', '开环零点'],
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
  const axisPreset = getAxisPreset(caseId, 'nyquist');
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

function buildBodePanelOption(result: ControlAnalysisResult, caseId?: string): EChartsCoreOption {
  const magnitudeAxis = getAxisPreset(caseId, 'magnitude');
  const phaseAxis = getAxisPreset(caseId, 'phase');
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

function fallbackNode(result: ControlAnalysisResult): ReactNode {
  return result.isFallback ? result.fallbackMessage ?? '当前显示离线基线结果。' : null;
}

export function StepResponsePanel({ result, caseId }: { result: ControlAnalysisResult; caseId?: string }) {
  const option = buildLineOption(result.stepResponse.points, '#22d3ee', '时间 / s', '响应', {
    axisPreset: getAxisPreset(caseId, 'step'),
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
    axisPreset: getAxisPreset(caseId, 'magnitude'),
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
    axisPreset: getAxisPreset(caseId, 'phase'),
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

export function RootLocusPanel({ result, caseId }: { result: ControlAnalysisResult; caseId?: string }) {
  return (
    <ControlChartPanel
      title="根轨迹"
      meta={buildPoleText(result.rootLocus.currentPoles)}
      option={buildRootLocusOption(result.rootLocus, caseId)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
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
