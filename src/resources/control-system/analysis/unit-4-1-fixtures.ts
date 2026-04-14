import rawCaseData from '../../../../course-content/authoring/lessons/4-1/media/raw/generated-data/4-1-case-data.json';

import type {
  ComplexPoint,
  ControlAnalysisResult,
  CurvePoint,
  FeasibleRegionConfig,
} from './types';

type Unit41CaseKey = 'ship_heading' | 'platform_pitch';
type Unit41StepId = 'step-04' | 'step-05';

interface RawCasePayload {
  k_ref: number;
  step: { t: number[]; y: number[] };
  bode: { w: number[]; mag_db: number[]; phase_deg: number[] };
  margins: { pm: number; gm_db: number; wc: number; wg: number };
  root_locus: { real: number[][]; imag: number[][] };
  root_locus_full?: { real: number[][]; imag: number[][] };
  closed_loop_poles: { real: number[] | number; imag: number[] | number };
  open_loop_poles: { real: number[] | number; imag: number[] | number };
  open_loop_zeros: { real: number[] | number; imag: number[] | number };
  feasible_region: {
    zeta_min: number;
    sigma_min: number;
    mp_ratio?: number;
    settling_time?: number;
  };
  step_metrics: {
    overshoot: number;
    rise_time: number;
    settling_time: number;
    peak_time: number;
    final_value: number;
  };
}

const CASE_MAP: Record<Unit41StepId, Unit41CaseKey> = {
  'step-04': 'ship_heading',
  'step-05': 'platform_pitch',
};

function decimate<T>(items: T[], targetCount: number) {
  if (items.length <= targetCount) {
    return items;
  }
  const stride = Math.ceil(items.length / targetCount);
  return items.filter((_, index) => index % stride === 0 || index === items.length - 1);
}

function zipCurvePoints(xs: number[], ys: number[], targetCount: number): CurvePoint[] {
  const indexes = decimate(Array.from({ length: Math.min(xs.length, ys.length) }, (_, index) => index), targetCount);
  return indexes.map((index) => ({ x: xs[index]!, y: ys[index]! }));
}

function zipComplexPoints(reals: number[], imags: number[]): ComplexPoint[] {
  return reals.map((re, index) => ({ re, im: imags[index] ?? 0 }));
}

function asArray(value: number[] | number): number[] {
  return Array.isArray(value) ? value : [value];
}

function buildNyquistPoints(payload: RawCasePayload): ComplexPoint[] {
  const positive = payload.bode.w.map((omega, index) => {
    const magnitude = Math.pow(10, payload.bode.mag_db[index]! / 20);
    const phaseRad = (payload.bode.phase_deg[index]! * Math.PI) / 180;
    return {
      re: magnitude * Math.cos(phaseRad),
      im: magnitude * Math.sin(phaseRad),
      omega,
    };
  });
  const forward = decimate(positive, 240).map(({ re, im }) => ({ re, im }));
  const mirrored = [...forward]
    .reverse()
    .slice(1)
    .map(({ re, im }) => ({ re, im: -im }));
  return [...forward, ...mirrored];
}

function buildRootLocusBranches(
  locus: { real: number[][]; imag: number[][] },
  targetCount: number,
) {
  return locus.real.map((realBranch, branchIndex) => {
    const imagBranch = locus.imag[branchIndex] ?? [];
    return decimate(realBranch.map((re, index) => ({ re, im: imagBranch[index] ?? 0 })), targetCount);
  });
}

function normalizeFeasibleRegion(payload: RawCasePayload): FeasibleRegionConfig {
  return {
    zetaMin: payload.feasible_region.zeta_min,
    sigmaMin: payload.feasible_region.sigma_min,
    mpRatio: payload.feasible_region.mp_ratio,
    settlingTime: payload.feasible_region.settling_time,
  };
}

export function getUnit41FallbackResult(stepId: Unit41StepId): ControlAnalysisResult {
  const caseId = CASE_MAP[stepId];
  const payload = (rawCaseData as unknown as { cases: Record<Unit41CaseKey, RawCasePayload> }).cases[caseId];

  return {
    metrics: {
      overshootPct: payload.step_metrics.overshoot,
      riseTimeSec: payload.step_metrics.rise_time,
      settlingTimeSec: payload.step_metrics.settling_time,
      peakTimeSec: payload.step_metrics.peak_time,
      finalValue: payload.step_metrics.final_value,
      phaseMarginDeg: payload.margins.pm,
      gainMarginDb: payload.margins.gm_db,
      gainCrossoverRadPerSec: payload.margins.wc,
      phaseCrossoverRadPerSec: payload.margins.wg,
      bandwidthRadPerSec: payload.margins.wc,
    },
    stepResponse: {
      points: zipCurvePoints(payload.step.t, payload.step.y, 240),
    },
    magnitude: {
      points: zipCurvePoints(payload.bode.w, payload.bode.mag_db, 240),
    },
    phase: {
      points: zipCurvePoints(payload.bode.w, payload.bode.phase_deg, 240),
    },
    nyquist: {
      points: buildNyquistPoints(payload),
    },
    rootLocus: {
      branches: buildRootLocusBranches(payload.root_locus, 256),
      fullBranches: payload.root_locus_full ? buildRootLocusBranches(payload.root_locus_full, 360) : undefined,
      currentPoles: zipComplexPoints(asArray(payload.closed_loop_poles.real), asArray(payload.closed_loop_poles.imag)),
      openLoopPoles: zipComplexPoints(asArray(payload.open_loop_poles.real), asArray(payload.open_loop_poles.imag)),
      openLoopZeros: zipComplexPoints(asArray(payload.open_loop_zeros.real), asArray(payload.open_loop_zeros.imag)),
      feasibleRegion: normalizeFeasibleRegion(payload),
    },
    isFallback: true,
    fallbackMessage: 'Wasm 计算内核暂不可用，当前显示离线基线结果。',
  };
}
