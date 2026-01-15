'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Circle,
  Clock,
  Crosshair,
  Minus,
  Plus,
  RefreshCw,
  Target,
  Trophy,
} from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { BaseWidgetProps, WidgetResult } from '@/resources/widgets/widget-props';
import {
  discretizeTransferFunctionTustin,
  stepDiscreteStateSpace,
} from '@/lib/simulation';

const PLANE_BOUNDS = {
  minRe: -6,
  maxRe: 2,
  minIm: -4,
  maxIm: 4,
};

const SVG_SIZE = {
  width: 520,
  height: 360,
  padding: 40,
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

interface ChallengeTarget {
  id: string;
  title: string;
  poles: { re: number; im: number };
  response: ResponseSeries;
  guess: { re: number; im: number };
  locked: boolean;
}

interface BestRecord {
  score: number;
  duration: number;
}

const DEFAULT_SIGNAL: SignalType = 'step';
const CHALLENGE_COUNT = 3;
const SIM_DT = 1 / 60;
const MAX_SIM_STEPS = 900;
const BEST_STORAGE_KEY = 'pole-manipulator-best';

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function toSvgCoords(re: number, im: number) {
  const { minRe, maxRe, minIm, maxIm } = PLANE_BOUNDS;
  const plotWidth = SVG_SIZE.width - SVG_SIZE.padding * 2;
  const plotHeight = SVG_SIZE.height - SVG_SIZE.padding * 2;
  const x = SVG_SIZE.padding + ((re - minRe) / (maxRe - minRe)) * plotWidth;
  const y = SVG_SIZE.padding + ((maxIm - im) / (maxIm - minIm)) * plotHeight;
  return { x, y };
}

function fromSvgCoords(x: number, y: number) {
  const { minRe, maxRe, minIm, maxIm } = PLANE_BOUNDS;
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

function estimateDuration(poles: RootPoint[]) {
  const decayRates = poles
    .map((pole) => -pole.re)
    .filter((value) => value > 0);
  const minDecay = decayRates.length ? Math.min(...decayRates) : 0;
  if (minDecay <= 0) return 8;
  return clamp(6 / minDecay, 6, 12);
}

function getSignalValue(signal: SignalType, t: number, dt: number) {
  if (signal === 'step') return 1;
  if (signal === 'ramp') return t;
  if (signal === 'impulse') return t <= dt ? 1 / dt : 0;
  return 1;
}

function simulateResponse(poles: RootPoint[], zeros: RootPoint[], signal: SignalType): ResponseSeries {
  const expandedPoles = expandRoots(poles);
  const expandedZeros = expandRoots(zeros);

  const numerator = toRealCoefficients(polyFromRoots(expandedZeros));
  const denominator = toRealCoefficients(polyFromRoots(expandedPoles));

  const duration = estimateDuration(poles);
  const steps = Math.min(MAX_SIM_STEPS, Math.ceil(duration / SIM_DT));

  const model = discretizeTransferFunctionTustin(
    {
      type: 'transfer_function',
      numerator: numerator.length ? numerator : [1],
      denominator: denominator.length ? denominator : [1],
    },
    SIM_DT
  );

  const points: ResponsePoint[] = [];
  let state = Array.from({ length: model.A.length }, () => 0);

  for (let i = 0; i <= steps; i += 1) {
    const t = i * SIM_DT;
    const inputValue = getSignalValue(signal, t, SIM_DT);
    const result = stepDiscreteStateSpace(model, state, [inputValue]);
    state = result.state;
    points.push({ t, y: result.output[0] ?? 0 });
  }

  const values = points.map((p) => p.y);
  const minY = Math.min(...values, 0);
  const maxY = Math.max(...values, 1);

  return {
    points,
    minY: minY - 0.1 * Math.abs(minY),
    maxY: maxY + 0.1 * Math.abs(maxY),
    duration,
  };
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

export default function PoleManipulator({ onComplete, onStateChange }: BaseWidgetProps) {
  const interactive = useOptionalInteractiveContext();
  const [mode, setMode] = useState<'explore' | 'challenge'>('explore');
  const [poles, setPoles] = useState<RootPoint[]>(
    DEFAULT_POLES.map((pole) => ({ ...pole, kind: 'pole' }))
  );
  const [zeros, setZeros] = useState<RootPoint[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signal, setSignal] = useState<SignalType>(DEFAULT_SIGNAL);
  const [lockReal, setLockReal] = useState(false);
  const [lockImag, setLockImag] = useState(false);
  const [bestRecord, setBestRecord] = useState<BestRecord | null>(null);
  const [challengeTargets, setChallengeTargets] = useState<ChallengeTarget[]>([]);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [challengeStart, setChallengeStart] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<{ id: string; kind: RootKind } | null>(null);

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

  const selectedPole = useMemo(() => {
    if (mode === 'challenge') {
      const target = challengeTargets.find((item) => item.id === activeTargetId);
      if (!target) return null;
      return {
        id: 'challenge-active',
        re: target.guess.re,
        im: target.guess.im,
        conjugate: true,
        kind: 'pole' as const,
      };
    }
    const pole = poles.find((item) => item.id === selectedId);
    if (pole) return pole;
    return poles[0] ?? null;
  }, [activeTargetId, challengeTargets, mode, poles, selectedId]);

  const response = useMemo(() => simulateResponse(poles, zeros, signal), [poles, zeros, signal]);

  const responsePath = useMemo(() => {
    const { points, minY, maxY, duration } = response;
    const width = 500;
    const height = 220;
    const padding = 30;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const rangeY = Math.max(1e-6, maxY - minY);
    return points
      .map((point, index) => {
        const x = padding + (point.t / duration) * plotWidth;
        const y = padding + (1 - (point.y - minY) / rangeY) * plotHeight;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');
  }, [response]);

  const activeSigma = selectedPole ? selectedPole.re : -1;
  const activeBeta = selectedPole ? selectedPole.im : 1;

  const renderRoots = useMemo<RenderRoot[]>(() => {
    const allRoots = [...poles, ...zeros];
    return allRoots.flatMap((root) => {
      const basePoint: RenderRoot = { ...root, mirror: false };
      if (root.conjugate && Math.abs(root.im) > 1e-6) {
        return [
          basePoint,
          { ...root, im: -root.im, mirror: true },
        ];
      }
      return [basePoint];
    });
  }, [poles, zeros]);

  const activeTarget = useMemo(
    () => challengeTargets.find((target) => target.id === activeTargetId) ?? null,
    [challengeTargets, activeTargetId]
  );

  const challengePoles = useMemo(() => {
    if (!activeTarget) return poles;
    return [
      {
        id: 'challenge-guess',
        re: activeTarget.guess.re,
        im: activeTarget.guess.im,
        conjugate: true,
        kind: 'pole' as const,
      },
    ];
  }, [activeTarget, poles]);

  const challengeProgress = useMemo(() => {
    const lockedCount = challengeTargets.filter((target) => target.locked).length;
    return Math.round((lockedCount / CHALLENGE_COUNT) * 100);
  }, [challengeTargets]);

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

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const next = fromSvgCoords(event.clientX - rect.left, event.clientY - rect.top);

      if (mode === 'challenge') {
        if (!activeTarget) return;
        const nextRe = lockReal ? activeTarget.guess.re : next.re;
        const nextIm = lockImag ? activeTarget.guess.im : next.im;
        setChallengeTargets((prev) =>
          prev.map((target) =>
            target.id === activeTarget.id
              ? {
                  ...target,
                  guess: { re: nextRe, im: Math.abs(nextIm) },
                  locked: false,
                }
              : target
          )
        );
        onStateChange?.({
          progress: challengeProgress,
          data: { action: 'drag', id: dragging.id, kind: dragging.kind, re: nextRe, im: nextIm },
          timestamp: Date.now(),
        });
        return;
      }

      const targetRoot = (dragging.kind === 'pole' ? poles : zeros).find((item) => item.id === dragging.id);
      if (!targetRoot) return;

      const nextRe = lockReal ? targetRoot.re : next.re;
      const nextIm = lockImag ? targetRoot.im : next.im;
      updateRoot(dragging.id, dragging.kind, nextRe, nextIm);
      onStateChange?.({
        progress: progressValue,
        data: { action: 'drag', id: dragging.id, kind: dragging.kind, re: nextRe, im: nextIm },
        timestamp: Date.now(),
      });
    },
    [
      activeTarget,
      challengeProgress,
      dragging,
      progressValue,
      lockImag,
      lockReal,
      mode,
      onStateChange,
      poles,
      updateRoot,
      zeros,
    ]
  );

  const stopDragging = useCallback((dragInfo: { id: string; kind: RootKind } | null) => {
    if (!dragInfo) return;
    if (mode === 'challenge' && activeTarget) {
      interactive?.tracking.emit('param_change', {
        id: dragInfo.id,
        kind: dragInfo.kind,
        re: activeTarget.guess.re,
        im: activeTarget.guess.im,
      });
    } else {
      const targetRoot = (dragInfo.kind === 'pole' ? poles : zeros).find((item) => item.id === dragInfo.id);
      if (targetRoot) {
        interactive?.tracking.emit('param_change', {
          id: dragInfo.id,
          kind: dragInfo.kind,
          re: targetRoot.re,
          im: targetRoot.im,
        });
      }
    }
  }, [activeTarget, interactive?.tracking, mode, poles, zeros]);

  useEffect(() => {
    if (!dragging) return undefined;
    const handleUp = () => {
      stopDragging(dragging);
      setDragging(null);
    };
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [dragging, handlePointerMove, stopDragging]);

  const handlePointerDown = useCallback(
    (id: string, kind: RootKind) => (event: React.PointerEvent) => {
      event.preventDefault();
      setSelectedId(id);
      setDragging({ id, kind });
    },
    []
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
    interactive?.progress.setProgress(0);
    interactive?.tracking.emit('interact', { action: 'reset' });
  }, [interactive]);

  const buildChallengeTargets = useCallback(() => {
    const targets: ChallengeTarget[] = [];
    for (let i = 0; i < CHALLENGE_COUNT; i += 1) {
      const zeta = 0.2 + Math.random() * 0.55;
      const wn = 1.2 + Math.random() * 2.5;
      const sigma = -zeta * wn;
      const beta = wn * Math.sqrt(1 - zeta * zeta);
      const polesForSim: RootPoint[] = [
        { id: `target-${i}`, re: sigma, im: beta, conjugate: true, kind: 'pole' },
      ];
      targets.push({
        id: `challenge-${i}`,
        title: `目标响应 ${i + 1}`,
        poles: { re: sigma, im: beta },
        response: simulateResponse(polesForSim, [], 'step'),
        guess: { re: -1.2, im: 1.2 },
        locked: false,
      });
    }
    setChallengeTargets(targets);
    setActiveTargetId(targets[0]?.id ?? null);
    setChallengeStart(Date.now());
    interactive?.progress.setProgress(0);
  }, [interactive?.progress]);

  useEffect(() => {
    if (mode === 'challenge') {
      buildChallengeTargets();
    }
  }, [buildChallengeTargets, mode]);

  const handleLockTarget = useCallback(() => {
    if (!activeTarget) return;
    const nextLockedCount = challengeTargets.filter((target) => target.locked).length + 1;
    const nextProgress = Math.round((nextLockedCount / CHALLENGE_COUNT) * 100);
    setChallengeTargets((prev) =>
      prev.map((target) =>
        target.id === activeTarget.id ? { ...target, locked: true } : target
      )
    );
    interactive?.progress.setProgress(nextProgress);
    interactive?.tracking.emit('interact', { action: 'lock_target', id: activeTarget.id });
  }, [activeTarget, challengeTargets, interactive]);

  const handleSubmitChallenge = useCallback(() => {
    if (challengeTargets.some((target) => !target.locked)) return;
    const scores = challengeTargets.map((target) =>
      scoreGuess(target.poles, target.guess)
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
        targets: challengeTargets.map((target) => target.poles),
        guesses: challengeTargets.map((target) => target.guess),
      },
    };

    interactive?.tracking.emit('submit', {
      mode: 'challenge',
      scores,
      averageScore,
      duration,
    });
    interactive?.progress.setProgress(100);
    interactive?.progress.markComplete(result);
    onComplete?.(result);

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
          },
        }),
      }).catch((error) => {
        console.error('Failed to sync session state:', error);
      });
    }
  }, [
    bestRecord,
    challengeStart,
    challengeTargets,
    interactive?.config.resourceId,
    interactive?.progress,
    interactive?.tracking,
    onComplete,
    sessionId,
  ]);

  useEffect(() => {
    if (mode !== 'challenge') return;
    interactive?.progress.setProgress(challengeProgress);
  }, [challengeProgress, interactive?.progress, mode]);

  const challengeRenderRoots = useMemo<RenderRoot[]>(() => {
    return challengePoles.flatMap((root) => {
      const basePoint: RenderRoot = { ...root, mirror: false };
      if (root.conjugate && Math.abs(root.im) > 1e-6) {
        return [basePoint, { ...root, im: -root.im, mirror: true }];
      }
      return [basePoint];
    });
  }, [challengePoles]);

  const rootsToRender = mode === 'challenge' ? challengeRenderRoots : renderRoots;

  return (
    <div className="min-h-[720px] w-full bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-400">时域分析 · 极点操纵者</p>
            <h2 className="text-2xl font-semibold text-white">S-Plane 极点操纵与响应感知</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              在复平面拖拽极点与零点，观察阶跃响应如何随衰减与振荡频率变化。
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 p-1 text-xs">
            <button
              onClick={() => setMode('explore')}
              className={`rounded-full px-4 py-2 transition ${
                mode === 'explore' ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-400'
              }`}
            >
              自由探索
            </button>
            <button
              onClick={() => setMode('challenge')}
              className={`rounded-full px-4 py-2 transition ${
                mode === 'challenge' ? 'bg-amber-500/20 text-amber-200' : 'text-slate-400'
              }`}
            >
              挑战模式
            </button>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <Crosshair className="h-4 w-4 text-cyan-400" />
                复平面 · S-Plane
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setLockReal((prev) => !prev)}
                  className={`rounded-full border px-3 py-1 transition ${
                    lockReal ? 'border-cyan-400/70 text-cyan-200' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  锁定实部
                </button>
                <button
                  onClick={() => setLockImag((prev) => !prev)}
                  className={`rounded-full border px-3 py-1 transition ${
                    lockImag ? 'border-amber-400/70 text-amber-200' : 'border-slate-700 text-slate-400'
                  }`}
                >
                  锁定虚部
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${SVG_SIZE.width} ${SVG_SIZE.height}`}
                className="h-[360px] w-full cursor-crosshair"
              >
                <rect width="100%" height="100%" fill="#0b1120" />
                {Array.from({ length: 6 }).map((_, index) => {
                  const x = SVG_SIZE.padding + (index / 5) * (SVG_SIZE.width - SVG_SIZE.padding * 2);
                  return (
                    <line
                      key={`grid-x-${index}`}
                      x1={x}
                      y1={SVG_SIZE.padding}
                      x2={x}
                      y2={SVG_SIZE.height - SVG_SIZE.padding}
                      stroke="#1f2937"
                      strokeDasharray="4 6"
                    />
                  );
                })}
                {Array.from({ length: 6 }).map((_, index) => {
                  const y = SVG_SIZE.padding + (index / 5) * (SVG_SIZE.height - SVG_SIZE.padding * 2);
                  return (
                    <line
                      key={`grid-y-${index}`}
                      x1={SVG_SIZE.padding}
                      y1={y}
                      x2={SVG_SIZE.width - SVG_SIZE.padding}
                      y2={y}
                      stroke="#1f2937"
                      strokeDasharray="4 6"
                    />
                  );
                })}
                <line
                  x1={SVG_SIZE.padding}
                  y1={SVG_SIZE.height / 2}
                  x2={SVG_SIZE.width - SVG_SIZE.padding}
                  y2={SVG_SIZE.height / 2}
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <line
                  x1={SVG_SIZE.padding + ((0 - PLANE_BOUNDS.minRe) / (PLANE_BOUNDS.maxRe - PLANE_BOUNDS.minRe)) *
                    (SVG_SIZE.width - SVG_SIZE.padding * 2)}
                  y1={SVG_SIZE.padding}
                  x2={SVG_SIZE.padding + ((0 - PLANE_BOUNDS.minRe) / (PLANE_BOUNDS.maxRe - PLANE_BOUNDS.minRe)) *
                    (SVG_SIZE.width - SVG_SIZE.padding * 2)}
                  y2={SVG_SIZE.height - SVG_SIZE.padding}
                  stroke="#475569"
                  strokeWidth="1.5"
                />

                {selectedPole && (
                  <>
                    <line
                      x1={toSvgCoords(activeSigma, 0).x}
                      y1={SVG_SIZE.padding}
                      x2={toSvgCoords(activeSigma, 0).x}
                      y2={SVG_SIZE.height - SVG_SIZE.padding}
                      stroke="#22d3ee"
                      strokeDasharray="8 6"
                    />
                    <line
                      x1={SVG_SIZE.padding}
                      y1={toSvgCoords(0, activeBeta).y}
                      x2={SVG_SIZE.width - SVG_SIZE.padding}
                      y2={toSvgCoords(0, activeBeta).y}
                      stroke="#f59e0b"
                      strokeDasharray="8 6"
                    />
                  </>
                )}

                {rootsToRender.map((root) => {
                  const { x, y } = toSvgCoords(root.re, root.im);
                  const isSelected = selectedId === root.id && !root.mirror && mode === 'explore';
                  const color = root.kind === 'pole' ? '#f87171' : '#60a5fa';
                  const label = root.kind === 'pole' ? '×' : '○';
                  return (
                    <g
                      key={`${root.id}-${root.im}-${root.mirror ? 'mirror' : 'base'}`}
                      onPointerDown={handlePointerDown(root.id, root.kind)}
                      style={{ cursor: 'grab' }}
                    >
                      <circle
                        cx={x}
                        cy={y}
                        r={isSelected ? 10 : 8}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isSelected ? 3 : 2}
                      />
                      <text
                        x={x}
                        y={y + 5}
                        fill={color}
                        textAnchor="middle"
                        fontSize="16"
                        fontFamily="monospace"
                      >
                        {label}
                      </text>
                    </g>
                  );
                })}

                <text
                  x={SVG_SIZE.width - 60}
                  y={SVG_SIZE.height / 2 - 6}
                  fill="#64748b"
                  fontSize="12"
                >
                  Re
                </text>
                <text x={SVG_SIZE.padding - 24} y={SVG_SIZE.padding - 10} fill="#64748b" fontSize="12">
                  Im
                </text>
              </svg>
            </div>

            <div className="mt-4 grid gap-3 text-xs text-slate-400 md:grid-cols-3">
              <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2">
                <div className="text-cyan-200">σ 线（等衰减）</div>
                <div>σ = {Math.abs(activeSigma).toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                <div className="text-amber-200">β 线（等振荡）</div>
                <div>β = {Math.abs(activeBeta).toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-900/40 px-3 py-2">
                <div className="text-slate-200">阻尼比提示</div>
                <div>
                  ζ = {selectedPole
                    ? (Math.abs(activeSigma) /
                      Math.sqrt(activeSigma * activeSigma + activeBeta * activeBeta)).toFixed(2)
                    : '--'}
                </div>
              </div>
            </div>

            {mode === 'explore' && (
              <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={() => addRoot('pole', false)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加实极点
                </button>
                <button
                  onClick={() => addRoot('pole', true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加共轭极点
                </button>
                <button
                  onClick={() => addRoot('zero', false)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加实零点
                </button>
                <button
                  onClick={() => addRoot('zero', true)}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-300 hover:border-slate-500"
                >
                  <Plus className="h-3 w-3" />
                  添加共轭零点
                </button>
                <button
                  onClick={removeSelected}
                  disabled={!selectedId}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-400 hover:border-slate-500 disabled:opacity-40"
                >
                  <Minus className="h-3 w-3" />
                  删除选中
                </button>
                <button
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
            </div>

            {mode === 'explore' ? (
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                <svg viewBox="0 0 500 220" className="h-60 w-full">
                  <rect width="500" height="220" rx="16" fill="#0f172a" />
                  <path d={responsePath} stroke="#34d399" strokeWidth="3" fill="none" />
                  <line x1="30" y1="190" x2="470" y2="190" stroke="#1f2937" strokeWidth="2" />
                  <line x1="30" y1="30" x2="30" y2="190" stroke="#1f2937" strokeWidth="2" />
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
              </div>
            ) : (
              <div className="space-y-3">
                {challengeTargets.map((target) => {
                  const active = target.id === activeTargetId;
                  const responsePathLocal = (() => {
                    const { points, minY, maxY, duration } = target.response;
                    const width = 460;
                    const height = 120;
                    const padding = 20;
                    const plotWidth = width - padding * 2;
                    const plotHeight = height - padding * 2;
                    const rangeY = Math.max(1e-6, maxY - minY);
                    return points
                      .map((point, index) => {
                        const x = padding + (point.t / duration) * plotWidth;
                        const y = padding + (1 - (point.y - minY) / rangeY) * plotHeight;
                        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                      })
                      .join(' ');
                  })();

                  return (
                    <button
                      key={target.id}
                      onClick={() => setActiveTargetId(target.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-cyan-400/60 bg-cyan-500/10'
                          : 'border-slate-800 bg-slate-950'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-300">
                        <span>{target.title}</span>
                        {target.locked ? (
                          <span className="inline-flex items-center gap-1 text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> 已标记
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <Circle className="h-3 w-3" /> 待标记
                          </span>
                        )}
                      </div>
                      <svg viewBox="0 0 460 120" className="h-24 w-full">
                        <rect width="460" height="120" rx="12" fill="#0f172a" />
                        <path d={responsePathLocal} stroke="#60a5fa" strokeWidth="2.5" fill="none" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {mode === 'challenge' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Target className="h-4 w-4 text-amber-400" />
                  标记极点挑战
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  根据右侧目标响应，在左侧标出对应的二阶极点位置。
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
                  进度 {challengeProgress}%
                </div>
                {bestRecord && !sessionId && (
                  <div className="rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-amber-200">
                    历史最佳 {bestRecord.score}% · {formatSeconds(bestRecord.duration)}
                  </div>
                )}
                <button
                  onClick={buildChallengeTargets}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-slate-400 hover:border-slate-500"
                >
                  <RefreshCw className="h-3 w-3" />
                  重新生成
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleLockTarget}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-amber-200"
              >
                <Target className="h-3 w-3" />
                标记当前曲线
              </button>
              <button
                onClick={handleSubmitChallenge}
                disabled={challengeTargets.some((target) => !target.locked)}
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
            </div>
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
