import { renderToStaticMarkup } from 'react-dom/server';

import { describe, expect, it } from 'vitest';

import type {
  ControlAnalysisResult,
  ControlEngineState,
} from '@/resources/control-system/analysis/types';
import { DEFAULT_CORRECTION_STATE } from '../multi-representation-linkage/model';
import {
  createDesignSnapshot,
  type DesignSnapshot,
  type MultiRepresentationDesignState,
} from '../multi-representation-linkage/design-snapshots';
import {
  CURRENT_DESIGN_ID,
  METRIC_DEFINITIONS,
  MetricComparisonTable,
  presentMetricCell,
  readMetric,
  resolveMetricBaselineId,
  toMetricAnalysisState,
  type MetricComparisonDesign,
} from '../multi-representation-linkage/metric-comparison';

const BASE_RESULT: ControlAnalysisResult = {
  metrics: {
    overshootPct: 14.1,
    riseTimeSec: 1.2,
    settlingTimeSec: 2.97,
    peakTimeSec: 1.8,
    finalValue: 1,
    phaseMarginDeg: 50.9,
    gainMarginDb: 12,
    gainCrossoverRadPerSec: 2,
    phaseCrossoverRadPerSec: 8,
    phaseCrossoverStatus: 'finite',
    bandwidthRadPerSec: 3.2,
  },
  stepResponse: { points: [] },
  magnitude: { points: [{ x: 1, y: 0 }] },
  phase: { points: [{ x: 1, y: -90 }] },
  nyquist: { points: [] },
  rootLocus: {
    branches: [],
    currentPoles: [],
    openLoopPoles: [],
    openLoopZeros: [],
  },
};

function readyState(result = BASE_RESULT): ControlEngineState {
  return {
    result,
    isLoading: false,
    error: null,
    isFallback: false,
  };
}

function designState(): MultiRepresentationDesignState {
  return {
    objectId: 'object-a',
    modelPoles: [{ id: 'pole-1', re: -1, im: 0, pairKey: null }],
    modelZeros: [],
    gain: 1,
    closedLoopGain: 1,
    responseType: 'step',
    showMargins: true,
    correctionState: { ...DEFAULT_CORRECTION_STATE },
    timeRange: { start: 0, end: 10, samples: 201 },
    frequencyRange: { min: 0.1, max: 100, samples: 160 },
  };
}

function snapshot(index = 0): DesignSnapshot {
  return createDesignSnapshot(designState(), index, 42);
}

function comparisonDesign(
  id: string,
  result = BASE_RESULT,
  responseType: MultiRepresentationDesignState['responseType'] = 'step',
): MetricComparisonDesign {
  return {
    id,
    name: id,
    color: '#0ea5e9',
    responseType,
    analysis: { status: 'ready', result },
  };
}

describe('control workbench metric comparison', () => {
  it('defines the ten existing time-domain and frequency-domain metrics', () => {
    expect(METRIC_DEFINITIONS.map((definition) => definition.key)).toEqual([
      'overshootPct',
      'riseTimeSec',
      'settlingTimeSec',
      'peakTimeSec',
      'finalValue',
      'phaseMarginDeg',
      'gainMarginDb',
      'gainCrossoverRadPerSec',
      'phaseCrossoverRadPerSec',
      'bandwidthRadPerSec',
    ]);
  });

  it('uses the first visible snapshot by default and replaces invalid baselines deterministically', () => {
    expect(resolveMetricBaselineId(null, ['snapshot-a', 'snapshot-b'])).toBe('snapshot-a');
    expect(resolveMetricBaselineId('snapshot-b', ['snapshot-a', 'snapshot-b'])).toBe('snapshot-b');
    expect(resolveMetricBaselineId(CURRENT_DESIGN_ID, ['snapshot-a'])).toBe(CURRENT_DESIGN_ID);
    expect(resolveMetricBaselineId('snapshot-a', ['snapshot-b'])).toBe('snapshot-b');
    expect(resolveMetricBaselineId('snapshot-a', [])).toBe(CURRENT_DESIGN_ID);
  });

  it('formats overshoot differences as percentage points rather than relative percent', () => {
    const baseline = comparisonDesign('baseline');
    const candidate = comparisonDesign('candidate', {
      ...BASE_RESULT,
      metrics: { ...BASE_RESULT.metrics, overshootPct: 18.2 },
    });
    const definition = METRIC_DEFINITIONS.find((item) => item.key === 'overshootPct')!;

    expect(presentMetricCell(definition, candidate, baseline)).toEqual({
      primary: '18.2%',
      secondary: '+4.1 个百分点',
    });
  });

  it('keeps unobserved phase crossover, unavailable data, and infinite gain margin distinct', () => {
    const gainMargin = METRIC_DEFINITIONS.find((item) => item.key === 'gainMarginDb')!;
    const phaseCrossover = METRIC_DEFINITIONS.find((item) => item.key === 'phaseCrossoverRadPerSec')!;
    const unobserved = comparisonDesign('unobserved', {
      ...BASE_RESULT,
      metrics: {
        ...BASE_RESULT.metrics,
        gainMarginDb: null,
        phaseCrossoverRadPerSec: null,
        phaseCrossoverStatus: 'notObservedInFrequencyRange',
      },
    });
    const unavailable = comparisonDesign('unavailable', {
      ...BASE_RESULT,
      metrics: {
        ...BASE_RESULT.metrics,
        gainMarginDb: null,
        phaseCrossoverRadPerSec: null,
        phaseCrossoverStatus: undefined,
      },
      magnitude: { points: [] },
      phase: { points: [] },
    });
    const infinite = comparisonDesign('infinite', {
      ...BASE_RESULT,
      metrics: {
        ...BASE_RESULT.metrics,
        gainMarginDb: Number.POSITIVE_INFINITY,
        phaseCrossoverStatus: 'finite',
      },
    });
    const legacyUnobserved = comparisonDesign('legacy-unobserved', {
      ...BASE_RESULT,
      metrics: {
        ...BASE_RESULT.metrics,
        gainMarginDb: null,
        phaseCrossoverRadPerSec: null,
        phaseCrossoverStatus: undefined,
      },
    });

    expect(readMetric(gainMargin, unobserved)).toMatchObject({
      kind: 'unavailable',
      label: '未观测到相位交叉',
    });
    expect(readMetric(phaseCrossover, unavailable)).toEqual({
      kind: 'unavailable',
      label: '指标数据不可用',
    });
    expect(readMetric(gainMargin, infinite)).toEqual({ kind: 'infinite', label: '∞ dB' });
    expect(readMetric(phaseCrossover, legacyUnobserved)).toMatchObject({
      kind: 'unavailable',
      label: '未观测到相位交叉',
    });
  });

  it('marks non-step timing metrics as not applicable', () => {
    const riseTime = METRIC_DEFINITIONS.find((item) => item.key === 'riseTimeSec')!;

    expect(readMetric(riseTime, comparisonDesign('impulse', BASE_RESULT, 'impulse'))).toEqual({
      kind: 'unavailable',
      label: '当前响应类型不适用',
    });
  });

  it('does not expose a stale result while analysis is loading or failed', () => {
    const loading = toMetricAnalysisState({
      ...readyState(),
      isLoading: true,
    });
    const failed = toMetricAnalysisState({
      ...readyState(),
      error: 'worker failed',
    });

    expect(loading).toEqual({ status: 'loading' });
    expect(failed).toEqual({ status: 'error', message: 'worker failed' });
  });

  it('renders an instructional empty state until a visible snapshot exists', () => {
    const html = renderToStaticMarkup(
      <MetricComparisonTable
        currentState={readyState()}
        currentResponseType="step"
        snapshots={[]}
        snapshotStates={{}}
      />,
    );

    expect(html).toContain('保存并显示方案快照后');
    expect(html).not.toContain('<table');
  });

  it('renders readable design columns, baseline identity, units, and horizontal access', () => {
    const savedSnapshot = snapshot();
    const html = renderToStaticMarkup(
      <MetricComparisonTable
        currentState={readyState({
          ...BASE_RESULT,
          metrics: { ...BASE_RESULT.metrics, overshootPct: 18.2 },
        })}
        currentResponseType="step"
        snapshots={[savedSnapshot]}
        snapshotStates={{ [savedSnapshot.id]: readyState() }}
      />,
    );

    expect(html).toContain('当前方案');
    expect(html).toContain(savedSnapshot.name);
    expect(html).toContain('当前基线');
    expect(html).toContain('+4.1 个百分点');
    expect(html).toContain('rad/s');
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('min-w-48');
  });
});
