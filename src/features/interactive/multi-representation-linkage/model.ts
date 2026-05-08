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
import type { ComplexPoint as Complex } from '@/resources/control-system/analysis/types';
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
  const [courseControlMode, setCourseControlMode] = useState<CruiseControllerMode>(initialControlMode);
  const [responseType, setResponseType] = useState<LinkageResponseType>('step');
  const [showMargins, setShowMargins] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const idRef = useRef(100);
  const pairRef = useRef(100);
  const baseControllerRef = useRef<CruiseControllerParams>(initialController);

  const polesPayload = useMemo(() => modelPoles.map(toComplex), [modelPoles]);
  const zerosPayload = useMemo(() => modelZeros.map(toComplex), [modelZeros]);
  const linkageRequest = useMemo(
    () => buildLinkageAnalysisRequest({ poles: polesPayload, zeros: zerosPayload, gain, responseType }),
    [gain, polesPayload, responseType, zerosPayload],
  );
  const deferredLinkageRequest = useDeferredValue(linkageRequest);
  const analysisState = useControlEngine(deferredLinkageRequest);
  const analysisResult = analysisState.result;
  const adaptedAnalysis = useMemo(
    () => (analysisResult ? adaptLinkageAnalysisResult(analysisResult) : null),
    [analysisResult],
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
  }, [isCourseMode]);

  const updatePole = useCallback((pointId: string, next: Complex) => {
    setModelPoles((previous) => updatePointWithConjugateLink(previous, pointId, next));
  }, []);

  const updateZero = useCallback((pointId: string, next: Complex) => {
    setModelZeros((previous) => updatePointWithConjugateLink(previous, pointId, next));
  }, []);

  const removePole = useCallback((pointId: string) => {
    if (!isCourseMode) {
      setModelPoles((previous) => {
        const next = removePointWithPair(previous, pointId);
        return next.length > 0 ? next : previous;
      });
    }
  }, [isCourseMode]);

  const removeZero = useCallback((pointId: string) => {
    if (!isCourseMode) {
      setModelZeros((previous) => removePointWithPair(previous, pointId));
    }
  }, [isCourseMode]);

  const reset = useCallback(() => {
    const fallbackModel = isCourseMode
      ? buildOpenLoopFromController(CRUISE_DEFAULT_PID, courseControlMode)
      : { poles: [{ re: -1.2, im: 1.3 }, { re: -1.2, im: -1.3 }], zeros: [] as Complex[], gain: 1 };
    const nextPoles = toPoleZeroPoints(fallbackModel.poles, 'p');
    const nextZeros = toPoleZeroPoints(fallbackModel.zeros, 'z');
    setModelPoles(nextPoles);
    setModelZeros(nextZeros);
    setGain(fallbackModel.gain);
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
        setGain(round3(Math.max(0, nextGain)));
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

  const parameterSummary = `K=${gain.toFixed(3)} | 极点 ${modelPoles.length} | 零点 ${modelZeros.length} | ${responseType}`;

  return {
    isCourseMode,
    courseRole,
    isEmbedded,
    modelPoles,
    modelZeros,
    gain,
    responseType,
    showMargins,
    drawerOpen,
    analysisState,
    analysisResult,
    adaptedAnalysis,
    parameterSummary,
    setGain: (value: number) => setGain(round3(Math.max(0, value))),
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
