'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Complex } from '@/lib/control/linkage-engine';

interface TimeDomainResponse {
  samples: Array<{ time: number; response: number }>;
  metrics: {
    overshoot: number;
    settlingTime: number;
    riseTime: number;
    steadyStateError: number;
  };
}

interface NyquistSample extends Complex {
  frequency: number;
  magnitudeDb: number;
  phaseDeg: number;
}

interface FrequencyDomainResponse {
  samples: Array<{ frequency: number; magnitudeDb: number; phaseDeg: number }>;
  nyquistSamples: NyquistSample[];
  stabilityMargins: {
    gainMargin: { value: number; frequency: number; isInfinite?: boolean };
    phaseMargin: { value: number; frequency: number };
  };
  marginPoints: {
    gainCrossover?: NyquistSample;
    phaseCrossover?: NyquistSample;
  };
}

interface RootLocusPoint extends Complex {
  gain: number;
}

interface StabilityResponse {
  isStable: boolean;
  polesInRHP: number;
  dampingRatios: number[];
  hints: string[];
  closedLoopPoles: Complex[];
  rootLocus: {
    branches: RootLocusPoint[][];
    gainRange: {
      min: number;
      max: number;
      points: number;
    };
    selectedGain: number;
    closedLoopPoles: Complex[];
  };
  stabilityMargins: {
    gainMargin: { value: number; frequency: number; isInfinite?: boolean };
    phaseMargin: { value: number; frequency: number };
  };
}

interface PoleZeroPoint {
  id: string;
  re: number;
  im: number;
  pairKey: string | null;
}

type DraggingState =
  | { type: 'open-loop'; pointType: 'pole' | 'zero'; pointId: string }
  | { type: 'closed-loop' }
  | null;

const VIEW_RANGE = 6;
const CANVAS_SIZE = 360;
const ROOT_LOCUS_VISIBLE_RANGE = VIEW_RANGE * 1.2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function format3(value: number): string {
  if (!Number.isFinite(value)) {
    return '--';
  }
  return value.toFixed(3);
}

function toComplex(point: PoleZeroPoint): Complex {
  return {
    re: round3(point.re),
    im: round3(point.im),
  };
}

function isInVisibleLocusRange(point: Complex): boolean {
  return (
    point.re >= -ROOT_LOCUS_VISIBLE_RANGE
    && point.re <= ROOT_LOCUS_VISIBLE_RANGE
    && point.im >= -ROOT_LOCUS_VISIBLE_RANGE
    && point.im <= ROOT_LOCUS_VISIBLE_RANGE
  );
}

function distance(a: Complex, b: Complex): number {
  return Math.hypot(a.re - b.re, a.im - b.im);
}

function generateLogTicks(min: number, max: number): number[] {
  if (!(min > 0) || !(max > min)) {
    return [];
  }

  const expMin = Math.floor(Math.log10(min));
  const expMax = Math.ceil(Math.log10(max));
  const values: number[] = [];
  const seen = new Set<string>();

  for (let exp = expMin; exp <= expMax; exp += 1) {
    const base = 10 ** exp;
    for (let multiplier = 1; multiplier <= 9; multiplier += 1) {
      const tick = multiplier * base;
      if (tick < min || tick > max) {
        continue;
      }
      const key = tick.toPrecision(12);
      if (!seen.has(key)) {
        values.push(tick);
        seen.add(key);
      }
    }
  }

  return values.sort((lhs, rhs) => lhs - rhs);
}

function findClosestRootLocusSnapshot(branches: RootLocusPoint[][], targetGain: number): Complex[] {
  if (branches.length === 0 || branches[0].length === 0) {
    return [];
  }

  const reference = branches[0];
  let bestIndex = 0;
  let bestDistance = Math.abs((reference[0]?.gain ?? 0) - targetGain);

  for (let i = 1; i < reference.length; i += 1) {
    const d = Math.abs((reference[i]?.gain ?? 0) - targetGain);
    if (d < bestDistance) {
      bestDistance = d;
      bestIndex = i;
    }
  }

  return branches
    .map((branch) => branch[bestIndex])
    .filter((item): item is RootLocusPoint => Boolean(item))
    .map((item) => ({ re: item.re, im: item.im }));
}

function updatePointWithConjugateLink(
  points: PoleZeroPoint[],
  pointId: string,
  next: Complex
): PoleZeroPoint[] {
  const rounded = {
    re: round3(next.re),
    im: round3(next.im),
  };

  const target = points.find((item) => item.id === pointId);
  if (!target) {
    return points;
  }

  const updated = points.map((item) => {
    if (item.id === pointId) {
      return {
        ...item,
        re: rounded.re,
        im: rounded.im,
      };
    }

    if (target.pairKey && item.pairKey === target.pairKey) {
      return {
        ...item,
        re: rounded.re,
        im: round3(-rounded.im),
      };
    }

    return item;
  });

  return updated;
}

function removePointWithPair(points: PoleZeroPoint[], pointId: string): PoleZeroPoint[] {
  const target = points.find((item) => item.id === pointId);
  if (!target) {
    return points;
  }

  if (!target.pairKey) {
    return points.filter((item) => item.id !== pointId);
  }

  return points.filter((item) => item.pairKey !== target.pairKey);
}

export default function MultiRepresentationLinkagePage() {
  const [modelPoles, setModelPoles] = useState<PoleZeroPoint[]>([
    { id: 'p1', re: -1.2, im: 1.3, pairKey: 'pair-p1' },
    { id: 'p2', re: -1.2, im: -1.3, pairKey: 'pair-p1' },
  ]);
  const [draftPoles, setDraftPoles] = useState<PoleZeroPoint[]>([
    { id: 'p1', re: -1.2, im: 1.3, pairKey: 'pair-p1' },
    { id: 'p2', re: -1.2, im: -1.3, pairKey: 'pair-p1' },
  ]);
  const [modelZeros, setModelZeros] = useState<PoleZeroPoint[]>([]);
  const [draftZeros, setDraftZeros] = useState<PoleZeroPoint[]>([]);

  const [gain, setGain] = useState(1);
  const [previewGain, setPreviewGain] = useState<number | null>(null);
  const [responseType, setResponseType] = useState<'step' | 'impulse' | 'ramp'>('step');
  const [showMargins, setShowMargins] = useState(true);
  const [dragging, setDragging] = useState<DraggingState>(null);

  const [timeDomain, setTimeDomain] = useState<TimeDomainResponse | null>(null);
  const [frequencyDomain, setFrequencyDomain] = useState<FrequencyDomainResponse | null>(null);
  const [stability, setStability] = useState<StabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idRef = useRef(100);
  const pairRef = useRef(100);

  const scale = CANVAS_SIZE / (VIEW_RANGE * 2);

  const transformToCanvas = useCallback(
    (point: Complex) => ({
      x: CANVAS_SIZE / 2 + point.re * scale,
      y: CANVAS_SIZE / 2 - point.im * scale,
    }),
    [scale]
  );

  const transformToComplex = useCallback(
    (x: number, y: number): Complex => ({
      re: clamp((x - CANVAS_SIZE / 2) / scale, -VIEW_RANGE, VIEW_RANGE),
      im: clamp((CANVAS_SIZE / 2 - y) / scale, -VIEW_RANGE, VIEW_RANGE),
    }),
    [scale]
  );

  const displayPoles = dragging?.type === 'open-loop' ? draftPoles : modelPoles;
  const displayZeros = dragging?.type === 'open-loop' ? draftZeros : modelZeros;

  const polesPayload = useMemo(() => modelPoles.map(toComplex), [modelPoles]);
  const zerosPayload = useMemo(() => modelZeros.map(toComplex), [modelZeros]);

  const addRealPoint = useCallback((type: 'pole' | 'zero') => {
    const id = `${type}-${idRef.current++}`;
    const item: PoleZeroPoint = { id, re: -2.2, im: 0, pairKey: null };

    if (type === 'pole') {
      setModelPoles((previous) => [...previous, item]);
      setDraftPoles((previous) => [...previous, item]);
    } else {
      setModelZeros((previous) => [...previous, item]);
      setDraftZeros((previous) => [...previous, item]);
    }
  }, []);

  const addConjugatePair = useCallback((type: 'pole' | 'zero') => {
    const pairKey = `${type}-pair-${pairRef.current++}`;
    const idA = `${type}-${idRef.current++}`;
    const idB = `${type}-${idRef.current++}`;

    const pair: PoleZeroPoint[] = [
      { id: idA, re: -2.2, im: 1, pairKey },
      { id: idB, re: -2.2, im: -1, pairKey },
    ];

    if (type === 'pole') {
      setModelPoles((previous) => [...previous, ...pair]);
      setDraftPoles((previous) => [...previous, ...pair]);
    } else {
      setModelZeros((previous) => [...previous, ...pair]);
      setDraftZeros((previous) => [...previous, ...pair]);
    }
  }, []);

  const removePole = useCallback((pointId: string) => {
    setModelPoles((previous) => {
      const next = removePointWithPair(previous, pointId);
      if (next.length === 0) {
        return previous;
      }
      setDraftPoles(next);
      return next;
    });
  }, []);

  const removeZero = useCallback((pointId: string) => {
    setModelZeros((previous) => {
      const next = removePointWithPair(previous, pointId);
      setDraftZeros(next);
      return next;
    });
  }, []);

  const updateModelPole = useCallback((pointId: string, next: Complex) => {
    setModelPoles((previous) => updatePointWithConjugateLink(previous, pointId, next));
    setDraftPoles((previous) => updatePointWithConjugateLink(previous, pointId, next));
  }, []);

  const updateDraftPole = useCallback((pointId: string, next: Complex) => {
    setDraftPoles((previous) => updatePointWithConjugateLink(previous, pointId, next));
  }, []);

  const updateModelZero = useCallback((pointId: string, next: Complex) => {
    setModelZeros((previous) => updatePointWithConjugateLink(previous, pointId, next));
    setDraftZeros((previous) => updatePointWithConjugateLink(previous, pointId, next));
  }, []);

  const updateDraftZero = useCallback((pointId: string, next: Complex) => {
    setDraftZeros((previous) => updatePointWithConjugateLink(previous, pointId, next));
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [timeResp, freqResp, stabilityResp] = await Promise.all([
        fetch('/api/linkage/calculate-time-domain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poles: polesPayload,
            zeros: zerosPayload,
            gain,
            timeRange: { start: 0, end: 20, step: 0.05 },
            responseType,
          }),
        }),
        fetch('/api/linkage/calculate-frequency-domain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poles: polesPayload,
            zeros: zerosPayload,
            gain,
            frequencyRange: { min: 0.1, max: 100, points: 140 },
          }),
        }),
        fetch('/api/linkage/stability-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transferFunction: {
              poles: polesPayload,
              zeros: zerosPayload,
              gain,
            },
          }),
        }),
      ]);

      if (!timeResp.ok || !freqResp.ok || !stabilityResp.ok) {
        throw new Error('计算接口返回异常');
      }

      const timeData = (await timeResp.json()) as TimeDomainResponse;
      const freqData = (await freqResp.json()) as FrequencyDomainResponse;
      const stabilityData = (await stabilityResp.json()) as StabilityResponse;

      setTimeDomain(timeData);
      setFrequencyDomain(freqData);
      setStability(stabilityData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [gain, polesPayload, responseType, zerosPayload]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAll();
    }, 120);
    return () => window.clearTimeout(timer);
  }, [fetchAll]);

  const hints = useMemo(() => {
    if (stability?.hints?.length) {
      return stability.hints;
    }
    return ['开环极点/零点定义了根轨迹形态；闭环极点位置决定时域指标，频域裕度同步变化。'];
  }, [stability]);

  const rootLocusBranches = useMemo(() => stability?.rootLocus.branches ?? [], [stability?.rootLocus.branches]);
  const rootLocusPoints = useMemo(() => rootLocusBranches.flatMap((branch) => branch), [rootLocusBranches]);

  const activeClosedLoopPoles = useMemo(() => {
    if (dragging?.type === 'closed-loop' && previewGain !== null) {
      return findClosestRootLocusSnapshot(rootLocusBranches, previewGain);
    }
    return stability?.closedLoopPoles ?? [];
  }, [dragging?.type, previewGain, rootLocusBranches, stability?.closedLoopPoles]);

  const rootLocusPathSegments = useMemo(() => {
    const segments: string[] = [];

    for (const branch of rootLocusBranches) {
      let currentPath = '';
      let previousVisible: Complex | null = null;

      for (const point of branch) {
        if (!isInVisibleLocusRange(point)) {
          if (currentPath) {
            segments.push(currentPath);
            currentPath = '';
          }
          previousVisible = null;
          continue;
        }

        const canvasPoint = transformToCanvas(point);
        const shouldRestart = !previousVisible || distance(previousVisible, point) > 1.6;

        if (shouldRestart) {
          if (currentPath) {
            segments.push(currentPath);
          }
          currentPath = `M${canvasPoint.x},${canvasPoint.y}`;
        } else {
          currentPath += ` L${canvasPoint.x},${canvasPoint.y}`;
        }

        previousVisible = point;
      }

      if (currentPath) {
        segments.push(currentPath);
      }
    }

    return segments;
  }, [rootLocusBranches, transformToCanvas]);

  const frequencyDomainData = useMemo(() => frequencyDomain?.samples ?? [], [frequencyDomain?.samples]);

  const frequencyBounds = useMemo(() => {
    if (frequencyDomainData.length === 0) {
      return { min: 0.1, max: 100 };
    }

    const min = Math.max(0.001, Math.min(...frequencyDomainData.map((item) => item.frequency)));
    const max = Math.max(min * 1.01, Math.max(...frequencyDomainData.map((item) => item.frequency)));
    return { min, max };
  }, [frequencyDomainData]);

  const frequencyTicks = useMemo(
    () => generateLogTicks(frequencyBounds.min, frequencyBounds.max),
    [frequencyBounds.max, frequencyBounds.min]
  );

  const nyquistData = useMemo(
    () => (frequencyDomain?.nyquistSamples ?? []).map((item) => ({ ...item, imMirror: -item.im })),
    [frequencyDomain?.nyquistSamples]
  );

  const nyquistBounds = useMemo(() => {
    const values = [
      ...nyquistData.flatMap((item) => [item.re, item.im, item.imMirror]),
      -1,
      0,
    ];

    if (values.length === 0) {
      return { min: -3, max: 3 };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(max - min, 1);
    const margin = span * 0.15;

    return {
      min: min - margin,
      max: max + margin,
    };
  }, [nyquistData]);

  const phaseMarginFrequency = stability?.stabilityMargins.phaseMargin.frequency ?? 0;
  const phaseMarginValue = stability?.stabilityMargins.phaseMargin.value ?? 0;
  const gainMarginFrequency = stability?.stabilityMargins.gainMargin.frequency ?? 0;
  const gainMarginValue = stability?.stabilityMargins.gainMargin.value ?? 0;
  const gainMarginInfinite = stability?.stabilityMargins.gainMargin.isInfinite ?? true;

  const gainDisplayValue = dragging?.type === 'closed-loop' && previewGain !== null ? previewGain : gain;

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!dragging) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const targetPoint = transformToComplex(x, y);

    if (dragging.type === 'open-loop') {
      if (dragging.pointType === 'pole') {
        updateDraftPole(dragging.pointId, targetPoint);
      } else {
        updateDraftZero(dragging.pointId, targetPoint);
      }
      return;
    }

    if (rootLocusPoints.length === 0) {
      return;
    }

    let nearest = rootLocusPoints[0];
    let nearestDistance = distance(nearest, targetPoint);

    for (let i = 1; i < rootLocusPoints.length; i += 1) {
      const d = distance(rootLocusPoints[i], targetPoint);
      if (d < nearestDistance) {
        nearest = rootLocusPoints[i];
        nearestDistance = d;
      }
    }

    setPreviewGain(round3(Math.max(0, nearest.gain)));
  };

  const finalizeDrag = () => {
    if (!dragging) {
      return;
    }

    if (dragging.type === 'open-loop') {
      if (dragging.pointType === 'pole') {
        setModelPoles(draftPoles.map((item) => ({ ...item, re: round3(item.re), im: round3(item.im) })));
      } else {
        setModelZeros(draftZeros.map((item) => ({ ...item, re: round3(item.re), im: round3(item.im) })));
      }
    }

    if (dragging.type === 'closed-loop' && previewGain !== null) {
      setGain(round3(Math.max(0, previewGain)));
    }

    setDragging(null);
    setPreviewGain(null);
  };

  const renderNyquistTooltip = (props: any) => {
    const active = props?.active as boolean | undefined;
    const payload = props?.payload as ReadonlyArray<{ payload?: NyquistSample & { imMirror: number } }> | undefined;
    if (!active || !payload || payload.length === 0) {
      return null;
    }

    const point = payload[0]?.payload;
    if (!point) {
      return null;
    }

    return (
      <div className="rounded border border-slate-700 bg-slate-950/90 px-2 py-1 text-xs text-slate-200">
        <div>Re: {format3(point.re)}</div>
        <div>Im+: {format3(point.im)}</div>
        <div>Im-: {format3(point.imMirror)}</div>
        <div>|G|: {format3(point.magnitudeDb)} dB</div>
        <div>∠G: {format3(point.phaseDeg)}°</div>
        <div>ω: {format3(point.frequency)} rad/s</div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-xs uppercase tracking-[0.28em] text-cyan-400">Structure Visible</p>
          <h1 className="mt-1 text-2xl font-semibold">多表征联动可视化引擎</h1>
          <p className="mt-2 text-sm text-slate-400">
            开环极点/零点定义根轨迹，闭环极点位置决定时域响应。拖拽过程只做本地预览，松开后统一刷新计算结果。
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-[430px_1fr]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="text-lg font-medium">开环配置 + 根轨迹</h2>

            <svg
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              className="rounded-lg border border-slate-700 bg-slate-950"
              onPointerMove={handlePointerMove}
              onPointerUp={finalizeDrag}
              onPointerLeave={finalizeDrag}
            >
              <line x1={CANVAS_SIZE / 2} y1={0} x2={CANVAS_SIZE / 2} y2={CANVAS_SIZE} stroke="#334155" />
              <line x1={0} y1={CANVAS_SIZE / 2} x2={CANVAS_SIZE} y2={CANVAS_SIZE / 2} stroke="#334155" />

              {[-5, -4, -3, -2, -1, 1, 2, 3, 4, 5].map((tick) => (
                <g key={tick}>
                  <line
                    x1={CANVAS_SIZE / 2 + tick * scale}
                    y1={0}
                    x2={CANVAS_SIZE / 2 + tick * scale}
                    y2={CANVAS_SIZE}
                    stroke="#1e293b"
                  />
                  <line
                    x1={0}
                    y1={CANVAS_SIZE / 2 - tick * scale}
                    x2={CANVAS_SIZE}
                    y2={CANVAS_SIZE / 2 - tick * scale}
                    stroke="#1e293b"
                  />
                </g>
              ))}

              {rootLocusPathSegments.map((path, index) => (
                <path key={`root-locus-${index}`} d={path} fill="none" stroke="#64748b" strokeWidth={1.5} />
              ))}

              {displayPoles.map((pole, index) => {
                const point = transformToCanvas(pole);
                return (
                  <g key={pole.id}>
                    <line
                      x1={point.x - 7}
                      y1={point.y - 7}
                      x2={point.x + 7}
                      y2={point.y + 7}
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      style={{ cursor: 'grab' }}
                      onPointerDown={() => setDragging({ type: 'open-loop', pointType: 'pole', pointId: pole.id })}
                    />
                    <line
                      x1={point.x + 7}
                      y1={point.y - 7}
                      x2={point.x - 7}
                      y2={point.y + 7}
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      style={{ cursor: 'grab' }}
                      onPointerDown={() => setDragging({ type: 'open-loop', pointType: 'pole', pointId: pole.id })}
                    />
                    <text x={point.x + 8} y={point.y - 8} fontSize={11} fill="#67e8f9">
                      p{index + 1}
                    </text>
                    <title>{`p${index + 1} (${format3(pole.re)}, ${format3(pole.im)})`}</title>
                  </g>
                );
              })}

              {displayZeros.map((zero, index) => {
                const point = transformToCanvas(zero);
                return (
                  <g key={zero.id}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={6.5}
                      fill="none"
                      stroke="#fda4af"
                      strokeWidth={2.2}
                      style={{ cursor: 'grab' }}
                      onPointerDown={() => setDragging({ type: 'open-loop', pointType: 'zero', pointId: zero.id })}
                    />
                    <text x={point.x + 8} y={point.y - 8} fontSize={11} fill="#fecdd3">
                      z{index + 1}
                    </text>
                    <title>{`z${index + 1} (${format3(zero.re)}, ${format3(zero.im)})`}</title>
                  </g>
                );
              })}

              {activeClosedLoopPoles.map((pole, index) => {
                const point = transformToCanvas(pole);
                return (
                  <g key={`closed-pole-${index}`}>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={6}
                      fill="#fb923c"
                      stroke="#7c2d12"
                      strokeWidth={2}
                      style={{ cursor: rootLocusPoints.length > 0 ? 'grab' : 'default' }}
                      onPointerDown={() => setDragging({ type: 'closed-loop' })}
                    />
                    <text x={point.x + 8} y={point.y + 4} fontSize={11} fill="#fdba74">
                      c{index + 1}
                    </text>
                  </g>
                );
              })}
            </svg>

            <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-2 text-xs text-slate-300">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-cyan-300" /> 开环极点
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-rose-300" /> 开环零点
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full bg-orange-300" /> 闭环极点（根轨迹可拖拽）
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => addRealPoint('pole')}
                className="rounded bg-cyan-700 px-3 py-2 text-sm font-medium hover:bg-cyan-600"
              >
                添加实极点
              </button>
              <button
                type="button"
                onClick={() => addConjugatePair('pole')}
                className="rounded bg-cyan-600 px-3 py-2 text-sm font-medium hover:bg-cyan-500"
              >
                添加共轭极点对
              </button>
              <button
                type="button"
                onClick={() => addRealPoint('zero')}
                className="rounded bg-rose-700 px-3 py-2 text-sm font-medium hover:bg-rose-600"
              >
                添加实零点
              </button>
              <button
                type="button"
                onClick={() => addConjugatePair('zero')}
                className="rounded bg-rose-600 px-3 py-2 text-sm font-medium hover:bg-rose-500"
              >
                添加共轭零点对
              </button>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/50 p-2">
              <div className="text-xs font-medium text-cyan-300">开环极点</div>
              {modelPoles.map((pole, index) => (
                <div key={pole.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <label className="text-xs text-slate-400">
                    p{index + 1}.Re
                    <input
                      type="number"
                      step="0.001"
                      value={pole.re.toFixed(3)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateModelPole(pole.id, { re: value, im: pole.im });
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    p{index + 1}.Im
                    <input
                      type="number"
                      step="0.001"
                      value={pole.im.toFixed(3)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateModelPole(pole.id, { re: pole.re, im: value });
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    />
                  </label>
                  <div className="flex flex-col items-end justify-end gap-1 pb-1">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                      {pole.pairKey ? '共轭' : '实数'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removePole(pole.id)}
                      className="rounded bg-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950/50 p-2">
              <div className="text-xs font-medium text-rose-300">开环零点</div>
              {modelZeros.length === 0 ? <div className="text-xs text-slate-500">当前无开环零点</div> : null}
              {modelZeros.map((zero, index) => (
                <div key={zero.id} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <label className="text-xs text-slate-400">
                    z{index + 1}.Re
                    <input
                      type="number"
                      step="0.001"
                      value={zero.re.toFixed(3)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateModelZero(zero.id, { re: value, im: zero.im });
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-400">
                    z{index + 1}.Im
                    <input
                      type="number"
                      step="0.001"
                      value={zero.im.toFixed(3)}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          updateModelZero(zero.id, { re: zero.re, im: value });
                        }
                      }}
                      className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                    />
                  </label>
                  <div className="flex flex-col items-end justify-end gap-1 pb-1">
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] text-slate-300">
                      {zero.pairKey ? '共轭' : '实数'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeZero(zero.id)}
                      className="rounded bg-slate-700 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-slate-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                增益 K（闭环极点联动）
                <input
                  type="number"
                  step="0.001"
                  min={0}
                  value={gainDisplayValue.toFixed(3)}
                  onChange={(event) => {
                    const nextGain = Number(event.target.value);
                    if (Number.isFinite(nextGain)) {
                      setGain(round3(Math.max(0, nextGain)));
                    }
                  }}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                />
              </label>
              <label className="text-xs text-slate-400">
                响应类型
                <select
                  value={responseType}
                  onChange={(event) => setResponseType(event.target.value as 'step' | 'impulse' | 'ramp')}
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm"
                >
                  <option value="step">Step</option>
                  <option value="impulse">Impulse</option>
                  <option value="ramp">Ramp</option>
                </select>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const resetPoles: PoleZeroPoint[] = [
                    { id: 'p1', re: -1.2, im: 1.3, pairKey: 'pair-p1' },
                    { id: 'p2', re: -1.2, im: -1.3, pairKey: 'pair-p1' },
                  ];
                  setModelPoles(resetPoles);
                  setDraftPoles(resetPoles);
                  setModelZeros([]);
                  setDraftZeros([]);
                  setGain(1);
                  setPreviewGain(null);
                  setDragging(null);
                }}
                className="flex-1 rounded bg-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-600"
              >
                恢复默认
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-slate-400">超调量</div>
                <div className="mt-1 text-xl font-semibold text-cyan-300">
                  {timeDomain ? `${format3(timeDomain.metrics.overshoot)}%` : '--'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-slate-400">调节时间</div>
                <div className="mt-1 text-xl font-semibold text-cyan-300">
                  {timeDomain ? `${format3(timeDomain.metrics.settlingTime)} s` : '--'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-slate-400">相位裕度</div>
                <div className="mt-1 text-xl font-semibold text-emerald-300">
                  {stability ? `${format3(stability.stabilityMargins.phaseMargin.value)}°` : '--'}
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-xs text-slate-400">稳定性（闭环）</div>
                <div className={`mt-1 text-xl font-semibold ${stability?.isStable ? 'text-emerald-300' : 'text-rose-300'}`}>
                  {stability ? (stability.isStable ? '稳定' : '不稳定') : '--'}
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-2 text-base font-medium">时域响应（按闭环极点）</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timeDomain?.samples ?? []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="time" stroke="#94a3b8" />
                      <YAxis stroke="#94a3b8" />
                      <Tooltip
                        labelFormatter={(value) => `t=${format3(Number(value))} s`}
                        formatter={(value, name) => [format3(Number(value)), String(name)]}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="response" stroke="#22d3ee" dot={false} name="y(t)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-base font-medium">频域 Bode（幅频 + 相频）</h3>
                  <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={showMargins}
                      onChange={(event) => setShowMargins(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-500 bg-slate-900"
                    />
                    显示裕度标注
                  </label>
                </div>

                <div className="h-[17rem]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={frequencyDomainData} margin={{ top: 10, right: 12, left: 8, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        type="number"
                        dataKey="frequency"
                        scale="log"
                        domain={[frequencyBounds.min, frequencyBounds.max]}
                        ticks={frequencyTicks}
                        tick={false}
                        stroke="#94a3b8"
                      />
                      <YAxis yAxisId="magnitude" stroke="#94a3b8" width={56} />
                      <Tooltip
                        labelFormatter={(value) => `ω=${format3(Number(value))} rad/s`}
                        formatter={(value, name) => [format3(Number(value)), String(name)]}
                      />
                      <Line yAxisId="magnitude" type="monotone" dataKey="magnitudeDb" stroke="#f59e0b" dot={false} name="|G(jω)| dB" />

                      {showMargins && phaseMarginFrequency > 0 ? (
                        <ReferenceLine
                          x={phaseMarginFrequency}
                          stroke="#22d3ee"
                          strokeDasharray="6 3"
                          yAxisId="magnitude"
                          label={{ value: `PM ${format3(phaseMarginValue)}°`, fill: '#67e8f9', position: 'insideTopRight' }}
                        />
                      ) : null}

                      {showMargins && !gainMarginInfinite && gainMarginFrequency > 0 ? (
                        <ReferenceLine
                          x={gainMarginFrequency}
                          stroke="#f472b6"
                          strokeDasharray="6 3"
                          yAxisId="magnitude"
                          label={{ value: `GM ${format3(gainMarginValue)} dB`, fill: '#f9a8d4', position: 'insideBottomRight' }}
                        />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="h-[17rem] border-t border-slate-800 pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={frequencyDomainData} margin={{ top: 8, right: 12, left: 8, bottom: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        type="number"
                        dataKey="frequency"
                        scale="log"
                        domain={[frequencyBounds.min, frequencyBounds.max]}
                        ticks={frequencyTicks}
                        tickFormatter={(value) => format3(Number(value))}
                        stroke="#94a3b8"
                      />
                      <YAxis yAxisId="phase" stroke="#94a3b8" width={56} />
                      <Tooltip
                        labelFormatter={(value) => `ω=${format3(Number(value))} rad/s`}
                        formatter={(value, name) => [format3(Number(value)), String(name)]}
                      />
                      <Line yAxisId="phase" type="monotone" dataKey="phaseDeg" stroke="#34d399" dot={false} name="∠G(jω)°" />

                      {showMargins && phaseMarginFrequency > 0 ? (
                        <ReferenceLine x={phaseMarginFrequency} stroke="#22d3ee" strokeDasharray="6 3" yAxisId="phase" />
                      ) : null}

                      {showMargins && !gainMarginInfinite && gainMarginFrequency > 0 ? (
                        <ReferenceLine x={gainMarginFrequency} stroke="#f472b6" strokeDasharray="6 3" yAxisId="phase" />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-2 text-base font-medium">Nyquist 图</h3>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={nyquistData} margin={{ top: 10, right: 12, left: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        type="number"
                        dataKey="re"
                        domain={[nyquistBounds.min, nyquistBounds.max]}
                        tickFormatter={(value) => format3(Number(value))}
                        stroke="#94a3b8"
                      />
                      <YAxis
                        type="number"
                        dataKey="im"
                        domain={[nyquistBounds.min, nyquistBounds.max]}
                        tickFormatter={(value) => format3(Number(value))}
                        stroke="#94a3b8"
                      />
                      <Tooltip content={renderNyquistTooltip} />
                      <Legend />
                      <Line type="linear" dataKey="im" stroke="#60a5fa" dot={false} name="上半 Nyquist" />
                      <Line type="linear" dataKey="imMirror" stroke="#60a5fa" dot={false} name="下半 Nyquist" />

                      <ReferenceDot
                        x={-1}
                        y={0}
                        r={5}
                        fill="#ef4444"
                        stroke="#7f1d1d"
                        ifOverflow="visible"
                        label={{ value: '-1+j0', fill: '#fca5a5', position: 'top' }}
                      />

                      {showMargins && frequencyDomain?.marginPoints.gainCrossover ? (
                        <ReferenceDot
                          x={frequencyDomain.marginPoints.gainCrossover.re}
                          y={frequencyDomain.marginPoints.gainCrossover.im}
                          r={5}
                          fill="#22d3ee"
                          stroke="#155e75"
                          ifOverflow="visible"
                          label={{ value: `PM ${format3(phaseMarginValue)}°`, fill: '#67e8f9', position: 'right' }}
                        />
                      ) : null}

                      {showMargins && frequencyDomain?.marginPoints.phaseCrossover && !gainMarginInfinite ? (
                        <ReferenceDot
                          x={frequencyDomain.marginPoints.phaseCrossover.re}
                          y={frequencyDomain.marginPoints.phaseCrossover.im}
                          r={5}
                          fill="#f472b6"
                          stroke="#9d174d"
                          ifOverflow="visible"
                          label={{ value: `GM ${format3(gainMarginValue)} dB`, fill: '#f9a8d4', position: 'left' }}
                        />
                      ) : null}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <h3 className="mb-2 text-base font-medium">跨域关联提示</h3>
                <ul className="space-y-2 text-sm text-slate-300">
                  {hints.map((hint) => (
                    <li key={hint} className="rounded bg-slate-900 px-2 py-1">
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-slate-900/50 px-4 py-3 text-sm text-slate-400">
              {loading
                ? '正在计算联动结果（拖拽过程中暂停刷新，松开后自动更新）...'
                : error
                  ? `计算失败：${error}`
                  : '联动已更新：单条根轨迹分支对应单个开环极点，Nyquist 采用自适应采样与上下半分离绘制。'}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
