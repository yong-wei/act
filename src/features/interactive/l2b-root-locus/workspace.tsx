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
        <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">反馈框图认知卡</h2>
        <p className="premium-lesson-muted mt-2">
          step-06 不再强行复用根轨迹工作区，而是直接把“开环旋钮”和“闭环结果”的关系摆成一张可读的结构图。
        </p>
      </div>

      <div className="rounded-[28px] border border-sky-200 bg-white px-4 py-4">
        <svg viewBox="0 0 540 240" className="w-full">
          <defs>
            <marker id="arrow-head" markerWidth="10" markerHeight="8" refX="8" refY="4" orient="auto">
              <path d="M0,0 L10,4 L0,8 Z" fill="#0f766e" />
            </marker>
          </defs>
          <path d="M40 120 H120" stroke="#0f766e" strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <circle cx="145" cy="120" r="16" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
          <path d="M145 104 V136 M129 120 H161" stroke="#0f172a" strokeWidth="2" />
          <path d="M161 120 H220" stroke="#0f766e" strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <rect x="220" y="88" width="84" height="64" rx="18" fill="#ecfeff" stroke="#06b6d4" strokeWidth="2" />
          <text x="262" y="114" textAnchor="middle" className="fill-slate-900 text-[13px] font-semibold">
            控制器
          </text>
          <text x="262" y="134" textAnchor="middle" className="fill-cyan-700 text-[15px] font-semibold">
            [K]
          </text>
          <path d="M304 120 H368" stroke="#0f766e" strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <rect x="368" y="88" width="104" height="64" rx="18" fill="#eff6ff" stroke="#60a5fa" strokeWidth="2" />
          <text x="420" y="114" textAnchor="middle" className="fill-slate-900 text-[13px] font-semibold">
            船舶对象
          </text>
          <text x="420" y="134" textAnchor="middle" className="fill-sky-700 text-[15px] font-semibold">
            [G(s)]
          </text>
          <path d="M472 120 H516" stroke="#0f766e" strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <path d="M500 120 V192 H160 V136" stroke="#f59e0b" strokeWidth="3" markerEnd="url(#arrow-head)" fill="none" />
          <rect x="330" y="176" width="104" height="42" rx="16" fill="#fff7ed" stroke="#fb923c" strokeWidth="2" />
          <text x="382" y="201" textAnchor="middle" className="fill-orange-700 text-[13px] font-semibold">
            [H(s)] 反馈传感器
          </text>
          <text x="58" y="108" className="fill-slate-600 text-[13px]">
            输入 r
          </text>
          <text x="494" y="108" className="fill-slate-600 text-[13px]">
            输出 y
          </text>
          <text x="262" y="74" textAnchor="middle" className="fill-cyan-700 text-[13px] font-semibold">
            开环增益（旋钮）
          </text>
          <text x="420" y="74" textAnchor="middle" className="fill-sky-700 text-[13px] font-semibold">
            闭环极点（结果）
          </text>
        </svg>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
          <div className="font-semibold">开环增益（旋钮）</div>
          <p className="mt-2 leading-6">你实际去调的是控制器前面的 K，它决定输入信号被放大多少。</p>
        </div>
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <div className="font-semibold">闭环极点（结果）</div>
          <p className="mt-2 leading-6">真正决定响应快慢与超调的，是回路闭合后整个系统的闭环极点。</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
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
          <h2 className="mt-1 text-lg font-semibold text-slate-900 sm:text-xl">根轨迹工作区</h2>
          <p className="premium-lesson-muted">
            {currentStepTitle} · K = {localState.gain.toFixed(2)} · {readOnly ? '广播视图' : role === 'teacher' ? '教师控制' : '独立探索'}
          </p>
        </div>
        <div className="premium-lesson-chip">45°射线：{localState.showRay45 ? '开启' : '关闭'}</div>
      </div>

      {showBroadcastNote ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <div className="font-semibold">{readOnly ? '教师广播中' : '轮到你了'}</div>
          <p className="mt-2 leading-6">
            {readOnly
              ? '当前正在跟随教师演示。先边看边记，等教师点击“切换到学生自主模式”后再自己拖动。'
              : '拖动滑块，找到极点分叉的 K 值，再比较 K = 1 / 2 / 5 时的超调与调节时间。'}
          </p>
        </div>
      ) : null}

      <div className="premium-lesson-panel-soft space-y-4">
        <label className="block text-sm text-slate-700">
          <span className="mb-2 block font-medium text-slate-900">增益滑块 K</span>
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
            className="rounded-full border border-cyan-200 px-3 py-2 text-xs text-cyan-700"
            disabled={readOnly}
          >
            {localState.showRay45 ? '关闭 45°射线' : '打开 45°射线'}
          </button>
          {currentStepId === 'pole-drag-demo' && role === 'teacher' ? (
            <button
              type="button"
              onClick={() => updateState({ studentUnlocked: !localState.studentUnlocked })}
              className="rounded-full border border-emerald-200 px-3 py-2 text-xs text-emerald-700"
            >
              切换到学生自主模式
            </button>
          ) : null}
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <div className="rounded-[24px] border border-slate-200 bg-white px-3 py-3">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>复平面：根轨迹地图</span>
              <span>点击轨迹可选点</span>
            </div>
            <svg viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`} className="w-full">
              {showPerformanceZones ? (
                <>
                  <rect x="80" y="82" width="70" height="76" rx="20" fill="#dcfce7" fillOpacity="0.9" />
                  <rect x="138" y="54" width="72" height="132" rx="22" fill="#cffafe" fillOpacity="0.92" />
                  <rect x="210" y="26" width="68" height="188" rx="22" fill="#fef3c7" fillOpacity="0.95" />
                </>
              ) : null}
              <line x1={0} x2={SVG_WIDTH} y1={SVG_HEIGHT / 2} y2={SVG_HEIGHT / 2} stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1={toSvgPointX(0, SVG_WIDTH)} x2={toSvgPointX(0, SVG_WIDTH)} y1={0} y2={SVG_HEIGHT} stroke="#ef4444" strokeDasharray="5 5" strokeWidth="1.2" />
              {localState.showRay45 || showRayPanel ? (
                <>
                  <line
                    x1={toSvgPointX(0, SVG_WIDTH)}
                    y1={toSvgPointY(0, SVG_HEIGHT)}
                    x2={toSvgPointX(-2.8, SVG_WIDTH)}
                    y2={toSvgPointY(2.8, SVG_HEIGHT)}
                    stroke="#f97316"
                    strokeDasharray="6 5"
                    strokeWidth="1.8"
                  />
                  <line
                    x1={toSvgPointX(0, SVG_WIDTH)}
                    y1={toSvgPointY(0, SVG_HEIGHT)}
                    x2={toSvgPointX(-2.8, SVG_WIDTH)}
                    y2={toSvgPointY(-2.8, SVG_HEIGHT)}
                    stroke="#f97316"
                    strokeDasharray="6 5"
                    strokeWidth="1.8"
                  />
                  <text x={toSvgPointX(-0.35, SVG_WIDTH)} y={toSvgPointY(0.35, SVG_HEIGHT) - 8} className="fill-orange-600 text-[11px] font-semibold">
                    45°
                  </text>
                </>
              ) : null}
              <polyline fill="none" stroke="#06b6d4" strokeWidth="3" points={rootLocusPath.upper.join(' ')} />
              <polyline fill="none" stroke="#06b6d4" strokeWidth="3" points={rootLocusPath.lower.join(' ')} />
              <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={rootLocusPath['real-left'].join(' ')} />
              <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={rootLocusPath['real-right'].join(' ')} />
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
                            fill={isSelected ? '#f97316' : '#0ea5e9'}
                            fillOpacity={isSelected ? 0.95 : 0.82}
                          />
                          <circle
                            cx={toSvgPointX(sample.pole.re, SVG_WIDTH)}
                            cy={toSvgPointY(-sample.pole.im, SVG_HEIGHT)}
                            r={isSelected ? 9 : 7}
                            fill={isSelected ? '#f97316' : '#0ea5e9'}
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
                fill="#22d3ee"
                stroke="#083344"
                strokeWidth="2"
              />
              <circle
                cx={toSvgPointX(metrics.poles[1].re, SVG_WIDTH)}
                cy={toSvgPointY(metrics.poles[1].im, SVG_HEIGHT)}
                r={9}
                fill="#f59e0b"
                stroke="#7c2d12"
                strokeWidth="2"
              />
              <text x={18} y={22} className="fill-slate-500 text-[11px]">
                jω
              </text>
              <text x={SVG_WIDTH - 28} y={SVG_HEIGHT / 2 - 8} className="fill-slate-500 text-[11px]">
                σ
              </text>
            </svg>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white px-3 py-3">
            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
              <span>时域响应曲线</span>
              <span>调节时间≈4s</span>
            </div>
            <svg viewBox={`0 0 ${SVG_WIDTH} 200`} className="w-full">
              <line x1={0} x2={SVG_WIDTH} y1={180} y2={180} stroke="#cbd5e1" strokeWidth="1.2" />
              <line x1={0} x2={SVG_WIDTH} y1={60} y2={60} stroke="#bae6fd" strokeDasharray="4 4" />
              <path d={responsePath} fill="none" stroke="#14b8a6" strokeWidth="3" />
              <text x={6} y={22} className="fill-slate-500 text-[11px]">
                y(t)
              </text>
              <text x={SVG_WIDTH - 34} y={194} className="fill-slate-500 text-[11px]">
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
        <div className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          极点：{metrics.poles.map((pole) => describePole(pole)).join(' / ')}
        </div>
      </div>

      {showBroadcastNote ? (
        <section className="rounded-[24px] border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm text-cyan-900">
          <div className="font-semibold">教师演示关键数据</div>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="text-cyan-700">
                <tr>
                  <th className="pb-2 pr-4 font-medium">K</th>
                  <th className="pb-2 pr-4 font-medium">极点</th>
                  <th className="pb-2 pr-4 font-medium">超调</th>
                  <th className="pb-2 font-medium">调节时间</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                {[
                  { gain: 1, label: 'K = 1' },
                  { gain: 2, label: 'K = 2' },
                  { gain: 5, label: 'K = 5' },
                ].map((row) => {
                  const rowMetrics = computeL2BMetrics(row.gain);
                  return (
                    <tr key={row.label} className="border-t border-cyan-100">
                      <td className="py-2 pr-4 font-semibold text-cyan-700">{row.label}</td>
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
          <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
            <div className="font-semibold">轨迹选点信息</div>
            <p className="mt-2 leading-6">
              {selectedSample
                ? `你当前选择了 ${describePole(selectedSample.pole)}，对应 K ≈ ${selectedSample.gain.toFixed(2)}。`
                : '点击根轨迹上的圆点，直接把“地图上的位置”转成 K、极点和性能信息。'}
            </p>
            <div className="mt-3 space-y-2 text-xs text-amber-800">
              <div>极点 s ≈ {selectedSample ? describePole(selectedSample.pole) : describePole(metrics.poles[0])}</div>
              <div>对应 K ≈ {(selectedSample?.gain ?? localState.gain).toFixed(2)}</div>
              <div>预估超调 ≈ {formatPercent(selectedMetrics.overshoot)}</div>
              <div>预估调节时间 ≈ {formatSeconds(selectedMetrics.settlingTime)}</div>
            </div>
          </div>

          {showRayPanel ? (
            <div className="rounded-[24px] border border-orange-200 bg-orange-50 px-4 py-4 text-sm text-orange-900">
              <div className="font-semibold">45° 射线几何定位</div>
              <p className="mt-2 leading-6">ζ = cos θ，所以当目标 ζ = 0.707 时，θ = 45°，射线与根轨迹交点就是最佳阻尼点。</p>
              <div className="mt-3 space-y-3">
                <div className="rounded-2xl border border-orange-100 bg-white px-3 py-3">
                  <div className="text-xs uppercase tracking-[0.2em] text-orange-500">记录表</div>
                  <div className="mt-3 space-y-2 text-xs text-slate-700">
                    {[0.5, 1, 2].map((gain) => {
                      const rowMetrics = computeL2BMetrics(gain);
                      const upperPole = rowMetrics.poles[0];
                      return (
                        <div key={gain} className="rounded-xl border border-orange-100 px-3 py-2">
                          <div className="font-semibold text-orange-700">记录：K = {gain}</div>
                          <div className="mt-1">极点 s = {describePole(upperPole)}</div>
                          <div>虚部/实部之比 = {upperPole.im === 0 ? '0' : `${Math.abs(upperPole.im).toFixed(2)} / ${Math.abs(upperPole.re).toFixed(2)}`}</div>
                          <div>ζ = {formatRatio(rowMetrics.dampingRatio)}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-2xl border border-orange-100 bg-white px-3 py-3 text-xs text-slate-700">
                  目标交点：<span className="font-semibold text-orange-700">s = -1 ± j1</span>，因此
                  <span className="font-semibold text-orange-700"> K = 2</span>。
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="text-[11px] text-slate-400">sessionId = {sessionId}</div>
    </section>
  );
}
