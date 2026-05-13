'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  CRUISE_DEFAULT_PID,
  buildOpenLoopFromController,
  estimateControllerFromOpenLoop,
  type CruiseControllerMode,
  type CruiseControllerParams,
} from '@/lib/cruise-course';
import {
  adaptLinkageAnalysisResult,
  buildFrequencyTurnCorrection,
  buildLinkageAnalysisRequest,
  buildPidCorrection,
  type CorrectionKind,
} from '@/resources/control-system/analysis/multi-representation-linkage-analysis';
import type {
  ComplexPoint as Complex,
  ControlAnalysisResult,
  ControlAnalysisRequest,
  ControlEngineState,
  StructureSpec,
} from '@/resources/control-system/analysis/types';
import type { BodeTurnFrequencyHandle } from '@/resources/control-system/charts/control-bode-options';
import type { RootLocusInteractiveHandle } from '@/resources/control-system/charts/control-analysis-panels';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';
import {
  resolveArenaWorkbenchContext,
  type ArenaWorkbenchContext,
} from '@/features/arena';
import { buildArenaWorkbenchPreviewSummary } from '@/features/arena/workbench/metric-mapping';

export interface MultiRepresentationInitialParams {
  courseMode?: boolean;
  role?: 'teacher' | 'student';
  embed?: boolean;
  controlMode?: CruiseControllerMode;
  controller?: Partial<CruiseControllerParams>;
  arenaTaskId?: string;
}

export interface PoleZeroPoint {
  id: string;
  re: number;
  im: number;
  pairKey: string | null;
}

export type LinkageResponseType = 'step' | 'impulse' | 'ramp';
export type { CorrectionKind };

export interface CorrectionState {
  enabled: boolean;
  kind: CorrectionKind;
  kp: number;
  ki: number;
  kd: number;
  ti: number;
  td: number;
  derivativeFilterEnabled: boolean;
  tf: number;
  leadZeroFrequency: number;
  leadPoleFrequency: number;
  lagZeroFrequency: number;
  lagPoleFrequency: number;
}

export const DEFAULT_CORRECTION_STATE: CorrectionState = {
  enabled: false,
  kind: 'pid',
  kp: 1,
  ki: 0.2,
  kd: 0.08,
  ti: 5,
  td: 0.08,
  derivativeFilterEnabled: false,
  tf: 0.03,
  leadZeroFrequency: 1,
  leadPoleFrequency: 5,
  lagZeroFrequency: 0.2,
  lagPoleFrequency: 0.05,
};

const DEFAULT_LINKAGE_TIME_RANGE: ControlAnalysisRequest['timeRange'] = { start: 0, end: 20, samples: 401 };
const DEFAULT_LINKAGE_FREQUENCY_RANGE: ControlAnalysisRequest['frequencyRange'] = { min: 0.1, max: 100, samples: 140 };

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function toComplex(point: PoleZeroPoint): Complex {
  return {
    re: round3(point.re),
    im: round3(point.im),
  };
}

function updatePointWithConjugateLink(
  points: PoleZeroPoint[],
  pointId: string,
  next: Complex,
): PoleZeroPoint[] {
  const rounded = { re: round3(next.re), im: round3(next.im) };
  const target = points.find((item) => item.id === pointId);
  if (!target) {
    return points;
  }

  return points.map((item) => {
    if (item.id === pointId) {
      return { ...item, ...rounded };
    }
    if (target.pairKey && item.pairKey === target.pairKey) {
      return { ...item, re: rounded.re, im: round3(-rounded.im) };
    }
    return item;
  });
}

function removePointWithPair(points: PoleZeroPoint[], pointId: string): PoleZeroPoint[] {
  const target = points.find((item) => item.id === pointId);
  if (!target) {
    return points;
  }
  return target.pairKey
    ? points.filter((item) => item.pairKey !== target.pairKey)
    : points.filter((item) => item.id !== pointId);
}

function toPoleZeroPoints(points: Complex[], prefix: 'p' | 'z'): PoleZeroPoint[] {
  const result: PoleZeroPoint[] = [];
  const used = new Set<number>();
  let index = 1;

  for (let i = 0; i < points.length; i += 1) {
    if (used.has(i)) {
      continue;
    }
    const point = points[i];
    if (Math.abs(point.im) < 1e-6) {
      result.push({ id: `${prefix}${index++}`, re: round3(point.re), im: 0, pairKey: null });
      used.add(i);
      continue;
    }

    const conjugateIndex = points.findIndex(
      (candidate, idx) =>
        idx !== i
        && !used.has(idx)
        && Math.abs(candidate.re - point.re) < 1e-6
        && Math.abs(candidate.im + point.im) < 1e-6,
    );

    if (conjugateIndex >= 0) {
      const pairKey = `${prefix}-pair-${index}`;
      result.push({ id: `${prefix}${index}`, re: round3(point.re), im: round3(Math.abs(point.im)), pairKey });
      result.push({ id: `${prefix}${index + 1}`, re: round3(point.re), im: round3(-Math.abs(point.im)), pairKey });
      index += 2;
      used.add(i);
      used.add(conjugateIndex);
      continue;
    }

    result.push({ id: `${prefix}${index++}`, re: round3(point.re), im: round3(point.im), pairKey: null });
    used.add(i);
  }

  return result;
}

function normalizedPointKey(point: Complex): string {
  return `${round3(point.re)}:${round3(Math.abs(point.im) < 1e-6 ? 0 : point.im)}`;
}

function normalizedPointKeys(points: Complex[]): string[] {
  return points.map(normalizedPointKey).sort();
}

function syncCorrectionTimeConstants(state: CorrectionState): CorrectionState {
  const kp = Math.max(0.0001, state.kp);
  const ki = Math.max(0, state.ki);
  const kd = Math.max(0, state.kd);
  return {
    ...state,
    kp: round3(kp),
    ki: round3(ki),
    kd: round3(kd),
    ti: ki > 0 ? round3(kp / ki) : 0,
    td: kp > 0 ? round3(kd / kp) : 0,
  };
}

export function setCorrectionTi(state: CorrectionState, ti: number): CorrectionState {
  const nextTi = Math.max(0, ti);
  const nextKi = nextTi > 0 ? state.kp / nextTi : 0;
  return syncCorrectionTimeConstants({ ...state, ki: nextKi, ti: nextTi });
}

export function setCorrectionTd(state: CorrectionState, td: number): CorrectionState {
  const nextTd = Math.max(0, td);
  return syncCorrectionTimeConstants({ ...state, kd: state.kp * nextTd, td: nextTd });
}

export function correctionToStructures(state: CorrectionState, isCourseMode: boolean): StructureSpec[] {
  if (isCourseMode || !state.enabled) {
    return [];
  }

  if (state.kind === 'pi') {
    return [buildPidCorrection({
      enabled: true,
      kp: state.kp,
      ki: state.ki,
      kd: 0,
      derivativeFilterEnabled: false,
    })];
  }

  if (state.kind === 'pd') {
    return [buildPidCorrection({
      enabled: true,
      kp: state.kp,
      ki: 0,
      kd: state.kd,
      derivativeFilterEnabled: state.derivativeFilterEnabled,
      tf: state.tf,
    })];
  }

  if (state.kind === 'pid') {
    return [buildPidCorrection({
      enabled: true,
      kp: state.kp,
      ki: state.ki,
      kd: state.kd,
      derivativeFilterEnabled: state.derivativeFilterEnabled,
      tf: state.tf,
    })];
  }

  if (state.kind === 'lead') {
    return [buildFrequencyTurnCorrection({
      kind: 'lead',
      enabled: true,
      zeroFrequency: state.leadZeroFrequency,
      poleFrequency: state.leadPoleFrequency,
    })];
  }

  if (state.kind === 'lag') {
    return [buildFrequencyTurnCorrection({
      kind: 'lag',
      enabled: true,
      zeroFrequency: state.lagZeroFrequency,
      poleFrequency: state.lagPoleFrequency,
    })];
  }

  return [buildFrequencyTurnCorrection({
    kind: 'lead_lag',
    enabled: true,
    leadZeroFrequency: state.leadZeroFrequency,
    leadPoleFrequency: state.leadPoleFrequency,
    lagZeroFrequency: state.lagZeroFrequency,
    lagPoleFrequency: state.lagPoleFrequency,
  })];
}

export function correctionToTurnFrequencyHandles(state: CorrectionState, isCourseMode: boolean): BodeTurnFrequencyHandle[] {
  if (isCourseMode || !state.enabled) {
    return [];
  }
  if (state.kind === 'lead') {
    return [
      { id: 'lead-zero', label: '超前零点', frequency: state.leadZeroFrequency },
      { id: 'lead-pole', label: '超前极点', frequency: state.leadPoleFrequency },
    ];
  }
  if (state.kind === 'lag') {
    return [
      { id: 'lag-zero', label: '滞后零点', frequency: state.lagZeroFrequency },
      { id: 'lag-pole', label: '滞后极点', frequency: state.lagPoleFrequency },
    ];
  }
  if (state.kind === 'lead_lag') {
    return [
      { id: 'lead-zero', label: '超前零点', frequency: state.leadZeroFrequency },
      { id: 'lead-pole', label: '超前极点', frequency: state.leadPoleFrequency },
      { id: 'lag-zero', label: '滞后零点', frequency: state.lagZeroFrequency },
      { id: 'lag-pole', label: '滞后极点', frequency: state.lagPoleFrequency },
    ];
  }
  return [];
}

function realAxisFrequencyPoint(frequency: number): Complex {
  return { re: -Math.max(0.001, frequency), im: 0 };
}

function realPolynomialRoots(coefficients: number[]): Complex[] {
  const trimmed = coefficients.slice();
  while (trimmed.length > 0 && Math.abs(trimmed[0]) < 1e-12) {
    trimmed.shift();
  }
  if (trimmed.length <= 1) {
    return [];
  }
  if (trimmed.length === 2) {
    const [a, b] = trimmed;
    return [{ re: -b / a, im: 0 }];
  }
  const [a, b, c] = trimmed;
  const discriminant = b * b - 4 * a * c;
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    return [
      { re: (-b + root) / (2 * a), im: 0 },
      { re: (-b - root) / (2 * a), im: 0 },
    ];
  }
  const real = -b / (2 * a);
  const imag = Math.sqrt(-discriminant) / (2 * a);
  return [{ re: real, im: imag }, { re: real, im: -imag }];
}

function pidZeroPoints(state: CorrectionState): Complex[] {
  const kp = Math.max(0.0001, state.kp);
  const ki = Math.max(0, state.ki);
  const kd = Math.max(0, state.kd);
  const tf = state.derivativeFilterEnabled ? Math.max(0.001, state.tf) : 0;

  if (ki <= 1e-9 && tf > 0) {
    return realPolynomialRoots([kp * tf + kd, kp]);
  }
  if (ki <= 1e-9) {
    return realPolynomialRoots([kd, kp]);
  }
  if (tf > 0) {
    return realPolynomialRoots([kp * tf + kd, kp + ki * tf, ki]);
  }
  return realPolynomialRoots([kd, kp, ki]);
}

export function correctionToRootHandles(state: CorrectionState, isCourseMode: boolean): RootLocusInteractiveHandle[] {
  if (isCourseMode || !state.enabled) {
    return [];
  }
  if (state.kind === 'lead') {
    return [
      { id: 'lead-zero', kind: 'zero', renderAs: 'correction-zero', point: realAxisFrequencyPoint(state.leadZeroFrequency), draggable: true, ariaLabel: '拖动超前校正零点' },
      { id: 'lead-pole', kind: 'pole', renderAs: 'correction-pole', point: realAxisFrequencyPoint(state.leadPoleFrequency), draggable: true, ariaLabel: '拖动超前校正极点' },
    ];
  }
  if (state.kind === 'lag') {
    return [
      { id: 'lag-zero', kind: 'zero', renderAs: 'correction-zero', point: realAxisFrequencyPoint(state.lagZeroFrequency), draggable: true, ariaLabel: '拖动滞后校正零点' },
      { id: 'lag-pole', kind: 'pole', renderAs: 'correction-pole', point: realAxisFrequencyPoint(state.lagPoleFrequency), draggable: true, ariaLabel: '拖动滞后校正极点' },
    ];
  }
  if (state.kind === 'lead_lag') {
    return [
      { id: 'lead-zero', kind: 'zero', renderAs: 'correction-zero', point: realAxisFrequencyPoint(state.leadZeroFrequency), draggable: true, ariaLabel: '拖动超前校正零点' },
      { id: 'lead-pole', kind: 'pole', renderAs: 'correction-pole', point: realAxisFrequencyPoint(state.leadPoleFrequency), draggable: true, ariaLabel: '拖动超前校正极点' },
      { id: 'lag-zero', kind: 'zero', renderAs: 'correction-zero', point: realAxisFrequencyPoint(state.lagZeroFrequency), draggable: true, ariaLabel: '拖动滞后校正零点' },
      { id: 'lag-pole', kind: 'pole', renderAs: 'correction-pole', point: realAxisFrequencyPoint(state.lagPoleFrequency), draggable: true, ariaLabel: '拖动滞后校正极点' },
    ];
  }
  return [
    ...pidZeroPoints(state).map((point, index) => ({
      id: `pid-zero-${index}`,
      kind: 'zero' as const,
      renderAs: 'correction-zero' as const,
      point,
      draggable: true,
      ariaLabel: `拖动 PID 校正零点 ${index + 1}`,
    })),
    ...(state.kind === 'pi' || state.kind === 'pid'
      ? [{
          id: 'pid-integrator-pole',
          kind: 'pole' as const,
          renderAs: 'correction-pole' as const,
          point: { re: 0, im: 0 },
          draggable: false,
          ariaLabel: 'PID 积分器原点极点',
        }]
      : []),
    ...(state.derivativeFilterEnabled && (state.kind === 'pd' || state.kind === 'pid')
      ? [{
          id: 'pid-filter-pole',
          kind: 'pole' as const,
          renderAs: 'correction-pole' as const,
          point: realAxisFrequencyPoint(1 / Math.max(0.001, state.tf)),
          draggable: true,
          ariaLabel: '拖动微分滤波极点',
        }]
      : []),
  ];
}

export function doesRootLocusMatchPoleZeroSet(
  result: ControlAnalysisResult | null,
  poles: Complex[],
  zeros: Complex[],
): boolean {
  if (!result) {
    return false;
  }
  const resultPoleKeys = normalizedPointKeys(result.rootLocus.openLoopPoles);
  const resultZeroKeys = normalizedPointKeys(result.rootLocus.openLoopZeros);
  const currentPoleKeys = normalizedPointKeys(poles);
  const currentZeroKeys = normalizedPointKeys(zeros);
  return resultPoleKeys.length === currentPoleKeys.length
    && resultZeroKeys.length === currentZeroKeys.length
    && resultPoleKeys.every((key, index) => key === currentPoleKeys[index])
    && resultZeroKeys.every((key, index) => key === currentZeroKeys[index]);
}

function correctionHandlesToPoleZeroSet(handles: RootLocusInteractiveHandle[]): {
  poles: Complex[];
  zeros: Complex[];
} {
  return {
    poles: handles.filter((handle) => handle.kind === 'pole').map((handle) => handle.point),
    zeros: handles.filter((handle) => handle.kind === 'zero').map((handle) => handle.point),
  };
}

function mergeClosedLoopSelectionResult(
  openLoopResult: ControlAnalysisResult | null,
  selectedResult: ControlAnalysisResult | null,
  selectedGain: number,
): ControlAnalysisResult | null {
  if (!openLoopResult) {
    return null;
  }
  const selectedPoles = openLoopResult.rootLocus.branches
    .map((branch) => branch.reduce((best, point) => {
      const bestDistance = Math.abs((best.gain ?? 0) - selectedGain);
      const pointDistance = Math.abs((point.gain ?? 0) - selectedGain);
      return pointDistance < bestDistance ? point : best;
    }, branch[0]))
    .filter((point): point is NonNullable<typeof point> => Boolean(point))
    .map((point) => ({ re: point.re, im: point.im }));
  if (!selectedResult) {
    return {
      ...openLoopResult,
      rootLocus: {
        ...openLoopResult.rootLocus,
        currentGain: selectedGain,
        currentPoles: selectedPoles.length > 0 ? selectedPoles : openLoopResult.rootLocus.currentPoles,
      },
    };
  }
  return {
    ...openLoopResult,
    metrics: {
      ...openLoopResult.metrics,
      overshootPct: selectedResult.metrics.overshootPct,
      riseTimeSec: selectedResult.metrics.riseTimeSec,
      settlingTimeSec: selectedResult.metrics.settlingTimeSec,
      peakTimeSec: selectedResult.metrics.peakTimeSec,
      finalValue: selectedResult.metrics.finalValue,
    },
    stepResponse: selectedResult.stepResponse,
    rootLocus: {
      ...openLoopResult.rootLocus,
      currentGain: selectedGain,
      currentPoles: selectedPoles.length > 0 ? selectedPoles : openLoopResult.rootLocus.currentPoles,
    },
  };
}

function mergeAnalysisState(
  openLoopState: ControlEngineState,
  selectedState: ControlEngineState,
  result: ControlAnalysisResult | null,
): ControlEngineState {
  return {
    result,
    isLoading: openLoopState.isLoading || selectedState.isLoading,
    error: openLoopState.error ?? selectedState.error,
    isFallback: openLoopState.isFallback || selectedState.isFallback,
  };
}

export function useMultiRepresentationLinkageModel(initialParams: MultiRepresentationInitialParams) {
  const arenaContext = useMemo<ArenaWorkbenchContext | null>(() => {
    if (!initialParams.arenaTaskId) return null;
    return resolveArenaWorkbenchContext(initialParams.arenaTaskId);
  }, [initialParams.arenaTaskId]);

  const hasArenaTaskId = Boolean(initialParams.arenaTaskId);
  const arenaContextMissing = hasArenaTaskId && !arenaContext;
  const isCourseMode = Boolean(initialParams.courseMode);
  const isArenaChallengeMode = Boolean(arenaContext && !arenaContextMissing);
  const isLockedByChallenge = isArenaChallengeMode && arenaContext!.locked;
  const isLockedOrCourse = isLockedByChallenge || isCourseMode;

  const courseRole = initialParams.role ?? 'student';
  const isEmbedded = Boolean(initialParams.embed);
  const initialControlMode = initialParams.controlMode ?? 'pid';
  const initialKp = initialParams.controller?.kp ?? CRUISE_DEFAULT_PID.kp;
  const initialKi = initialParams.controller?.ki ?? CRUISE_DEFAULT_PID.ki;
  const initialKd = initialParams.controller?.kd ?? CRUISE_DEFAULT_PID.kd;
  const initialController = useMemo<CruiseControllerParams>(() => ({
    kp: initialKp,
    ki: initialKi,
    kd: initialKd,
  }), [initialKd, initialKi, initialKp]);
  const openLoopSeed = useMemo(
    () => buildOpenLoopFromController(initialController, initialControlMode),
    [initialController, initialControlMode],
  );

  const arenaSeed = useMemo(() => {
    if (!isArenaChallengeMode || !arenaContext?.object.workbenchSeed) return null;
    return arenaContext.object.workbenchSeed;
  }, [arenaContext, isArenaChallengeMode]);

  const effectiveSeed = arenaSeed ?? openLoopSeed;

  const [modelPoles, setModelPoles] = useState(() => toPoleZeroPoints(effectiveSeed.poles, 'p'));
  const [modelZeros, setModelZeros] = useState(() => toPoleZeroPoints(effectiveSeed.zeros, 'z'));
  const [gain, setGain] = useState(isArenaChallengeMode ? 1 : effectiveSeed.gain);
  const [closedLoopGain, setClosedLoopGain] = useState(isArenaChallengeMode ? 1 : effectiveSeed.gain);
  const [courseControlMode, setCourseControlMode] = useState<CruiseControllerMode>(initialControlMode);
  const [responseType, setResponseType] = useState<LinkageResponseType>('step');
  const [showMargins, setShowMargins] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [correctionState, setCorrectionState] = useState<CorrectionState>(() => ({
    ...DEFAULT_CORRECTION_STATE,
    enabled: isArenaChallengeMode || (!isCourseMode && DEFAULT_CORRECTION_STATE.enabled),
  }));
  const effectiveTimeRange = arenaContext?.object.timeRange ?? undefined;
  const effectiveFreqRange = arenaContext?.object.frequencyRange ?? undefined;
  const [timeRange, setTimeRange] = useState<ControlAnalysisRequest['timeRange']>(
    effectiveTimeRange ?? DEFAULT_LINKAGE_TIME_RANGE,
  );
  const [frequencyRange, setFrequencyRange] = useState<ControlAnalysisRequest['frequencyRange']>(
    effectiveFreqRange ?? DEFAULT_LINKAGE_FREQUENCY_RANGE,
  );

  const idRef = useRef(100);
  const pairRef = useRef(100);
  const baseControllerRef = useRef<CruiseControllerParams>(initialController);
  const lastValidOpenLoopResultRef = useRef<ControlAnalysisResult | null>(null);
  const lastValidCorrectedResultRef = useRef<ControlAnalysisResult | null>(null);
  const lastVisibleAnalysisResultRef = useRef<ControlAnalysisResult | null>(null);

  const arenaPlant = useMemo(() => {
    if (!isArenaChallengeMode || !arenaContext?.object.model) return undefined;
    return {
      numerator: arenaContext.object.model.numerator,
      denominator: arenaContext.object.model.denominator,
      coefficientOrder: 'descending' as const,
      label: arenaContext.object.name,
    };
  }, [arenaContext, isArenaChallengeMode]);

  const arenaCaseId = useMemo(() => {
    if (!isArenaChallengeMode) return undefined;
    return arenaContext!.task.id;
  }, [arenaContext, isArenaChallengeMode]);

  const polesPayload = useMemo(() => modelPoles.map(toComplex), [modelPoles]);
  const zerosPayload = useMemo(() => modelZeros.map(toComplex), [modelZeros]);
  const correctionStructures = useMemo(
    () => correctionToStructures(correctionState, isCourseMode),
    [correctionState, isCourseMode],
  );
  const turnFrequencyHandles = useMemo(
    () => correctionToTurnFrequencyHandles(correctionState, isCourseMode),
    [correctionState, isCourseMode],
  );
  const correctionRootHandles = useMemo(
    () => correctionToRootHandles(correctionState, isCourseMode),
    [correctionState, isCourseMode],
  );
  const correctionEnabled = !isCourseMode && correctionStructures.length > 0;

  const baseRequestInput = useMemo(() => ({
    poles: polesPayload,
    zeros: zerosPayload,
    gain,
    plant: arenaPlant,
    caseId: arenaCaseId,
    responseType,
    timeRange,
    frequencyRange,
  }), [polesPayload, zerosPayload, gain, arenaPlant, arenaCaseId, responseType, timeRange, frequencyRange]);

  const linkageRequest = useMemo(
    () => buildLinkageAnalysisRequest(baseRequestInput),
    [baseRequestInput],
  );
  const correctedLinkageRequest = useMemo(
    () => buildLinkageAnalysisRequest({
      ...baseRequestInput,
      correctionStructures,
    }),
    [baseRequestInput, correctionStructures],
  );
  const correctionDeviceRequest = useMemo(
    () => buildLinkageAnalysisRequest({
      poles: [],
      zeros: [],
      gain: 1,
      correctionStructures,
      includeOpenLoopGain: false,
      plantLabel: '校正装置 C(s)',
      outputs: ['magnitude', 'phase', 'bode'],
      responseType,
      frequencyRange,
    }),
    [correctionStructures, frequencyRange, responseType],
  );
  const deferredLinkageRequest = useDeferredValue(linkageRequest);
  const deferredCorrectedLinkageRequest = useDeferredValue(correctedLinkageRequest);
  const deferredCorrectionDeviceRequest = useDeferredValue(correctionDeviceRequest);
  const openLoopAnalysisState = useControlEngine(deferredLinkageRequest);
  const correctedAnalysisState = useControlEngine(deferredCorrectedLinkageRequest);
  const correctionDeviceAnalysisState = useControlEngine(deferredCorrectionDeviceRequest);
  const visibleBaselineAnalysisResult = useMemo(
    () => {
      const currentResult = openLoopAnalysisState.result;
      if (!currentResult) return lastValidOpenLoopResultRef.current;
      if (arenaPlant) {
        lastValidOpenLoopResultRef.current = currentResult;
        return currentResult;
      }
      if (doesRootLocusMatchPoleZeroSet(currentResult, polesPayload, zerosPayload)) {
        lastValidOpenLoopResultRef.current = currentResult;
        return currentResult;
      }
      return lastValidOpenLoopResultRef.current;
    },
    [openLoopAnalysisState.result, polesPayload, zerosPayload, arenaPlant],
  );
  const visibleCorrectedAnalysisResult = useMemo(() => {
    if (!correctionEnabled) {
      return visibleBaselineAnalysisResult;
    }
    const currentResult = correctedAnalysisState.result;
    if (!currentResult) return lastValidCorrectedResultRef.current;
    if (arenaPlant) {
      lastValidCorrectedResultRef.current = currentResult;
      return currentResult;
    }
    const correctionPoleZeroSet = correctionHandlesToPoleZeroSet(correctionRootHandles);
    const expectedPoles = [...polesPayload, ...correctionPoleZeroSet.poles];
    const expectedZeros = [...zerosPayload, ...correctionPoleZeroSet.zeros];

    if (doesRootLocusMatchPoleZeroSet(currentResult, expectedPoles, expectedZeros)) {
      lastValidCorrectedResultRef.current = currentResult;
      return currentResult;
    }
    if (doesRootLocusMatchPoleZeroSet(lastValidCorrectedResultRef.current, expectedPoles, expectedZeros)) {
      return lastValidCorrectedResultRef.current;
    }
    return null;
  }, [
    correctedAnalysisState.result,
    correctionEnabled,
    correctionRootHandles,
    polesPayload,
    visibleBaselineAnalysisResult,
    zerosPayload,
    arenaPlant,
  ]);
  const mergedAnalysisResult = useMemo(
    () => mergeClosedLoopSelectionResult(
      visibleCorrectedAnalysisResult,
      null,
      gain,
    ),
    [gain, visibleCorrectedAnalysisResult],
  );
  const visibleAnalysisResult = useMemo(
    () => {
      if (mergedAnalysisResult) {
        lastVisibleAnalysisResultRef.current = mergedAnalysisResult;
        return mergedAnalysisResult;
      }
      return lastVisibleAnalysisResultRef.current;
    },
    [mergedAnalysisResult],
  );
  const analysisState = useMemo(
    () => mergeAnalysisState(
      correctionEnabled ? correctedAnalysisState : openLoopAnalysisState,
      correctionDeviceAnalysisState,
      visibleAnalysisResult,
    ),
    [correctionDeviceAnalysisState, correctionEnabled, correctedAnalysisState, openLoopAnalysisState, visibleAnalysisResult],
  );
  const adaptedAnalysis = useMemo(
    () => (visibleAnalysisResult ? adaptLinkageAnalysisResult(visibleAnalysisResult) : null),
    [visibleAnalysisResult],
  );

  const arenaPreviewSummary = useMemo(() => {
    if (!isArenaChallengeMode || !arenaContext) return null;
    return buildArenaWorkbenchPreviewSummary(adaptedAnalysis, arenaContext.metricProfile);
  }, [adaptedAnalysis, arenaContext, isArenaChallengeMode]);

  const addPoint = useCallback((type: 'pole' | 'zero', pair: boolean) => {
    if (isLockedOrCourse) {
      return;
    }
    const nextItems: PoleZeroPoint[] = pair
      ? [
          { id: `${type}-${idRef.current++}`, re: -2.2, im: 1, pairKey: `${type}-pair-${pairRef.current}` },
          { id: `${type}-${idRef.current++}`, re: -2.2, im: -1, pairKey: `${type}-pair-${pairRef.current++}` },
        ]
      : [{ id: `${type}-${idRef.current++}`, re: -2.2, im: 0, pairKey: null }];
    if (type === 'pole') {
      setModelPoles((previous) => [...previous, ...nextItems]);
    } else {
      setModelZeros((previous) => [...previous, ...nextItems]);
    }
    setClosedLoopGain(gain);
  }, [gain, isLockedOrCourse]);

  const updatePole = useCallback((pointId: string, next: Complex) => {
    if (isLockedOrCourse) return;
    setModelPoles((previous) => updatePointWithConjugateLink(previous, pointId, next));
    setClosedLoopGain(gain);
  }, [gain, isLockedOrCourse]);

  const updateZero = useCallback((pointId: string, next: Complex) => {
    if (isLockedOrCourse) return;
    setModelZeros((previous) => updatePointWithConjugateLink(previous, pointId, next));
    setClosedLoopGain(gain);
  }, [gain, isLockedOrCourse]);

  const removePole = useCallback((pointId: string) => {
    if (!isLockedOrCourse) {
      setModelPoles((previous) => {
        const next = removePointWithPair(previous, pointId);
        return next.length > 0 ? next : previous;
      });
      setClosedLoopGain(gain);
    }
  }, [gain, isLockedOrCourse]);

  const removeZero = useCallback((pointId: string) => {
    if (!isLockedOrCourse) {
      setModelZeros((previous) => removePointWithPair(previous, pointId));
      setClosedLoopGain(gain);
    }
  }, [gain, isLockedOrCourse]);

  const reset = useCallback(() => {
    const fallbackModel = isArenaChallengeMode && arenaSeed
      ? { poles: arenaSeed.poles, zeros: arenaSeed.zeros, gain: 1 }
      : isCourseMode
        ? buildOpenLoopFromController(CRUISE_DEFAULT_PID, courseControlMode)
        : { poles: [{ re: -1.2, im: 1.3 }, { re: -1.2, im: -1.3 }], zeros: [] as Complex[], gain: 1 };
    const nextPoles = toPoleZeroPoints(fallbackModel.poles, 'p');
    const nextZeros = toPoleZeroPoints(fallbackModel.zeros, 'z');
    setModelPoles(nextPoles);
    setModelZeros(nextZeros);
    setGain(fallbackModel.gain);
    setClosedLoopGain(fallbackModel.gain);
    setTimeRange(effectiveTimeRange ?? DEFAULT_LINKAGE_TIME_RANGE);
    setFrequencyRange(effectiveFreqRange ?? DEFAULT_LINKAGE_FREQUENCY_RANGE);
    setCorrectionState({
      ...DEFAULT_CORRECTION_STATE,
      enabled: false,
    });
  }, [arenaSeed, courseControlMode, effectiveFreqRange, effectiveTimeRange, isArenaChallengeMode, isCourseMode]);

  useEffect(() => {
    if (!isCourseMode) {
      return undefined;
    }
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }
      const data = event.data as {
        type?: string;
        source?: 'simulation' | 'linkage';
        payload?: {
          controlMode?: CruiseControllerMode;
          openLoop?: { poles?: Complex[]; zeros?: Complex[]; gain?: number };
          controller?: CruiseControllerParams;
        };
      };
      if (data?.type !== 'cruise-course-sync' || data.source !== 'simulation') {
        return;
      }
      if (data.payload?.controlMode) {
        setCourseControlMode(data.payload.controlMode);
      }
      if (data.payload?.controller) {
        baseControllerRef.current = data.payload.controller;
      }
      const nextModel = data.payload?.controller
        ? buildOpenLoopFromController(data.payload.controller, data.payload.controlMode ?? courseControlMode)
        : null;
      if (data.payload?.openLoop?.poles ?? nextModel?.poles) {
        const nextPoles = toPoleZeroPoints(data.payload?.openLoop?.poles ?? nextModel?.poles ?? [], 'p');
        setModelPoles(nextPoles);
      }
      if (data.payload?.openLoop?.zeros ?? nextModel?.zeros) {
        const nextZeros = toPoleZeroPoints(data.payload?.openLoop?.zeros ?? nextModel?.zeros ?? [], 'z');
        setModelZeros(nextZeros);
      }
      const nextGain = data.payload?.openLoop?.gain ?? nextModel?.gain;
      if (typeof nextGain === 'number' && Number.isFinite(nextGain)) {
        const sanitizedGain = round3(Math.max(0, nextGain));
        setGain(sanitizedGain);
        setClosedLoopGain(sanitizedGain);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [courseControlMode, isCourseMode]);

  useEffect(() => {
    if (!isCourseMode) {
      return;
    }
    const controller = estimateControllerFromOpenLoop(polesPayload, zerosPayload, gain, courseControlMode, baseControllerRef.current);
    window.parent.postMessage({
      type: 'cruise-course-sync',
      source: 'linkage',
      payload: {
        controlMode: courseControlMode,
        controller,
        metrics: {
          timeDomain: adaptedAnalysis?.timeDomain.metrics ?? null,
          frequencyDomain: adaptedAnalysis?.stability
            ? {
                phaseMargin: adaptedAnalysis.stability.stabilityMargins.phaseMargin.value,
                gainMargin: adaptedAnalysis.stability.stabilityMargins.gainMargin.isInfinite
                  ? Number.POSITIVE_INFINITY
                  : adaptedAnalysis.stability.stabilityMargins.gainMargin.value,
              }
            : null,
        },
      },
    }, window.location.origin);
  }, [adaptedAnalysis, courseControlMode, gain, isCourseMode, polesPayload, zerosPayload]);

  const setOpenLoopGain = useCallback((value: number) => {
    const sanitizedGain = round3(Math.max(0, value));
    setGain(sanitizedGain);
    setClosedLoopGain(sanitizedGain);
  }, []);
  const setSelectedClosedLoopGain = useCallback((value: number) => {
    setClosedLoopGain(round3(Math.max(0, value)));
  }, []);
  const updateCorrectionState = useCallback((patch: Partial<CorrectionState>) => {
    if (isCourseMode) {
      return;
    }
    setCorrectionState((previous) => syncCorrectionTimeConstants({
      ...previous,
      ...patch,
      enabled: patch.enabled ?? previous.enabled,
    }));
  }, [isCourseMode]);
  const updateCorrectionRootHandle = useCallback((id: string, point: Complex) => {
    const frequency = round3(Math.max(0.001, -point.re));
    const patch: Partial<CorrectionState> = {};
    if (id === 'lead-zero') {
      patch.leadZeroFrequency = frequency;
    } else if (id === 'lead-pole') {
      patch.leadPoleFrequency = frequency;
    } else if (id === 'lag-zero') {
      patch.lagZeroFrequency = frequency;
    } else if (id === 'lag-pole') {
      patch.lagPoleFrequency = frequency;
    } else if (id === 'pid-filter-pole') {
      patch.tf = round3(1 / frequency);
      patch.derivativeFilterEnabled = true;
    } else if (id.startsWith('pid-zero-')) {
      if (correctionState.kind === 'pi') {
        patch.ki = correctionState.kp * frequency;
      } else if (correctionState.kind === 'pd') {
        patch.kd = correctionState.kp / frequency;
      } else if (correctionState.kind === 'pid') {
        patch.ki = correctionState.kp * frequency;
      }
    }
    if (Object.keys(patch).length > 0) {
      updateCorrectionState(patch);
    }
  }, [correctionState, updateCorrectionState]);
  const updateTurnFrequencyHandle = useCallback((id: string, frequency: number) => {
    const nextFrequency = round3(Math.max(0.001, frequency));
    const patch: Partial<CorrectionState> = {};
    if (id === 'lead-zero') {
      patch.leadZeroFrequency = nextFrequency;
    } else if (id === 'lead-pole') {
      patch.leadPoleFrequency = nextFrequency;
    } else if (id === 'lag-zero') {
      patch.lagZeroFrequency = nextFrequency;
    } else if (id === 'lag-pole') {
      patch.lagPoleFrequency = nextFrequency;
    }
    if (Object.keys(patch).length > 0) {
      updateCorrectionState(patch);
    }
  }, [updateCorrectionState]);
  const refreshTimeRange = useCallback((range: { x: [number, number] }) => {
    const start = Math.max(0, Math.min(range.x[0], range.x[1]));
    const end = Math.max(start + 0.001, Math.max(range.x[0], range.x[1]));
    setTimeRange({ start: round3(start), end: round3(end), samples: DEFAULT_LINKAGE_TIME_RANGE.samples });
  }, []);
  const refreshFrequencyRange = useCallback((range: [number, number]) => {
    const min = Math.max(0.001, Math.min(range[0], range[1]));
    const max = Math.max(min * 1.01, Math.max(range[0], range[1]));
    setFrequencyRange({ min: round3(min), max: round3(max), samples: DEFAULT_LINKAGE_FREQUENCY_RANGE.samples });
  }, []);
  const selectedGainText = Math.abs(closedLoopGain - gain) > 1e-6
    ? ` | 闭环选点K=${closedLoopGain.toFixed(3)}`
    : '';
  const correctionText = correctionEnabled ? ` | C(s)=${correctionState.kind}` : '';
  const parameterSummary = `K=${gain.toFixed(3)}${selectedGainText} | 极点 ${modelPoles.length} | 零点 ${modelZeros.length}${correctionText} | ${responseType}`;

  return {
    isCourseMode,
    courseRole,
    isEmbedded,
    arenaContext,
    arenaContextMissing,
    isArenaChallengeMode,
    isLockedByChallenge,
    isLockedOrCourse,
    modelPoles,
    modelZeros,
    gain,
    closedLoopGain,
    correctionEnabled: !isCourseMode && correctionEnabled,
    correctionState,
    correctionStructures,
    turnFrequencyHandles,
    correctionRootHandles,
    responseType,
    showMargins,
    drawerOpen,
    analysisState,
    analysisResult: visibleAnalysisResult,
    preCorrectionAnalysisResult: visibleBaselineAnalysisResult,
    correctionDeviceAnalysisResult: correctionEnabled ? correctionDeviceAnalysisState.result : null,
    frequencyAnalysisResult: visibleAnalysisResult,
    adaptedAnalysis,
    arenaPreviewSummary,
    parameterSummary,
    setGain: setOpenLoopGain,
    setClosedLoopGain: setSelectedClosedLoopGain,
    setCorrectionState: updateCorrectionState,
    updateCorrectionRootHandle,
    updateTurnFrequencyHandle,
    refreshTimeRange,
    refreshFrequencyRange,
    setResponseType,
    setShowMargins,
    setDrawerOpen,
    addPoint,
    updatePole,
    updateZero,
    removePole,
    removeZero,
    reset,
  };
}
