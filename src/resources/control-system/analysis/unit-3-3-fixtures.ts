import type {
  ComplexPoint,
  ControlAnalysisResult,
  RootLocusSamplePoint,
} from './types';
import type { Unit33AnalysisStepId } from './unit-3-3-request-builder';

function point(re: number, im: number, gain: number): RootLocusSamplePoint {
  return { re, im, gain };
}

function pole(re: number, im = 0): ComplexPoint {
  return { re, im };
}

function buildStep05Branches(): RootLocusSamplePoint[][] {
  return [
    [
      point(-2.6, 0, 0),
      point(-2.18, 0.22, 0.6),
      point(-1.72, 0.76, 1.2),
      point(-1.25, 1.35, 2.0),
      point(-2.08, 1.08, 3.0),
      point(-2.86, 0.52, 4.2),
      point(-3.5, 0, 5.4),
    ],
    [
      point(-0.3, 0, 0),
      point(-0.72, -0.22, 0.6),
      point(-1.18, -0.76, 1.2),
      point(-1.25, -1.35, 2.0),
      point(-2.54, -1.08, 3.0),
      point(-4.1, -0.42, 4.2),
      point(-6.4, 0, 5.4),
    ],
  ];
}

function buildStep06Branches(): RootLocusSamplePoint[][] {
  return [
    [
      point(0, 0, 0),
      point(-0.72, 0, 1),
      point(-1.4, 0, 3),
      point(-1.95, 0, 5),
      point(-2.35, 0, 8),
      point(-2.7, 0, 12),
    ],
    [
      point(-2, 0, 0),
      point(-1.88, 0.42, 1),
      point(-1.62, 1.05, 3),
      point(-1.26, 1.82, 5),
      point(-0.88, 2.65, 8),
      point(-0.52, 3.36, 12),
    ],
    [
      point(-4, 0, 0),
      point(-2.12, -0.42, 1),
      point(-2.38, -1.05, 3),
      point(-2.74, -1.82, 5),
      point(-3.12, -2.65, 8),
      point(-3.48, -3.36, 12),
    ],
  ];
}

function buildEmptyMetrics() {
  return {
    overshootPct: 0,
    riseTimeSec: null,
    settlingTimeSec: null,
    peakTimeSec: null,
    finalValue: 0,
    phaseMarginDeg: null,
    gainMarginDb: null,
    gainCrossoverRadPerSec: null,
    phaseCrossoverRadPerSec: null,
    bandwidthRadPerSec: null,
  };
}

export function getUnit33FallbackResult(stepId: Unit33AnalysisStepId): ControlAnalysisResult {
  if (stepId === 'step-05') {
    return {
      metrics: buildEmptyMetrics(),
      stepResponse: { points: [] },
      magnitude: { points: [] },
      phase: { points: [] },
      nyquist: { points: [] },
      rootLocus: {
        branches: buildStep05Branches(),
        currentPoles: [pole(-1.25, 1.35), pole(-1.25, -1.35)],
        openLoopPoles: [pole(-2.6), pole(-0.3)],
        openLoopZeros: [pole(-3.5)],
      },
      isFallback: true,
      fallbackMessage: 'Wasm 计算内核暂不可用，当前显示 3-3 讲义基线结果。',
    };
  }

  return {
    metrics: buildEmptyMetrics(),
    stepResponse: { points: [] },
    magnitude: { points: [] },
    phase: { points: [] },
    nyquist: { points: [] },
    rootLocus: {
      branches: buildStep06Branches(),
      currentPoles: [pole(-2.35), pole(-0.88, 2.65), pole(-3.12, -2.65)],
      openLoopPoles: [pole(0), pole(-2), pole(-4)],
      openLoopZeros: [],
    },
    isFallback: true,
    fallbackMessage: 'Wasm 计算内核暂不可用，当前显示 3-3 讲义基线结果。',
  };
}
