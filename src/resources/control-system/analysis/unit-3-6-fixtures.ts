import rawDesignData from '../../../../course-content/authoring/lessons/3-6/media/raw/generated-data/3-6-design-data.json';

import type { ComplexPoint, ControlAnalysisResult, CurvePoint, FeasibleRegionConfig } from './types';

interface RawCurveBundle {
  real: number[][];
  imag: number[][];
}

interface RawDesignData {
  specs: {
    mp_max: number;
    ts2_max: number;
    zeta_min: number;
    sigma_min: number;
  };
  base: {
    root_locus: RawCurveBundle;
    open_loop_poles: number[];
    open_loop_zeros: number[];
    k_gain_limit: number;
    limit_metrics: {
      final_value: number;
      overshoot: number;
      settling_time_2pct: number;
      response: { t: number[]; y: number[] };
    };
  };
}

function decimate<T>(items: T[], targetCount: number) {
  if (items.length <= targetCount) {
    return items;
  }
  const stride = Math.ceil(items.length / targetCount);
  return items.filter((_, index) => index % stride === 0 || index === items.length - 1);
}

function zipCurvePoints(xs: number[], ys: number[], targetCount: number): CurvePoint[] {
  const items = Array.from({ length: Math.min(xs.length, ys.length) }, (_, index) => ({ x: xs[index]!, y: ys[index]! }));
  return decimate(items, targetCount);
}

function buildRootLocusBranches(bundle: RawCurveBundle, targetCount: number): ComplexPoint[][] {
  return bundle.real.map((realBranch, branchIndex) => {
    const imagBranch = bundle.imag[branchIndex] ?? [];
    return decimate(
      realBranch.map((re, index) => ({ re, im: imagBranch[index] ?? 0 })),
      targetCount,
    );
  });
}

function solveCurrentPoles(gain: number): ComplexPoint[] {
  const real = -0.4;
  const delta = 16 * gain - 0.64;
  if (delta <= 0) {
    const root = Math.sqrt(0.64 - 16 * gain) / 2;
    return [
      { re: real + root, im: 0 },
      { re: real - root, im: 0 },
    ];
  }
  const imag = Math.sqrt(delta) / 2;
  return [
    { re: real, im: imag },
    { re: real, im: -imag },
  ];
}

function toPointList(values: number[]): ComplexPoint[] {
  return values.map((value) => ({ re: value, im: 0 }));
}

export function getUnit36PureGainFallbackResult(): ControlAnalysisResult {
  const data = rawDesignData as RawDesignData;
  const feasibleRegion: FeasibleRegionConfig = {
    zetaMin: data.specs.zeta_min,
    sigmaMin: data.specs.sigma_min,
    mpRatio: data.specs.mp_max / 100,
    settlingTime: data.specs.ts2_max,
  };

  return {
    metrics: {
      overshootPct: data.base.limit_metrics.overshoot,
      riseTimeSec: null,
      settlingTimeSec: data.base.limit_metrics.settling_time_2pct,
      peakTimeSec: null,
      finalValue: data.base.limit_metrics.final_value,
      phaseMarginDeg: null,
      gainMarginDb: null,
      gainCrossoverRadPerSec: null,
      phaseCrossoverRadPerSec: null,
      bandwidthRadPerSec: null,
    },
    stepResponse: {
      points: zipCurvePoints(
        data.base.limit_metrics.response.t,
        data.base.limit_metrics.response.y,
        240,
      ),
    },
    magnitude: { points: [] },
    phase: { points: [] },
    nyquist: { points: [] },
    rootLocus: {
      branches: buildRootLocusBranches(data.base.root_locus, 240),
      currentPoles: solveCurrentPoles(data.base.k_gain_limit),
      openLoopPoles: toPointList(data.base.open_loop_poles),
      openLoopZeros: toPointList(data.base.open_loop_zeros),
      feasibleRegion,
    },
    isFallback: true,
    fallbackMessage: 'Wasm 计算内核暂不可用，当前显示 3-6 讲义基线结果。',
  };
}
