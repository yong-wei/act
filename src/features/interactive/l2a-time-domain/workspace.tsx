'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Gauge, Move, Orbit, RefreshCw, Waves } from 'lucide-react';

import type { L2AWorkspaceSnapshot } from '@/lib/l2a-course';
import { useInteractiveTracking } from '@/features/interactive/hooks/useInteractiveTracking';
import {
  computeSecondOrderResponse,
  DEFAULT_L2A_WORKSPACE_STATE,
  type L2AFamily,
} from './workspace-model';

interface L2AWorkspaceProps {
  role: 'teacher' | 'student';
  sessionId: string;
  currentStepTitle: string;
  currentStepId: string;
  state?: L2AWorkspaceSnapshot;
  onChange?: (nextState: L2AWorkspaceSnapshot) => void;
}

const PLANE = {
  width: 420,
  height: 300,
  minRe: -5,
  maxRe: 1,
  minIm: -4,
  maxIm: 4,
  padding: 28,
};

const PRESETS = [
  { id: 'balanced', label: '平衡点', zeta: 0.7, wn: 1.8 },
  { id: 'lively', label: '活跃型', zeta: 0.35, wn: 1.9 },
  { id: 'critical', label: '临界型', zeta: 1.0, wn: 1.6 },
  { id: 'conservative', label: '保守型', zeta: 1.2, wn: 1.25 },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function familyLabel(family: L2AFamily) {
  switch (family) {
    case 'overdamped':
      return '过阻尼';
    case 'critical':
      return '临界阻尼';
    case 'underdamped':
      return '欠阻尼';
    case 'oscillatory':
      return '持续振荡';
    case 'unstable':
      return '不稳定';
  }
}

function toSvgX(re: number) {
  const width = PLANE.width - PLANE.padding * 2;
  return PLANE.padding + ((re - PLANE.minRe) / (PLANE.maxRe - PLANE.minRe)) * width;
}

function toSvgY(im: number) {
  const height = PLANE.height - PLANE.padding * 2;
  return PLANE.padding + ((PLANE.maxIm - im) / (PLANE.maxIm - PLANE.minIm)) * height;
}

function fromSvg(x: number, y: number) {
  const width = PLANE.width - PLANE.padding * 2;
  const height = PLANE.height - PLANE.padding * 2;
  const re = PLANE.minRe + ((x - PLANE.padding) / width) * (PLANE.maxRe - PLANE.minRe);
  const im = PLANE.maxIm - ((y - PLANE.padding) / height) * (PLANE.maxIm - PLANE.minIm);
  return {
    re: clamp(re, PLANE.minRe, -0.05),
    im: clamp(im, 0.05, PLANE.maxIm),
  };
}

function gridValues(min: number, max: number, step: number) {
  const items: number[] = [];
  for (let value = min; value <= max + 0.001; value += step) {
    items.push(Number(value.toFixed(2)));
  }
  return items;
}

export function L2AWorkspace({
  role,
  sessionId,
  currentStepTitle,
  currentStepId,
  state,
  onChange,
}: L2AWorkspaceProps) {
  const [localState, setLocalState] = useState<L2AWorkspaceSnapshot>(state ?? DEFAULT_L2A_WORKSPACE_STATE);
  const [dragging, setDragging] = useState(false);
  const planeRef = useRef<SVGSVGElement>(null);

  const tracking = useInteractiveTracking({
    resourceId: `l2a-workspace-${role}`,
    sessionId,
    syncInterval: 12000,
    onSync: sessionId === 'demo' ? async () => {} : undefined,
  });

  useEffect(() => {
    if (state) {
      setLocalState(state);
    }
  }, [state]);

  useEffect(() => {
    tracking.emit('view', { role, currentStepId });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const response = useMemo(
    () => computeSecondOrderResponse({ zeta: localState.zeta, wn: localState.wn }),
    [localState.wn, localState.zeta],
  );

  const updateState = (next: Partial<L2AWorkspaceSnapshot>) => {
    const merged = {
      ...localState,
      ...next,
    };
    setLocalState(merged);
    onChange?.(merged);
    tracking.emit('param_change', {
      zeta: merged.zeta,
      wn: merged.wn,
      preset: merged.selectedPreset,
      stepId: currentStepId,
    });
  };

  const handlePreset = (presetId: string) => {
    const preset = PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    updateState({
      zeta: preset.zeta,
      wn: preset.wn,
      selectedPreset: preset.id,
      lastMeasuredAt: Date.now(),
    });
  };

  const beginDrag = () => {
    if (response.family !== 'underdamped' && response.family !== 'oscillatory') {
      return;
    }
    setDragging(true);
  };

  const dragTo = (clientX: number, clientY: number) => {
    if (!planeRef.current) return;
    const rect = planeRef.current.getBoundingClientRect();
    const { re, im } = fromSvg(clientX - rect.left, clientY - rect.top);
    const wn = Math.sqrt(re * re + im * im);
    const zeta = clamp(-re / wn, 0.02, 0.98);
    updateState({
      zeta,
      wn: clamp(wn, 0.4, 5),
      selectedPreset: null,
      lastMeasuredAt: Date.now(),
    });
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (event: PointerEvent) => dragTo(event.clientX, event.clientY);
    const stop = () => setDragging(false);
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging]);

  const responsePath = response.points
    .map((point, index) => {
      const x = 34 + (point.t / response.duration) * 450;
      const y = 236 - ((point.y + 0.1) / 2.7) * 184;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`;
    })
    .join(' ');

  return (
    <section className="premium-lesson-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-kicker tracking-[0.24em]">Flexible Sea Studio</div>
          <h2 className="mt-1 text-lg font-semibold text-slate-100 sm:text-xl">双面板工作区</h2>
          <p className="premium-lesson-muted">当前环节：{currentStepTitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MetricChip icon={Waves} label="家族" value={familyLabel(response.family)} />
          <MetricChip icon={Gauge} label="Mₚ" value={`${response.overshoot.toFixed(1)}%`} />
          <MetricChip icon={Activity} label="tₛ" value={Number.isFinite(response.settlingTime) ? `${response.settlingTime.toFixed(2)} s` : '∞'} />
          <MetricChip icon={Orbit} label="tᵣ" value={Number.isFinite(response.riseTime) ? `${response.riseTime.toFixed(2)} s` : '∞'} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[0.98fr_1.02fr]">
        <article className="premium-lesson-panel-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="premium-lesson-kicker tracking-[0.22em]">Pole Plane</div>
              <div className="premium-lesson-muted">拖动上半平面的极点可直接改写欠阻尼状态</div>
            </div>
            <span className="premium-lesson-chip px-3 py-1">
              ζ={localState.zeta.toFixed(2)} · ωₙ={localState.wn.toFixed(2)}
            </span>
          </div>
          <svg
            ref={planeRef}
            viewBox={`0 0 ${PLANE.width} ${PLANE.height}`}
            className="h-[248px] w-full rounded-[24px] bg-[radial-gradient(circle_at_top_left,#0f766e22,transparent_45%),#020617] sm:h-[320px]"
            onPointerDown={(event) => {
              beginDrag();
              dragTo(event.clientX, event.clientY);
            }}
          >
            {gridValues(PLANE.minRe, PLANE.maxRe, 1).map((value) => (
              <line
                key={`x-${value}`}
                x1={toSvgX(value)}
                y1={PLANE.padding}
                x2={toSvgX(value)}
                y2={PLANE.height - PLANE.padding}
                stroke="rgba(148,163,184,0.12)"
              />
            ))}
            {gridValues(PLANE.minIm, PLANE.maxIm, 1).map((value) => (
              <line
                key={`y-${value}`}
                x1={PLANE.padding}
                y1={toSvgY(value)}
                x2={PLANE.width - PLANE.padding}
                y2={toSvgY(value)}
                stroke="rgba(148,163,184,0.12)"
              />
            ))}
            <line
              x1={toSvgX(0)}
              y1={PLANE.padding}
              x2={toSvgX(0)}
              y2={PLANE.height - PLANE.padding}
              stroke="rgba(250,204,21,0.55)"
              strokeDasharray="6 5"
            />
            <line
              x1={PLANE.padding}
              y1={toSvgY(0)}
              x2={PLANE.width - PLANE.padding}
              y2={toSvgY(0)}
              stroke="rgba(148,163,184,0.55)"
            />
            <circle cx={toSvgX(response.poles.primary.re)} cy={toSvgY(response.poles.primary.im)} r="8" fill="#22d3ee" />
            <circle cx={toSvgX(response.poles.secondary.re)} cy={toSvgY(response.poles.secondary.im)} r="8" fill="#38bdf8" />
            <text x="20" y="20" fill="#94a3b8" fontSize="11">Im</text>
            <text x={PLANE.width - 40} y={toSvgY(0) - 8} fill="#fef08a" fontSize="11">虚轴</text>
            <text x={PLANE.width - 28} y={PLANE.height - 14} fill="#94a3b8" fontSize="11">Re</text>
          </svg>
          <p className="mt-3 text-xs leading-6 text-slate-400">
            欠阻尼/持续振荡区支持直接拖拽。若当前为临界阻尼或过阻尼，请用下方滑块继续调节。
          </p>
        </article>

        <article className="premium-lesson-panel-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="premium-lesson-kicker tracking-[0.22em]">Time Response</div>
              <div className="premium-lesson-muted">时域曲线始终在线，帮助你把参数和行为绑在一起</div>
            </div>
            <button
              type="button"
              onClick={() => {
                updateState({
                  ...DEFAULT_L2A_WORKSPACE_STATE,
                  selectedPreset: 'balanced',
                  lastMeasuredAt: Date.now(),
                });
                tracking.emit('interact', { action: 'reset', stepId: currentStepId });
              }}
              className="premium-lesson-chip inline-flex items-center gap-2 px-3 py-1 transition hover:border-cyan-300/40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              重置
            </button>
          </div>
          <svg viewBox="0 0 520 270" className="h-[248px] w-full rounded-[24px] bg-[radial-gradient(circle_at_top_left,#164e6326,transparent_45%),#020617] sm:h-[320px]">
            <line x1="34" y1="236" x2="486" y2="236" stroke="rgba(148,163,184,0.45)" />
            <line x1="34" y1="28" x2="34" y2="236" stroke="rgba(148,163,184,0.45)" />
            <line x1="34" y1={236 - (1.1 / 2.7) * 184} x2="486" y2={236 - (1.1 / 2.7) * 184} stroke="rgba(148,163,184,0.25)" strokeDasharray="6 5" />
            <line x1="34" y1={236 - (0.9 / 2.7) * 184} x2="486" y2={236 - (0.9 / 2.7) * 184} stroke="rgba(148,163,184,0.25)" strokeDasharray="6 5" />
            <path d={responsePath} stroke="#38bdf8" strokeWidth="3.5" fill="none" />
            <text x="42" y="18" fill="#94a3b8" fontSize="11">单位阶跃响应</text>
            <text x="452" y="252" fill="#94a3b8" fontSize="11">时间</text>
            <text x="8" y="42" fill="#94a3b8" fontSize="11">幅值</text>
          </svg>
        </article>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_0.9fr]">
        <article className="premium-lesson-panel-soft">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-300">阻尼比 ζ</div>
              <input
                type="range"
                min={-0.2}
                max={1.6}
                step={0.01}
                value={localState.zeta}
                onChange={(event) =>
                  updateState({
                    zeta: Number(event.target.value),
                    selectedPreset: null,
                    lastMeasuredAt: Date.now(),
                  })
                }
                className="w-full"
              />
              <div className="mt-2 text-sm text-slate-100">
                ζ 越大，曲线越稳，超调越小；ζ≈0.7 常是快与稳的平衡区。
              </div>
            </label>
            <label className="block">
              <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-300">自然频率 ωₙ</div>
              <input
                type="range"
                min={0.4}
                max={5}
                step={0.05}
                value={localState.wn}
                onChange={(event) =>
                  updateState({
                    wn: Number(event.target.value),
                    selectedPreset: null,
                    lastMeasuredAt: Date.now(),
                  })
                }
                className="w-full"
              />
              <div className="mt-2 text-sm text-slate-100">
                ωₙ 越大，系统整体越快；相同时间窗口内会看到更多振荡周期。
              </div>
            </label>
          </div>
        </article>

        <article className="premium-lesson-panel-soft">
          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-300">
            <Move className="h-3.5 w-3.5" />
            快速预设
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset.id)}
                className={`premium-lesson-chip text-sm transition ${
                  localState.selectedPreset === preset.id ? 'premium-lesson-choice-active' : 'hover:border-cyan-300/30'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2 text-sm text-slate-200 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">峰值时间</div>
              <div className="mt-2 text-lg font-semibold text-white">
                {response.peakTime > 0 ? `${response.peakTime.toFixed(2)} s` : '无'}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-slate-400">上次调整</div>
              <div className="mt-2 text-sm text-white">
                {localState.lastMeasuredAt ? new Date(localState.lastMeasuredAt).toLocaleTimeString('zh-CN') : '尚未记录'}
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

function MetricChip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="premium-lesson-chip">
      <span className="inline-flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-cyan-200" />
        <span className="text-slate-300">{label}</span>
        <span className="font-medium text-white">{value}</span>
      </span>
    </div>
  );
}
