'use client';

import { useEffect, useMemo, useState } from 'react';

import type { Unit11WorkspaceKind } from '@/lib/unit-1-1-course';

export interface WorkspaceParameterChange {
  key: string;
  value: number;
  source: 'slider' | 'preset';
}

interface Point {
  x: number;
  y: number;
}

const CHART = {
  width: 360,
  height: 180,
  padding: 18,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function buildPath(points: Point[]) {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
}

function createMonotonicPoints(rate: number): Point[] {
  return Array.from({ length: 60 }, (_, index) => {
    const t = (index / 59) * 6;
    const y = 1 - Math.exp(-rate * t);
    return {
      x: CHART.padding + (index / 59) * (CHART.width - CHART.padding * 2),
      y: CHART.height - CHART.padding - y * (CHART.height - CHART.padding * 2),
    };
  });
}

function createOscillationPoints(damping: number, naturalFrequency: number): Point[] {
  return Array.from({ length: 80 }, (_, index) => {
    const t = (index / 79) * 8;
    const envelope = Math.exp(-damping * naturalFrequency * t);
    const oscillation = Math.cos(naturalFrequency * Math.sqrt(Math.max(0.08, 1 - damping ** 2)) * t);
    const y = 1 - envelope * oscillation;
    return {
      x: CHART.padding + (index / 79) * (CHART.width - CHART.padding * 2),
      y: CHART.height - CHART.padding - clamp(y, -0.2, 1.6) * (CHART.height - CHART.padding * 2) / 1.8,
    };
  });
}

function createPoleResponsePoints(realPole: number, imagPole: number) {
  if (realPole >= 0) {
    return Array.from({ length: 60 }, (_, index) => {
      const t = (index / 59) * 4;
      const unstable = 0.2 + Math.exp(Math.max(0.02, realPole) * t) / 6;
      return {
        x: CHART.padding + (index / 59) * (CHART.width - CHART.padding * 2),
        y: CHART.height - CHART.padding - clamp(unstable, 0, 1.8) * (CHART.height - CHART.padding * 2) / 1.8,
      };
    });
  }

  if (Math.abs(imagPole) < 0.15) {
    return createMonotonicPoints(Math.abs(realPole));
  }

  const damping = clamp(Math.abs(realPole) / Math.sqrt(realPole ** 2 + imagPole ** 2), 0.05, 0.95);
  const naturalFrequency = clamp(Math.sqrt(realPole ** 2 + imagPole ** 2), 0.8, 4);
  return createOscillationPoints(damping, naturalFrequency);
}

function createZeroEffectPoints(zeroReal: number) {
  const boost = clamp(Math.abs(zeroReal) / 4, 0.05, 1);
  return Array.from({ length: 80 }, (_, index) => {
    const t = (index / 79) * 8;
    const y = 1 - Math.exp(-0.7 * t) * Math.cos(2.2 * t) + boost * Math.exp(-0.9 * t) * Math.sin(2.2 * t);
    return {
      x: CHART.padding + (index / 79) * (CHART.width - CHART.padding * 2),
      y: CHART.height - CHART.padding - clamp(y, -0.2, 1.8) * (CHART.height - CHART.padding * 2) / 1.8,
    };
  });
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="premium-lesson-surface-elevated px-3 py-3">
      <div className="premium-lesson-caption text-[11px] uppercase tracking-[0.18em]">{label}</div>
      <div className="premium-lesson-title mt-2 text-base font-semibold">{value}</div>
    </div>
  );
}

function ResponseChart({
  title,
  subtitle,
  points,
}: {
  title: string;
  subtitle: string;
  points: Point[];
}) {
  return (
    <section className="premium-lesson-panel-soft px-4 py-4">
      <div className="premium-lesson-title text-sm font-medium">{title}</div>
      <div className="premium-lesson-muted mt-1 text-xs">{subtitle}</div>
      <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} className="mt-4 w-full">
        <rect x="0" y="0" width={CHART.width} height={CHART.height} rx="16" className="fill-[var(--interactive-surface-muted)]" />
        <line
          x1={CHART.padding}
          x2={CHART.width - CHART.padding}
          y1={CHART.height - CHART.padding}
          y2={CHART.height - CHART.padding}
          className="stroke-[var(--interactive-border-strong)]"
        />
        <line
          x1={CHART.padding}
          x2={CHART.padding}
          y1={CHART.padding}
          y2={CHART.height - CHART.padding}
          className="stroke-[var(--interactive-border-strong)]"
        />
        <path d={buildPath(points)} fill="none" stroke="var(--interactive-accent-strong)" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </section>
  );
}

function PoleResponseWorkspace({
  readOnly,
  onParameterChange,
}: {
  readOnly?: boolean;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [realPole, setRealPole] = useState(-2);
  const [imagPole, setImagPole] = useState(0);

  const points = useMemo(() => createPoleResponsePoints(realPole, imagPole), [imagPole, realPole]);
  const familyLabel =
    realPole > 0
      ? '家族4：发散'
      : Math.abs(imagPole) < 0.15
        ? '家族1：单调上升'
        : Math.abs(realPole) < 0.2
          ? '家族3：持续振荡边界'
          : '家族2：振荡衰减';

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">极点-响应联动面板</div>
        <div className="premium-lesson-muted mt-2 text-sm">
          通过调节极点位置观察响应家族变化，重点看实部决定衰减、虚部决定振荡。
        </div>
        <div className="mt-4 grid gap-3">
          <label className="premium-lesson-caption text-xs">
            极点实部
            <input
              type="range"
              min="-3"
              max="1.2"
              step="0.1"
              value={realPole}
              disabled={readOnly}
              onChange={(event) => {
                const next = Number(event.target.value);
                setRealPole(next);
                onParameterChange?.({ key: 'realPole', value: next, source: 'slider' });
              }}
              className="mt-2 w-full"
            />
          </label>
          <label className="premium-lesson-caption text-xs">
            极点虚部
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={imagPole}
              disabled={readOnly}
              onChange={(event) => {
                const next = Number(event.target.value);
                setImagPole(next);
                onParameterChange?.({ key: 'imagPole', value: next, source: 'slider' });
              }}
              className="mt-2 w-full"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {[
            { label: '家族1', real: -2, imag: 0 },
            { label: '家族2', real: -1, imag: 2 },
            { label: '家族3', real: -0.05, imag: 2 },
            { label: '家族4', real: 0.5, imag: 0 },
          ].map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={readOnly}
              onClick={() => {
                setRealPole(preset.real);
                setImagPole(preset.imag);
                onParameterChange?.({ key: 'realPole', value: preset.real, source: 'preset' });
                onParameterChange?.({ key: 'imagPole', value: preset.imag, source: 'preset' });
              }}
              className="premium-lesson-action-secondary justify-center"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Metric label="极点" value={`${realPole.toFixed(1)} ${imagPole ? `± ${imagPole.toFixed(1)}j` : ''}`} />
          <Metric label="响应家族" value={familyLabel} />
          <Metric label="阻尼趋势" value={realPole > 0 ? '失稳' : imagPole < 0.15 ? '单调' : '振荡'} />
        </div>
      </section>

      <ResponseChart
        title="阶跃响应"
        subtitle="任务：先把极点从 -2 拖到 -0.5，再把极点拖向复平面，描述“变慢”和“出现振荡”两个现象。"
        points={points}
      />
    </div>
  );
}

function ZeroEffectWorkspace({
  readOnly,
  onParameterChange,
}: {
  readOnly?: boolean;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [zeroReal, setZeroReal] = useState(-2.5);
  const points = useMemo(() => createZeroEffectPoints(zeroReal), [zeroReal]);

  return (
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">零点拖动观察</div>
        <div className="premium-lesson-muted mt-2 text-sm">
          固定极点为 <code>-1 ± 2j</code>，调节零点位置，观察某个模态如何被压制或放大。
        </div>
        <label className="premium-lesson-caption mt-4 block text-xs">
          零点位置
          <input
            type="range"
            min="-5"
            max="-0.2"
            step="0.1"
            value={zeroReal}
            disabled={readOnly}
            onChange={(event) => {
              const next = Number(event.target.value);
              setZeroReal(next);
              onParameterChange?.({ key: 'zeroReal', value: next, source: 'slider' });
            }}
            className="mt-2 w-full"
          />
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label="零点" value={`${zeroReal.toFixed(1)}`} />
          <Metric label="模态变化" value={Math.abs(zeroReal + 1) < 0.8 ? '更明显压制' : '权重较自然'} />
        </div>
      </section>

      <ResponseChart
        title="零点影响下的响应变化"
        subtitle="观察：零点靠近主导极点时，对应模态被压制；零点远离时，各模态按自然权重叠加。"
        points={points}
      />
    </div>
  );
}

function ElementSliderWorkspace({
  readOnly,
  onParameterChange,
}: {
  readOnly?: boolean;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  const [mode, setMode] = useState<'inertia' | 'oscillation'>('oscillation');
  const [timeConstant, setTimeConstant] = useState(1.2);
  const [damping, setDamping] = useState(0.45);

  const points = useMemo(() => {
    if (mode === 'inertia') {
      return createMonotonicPoints(1 / Math.max(0.2, timeConstant));
    }
    return createOscillationPoints(damping, 2.24);
  }, [damping, mode, timeConstant]);

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <section className="premium-lesson-panel-soft px-4 py-4">
        <div className="premium-lesson-title text-sm font-medium">典型环节参数滑块</div>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setMode('inertia')} className="premium-lesson-action-secondary">
            惯性环节
          </button>
          <button type="button" onClick={() => setMode('oscillation')} className="premium-lesson-action-secondary">
            振荡环节
          </button>
        </div>

        {mode === 'inertia' ? (
          <label className="premium-lesson-caption mt-4 block text-xs">
            时间常数 T
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={timeConstant}
              disabled={readOnly}
              onChange={(event) => {
                const next = Number(event.target.value);
                setTimeConstant(next);
                onParameterChange?.({ key: 'timeConstant', value: next, source: 'slider' });
              }}
              className="mt-2 w-full"
            />
          </label>
        ) : (
          <label className="premium-lesson-caption mt-4 block text-xs">
            阻尼比 ζ
            <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.05"
              value={damping}
              disabled={readOnly}
              onChange={(event) => {
                const next = Number(event.target.value);
                setDamping(next);
                onParameterChange?.({ key: 'damping', value: next, source: 'slider' });
              }}
              className="mt-2 w-full"
            />
          </label>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Metric label={mode === 'inertia' ? '时间常数' : '阻尼比'} value={mode === 'inertia' ? timeConstant.toFixed(1) : damping.toFixed(2)} />
          <Metric label="环节类型" value={mode === 'inertia' ? '惯性' : '振荡'} />
        </div>
      </section>

      <ResponseChart
        title={mode === 'inertia' ? '惯性环节响应' : '振荡环节响应'}
        subtitle={mode === 'inertia' ? 'T 变大，系统变慢。' : 'ζ 从 0.1 增加到 0.9，振荡逐渐减弱。'}
        points={points}
      />
    </div>
  );
}

export function Unit11Workspace({
  mode,
  readOnly,
  onParameterChange,
}: {
  mode: Unit11WorkspaceKind;
  readOnly?: boolean;
  onParameterChange?: (change: WorkspaceParameterChange) => void;
}) {
  if (mode === 'pole-response') {
    return <PoleResponseWorkspace readOnly={readOnly} onParameterChange={onParameterChange} />;
  }

  if (mode === 'zero-effect') {
    return <ZeroEffectWorkspace readOnly={readOnly} onParameterChange={onParameterChange} />;
  }

  if (mode === 'element-slider') {
    return <ElementSliderWorkspace readOnly={readOnly} onParameterChange={onParameterChange} />;
  }

  return null;
}
