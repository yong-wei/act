import type {
  ComplexPoint,
  ControlAnalysisRequest,
  ControlAnalysisResult,
  CurvePoint,
  RootLocusSamplePoint,
  StructureSpec,
} from './types';

export interface LinkageTimeDomainResponse {
  samples: Array<{ time: number; response: number }>;
  metrics: {
    overshoot: number;
    settlingTime: number;
    riseTime: number;
    steadyStateError: number;
  };
}

export interface LinkageNyquistSample extends ComplexPoint {
  frequency: number;
  magnitudeDb: number;
  phaseDeg: number;
}

export interface LinkageFrequencyDomainResponse {
  samples: Array<{ frequency: number; magnitudeDb: number; phaseDeg: number }>;
  nyquistSamples: LinkageNyquistSample[];
  nyquistKeyPoints: NonNullable<ControlAnalysisResult['nyquist']['keyPoints']>;
  nyquistEncirclements: number;
  nyquistCriterion?: NonNullable<ControlAnalysisResult['nyquist']['criterion']>;
  stabilityMargins: {
    gainMargin: { value: number; frequency: number; isInfinite?: boolean };
    phaseMargin: { value: number; frequency: number };
  };
  marginPoints: {
    gainCrossover?: LinkageNyquistSample;
    phaseCrossover?: LinkageNyquistSample;
  };
}

export interface LinkageStabilityResponse {
  isStable: boolean;
  polesInRHP: number;
  dampingRatios: number[];
  hints: string[];
  closedLoopPoles: ComplexPoint[];
  rootLocus: {
    branches: RootLocusSamplePoint[][];
    gainRange: {
      min: number;
      max: number;
      points: number;
    };
    selectedGain: number;
    closedLoopPoles: ComplexPoint[];
  };
  stabilityMargins: LinkageFrequencyDomainResponse['stabilityMargins'];
}

export interface LinkageAnalysisViewModel {
  timeDomain: LinkageTimeDomainResponse;
  frequencyDomain: LinkageFrequencyDomainResponse;
  stability: LinkageStabilityResponse;
}

interface BuildLinkageAnalysisRequestInput {
  poles: ComplexPoint[];
  zeros: ComplexPoint[];
  gain: number;
  rootLocusGain?: number;
  correctionStructures?: StructureSpec[];
  includeOpenLoopGain?: boolean;
  plantLabel?: string;
  plant?: ControlAnalysisRequest['plant'];
  caseId?: string;
  outputs?: ControlAnalysisRequest['outputs'];
  responseType: NonNullable<ControlAnalysisRequest['responseType']>;
  timeRange?: ControlAnalysisRequest['timeRange'];
  frequencyRange?: ControlAnalysisRequest['frequencyRange'];
}

export type CorrectionKind = 'pi' | 'pd' | 'pid' | 'lead' | 'lag' | 'lead_lag';

export interface PidCorrectionInput {
  enabled: boolean;
  kp: number;
  ki?: number;
  kd?: number;
  ti?: number;
  td?: number;
  derivativeFilterEnabled?: boolean;
  tf?: number;
}

export interface FrequencyTurnCorrectionInput {
  kind: 'lead' | 'lag' | 'lead_lag';
  enabled: boolean;
  zeroFrequency?: number;
  poleFrequency?: number;
  leadZeroFrequency?: number;
  leadPoleFrequency?: number;
  lagZeroFrequency?: number;
  lagPoleFrequency?: number;
  gain?: number;
}

const DEFAULT_TIME_RANGE = { start: 0, end: 20, samples: 401 } as const;
const DEFAULT_FREQUENCY_RANGE = { min: 0.1, max: 100, samples: 140 } as const;

function round12(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (Math.abs(value) < 1e-12) {
    return 0;
  }
  return Math.round(value * 1e12) / 1e12;
}

function round6(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 1e6) / 1e6;
}

function complexAbs(point: ComplexPoint): number {
  return Math.hypot(point.re, point.im);
}

function positiveFinite(value: number | null | undefined, fallback: number): number {
  return Number.isFinite(value ?? NaN) && (value as number) > 0 ? value as number : fallback;
}

export function buildPidCorrection(input: PidCorrectionInput): StructureSpec {
  const kp = positiveFinite(input.kp, 1);
  const ki = input.ki != null && Number.isFinite(input.ki)
    ? Math.max(0, input.ki)
    : input.ti != null && input.ti > 0
      ? kp / input.ti
      : 0;
  const kd = input.kd != null && Number.isFinite(input.kd)
    ? Math.max(0, input.kd)
    : input.td != null && input.td > 0
      ? kp * input.td
      : 0;
  const ti = ki > 0 ? kp / ki : 0;
  const td = kp > 0 ? kd / kp : 0;
  const params: Record<string, number> = {
    kp: round12(kp),
    ki: round12(ki),
    kd: round12(kd),
    ti: round12(ti),
    td: round12(td),
  };

  if (input.derivativeFilterEnabled) {
    params.tf = positiveFinite(input.tf, 0.03);
  }

  return {
    kind: 'pid',
    enabled: input.enabled,
    params,
    label: 'C(s)',
  };
}

export function buildFrequencyTurnCorrection(input: FrequencyTurnCorrectionInput): StructureSpec {
  const k = positiveFinite(input.gain, 1);
  if (input.kind === 'lead') {
    const zeroFrequency = positiveFinite(input.zeroFrequency, 1);
    const poleFrequency = positiveFinite(input.poleFrequency, zeroFrequency * 4);
    return {
      kind: 'lead',
      enabled: input.enabled,
      params: {
        k,
        tau: round12(1 / zeroFrequency),
        alpha: round12(zeroFrequency / poleFrequency),
      },
      label: 'C(s)',
    };
  }

  if (input.kind === 'lag') {
    const zeroFrequency = positiveFinite(input.zeroFrequency, 0.2);
    const poleFrequency = positiveFinite(input.poleFrequency, zeroFrequency / 4);
    return {
      kind: 'lag',
      enabled: input.enabled,
      params: {
        k,
        tau: round12(1 / zeroFrequency),
        beta: round12(zeroFrequency / poleFrequency),
      },
      label: 'C(s)',
    };
  }

  const leadZeroFrequency = positiveFinite(input.leadZeroFrequency, 1);
  const leadPoleFrequency = positiveFinite(input.leadPoleFrequency, leadZeroFrequency * 4);
  const lagZeroFrequency = positiveFinite(input.lagZeroFrequency, 0.2);
  const lagPoleFrequency = positiveFinite(input.lagPoleFrequency, lagZeroFrequency / 4);

  return {
    kind: 'lead_lag',
    enabled: input.enabled,
    params: {
      k,
      tauLead: round12(1 / leadZeroFrequency),
      alphaLead: round12(leadZeroFrequency / leadPoleFrequency),
      tauLag: round12(1 / lagZeroFrequency),
      betaLag: round12(lagZeroFrequency / lagPoleFrequency),
    },
    label: 'C(s)',
  };
}

export function buildCorrectionStructure(kind: CorrectionKind, params: Record<string, number>, enabled: boolean): StructureSpec {
  return {
    kind,
    enabled,
    params,
    label: 'C(s)',
  };
}

function polyFromRoots(roots: ComplexPoint[]): number[] {
  if (roots.length === 0) {
    return [1];
  }

  let coeffs = [{ re: 1, im: 0 }];
  for (const root of roots) {
    const next = Array.from({ length: coeffs.length + 1 }, () => ({ re: 0, im: 0 }));
    for (let index = 0; index < coeffs.length; index += 1) {
      const coeff = coeffs[index];
      next[index] = {
        re: next[index].re + coeff.re,
        im: next[index].im + coeff.im,
      };
      next[index + 1] = {
        re: next[index + 1].re - (coeff.re * root.re - coeff.im * root.im),
        im: next[index + 1].im - (coeff.re * root.im + coeff.im * root.re),
      };
    }
    coeffs = next;
  }

  return coeffs.map((coeff) => round12(coeff.re));
}

function recommendRootLocusMaxGain(poles: ComplexPoint[], zeros: ComplexPoint[], currentGain: number): number {
  const poleScale = Math.max(1, ...poles.map(complexAbs));
  const zeroScale = Math.max(1, ...zeros.map(complexAbs));
  const order = Math.max(1, poles.length);
  const estimate = (poleScale + zeroScale + 1) ** order;
  const target = Math.max(40, currentGain * 2, estimate);
  return Math.min(Math.max(target, 10), 5000);
}

function dampingRatio(pole: ComplexPoint): number {
  const magnitude = Math.hypot(pole.re, pole.im);
  if (magnitude < 1e-9) {
    return 1;
  }
  return -pole.re / magnitude;
}

function deriveHints(
  closedLoopPoles: ComplexPoint[],
  isStable: boolean,
  polesInRHP: number,
  stabilityMargins: LinkageFrequencyDomainResponse['stabilityMargins'],
): string[] {
  const hints: string[] = [];

  if (closedLoopPoles.some((pole) => Math.abs(pole.re) < 0.3)) {
    hints.push('闭环极点靠近虚轴，系统阻尼减小，时域振荡可能加剧。');
  }

  if (!isStable) {
    hints.push('存在右半平面闭环极点，系统不稳定，建议在根轨迹上将闭环极点左移。');
  }

  if (!stabilityMargins.gainMargin.isInfinite && stabilityMargins.gainMargin.value < 6) {
    hints.push('增益裕度偏低，建议降低交叉频率或增加超前校正。');
  }

  if (stabilityMargins.phaseMargin.value < 30) {
    hints.push('相位裕度偏低，超调风险较高，可提升阻尼或减小回路增益。');
  }

  if (polesInRHP === 0 && hints.length === 0) {
    hints.push('闭环极点位于左半平面，稳定性良好，可继续优化速度与超调折中。');
  }

  return hints;
}

function findClosestNyquistSample(
  samples: LinkageNyquistSample[],
  targetFrequency: number | null | undefined,
): LinkageNyquistSample | undefined {
  if (!Number.isFinite(targetFrequency ?? NaN)) {
    return undefined;
  }

  let best: LinkageNyquistSample | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const sample of samples) {
    const distance = Math.abs(sample.frequency - (targetFrequency as number));
    if (distance < bestDistance) {
      best = sample;
      bestDistance = distance;
    }
  }

  return best;
}

function mergeBodeSamples(
  magnitude: CurvePoint[],
  phase: CurvePoint[],
): Array<{ frequency: number; magnitudeDb: number; phaseDeg: number }> {
  const count = Math.max(magnitude.length, phase.length);
  const output: Array<{ frequency: number; magnitudeDb: number; phaseDeg: number }> = [];

  for (let index = 0; index < count; index += 1) {
    const magnitudePoint = magnitude[index];
    const phasePoint = phase[index];
    const frequency = magnitudePoint?.x ?? phasePoint?.x;

    if (!Number.isFinite(frequency)) {
      continue;
    }

    output.push({
      frequency: frequency as number,
      magnitudeDb: magnitudePoint?.y ?? 0,
      phaseDeg: phasePoint?.y ?? 0,
    });
  }

  return output;
}

export function buildLinkageAnalysisRequest(
  input: BuildLinkageAnalysisRequestInput,
): ControlAnalysisRequest {
  const sanitizedGain = Number.isFinite(input.gain) ? Math.max(0, input.gain) : 0;
  const sanitizedRootLocusGain = Number.isFinite(input.rootLocusGain ?? NaN)
    ? Math.max(0, input.rootLocusGain as number)
    : sanitizedGain;
  const numerator = polyFromRoots(input.zeros);
  const denominator = polyFromRoots(input.poles);
  const outputs = input.outputs ?? ['step_response', 'root_locus', 'magnitude', 'phase', 'nyquist', 'bode'];
  const includeOpenLoopGain = input.includeOpenLoopGain ?? true;
  const correctionStructures = input.correctionStructures?.filter((structure) => structure.enabled) ?? [];
  const maxGain = recommendRootLocusMaxGain(
    input.poles,
    input.zeros,
    Math.max(sanitizedGain, sanitizedRootLocusGain),
  );

  const plant = input.plant ?? {
    numerator,
    denominator,
    coefficientOrder: 'descending' as const,
    label: input.plantLabel ?? '多表征联动开环模型',
  };

  return {
    runtimeMode: 'analysis' as const,
    caseId: input.caseId ?? 'multi-representation-linkage',
    plant,
    structures: [
      ...(includeOpenLoopGain
        ? [{ kind: 'gain', enabled: true, params: { k: sanitizedGain }, label: 'K' } satisfies StructureSpec]
        : []),
      ...correctionStructures,
    ],
    outputs,
    responseType: input.responseType,
    timeRange: input.timeRange ?? DEFAULT_TIME_RANGE,
    frequencyRange: input.frequencyRange ?? DEFAULT_FREQUENCY_RANGE,
    nyquist: {
      mode: 'full',
      samplingMode: 'adaptive',
    },
    rootLocus: {
      minGain: 0,
      maxGain,
      samples: 96,
      currentGain: sanitizedRootLocusGain,
    },
    delay: undefined,
    discreteConfig: undefined,
    stateSpaceSpec: undefined,
    referenceProfile: undefined,
    disturbanceProfile: undefined,
  };
}

export function adaptLinkageAnalysisResult(result: ControlAnalysisResult): LinkageAnalysisViewModel {
  const frequencySamples = mergeBodeSamples(result.magnitude.points, result.phase.points);
  const positiveNyquistPoints = result.nyquist.positivePoints ?? result.nyquist.points;
  const positiveNyquistCount = Math.min(
    positiveNyquistPoints.length,
    frequencySamples.length,
  );
  const nyquistSamples: LinkageNyquistSample[] = frequencySamples
    .slice(0, positiveNyquistCount)
    .map((sample, index) => ({
      re: positiveNyquistPoints[index]?.re ?? 0,
      im: positiveNyquistPoints[index]?.im ?? 0,
      frequency: sample.frequency,
      magnitudeDb: sample.magnitudeDb,
      phaseDeg: sample.phaseDeg,
    }));

  const phaseMargin = {
    value: result.metrics.phaseMarginDeg ?? 0,
    frequency: result.metrics.gainCrossoverRadPerSec ?? 0,
  };
  const gainMargin = {
    value: result.metrics.gainMarginDb ?? 0,
    frequency: result.metrics.phaseCrossoverRadPerSec ?? 0,
    isInfinite: result.metrics.gainMarginDb == null,
  };

  const closedLoopPoles = result.rootLocus.currentPoles;
  const polesInRHP = closedLoopPoles.filter((pole) => pole.re > 0).length;
  const isStable = polesInRHP === 0;
  const stabilityMargins = {
    phaseMargin,
    gainMargin,
  };

  return {
    timeDomain: {
      samples: result.stepResponse.points.map((point) => ({
        time: point.x,
        response: point.y,
      })),
      metrics: {
        overshoot: result.metrics.overshootPct,
        settlingTime: result.metrics.settlingTimeSec ?? 0,
        riseTime: result.metrics.riseTimeSec ?? 0,
        steadyStateError: round6(Math.abs(1 - result.metrics.finalValue)),
      },
    },
    frequencyDomain: {
      samples: frequencySamples,
      nyquistSamples,
      nyquistKeyPoints: result.nyquist.keyPoints ?? [],
      nyquistEncirclements: result.nyquist.encirclements ?? 0,
      nyquistCriterion: result.nyquist.criterion,
      stabilityMargins,
      marginPoints: {
        gainCrossover: findClosestNyquistSample(nyquistSamples, result.metrics.gainCrossoverRadPerSec),
        phaseCrossover: gainMargin.isInfinite
          ? undefined
          : findClosestNyquistSample(nyquistSamples, result.metrics.phaseCrossoverRadPerSec),
      },
    },
    stability: {
      isStable,
      polesInRHP,
      dampingRatios: closedLoopPoles.map(dampingRatio),
      hints: deriveHints(closedLoopPoles, isStable, polesInRHP, stabilityMargins),
      closedLoopPoles,
      rootLocus: {
        branches: result.rootLocus.branches,
        gainRange: {
          min: 0,
          max: Math.max(
            0,
            ...result.rootLocus.branches.flatMap((branch) =>
              branch.map((point) => point.gain ?? 0),
            ),
          ),
          points: Math.max(...result.rootLocus.branches.map((branch) => branch.length), 0),
        },
        selectedGain: result.rootLocus.branches
          .flatMap((branch) => branch)
          .find((point) => point.re === closedLoopPoles[0]?.re && point.im === closedLoopPoles[0]?.im)
          ?.gain ?? 0,
        closedLoopPoles,
      },
      stabilityMargins,
    },
  };
}
