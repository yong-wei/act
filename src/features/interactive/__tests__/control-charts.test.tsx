import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import {
  buildBodeComparisonOption,
  buildBodePanelOption,
  getControlAxisPreset,
} from '@/resources/control-system/charts/control-bode-options';
import {
  buildNyquistOption,
  buildRootLocusOption,
} from '@/resources/control-system/charts/control-analysis-panels';
import { applyControlChartTheme } from '@/resources/control-system/charts/control-chart-theme';

const LOW_FREQUENCY_CASE_ID = 'unit37_low_frequency_bode';
const repoRoot = process.cwd();

const SAMPLE_RESULT: ControlAnalysisResult = {
  metrics: {
    overshootPct: 0,
    riseTimeSec: null,
    settlingTimeSec: null,
    peakTimeSec: null,
    finalValue: 1,
    phaseMarginDeg: null,
    gainMarginDb: null,
    gainCrossoverRadPerSec: null,
    phaseCrossoverRadPerSec: null,
    bandwidthRadPerSec: null,
  },
  stepResponse: { points: [] },
  magnitude: {
    points: [
      { x: 0.01, y: 34 },
      { x: 1, y: 0 },
      { x: 100, y: 0 },
    ],
  },
  phase: {
    points: [
      { x: 0.01, y: -85 },
      { x: 1, y: -30 },
      { x: 100, y: -2 },
    ],
  },
  nyquist: { points: [] },
  rootLocus: {
    branches: [],
    currentPoles: [],
    openLoopPoles: [],
    openLoopZeros: [],
  },
};

const MARGIN_RESULT: ControlAnalysisResult = {
  ...SAMPLE_RESULT,
  metrics: {
    ...SAMPLE_RESULT.metrics,
    phaseMarginDeg: 48,
    gainMarginDb: 12,
    gainCrossoverRadPerSec: 2,
    phaseCrossoverRadPerSec: 8,
  },
  nyquist: {
    mode: 'full',
    points: [{ re: 0, im: 0 }, { re: -1.2, im: 0.3 }],
    positivePoints: [{ re: 0, im: 0 }, { re: -1.2, im: 0.3 }],
    negativePoints: [{ re: -1.2, im: -0.3 }, { re: 0, im: 0 }],
    infinityClosure: {
      points: [{ re: -1.2, im: 0.3 }, { re: -1.2, im: -0.3 }],
      lineStyle: 'dashed',
    },
    keyPoints: [{ kind: 'unit_circle_crossing', point: { re: -0.9, im: 0.1 }, frequency: 2 }],
    asymptotes: [{ end: 'high_frequency', kind: 'zero', angleDeg: -90, point: { re: 0, im: 0 } }],
    encirclements: 0,
  },
  rootLocus: {
    branches: [[{ re: -1, im: 0, gain: 1 }, { re: -2, im: 0, gain: 2 }]],
    currentPoles: [{ re: -1.2, im: 0 }],
    openLoopPoles: [{ re: -1, im: 0 }],
    openLoopZeros: [{ re: -3, im: 0 }],
    realAxisSegments: [{ start: -3, end: -1 }],
    stationaryPoints: [{ re: -1.8, im: 0, gain: 1.7 }],
    imaginaryAxisCrossings: [{ re: 0, im: 1.4, gain: 4 }],
    asymptotes: [{ centroid: -2, angleDeg: 90 }],
  },
};

describe('control chart shared presets and themes', () => {
  it('keeps unit 3-7 low-frequency Bode single and comparison panels on the same axis preset', () => {
    const magnitudePreset = getControlAxisPreset(LOW_FREQUENCY_CASE_ID, 'magnitude');
    const phasePreset = getControlAxisPreset(LOW_FREQUENCY_CASE_ID, 'phase');

    const singleOption = buildBodePanelOption(SAMPLE_RESULT, LOW_FREQUENCY_CASE_ID);
    const comparisonOption = buildBodeComparisonOption(
      [{ label: 'PI', color: '#0ea5e9', result: SAMPLE_RESULT }],
      LOW_FREQUENCY_CASE_ID,
    );

    expect(magnitudePreset).toEqual({ x: [1e-2, 1e2], y: [-30, 40] });
    expect(phasePreset).toEqual({ x: [1e-2, 1e2], y: [-100, 70] });
    expect((singleOption.xAxis as Array<{ min?: number; max?: number }>)[0]).toMatchObject({
      min: 1e-2,
      max: 1e2,
    });
    expect((singleOption.yAxis as Array<{ min?: number; max?: number }>)[0]).toMatchObject({
      min: -30,
      max: 40,
    });
    expect((singleOption.yAxis as Array<{ min?: number; max?: number }>)[1]).toMatchObject({
      min: -100,
      max: 70,
    });
    expect((comparisonOption.xAxis as Array<{ min?: number; max?: number }>)[0]).toMatchObject({
      min: 1e-2,
      max: 1e2,
    });
    expect((comparisonOption.yAxis as Array<{ min?: number; max?: number }>)[0]).toMatchObject({
      min: -30,
      max: 40,
    });
    expect((comparisonOption.yAxis as Array<{ min?: number; max?: number }>)[1]).toMatchObject({
      min: -100,
      max: 70,
    });
  });

  it('applies readable light and dark chart theme tokens to shared legend and axes', () => {
    const baseOption = {
      legend: {},
      xAxis: [{ type: 'value' }],
      yAxis: [{ type: 'value' }],
    };

    const lightOption = applyControlChartTheme(baseOption, 'light');
    const darkOption = applyControlChartTheme(baseOption, 'dark');

    expect((lightOption.legend as { textStyle?: { color?: string } }).textStyle?.color).toBe('rgba(30, 41, 59, 0.9)');
    expect((darkOption.legend as { textStyle?: { color?: string } }).textStyle?.color).toBe('rgba(241, 245, 249, 0.92)');
    expect(((lightOption.xAxis as Array<{ axisLabel?: { color?: string } }>)[0]).axisLabel?.color).toBe('rgba(71, 85, 105, 0.84)');
    expect(((darkOption.xAxis as Array<{ axisLabel?: { color?: string } }>)[0]).axisLabel?.color).toBe('rgba(203, 213, 225, 0.78)');
    expect(((lightOption.yAxis as Array<{ nameTextStyle?: { color?: string } }>)[0]).nameTextStyle?.color).toBe('rgba(30, 41, 59, 0.9)');
    expect(((darkOption.yAxis as Array<{ nameTextStyle?: { color?: string } }>)[0]).nameTextStyle?.color).toBe('rgba(241, 245, 249, 0.92)');
  });

  it('builds linked Bode subplots with margin annotations on a shared frequency range', () => {
    const option = buildBodePanelOption(MARGIN_RESULT, LOW_FREQUENCY_CASE_ID);
    const xAxes = option.xAxis as Array<{ min?: number; max?: number }>;
    const series = option.series as Array<{ name?: string; label?: { formatter?: string }; data?: unknown[] }>;

    expect(option.axisPointer).toEqual({ link: [{ xAxisIndex: [0, 1] }] });
    expect(xAxes[0]).toMatchObject({ min: 1e-2, max: 1e2 });
    expect(xAxes[1]).toMatchObject({ min: 1e-2, max: 1e2 });
    expect(series.some((item) => item.name === 'ωc 截止频率' && item.label?.formatter?.includes('ωc'))).toBe(true);
    expect(series.some((item) => item.name === 'PM 相角裕度' && item.label?.formatter?.includes('PM'))).toBe(true);
    expect(series.some((item) => item.name === 'ωg 穿越频率' && item.label?.formatter?.includes('GM'))).toBe(true);
  });

  it('does not draw an invalid gain-margin point when GM is infinite', () => {
    const option = buildBodePanelOption({
      ...MARGIN_RESULT,
      metrics: { ...MARGIN_RESULT.metrics, gainMarginDb: Number.POSITIVE_INFINITY },
    });
    const series = option.series as Array<{ name?: string; data?: unknown[]; label?: { formatter?: string } }>;

    expect(series.some((item) => item.name === 'ωg 穿越频率' && item.data?.some((value) => {
      const point = value as number[];
      return !Number.isFinite(point[1]);
    }))).toBe(false);
    expect(series.some((item) => item.label?.formatter === 'GM ∞')).toBe(true);
  });

  it('renders root-locus analysis metadata from the shared Rust result', () => {
    const option = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'full');
    const series = option.series as Array<{
      name?: string;
      lineStyle?: { type?: string; color?: string };
      itemStyle?: { color?: string };
      data?: unknown[];
    }>;
    const legend = option.legend as { data?: Array<string | { name?: string; icon?: string }> };
    const legendItems = legend.data ?? [];

    expect(series.some((item) => item.name === '实轴根轨迹段')).toBe(false);
    expect(series.filter((item) => item.name === '根轨迹').length).toBeGreaterThan(1);
    expect(series.some((item) => item.name === '根轨迹渐近线')).toBe(true);
    expect(series.some((item) => item.name === '根轨迹渐近线' && item.lineStyle?.type === 'dashed')).toBe(true);
    expect(series.some((item) => item.name === '分离/会合点')).toBe(true);
    expect(series.some((item) => item.name === '虚轴交点')).toBe(true);
    expect(series[series.length - 1]?.name).toBe('当前闭环极点');
    expect(series.find((item) => item.name === '当前闭环极点')?.itemStyle?.color).toBe('#2563eb');
    expect(series.find((item) => item.name === '根轨迹')?.lineStyle?.color).toBe('#2563eb');
    expect(series.find((item) => item.name === '虚轴交点')?.itemStyle?.color).not.toBe('#2563eb');
    expect(legendItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '根轨迹', icon: expect.stringContaining('path://') }),
        expect.objectContaining({ name: '根轨迹渐近线', icon: expect.stringContaining('path://') }),
        expect.objectContaining({ name: '当前闭环极点', icon: 'circle' }),
      ]),
    );
    expect(legendItems).not.toContain('实轴根轨迹段');
  });

  it('applies distinct light and dark root-locus line and text colors', () => {
    const baseOption = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'full');
    const lightOption = applyControlChartTheme(baseOption, 'light');
    const darkOption = applyControlChartTheme(baseOption, 'dark');
    const lightSeries = lightOption.series as Array<{ name?: string; lineStyle?: { color?: string }; itemStyle?: { color?: string } }>;
    const darkSeries = darkOption.series as Array<{ name?: string; lineStyle?: { color?: string }; itemStyle?: { color?: string } }>;
    const lightLegend = lightOption.legend as { textStyle?: { color?: string } };
    const darkLegend = darkOption.legend as { textStyle?: { color?: string } };

    expect(lightSeries.find((item) => item.name === '根轨迹')?.lineStyle?.color).toBe('#2563eb');
    expect(darkSeries.find((item) => item.name === '根轨迹')?.lineStyle?.color).toBe('#38bdf8');
    expect(lightSeries.find((item) => item.name === '当前闭环极点')?.itemStyle?.color).toBe('#2563eb');
    expect(darkSeries.find((item) => item.name === '当前闭环极点')?.itemStyle?.color).toBe('#38bdf8');
    expect(lightLegend.textStyle?.color).toBe('rgba(30, 41, 59, 0.9)');
    expect(darkLegend.textStyle?.color).toBe('rgba(241, 245, 249, 0.92)');
  });

  it('renders full Nyquist branches, key points, axes, critical point, and asymptotes', () => {
    const option = buildNyquistOption(MARGIN_RESULT);
    const series = option.series as Array<{ name?: string; lineStyle?: { type?: string }; label?: { formatter?: string } }>;
    const dataZoom = option.dataZoom as Array<{ type?: string; xAxisIndex?: number; yAxisIndex?: number; zoomOnMouseWheel?: boolean; moveOnMouseMove?: boolean }>;

    expect(series.some((item) => item.name === '实轴')).toBe(true);
    expect(series.some((item) => item.name === '虚轴')).toBe(true);
    expect(series.some((item) => item.name === 'Nyquist 正频率支')).toBe(true);
    expect(series.some((item) => item.name === 'Nyquist 负频率支')).toBe(true);
    expect(series.some((item) => item.name === '无穷远闭合段' && item.lineStyle?.type !== 'dashed')).toBe(true);
    expect(series.some((item) => item.name === 'Nyquist 关键点')).toBe(true);
    expect(series.some((item) => item.name === 'Nyquist 渐近方向' && item.lineStyle?.type === 'dashed')).toBe(true);
    expect(series.some((item) => item.name === '-1+j0' && item.label?.formatter === '-1+j0')).toBe(true);
    expect(dataZoom).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'inside', xAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: true }),
        expect.objectContaining({ type: 'inside', yAxisIndex: 0, zoomOnMouseWheel: true, moveOnMouseMove: true }),
      ]),
    );
  });

  it('synthesizes a Nyquist closure segment when the engine only returns positive and negative branches', () => {
    const option = buildNyquistOption({
      ...MARGIN_RESULT,
      nyquist: {
        ...MARGIN_RESULT.nyquist,
        infinityClosure: undefined,
      },
    });
    const closure = (option.series as Array<{ name?: string; data?: unknown[] }>).find(
      (item) => item.name === '无穷远闭合段',
    );

    expect(closure?.data).toEqual([
      [-1.2, 0.3],
      [-1.2, -0.3],
    ]);
  });

  it('prefers an explicit Nyquist closure segment over endpoint synthesis', () => {
    const option = buildNyquistOption({
      ...MARGIN_RESULT,
      nyquist: {
        ...MARGIN_RESULT.nyquist,
        positivePoints: [{ re: 1, im: 0 }, { re: -2, im: 0.8 }],
        negativePoints: [{ re: -2, im: -0.8 }, { re: 0.8, im: 0 }],
        infinityClosure: {
          points: [{ re: -2, im: 0.8 }, { re: -2.4, im: 0 }, { re: -2, im: -0.8 }],
          lineStyle: 'dashed',
        },
      },
    });
    const closure = (option.series as Array<{ name?: string; data?: unknown[] }>).find(
      (item) => item.name === '无穷远闭合段',
    );

    expect(closure?.data).toEqual([
      [-2, 0.8],
      [-2.4, 0],
      [-2, -0.8],
    ]);
  });

  it('routes closed-loop pole dragging through overlay handles instead of chart panning', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('closed-loop-pole-${index}');
    expect(panelSource).toContain('startClosedLoopPoleDrag');
    expect(panelSource).not.toContain("chart.on('mousedown'");
  });

  it('uses module-header title sizing for shared Rust-driven figure panels', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-chart-panel.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('premium-lesson-title text-base font-semibold leading-7 tracking-normal');
    expect(panelSource).not.toContain('premium-lesson-title text-lg font-semibold">{title}');
    expect(panelSource).not.toContain('premium-lesson-title text-sm font-semibold">{title}');
  });
});
