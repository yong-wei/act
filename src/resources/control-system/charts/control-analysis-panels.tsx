'use client';

import type { ReactNode } from 'react';
import type { EChartsCoreOption } from 'echarts/core';

import type { ControlAnalysisResult, CurvePoint, RootLocusData } from '../analysis/types';
import { ControlChartPanel } from './control-chart-panel';

type ChartSeriesValue = NonNullable<EChartsCoreOption['series']>;
type ChartSeriesItem = ChartSeriesValue extends (infer Item)[] ? Item : ChartSeriesValue;
type ChartSeriesArray = ChartSeriesItem[];

function toSeriesArray(series?: EChartsCoreOption['series']): ChartSeriesArray {
  if (!series) {
    return [];
  }
  return Array.isArray(series) ? [...series] as ChartSeriesArray : [series as ChartSeriesItem];
}

function buildLineOption(
  points: CurvePoint[],
  color: string,
  xAxisName: string,
  yAxisName: string,
  opts?: {
    xAxisType?: 'value' | 'log';
    yAxisMin?: number | 'dataMin';
    yAxisMax?: number | 'dataMax';
    extraSeries?: ChartSeriesArray;
  },
): EChartsCoreOption {
  return {
    animation: false,
    grid: { top: 18, right: 18, bottom: 42, left: 52 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: opts?.xAxisType ?? 'value',
      name: xAxisName,
      nameLocation: 'middle',
      nameGap: 30,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      name: yAxisName,
      nameLocation: 'middle',
      nameGap: 42,
      min: opts?.yAxisMin,
      max: opts?.yAxisMax,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: [
      {
        type: 'line',
        showSymbol: false,
        smooth: false,
        lineStyle: { color, width: 2.5 },
        data: points.map((point) => [point.x, point.y]),
      },
      ...toSeriesArray(opts?.extraSeries),
    ],
  };
}

function buildRootLocusOption(rootLocus: RootLocusData): EChartsCoreOption {
  const series: ChartSeriesArray = rootLocus.branches.map((branch) => ({
    type: 'line',
    showSymbol: false,
    lineStyle: { color: '#38bdf8', width: 1.8 },
    data: branch.map((point) => [point.re, point.im]),
  }));

  series.push(
    {
      type: 'scatter',
      symbol: 'circle',
      symbolSize: 8,
      itemStyle: { color: '#fb923c' },
      data: rootLocus.currentPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      type: 'scatter',
      symbol: 'diamond',
      symbolSize: 10,
      itemStyle: { color: '#f87171' },
      data: rootLocus.openLoopPoles.map((pole) => [pole.re, pole.im]),
    },
    {
      type: 'scatter',
      symbol: 'rect',
      symbolSize: 10,
      itemStyle: { color: '#facc15' },
      data: rootLocus.openLoopZeros.map((zero) => [zero.re, zero.im]),
    },
  );

  const markLineData =
    rootLocus.feasibleRegion?.sigmaMin != null
      ? [{ xAxis: -rootLocus.feasibleRegion.sigmaMin }]
      : [];

  return {
    animation: false,
    grid: { top: 18, right: 18, bottom: 42, left: 52 },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'value',
      name: 'Re(s)',
      nameLocation: 'middle',
      nameGap: 28,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      name: 'Im(s)',
      nameLocation: 'middle',
      nameGap: 36,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: series.map((item, index) =>
      index === 0 && markLineData.length
        ? {
            ...item,
            markLine: {
              symbol: 'none',
              lineStyle: { color: '#22c55e', type: 'dashed' },
              data: markLineData,
            },
          }
        : item,
    ),
  };
}

function buildNyquistOption(result: ControlAnalysisResult): EChartsCoreOption {
  return {
    animation: false,
    grid: { top: 18, right: 18, bottom: 42, left: 52 },
    tooltip: { trigger: 'item' },
    xAxis: {
      type: 'value',
      name: 'Re',
      nameLocation: 'middle',
      nameGap: 28,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    yAxis: {
      type: 'value',
      name: 'Im',
      nameLocation: 'middle',
      nameGap: 36,
      splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
    },
    series: [
      {
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#22d3ee', width: 2.5 },
        data: result.nyquist.points.map((point) => [point.re, point.im]),
      },
      {
        type: 'scatter',
        symbolSize: 10,
        itemStyle: { color: '#ef4444' },
        data: [[-1, 0]],
      },
    ],
  };
}

function buildBodePanelOption(result: ControlAnalysisResult): EChartsCoreOption {
  return {
    animation: false,
    tooltip: { trigger: 'axis' },
    grid: [
      { top: 18, right: 18, bottom: '56%', left: 56 },
      { top: '58%', right: 18, bottom: 42, left: 56 },
    ],
    xAxis: [
      {
        type: 'log',
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'log',
        gridIndex: 1,
        name: 'ω / rad/s',
        nameLocation: 'middle',
        nameGap: 28,
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: '幅值 / dB',
        nameLocation: 'middle',
        nameGap: 38,
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
      {
        type: 'value',
        gridIndex: 1,
        name: '相位 / deg',
        nameLocation: 'middle',
        nameGap: 42,
        splitLine: { lineStyle: { color: 'rgba(148, 163, 184, 0.12)' } },
      },
    ],
    series: [
      {
        type: 'line',
        showSymbol: false,
        lineStyle: { color: '#a78bfa', width: 2.5 },
        data: result.magnitude.points.map((point) => [point.x, point.y]),
      },
      {
        type: 'line',
        xAxisIndex: 1,
        yAxisIndex: 1,
        showSymbol: false,
        lineStyle: { color: '#fb7185', width: 2.5 },
        data: result.phase.points.map((point) => [point.x, point.y]),
      },
    ],
  };
}

function fallbackNode(result: ControlAnalysisResult): ReactNode {
  return result.isFallback ? result.fallbackMessage ?? '当前显示离线基线结果。' : null;
}

export function StepResponsePanel({ result }: { result: ControlAnalysisResult }) {
  const option = buildLineOption(result.stepResponse.points, '#22d3ee', '时间 / s', '响应');
  return (
    <ControlChartPanel
      title="闭环时域响应"
      subtitle="统一计算引擎输出的阶跃响应。"
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function MagnitudePanel({ result }: { result: ControlAnalysisResult }) {
  const option = buildLineOption(result.magnitude.points, '#a78bfa', 'ω / rad/s', '幅值 / dB', {
    xAxisType: 'log',
  });
  return (
    <ControlChartPanel
      title="开环幅频特性"
      subtitle="Bode 幅频曲线。"
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function PhasePanel({ result }: { result: ControlAnalysisResult }) {
  const option = buildLineOption(result.phase.points, '#fb7185', 'ω / rad/s', '相位 / deg', {
    xAxisType: 'log',
  });
  return (
    <ControlChartPanel
      title="开环相频特性"
      subtitle="Bode 相频曲线与裕度读数基础。"
      option={option}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function NyquistPanel({ result }: { result: ControlAnalysisResult }) {
  return (
    <ControlChartPanel
      title="Nyquist 图"
      subtitle="统一分析内核输出的复平面轨迹。"
      option={buildNyquistOption(result)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function RootLocusPanel({ result }: { result: ControlAnalysisResult }) {
  return (
    <ControlChartPanel
      title="根轨迹"
      subtitle="当前闭环极点与可行域边界。"
      option={buildRootLocusOption(result.rootLocus)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}

export function BodePanel({ result }: { result: ControlAnalysisResult }) {
  return (
    <ControlChartPanel
      title="组合 Bode 图"
      subtitle="上幅频、下相频，保持 MATLAB 式阅读顺序。"
      option={buildBodePanelOption(result)}
      fallback={fallbackNode(result)}
      isFallback={Boolean(result.isFallback)}
    />
  );
}
