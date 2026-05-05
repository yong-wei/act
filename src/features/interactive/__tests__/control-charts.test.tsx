import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { ControlAnalysisResult } from '@/resources/control-system/analysis/types';
import {
  buildBodeComparisonOption,
  buildBodePanelOption,
  getControlAxisPreset,
} from '@/resources/control-system/charts/control-bode-options';
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

    expect((lightOption.legend as { textStyle?: { color?: string } }).textStyle?.color).toBe('rgba(51, 65, 85, 0.88)');
    expect((darkOption.legend as { textStyle?: { color?: string } }).textStyle?.color).toBe('rgba(226, 232, 240, 0.9)');
    expect(((lightOption.xAxis as Array<{ axisLabel?: { color?: string } }>)[0]).axisLabel?.color).toBe('rgba(71, 85, 105, 0.82)');
    expect(((darkOption.xAxis as Array<{ axisLabel?: { color?: string } }>)[0]).axisLabel?.color).toBe('rgba(226, 232, 240, 0.75)');
    expect(((lightOption.yAxis as Array<{ nameTextStyle?: { color?: string } }>)[0]).nameTextStyle?.color).toBe('rgba(51, 65, 85, 0.88)');
    expect(((darkOption.yAxis as Array<{ nameTextStyle?: { color?: string } }>)[0]).nameTextStyle?.color).toBe('rgba(226, 232, 240, 0.9)');
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
