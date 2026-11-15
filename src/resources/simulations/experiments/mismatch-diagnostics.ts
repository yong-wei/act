export interface MismatchThresholds {
  rmseThreshold: number;
  pointThreshold: number;
  unitLabel: string;
}

export interface MismatchInterval {
  startS: number;
  endS: number;
  rmsResidual: number;
  peakResidual: number;
  peakTimeS: number;
}

export interface MismatchDiagnostics {
  validCount: number;
  residuals: Array<number | null>;
  upperBand: Array<number | null>;
  lowerBand: Array<number | null>;
  rmse: number;
  meanBias: number;
  peakResidual: number;
  peakTimeS: number | null;
  thresholds: MismatchThresholds;
  intervals: MismatchInterval[];
  isExceeded: boolean;
  reasonHint: string;
}

export interface ResidualDiagnosticsInput {
  timeS: number[];
  actual: Array<number | null>;
  predicted: Array<number | null>;
  outputUnit?: string | null;
  outputChannel?: string | null;
  rmseThreshold?: number;
  pointThreshold?: number;
}

/**
 * Downsample time-series indices evenly while always retaining the final endpoint.
 */
export function downsampleSeriesIndices(length: number, maxPoints = 800): number[] {
  if (length <= 0) return [];
  const cap = Math.max(2, maxPoints);
  if (length <= cap) return Array.from({ length }, (_, index) => index);
  const stride = Math.max(1, Math.ceil(length / cap));
  const indices: number[] = [];
  for (let index = 0; index < length; index += stride) {
    indices.push(index);
  }
  if (indices[indices.length - 1] !== length - 1) {
    indices.push(length - 1);
  }
  return indices;
}

/**
 * Resolve channel- and unit-aware RMSE / pointwise residual thresholds.
 */
export function resolveMismatchThresholds(
  outputUnit?: string | null,
  outputChannel?: string | null,
  signalSpan?: number,
): MismatchThresholds {
  const unit = (outputUnit ?? '').toLowerCase();
  const channel = (outputChannel ?? '').toLowerCase();

  if (channel.includes('roll') || unit.includes('roll')) {
    return { rmseThreshold: 1.8, pointThreshold: 3.0, unitLabel: '°' };
  }
  if (
    channel.includes('heading') ||
    channel.includes('yaw') ||
    channel.includes('course') ||
    unit === '°' ||
    unit.includes('deg')
  ) {
    return { rmseThreshold: 2.5, pointThreshold: 4.0, unitLabel: '°' };
  }
  if (
    channel.includes('speed') ||
    channel.includes('surge') ||
    channel.includes('sway') ||
    unit.includes('m/s')
  ) {
    return { rmseThreshold: 0.35, pointThreshold: 0.6, unitLabel: 'm/s' };
  }
  if (
    channel.includes('distance') ||
    channel.includes('east') ||
    channel.includes('north') ||
    channel.includes('clearance') ||
    channel.includes('error_m') ||
    unit === 'm'
  ) {
    return { rmseThreshold: 1.0, pointThreshold: 1.5, unitLabel: 'm' };
  }

  const adaptiveRmse = Math.max(0.5, Number(((signalSpan ?? 10) * 0.12).toFixed(3)));
  return {
    rmseThreshold: adaptiveRmse,
    pointThreshold: Number((adaptiveRmse * 1.5).toFixed(3)),
    unitLabel: outputUnit?.trim() || '',
  };
}

function inferMismatchHint(outputChannel?: string | null, intervals: MismatchInterval[] = []): string {
  const channel = (outputChannel ?? '').toLowerCase();
  const hasFaultWindow = intervals.some((item) => item.endS >= 180 || item.peakTimeS >= 180);
  if (hasFaultWindow) {
    return 't ≥ 180 s 后模型偏差扩大，建议排查执行器故障/饱和削顶与物理工况跃变。';
  }
  if (channel.includes('roll')) {
    return '大横摇或减摇鳍饱和/失速区间偏离小角度线性假设。';
  }
  if (channel.includes('speed')) {
    return '大舵角机动掉速或阻力平方项导致线性近似失配。';
  }
  if (channel.includes('east') || channel.includes('clearance') || channel.includes('dp')) {
    return '低频线性化工作点外漂，或推力重分配与尾流耦合引发非线性偏差。';
  }
  return '执行器饱和、水动力非线性耦合或工作点外推导致实测偏离线性预测。';
}

/**
 * Compute |Truth/Instrument - StudentModel| residuals, shaded band bounds, and exceedance intervals.
 */
export function computeResidualDiagnostics({
  timeS,
  actual,
  predicted,
  outputUnit,
  outputChannel,
  rmseThreshold,
  pointThreshold,
}: ResidualDiagnosticsInput): MismatchDiagnostics {
  const length = Math.min(timeS.length, actual.length, predicted.length);
  const residuals: Array<number | null> = new Array(length).fill(null);
  const upperBand: Array<number | null> = new Array(length).fill(null);
  const lowerBand: Array<number | null> = new Array(length).fill(null);

  let validCount = 0;
  let sqSum = 0;
  let signedSum = 0;
  let peakResidual = 0;
  let peakTimeS: number | null = null;
  let minVal = Number.POSITIVE_INFINITY;
  let maxVal = Number.NEGATIVE_INFINITY;

  const validIndices: number[] = [];
  for (let i = 0; i < length; i += 1) {
    const a = actual[i];
    const p = predicted[i];
    const t = timeS[i];
    if (
      typeof a !== 'number' ||
      typeof p !== 'number' ||
      typeof t !== 'number' ||
      !Number.isFinite(a) ||
      !Number.isFinite(p) ||
      !Number.isFinite(t)
    ) {
      continue;
    }
    const diff = a - p;
    const absDiff = Math.abs(diff);
    residuals[i] = absDiff;
    upperBand[i] = Math.max(a, p);
    lowerBand[i] = Math.min(a, p);

    validCount += 1;
    validIndices.push(i);
    sqSum += diff * diff;
    signedSum += diff;
    minVal = Math.min(minVal, a, p);
    maxVal = Math.max(maxVal, a, p);
    if (absDiff >= peakResidual) {
      peakResidual = absDiff;
      peakTimeS = t;
    }
  }

  const signalSpan = Number.isFinite(minVal) && Number.isFinite(maxVal) ? Math.max(0, maxVal - minVal) : undefined;
  const resolved = resolveMismatchThresholds(outputUnit, outputChannel, signalSpan);
  const thresholds: MismatchThresholds = {
    rmseThreshold: rmseThreshold ?? resolved.rmseThreshold,
    pointThreshold: pointThreshold ?? resolved.pointThreshold,
    unitLabel: resolved.unitLabel,
  };

  if (validCount === 0) {
    return {
      validCount: 0,
      residuals,
      upperBand,
      lowerBand,
      rmse: 0,
      meanBias: 0,
      peakResidual: 0,
      peakTimeS: null,
      thresholds,
      intervals: [],
      isExceeded: false,
      reasonHint: inferMismatchHint(outputChannel, []),
    };
  }

  const rmse = Math.sqrt(sqSum / validCount);
  const meanBias = signedSum / validCount;

  // Compute local rolling RMSE on valid indices to identify contiguous mismatch intervals.
  const halfWin = Math.min(8, Math.max(2, Math.floor(validCount / 16)));
  const exceedingFlags = new Array<boolean>(validIndices.length).fill(false);

  for (let k = 0; k < validIndices.length; k += 1) {
    const idx = validIndices[k];
    const res = residuals[idx] ?? 0;
    const lo = Math.max(0, k - halfWin);
    const hi = Math.min(validIndices.length - 1, k + halfWin);
    let winSq = 0;
    for (let j = lo; j <= hi; j += 1) {
      const r = residuals[validIndices[j]] ?? 0;
      winSq += r * r;
    }
    const winRms = Math.sqrt(winSq / (hi - lo + 1));
    exceedingFlags[k] = res > thresholds.pointThreshold || winRms > thresholds.rmseThreshold;
  }

  const intervals: MismatchInterval[] = [];
  let runStart = -1;
  for (let k = 0; k <= validIndices.length; k += 1) {
    const isHit = k < validIndices.length && exceedingFlags[k];
    if (isHit && runStart === -1) {
      runStart = k;
    } else if (!isHit && runStart !== -1) {
      const runEnd = k - 1;
      const startIdx = validIndices[runStart];
      const endIdx = validIndices[runEnd];
      const count = runEnd - runStart + 1;
      let segSq = 0;
      let segPeak = 0;
      let segPeakTime = timeS[startIdx];
      for (let j = runStart; j <= runEnd; j += 1) {
        const idx = validIndices[j];
        const r = residuals[idx] ?? 0;
        segSq += r * r;
        if (r >= segPeak) {
          segPeak = r;
          segPeakTime = timeS[idx];
        }
      }
      const rmsResidual = Math.sqrt(segSq / count);
      if (count >= 2 || segPeak >= thresholds.pointThreshold * 1.25) {
        intervals.push({
          startS: timeS[startIdx],
          endS: timeS[endIdx],
          rmsResidual,
          peakResidual: segPeak,
          peakTimeS: segPeakTime,
        });
      }
      runStart = -1;
    }
  }

  const isExceeded = rmse > thresholds.rmseThreshold || intervals.length > 0;

  return {
    validCount,
    residuals,
    upperBand,
    lowerBand,
    rmse,
    meanBias,
    peakResidual,
    peakTimeS,
    thresholds,
    intervals,
    isExceeded,
    reasonHint: inferMismatchHint(outputChannel, intervals),
  };
}
