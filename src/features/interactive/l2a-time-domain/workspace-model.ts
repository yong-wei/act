'use client';

export type L2AFamily = 'overdamped' | 'critical' | 'underdamped' | 'oscillatory' | 'unstable';

export interface L2AWorkspaceStateModel {
  zeta: number;
  wn: number;
  selectedPreset: string | null;
  lastMeasuredAt: number | null;
}

export interface L2AResponsePoint {
  t: number;
  y: number;
}

export interface L2ASecondOrderPoles {
  primary: { re: number; im: number };
  secondary: { re: number; im: number };
}

export interface L2ASecondOrderMetrics {
  family: L2AFamily;
  overshoot: number;
  settlingTime: number;
  riseTime: number;
  peakTime: number;
}

export interface L2ASecondOrderResponse extends L2ASecondOrderMetrics {
  points: L2AResponsePoint[];
  poles: L2ASecondOrderPoles;
  duration: number;
}

const EPSILON = 1e-4;

export const DEFAULT_L2A_WORKSPACE_STATE: L2AWorkspaceStateModel = {
  zeta: 0.45,
  wn: 1.8,
  selectedPreset: 'balanced',
  lastMeasuredAt: null,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function classifySecondOrderFamily(zeta: number): L2AFamily {
  if (zeta < 0) return 'unstable';
  if (Math.abs(zeta) <= EPSILON) return 'oscillatory';
  if (Math.abs(zeta - 1) <= EPSILON) return 'critical';
  if (zeta > 1) return 'overdamped';
  return 'underdamped';
}

export function computePoles(zeta: number, wn: number): L2ASecondOrderPoles {
  const safeWn = Math.max(0.05, wn);
  const family = classifySecondOrderFamily(zeta);

  if (family === 'overdamped') {
    const root = Math.sqrt(Math.max(zeta * zeta - 1, 0));
    return {
      primary: { re: -safeWn * (zeta - root), im: 0 },
      secondary: { re: -safeWn * (zeta + root), im: 0 },
    };
  }

  if (family === 'critical') {
    return {
      primary: { re: -safeWn, im: 0 },
      secondary: { re: -safeWn, im: 0 },
    };
  }

  const imag = safeWn * Math.sqrt(Math.max(1 - zeta * zeta, 0));
  const real = -zeta * safeWn;
  return {
    primary: { re: real, im: imag },
    secondary: { re: real, im: -imag },
  };
}

export function computeSecondOrderMetrics({
  zeta,
  wn,
}: {
  zeta: number;
  wn: number;
}): L2ASecondOrderMetrics {
  const safeWn = Math.max(0.05, wn);
  const family = classifySecondOrderFamily(zeta);

  if (family === 'underdamped') {
    const wd = safeWn * Math.sqrt(1 - zeta * zeta);
    const phi = Math.acos(clamp(zeta, -1, 1));
    return {
      family,
      overshoot: Math.exp((-zeta * Math.PI) / Math.sqrt(1 - zeta * zeta)) * 100,
      settlingTime: 4 / (zeta * safeWn),
      riseTime: (Math.PI - phi) / wd,
      peakTime: Math.PI / wd,
    };
  }

  if (family === 'critical') {
    return {
      family,
      overshoot: 0,
      settlingTime: 4 / safeWn,
      riseTime: 2.2 / safeWn,
      peakTime: 0,
    };
  }

  if (family === 'overdamped') {
    const root = Math.sqrt(zeta * zeta - 1);
    const dominant = safeWn * (zeta - root);
    return {
      family,
      overshoot: 0,
      settlingTime: dominant > EPSILON ? 4 / dominant : Infinity,
      riseTime: 2.8 / safeWn,
      peakTime: 0,
    };
  }

  if (family === 'oscillatory') {
    return {
      family,
      overshoot: 100,
      settlingTime: Infinity,
      riseTime: Math.PI / (2 * safeWn),
      peakTime: Math.PI / safeWn,
    };
  }

  return {
    family,
    overshoot: 0,
    settlingTime: Infinity,
    riseTime: Infinity,
    peakTime: 0,
  };
}

function computeResponseValue(zeta: number, wn: number, t: number) {
  const family = classifySecondOrderFamily(zeta);

  if (family === 'underdamped') {
    const wd = wn * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * wn * t);
    return 1 - decay * (Math.cos(wd * t) + (zeta / Math.sqrt(1 - zeta * zeta)) * Math.sin(wd * t));
  }

  if (family === 'critical') {
    return 1 - Math.exp(-wn * t) * (1 + wn * t);
  }

  if (family === 'overdamped') {
    const alpha = wn * (zeta - Math.sqrt(zeta * zeta - 1));
    const beta = wn * (zeta + Math.sqrt(zeta * zeta - 1));
    return 1 - (beta * Math.exp(-alpha * t) - alpha * Math.exp(-beta * t)) / (beta - alpha);
  }

  if (family === 'oscillatory') {
    return 1 - Math.cos(wn * t);
  }

  const unstableZeta = Math.abs(zeta);
  const wd = wn * Math.sqrt(Math.max(1 - unstableZeta * unstableZeta, EPSILON));
  const growth = Math.exp(unstableZeta * wn * t);
  return 1 - growth * Math.cos(wd * t);
}

export function computeSecondOrderResponse({
  zeta,
  wn,
  pointCount = 180,
}: {
  zeta: number;
  wn: number;
  pointCount?: number;
}): L2ASecondOrderResponse {
  const safeWn = Math.max(0.05, wn);
  const metrics = computeSecondOrderMetrics({ zeta, wn: safeWn });
  const poles = computePoles(zeta, safeWn);
  const durationBase = Number.isFinite(metrics.settlingTime)
    ? metrics.settlingTime * 1.35
    : metrics.peakTime > 0
      ? metrics.peakTime * 3
      : 12 / safeWn;
  const duration = clamp(durationBase, 4, 28);

  const points = Array.from({ length: pointCount }, (_, index) => {
    const t = (duration * index) / Math.max(pointCount - 1, 1);
    const y = computeResponseValue(zeta, safeWn, t);
    return {
      t,
      y: clamp(y, -0.2, 2.6),
    };
  });

  return {
    ...metrics,
    duration,
    points,
    poles,
  };
}
