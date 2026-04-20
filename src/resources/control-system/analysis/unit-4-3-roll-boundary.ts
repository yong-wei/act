import { getUnit43DesignPayload } from './unit-4-3-fixtures';

type CurvePoint = {
  x: number;
  y: number;
};

type RollBoundaryParams = {
  kp: number;
  ki: number;
  kd: number;
};

type RollBoundaryMetric = {
  baseline: number | null;
  current: number | null;
};

export type Unit43RollBoundaryComparison = {
  timeSeries: {
    baseline: CurvePoint[];
    current: CurvePoint[];
  };
  magnitudeSeries: {
    baseline: CurvePoint[];
    current: CurvePoint[];
  };
  metrics: {
    resonancePeakDb: RollBoundaryMetric;
    resonanceFrequencyRadPerSec: RollBoundaryMetric;
    amplitudeRatio: RollBoundaryMetric;
  };
};

const PLANT_A = 2.052;
const PLANT_B = 0.3929;
const DEFAULT_PARAMS: RollBoundaryParams = {
  kp: 0.7858,
  ki: 2,
  kd: 4.104,
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function finiteOr(value: number, fallback: number) {
  return Number.isFinite(value) ? value : fallback;
}

function decimate<T>(items: T[], targetCount: number) {
  if (items.length <= targetCount) {
    return items;
  }
  const stride = Math.ceil(items.length / targetCount);
  return items.filter((_, index) => index % stride === 0 || index === items.length - 1);
}

function zipCurvePoints(xs: number[], ys: number[], targetCount = 240): CurvePoint[] {
  const lastIndex = Math.min(xs.length, ys.length);
  const indexes = decimate(
    Array.from({ length: lastIndex }, (_, index) => index),
    targetCount,
  );
  return indexes.map((index) => ({
    x: xs[index]!,
    y: ys[index]!,
  }));
}

export function normalizeUnit43RollBoundaryParams(
  params: RollBoundaryParams,
): RollBoundaryParams {
  return {
    kp: clamp(Math.max(finiteOr(params.kp, DEFAULT_PARAMS.kp), 0), 0, 2),
    ki: clamp(Math.max(finiteOr(params.ki, DEFAULT_PARAMS.ki), 0), 0, 4),
    kd: clamp(Math.max(finiteOr(params.kd, DEFAULT_PARAMS.kd), 0), 0, 8),
  };
}

function evaluateDisturbanceInput(time: number) {
  return (
    (1 - Math.exp(-0.18 * time)) * Math.sin(0.681816 * time) +
    0.18 * Math.sin(1.35 * time)
  );
}

function buildClosedDenominator(params: RollBoundaryParams) {
  return {
    a: PLANT_A + params.kd,
    b: PLANT_B + params.kp,
    c: 1 + params.ki,
  };
}

function buildMagnitudePoint(params: RollBoundaryParams, omega: number): CurvePoint {
  const denominator = buildClosedDenominator(params);
  const real = denominator.c - denominator.a * omega * omega;
  const imag = denominator.b * omega;
  const magnitude = 1 / Math.max(Math.hypot(real, imag), 1e-12);
  return {
    x: omega,
    y: 20 * Math.log10(magnitude),
  };
}

function integrateClosedResponse(params: RollBoundaryParams, timeAxis: number[]) {
  const denominator = buildClosedDenominator(params);
  const points: CurvePoint[] = [];
  let state = { y: 0, yd: 0 };

  const derivative = (time: number, current: typeof state) => ({
    y: current.yd,
    yd:
      (evaluateDisturbanceInput(time) -
        denominator.b * current.yd -
        denominator.c * current.y) /
      denominator.a,
  });

  for (let index = 0; index < timeAxis.length; index += 1) {
    const time = timeAxis[index]!;
    points.push({ x: time, y: state.y });

    if (index === timeAxis.length - 1) {
      break;
    }

    const nextTime = timeAxis[index + 1]!;
    const dt = nextTime - time;
    const k1 = derivative(time, state);
    const k2 = derivative(time + dt / 2, {
      y: state.y + (dt * k1.y) / 2,
      yd: state.yd + (dt * k1.yd) / 2,
    });
    const k3 = derivative(time + dt / 2, {
      y: state.y + (dt * k2.y) / 2,
      yd: state.yd + (dt * k2.yd) / 2,
    });
    const k4 = derivative(time + dt, {
      y: state.y + dt * k3.y,
      yd: state.yd + dt * k3.yd,
    });

    state = {
      y:
        state.y +
        (dt * (k1.y + 2 * k2.y + 2 * k3.y + k4.y)) / 6,
      yd:
        state.yd +
        (dt * (k1.yd + 2 * k2.yd + 2 * k3.yd + k4.yd)) / 6,
    };
  }

  return points;
}

export function buildUnit43RollBoundaryComparison(
  params: RollBoundaryParams,
): Unit43RollBoundaryComparison {
  const normalized = normalizeUnit43RollBoundaryParams(params);
  const baseline = getUnit43DesignPayload('roll_boundary');
  const timeAxis = baseline.time_open?.t ?? [];
  const magnitudeAxis = baseline.bode_before?.w ?? [];

  const fullTimeSeries = integrateClosedResponse(normalized, timeAxis);
  const fullMagnitudeSeries = magnitudeAxis.map((omega) =>
    buildMagnitudePoint(normalized, omega),
  );
  const currentPeak = fullMagnitudeSeries.reduce<CurvePoint | null>(
    (best, point) => (!best || point.y > best.y ? point : best),
    null,
  );
  const openPeak = baseline.resonance?.open_peak_db ?? null;

  return {
    timeSeries: {
      baseline: zipCurvePoints(
        baseline.time_open?.t ?? [],
        baseline.time_open?.y ?? [],
      ),
      current: zipCurvePoints(
        fullTimeSeries.map((point) => point.x),
        fullTimeSeries.map((point) => point.y),
      ),
    },
    magnitudeSeries: {
      baseline: zipCurvePoints(
        baseline.bode_before?.w ?? [],
        baseline.bode_before?.mag_db ?? [],
      ),
      current: zipCurvePoints(
        fullMagnitudeSeries.map((point) => point.x),
        fullMagnitudeSeries.map((point) => point.y),
      ),
    },
    metrics: {
      resonancePeakDb: {
        baseline: baseline.resonance?.open_peak_db ?? null,
        current: currentPeak?.y ?? null,
      },
      resonanceFrequencyRadPerSec: {
        baseline: baseline.resonance?.open_w ?? null,
        current: currentPeak?.x ?? null,
      },
      amplitudeRatio: {
        baseline: 1,
        current:
          currentPeak && openPeak != null
            ? Math.pow(10, (currentPeak.y - openPeak) / 20)
            : null,
      },
    },
  };
}
