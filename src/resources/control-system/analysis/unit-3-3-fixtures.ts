import type {
  ComplexPoint,
  ControlAnalysisResult,
  RootLocusSamplePoint,
} from './types';
import type { Unit33AnalysisStepId } from './unit-3-3-request-builder';

function point(re: number, im: number, gain: number, branchId?: number, sampleIndex?: number): RootLocusSamplePoint {
  return { re, im, gain, branchId, sampleIndex };
}

function pole(re: number, im = 0): ComplexPoint {
  return { re, im };
}

function buildStep05Branches(): RootLocusSamplePoint[][] {
  return [
    [
      point(-2.6, 0, 0, 0, 0),
      point(-2.4223, 0, 0.35, 0, 1),
      point(-1.8029, 0, 0.7059, 0, 2),
      point(-1.9750, -0.7446, 1.05, 0, 3),
      point(-2.1250, -0.9947, 1.35, 0, 4),
      point(-2.2750, -1.1745, 1.65, 0, 5),
      point(-2.4250, -1.3132, 1.95, 0, 6),
      point(-2.5500, -1.4062, 2.2, 0, 7),
      point(-2.7000, -1.4967, 2.5, 0, 8),
      point(-3.0000, -1.6217, 3.1, 0, 9),
      point(-3.6500, -1.6904, 4.4, 0, 10),
      point(-5.1971, 0, 7.4941, 0, 11),
      point(-8.8630, 0, 10, 0, 12),
      point(-13.1000, 0, 14, 0, 13),
      point(-19.2168, 0, 20, 0, 14),
    ],
    [
      point(-0.3, 0, 0, 1, 0),
      point(-0.8277, 0, 0.35, 1, 1),
      point(-1.8029, 0, 0.7059, 1, 2),
      point(-1.9750, 0.7446, 1.05, 1, 3),
      point(-2.1250, 0.9947, 1.35, 1, 4),
      point(-2.2750, 1.1745, 1.65, 1, 5),
      point(-2.4250, 1.3132, 1.95, 1, 6),
      point(-2.5500, 1.4062, 2.2, 1, 7),
      point(-2.7000, 1.4967, 2.5, 1, 8),
      point(-3.0000, 1.6217, 3.1, 1, 9),
      point(-3.6500, 1.6904, 4.4, 1, 10),
      point(-5.1971, 0, 7.4941, 1, 11),
      point(-4.0370, 0, 10, 1, 12),
      point(-3.8000, 0, 14, 1, 13),
      point(-3.6832, 0, 20, 1, 14),
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
