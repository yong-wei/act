import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '@/components/providers/theme-provider';
import type { ControlAnalysisRequest, ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import {
  buildBodeComparisonOption,
  buildBodePanelOption,
  CONTROL_CHART_KEY_POINT_MARKER_SIZE,
  getControlAxisPreset,
} from '@/resources/control-system/charts/control-bode-options';
import {
  buildBodeTurnFrequencySeries,
  buildMagnitudeOption,
  buildTimeDomainComparisonOption,
  buildLineOption,
  buildNyquistOption,
  buildPhaseOption,
  BodePanel,
  buildRootLocusOption,
  ControlPerformanceBar,
  CONTROL_SIGNAL_CURVE_STYLES,
  calculateStableResponseAxisPreset,
  calculateTimeDomainVisibleAxisPreset,
  calculateCartesianDragRange,
  calculateEqualAspectCartesianRange,
  formatFrequencyResponseReading,
  NyquistPanel,
} from '@/resources/control-system/charts/control-analysis-panels';
import { applyControlChartTheme } from '@/resources/control-system/charts/control-chart-theme';
import { ControlFigureWorkspace } from '@/resources/control-system/charts/control-figure-workspace';

const mockedControlEngineState = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));
vi.mock('@/resources/control-system/analysis/use-control-engine', () => ({
  useControlEngine: () => mockedControlEngineState.current,
}));

const LOW_FREQUENCY_CASE_ID = 'unit37_low_frequency_bode';
const repoRoot = process.cwd();

type ChartSeriesLike = {
  name?: string;
  type?: string;
  data?: unknown[];
  lineStyle?: { color?: string; type?: string; width?: number };
  itemStyle?: { color?: string; borderColor?: string; borderWidth?: number };
  label?: { formatter?: string };
  symbol?: string;
  symbolSize?: number;
  xAxisIndex?: number;
  yAxisIndex?: number;
  z?: number;
  silent?: boolean;
};

function getTooltipFormatter(option: unknown): unknown {
  return (option as { tooltip?: { formatter?: unknown } }).tooltip?.formatter;
}

function getChartSeries(option: unknown): ChartSeriesLike[] {
  return ((option as { series?: unknown }).series ?? []) as ChartSeriesLike[];
}

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
    phaseCrossoverStatus: 'notObservedInFrequencyRange',
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
    phaseCrossoverStatus: 'finite',
  },
  nyquist: {
    mode: 'full',
    points: [{ re: 0, im: 0 }, { re: -1.2, im: 0.3 }],
    positivePoints: [{ re: 0, im: 0 }, { re: -1.2, im: 0.3 }],
    negativePoints: [{ re: -1.2, im: -0.3 }, { re: 0, im: 0 }],
    segments: [
      {
        type: 'regular_negative',
        direction: 'negative_frequency',
        lineStyle: 'solid',
        points: [{ re: -1.2, im: -0.3 }, { re: 0, im: 0 }],
      },
      {
        type: 'regular_positive',
        direction: 'positive_frequency',
        lineStyle: 'solid',
        points: [{ re: 0, im: 0 }, { re: -1.2, im: 0.3 }],
      },
    ],
    infinityClosure: {
      points: [{ re: -1.2, im: 0.3 }, { re: -1.2, im: -0.3 }],
      lineStyle: 'dashed',
    },
    keyPoints: [{ kind: 'unit_circle_crossing', point: { re: -0.9, im: 0.1 }, frequency: 2 }],
    asymptotes: [{ end: 'high_frequency', kind: 'zero', angleDeg: -90, point: { re: 0, im: 0 } }],
    encirclements: 0,
    criterion: { n: 0, p: 0, z: 0, relation: 'Z = P + N', isConsistent: true },
  },
  rootLocus: {
    branches: [[{ re: -1, im: 0, gain: 1 }, { re: -2, im: 0, gain: 2 }]],
    currentPoles: [{ re: -1.2, im: 0 }],
    currentGain: 2,
    openLoopPoles: [{ re: -1, im: 0 }],
    openLoopZeros: [{ re: -3, im: 0 }],
    segments: [
      {
        type: 'real_axis_locus',
        lineStyle: 'solid',
        points: [{ re: -3, im: 0 }, { re: -1, im: 0 }],
      },
      {
        type: 'branch',
        lineStyle: 'solid',
        points: [{ re: -1, im: 0, gain: 1 }, { re: -2, im: 0, gain: 2 }],
      },
      {
        type: 'branch_completion',
        lineStyle: 'solid',
        points: [{ re: -2, im: 0, gain: 2 }, { re: -3, im: 0 }],
      },
      {
        type: 'asymptote',
        lineStyle: 'dashed',
        points: [{ re: -2, im: 0 }, { re: -2, im: 4 }],
        metadata: { angleDeg: 90, isAuxiliary: true },
      },
    ],
    realAxisSegments: [{ start: -3, end: -1 }],
    stationaryPoints: [{ re: -1.8, im: 0, gain: 1.7 }],
    imaginaryAxisCrossings: [{ re: 0, im: 1.4, gain: 4 }],
    asymptotes: [{ centroid: -2, angleDeg: 90 }],
    events: [
      { type: 'open_loop_pole', point: { re: -1, im: 0 }, branchId: 0 },
      { type: 'open_loop_zero', point: { re: -3, im: 0 }, branchId: 0 },
      { type: 'breakaway', point: { re: -1.8, im: 0 }, gain: 1.7 },
      { type: 'imaginary_axis_crossing', point: { re: 0, im: 1.4 }, gain: 4 },
      { type: 'infinity_endpoint', point: { re: -2, im: 4 }, branchId: 0 },
    ],
    branchStructure: {
      branches: [
        {
          id: 0,
          startEventType: 'open_loop_pole',
          endEventType: 'open_loop_zero',
          segmentIds: ['s-near-pole', 's-regular', 's-near-break', 's-near-zero'],
        },
      ],
      segments: [
        {
          id: 's-near-pole',
          type: 'near_pole',
          branchId: 0,
          points: [{ re: -1, im: 0, gain: 0 }, { re: -1.4, im: 0, gain: 1 }],
        },
        {
          id: 's-regular',
          type: 'regular',
          branchId: 0,
          points: [{ re: -1.4, im: 0, gain: 1 }, { re: -1.7, im: 0, gain: 1.6 }],
        },
        {
          id: 's-near-break',
          type: 'near_break',
          branchId: 0,
          points: [{ re: -1.7, im: 0, gain: 1.6 }, { re: -1.8, im: 0, gain: 1.7 }],
        },
        {
          id: 's-near-zero',
          type: 'near_zero',
          branchId: 0,
          points: [{ re: -2.2, im: 0, gain: 3 }, { re: -3, im: 0 }],
        },
        {
          id: 's-tail',
          type: 'asymptotic_tail',
          branchId: 1,
          points: [{ re: -2, im: 2 }, { re: -2, im: 6 }],
        },
        {
          id: 's-asymptote',
          type: 'asymptote',
          branchId: 1,
          isAuxiliary: true,
          points: [{ re: -2, im: 0 }, { re: -2, im: 8 }],
        },
      ],
    },
    views: {
      feature: {
        x: [-3.2, 0.4],
        y: [-1.35, 1.35],
        includeSegmentTypes: ['near_pole', 'regular', 'near_break', 'near_zero'],
        excludeSegmentTypes: ['asymptotic_tail', 'asymptote'],
      },
      full: {
        x: [-3.2, 0.4],
        y: [-3.6, 3.6],
        includeSegmentTypes: ['near_pole', 'regular', 'near_break', 'near_zero', 'asymptotic_tail', 'asymptote'],
      },
    },
  },
};

const FREQUENCY_READING_RESULT: ControlAnalysisResult = {
  ...MARGIN_RESULT,
  frequencyReadings: [{
    frequencyRadPerSec: 2,
    re: -0.05,
    im: -0.1,
    magnitudeDb: -19.031,
    phaseDeg: -116.565,
  }],
};

const FREQUENCY_READING_REQUEST: ControlAnalysisRequest = {
  runtimeMode: 'analysis',
  plant: { numerator: [1], denominator: [1, 1], coefficientOrder: 'descending' },
  structures: [],
  outputs: ['bode'],
  timeRange: { start: 0, end: 1, samples: 8 },
  frequencyRange: { min: 0.1, max: 10, samples: 8 },
  frequencyProbesRadPerSec: [2],
  rootLocus: { minGain: 0, maxGain: 2, samples: 2, currentGain: 1 },
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
    const series = option.series as Array<{
      name?: string;
      label?: { formatter?: string };
      data?: unknown[];
      symbolSize?: number;
    }>;

    expect(option.axisPointer).toEqual({ link: [{ xAxisIndex: [0, 1] }] });
    expect(xAxes[0]).toMatchObject({ min: 1e-2, max: 1e2 });
    expect(xAxes[1]).toMatchObject({ min: 1e-2, max: 1e2 });
    expect(series.some((item) => item.name === 'ωc 截止频率' && item.label?.formatter?.includes('ωc'))).toBe(true);
    expect(series.some((item) => item.name === 'PM 相角裕度' && item.label?.formatter?.includes('PM'))).toBe(true);
    expect(series.some((item) => item.name === 'ωg 穿越频率' && item.label?.formatter?.includes('GM'))).toBe(true);
    expect(series.find((item) => item.name === 'ωc 截止频率')?.symbolSize).toBe(CONTROL_CHART_KEY_POINT_MARKER_SIZE);
    expect(series.find((item) => item.name === 'PM 相角裕度')?.symbolSize).toBe(CONTROL_CHART_KEY_POINT_MARKER_SIZE);
    expect(series.find((item) => item.name === 'ωg 穿越频率')?.symbolSize).toBe(CONTROL_CHART_KEY_POINT_MARKER_SIZE);
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

  it('distinguishes an unobserved phase crossover from unavailable frequency response data', () => {
    const noCrossoverMarkup = renderToStaticMarkup(<ControlPerformanceBar result={SAMPLE_RESULT} />);
    const finiteMarkup = renderToStaticMarkup(<ControlPerformanceBar result={MARGIN_RESULT} />);
    const unavailableResult = {
      ...SAMPLE_RESULT,
      metrics: {
        ...SAMPLE_RESULT.metrics,
        gainMarginDb: Number.POSITIVE_INFINITY,
      },
      magnitude: { points: [] },
      phase: { points: [] },
    };
    const unavailableMarkup = renderToStaticMarkup(<ControlPerformanceBar result={unavailableResult} />);
    const bodeMarkup = renderToStaticMarkup(
      <ThemeProvider>
        <BodePanel result={SAMPLE_RESULT} />
      </ThemeProvider>,
    );
    const nyquistMarkup = renderToStaticMarkup(
      <ThemeProvider>
        <NyquistPanel result={SAMPLE_RESULT} />
      </ThemeProvider>,
    );

    expect(noCrossoverMarkup).toContain('>--<');
    expect(noCrossoverMarkup).toContain('未在当前频率范围内观测到');
    expect(finiteMarkup).toContain('12.00 dB');
    expect(finiteMarkup).toContain('8.00 rad/s');
    expect(unavailableMarkup).toContain('>--<');
    expect(unavailableMarkup).not.toContain('未在当前频率范围内观测到');
    expect(bodeMarkup).toContain('GM --');
    expect(bodeMarkup).toContain('ωg 未在当前频率范围内观测到');
    expect(nyquistMarkup).toContain('GM --');
    expect(nyquistMarkup).toContain('ωg 未在当前频率范围内观测到');
  });

  it('renders root-locus analysis metadata from the shared Rust result', () => {
    const option = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'full');
    const series = option.series as Array<{
      name?: string;
      lineStyle?: { type?: string; color?: string };
      itemStyle?: { color?: string; borderColor?: string; borderWidth?: number };
      symbol?: string;
      symbolSize?: number;
      data?: unknown[];
    }>;
    const legend = option.legend as { data?: Array<string | { name?: string; icon?: string }> };
    const legendItems = legend.data ?? [];

    expect(series.some((item) => item.name === '实轴根轨迹段')).toBe(false);
    expect(series.filter((item) => item.name === '根轨迹').length).toBeGreaterThan(1);
    expect(series.some((item) => item.name === '根轨迹渐近线')).toBe(true);
    expect(series.some((item) => item.name === '根轨迹渐近线' && item.lineStyle?.type === 'dashed')).toBe(true);
    expect(series
      .filter((item) => item.name === '根轨迹')
      .every((item) => item.lineStyle?.type === 'solid')).toBe(true);
    expect(series.find((item) => item.name === '根轨迹渐近线')?.data).toEqual([[-2, 0], [-2, 4]]);
    expect(series.some((item) =>
      item.name === '根轨迹'
      && item.data?.some((point) => Array.isArray(point) && point[0] === -3 && point[1] === 0),
    )).toBe(true);
    expect(series.some((item) => item.name === '分离/会合点')).toBe(true);
    expect(series.some((item) => item.name === '虚轴交点')).toBe(true);
    expect(series[series.length - 1]?.name).toBe('当前闭环极点');
    expect(series.find((item) => item.name === '当前闭环极点')?.itemStyle?.color).toBe('#2563eb');
    expect(series.find((item) => item.name === '根轨迹')?.lineStyle?.color).toBe('#2563eb');
    expect(series.find((item) => item.name === '虚轴交点')?.itemStyle?.color).not.toBe('#2563eb');
    expect(series.find((item) => item.name === '开环极点')?.symbolSize).toBe(11);
    expect(series.find((item) => item.name === '开环零点')?.symbol).toBe('circle');
    expect(series.find((item) => item.name === '开环零点')?.symbolSize).toBe(13);
    expect(series.find((item) => item.name === '开环零点')?.itemStyle?.color).toBe('rgba(255, 255, 255, 0)');
    expect(series.find((item) => item.name === '开环零点')?.itemStyle?.borderWidth).toBe(2.2);
    expect(series.find((item) => item.name === '分离/会合点')?.symbol).toBe('diamond');
    expect(series.find((item) => item.name === '分离/会合点')?.symbolSize).toBe(15);
    expect(series.find((item) => item.name === '虚轴交点')?.symbol).toBe('diamond');
    expect(series.find((item) => item.name === '虚轴交点')?.symbolSize).toBe(15);
    expect(option.dataZoom).toBeUndefined();
    expect(String(getTooltipFormatter(option))).toContain('阻尼比');
    expect(String(getTooltipFormatter(option))).toContain('自然频率');
    expect((option.graphic as Array<{ type?: string; style?: { text?: string } }>).some((item) =>
      item.type === 'text' && item.style?.text?.includes('K=2.000')
    )).toBe(true);
    expect(legendItems).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: '根轨迹',
        icon: expect.stringMatching(/^path:\/\/.*Z$/),
        symbolKeepAspect: true,
      }),
      expect.objectContaining({
        name: '根轨迹渐近线',
        icon: expect.stringMatching(/^path:\/\/.*Z$/),
        symbolKeepAspect: true,
      }),
    ]));
    expect(legendItems).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: '当前闭环极点', icon: 'circle' }),
      expect.objectContaining({ name: '虚轴交点', icon: 'diamond' }),
    ]));
    expect(legendItems).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ icon: 'path://M2 6 L26 6' }),
    ]));
    expect(legendItems).not.toContain('实轴根轨迹段');
  });

  it('renders static root-locus snapshot markers from saved analysis results', () => {
    const snapshotColor = '#d946ef';
    const option = buildRootLocusOption(
      MARGIN_RESULT.rootLocus,
      undefined,
      'full',
      undefined,
      undefined,
      [{ label: '方案 1', color: snapshotColor, result: MARGIN_RESULT }],
    );
    const series = getChartSeries(option);
    const snapshotOpenLoopPoles = series.find((item) =>
      item.type === 'scatter' && item.silent === true && item.z === 8 && item.symbolSize === 11,
    );
    const snapshotOpenLoopZeros = series.find((item) =>
      item.type === 'scatter' && item.silent === true && item.z === 8 && item.symbolSize === 13,
    );
    const snapshotCurrentPoles = series.find((item) =>
      item.type === 'scatter' && item.silent === true && item.z === 9 && item.symbolSize === 13,
    );

    expect(snapshotOpenLoopPoles).toMatchObject({
      itemStyle: { color: snapshotColor },
      data: MARGIN_RESULT.rootLocus.openLoopPoles.map((point) => [point.re, point.im]),
    });
    expect(snapshotOpenLoopZeros).toMatchObject({
      itemStyle: { color: 'rgba(255, 255, 255, 0)', borderColor: snapshotColor },
      data: MARGIN_RESULT.rootLocus.openLoopZeros.map((point) => [point.re, point.im]),
    });
    expect(snapshotCurrentPoles).toMatchObject({
      itemStyle: { color: snapshotColor },
      data: MARGIN_RESULT.rootLocus.currentPoles.map((point) => [point.re, point.im]),
    });
  });

  it('keeps near-zero root-locus endpoints in feature view while hiding asymptotic tails', () => {
    const option = buildRootLocusOption({
      ...MARGIN_RESULT.rootLocus,
      segments: [
        {
          type: 'near_zero',
          lineStyle: 'solid',
          points: [{ re: -2.2, im: 0.15, gain: 3 }, { re: -3, im: 0 }],
          metadata: {
            branchId: 0,
            endpointType: 'finite_zero',
            targetZeroIndex: 0,
            terminalDistance: 0,
            samplingParameter: 'mu',
          },
        },
        {
          type: 'asymptotic_tail',
          lineStyle: 'solid',
          points: [{ re: -2, im: 2 }, { re: -2, im: 6 }],
          metadata: { branchId: 1, endpointType: 'infinity', isAuxiliary: true },
        },
        {
          type: 'asymptote',
          lineStyle: 'dashed',
          points: [{ re: -2, im: 0 }, { re: -2, im: 8 }],
          metadata: { angleDeg: 90, isAuxiliary: true },
        },
      ],
      views: {
        feature: {
          x: [-3.2, 0.4],
          y: [-1.35, 1.35],
          includeSegmentTypes: ['near_pole', 'regular', 'near_break', 'near_zero'],
          excludeSegmentTypes: ['asymptotic_tail', 'asymptote'],
        },
        full: {
          x: [-3.2, 0.4],
          y: [-3.6, 3.6],
          includeSegmentTypes: ['near_pole', 'regular', 'near_break', 'near_zero', 'asymptotic_tail', 'asymptote'],
        },
      },
    });
    const fullOption = buildRootLocusOption({
      ...MARGIN_RESULT.rootLocus,
      segments: [
        {
          type: 'near_zero',
          lineStyle: 'solid',
          points: [{ re: -2.2, im: 0.15, gain: 3 }, { re: -3, im: 0 }],
          metadata: { branchId: 0, endpointType: 'finite_zero', targetZeroIndex: 0, terminalDistance: 0 },
        },
        {
          type: 'asymptotic_tail',
          lineStyle: 'solid',
          points: [{ re: -2, im: 2 }, { re: -2, im: 6 }],
          metadata: { branchId: 1, endpointType: 'infinity', isAuxiliary: true },
        },
      ],
      views: MARGIN_RESULT.rootLocus.views,
    }, undefined, 'full');
    const featureSeries = option.series as Array<{ name?: string; data?: unknown[] }>;
    const fullSeries = fullOption.series as Array<{ name?: string; data?: unknown[] }>;

    expect(featureSeries.some((item) =>
      item.name === '根轨迹'
      && item.data?.some((point) => Array.isArray(point) && point[0] === -3 && point[1] === 0),
    )).toBe(true);
    expect(featureSeries.some((item) =>
      item.name === '根轨迹'
      && item.data?.some((point) => Array.isArray(point) && point[1] === 6),
    )).toBe(false);
    expect(fullSeries.some((item) =>
      item.name === '根轨迹'
      && item.data?.some((point) => Array.isArray(point) && point[1] === 6),
    )).toBe(true);
  });

  it('applies distinct light and dark root-locus line and text colors', () => {
    const baseOption = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'full');
    const lightOption = applyControlChartTheme(baseOption, 'light');
    const darkOption = applyControlChartTheme(baseOption, 'dark');
    const lightSeries = lightOption.series as Array<{ name?: string; lineStyle?: { color?: string }; itemStyle?: { color?: string; borderColor?: string } }>;
    const darkSeries = darkOption.series as Array<{ name?: string; lineStyle?: { color?: string }; itemStyle?: { color?: string } }>;
    const lightLegend = lightOption.legend as { textStyle?: { color?: string } };
    const darkLegend = darkOption.legend as { textStyle?: { color?: string } };

    expect(lightSeries.find((item) => item.name === '根轨迹')?.lineStyle?.color).toBe('#2563eb');
    expect(darkSeries.find((item) => item.name === '根轨迹')?.lineStyle?.color).toBe('#38bdf8');
    expect(lightSeries.find((item) => item.name === '当前闭环极点')?.itemStyle?.color).toBe('#2563eb');
    expect(lightSeries.find((item) => item.name === '开环零点')?.itemStyle?.color).toBe('rgba(255, 255, 255, 0)');
    expect(lightSeries.find((item) => item.name === '开环零点')?.itemStyle?.borderColor).toBe('#d97706');
    expect(darkSeries.find((item) => item.name === '当前闭环极点')?.itemStyle?.color).toBe('#38bdf8');
    expect(lightLegend.textStyle?.color).toBe('rgba(30, 41, 59, 0.9)');
    expect(darkLegend.textStyle?.color).toBe('rgba(241, 245, 249, 0.92)');
  });

  it('uses darker primary analysis lines in light mode', () => {
    const nyquistLight = applyControlChartTheme(buildNyquistOption(MARGIN_RESULT), 'light');
    const bodeLight = applyControlChartTheme(buildBodePanelOption(MARGIN_RESULT), 'light');
    const nyquistSeries = nyquistLight.series as Array<{ name?: string; lineStyle?: { color?: string } }>;
    const bodeSeries = bodeLight.series as Array<{ name?: string; lineStyle?: { color?: string } }>;

    expect(nyquistSeries.find((item) => item.name === 'Nyquist 正频率支')?.lineStyle?.color).toBe('#0f766e');
    expect(nyquistSeries.find((item) => item.name === 'Nyquist 负频率支')?.lineStyle?.color).toBe('#0f766e');
    expect(bodeSeries.find((item) => item.name === '幅频')?.lineStyle?.color).toBe('#6d28d9');
    expect(bodeSeries.find((item) => item.name === '相频')?.lineStyle?.color).toBe('#be123c');
  });

  it('uses one shared width for all primary analysis curves', () => {
    const stepOption = buildLineOption(MARGIN_RESULT.stepResponse.points, '#22d3ee', '时间 / s', '响应');
    const bodeOption = buildBodePanelOption(MARGIN_RESULT);
    const rootOption = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'full');
    const nyquistOption = buildNyquistOption(MARGIN_RESULT);
    const nyquistClosureOption = buildNyquistOption({
      ...MARGIN_RESULT,
      nyquist: {
        ...MARGIN_RESULT.nyquist,
        segments: [
          ...(MARGIN_RESULT.nyquist.segments ?? []),
          {
            type: 'infinity_arc',
            points: [{ re: -2, im: -1 }, { re: 2, im: 0 }, { re: -2, im: 1 }],
            lineStyle: 'dashed',
          },
        ],
      },
    });
    const getSeries = (option: unknown) => (option as { series?: unknown }).series as Array<{
      name?: string;
      lineStyle?: { width?: number; type?: string };
    }>;

    const widths = [
      getSeries(stepOption).find((item) => item.name === '响应')?.lineStyle?.width,
      getSeries(bodeOption).find((item) => item.name === '幅频')?.lineStyle?.width,
      getSeries(bodeOption).find((item) => item.name === '相频')?.lineStyle?.width,
      ...getSeries(rootOption)
        .filter((item) => item.name === '根轨迹')
        .map((item) => item.lineStyle?.width),
      getSeries(nyquistOption).find((item) => item.name === 'Nyquist 正频率支')?.lineStyle?.width,
      getSeries(nyquistOption).find((item) => item.name === 'Nyquist 负频率支')?.lineStyle?.width,
    ];

    expect(new Set(widths)).toEqual(new Set([2.4]));
    expect(getSeries(rootOption).find((item) => item.name === '根轨迹渐近线')?.lineStyle?.width).toBeLessThan(2.4);
    expect(getSeries(nyquistClosureOption).find((item) => item.name === '无穷远闭合段')?.lineStyle?.width).toBeLessThan(2.4);
  });

  it('renders full Nyquist branches, key points, axes, critical point, and asymptotes', () => {
    const option = buildNyquistOption({
      ...MARGIN_RESULT,
      nyquist: {
        ...MARGIN_RESULT.nyquist,
        positiveSamples: [
          { re: 0, im: 0, frequency: 0.1, magnitudeDb: 0, phaseDeg: 0 },
          { re: -1.2, im: 0.3, frequency: 2, magnitudeDb: 1.2, phaseDeg: 166 },
        ],
        negativeSamples: [
          { re: -1.2, im: -0.3, frequency: -2, magnitudeDb: 1.2, phaseDeg: -166 },
          { re: 0, im: 0, frequency: -0.1, magnitudeDb: 0, phaseDeg: 0 },
        ],
      },
    });
    const series = option.series as Array<{
      name?: string;
      lineStyle?: { type?: string };
      label?: { formatter?: string };
      symbol?: string;
      symbolSize?: number;
      data?: unknown[];
      z?: number;
    }>;

    expect(series.some((item) => item.name === '实轴')).toBe(true);
    expect(series.some((item) => item.name === '虚轴')).toBe(true);
    expect(series.some((item) => item.name === 'Nyquist 正频率支')).toBe(true);
    expect(series.some((item) => item.name === 'Nyquist 负频率支')).toBe(true);
    expect(series.some((item) => item.name === '无穷远闭合段')).toBe(true);
    expect(series.some((item) =>
      item.name === '单位圆'
      && item.lineStyle?.type === 'dotted'
      && (item.data?.length ?? 0) >= 120,
    )).toBe(true);
    expect(series.some((item) => item.name === 'Nyquist 关键点')).toBe(true);
    expect(series.find((item) => item.name === 'Nyquist 关键点')?.symbol).toBe('diamond');
    expect(series.find((item) => item.name === 'Nyquist 关键点')?.symbolSize).toBe(15);
    expect(series.some((item) => item.name === 'Nyquist 渐近方向' && item.lineStyle?.type === 'dashed')).toBe(true);
    expect(series.some((item) => item.name === '-1+j0' && item.label?.formatter === '-1+j0')).toBe(true);
    expect(series.find((item) => item.name === '-1+j0')?.symbol).toBe('circle');
    expect(series.find((item) => item.name === '-1+j0')?.symbolSize).toBe(15);
    expect(option.dataZoom).toBeUndefined();
    expect(String(getTooltipFormatter(option))).toContain('|L(jω)|');
    expect(series.find((item) => item.name === 'Nyquist 正频率支')?.data).toContainEqual([0, 0, 0.1, 0, 0]);
    const tooltipFormatter = getTooltipFormatter(option) as (params: { seriesName: string; value: number[] }) => string;
    const tooltip = tooltipFormatter({ seriesName: 'Nyquist 正频率支', value: [0, 0, 0.1, 0, 0] });
    expect(tooltip).toContain('ω: 0.10 rad/s');
    expect(tooltip).toContain('|L(jω)|');
    expect(tooltip).not.toContain('Gain K');
  });

  it('adds Bode turn-frequency markers and keeps the shared frequency pan-zoom source path', () => {
    const turnSeries = buildBodeTurnFrequencySeries([
      { id: 'lead-zero', label: '超前零点', frequency: 1.2 },
      { id: 'lead-pole', label: '超前极点', frequency: 6 },
    ]) as ChartSeriesLike[];
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(turnSeries.map((series) => series.name)).toEqual(['超前零点', '超前极点']);
    expect(turnSeries.every((series) => series.xAxisIndex === 0 && series.yAxisIndex === 0)).toBe(true);
    expect(panelSource).toContain('installBodeFrequencyPanZoom');
    expect(panelSource).toContain('turnFrequencyHandles,\n      showFrequencyReadings,');
    expect(panelSource).toContain('buildBodeComparisonOption(panels, caseId, displayedFrequencyRange, turnFrequencyHandles)');
    expect(panelSource).toContain('installBodeTurnFrequencyDrag(chart, turnFrequencyHandles, onTurnFrequencyCommit, refreshRange)');
    expect(panelSource).toContain('findBodeTurnHandleAt(chart, turnFrequencyHandles, event)');
    expect(panelSource).toContain('onRefreshRange(range)');
  });

  it('keeps time-domain pan and zoom available through the shared cartesian installer', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('export function TimeDomainPanel');
    expect(panelSource).toContain('export function TimeDomainComparisonPanel');
    expect(panelSource).toContain('installCartesianPanZoom(chart, refreshRange)');
    expect(panelSource).toContain('buildLineOption(result.stepResponse.points');
    expect(panelSource).toContain('按当前时域范围刷新');
  });

  it('computes a stable-response default y range from visible extrema with margin', () => {
    const preset = calculateStableResponseAxisPreset([
      { x: 0, y: 0 },
      { x: 1, y: 0.8 },
      { x: 2, y: 1.2 },
    ], true);

    expect(preset).toEqual({ y: [-0.12, 1.32] });
    expect(calculateStableResponseAxisPreset([{ x: 0, y: 5 }, { x: 1, y: 5.001 }], true)).toEqual({
      y: [4.5, 5.501],
    });
    expect(calculateStableResponseAxisPreset([{ x: 0, y: 3 }], false)).toBeUndefined();
  });

  it('uses shared curve styles for time-domain rendered lines and panel-local legend controls', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(CONTROL_SIGNAL_CURVE_STYLES.reference).toMatchObject({ color: '#22c55e', lineType: 'dashed' });
    expect(CONTROL_SIGNAL_CURVE_STYLES.uncorrectedOutput).toMatchObject({ color: '#64748b', lineType: 'solid' });
    expect(CONTROL_SIGNAL_CURVE_STYLES.correctedOutput).toMatchObject({ color: '#0ea5e9', lineType: 'solid' });
    expect(panelSource).toContain('export const CONTROL_SIGNAL_CURVE_STYLES');
    expect(panelSource).toContain('lineStyle: { color: panel.style.color, type: panel.style.lineType');
    expect(panelSource).not.toContain('legend: {\\n      top: 0');
  });

  it('builds time-domain comparison options without a chart-area legend and ranges all visible signals', () => {
    const preset = calculateTimeDomainVisibleAxisPreset([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1.2 },
    ]);
    const option = buildTimeDomainComparisonOption([
      {
        label: '参考输入',
        style: CONTROL_SIGNAL_CURVE_STYLES.reference,
        result: {
          ...SAMPLE_RESULT,
          stepResponse: { points: [{ x: 0, y: 1 }, { x: 1, y: 1 }] },
        },
      },
      {
        label: '校正后输出',
        style: CONTROL_SIGNAL_CURVE_STYLES.correctedOutput,
        result: {
          ...SAMPLE_RESULT,
          stepResponse: { points: [{ x: 0, y: 0 }, { x: 1, y: 1.2 }] },
        },
      },
    ], preset);
    const series = option.series as Array<{ name: string; lineStyle: { color: string; type: string } }>;
    const yAxis = option.yAxis as { min?: number; max?: number };

    expect(option.legend).toBeUndefined();
    expect(yAxis).toMatchObject({ min: -0.12, max: 1.32 });
    expect(series.find((item) => item.name === '参考输入')?.lineStyle).toMatchObject({
      color: CONTROL_SIGNAL_CURVE_STYLES.reference.color,
      type: CONTROL_SIGNAL_CURVE_STYLES.reference.lineType,
    });
  });

  it('keeps time-domain y ranges independent from equal-aspect cartesian expansion', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );
    const preset = calculateTimeDomainVisibleAxisPreset([
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 1.2 },
    ]);
    const equalAspectRange = calculateEqualAspectCartesianRange({
      x: [0, 12],
      y: preset!.y,
      width: 720,
      height: 420,
    });
    const timeDomainPanZoomOptOuts = panelSource.match(
      /installCartesianPanZoom\(chart, refreshRange, \{ preserveAspectRatio: false \}\)/g,
    ) ?? [];

    expect(preset).toEqual({ y: [-0.12, 1.32] });
    expect(equalAspectRange.y[1] - equalAspectRange.y[0]).toBeGreaterThan(6);
    expect(timeDomainPanZoomOptOuts).toHaveLength(2);
  });

  it('replaces stale ECharts series when selectable chart curves change', () => {
    const chartPanelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-chart-panel.tsx'),
      'utf8',
    );

    expect(chartPanelSource).toContain("replaceMerge: ['series']");
  });

  it('builds Bode comparison options from shared source styles without a chart-area legend', () => {
    const option = buildBodeComparisonOption([
      { label: '未校正开环', style: CONTROL_SIGNAL_CURVE_STYLES.uncorrectedOpenLoop, result: SAMPLE_RESULT },
      { label: '校正后开环', style: CONTROL_SIGNAL_CURVE_STYLES.correctedOpenLoop, result: SAMPLE_RESULT },
      { label: '校正装置', style: CONTROL_SIGNAL_CURVE_STYLES.correctionDevice, result: SAMPLE_RESULT },
    ]);
    const series = option.series as Array<{ name: string; lineStyle: { color: string; type?: string } }>;

    expect(option.legend).toBeUndefined();
    expect(option.color).toEqual([
      CONTROL_SIGNAL_CURVE_STYLES.uncorrectedOpenLoop.color,
      CONTROL_SIGNAL_CURVE_STYLES.correctedOpenLoop.color,
      CONTROL_SIGNAL_CURVE_STYLES.correctionDevice.color,
    ]);
    expect(series.filter((item) => item.name === '校正装置').map((item) => item.lineStyle.color))
      .toEqual([
        CONTROL_SIGNAL_CURVE_STYLES.correctionDevice.color,
        CONTROL_SIGNAL_CURVE_STYLES.correctionDevice.color,
      ]);
  });

  it('keeps workbench curve configuration local to each panel header', () => {
    const pageSource = readFileSync(
      join(repoRoot, 'src/features/interactive/multi-representation-linkage/page-client.tsx'),
      'utf8',
    );

    expect(pageSource).toContain('data-panel-local-configuration="curve-toggle-group"');
    expect(pageSource).toContain('function PanelCurveToggleGroup');
    expect(pageSource).toContain('const [panelOptionState, setPanelOptionState]');
    expect(pageSource).toContain('onPanelSelectedOptionsChange?.(panel.id, nextOptions)');
    expect(pageSource).toContain('const panelSelectionChanged = panelOptionState.signature !== panelSelectionSignature;');
    expect(pageSource).toContain('setPanelOptionState({ signature: panelSelectionSignature, overrides: {} });');
    expect(pageSource).toContain('const panelOptionOverrides = panelSelectionChanged ? {} : panelOptionState.overrides;');
    expect(pageSource).toContain('current.signature === panelSelectionSignature ? current.overrides : {}');
    expect(pageSource).toContain('onToggle={(id, mode) => togglePanelLocalOption(panel, id, mode)}');
    expect(pageSource).toContain('data-line-style={option.style.lineType}');
    expect(pageSource).toContain('<LineStyleSample style={option.style} />');
    expect(pageSource).toContain('label="时域信号"');
    expect(pageSource).toContain('label="Bode 曲线"');
    expect(pageSource).toContain('label="Nyquist 来源"');
    expect(pageSource).toContain('style: CONTROL_SIGNAL_CURVE_STYLES.correctedOpenLoop');
  });

  it('lets time-domain charts apply a y-only stable-response preset', () => {
    const option = buildLineOption(
      [{ x: 0, y: 0 }, { x: 1, y: 1.2 }],
      '#22d3ee',
      '时间 / s',
      '响应',
      { axisPreset: { y: [-1.32, 1.32] } },
    );
    const xAxis = option.xAxis as { min?: number; max?: number };
    const yAxis = option.yAxis as { min?: number; max?: number };

    expect(xAxis.min).toBeUndefined();
    expect(xAxis.max).toBeUndefined();
    expect(yAxis.min).toBe(-1.32);
    expect(yAxis.max).toBe(1.32);
  });

  it('keeps y-only stable-response presets safe for comparison panels', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('min: axisPreset?.x?.[0]');
    expect(panelSource).toContain('max: axisPreset?.x?.[1]');
    expect(panelSource).toContain('min: axisPreset?.y?.[0]');
    expect(panelSource).toContain('max: axisPreset?.y?.[1]');
  });

  it('keeps root-locus full view gain in the panel status area instead of only drawing it inside the chart', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('当前开环增益');
    expect(panelSource).toContain('rootLocus.currentGain');
  });

  it('lets explicit performance panels span the two-column control workbench grid', () => {
    const workspaceSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-figure-workspace.tsx'),
      'utf8',
    );

    expect(workspaceSource).toContain('data-control-workbench-panel={panelId}');
    expect(workspaceSource).toContain('xl:col-span-2');
  });

  it('lets Nyquist options reuse a preserved viewport instead of resetting to the preset', () => {
    const option = buildNyquistOption(MARGIN_RESULT, 'ship_heading', {
      x: [-1.25, 0.35],
      y: [-0.8, 0.8],
    });
    const xAxis = option.xAxis as { min?: number; max?: number };
    const yAxis = option.yAxis as { min?: number; max?: number };
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(xAxis.min).toBe(-1.25);
    expect(xAxis.max).toBe(0.35);
    expect(yAxis.min).toBe(-0.8);
    expect(yAxis.max).toBe(0.8);
    expect(panelSource).toContain('const displayedAxisPreset = preservedRangeRef.current ?? axisPreset;');
    expect(panelSource).toContain(
      'buildNyquistOption(result, caseId, displayedAxisPreset, showFrequencyReadings, comparisonSeries)',
    );
  });

  it('renders Nyquist criterion and margin geometry annotations together', () => {
    const option = buildNyquistOption({
      ...MARGIN_RESULT,
      nyquist: {
        ...MARGIN_RESULT.nyquist,
        keyPoints: [
          { kind: 'unit_circle_crossing', point: { re: -0.9, im: 0.1 }, frequency: 2 },
          { kind: 'real_axis_crossing', point: { re: -1.3, im: 0 }, frequency: 8 },
        ],
      },
    });
    const series = option.series as Array<{
      name?: string;
      data?: unknown[];
      z?: number;
      lineStyle?: { type?: string };
      itemStyle?: { color?: string };
    }>;
    const markup = renderToStaticMarkup(<ControlPerformanceBar result={MARGIN_RESULT} />);
    const criticalMarkup = renderToStaticMarkup(<ControlPerformanceBar result={{
      ...MARGIN_RESULT,
      rootLocus: {
        ...MARGIN_RESULT.rootLocus,
        currentPoles: [{ re: 5e-5, im: 2 }, { re: 5e-5, im: -2 }],
      },
    }} />);

    expect(markup).toContain('data-testid="metric-N"');
    expect(markup).toContain('data-testid="metric-P"');
    expect(markup).toContain('data-testid="metric-Z"');
    expect(criticalMarkup).toContain('临界稳定');
    expect(series.some((item) => item.name === 'GM 增益裕度连线')).toBe(true);
    expect(series.some((item) => item.name === 'PM 相位裕度半径')).toBe(true);
    expect(series.some((item) => item.name === 'PM 相位裕度扇区' && (item.z ?? 0) < 3)).toBe(true);
    expect(series.find((item) => item.name === 'PM 相位裕度扇区')?.itemStyle?.color).toContain('rgba');
  });

  it('includes exact frequency-reading option data only when explicitly shown', () => {
    const bodeSeries = getChartSeries(buildBodePanelOption(FREQUENCY_READING_RESULT));
    const magnitudeSeries = getChartSeries(buildMagnitudeOption(FREQUENCY_READING_RESULT));
    const phaseSeries = getChartSeries(buildPhaseOption(FREQUENCY_READING_RESULT));
    const nyquistSeries = getChartSeries(buildNyquistOption(FREQUENCY_READING_RESULT));
    const bodeMagnitudeMarker = bodeSeries.find((item) => item.name === '精确频点（幅值）');
    const bodePhaseMarker = bodeSeries.find((item) => item.name === '精确频点（相位）');
    const magnitudeMarker = magnitudeSeries.find((item) => item.name === '精确频点（幅值）');
    const phaseMarker = phaseSeries.find((item) => item.name === '精确频点（相位）');
    const nyquistMarker = nyquistSeries.find((item) => item.name === '精确频点（Nyquist）');

    expect(bodeMagnitudeMarker?.data).toEqual([[2, -19.031]]);
    expect(bodePhaseMarker?.data).toEqual([[2, -116.565]]);
    expect(bodePhaseMarker?.xAxisIndex).toBe(1);
    expect(bodePhaseMarker?.yAxisIndex).toBe(1);
    expect(magnitudeMarker?.data).toEqual([[2, -19.031]]);
    expect(phaseMarker?.data).toEqual([[2, -116.565]]);
    expect(nyquistMarker?.data).toEqual([[-0.05, -0.1, 2, -19.031, -116.565]]);
    expect(formatFrequencyResponseReading(FREQUENCY_READING_RESULT.frequencyReadings![0])).toContain('第三象限');

    const hiddenOptions = [
      buildBodePanelOption(FREQUENCY_READING_RESULT, undefined, true, null, [], false),
      buildMagnitudeOption(FREQUENCY_READING_RESULT, undefined, false),
      buildPhaseOption(FREQUENCY_READING_RESULT, undefined, false),
      buildNyquistOption(FREQUENCY_READING_RESULT, undefined, undefined, false),
    ];
    for (const option of hiddenOptions) {
      const serialized = JSON.stringify(option);
      expect(serialized).not.toContain(JSON.stringify([2, -19.031]));
      expect(serialized).not.toContain(JSON.stringify([2, -116.565]));
      expect(serialized).not.toContain(JSON.stringify([-0.05, -0.1, 2, -19.031, -116.565]));
      expect(getChartSeries(option).some((item) => item.name?.startsWith('精确频点'))).toBe(false);
    }
  });

  it('hides stale results and frequency markers while a new control request is loading', () => {
    mockedControlEngineState.current = {
      result: FREQUENCY_READING_RESULT,
      error: null,
      isLoading: true,
      isFallback: false,
    };

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ControlFigureWorkspace request={FREQUENCY_READING_REQUEST} layout="platform" />
      </ThemeProvider>,
    );

    expect(markup).toContain('正在计算当前控制分析请求');
    expect(markup).not.toContain('data-control-workbench-frequency-readings="exact"');
    expect(markup).not.toContain('第三象限');
  });

  it('lets root-locus options reuse a preserved viewport instead of resetting to the preset', () => {
    const option = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'full', {
      x: [-1.5, 0.5],
      y: [-1, 1],
    });
    const xAxis = option.xAxis as { min?: number; max?: number };
    const yAxis = option.yAxis as { min?: number; max?: number };
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(xAxis.min).toBe(-1.5);
    expect(xAxis.max).toBe(0.5);
    expect(yAxis.min).toBe(-1);
    expect(yAxis.max).toBe(1);
    expect(panelSource).toContain('preservedRangeRef.current = getDisplayedCartesianRange(chart) ?? preservedRangeRef.current;');
    expect(panelSource).toContain('const displayedAxisPreset = preservedRangeRef.current ?? axisPreset;');
  });

  it('uses explicit, case preset, then Rust auto root-locus views in order', () => {
    const autoFeatureOption = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'default');
    const autoFullOption = buildRootLocusOption(MARGIN_RESULT.rootLocus, undefined, 'full');
    const casePresetOption = buildRootLocusOption(MARGIN_RESULT.rootLocus, 'ship_heading', 'default');
    const explicitOption = buildRootLocusOption(MARGIN_RESULT.rootLocus, 'ship_heading', 'default', {
      x: [-9, 1],
      y: [-4, 4],
    });
    const autoFeatureSeries = autoFeatureOption.series as Array<{ name?: string }>;
    const autoFullSeries = autoFullOption.series as Array<{ name?: string }>;

    expect(autoFeatureOption.xAxis).toMatchObject({ min: -3.2, max: 0.4 });
    expect(autoFeatureOption.yAxis).toMatchObject({ min: -1.35, max: 1.35 });
    expect(autoFullOption.yAxis).toMatchObject({ min: -3.6, max: 3.6 });
    expect(autoFeatureSeries.some((item) => item.name === '根轨迹渐近线')).toBe(false);
    expect(autoFullSeries.some((item) => item.name === '根轨迹渐近线')).toBe(true);
    expect(casePresetOption.xAxis).toMatchObject({ min: -3.2, max: 0.4 });
    expect(casePresetOption.yAxis).toMatchObject({ min: -0.8, max: 0.8 });
    expect(explicitOption.xAxis).toMatchObject({ min: -9, max: 1 });
    expect(explicitOption.yAxis).toMatchObject({ min: -4, max: 4 });
  });

  it('keeps chart panning aligned with the intended drag direction', () => {
    const horizontalPan = calculateCartesianDragRange({
      x: [-2, 2],
      y: [-2, 2],
      width: 400,
      height: 400,
      deltaX: -40,
      deltaY: 8,
    });
    const diagonalPan = calculateCartesianDragRange({
      x: [-2, 2],
      y: [-2, 2],
      width: 400,
      height: 400,
      deltaX: -40,
      deltaY: 40,
    });

    expect(horizontalPan.x).toEqual([-1.6, 2.4]);
    expect(horizontalPan.y).toEqual([-1.92, 2.08]);
    expect(diagonalPan.x).toEqual([-1.6, 2.4]);
    expect(diagonalPan.y).toEqual([-1.6, 2.4]);
  });

  it('expands cartesian ranges to keep root-locus and Nyquist unit aspect equal', () => {
    const expandedY = calculateEqualAspectCartesianRange({
      x: [-3.2, 0.4],
      y: [-0.8, 0.8],
      width: 576,
      height: 432,
    });
    const expandedX = calculateEqualAspectCartesianRange({
      x: [-1, 1],
      y: [-2, 2],
      width: 600,
      height: 300,
    });

    expect(expandedY.x).toEqual([-3.2, 0.4]);
    expect(expandedY.y).toEqual([-1.35, 1.35]);
    expect(expandedX.x).toEqual([-4, 4]);
    expect(expandedX.y).toEqual([-2, 2]);
  });

  it('keeps the Nyquist chart on a one-to-one displayed unit aspect after layout settles', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('const scheduleNyquistEqualAspect = useCallback');
    expect(panelSource).toContain('scheduleNyquistEqualAspect(chart);');
    expect(panelSource).toContain('enforceEqualAspectOnChart(chart, () => {');
  });

  it('does not synthesize a high-frequency Nyquist closure near the origin', () => {
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

    expect(closure).toBeUndefined();
  });

  it('draws mapped Nyquist contour infinity segments without adding a solid low-frequency connector', () => {
    const option = buildNyquistOption({
      ...MARGIN_RESULT,
      nyquist: {
        ...MARGIN_RESULT.nyquist,
        positivePoints: [{ re: -2, im: 1.2 }, { re: 0, im: -0.00075 }],
        negativePoints: [{ re: 0, im: 0.00075 }, { re: -2, im: -1.2 }],
        segments: [
          {
            type: 'regular_negative',
            direction: 'negative_frequency',
            lineStyle: 'solid',
            points: [{ re: 0, im: 0.00075 }, { re: -2, im: -1.2 }],
          },
          {
            type: 'infinity_arc',
            direction: 'clockwise',
            lineStyle: 'dashed',
            points: [
              { re: -2, im: -1.2 },
              { re: 2.332380757938, im: 0 },
              { re: -2, im: 1.2 },
            ],
            metadata: { poleOrder: 1, isAuxiliary: true },
          },
          {
            type: 'regular_positive',
            direction: 'positive_frequency',
            lineStyle: 'solid',
            points: [{ re: -2, im: 1.2 }, { re: 0, im: -0.00075 }],
          },
        ],
        infinityClosure: {
          points: [{ re: -2, im: -1.2 }, { re: 2.332380757938, im: 0 }, { re: -2, im: 1.2 }],
          lineStyle: 'dashed',
        },
        asymptotes: [{ end: 'low_frequency', kind: 'infinite', angleDeg: -90, point: undefined }],
      },
    });
    const series = option.series as Array<{ name?: string; data?: unknown[]; lineStyle?: { type?: string }; z?: number }>;
    const closures = series.filter(
      (item) => item.name === '无穷远闭合段',
    );
    const regularSeries = series.filter((item) =>
      item.name === 'Nyquist 正频率支' || item.name === 'Nyquist 负频率支'
    );
    const closure = closures[0]?.data as Array<[number, number]>;

    expect(closures).toHaveLength(1);
    expect(closures.every((item) => item.lineStyle?.type === 'dashed' && (item.z ?? 0) >= 6)).toBe(true);
    expect(regularSeries).toHaveLength(2);
    expect(closure[0]).toEqual([-2, -1.2]);
    expect(closure[1]).toEqual([2.332380757938, 0]);
    expect(closure[closure.length - 1]).toEqual([-2, 1.2]);
    expect(regularSeries.some((item) =>
      JSON.stringify(item.data).includes('[-2,-1.2],[-2,1.2]')
    )).toBe(false);
  });

  it('routes closed-loop pole dragging through overlay handles instead of chart panning', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-analysis-panels.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('closed-loop-pole-${index}');
    expect(panelSource).toContain('startClosedLoopPoleDrag');
    expect(panelSource).toContain('data-cartesian-pan-zoom-ignore');
    expect(panelSource).not.toContain("chart.on('mousedown'");
  });

  it('uses module-header title sizing for shared Rust-driven figure panels', () => {
    const panelSource = readFileSync(
      join(repoRoot, 'src/resources/control-system/charts/control-chart-panel.tsx'),
      'utf8',
    );

    expect(panelSource).toContain('premium-lesson-title text-base font-semibold leading-7 tracking-normal');
    expect(panelSource).toContain("chartClassName = 'h-[520px]'");
    expect(panelSource).not.toContain('premium-lesson-title text-lg font-semibold">{title}');
    expect(panelSource).not.toContain('premium-lesson-title text-sm font-semibold">{title}');
    expect(panelSource).not.toContain("chartClassName = 'h-[260px]'");
  });
});
