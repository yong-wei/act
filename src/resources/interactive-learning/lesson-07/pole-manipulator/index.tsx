'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Clock,
  Crosshair,
  Minus,
  Plus,
  RefreshCw,
  Trophy,
} from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import {
  isInteractiveSimulationRuntimeReady,
  preloadInteractiveSimulationRuntime,
  runTransferFunctionResponse,
} from '@/resources/interactive-learning/rust/interactive-simulation-runtime';
import { PathResourceContinueAction } from '@/resources/interactive-learning/shared/path-resource-continue-action';

const PLANE_BOUNDS = {
  minRe: -6,
  maxRe: 2,
  minIm: -4,
  maxIm: 4,
};

type PlaneView = typeof PLANE_BOUNDS;

interface ResponseView {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

const SVG_SIZE = {
  width: 520,
  height: 360,
  padding: 40,
};

const RESPONSE_SIZE = {
  width: 500,
  height: 360,
  padding: 34,
};

const DEFAULT_POLES = [
  { id: 'pole-1', re: -1.2, im: 1.4, conjugate: true },
];

type SignalType = 'step' | 'ramp' | 'impulse';

type RootKind = 'pole' | 'zero';

interface RootPoint {
  id: string;
  re: number;
  im: number;
  conjugate: boolean;
  kind: RootKind;
}

interface RenderRoot extends RootPoint {
  mirror: boolean;
  color?: string;
  dashed?: boolean;
  targetId?: string;
}

interface Complex {
  re: number;
  im: number;
}

interface ResponsePoint {
  t: number;
  y: number;
}

interface ResponseSeries {
  points: ResponsePoint[];
  minY: number;
  maxY: number;
  duration: number;
}

interface StepMetrics {
  overshoot: number | null;
  settlingTime: number | null;
  peakTime: number | null;
}

interface ChallengeTarget {
  id: string;
  label: string;
  color: string;
  pole: { re: number; im: number };
  response: ResponseSeries;
  guess: { re: number; im: number };
}

interface BestRecord {
  score: number;
  duration: number;
}

const DEFAULT_SIGNAL: SignalType = 'step';
const SIM_DT = 1 / 60;
const MAX_SIM_STEPS = 900;
const BEST_STORAGE_KEY = 'pole-manipulator-best';
const CHALLENGE_COLORS = ['#60a5fa', '#f59e0b', '#34d399'];
const ZETA_LINES = [0.2, 0.4, 0.6, 0.8];

const DEFAULT_PLANE_VIEW: PlaneView = { ...PLANE_BOUNDS };

type DragSource = 'explore' | 'challenge';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function niceStep(range: number, targetTicks: number) {
  if (range <= 0 || !Number.isFinite(range)) return 1;
  const rough = range / Math.max(1, targetTicks);
  const power = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / power;
  let niceFraction = 1;
  if (fraction >= 5) niceFraction = 10;
  else if (fraction >= 2) niceFraction = 5;
  else if (fraction >= 1) niceFraction = 2;
  return niceFraction * power;
}

function getTicks(min: number, max: number, targetTicks = 5) {
  const range = max - min;
  if (range <= 0) return [min];
  const step = niceStep(range, targetTicks);
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + 1e-6; value += step) {
    ticks.push(Number(value.toFixed(2)));
  }
  return ticks;
}

function toSvgCoords(re: number, im: number, view: PlaneView) {
  const { minRe, maxRe, minIm, maxIm } = view;
  const plotWidth = SVG_SIZE.width - SVG_SIZE.padding * 2;
  const plotHeight = SVG_SIZE.height - SVG_SIZE.padding * 2;
  const x = SVG_SIZE.padding + ((re - minRe) / (maxRe - minRe)) * plotWidth;
  const y = SVG_SIZE.padding + ((maxIm - im) / (maxIm - minIm)) * plotHeight;
  return { x, y };
}

function fromSvgCoords(x: number, y: number, view: PlaneView) {
  const { minRe, maxRe, minIm, maxIm } = view;
  const plotWidth = SVG_SIZE.width - SVG_SIZE.padding * 2;
  const plotHeight = SVG_SIZE.height - SVG_SIZE.padding * 2;
  const re = minRe + ((x - SVG_SIZE.padding) / plotWidth) * (maxRe - minRe);
  const im = maxIm - ((y - SVG_SIZE.padding) / plotHeight) * (maxIm - minIm);
  return {
    re: clamp(re, minRe, maxRe),
    im: clamp(im, minIm, maxIm),
  };
}

function complexAdd(a: Complex, b: Complex): Complex {
  return { re: a.re + b.re, im: a.im + b.im };
}

function complexMul(a: Complex, b: Complex): Complex {
  return {
    re: a.re * b.re - a.im * b.im,
    im: a.re * b.im + a.im * b.re,
  };
}

function complexNegate(a: Complex): Complex {
  return { re: -a.re, im: -a.im };
}

function multiplyPolyByRoot(coeffs: Complex[], root: Complex): Complex[] {
  const next = Array.from({ length: coeffs.length + 1 }, () => ({ re: 0, im: 0 }));
  const negRoot = complexNegate(root);
  next[0] = complexMul(coeffs[0] ?? { re: 0, im: 0 }, negRoot);

  for (let k = 1; k < coeffs.length; k += 1) {
    const prev = coeffs[k - 1] ?? { re: 0, im: 0 };
    const curr = coeffs[k] ?? { re: 0, im: 0 };
    next[k] = complexAdd(prev, complexMul(curr, negRoot));
  }

  next[coeffs.length] = coeffs[coeffs.length - 1] ?? { re: 0, im: 0 };
  return next;
}

function polyFromRoots(roots: Complex[]): Complex[] {
  let coeffs: Complex[] = [{ re: 1, im: 0 }];
  for (const root of roots) {
    coeffs = multiplyPolyByRoot(coeffs, root);
  }
  return coeffs;
}

function toRealCoefficients(coeffs: Complex[]): number[] {
  return coeffs.map((c) => {
    const value = Math.abs(c.im) < 1e-6 ? c.re : c.re;
    return Number(value.toFixed(6));
  });
}

function expandRoots(roots: RootPoint[]): Complex[] {
  const expanded: Complex[] = [];
  for (const root of roots) {
    expanded.push({ re: root.re, im: root.im });
    if (root.conjugate && Math.abs(root.im) > 1e-6) {
      expanded.push({ re: root.re, im: -root.im });
    }
  }
  return expanded;
}

function toRenderRoots(
  root: RootPoint,
  options: { color?: string; dashed?: boolean; targetId?: string } = {}
) {
  const base: RenderRoot = { ...root, mirror: false, ...options };
  if (root.conjugate && Math.abs(root.im) > 1e-6) {
    return [base, { ...base, im: -root.im, mirror: true }];
  }
  return [base];
}

function estimateDuration(poles: RootPoint[]) {
  const decayRates = poles
    .map((pole) => -pole.re)
    .filter((value) => value > 0);
  const minDecay = decayRates.length ? Math.min(...decayRates) : 0;
  if (minDecay <= 0) return 8;
  return clamp(6 / minDecay, 6, 12);
}

function simulateResponse(
  poles: RootPoint[],
  zeros: RootPoint[],
  signal: SignalType,
  durationOverride?: number,
  runtimeReady = isInteractiveSimulationRuntimeReady()
): ResponseSeries {
  const expandedPoles = expandRoots(poles);
  const expandedZeros = expandRoots(zeros);

  const numerator = toRealCoefficients(polyFromRoots(expandedZeros));
  const denominator = toRealCoefficients(polyFromRoots(expandedPoles));

  const duration = durationOverride ?? estimateDuration(poles);
  if (!runtimeReady) {
    return {
      points: [
        { t: 0, y: 0 },
        { t: duration, y: 0 },
      ],
      minY: 0,
      maxY: 1,
      duration,
    };
  }

  return runTransferFunctionResponse({
    numerator: numerator.length ? numerator : [1],
    denominator: denominator.length ? denominator : [1],
    dt: SIM_DT,
    duration,
    signal,
    maxSteps: MAX_SIM_STEPS,
  });
}

function computeStepMetrics(series: ResponseSeries): StepMetrics {
  if (!series.points.length) {
    return { overshoot: null, settlingTime: null, peakTime: null };
  }
  const finalValue = series.points[series.points.length - 1]?.y ?? 0;
  if (Math.abs(finalValue) < 1e-6) {
    return { overshoot: null, settlingTime: null, peakTime: null };
  }
  const peakPoint = series.points.reduce((best, point) => (point.y > best.y ? point : best));
  const overshoot = Math.max(
    0,
    ((peakPoint.y - finalValue) / Math.abs(finalValue)) * 100
  );
  const band = 0.02 * Math.abs(finalValue);
  let settlingTime: number | null = null;
  for (let i = 0; i < series.points.length; i += 1) {
    const withinBand = series.points.slice(i).every((point) =>
      Math.abs(point.y - finalValue) <= band
    );
    if (withinBand) {
      settlingTime = series.points[i]?.t ?? null;
      break;
    }
  }
  return {
    overshoot: Number.isFinite(overshoot) ? overshoot : null,
    settlingTime,
    peakTime: peakPoint.t ?? null,
  };
}

function getZetaWn(re: number, im: number) {
  const beta = Math.abs(im);
  const wn = Math.sqrt(re * re + beta * beta);
  const zeta = wn > 0 ? Math.abs(re) / wn : 0;
  return { zeta, wn };
}

function poleFromZetaWn(zeta: number, wn: number, sign = 1) {
  const sigma = -zeta * wn;
  const beta = wn * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  return { re: sigma, im: sign * beta };
}

function buildResponseView(series: ResponseSeries): ResponseView {
  return {
    minX: 0,
    maxX: series.duration,
    minY: series.minY,
    maxY: series.maxY,
  };
}

function applyResponseView(point: ResponsePoint, view: ResponseView, width: number, height: number, padding: number) {
  const plotWidth = width - padding * 2;
  const plotHeight = height - padding * 2;
  const rangeX = Math.max(1e-6, view.maxX - view.minX);
  const rangeY = Math.max(1e-6, view.maxY - view.minY);
  const x = padding + ((point.t - view.minX) / rangeX) * plotWidth;
  const y = padding + (1 - (point.y - view.minY) / rangeY) * plotHeight;
  return { x, y };
}

function buildResponsePath(series: ResponseSeries, view: ResponseView, size: typeof RESPONSE_SIZE) {
  return series.points
    .map((point, index) => {
      const { x, y } = applyResponseView(point, view, size.width, size.height, size.padding);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');
}

function buildChallengeResponseView(targets: ChallengeTarget[]) {
  if (!targets.length) {
    return { minX: 0, maxX: 10, minY: -1, maxY: 1 };
  }
  const maxX = Math.max(...targets.map((target) => target.response.duration));
  let minY = Infinity;
  let maxY = -Infinity;
  targets.forEach((target) => {
    target.response.points.forEach((point) => {
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    });
  });
  if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
    minY = -1;
    maxY = 1;
  }
  const margin = Math.max(0.05, (maxY - minY) * 0.05);
  return {
    minX: 0,
    maxX,
    minY: minY - margin,
    maxY: maxY + margin,
  };
}

function zoomPlaneView(view: PlaneView, factor: number, focus: { re: number; im: number }) {
  const width = view.maxRe - view.minRe;
  const height = view.maxIm - view.minIm;
  const nextWidth = clamp(width * factor, 1, 40);
  const nextHeight = clamp(height * factor, 1, 40);
  const ratioX = nextWidth / width;
  const ratioY = nextHeight / height;
  const minRe = focus.re - (focus.re - view.minRe) * ratioX;
  const minIm = focus.im - (focus.im - view.minIm) * ratioY;
  return {
    minRe,
    maxRe: minRe + nextWidth,
    minIm,
    maxIm: minIm + nextHeight,
  };
}

function zoomResponseView(view: ResponseView, factor: number, focus: { t: number; y: number }) {
  const width = view.maxX - view.minX;
  const height = view.maxY - view.minY;
  const nextWidth = clamp(width * factor, 0.5, 30);
  const nextHeight = clamp(height * factor, 0.5, 30);
  const ratioX = nextWidth / width;
  const ratioY = nextHeight / height;
  const minX = focus.t - (focus.t - view.minX) * ratioX;
  const minY = focus.y - (focus.y - view.minY) * ratioY;
  return {
    minX,
    maxX: minX + nextWidth,
    minY,
    maxY: minY + nextHeight,
  };
}

function getPlaneScale(view: PlaneView) {
  const plotWidth = SVG_SIZE.width - SVG_SIZE.padding * 2;
  const plotHeight = SVG_SIZE.height - SVG_SIZE.padding * 2;
  return {
    scaleX: plotWidth / Math.max(1e-6, view.maxRe - view.minRe),
    scaleY: plotHeight / Math.max(1e-6, view.maxIm - view.minIm),
  };
}

function getZetaLineEndpoint(view: PlaneView, slope: number) {
  const candidates: { re: number; im: number }[] = [];
  const reLeft = view.minRe;
  const imAtLeft = -slope * reLeft;
  if (imAtLeft >= view.minIm && imAtLeft <= view.maxIm) {
    candidates.push({ re: reLeft, im: imAtLeft });
  }
  if (Math.abs(slope) > 1e-6) {
    const reTop = -view.maxIm / slope;
    if (reTop >= view.minRe && reTop <= view.maxRe) {
      candidates.push({ re: reTop, im: view.maxIm });
    }
    const reBottom = -view.minIm / slope;
    if (reBottom >= view.minRe && reBottom <= view.maxRe) {
      candidates.push({ re: reBottom, im: view.minIm });
    }
  }
  const valid = candidates.filter((point) => point.re <= 0);
  if (!valid.length) return { re: view.minRe, im: 0 };
  return valid.reduce((best, point) => {
    const dist = point.re * point.re + point.im * point.im;
    const bestDist = best.re * best.re + best.im * best.im;
    return dist > bestDist ? point : best;
  });
}

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.round(value % 60);
  if (minutes <= 0) return `${seconds} 秒`;
  return `${minutes} 分 ${seconds} 秒`;
}

function scoreGuess(target: { re: number; im: number }, guess: { re: number; im: number }) {
  const dr = guess.re - target.re;
  const di = Math.abs(guess.im) - Math.abs(target.im);
  const distance = Math.sqrt(dr * dr + di * di);
  const perfect = 0.15;
  const maxDistance = 1.6;
  if (distance <= perfect) return 100;
  const normalized = (distance - perfect) / (maxDistance - perfect);
  return Math.max(0, Math.round((1 - normalized) * 100));
}

type RelationType = 'sameRe' | 'sameIm' | 'sameZeta' | 'sameWn';

const RELATIONS: RelationType[] = ['sameRe', 'sameIm', 'sameZeta', 'sameWn'];

function randomInRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function isPoleValid(pole: { re: number; im: number }, view: PlaneView) {
  return (
    pole.re < -0.2 &&
    pole.re >= view.minRe &&
    pole.re <= view.maxRe &&
    Math.abs(pole.im) <= view.maxIm &&
    Math.abs(pole.im) >= 0.3
  );
}

function randomStablePole(view: PlaneView) {
  for (let i = 0; i < 40; i += 1) {
    const zeta = randomInRange(0.2, 0.85);
    const wn = randomInRange(1.1, 3.8);
    const candidate = poleFromZetaWn(zeta, wn);
    if (isPoleValid(candidate, view)) return candidate;
  }
  return { re: -1.2, im: 1.2 };
}

function poleWithRelation(reference: { re: number; im: number }, relation: RelationType, view: PlaneView) {
  for (let i = 0; i < 40; i += 1) {
    if (relation === 'sameRe') {
      const beta = randomInRange(0.5, view.maxIm - 0.3);
      const candidate = { re: reference.re, im: beta };
      if (isPoleValid(candidate, view) && Math.abs(candidate.im - Math.abs(reference.im)) > 0.3) {
        return candidate;
      }
    }
    if (relation === 'sameIm') {
      const sigma = randomInRange(view.minRe + 0.5, -0.4);
      const candidate = { re: sigma, im: Math.abs(reference.im) };
      if (isPoleValid(candidate, view) && Math.abs(candidate.re - reference.re) > 0.3) {
        return candidate;
      }
    }
    if (relation === 'sameZeta') {
      const { zeta } = getZetaWn(reference.re, reference.im);
      const wn = randomInRange(1.2, 3.8);
      const candidate = poleFromZetaWn(zeta, wn);
      if (isPoleValid(candidate, view) && Math.abs(candidate.re - reference.re) > 0.2) {
        return candidate;
      }
    }
    if (relation === 'sameWn') {
      const { wn } = getZetaWn(reference.re, reference.im);
      const zeta = randomInRange(0.2, 0.85);
      const candidate = poleFromZetaWn(zeta, wn);
      if (isPoleValid(candidate, view) && Math.abs(candidate.re - reference.re) > 0.2) {
        return candidate;
      }
    }
  }
  return randomStablePole(view);
}

function buildChallengePoles(view: PlaneView) {
  for (let i = 0; i < 40; i += 1) {
    const poleA = randomStablePole(view);
    const relation1 = RELATIONS[Math.floor(Math.random() * RELATIONS.length)];
    const poleB = poleWithRelation(poleA, relation1, view);
    const relation2Options = RELATIONS.filter((relation) => relation !== relation1);
    const relation2 = relation2Options[Math.floor(Math.random() * relation2Options.length)];
    const targetForC = Math.random() > 0.5 ? poleA : poleB;
    const poleC = poleWithRelation(targetForC, relation2, view);
    if (isPoleValid(poleA, view) && isPoleValid(poleB, view) && isPoleValid(poleC, view)) {
      return [poleA, poleB, poleC];
    }
  }
  return [randomStablePole(view), randomStablePole(view), randomStablePole(view)];
}

export default function PoleManipulator({ onComplete, onStateChange }: BaseWidgetProps) {
  const interactive = useOptionalInteractiveContext();
  const [mode, setMode] = useState<'explore' | 'challenge'>('explore');
  const [poles, setPoles] = useState<RootPoint[]>(
    DEFAULT_POLES.map((pole) => ({ ...pole, kind: 'pole' }))
  );
  const [zeros, setZeros] = useState<RootPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedChallengeId, setSelectedChallengeId] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalType>(DEFAULT_SIGNAL);
  const [lockReal, setLockReal] = useState(false);
  const [lockImag, setLockImag] = useState(false);
  const [lockZeta, setLockZeta] = useState(false);
  const [lockWn, setLockWn] = useState(false);
  const [planeView, setPlaneView] = useState<PlaneView>(DEFAULT_PLANE_VIEW);
  const [bestRecord, setBestRecord] = useState<BestRecord | null>(null);
  const [challengeTargets, setChallengeTargets] = useState<ChallengeTarget[]>([]);
  const [challengeStart, setChallengeStart] = useState<number | null>(null);
  const [challengeSubmitted, setChallengeSubmitted] = useState(false);
  const [challengeScores, setChallengeScores] = useState<number[] | null>(null);
  const [pathContinueResult, setPathContinueResult] = useState<WidgetResult | null>(null);
  const [runtimeReady, setRuntimeReady] = useState(isInteractiveSimulationRuntimeReady());

  useEffect(() => {
    let cancelled = false;
    preloadInteractiveSimulationRuntime().then(() => {
      if (!cancelled) {
        setRuntimeReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const response = useMemo(
    () => simulateResponse(poles, zeros, signal, undefined, runtimeReady),
    [poles, zeros, signal, runtimeReady]
  );
  const [responseViewMode, setResponseViewMode] = useState<'auto' | 'manual'>('auto');
  const [responseView, setResponseView] = useState<ResponseView>(() => buildResponseView(response));
  const [challengeViewMode, setChallengeViewMode] = useState<'auto' | 'manual'>('auto');
  const [challengeResponseView, setChallengeResponseView] = useState<ResponseView | null>(null);

  const planeSvgRef = useRef<SVGSVGElement | null>(null);
  const responseSvgRef = useRef<SVGSVGElement | null>(null);
  const [draggingRoot, setDraggingRoot] = useState<{
    id: string;
    kind: RootKind;
    source: DragSource;
    targetId?: string;
  } | null>(null);
  const [panningPlane, setPanningPlane] = useState<{
    startX: number;
    startY: number;
    view: PlaneView;
  } | null>(null);
  const [panningResponse, setPanningResponse] = useState<{
    startX: number;
    startY: number;
    view: ResponseView;
    source: DragSource;
  } | null>(null);

  const sessionId = interactive?.session.sessionId;
  const progressValue = interactive?.progress.current ?? 0;

  useEffect(() => {
    if (typeof window === 'undefined' || sessionId) return;
    try {
      const stored = window.localStorage.getItem(BEST_STORAGE_KEY);
      if (stored) {
        setBestRecord(JSON.parse(stored));
      }
    } catch {
      setBestRecord(null);
    }
  }, [sessionId]);

  const selectedRoot = useMemo(() => {
    if (mode === 'challenge') {
      const target = challengeTargets.find((item) => item.id === selectedChallengeId);
      if (!target) return null;
      return {
        id: `guess-${target.id}`,
        re: target.guess.re,
        im: target.guess.im,
        conjugate: true,
        kind: 'pole' as const,
      };
    }
    const allRoots = [...poles, ...zeros];
    const root = allRoots.find((item) => item.id === selectedId);
    if (root) return root;
    return poles[0] ?? null;
  }, [challengeTargets, mode, poles, selectedChallengeId, selectedId, zeros]);

  const selectedPole = selectedRoot?.kind === 'pole' ? selectedRoot : null;
  const responsePath = useMemo(
    () => buildResponsePath(response, responseView, RESPONSE_SIZE),
    [response, responseView]
  );
  const responseMetrics = useMemo(
    () => (signal === 'step' ? computeStepMetrics(response) : null),
    [response, signal]
  );
  const responseTicksX = useMemo(
    () => getTicks(responseView.minX, responseView.maxX, 5),
    [responseView]
  );
  const responseTicksY = useMemo(
    () => getTicks(responseView.minY, responseView.maxY, 5),
    [responseView]
  );
  const challengeBaseView = useMemo(
    () => buildChallengeResponseView(challengeTargets),
    [challengeTargets]
  );
  const challengeView = challengeResponseView ?? challengeBaseView;
  const challengeResponsePaths = useMemo(
    () =>
      challengeTargets.map((target) => ({
        id: target.id,
        color: target.color,
        label: target.label,
        path: buildResponsePath(target.response, challengeView, RESPONSE_SIZE),
      })),
    [challengeTargets, challengeView]
  );
  const challengeMetrics = useMemo(
    () =>
      challengeTargets.map((target) => ({
        id: target.id,
        label: target.label,
        color: target.color,
        metrics: computeStepMetrics(target.response),
      })),
    [challengeTargets]
  );
  const challengeTicksX = useMemo(
    () => getTicks(challengeView.minX, challengeView.maxX, 5),
    [challengeView]
  );
  const challengeTicksY = useMemo(
    () => getTicks(challengeView.minY, challengeView.maxY, 5),
    [challengeView]
  );
  const challengeAverageScore = useMemo(() => {
    if (!challengeScores?.length) return null;
    return Math.round(
      challengeScores.reduce((sum, score) => sum + score, 0) / challengeScores.length
    );
  }, [challengeScores]);

  const activeSigma = selectedPole ? selectedPole.re : -1;
  const activeBeta = selectedPole ? Math.abs(selectedPole.im) : 0;
  const activeMetrics = selectedPole ? getZetaWn(selectedPole.re, selectedPole.im) : null;

  const renderRoots = useMemo<RenderRoot[]>(() => {
    const allRoots = [...poles, ...zeros];
    return allRoots.flatMap((root) =>
      toRenderRoots(root, {
        color: root.kind === 'pole' ? '#f87171' : '#60a5fa',
      })
    );
  }, [poles, zeros]);

  const challengeGuessRoots = useMemo<RenderRoot[]>(() => {
    return challengeTargets.flatMap((target) => {
      const root: RootPoint = {
        id: `guess-${target.id}`,
        re: target.guess.re,
        im: target.guess.im,
        conjugate: true,
        kind: 'pole',
      };
      return toRenderRoots(root, { color: target.color, targetId: target.id });
    });
  }, [challengeTargets]);

  const challengeAnswerRoots = useMemo<RenderRoot[]>(() => {
    if (!challengeSubmitted) return [];
    return challengeTargets.flatMap((target) => {
      const root: RootPoint = {
        id: `answer-${target.id}`,
        re: target.pole.re,
        im: target.pole.im,
        conjugate: true,
        kind: 'pole',
      };
      return toRenderRoots(root, { color: target.color, dashed: true });
    });
  }, [challengeSubmitted, challengeTargets]);

  const planeTicksX = useMemo(() => getTicks(planeView.minRe, planeView.maxRe, 6), [planeView]);
  const planeTicksY = useMemo(() => getTicks(planeView.minIm, planeView.maxIm, 6), [planeView]);
  const wnTicks = useMemo(() => {
    const radiusMax = Math.max(
      Math.abs(planeView.minRe),
      Math.abs(planeView.maxRe),
      Math.abs(planeView.minIm),
      Math.abs(planeView.maxIm)
    );
    return getTicks(0, radiusMax, 4).filter((value) => value > 0);
  }, [planeView]);
  const planeScale = useMemo(() => getPlaneScale(planeView), [planeView]);
  const origin = useMemo(() => toSvgCoords(0, 0, planeView), [planeView]);
  const showReAxis = planeView.minIm < 0 && planeView.maxIm > 0;
  const showImAxis = planeView.minRe < 0 && planeView.maxRe > 0;

  const rootsToRender =
    mode === 'challenge'
      ? [...challengeAnswerRoots, ...challengeGuessRoots]
      : renderRoots;
  const canLockPolar = selectedRoot?.kind !== 'zero';

  const updateRoot = useCallback(
    (id: string, kind: RootKind, nextRe: number, nextIm: number) => {
      const updater = (list: RootPoint[]) =>
        list.map((item) => {
          if (item.id !== id) return item;
          const normalizedIm = item.conjugate ? Math.abs(nextIm) : nextIm;
          return {
            ...item,
            re: nextRe,
            im: normalizedIm,
          };
        });

      if (kind === 'pole') {
        setPoles((prev) => updater(prev));
      } else {
        setZeros((prev) => updater(prev));
      }
    },
    []
  );

  const applyLockedPosition = useCallback(
    (target: RootPoint, next: { re: number; im: number }) => {
      let re = next.re;
      let im = next.im;
      const usePolarLock = lockZeta || lockWn;

      if (!usePolarLock) {
        if (lockReal) re = target.re;
        if (lockImag) im = target.im;
      }

      if (usePolarLock && target.kind === 'pole') {
        if (lockZeta) {
          const { zeta } = getZetaWn(target.re, target.im);
          const wn = Math.max(0.3, Math.sqrt(next.re * next.re + next.im * next.im));
          const pole = poleFromZetaWn(zeta, wn, target.im >= 0 ? 1 : -1);
          re = pole.re;
          im = pole.im;
        }
        if (lockWn) {
          const { wn } = getZetaWn(target.re, target.im);
          const radius = Math.sqrt(next.re * next.re + next.im * next.im) || 1;
          const scale = wn / radius;
          re = next.re * scale;
          im = next.im * scale;
        }
      }

      if (target.conjugate) {
        im = Math.abs(im);
      }

      return {
        re: clamp(re, planeView.minRe, planeView.maxRe),
        im: clamp(im, planeView.minIm, planeView.maxIm),
      };
    },
    [lockImag, lockReal, lockWn, lockZeta, planeView]
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (draggingRoot && planeSvgRef.current) {
        const rect = planeSvgRef.current.getBoundingClientRect();
        const next = fromSvgCoords(event.clientX - rect.left, event.clientY - rect.top, planeView);

        if (draggingRoot.source === 'challenge' && draggingRoot.targetId) {
          const target = challengeTargets.find((item) => item.id === draggingRoot.targetId);
          if (!target) return;
          const targetRoot: RootPoint = {
            id: target.id,
            re: target.guess.re,
            im: target.guess.im,
            conjugate: true,
            kind: 'pole',
          };
          const locked = applyLockedPosition(targetRoot, next);
          setChallengeTargets((prev) =>
            prev.map((item) =>
              item.id === target.id ? { ...item, guess: { re: locked.re, im: locked.im } } : item
            )
          );
          onStateChange?.({
            progress: 0,
            data: {
              action: 'drag',
              id: target.id,
              kind: 'pole',
              re: locked.re,
              im: locked.im,
            },
            timestamp: Date.now(),
          });
          return;
        }

        const targetRoot = (draggingRoot.kind === 'pole' ? poles : zeros).find(
          (item) => item.id === draggingRoot.id
        );
        if (!targetRoot) return;
        const locked = applyLockedPosition(targetRoot, next);
        updateRoot(draggingRoot.id, draggingRoot.kind, locked.re, locked.im);
        onStateChange?.({
          progress: progressValue,
          data: {
            action: 'drag',
            id: draggingRoot.id,
            kind: draggingRoot.kind,
            re: locked.re,
            im: locked.im,
          },
          timestamp: Date.now(),
        });
        return;
      }

      if (panningPlane && planeSvgRef.current) {
        const plotWidth = SVG_SIZE.width - SVG_SIZE.padding * 2;
        const plotHeight = SVG_SIZE.height - SVG_SIZE.padding * 2;
        const rangeRe = panningPlane.view.maxRe - panningPlane.view.minRe;
        const rangeIm = panningPlane.view.maxIm - panningPlane.view.minIm;
        const dx = event.clientX - panningPlane.startX;
        const dy = event.clientY - panningPlane.startY;
        const deltaRe = (dx / plotWidth) * rangeRe;
        const deltaIm = (dy / plotHeight) * rangeIm;
        setPlaneView({
          minRe: panningPlane.view.minRe - deltaRe,
          maxRe: panningPlane.view.maxRe - deltaRe,
          minIm: panningPlane.view.minIm + deltaIm,
          maxIm: panningPlane.view.maxIm + deltaIm,
        });
        return;
      }

      if (panningResponse && responseSvgRef.current) {
        const plotWidth = RESPONSE_SIZE.width - RESPONSE_SIZE.padding * 2;
        const plotHeight = RESPONSE_SIZE.height - RESPONSE_SIZE.padding * 2;
        const rangeX = panningResponse.view.maxX - panningResponse.view.minX;
        const rangeY = panningResponse.view.maxY - panningResponse.view.minY;
        const dx = event.clientX - panningResponse.startX;
        const dy = event.clientY - panningResponse.startY;
        const deltaX = (dx / plotWidth) * rangeX;
        const deltaY = (dy / plotHeight) * rangeY;
        const nextView = {
          minX: panningResponse.view.minX - deltaX,
          maxX: panningResponse.view.maxX - deltaX,
          minY: panningResponse.view.minY + deltaY,
          maxY: panningResponse.view.maxY + deltaY,
        };
        if (panningResponse.source === 'challenge') {
          setChallengeViewMode('manual');
          setChallengeResponseView(nextView);
        } else {
          setResponseViewMode('manual');
          setResponseView(nextView);
        }
      }
    },
    [
      applyLockedPosition,
      challengeTargets,
      draggingRoot,
      panningPlane,
      panningResponse,
      planeView,
      poles,
      progressValue,
      updateRoot,
      onStateChange,
      zeros,
    ]
  );

  const stopDragging = useCallback(
    (dragInfo: typeof draggingRoot) => {
      if (!dragInfo) return;
      if (dragInfo.source === 'challenge' && dragInfo.targetId) {
        const target = challengeTargets.find((item) => item.id === dragInfo.targetId);
        if (!target) return;
        interactive?.tracking.emit('param_change', {
          id: target.id,
          kind: 'pole',
          re: target.guess.re,
          im: target.guess.im,
        });
        return;
      }
      const targetRoot = (dragInfo.kind === 'pole' ? poles : zeros).find(
        (item) => item.id === dragInfo.id
      );
      if (targetRoot) {
        interactive?.tracking.emit('param_change', {
          id: dragInfo.id,
          kind: dragInfo.kind,
          re: targetRoot.re,
          im: targetRoot.im,
        });
      }
    },
    [challengeTargets, interactive?.tracking, poles, zeros]
  );

  useEffect(() => {
    if (!draggingRoot && !panningPlane && !panningResponse) return undefined;
    const handleUp = () => {
      stopDragging(draggingRoot);
      setDraggingRoot(null);
      setPanningPlane(null);
      setPanningResponse(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [draggingRoot, handlePointerMove, panningPlane, panningResponse, stopDragging]);

  const handleRootPointerDown = useCallback(
    (root: RenderRoot) => (event: React.PointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (mode === 'challenge') {
        if (challengeSubmitted || !root.targetId) return;
        setSelectedChallengeId(root.targetId);
        setDraggingRoot({
          id: root.id,
          kind: root.kind,
          source: 'challenge',
          targetId: root.targetId,
        });
        return;
      }
      setSelectedId(root.id);
      setDraggingRoot({ id: root.id, kind: root.kind, source: 'explore' });
    },
    [challengeSubmitted, mode]
  );

  const handlePlanePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      setPanningPlane({
        startX: event.clientX,
        startY: event.clientY,
        view: planeView,
      });
    },
    [planeView]
  );

  const handleResponsePointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      if (mode === 'challenge') {
        setPanningResponse({
          startX: event.clientX,
          startY: event.clientY,
          view: challengeView,
          source: 'challenge',
        });
        return;
      }
      setPanningResponse({
        startX: event.clientX,
        startY: event.clientY,
        view: responseView,
        source: 'explore',
      });
    },
    [challengeView, mode, responseView]
  );

  const zoomPlane = useCallback(
    (direction: 'in' | 'out' | 'reset') => {
      if (direction === 'reset') {
        setPlaneView(DEFAULT_PLANE_VIEW);
        return;
      }
      const center = {
        re: (planeView.minRe + planeView.maxRe) / 2,
        im: (planeView.minIm + planeView.maxIm) / 2,
      };
      const factor = direction === 'in' ? 0.9 : 1.1;
      setPlaneView((prev) => zoomPlaneView(prev, factor, center));
    },
    [planeView]
  );

  const zoomResponse = useCallback(
    (direction: 'in' | 'out' | 'reset') => {
      if (direction === 'reset') {
        if (mode === 'challenge') {
          setChallengeViewMode('auto');
          setChallengeResponseView(null);
        } else {
          setResponseViewMode('auto');
        }
        return;
      }
      const view = mode === 'challenge' ? challengeView : responseView;
      const center = {
        t: (view.minX + view.maxX) / 2,
        y: (view.minY + view.maxY) / 2,
      };
      const factor = direction === 'in' ? 0.9 : 1.1;
      if (mode === 'challenge') {
        setChallengeViewMode('manual');
        setChallengeResponseView((prev) =>
          zoomResponseView(prev ?? view, factor, center)
        );
        return;
      }
      setResponseViewMode('manual');
      setResponseView((prev) => zoomResponseView(prev, factor, center));
    },
    [challengeView, mode, responseView]
  );

  const addRoot = useCallback((kind: RootKind, conjugate: boolean) => {
    const id = `${kind}-${Date.now()}`;
    const nextRoot: RootPoint = {
      id,
      re: -1.2,
      im: conjugate ? 1.2 : 0,
      conjugate,
      kind,
    };
    if (kind === 'pole') {
      setPoles((prev) => [...prev, nextRoot]);
    } else {
      setZeros((prev) => [...prev, nextRoot]);
    }
    setSelectedId(id);
    interactive?.tracking.emit('interact', { action: 'add_root', kind, conjugate });
  }, [interactive?.tracking]);

  const removeSelected = useCallback(() => {
    if (!selectedId) return;
    const remove = (list: RootPoint[]) => list.filter((item) => item.id !== selectedId);
    setPoles((prev) => remove(prev));
    setZeros((prev) => remove(prev));
    setSelectedId(null);
    interactive?.tracking.emit('interact', { action: 'remove_root', id: selectedId });
  }, [interactive?.tracking, selectedId]);

  const resetExplore = useCallback(() => {
    setPoles(DEFAULT_POLES.map((pole) => ({ ...pole, kind: 'pole' })));
    setZeros([]);
    setSignal(DEFAULT_SIGNAL);
    setSelectedId(null);
    setLockReal(false);
    setLockImag(false);
    setLockZeta(false);
    setLockWn(false);
    setPlaneView(DEFAULT_PLANE_VIEW);
    setResponseViewMode('auto');
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [interactive]);

  const toggleLockReal = useCallback(() => {
    setLockReal((prev) => {
      const next = !prev;
      if (next) {
        setLockImag(false);
        setLockZeta(false);
        setLockWn(false);
      }
      return next;
    });
  }, []);

  const toggleLockImag = useCallback(() => {
    setLockImag((prev) => {
      const next = !prev;
      if (next) {
        setLockReal(false);
        setLockZeta(false);
        setLockWn(false);
      }
      return next;
    });
  }, []);

  const toggleLockZeta = useCallback(() => {
    setLockZeta((prev) => {
      const next = !prev;
      if (next) {
        setLockWn(false);
        setLockReal(false);
        setLockImag(false);
      }
      return next;
    });
  }, []);

  const toggleLockWn = useCallback(() => {
    setLockWn((prev) => {
      const next = !prev;
      if (next) {
        setLockZeta(false);
        setLockReal(false);
        setLockImag(false);
      }
      return next;
    });
  }, []);

  const buildChallengeTargets = useCallback(() => {
    const polesForChallenge = buildChallengePoles(DEFAULT_PLANE_VIEW);
    const sharedDuration = Math.max(
      ...polesForChallenge.map((pole, index) =>
        estimateDuration([
          {
            id: `duration-${index}`,
            re: pole.re,
            im: pole.im,
            conjugate: true,
            kind: 'pole',
          },
        ])
      )
    );
    const targets = polesForChallenge.map((pole, index) => {
      const polesForSim: RootPoint[] = [
        {
          id: `target-${index}`,
          re: pole.re,
          im: pole.im,
          conjugate: true,
          kind: 'pole',
        },
      ];
      return {
        id: `challenge-${index}`,
        label: `曲线 ${index + 1}`,
        color: CHALLENGE_COLORS[index % CHALLENGE_COLORS.length],
        pole,
        response: simulateResponse(polesForSim, [], 'step', sharedDuration, runtimeReady),
        guess: randomStablePole(DEFAULT_PLANE_VIEW),
      };
    });
    setChallengeTargets(targets);
    setChallengeStart(Date.now());
    setChallengeSubmitted(false);
    setChallengeScores(null);
    setPathContinueResult(null);
    setSelectedChallengeId(targets[0]?.id ?? null);
    setPlaneView(DEFAULT_PLANE_VIEW);
    setChallengeViewMode('auto');
    setChallengeResponseView(buildChallengeResponseView(targets));
    interactive?.progress.setProgress(0);
  }, [interactive?.progress, runtimeReady]);

  useEffect(() => {
    if (mode === 'challenge') {
      if (!challengeTargets.length) {
        buildChallengeTargets();
      }
      return;
    }
    if (mode === 'explore') {
      setSelectedChallengeId(null);
      setChallengeSubmitted(false);
      setChallengeScores(null);
      setPathContinueResult(null);
      setResponseViewMode('auto');
      setPlaneView(DEFAULT_PLANE_VIEW);
      setChallengeTargets([]);
    }
  }, [buildChallengeTargets, challengeTargets.length, mode]);

  useEffect(() => {
    if (mode !== 'explore' || responseViewMode !== 'auto') return;
    setResponseView(buildResponseView(response));
  }, [mode, response, responseViewMode]);

  useEffect(() => {
    if (mode !== 'challenge' || challengeViewMode !== 'auto') return;
    setChallengeResponseView(challengeBaseView);
  }, [challengeBaseView, challengeViewMode, mode]);

  const handleSubmitChallenge = useCallback(() => {
    if (challengeSubmitted || !challengeTargets.length) return;
    const scores = challengeTargets.map((target) =>
      scoreGuess(target.pole, target.guess)
    );
    const averageScore = Math.round(
      scores.reduce((sum, score) => sum + score, 0) / scores.length
    );
    const duration = challengeStart ? (Date.now() - challengeStart) / 1000 : 0;

    const result: WidgetResult = {
      success: true,
      score: averageScore,
      data: {
        scores,
        duration,
        targets: challengeTargets.map((target) => target.pole),
        guesses: challengeTargets.map((target) => target.guess),
        labels: challengeTargets.map((target) => target.label),
        colors: challengeTargets.map((target) => target.color),
      },
    };

    interactive?.tracking.emit('submit', {
      mode: 'challenge',
      scores,
      averageScore,
      duration,
    });
    interactive?.progress.setProgress(100);
    setPathContinueResult(result);
    setChallengeSubmitted(true);
    setChallengeScores(scores);

    if (!sessionId && typeof window !== 'undefined') {
      const nextBest =
        !bestRecord || averageScore > bestRecord.score
          ? { score: averageScore, duration }
          : bestRecord.score === averageScore && duration < bestRecord.duration
            ? { score: averageScore, duration }
            : bestRecord;
      setBestRecord(nextBest);
      window.localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(nextBest));
    }

    if (sessionId) {
      fetch(`/api/session/${sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: interactive?.config.resourceId,
          data: {
            kind: 'pole-manipulator',
            score: averageScore,
            duration,
            scores,
            targets: challengeTargets.map((target) => target.pole),
            guesses: challengeTargets.map((target) => target.guess),
            labels: challengeTargets.map((target) => target.label),
            colors: challengeTargets.map((target) => target.color),
          },
        }),
      }).catch((error) => {
        console.error('Failed to sync session state:', error);
      });
    }
  }, [
    bestRecord,
    challengeStart,
    challengeSubmitted,
    challengeTargets,
    interactive?.config.resourceId,
    interactive?.progress,
    interactive?.tracking,
    sessionId,
  ]);

  useEffect(() => {
    if (mode !== 'challenge') return;
    interactive?.progress.setProgress(0);
  }, [interactive?.progress, mode]);

  return (
    <div className="min-h-[720px] w-full bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">时域分析 · 极点操纵器</p>
            <h2 className="text-2xl font-semibold text-white">S-Plane 极点操纵与响应感知</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              在复平面拖拽极点与零点，观察阶跃响应如何随衰减与振荡频率变化。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 p-1 text-xs">
            <button type="button"
              onClick={() => setMode('explore')}
              className={`rounded-full px-4 py-2 transition ${
                mode === 'explore' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400'
              }`}
            >
              自由探索
            </button>
            <button type="button"
              onClick={() => setMode('challenge')}
              className={`rounded-full px-4 py-2 transition ${
                mode === 'challenge' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400'
              }`}
            >
              挑战模式
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Crosshair className="h-4 w-4 text-cyan-400" />
                复平面 · S-Plane
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button type="button"
                  onClick={toggleLockReal}
                  className={`rounded-full border px-3 py-1 transition ${
                    lockReal ? 'border-cyan-400/70 text-cyan-200' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  锁定实部
                </button>
                <button type="button"
                  onClick={toggleLockImag}
                  className={`rounded-full border px-3 py-1 transition ${
                    lockImag ? 'border-amber-400/70 text-amber-200' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  锁定虚部
                </button>
                <button type="button"
                  onClick={toggleLockZeta}
                  disabled={!canLockPolar}
                  className={`rounded-full border px-3 py-1 transition ${
                    lockZeta ? 'border-emerald-400/70 text-emerald-200' : 'border-slate-700 text-slate-400'
                  } ${!canLockPolar ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  锁定阻尼
                </button>
                <button type="button"
                  onClick={toggleLockWn}
                  disabled={!canLockPolar}
                  className={`rounded-full border px-3 py-1 transition ${
                    lockWn ? 'border-violet-400/70 text-violet-200' : 'border-slate-700 text-slate-400'
                  } ${!canLockPolar ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  锁定频率
                </button>
                <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/50 px-1 py-1">
                  <button type="button"
                    onClick={() => zoomPlane('in')}
                    className="rounded-full border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500"
                    aria-label="放大复平面"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button type="button"
                    onClick={() => zoomPlane('out')}
                    className="rounded-full border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500"
                    aria-label="缩小复平面"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <button type="button"
                    onClick={() => zoomPlane('reset')}
                    className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                  >
                    复位
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <svg
                ref={planeSvgRef}
                viewBox={`0 0 ${SVG_SIZE.width} ${SVG_SIZE.height}`}
                onPointerDown={handlePlanePointerDown}
                className={`h-[360px] w-full ${panningPlane ? 'cursor-grabbing' : 'cursor-crosshair'}`}
              >
                <rect width="100%" height="100%" fill="#0b1120" />
                {planeTicksX.map((tick) => {
                  const { x } = toSvgCoords(tick, 0, planeView);
                  return (
                    <line
                      key={`grid-x-${tick}`}
                      x1={x}
                      y1={SVG_SIZE.padding}
                      x2={x}
                      y2={SVG_SIZE.height - SVG_SIZE.padding}
                      stroke="#334155"
                      strokeDasharray="4 6"
                    />
                  );
                })}
                {planeTicksY.map((tick) => {
                  const { y } = toSvgCoords(0, tick, planeView);
                  return (
                    <line
                      key={`grid-y-${tick}`}
                      x1={SVG_SIZE.padding}
                      y1={y}
                      x2={SVG_SIZE.width - SVG_SIZE.padding}
                      y2={y}
                      stroke="#334155"
                      strokeDasharray="4 6"
                    />
                  );
                })}

                {wnTicks.map((wn) => {
                  const rx = wn * planeScale.scaleX;
                  const ry = wn * planeScale.scaleY;
                  return (
                    <ellipse
                      key={`wn-${wn}`}
                      cx={origin.x}
                      cy={origin.y}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      stroke="#e2e8f0"
                      strokeDasharray="6 6"
                      opacity="0.45"
                    />
                  );
                })}

                {ZETA_LINES.map((zeta) => {
                  const phi = Math.acos(clamp(zeta, 0, 1));
                  const slope = Math.tan(phi);
                  const endpoint = getZetaLineEndpoint(planeView, slope);
                  const upper = toSvgCoords(endpoint.re, Math.abs(endpoint.im), planeView);
                  const lower = toSvgCoords(endpoint.re, -Math.abs(endpoint.im), planeView);
                  return (
                    <g key={`zeta-${zeta}`}>
                      <line
                        x1={origin.x}
                        y1={origin.y}
                        x2={upper.x}
                        y2={upper.y}
                        stroke="#e2e8f0"
                        strokeDasharray="6 6"
                        opacity="0.45"
                      />
                      <line
                        x1={origin.x}
                        y1={origin.y}
                        x2={lower.x}
                        y2={lower.y}
                        stroke="#e2e8f0"
                        strokeDasharray="6 6"
                        opacity="0.45"
                      />
                    </g>
                  );
                })}

                {showReAxis && (
                  <line
                    x1={SVG_SIZE.padding}
                    y1={origin.y}
                    x2={SVG_SIZE.width - SVG_SIZE.padding}
                    y2={origin.y}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                )}
                {showImAxis && (
                  <line
                    x1={origin.x}
                    y1={SVG_SIZE.padding}
                    x2={origin.x}
                    y2={SVG_SIZE.height - SVG_SIZE.padding}
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                  />
                )}

                {selectedPole && (
                  <>
                    <line
                      x1={toSvgCoords(activeSigma, 0, planeView).x}
                      y1={SVG_SIZE.padding}
                      x2={toSvgCoords(activeSigma, 0, planeView).x}
                      y2={SVG_SIZE.height - SVG_SIZE.padding}
                      stroke="#22d3ee"
                      strokeDasharray="8 6"
                    />
                    <line
                      x1={SVG_SIZE.padding}
                      y1={toSvgCoords(0, activeBeta, planeView).y}
                      x2={SVG_SIZE.width - SVG_SIZE.padding}
                      y2={toSvgCoords(0, activeBeta, planeView).y}
                      stroke="#f59e0b"
                      strokeDasharray="8 6"
                    />
                    {activeBeta > 0 && (
                      <line
                        x1={SVG_SIZE.padding}
                        y1={toSvgCoords(0, -activeBeta, planeView).y}
                        x2={SVG_SIZE.width - SVG_SIZE.padding}
                        y2={toSvgCoords(0, -activeBeta, planeView).y}
                        stroke="#f59e0b"
                        strokeDasharray="8 6"
                      />
                    )}
                  </>
                )}

                {rootsToRender.map((root) => {
                  const { x, y } = toSvgCoords(root.re, root.im, planeView);
                  const isSelected =
                    mode === 'explore'
                      ? selectedId === root.id && !root.mirror
                      : root.targetId === selectedChallengeId && !root.mirror;
                  const color = root.color ?? (root.kind === 'pole' ? '#f87171' : '#60a5fa');
                  const label = root.kind === 'pole' ? '×' : '○';
                  const canDrag =
                    !root.mirror &&
                    !root.dashed &&
                    (mode === 'explore' || (mode === 'challenge' && !challengeSubmitted));
                  return (
                    <g
                      key={`${root.id}-${root.im}-${root.mirror ? 'mirror' : 'base'}`}
                      onPointerDown={canDrag ? handleRootPointerDown(root) : undefined}
                      style={{ cursor: canDrag ? 'grab' : 'default' }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 10 : 8}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isSelected ? 3 : 2}
                        strokeDasharray={root.dashed ? '6 6' : undefined}
                        opacity={root.dashed ? 0.6 : 1}
                      />
                      <text
                        x={x}
                        y={y + 5}
                        fill={color}
                        textAnchor="middle"
                        fontSize="16"
                        fontFamily="monospace"
                        opacity={root.dashed ? 0.6 : 1}
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                {planeTicksX.map((tick) => {
                  const { x } = toSvgCoords(tick, planeView.minIm, planeView);
                  return (
                    <g key={`tick-x-${tick}`}>
                      <line
                        x1={x}
                        y1={SVG_SIZE.height - SVG_SIZE.padding}
                        x2={x}
                        y2={SVG_SIZE.height - SVG_SIZE.padding + 6}
                        stroke="#cbd5e1"
                      />
                      <text x={x} y={SVG_SIZE.height - 8} fill="#e2e8f0" fontSize="11" textAnchor="middle">
                        {tick.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                {planeTicksY.map((tick) => {
                  const { y } = toSvgCoords(planeView.minRe, tick, planeView);
                  return (
                    <g key={`tick-y-${tick}`}>
                      <line
                        x1={SVG_SIZE.padding - 6}
                        y1={y}
                        x2={SVG_SIZE.padding}
                        y2={y}
                        stroke="#cbd5e1"
                      />
                      <text
                        x={SVG_SIZE.padding - 10}
                        y={y + 4}
                        fill="#e2e8f0"
                        fontSize="11"
                        textAnchor="end"
                      >
                        {tick.toFixed(1)}
                      </text>
                    </g>
                  );
                })}

                <text
                  x={SVG_SIZE.width - 60}
                  y={SVG_SIZE.height - SVG_SIZE.padding + 28}
                  fill="#e2e8f0"
                  fontSize="12"
                >
                  Re
                </text>
                <text x={SVG_SIZE.padding - 28} y={SVG_SIZE.padding - 10} fill="#e2e8f0" fontSize="12">
                  Im
                </text>
              </svg>
            </div>

            <div className="mt-4 grid gap-3 text-xs text-slate-400 md:grid-cols-4">
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                <div className="text-cyan-200">实部 Re / σ</div>
                <div>{selectedRoot ? selectedRoot.re.toFixed(2) : '--'}</div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <div className="text-amber-200">虚部 Im / β</div>
                <div>{selectedRoot ? selectedRoot.im.toFixed(2) : '--'}</div>
              </div>
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                <div className="text-emerald-200">阻尼比 ζ</div>
                <div>{activeMetrics ? activeMetrics.zeta.toFixed(2) : '--'}</div>
              </div>
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-2">
                <div className="text-violet-200">自然频率 ωn</div>
                <div>{activeMetrics ? activeMetrics.wn.toFixed(2) : '--'}</div>
              </div>
            </div>

            {mode === 'explore' && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <button type="button"
                  onClick={() => addRoot('pole', false)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加实极点
                </button>
                <button type="button"
                  onClick={() => addRoot('pole', true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加共轭极点
                </button>
                <button type="button"
                  onClick={() => addRoot('zero', false)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加实零点
                </button>
                <button type="button"
                  onClick={() => addRoot('zero', true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加共轭零点
                </button>
                <button type="button"
                  onClick={removeSelected}
                  disabled={!selectedId}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-400 hover:border-slate-500 disabled:opacity-40"
                >
                  <Minus className="h-3 w-3" />
                  删除选中
                </button>
                <button type="button"
                  onClick={resetExplore}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-400 hover:border-slate-500"
                >
                  <RefreshCw className="h-3 w-3" />
                  重置
                </button>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Activity className="h-4 w-4 text-emerald-400" />
                时域响应
              </div>
              <div className="flex items-center gap-2 text-xs">
                {mode === 'explore' && (
                  <select
                    value={signal}
                    onChange={(event) => setSignal(event.target.value as SignalType)}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200"
                  >
                    <option value="step">单位阶跃</option>
                    <option value="ramp">斜坡输入</option>
                    <option value="impulse">单位脉冲</option>
                  </select>
                )}
                <div className="flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900/50 px-1 py-1">
                  <button type="button"
                    onClick={() => zoomResponse('in')}
                    className="rounded-full border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500"
                    aria-label="放大响应曲线"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button type="button"
                    onClick={() => zoomResponse('out')}
                    className="rounded-full border border-slate-700 px-2 py-1 text-slate-300 hover:border-slate-500"
                    aria-label="缩小响应曲线"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <button type="button"
                    onClick={() => zoomResponse('reset')}
                    className="rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                  >
                    复位
                  </button>
                </div>
              </div>
            </div>

            {mode === 'explore' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <svg
                  ref={responseSvgRef}
                  viewBox={`0 0 ${RESPONSE_SIZE.width} ${RESPONSE_SIZE.height}`}
                  onPointerDown={handleResponsePointerDown}
                  className={`h-[360px] w-full ${panningResponse ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  <rect width={RESPONSE_SIZE.width} height={RESPONSE_SIZE.height} rx="16" fill="#0f172a" />
                  {responseTicksX.map((tick) => {
                    const plotWidth = RESPONSE_SIZE.width - RESPONSE_SIZE.padding * 2;
                    const rangeX = Math.max(1e-6, responseView.maxX - responseView.minX);
                    const x =
                      RESPONSE_SIZE.padding + ((tick - responseView.minX) / rangeX) * plotWidth;
                    return (
                      <line
                        key={`response-grid-x-${tick}`}
                        x1={x}
                        y1={RESPONSE_SIZE.padding}
                        x2={x}
                        y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                        stroke="#334155"
                        strokeDasharray="4 6"
                      />
                    );
                  })}
                  {responseTicksY.map((tick) => {
                    const plotHeight = RESPONSE_SIZE.height - RESPONSE_SIZE.padding * 2;
                    const rangeY = Math.max(1e-6, responseView.maxY - responseView.minY);
                    const y =
                      RESPONSE_SIZE.padding +
                      (1 - (tick - responseView.minY) / rangeY) * plotHeight;
                    return (
                      <line
                        key={`response-grid-y-${tick}`}
                        x1={RESPONSE_SIZE.padding}
                        y1={y}
                        x2={RESPONSE_SIZE.width - RESPONSE_SIZE.padding}
                        y2={y}
                        stroke="#334155"
                        strokeDasharray="4 6"
                      />
                    );
                  })}
                  <path d={responsePath} stroke="#34d399" strokeWidth="3" fill="none" />
                  <line
                    x1={RESPONSE_SIZE.padding}
                    y1={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                    x2={RESPONSE_SIZE.width - RESPONSE_SIZE.padding}
                    y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  <line
                    x1={RESPONSE_SIZE.padding}
                    y1={RESPONSE_SIZE.padding}
                    x2={RESPONSE_SIZE.padding}
                    y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  {responseTicksX.map((tick) => {
                    const plotWidth = RESPONSE_SIZE.width - RESPONSE_SIZE.padding * 2;
                    const rangeX = Math.max(1e-6, responseView.maxX - responseView.minX);
                    const x =
                      RESPONSE_SIZE.padding + ((tick - responseView.minX) / rangeX) * plotWidth;
                    return (
                      <g key={`response-tick-x-${tick}`}>
                        <line
                          x1={x}
                          y1={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                          x2={x}
                          y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding + 6}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={x}
                          y={RESPONSE_SIZE.height - 6}
                          fill="#e2e8f0"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {tick.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                  {responseTicksY.map((tick) => {
                    const plotHeight = RESPONSE_SIZE.height - RESPONSE_SIZE.padding * 2;
                    const rangeY = Math.max(1e-6, responseView.maxY - responseView.minY);
                    const y =
                      RESPONSE_SIZE.padding +
                      (1 - (tick - responseView.minY) / rangeY) * plotHeight;
                    return (
                      <g key={`response-tick-y-${tick}`}>
                        <line
                          x1={RESPONSE_SIZE.padding - 6}
                          y1={y}
                          x2={RESPONSE_SIZE.padding}
                          y2={y}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={RESPONSE_SIZE.padding - 10}
                          y={y + 3}
                          fill="#e2e8f0"
                          fontSize="10"
                          textAnchor="end"
                        >
                          {tick.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-slate-400">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="text-slate-200">响应时长</div>
                    <div>{response.duration.toFixed(1)} s</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                    <div className="text-slate-200">信号类型</div>
                    <div>{signal === 'step' ? '单位阶跃' : signal === 'ramp' ? '斜坡输入' : '单位脉冲'}</div>
                  </div>
                </div>
                {signal === 'step' && responseMetrics && (
                  <div className="mt-3 grid grid-cols-3 gap-3 text-xs text-slate-400">
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div className="text-slate-200">超调量</div>
                      <div>
                        {responseMetrics.overshoot === null
                          ? '--'
                          : `${responseMetrics.overshoot.toFixed(1)}%`}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div className="text-slate-200">调节时间</div>
                      <div>
                        {responseMetrics.settlingTime === null
                          ? '--'
                          : `${responseMetrics.settlingTime.toFixed(2)} s`}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                      <div className="text-slate-200">峰值时间</div>
                      <div>
                        {responseMetrics.peakTime === null
                          ? '--'
                          : `${responseMetrics.peakTime.toFixed(2)} s`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <svg
                  ref={responseSvgRef}
                  viewBox={`0 0 ${RESPONSE_SIZE.width} ${RESPONSE_SIZE.height}`}
                  onPointerDown={handleResponsePointerDown}
                  className={`h-[360px] w-full ${panningResponse ? 'cursor-grabbing' : 'cursor-grab'}`}
                >
                  <rect width={RESPONSE_SIZE.width} height={RESPONSE_SIZE.height} rx="16" fill="#0f172a" />
                  {challengeTicksX.map((tick) => {
                    const plotWidth = RESPONSE_SIZE.width - RESPONSE_SIZE.padding * 2;
                    const rangeX = Math.max(1e-6, challengeView.maxX - challengeView.minX);
                    const x =
                      RESPONSE_SIZE.padding + ((tick - challengeView.minX) / rangeX) * plotWidth;
                    return (
                      <line
                        key={`challenge-grid-x-${tick}`}
                        x1={x}
                        y1={RESPONSE_SIZE.padding}
                        x2={x}
                        y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                        stroke="#334155"
                        strokeDasharray="4 6"
                      />
                    );
                  })}
                  {challengeTicksY.map((tick) => {
                    const plotHeight = RESPONSE_SIZE.height - RESPONSE_SIZE.padding * 2;
                    const rangeY = Math.max(1e-6, challengeView.maxY - challengeView.minY);
                    const y =
                      RESPONSE_SIZE.padding +
                      (1 - (tick - challengeView.minY) / rangeY) * plotHeight;
                    return (
                      <line
                        key={`challenge-grid-y-${tick}`}
                        x1={RESPONSE_SIZE.padding}
                        y1={y}
                        x2={RESPONSE_SIZE.width - RESPONSE_SIZE.padding}
                        y2={y}
                        stroke="#334155"
                        strokeDasharray="4 6"
                      />
                    );
                  })}
                  {challengeResponsePaths.map((series) => (
                    <path
                      key={series.id}
                      d={series.path}
                      stroke={series.color}
                      strokeWidth="2.5"
                      fill="none"
                    />
                  ))}
                  <line
                    x1={RESPONSE_SIZE.padding}
                    y1={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                    x2={RESPONSE_SIZE.width - RESPONSE_SIZE.padding}
                    y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  <line
                    x1={RESPONSE_SIZE.padding}
                    y1={RESPONSE_SIZE.padding}
                    x2={RESPONSE_SIZE.padding}
                    y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                    stroke="#cbd5e1"
                    strokeWidth="2"
                  />
                  {challengeTicksX.map((tick) => {
                    const plotWidth = RESPONSE_SIZE.width - RESPONSE_SIZE.padding * 2;
                    const rangeX = Math.max(1e-6, challengeView.maxX - challengeView.minX);
                    const x =
                      RESPONSE_SIZE.padding + ((tick - challengeView.minX) / rangeX) * plotWidth;
                    return (
                      <g key={`challenge-tick-x-${tick}`}>
                        <line
                          x1={x}
                          y1={RESPONSE_SIZE.height - RESPONSE_SIZE.padding}
                          x2={x}
                          y2={RESPONSE_SIZE.height - RESPONSE_SIZE.padding + 6}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={x}
                          y={RESPONSE_SIZE.height - 6}
                          fill="#e2e8f0"
                          fontSize="10"
                          textAnchor="middle"
                        >
                          {tick.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                  {challengeTicksY.map((tick) => {
                    const plotHeight = RESPONSE_SIZE.height - RESPONSE_SIZE.padding * 2;
                    const rangeY = Math.max(1e-6, challengeView.maxY - challengeView.minY);
                    const y =
                      RESPONSE_SIZE.padding +
                      (1 - (tick - challengeView.minY) / rangeY) * plotHeight;
                    return (
                      <g key={`challenge-tick-y-${tick}`}>
                        <line
                          x1={RESPONSE_SIZE.padding - 6}
                          y1={y}
                          x2={RESPONSE_SIZE.padding}
                          y2={y}
                          stroke="#cbd5e1"
                        />
                        <text
                          x={RESPONSE_SIZE.padding - 10}
                          y={y + 3}
                          fill="#e2e8f0"
                          fontSize="10"
                          textAnchor="end"
                        >
                          {tick.toFixed(1)}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  {challengeResponsePaths.map((series) => (
                    <div key={`legend-${series.id}`} className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: series.color }}
                      />
                      <span>{series.label}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
                  {challengeMetrics.map((item) => (
                    <div
                      key={`metric-${item.id}`}
                      className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 text-slate-200">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.label}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-300">
                        <div>
                          超调
                          <div>
                            {item.metrics.overshoot === null
                              ? '--'
                              : `${item.metrics.overshoot.toFixed(1)}%`}
                          </div>
                        </div>
                        <div>
                          调节
                          <div>
                            {item.metrics.settlingTime === null
                              ? '--'
                              : `${item.metrics.settlingTime.toFixed(2)} s`}
                          </div>
                        </div>
                        <div>
                          峰值
                          <div>
                            {item.metrics.peakTime === null
                              ? '--'
                              : `${item.metrics.peakTime.toFixed(2)} s`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        {mode === 'challenge' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Trophy className="h-4 w-4 text-amber-400" />
                  极点匹配挑战
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  右侧展示三条叠加响应曲线，拖动左侧同色极点完成匹配，提交后显示正确位置与得分。
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                {bestRecord && !sessionId && (
                  <div className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
                    历史最佳 {bestRecord.score}% · {formatSeconds(bestRecord.duration)}
                  </div>
                )}
                <button type="button"
                  onClick={buildChallengeTargets}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-400 hover:border-slate-500"
                >
                  <RefreshCw className="h-3 w-3" />
                  重新生成
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button"
                onClick={handleSubmitChallenge}
                disabled={challengeSubmitted}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/20 px-3 py-2 text-xs text-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trophy className="h-3 w-3" />
                提交评分
              </button>
              {challengeStart && (
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  已用时 {formatSeconds((Date.now() - challengeStart) / 1000)}
                </div>
              )}
              {challengeAverageScore !== null && (
                <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                  本次得分 {challengeAverageScore}%
                </div>
              )}
            </div>

            {challengeSubmitted && challengeScores && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {challengeTargets.map((target, index) => (
                  <div
                    key={`score-${target.id}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-3 py-1"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: target.color }}
                    />
                    {target.label} {challengeScores[index] ?? 0}%
                  </div>
                ))}
              </div>
            )}
            {pathContinueResult ? (
              <PathResourceContinueAction
                enabled
                result={pathContinueResult}
                onComplete={onComplete}
              />
            ) : null}
          </section>
        ) : (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Activity className="h-4 w-4 text-cyan-400" />
                  自由探索记录
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  通过拖拽理解极点位置与时间响应的关联，挑战模式将记录你的最佳成绩。
                </p>
              </div>
              {bestRecord && !sessionId && (
                <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                  历史最佳 {bestRecord.score}% · {formatSeconds(bestRecord.duration)}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
