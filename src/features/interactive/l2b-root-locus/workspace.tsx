'use client';

import { useEffect, useMemo, useState } from 'react';

import type { L2BWorkspaceSnapshot } from '@/lib/l2b-course';
import {
  buildResponseCurve,
  clampGain,
  computeL2BMetrics,
  describePole,
  getNearestRootLocusPoint,
  getRootLocusSelection,
  ROOT_LOCUS_SAMPLES,
  toSvgPointX,
  toSvgPointY,
} from './workspace-model';

const SVG_WIDTH = 320;
const SVG_HEIGHT = 240;
const L2B_WORKSPACE_THEME = {
  axis: 'hsl(var(--premium-lesson-border))',
  arrow: 'hsl(var(--premium-tone-cyan-border))',
  arrowWarm: 'hsl(var(--premium-tone-amber-border))',
  nodeFill: 'hsl(var(--premium-lesson-surface-elevated))',
  nodeStroke: 'hsl(var(--premium-lesson-foreground-strong))',
  controllerFill: 'hsl(var(--premium-tone-cyan-bg))',
  controllerStroke: 'hsl(var(--premium-tone-cyan-border))',
  plantFill: 'hsl(var(--premium-tone-sky-bg))',
  plantStroke: 'hsl(var(--premium-tone-sky-border))',
  sensorFill: 'hsl(var(--premium-tone-orange-bg))',
  sensorStroke: 'hsl(var(--premium-tone-orange-border))',
  stabilityZone: 'hsl(var(--premium-tone-emerald-bg))',
  dampingZone: 'hsl(var(--premium-tone-cyan-bg))',
  overshootZone: 'hsl(var(--premium-tone-amber-bg))',
  criticalLine: 'hsl(var(--premium-tone-rose-border))',
  ray: 'hsl(var(--premium-tone-orange-border))',
  rootPrimary: 'hsl(var(--premium-tone-cyan-border))',
  rootSecondary: 'hsl(var(--premium-tone-sky-border))',
  rootSelected: 'hsl(var(--premium-tone-orange-border))',
  rootPoint: 'hsl(var(--premium-lesson-graph-node-stroke))',
  guidePoint: 'hsl(var(--premium-lesson-graph-edge-active))',
  responseGuide: 'hsl(var(--premium-tone-sky-border))',
  responseCurve: 'hsl(var(--premium-tone-emerald-border))',
};

function toResponsePath() {
  return (gain: number) => {
    const points = buildResponseCurve(gain);
    return points
      .map((point, index) => {
        const x = (point.time / 8) * SVG_WIDTH;
        const y = 180 - point.output * 120;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };
}

function getInitialState(state?: L2BWorkspaceSnapshot): L2BWorkspaceSnapshot {
  return (
    state ?? {
      gain: 1,
      selectedPointKey: null,
      showRay45: false,
      studentUnlocked: false,
      lastMeasuredAt: null,
    }
  );
}

function formatRatio(value: number | null) {
  return value == null ? '—' : value.toFixed(3);
}

function formatPercent(value: number | null) {
  return value == null ? '—' : `${value.toFixed(1)}%`;
}

function formatSeconds(value: number | null) {
  return value == null ? '—' : `${value.toFixed(1)} s`;
}

function FeedbackLoopWorkspace() {
  return (
    <section className="premium-lesson-panel space-y-4">
      <div>
        <div className="premium-lesson-kicker">Feedback Diagram</div>
        <h2 className="premium-lesson-title mt-1 text-lg font-semibold sm:text-xl">反馈框图认知卡</h2>
        <p className="premium-lesson-muted mt-2">
          step-06 不再强行复用根轨迹工作区，而是直接把“开环旋钮”和“闭环结果”的关系摆成一张可读的结构图。
        </p>
      </div>

      <div className="premium-lesson-surface-elevated rounded-[28px] px-4 py-4">
        <svg viewBox="0 0 540 260" className="w-full">
          <defs>
            <marker id="arrow-head" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
              <path d="M0,0 L10,4 L0,8 Z" fill={L2B_WORKSPACE_THEME.arrow} />
            </marker>
          </defs>
          <path d="M40 120 H120" stroke={L2B_WORKSPACE_THEME.arrow} strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <circle cx="145" cy="120" r="16" fill={L2B_WORKSPACE_THEME.nodeFill} stroke={L2B_WORKSPACE_THEME.nodeStroke} strokeWidth="2" />
          <path d="M145 104 V136 M129 120 H161" stroke={L2B_WORKSPACE_THEME.nodeStroke} strokeWidth="2" />
          <path d="M161 120 H220" stroke={L2B_WORKSPACE_THEME.arrow} strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <rect x="220" y="88" width="84" height="64" rx="18" fill={L2B_WORKSPACE_THEME.controllerFill} stroke={L2B_WORKSPACE_THEME.controllerStroke} strokeWidth="2" />
          <text x="262" y="114" textAnchor="middle" fill={L2B_WORKSPACE_THEME.nodeStroke} className="text-[13px] font-semibold">
            控制器
          </text>
          <text x="262" y="134" textAnchor="middle" fill={L2B_WORKSPACE_THEME.controllerStroke} className="text-[15px] font-semibold">
            [K]
          </text>
          <path d="M304 120 H368" stroke={L2B_WORKSPACE_THEME.arrow} strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <rect x="368" y="88" width="104" height="64" rx="18" fill={L2B_WORKSPACE_THEME.plantFill} stroke={L2B_WORKSPACE_THEME.plantStroke} strokeWidth="2" />
          <text x="420" y="114" textAnchor="middle" fill={L2B_WORKSPACE_THEME.nodeStroke} className="text-[13px] font-semibold">
            船舶对象
          </text>
          <text x="420" y="134" textAnchor="middle" fill={L2B_WORKSPACE_THEME.plantStroke} className="text-[15px] font-semibold">
            [G(s)]
          </text>
          <path d="M472 120 H516" stroke={L2B_WORKSPACE_THEME.arrow} strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <path d="M500 120 V207 H160 V136" stroke={L2B_WORKSPACE_THEME.arrowWarm} strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <rect x="320" y="184" width="132" height="46" rx="18" fill={L2B_WORKSPACE_THEME.sensorFill} stroke={L2B_WORKSPACE_THEME.sensorStroke} strokeWidth="2" />
          <text x="386" y="212" textAnchor="middle" fill={L2B_WORKSPACE_THEME.sensorStroke} className="text-[13px] font-semibold">
            [H(s)] 反馈传感器
          </text>
          <text x="58" y="108" fill={L2B_WORKSPACE_THEME.axis} className="text-[13px]">
            输入 r
          </text>
          <text x="494" y="108" fill={L2B_WORKSPACE_THEME.axis} className="text-[13px]">
            输出 y
          </text>
          <text x="262" y="74" textAnchor="middle" fill={L2B_WORKSPACE_THEME.controllerStroke} className="text-[13px] font-semibold">
            开环增益（旋钮）
          </text>
          <text x="420" y="74" textAnchor="middle" fill={L2B_WORKSPACE_THEME.plantStroke} className="text-[13px] font-semibold">
            闭环极点（结果）
          </text>
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="premium-lesson-tone-block premium-tone-cyan">
          <div className="font-semibold">开环增益（旋钮）</div>
          <p className="mt-2 leading-6">你实际去调的是控制器前面的 K，它决定输入信号被放大多少。</p>
        </div>
        <div className="premium-lesson-tone-block premium-tone-sky">
          <div className="font-semibold">闭环极点（结果）</div>
          <p className="mt-2 leading-6">真正决定响应快慢与超调的，是回路闭合后整个系统的闭环极点。</p>
        </div>
        <div className="premium-lesson-tone-block premium-tone-amber">
          <div className="font-semibold">一句话记住</div>
          <p className="mt-2 leading-6">根轨迹 = 旋钮从 0 拧到 ∞，极点走过的全部路径。</p>
        </div>
      </div>
    </section>
  );
}

export function L2BWorkspace({
  role,
  sessionId,
  currentStepId,
  currentStepTitle,
  state,
  onChange,
  readOnly = false,
}: {
  role: 'teacher' | 'student';
  sessionId: string;
  currentStepId: string;
  currentStepTitle: string;
  state?: L2BWorkspaceSnapshot;
  onChange?: (snapshot: L2BWorkspaceSnapshot) => void;
  readOnly?: boolean;
}) {
  const [localState, setLocalState] = useState<L2BWorkspaceSnapshot>(getInitialState(state));

  useEffect(() => {
    if (state) {
      setLocalState(state);
    }
  }, [state]);

  const metrics = useMemo(() => computeL2BMetrics(localState.gain), [localState.gain]);
  const responsePath = useMemo(() => toResponsePath()(localState.gain), [localState.gain]);
  const selectedSample = useMemo(() => getRootLocusSelection(localState.selectedPointKey), [localState.selectedPointKey]);
  const highlightedUpperPoint = useMemo(
    () => getNearestRootLocusPoint(localState.gain, metrics.poles[0]?.im),
    [localState.gain, metrics.poles],
  );
  const selectedMetrics = selectedSample?.metrics ?? metrics;

  const updateState = (next: Partial<L2BWorkspaceSnapshot>) => {
    const merged = {
      ...localState,
      ...next,
      gain: next.gain == null ? localState.gain : clampGain(next.gain),
      lastMeasuredAt: Date.now(),
    };
    setLocalState(merged);
    onChange?.(merged);
  };

  if (currentStepId === 'open-close-loop') {
    return <FeedbackLoopWorkspace />;
  }

  const showPointSelection = currentStepId === 'design-map' || currentStepId === 'verify-and-ray';
  const showRayPanel = currentStepId === 'verify-and-ray';
  const showBroadcastNote = currentStepId === 'pole-drag-demo';
  const showPerformanceZones = currentStepId === 'design-map';
  const rootLocusPath = [...ROOT_LOCUS_SAMPLES].sort((a, b) => a.gain - b.gain).reduce(
    (accumulator, sample) => {
      const point = `${toSvgPointX(sample.pole.re, SVG_WIDTH).toFixed(1)} ${toSvgPointY(sample.pole.im, SVG_HEIGHT).toFixed(1)}`;
      accumulator[sample.branch].push(point);
      return accumulator;
    },
    {
      upper: [] as string[],
      lower: [] as string[],
      'real-left': [] as string[],
      'real-right': [] as string[],
    },
  );

  return (
    <section className="premium-lesson-panel space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="premium-lesson-kicker">Root Locus Studio</div>
          <h2 className="premium-lesson-title mt-1 text-lg font-semibold sm:text-xl">根轨迹工作区</h2>
          <p className="premium-lesson-muted">
            {currentStepTitle} · K = {localState.gain.toFixed(2)} · {readOnly ? '广播视图' : role === 'teacher' ? '教师控制' : '独立探索'}
          </p>
        </div>
        <div className="premium-lesson-chip">45°射线：{localState.showRay45 ? '开启' : '关闭'}</div>
      </div>

      {showBroadcastNote ? (
        <div className="premium-lesson-tone-block premium-tone-emerald">
          <div className="font-semibold">{readOnly ? '教师广播中' : '轮到你了'}</div>
          <p className="mt-2 leading-6">
            {readOnly
              ? '当前正在跟随教师演示。先边看边记，等教师点击“切换到学生自主模式”后再自己拖动。'
              : '拖动滑块，找到极点分叉的 K 值，再比较 K = 1 / 2 / 5 时的超调与调节时间。'}
          </p>
        </div>
      ) : null}

      <div className="premium-lesson-panel-soft space-y-4">
        <label className="premium-lesson-body block text-sm">
          <span className="premium-lesson-title mb-2 block font-medium">增益滑块 K</span>
          <input
            type="range"
            min="0"
            max="10"
            step="0.1"
            value={localState.gain}
            disabled={readOnly}
            onChange={(event) => updateState({ gain: Number(event.target.value) })}
            className="h-11 w-full"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => updateState({ showRay45: !localState.showRay45 })}
            className="premium-lesson-action-tone premium-tone-cyan"
            disabled={readOnly}
          >
            {localState.showRay45 ? '关闭 45°射线' : '打开 45°射线'}
          </button>
          {currentStepId === 'pole-drag-demo' && role === 'teacher' ? (
            <button
              type="button"
              onClick={() => updateState({ studentUnlocked: !localState.studentUnlocked })}
              className={`rounded-full border px-3 py-2 text-xs ${
                localState.studentUnlocked
                  ? 'premium-tone-amber'
                  : 'premium-tone-emerald'
              }`}
            >
              {localState.studentUnlocked ? '切回教师演示模式' : '切换到学生自主模式'}
            </button>
          ) : null}
        </div>

        {currentStepId === 'pole-drag-demo' && role === 'teacher' ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              localState.studentUnlocked
                ? 'premium-tone-emerald'
                : 'premium-tone-slate'
            }`}
          >
            {localState.studentUnlocked
              ? '已切换到学生自主模式，学生端现在可以拖动滑块和根轨迹点。'
              : '当前仍为教师演示模式，学生端保持跟随广播，只读查看。'}
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="premium-lesson-surface-elevated rounded-[24px] px-3 py-3">
            <div className="premium-lesson-caption mb-3 flex items-center justify-between text-xs">
              <span>复平面：根轨迹地图</span>
              <span>点击轨迹可选点</span>
            </div>
            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full">
              {showPerformanceZones ? (
                <>
                  <rect x="80" y="82" width="70" height="76" rx="20" fill={L2B_WORKSPACE_THEME.stabilityZone} fillOpacity="0.9" />
                  <rect x="138" y="54" width="72" height="132" rx="22" fill={L2B_WORKSPACE_THEME.dampingZone} fillOpacity="0.92" />
                  <rect x="210" y="26" width="68" height="188" rx="22" fill={L2B_WORKSPACE_THEME.overshootZone} fillOpacity="0.95" />
                </>
              ) : null}
              <line x1={0} x2={SVG_WIDTH} y1={SVG_HEIGHT / 2} y2={SVG_HEIGHT / 2} stroke={L2B_WORKSPACE_THEME.axis} strokeWidth="1.2" />
              <line x1={toSvgPointX(0, SVG_WIDTH)} x2={toSvgPointX(0, SVG_WIDTH)} y1={0} y2={SVG_HEIGHT} stroke={L2B_WORKSPACE_THEME.criticalLine} strokeDasharray="5 5" strokeWidth="1.2" />
              {localState.showRay45 ? (
                <>
                  <line
                    x1={toSvgPointX(0, SVG_WIDTH)}
                    y1={toSvgPointY(0, SVG_HEIGHT)}
                    x2={toSvgPointX(-2.8, SVG_WIDTH)}
                    y2={toSvgPointY(2.8, SVG_HEIGHT)}
                    stroke={L2B_WORKSPACE_THEME.ray}
                    strokeDasharray="6 5"
                    strokeWidth="1.8"
                  />
                  <line
                    x1={toSvgPointX(0, SVG_WIDTH)}
                    y1={toSvgPointY(0, SVG_HEIGHT)}
                    x2={toSvgPointX(-2.8, SVG_WIDTH)}
                    y2={toSvgPointY(-2.8, SVG_HEIGHT)}
                    stroke={L2B_WORKSPACE_THEME.ray}
                    strokeDasharray="6 5"
                    strokeWidth="1.8"
                  />
                  <text x={toSvgPointX(-0.35, SVG_WIDTH)} y={toSvgPointY(0.35, SVG_HEIGHT) - 8} fill={L2B_WORKSPACE_THEME.sensorStroke} className="text-[11px] font-semibold">
                    45°
                  </text>
                </>
              ) : null}
              <polyline fill="none" stroke={L2B_WORKSPACE_THEME.rootPrimary} strokeWidth="3" points={rootLocusPath.upper.join(' ')} />
              <polyline fill="none" stroke={L2B_WORKSPACE_THEME.rootPrimary} strokeWidth="3" points={rootLocusPath.lower.join(' ')} />
              <polyline fill="none" stroke={L2B_WORKSPACE_THEME.rootSecondary} strokeWidth="2.5" points={rootLocusPath['real-left'].join(' ')} />
              <polyline fill="none" stroke={L2B_WORKSPACE_THEME.rootSecondary} strokeWidth="2.5" points={rootLocusPath['real-right'].join(' ')} />
              {showPointSelection
                ? ROOT_LOCUS_SAMPLES.filter((sample) => sample.branch === 'upper')
                    .filter((sample) => Math.abs(sample.gain % 0.5) < 1e-6)
                    .map((sample) => {
                      const isSelected = sample.key === localState.selectedPointKey;
                      return (
                        <g
                          key={sample.key}
                          role="button"
                          tabIndex={readOnly ? -1 : 0}
                          onClick={() => !readOnly && updateState({ gain: sample.gain, selectedPointKey: sample.key })}
                          onKeyDown={(event) => {
                            if (!readOnly && (event.key === 'Enter' || event.key === ' ')) {
                              event.preventDefault();
                              updateState({ gain: sample.gain, selectedPointKey: sample.key });
                            }
                          }}
                        >
                          <circle
                            cx={toSvgPointX(sample.pole.re, SVG_WIDTH)}
                            cy={toSvgPointY(sample.pole.im, SVG_HEIGHT)}
                            r={isSelected ? 9 : 7}
                            fill={isSelected ? L2B_WORKSPACE_THEME.rootSelected : L2B_WORKSPACE_THEME.rootPoint}
                            fillOpacity={isSelected ? 0.95 : 0.82}
                          />
                          <circle
                            cx={toSvgPointX(sample.pole.re, SVG_WIDTH)}
                            cy={toSvgPointY(-sample.pole.im, SVG_HEIGHT)}
                            r={isSelected ? 9 : 7}
                            fill={isSelected ? L2B_WORKSPACE_THEME.rootSelected : L2B_WORKSPACE_THEME.rootPoint}
                            fillOpacity={isSelected ? 0.95 : 0.82}
                          />
                        </g>
                      );
                    })
                : null}
              <circle
                cx={toSvgPointX(highlightedUpperPoint.pole.re, SVG_WIDTH)}
                cy={toSvgPointY(highlightedUpperPoint.pole.im, SVG_HEIGHT)}
                r={9}
                fill={L2B_WORKSPACE_THEME.guidePoint}
                stroke={L2B_WORKSPACE_THEME.nodeStroke}
                strokeWidth="2"
              />
              <circle
                cx={toSvgPointX(metrics.poles[1].re, SVG_WIDTH)}
                cy={toSvgPointY(metrics.poles[1].im, SVG_HEIGHT)}
                r={9}
                fill={L2B_WORKSPACE_THEME.arrowWarm}
                stroke={L2B_WORKSPACE_THEME.sensorStroke}
                strokeWidth="2"
              />
              <text x={18} y={22} fill={L2B_WORKSPACE_THEME.axis} className="text-[11px]">
                jω
              </text>
              <text x={SVG_WIDTH - 28} y={SVG_HEIGHT / 2 - 8} fill={L2B_WORKSPACE_THEME.axis} className="text-[11px]">
                σ
              </text>
            </svg>
          </div>

          <div className="premium-lesson-surface-elevated rounded-[24px] px-3 py-3">
            <div className="premium-lesson-caption mb-3 flex items-center justify-between text-xs">
              <span>时域响应曲线</span>
              <span>调节时间≈4s</span>
            </div>
            <svg viewBox={`0 0 ${SVG_WIDTH} 200`} className="w-full">
              <line x1={0} x2={SVG_WIDTH} y1={180} y2={180} stroke={L2B_WORKSPACE_THEME.axis} strokeWidth="1.2" />
              <line x1={0} x2={SVG_WIDTH} y1={60} y2={60} stroke={L2B_WORKSPACE_THEME.responseGuide} strokeDasharray="4 4" />
              <path d={responsePath} fill="none" stroke={L2B_WORKSPACE_THEME.responseCurve} strokeWidth="3" />
              <text x={6} y={22} fill={L2B_WORKSPACE_THEME.axis} className="text-[11px]">
                y(t)
              </text>
              <text x={SVG_WIDTH - 34} y={194} fill={L2B_WORKSPACE_THEME.axis} className="text-[11px]">
                t / s
              </text>
            </svg>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="premium-lesson-chip">ζ：{formatRatio(selectedMetrics.dampingRatio)}</div>
          <div className="premium-lesson-chip">超调：{formatPercent(selectedMetrics.overshoot)}</div>
          <div className="premium-lesson-chip">调节时间：{formatSeconds(selectedMetrics.settlingTime)}</div>
        </div>
        <div className="premium-lesson-surface-elevated rounded-[20px] px-4 py-3 text-sm">
          极点：{metrics.poles.map((pole) => describePole(pole)).join(' / ')}
        </div>
      </div>

      {showBroadcastNote ? (
        <section className="premium-lesson-tone-card premium-tone-cyan">
          <div className="font-semibold">教师演示关键数据</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 font-medium">K</th>
                  <th className="pb-2 pr-4 font-medium">极点</th>
                  <th className="pb-2 pr-4 font-medium">超调</th>
                  <th className="pb-2 font-medium">调节时间</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { gain: 1, label: 'K = 1' },
                  { gain: 2, label: 'K = 2' },
                  { gain: 5, label: 'K = 5' },
                ].map((row) => {
                  const rowMetrics = computeL2BMetrics(row.gain);
                  return (
                    <tr key={row.label} className="border-t border-border/50">
                      <td className="py-2 pr-4 font-semibold">{row.label}</td>
                      <td className="py-2 pr-4">{rowMetrics.poles.map((pole) => describePole(pole)).join(' / ')}</td>
                      <td className="py-2 pr-4">{formatPercent(rowMetrics.overshoot)}</td>
                      <td className="py-2">{formatSeconds(rowMetrics.settlingTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showPointSelection ? (
        <section className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="premium-lesson-tone-card premium-tone-amber">
            <div className="font-semibold">轨迹选点信息</div>
            <p className="mt-2 leading-6">
              {selectedSample
                ? `你当前选择了 ${describePole(selectedSample.pole)}，对应 K ≈ ${selectedSample.gain.toFixed(2)}。`
                : '点击根轨迹上的圆点，直接把“地图上的位置”转成 K、极点和性能信息。'}
            </p>
            <div className="mt-3 space-y-2 text-xs">
              <div>极点 s ≈ {selectedSample ? describePole(selectedSample.pole) : describePole(metrics.poles[0])}</div>
              <div>对应 K ≈ {(selectedSample?.gain ?? localState.gain).toFixed(2)}</div>
              <div>预估超调 ≈ {formatPercent(selectedMetrics.overshoot)}</div>
              <div>预估调节时间 ≈ {formatSeconds(selectedMetrics.settlingTime)}</div>
            </div>
          </div>

          {showRayPanel ? (
            <div className="premium-lesson-tone-card premium-tone-orange">
              <div className="font-semibold">45° 射线几何定位</div>
              <p className="mt-2 leading-6">ζ = cos θ，所以当目标 ζ = 0.707 时，θ = 45°，射线与根轨迹交点就是最佳阻尼点。</p>
              <div className="mt-3 space-y-3">
                <div className="premium-lesson-surface-elevated px-3 py-3">
                  <div className="premium-lesson-kicker">记录表</div>
                  <div className="mt-3 space-y-2 text-xs">
                    {[0.5, 1, 2].map((gain) => {
                      const rowMetrics = computeL2BMetrics(gain);
                      const upperPole = rowMetrics.poles[0];
                      return (
                        <div key={gain} className="premium-lesson-tone-block premium-tone-orange rounded-xl px-3 py-2">
                          <div className="font-semibold">记录：K = {gain}</div>
                          <div className="mt-1">极点 s = {describePole(upperPole)}</div>
                          <div>虚部/实部之比 = {upperPole.im === 0 ? '0' : `${Math.abs(upperPole.im).toFixed(2)} / ${Math.abs(upperPole.re).toFixed(2)}`}</div>
                          <div>ζ = {formatRatio(rowMetrics.dampingRatio)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="premium-lesson-surface-elevated px-3 py-3 text-xs">
                  目标交点：<span className="font-semibold">s = -1 ± j1</span>，因此
                  <span className="font-semibold"> K = 2</span>。
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="premium-lesson-caption text-[11px]">sessionId = {sessionId}</div>
    </section>
  );
}
