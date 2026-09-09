import rawCaseData from '../../../../course-content/runtime/lessons/4-3/media/generated-data/4-3-compound-design-data.json';

import type {
  ComplexPoint,
  ControlAnalysisResult,
  CurvePoint,
} from './types';

export type Unit43PanelId =
  | 'pi_lead'
  | 'lag_lead'
  | 'pid_filtered'
  | 'heading_case'
  | 'roll_boundary';

type RawCurve = {
  t?: number[];
  y?: number[];
  w?: number[];
  mag_db?: number[];
  phase_deg?: number[];
};

type RawMargins = {
  pm: number | null;
  gm_db: number | null;
  wc: number | null;
  wg: number | null;
};

type RawMetrics = {
  overshoot: number;
  rise_time: number | null;
  settling_time: number | null;
  peak_time: number | null;
  final_value: number;
  steady_state_error?: number;
  control_peak?: number;
};

type RawPoleSet = {
  real: number[] | number;
  imag: number[] | number;
};

type DesignPayload = {
  id: string;
  plant_tex: string;
  controller_tex: string;
  goal_lines?: string[];
  step_before?: RawCurve;
  step_after?: RawCurve;
  bode_plant?: RawCurve;
  bode_loop_after?: RawCurve;
  metrics_before?: RawMetrics;
  metrics_after?: RawMetrics;
  margins_before?: RawMargins;
  margins_after?: RawMargins;
  before_closed_poles?: RawPoleSet;
  after_closed_poles?: RawPoleSet;
  before_open_loop_poles?: RawPoleSet;
  before_open_loop_zeros?: RawPoleSet;
  after_open_loop_poles?: RawPoleSet;
  after_open_loop_zeros?: RawPoleSet;
  bode_before?: RawCurve;
  bode_after?: RawCurve;
  time_open?: RawCurve;
  time_closed?: RawCurve;
  resonance?: {
    open_peak_db: number;
    closed_peak_db: number;
    open_w: number;
    closed_w: number;
    amplitude_ratio: number;
  };
};

const CASE_MAP: Record<Unit43PanelId, keyof typeof rawCaseData> = {
  pi_lead: 'pi_lead',
  lag_lead: 'lag_lead',
  pid_filtered: 'pid',
  heading_case: 'heading_case',
  roll_boundary: 'roll_boundary',
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

function asArray(value?: number[] | number): number[] {
  if (typeof value === 'undefined') {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function buildNyquistPoints(curve?: RawCurve): ComplexPoint[] {
  if (!curve?.w || !curve.mag_db || !curve.phase_deg) {
    return [];
  }
  const positive = curve.w.map((omega, index) => {
    const magnitude = Math.pow(10, curve.mag_db![index]! / 20);
    const phaseRad = (curve.phase_deg![index]! * Math.PI) / 180;
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
  poles?: RawPoleSet,
  closedPoles?: RawPoleSet,
): ComplexPoint[][] {
  const openLoopPoles = zipComplexPoints(asArray(poles?.real), asArray(poles?.imag));
  const currentPoles = zipComplexPoints(asArray(closedPoles?.real), asArray(closedPoles?.imag));
  return openLoopPoles.length || currentPoles.length ? [openLoopPoles, currentPoles] : [];
}

function getDesignPayload(panelId: Unit43PanelId) {
  return rawCaseData[CASE_MAP[panelId]] as DesignPayload;
}

export function getUnit43DesignPayload(panelId: Unit43PanelId) {
  return getDesignPayload(panelId);
}

export function getUnit43FallbackResult(panelId: Unit43PanelId): ControlAnalysisResult {
  const payload = getDesignPayload(panelId);

  if (panelId === 'roll_boundary') {
    return {
      metrics: {
        overshootPct: 0,
        riseTimeSec: null,
        settlingTimeSec: null,
        peakTimeSec: null,
        finalValue: 0,
        phaseMarginDeg: 60,
        gainMarginDb: null,
        gainCrossoverRadPerSec: payload.resonance?.closed_w ?? null,
        phaseCrossoverRadPerSec: null,
        bandwidthRadPerSec: payload.resonance?.closed_w ?? null,
      },
      stepResponse: {
        points: zipCurvePoints(payload.time_closed?.t ?? [], payload.time_closed?.y ?? [], 240),
      },
      magnitude: {
        points: zipCurvePoints(payload.bode_after?.w ?? [], payload.bode_after?.mag_db ?? [], 240),
      },
      phase: {
        points: zipCurvePoints(payload.bode_after?.w ?? [], payload.bode_after?.phase_deg ?? [], 240),
      },
      nyquist: {
        points: buildNyquistPoints(payload.bode_after),
      },
      rootLocus: {
        branches: [],
        currentPoles: [],
        openLoopPoles: [],
        openLoopZeros: [],
        feasibleRegion: undefined,
      },
      isFallback: true,
      fallbackMessage: 'Wasm 计算内核暂不可用，当前显示 4-3 边界案例离线基线结果。',
    };
  }

  return {
    metrics: {
      overshootPct: payload.metrics_after?.overshoot ?? 0,
      riseTimeSec: payload.metrics_after?.rise_time ?? null,
      settlingTimeSec: payload.metrics_after?.settling_time ?? null,
      peakTimeSec: payload.metrics_after?.peak_time ?? null,
      finalValue: payload.metrics_after?.final_value ?? 0,
      phaseMarginDeg: payload.margins_after?.pm ?? null,
      gainMarginDb: payload.margins_after?.gm_db ?? null,
      gainCrossoverRadPerSec: payload.margins_after?.wc ?? null,
      phaseCrossoverRadPerSec: payload.margins_after?.wg ?? null,
      bandwidthRadPerSec: payload.margins_after?.wc ?? null,
    },
    stepResponse: {
      points: zipCurvePoints(payload.step_after?.t ?? [], payload.step_after?.y ?? [], 240),
    },
    magnitude: {
      points: zipCurvePoints(payload.bode_loop_after?.w ?? [], payload.bode_loop_after?.mag_db ?? [], 240),
    },
    phase: {
      points: zipCurvePoints(payload.bode_loop_after?.w ?? [], payload.bode_loop_after?.phase_deg ?? [], 240),
    },
    nyquist: {
      points: buildNyquistPoints(payload.bode_loop_after),
    },
    rootLocus: {
      branches: buildRootLocusBranches(payload.after_open_loop_poles, payload.after_closed_poles),
      currentPoles: zipComplexPoints(asArray(payload.after_closed_poles?.real), asArray(payload.after_closed_poles?.imag)),
      openLoopPoles: zipComplexPoints(asArray(payload.after_open_loop_poles?.real), asArray(payload.after_open_loop_poles?.imag)),
      openLoopZeros: zipComplexPoints(asArray(payload.after_open_loop_zeros?.real), asArray(payload.after_open_loop_zeros?.imag)),
      feasibleRegion: undefined,
    },
    isFallback: true,
    fallbackMessage: 'Wasm 计算内核暂不可用，当前显示 4-3 离线基线结果。',
  };
}
