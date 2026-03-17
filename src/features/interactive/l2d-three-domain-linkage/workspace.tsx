'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  analyzeStability,
  calculateFrequencyDomainResponse,
  calculateRootLocus,
  calculateTimeDomainResponse,
  type Complex,
} from '@/lib/control/linkage-engine';
import { L2D_SYSTEM_SPEC } from '@/lib/l2d-course';

const ROOT_SVG = { width: 420, height: 300, xMin: -8, xMax: 2, yMin: -8, yMax: 8 };
const PLOT_SVG = { width: 360, height: 160 };

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toRootX(value: number) {
  return ((value - ROOT_SVG.xMin) / (ROOT_SVG.xMax - ROOT_SVG.xMin)) * ROOT_SVG.width;
}

function toRootY(value: number) {
  return ROOT_SVG.height - ((value - ROOT_SVG.yMin) / (ROOT_SVG.yMax - ROOT_SVG.yMin)) * ROOT_SVG.height;
}

function toComplexFromPointer(x: number, y: number): Complex {
  return {
    re: ROOT_SVG.xMin + (x / ROOT_SVG.width) * (ROOT_SVG.xMax - ROOT_SVG.xMin),
    im: ROOT_SVG.yMin + ((ROOT_SVG.height - y) / ROOT_SVG.height) * (ROOT_SVG.yMax - ROOT_SVG.yMin),
  };
}

function buildPath(points: Array<{ x: number; y: number }>) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function toPolyline(values: Array<{ x: number; y: number }>) {
  return values.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
}

function formatNumber(value: number, digits = 2) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return value.toFixed(digits);
}

function getDominantPole(poles: Complex[]) {
  const positiveImag = poles.filter((pole) => pole.im >= 0);
  const pool = positiveImag.length ? positiveImag : poles;
  return [...pool].sort((left, right) => right.re - left.re)[0] ?? { re: 0, im: 0 };
}

function normalizeMp(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function normalizeGamma(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export type WorkspaceMetrics = {
  gain: number;
  sigma: number;
  omega: number;
  mp: number;
  ts: number;
  gamma: number;
  isStable: boolean;
};

export type WorkspaceParameterChange = {
  gain: number;
  source: 'slider' | 'root-locus';
};

export function L2DThreeDomainWorkspace({
  gain,
  onGainChange,
  readOnly = false,
  accentLabel,
  onMetricsChange,
  onParameterChange,
}: {
  gain: number;
  onGainChange: (gain: number) => void;
  readOnly?: boolean;
  accentLabel?: string;
  onMetricsChange?: (metrics: WorkspaceMetrics) => void;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [dragging, setDragging] = useState(false);

  const rootLocus = useMemo(
    () =>
      calculateRootLocus(
        {
          poles: L2D_SYSTEM_SPEC.poles,
          zeros: L2D_SYSTEM_SPEC.zeros,
          gain,
        },
        { gainRange: { min: L2D_SYSTEM_SPEC.kRange.min, max: L2D_SYSTEM_SPEC.kRange.max, points: L2D_SYSTEM_SPEC.rootLocusPoints } },
      ),
    [gain],
  );

  const timeDomain = useMemo(
    () =>
      calculateTimeDomainResponse({
        poles: L2D_SYSTEM_SPEC.poles,
        zeros: L2D_SYSTEM_SPEC.zeros,
        gain,
        timeRange: L2D_SYSTEM_SPEC.timeRange,
        responseType: 'step',
      }),
    [gain],
  );

  const frequencyDomain = useMemo(
    () =>
      calculateFrequencyDomainResponse({
        poles: L2D_SYSTEM_SPEC.poles,
        zeros: L2D_SYSTEM_SPEC.zeros,
        gain,
        frequencyRange: L2D_SYSTEM_SPEC.frequencyRange,
      }),
    [gain],
  );

  const stability = useMemo(
    () =>
      analyzeStability({
        poles: L2D_SYSTEM_SPEC.poles,
        zeros: L2D_SYSTEM_SPEC.zeros,
        gain,
      }),
    [gain],
  );

  const activePole = useMemo(() => getDominantPole(rootLocus.closedLoopPoles), [rootLocus.closedLoopPoles]);

  const metrics = useMemo<WorkspaceMetrics>(
    () => ({
      gain,
      sigma: activePole.re,
      omega: Math.abs(activePole.im),
      mp: normalizeMp(timeDomain.metrics.overshoot),
      ts: timeDomain.metrics.settlingTime,
      gamma: normalizeGamma(frequencyDomain.stabilityMargins.phaseMargin.value),
      isStable: stability.isStable,
    }),
    [activePole.im, activePole.re, frequencyDomain.stabilityMargins.phaseMargin.value, gain, stability.isStable, timeDomain.metrics.overshoot, timeDomain.metrics.settlingTime],
  );

  useEffect(() => {
    onMetricsChange?.(metrics);
  }, [metrics, onMetricsChange]);

  const rootPaths = useMemo(() => {
    return rootLocus.branches.map((branch, branchIndex) => {
      const visible = branch
        .filter((point) => point.re >= ROOT_SVG.xMin && point.re <= ROOT_SVG.xMax && point.im >= ROOT_SVG.yMin && point.im <= ROOT_SVG.yMax)
        .map((point) => ({ x: toRootX(point.re), y: toRootY(point.im) }));
      return {
        id: `branch-${branchIndex}`,
        d: buildPath(visible),
      };
    });
  }, [rootLocus.branches]);

  const activeClosedLoopPoles = useMemo(
    () =>
      rootLocus.closedLoopPoles.map((pole, index) => ({
        id: `active-${index}`,
        x: toRootX(pole.re),
        y: toRootY(pole.im),
      })),
    [rootLocus.closedLoopPoles],
  );

  const timePath = useMemo(() => {
    const maxTime = timeDomain.samples[timeDomain.samples.length - 1]?.time ?? 1;
    const maxResponse = Math.max(1.4, ...timeDomain.samples.map((sample) => sample.response));
    const points = timeDomain.samples.map((sample) => ({
      x: (sample.time / maxTime) * PLOT_SVG.width,
      y: PLOT_SVG.height - (sample.response / maxResponse) * (PLOT_SVG.height - 24) - 12,
    }));
    return {
      d: buildPath(points),
      maxTime,
      maxResponse,
    };
  }, [timeDomain.samples]);

  const bodeCurves = useMemo(() => {
    const samples = frequencyDomain.samples;
    const minLog = Math.log10(samples[0]?.frequency ?? 0.1);
    const maxLog = Math.log10(samples[samples.length - 1]?.frequency ?? 120);
    const magValues = samples.map((sample) => sample.magnitudeDb);
    const magMin = Math.min(-30, ...magValues);
    const magMax = Math.max(30, ...magValues);
    const phaseValues = samples.map((sample) => sample.phaseDeg);
    const phaseMin = Math.min(-220, ...phaseValues);
    const phaseMax = Math.max(0, ...phaseValues);

    const mapX = (frequency: number) => ((Math.log10(frequency) - minLog) / Math.max(maxLog - minLog, 1e-6)) * PLOT_SVG.width;
    const mapMagY = (value: number) => PLOT_SVG.height - ((value - magMin) / Math.max(magMax - magMin, 1e-6)) * (PLOT_SVG.height - 24) - 12;
    const mapPhaseY = (value: number) => PLOT_SVG.height - ((value - phaseMin) / Math.max(phaseMax - phaseMin, 1e-6)) * (PLOT_SVG.height - 24) - 12;

    return {
      magnitude: buildPath(samples.map((sample) => ({ x: mapX(sample.frequency), y: mapMagY(sample.magnitudeDb) }))),
      phase: buildPath(samples.map((sample) => ({ x: mapX(sample.frequency), y: mapPhaseY(sample.phaseDeg) }))),
      phaseMarginX: mapX(Math.max(frequencyDomain.stabilityMargins.phaseMargin.frequency, samples[0]?.frequency ?? 0.1)),
    };
  }, [frequencyDomain.samples, frequencyDomain.stabilityMargins.phaseMargin.frequency]);

  const nearestGainFromPointer = (clientX: number, clientY: number, element: SVGSVGElement | null) => {
    if (!element) {
      return gain;
    }
    const rect = element.getBoundingClientRect();
    const point = toComplexFromPointer(
      clamp(((clientX - rect.left) / Math.max(rect.width, 1)) * ROOT_SVG.width, 0, ROOT_SVG.width),
      clamp(((clientY - rect.top) / Math.max(rect.height, 1)) * ROOT_SVG.height, 0, ROOT_SVG.height),
    );

    let nearest = gain;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const branch of rootLocus.branches) {
      for (const sample of branch) {
        const distance = Math.hypot(sample.re - point.re, sample.im - point.im);
        if (distance < bestDistance) {
          bestDistance = distance;
          nearest = sample.gain;
        }
      }
    }
    return clamp(nearest, L2D_SYSTEM_SPEC.kRange.min, L2D_SYSTEM_SPEC.kRange.max);
  };

  const handleRootPointer = (event: React.PointerEvent<SVGSVGElement>) => {
    if (readOnly) {
      return;
    }
    const nextGain = nearestGainFromPointer(event.clientX, event.clientY, event.currentTarget);
    onGainChange(nextGain);
    onParameterChange?.({
      gain: nextGain,
      source: 'root-locus',
    });
  };

  return (
    <section className="premium-lesson-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="premium-lesson-kicker">Three-Panel Linkage</div>
          <h2 className="premium-lesson-title mt-1 text-lg font-semibold sm:text-xl">三面板联动工作区</h2>
          <p className="premium-lesson-muted mt-2 max-w-3xl">
            当前系统固定为 G(s)=K/[s(s+1)(s+6)]。你可以通过 K 滑块或根轨迹蓝点调整增益，工作区会同步更新三域指标。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {accentLabel ? <span className="premium-lesson-chip">{accentLabel}</span> : null}
          <span className={`premium-lesson-tone-pill ${metrics.isStable ? 'premium-tone-emerald' : 'premium-tone-rose'}`}>
            {metrics.isStable ? '稳定' : '不稳定'}
          </span>
          <span className="premium-lesson-tone-pill premium-tone-amber">criticalGain: 42</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="premium-lesson-panel-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="premium-lesson-title text-sm font-medium">增益控制</div>
              <div className="premium-lesson-muted mt-1 text-xs">K 范围 0.01 ~ 80，临界增益 Kcr = 42</div>
            </div>
            <div className="premium-lesson-title text-xl font-semibold">K = {formatNumber(gain, 2)}</div>
          </div>
          <input
            type="range"
            min={L2D_SYSTEM_SPEC.kRange.min}
            max={L2D_SYSTEM_SPEC.kRange.max}
            step="0.01"
            value={gain}
            disabled={readOnly}
            onChange={(event) => {
              const nextGain = Number(event.target.value);
              onGainChange(nextGain);
              onParameterChange?.({
                gain: nextGain,
                source: 'slider',
              });
            }}
            className="mt-4 w-full accent-[hsl(var(--premium-tone-cyan-border))]"
          />
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="主极点 σ" value={formatNumber(metrics.sigma, 3)} />
            <MetricCard label="主极点 ω" value={formatNumber(metrics.omega, 3)} />
            <MetricCard label="超调量 Mp" value={`${formatNumber(metrics.mp, 1)}%`} />
            <MetricCard label="调节时间 ts" value={`${formatNumber(metrics.ts, 2)} s`} />
            <MetricCard label="相位裕度 γ" value={`${formatNumber(metrics.gamma, 1)}°`} />
          </div>
          <div className="premium-lesson-tone-block premium-tone-slate mt-3">
            根轨迹拖拽会自动吸附到最近的分支采样点，用来逼近“拖动蓝点 → K 更新”的课堂体验。
          </div>
        </div>

        <div className="premium-lesson-panel-soft">
          <div className="premium-lesson-title text-sm font-medium">三域速记</div>
          <div className="mt-3 grid gap-2">
            <SummaryPill title="复平面" body="K 增大时，共轭极点右移并逐渐靠近虚轴。" />
            <SummaryPill title="时域" body="K 增大时，超调量上升，靠近临界时出现等幅振荡。" />
            <SummaryPill title="频域" body="K 增大时，幅频曲线上移，相位裕度 γ 逐步减小。" />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="premium-lesson-panel-soft">
          <div className="premium-lesson-title text-sm font-medium">根轨迹面板</div>
          <svg
            viewBox={`0 0 ${ROOT_SVG.width} ${ROOT_SVG.height}`}
            className="mt-3 w-full touch-none rounded-[20px] border border-border/70 bg-background"
            onPointerDown={(event) => {
              setDragging(true);
              handleRootPointer(event);
            }}
            onPointerMove={(event) => {
              if (dragging) {
                handleRootPointer(event);
              }
            }}
            onPointerUp={() => setDragging(false)}
            onPointerLeave={() => setDragging(false)}
          >
            <defs>
              <pattern id="l2d-grid" width="42" height="30" patternUnits="userSpaceOnUse">
                <path d="M 42 0 L 0 0 0 30" fill="none" stroke="hsl(var(--premium-lesson-border))" strokeWidth="0.8" opacity="0.3" />
              </pattern>
            </defs>
            <rect width={ROOT_SVG.width} height={ROOT_SVG.height} fill="url(#l2d-grid)" />
            <line x1={toRootX(0)} y1={0} x2={toRootX(0)} y2={ROOT_SVG.height} stroke="hsl(var(--premium-tone-rose-border))" strokeDasharray="6 6" />
            <line x1={0} y1={toRootY(0)} x2={ROOT_SVG.width} y2={toRootY(0)} stroke="hsl(var(--premium-lesson-border))" />
            {rootPaths.map((path) => (
              <path
                key={path.id}
                d={path.d}
                fill="none"
                stroke="hsl(var(--premium-tone-cyan-border))"
                strokeWidth="2.2"
                opacity="0.85"
              />
            ))}
            {L2D_SYSTEM_SPEC.poles.map((pole, index) => (
              <g key={`open-pole-${index}`} transform={`translate(${toRootX(pole.re)}, ${toRootY(pole.im)})`}>
                <line x1="-8" y1="-8" x2="8" y2="8" stroke="hsl(var(--premium-tone-slate-border))" strokeWidth="2.2" />
                <line x1="-8" y1="8" x2="8" y2="-8" stroke="hsl(var(--premium-tone-slate-border))" strokeWidth="2.2" />
              </g>
            ))}
            {activeClosedLoopPoles.map((pole) => (
              <circle
                key={pole.id}
                cx={pole.x}
                cy={pole.y}
                r="6.5"
                fill="hsl(var(--premium-tone-sky-border))"
                stroke="hsl(var(--premium-lesson-background))"
                strokeWidth="2"
              />
            ))}
            <text x={12} y={18} className="fill-foreground text-[11px]">拖动/点击分支可更新 K</text>
          </svg>
        </div>

        <div className="grid gap-4">
          <div className="premium-lesson-panel-soft">
            <div className="premium-lesson-title text-sm font-medium">时域响应面板</div>
            <svg viewBox={`0 0 ${PLOT_SVG.width} ${PLOT_SVG.height}`} className="mt-3 w-full rounded-[20px] border border-border/70 bg-background">
              <line x1="0" y1={PLOT_SVG.height - 12} x2={PLOT_SVG.width} y2={PLOT_SVG.height - 12} stroke="hsl(var(--premium-lesson-border))" />
              <line x1="0" y1="12" x2={PLOT_SVG.width} y2="12" stroke="hsl(var(--premium-tone-amber-border))" strokeDasharray="4 4" opacity="0.5" />
              <polyline fill="none" stroke="hsl(var(--premium-tone-emerald-border))" strokeWidth="2.4" points={toPolyline(timeDomain.samples.map((sample) => ({
                x: (sample.time / timePath.maxTime) * PLOT_SVG.width,
                y: PLOT_SVG.height - (sample.response / timePath.maxResponse) * (PLOT_SVG.height - 24) - 12,
              })))} />
            </svg>
          </div>

          <div className="premium-lesson-panel-soft">
            <div className="premium-lesson-title text-sm font-medium">Bode 图面板</div>
            <div className="mt-3 grid gap-3">
              <svg viewBox={`0 0 ${PLOT_SVG.width} ${PLOT_SVG.height}`} className="w-full rounded-[20px] border border-border/70 bg-background">
                <line x1="0" y1={PLOT_SVG.height / 2} x2={PLOT_SVG.width} y2={PLOT_SVG.height / 2} stroke="hsl(var(--premium-tone-amber-border))" strokeDasharray="4 4" opacity="0.6" />
                <path d={bodeCurves.magnitude} fill="none" stroke="hsl(var(--premium-tone-cyan-border))" strokeWidth="2.2" />
              </svg>
              <svg viewBox={`0 0 ${PLOT_SVG.width} ${PLOT_SVG.height}`} className="w-full rounded-[20px] border border-border/70 bg-background">
                <line x1="0" y1={PLOT_SVG.height - 28} x2={PLOT_SVG.width} y2={PLOT_SVG.height - 28} stroke="hsl(var(--premium-tone-rose-border))" strokeDasharray="4 4" opacity="0.5" />
                <line x1={bodeCurves.phaseMarginX} y1="0" x2={bodeCurves.phaseMarginX} y2={PLOT_SVG.height} stroke="hsl(var(--premium-tone-amber-border))" strokeDasharray="4 4" opacity="0.55" />
                <path d={bodeCurves.phase} fill="none" stroke="hsl(var(--premium-tone-violet-border))" strokeWidth="2.2" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-[18px] px-3 py-3">
      <div className="premium-lesson-caption text-[11px] uppercase tracking-[0.18em]">{label}</div>
      <div className="premium-lesson-title mt-2 text-lg font-semibold">{value}</div>
    </div>
  );
}

function SummaryPill({ title, body }: { title: string; body: string }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-[18px] px-3 py-3">
      <div className="premium-lesson-title text-sm font-semibold">{title}</div>
      <div className="premium-lesson-muted mt-1 text-sm leading-6">{body}</div>
    </div>
  );
}
