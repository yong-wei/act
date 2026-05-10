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
  buildLinkageAnalysisRequest,
} from '@/resources/control-system/analysis/multi-representation-linkage-analysis';
import type {
  ComplexPoint as Complex,
  ControlAnalysisResult,
  ControlEngineState,
} from '@/resources/control-system/analysis/types';
import { useControlEngine } from '@/resources/control-system/analysis/use-control-engine';

export interface MultiRepresentationInitialParams {
  courseMode?: boolean;
  role?: 'teacher' | 'student';
  embed?: boolean;
  controlMode?: CruiseControllerMode;
  controller?: Partial<CruiseControllerParams>;
}

export interface PoleZeroPoint {
  id: string;
  re: number;
  im: number;
  pairKey: string | null;
}

export type LinkageResponseType = 'step' | 'impulse' | 'ramp';

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
  const isCourseMode = Boolean(initialParams.courseMode);
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

  const [modelPoles, setModelPoles] = useState(() => toPoleZeroPoints(openLoopSeed.poles, 'p'));
  const [modelZeros, setModelZeros] = useState(() => toPoleZeroPoints(openLoopSeed.zeros, 'z'));
  const [gain, setGain] = useState(openLoopSeed.gain);
  const [closedLoopGain, setClosedLoopGain] = useState(openLoopSeed.gain);
  const [courseControlMode, setCourseControlMode] = useState<CruiseControllerMode>(initialControlMode);
  const [responseType, setResponseType] = useState<LinkageResponseType>('step');
  const [showMargins, setShowMargins] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const idRef = useRef(100);
  const pairRef = useRef(100);
  const baseControllerRef = useRef<CruiseControllerParams>(initialController);
  const lastValidOpenLoopResultRef = useRef<ControlAnalysisResult | null>(null);
  const lastVisibleAnalysisResultRef = useRef<ControlAnalysisResult | null>(null);

  const polesPayload = useMemo(() => modelPoles.map(toComplex), [modelPoles]);
  const zerosPayload = useMemo(() => modelZeros.map(toComplex), [modelZeros]);
  const linkageRequest = useMemo(
    () => buildLinkageAnalysisRequest({ poles: polesPayload, zeros: zerosPayload, gain, responseType }),
    [gain, polesPayload, responseType, zerosPayload],
  );
  const closedLoopSelectionRequest = useMemo(
    () => buildLinkageAnalysisRequest({
      poles: polesPayload,
      zeros: zerosPayload,
      gain: closedLoopGain,
      rootLocusGain: closedLoopGain,
      outputs: ['step_response'],
      responseType,
    }),
    [closedLoopGain, polesPayload, responseType, zerosPayload],
  );
  const deferredLinkageRequest = useDeferredValue(linkageRequest);
  const deferredClosedLoopSelectionRequest = useDeferredValue(closedLoopSelectionRequest);
  const openLoopAnalysisState = useControlEngine(deferredLinkageRequest);
  const closedLoopSelectionState = useControlEngine(deferredClosedLoopSelectionRequest);
  const visibleOpenLoopAnalysisResult = useMemo(
    () => {
      if (doesRootLocusMatchPoleZeroSet(openLoopAnalysisState.result, polesPayload, zerosPayload)) {
        lastValidOpenLoopResultRef.current = openLoopAnalysisState.result;
        return openLoopAnalysisState.result;
      }
      return lastValidOpenLoopResultRef.current;
    },
    [openLoopAnalysisState.result, polesPayload, zerosPayload],
  );
  const mergedAnalysisResult = useMemo(
    () => mergeClosedLoopSelectionResult(
      visibleOpenLoopAnalysisResult,
      closedLoopSelectionState.result,
      closedLoopGain,
    ),
    [closedLoopGain, closedLoopSelectionState.result, visibleOpenLoopAnalysisResult],
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
    () => mergeAnalysisState(openLoopAnalysisState, closedLoopSelectionState, visibleAnalysisResult),
    [visibleAnalysisResult, closedLoopSelectionState, openLoopAnalysisState],
  );
  const adaptedAnalysis = useMemo(
    () => (visibleAnalysisResult ? adaptLinkageAnalysisResult(visibleAnalysisResult) : null),
    [visibleAnalysisResult],
  );

  const addPoint = useCallback((type: 'pole' | 'zero', pair: boolean) => {
    if (isCourseMode) {
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
  }, [gain, isCourseMode]);

  const updatePole = useCallback((pointId: string, next: Complex) => {
    setModelPoles((previous) => updatePointWithConjugateLink(previous, pointId, next));
    setClosedLoopGain(gain);
  }, [gain]);

  const updateZero = useCallback((pointId: string, next: Complex) => {
    setModelZeros((previous) => updatePointWithConjugateLink(previous, pointId, next));
    setClosedLoopGain(gain);
  }, [gain]);

  const removePole = useCallback((pointId: string) => {
    if (!isCourseMode) {
      setModelPoles((previous) => {
        const next = removePointWithPair(previous, pointId);
        return next.length > 0 ? next : previous;
      });
      setClosedLoopGain(gain);
    }
  }, [gain, isCourseMode]);

  const removeZero = useCallback((pointId: string) => {
    if (!isCourseMode) {
      setModelZeros((previous) => removePointWithPair(previous, pointId));
      setClosedLoopGain(gain);
    }
  }, [gain, isCourseMode]);

  const reset = useCallback(() => {
    const fallbackModel = isCourseMode
      ? buildOpenLoopFromController(CRUISE_DEFAULT_PID, courseControlMode)
      : { poles: [{ re: -1.2, im: 1.3 }, { re: -1.2, im: -1.3 }], zeros: [] as Complex[], gain: 1 };
    const nextPoles = toPoleZeroPoints(fallbackModel.poles, 'p');
    const nextZeros = toPoleZeroPoints(fallbackModel.zeros, 'z');
    setModelPoles(nextPoles);
    setModelZeros(nextZeros);
    setGain(fallbackModel.gain);
    setClosedLoopGain(fallbackModel.gain);
  }, [courseControlMode, isCourseMode]);

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
  const selectedGainText = Math.abs(closedLoopGain - gain) > 1e-6
    ? ` | 闭环选点K=${closedLoopGain.toFixed(3)}`
    : '';
  const parameterSummary = `K=${gain.toFixed(3)}${selectedGainText} | 极点 ${modelPoles.length} | 零点 ${modelZeros.length} | ${responseType}`;

  return {
    isCourseMode,
    courseRole,
    isEmbedded,
    modelPoles,
    modelZeros,
    gain,
    closedLoopGain,
    responseType,
    showMargins,
    drawerOpen,
    analysisState,
    analysisResult: visibleAnalysisResult,
    frequencyAnalysisResult: visibleOpenLoopAnalysisResult,
    adaptedAnalysis,
    parameterSummary,
    setGain: setOpenLoopGain,
    setClosedLoopGain: setSelectedClosedLoopGain,
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
