'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  getUnit44NearestParetoPointId,
  getUnit44ParetoPoint,
  getUnit44ParetoPlotPoint,
  UNIT_4_4_GRADIENT_POINTS,
  UNIT_4_4_PARETO_DEFAULT_POINT_ID,
  UNIT_4_4_PARETO_FIGURE_LAYOUT,
  UNIT_4_4_PARETO_FRONT_POINTS,
  type Unit44ParetoPoint,
} from './figure-data';

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toPlotPoint(value: number, min: number, max: number, start: number, size: number, invert = false) {
  if (max === min) return start;
  const ratio = invert ? (max - value) / (max - min) : (value - min) / (max - min);
  return start + ratio * size;
}

export function GradientDescentNativeFigure({
  visiblePointCount,
  visibleSegmentCount,
  activePointIndex,
}: {
  visiblePointCount: number;
  visibleSegmentCount: number;
  activePointIndex: number;
}) {
  const width = 520;
  const height = 320;
  const padding = { top: 28, right: 28, bottom: 36, left: 44 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xMin = -0.25;
  const xMax = 4.4;
  const yMin = 0.8;
  const yMax = 12.5;
  const visiblePoints = UNIT_4_4_GRADIENT_POINTS.slice(
    0,
    clamp(visiblePointCount, 1, UNIT_4_4_GRADIENT_POINTS.length),
  );
  const visibleLinePoints = visiblePoints.slice(
    0,
    clamp(visibleSegmentCount + 1, 1, visiblePoints.length),
  );
  const activeIndex = clamp(activePointIndex, 0, UNIT_4_4_GRADIENT_POINTS.length - 1);
  const activePoint = visiblePoints[Math.min(activeIndex, visiblePoints.length - 1)];

  const curvePath = useMemo(() => {
    const samples = Array.from({ length: 80 }, (_, index) => {
      const x = xMin + (index / 79) * (xMax - xMin);
      const y = (x - 3) ** 2 + 1;
      const sx = toPlotPoint(x, xMin, xMax, padding.left, plotWidth);
      const sy = toPlotPoint(y, yMin, yMax, padding.top, plotHeight, true);
      return `${index === 0 ? 'M' : 'L'} ${sx.toFixed(2)} ${sy.toFixed(2)}`;
    });
    return samples.join(' ');
  }, [padding.left, padding.top, plotHeight, plotWidth, xMax, xMin, yMax, yMin]);

  const descentPath = useMemo(
    () =>
      visibleLinePoints.map((point, index) => {
        const x = toPlotPoint(point.x, xMin, xMax, padding.left, plotWidth);
        const y = toPlotPoint(point.fx, yMin, yMax, padding.top, plotHeight, true);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' '),
    [padding.left, padding.top, plotHeight, plotWidth, visibleLinePoints, xMax, xMin, yMax, yMin],
  );

  const xTicks = [0, 1, 2, 3, 4];
  const yTicks = [1, 4, 7, 10];

  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
      <div className="premium-lesson-kicker">Native Figure</div>
      <div className="premium-lesson-title mt-2 text-sm font-semibold">梯度下降原生示意图</div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full overflow-visible rounded-2xl border border-slate-200 bg-white">
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={padding.left} y1={height - padding.bottom} x2={padding.left} y2={padding.top} stroke="#94a3b8" strokeWidth="1.5" />
        <path d={curvePath} fill="none" stroke="#0f766e" strokeWidth="3" />
        {visibleSegmentCount > 0 ? (
          <path d={descentPath} fill="none" stroke="#f97316" strokeWidth="2.5" strokeDasharray="8 6" />
        ) : null}
        {xTicks.map((tick) => {
          const x = toPlotPoint(tick, xMin, xMax, padding.left, plotWidth);
          return (
            <g key={`x-tick-${tick}`}>
              <line x1={x} y1={height - padding.bottom} x2={x} y2={height - padding.bottom + 6} stroke="#94a3b8" strokeWidth="1" />
              <text x={x} y={height - padding.bottom + 20} textAnchor="middle" fontSize="12" fill="#475569">
                {tick}
              </text>
            </g>
          );
        })}
        {yTicks.map((tick) => {
          const y = toPlotPoint(tick, yMin, yMax, padding.top, plotHeight, true);
          return (
            <g key={`y-tick-${tick}`}>
              <line x1={padding.left - 6} y1={y} x2={padding.left} y2={y} stroke="#94a3b8" strokeWidth="1" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="12" fill="#475569">
                {tick}
              </text>
            </g>
          );
        })}
        {visiblePoints.map((point, index) => {
          const x = toPlotPoint(point.x, xMin, xMax, padding.left, plotWidth);
          const y = toPlotPoint(point.fx, yMin, yMax, padding.top, plotHeight, true);
          const active = index === activeIndex;
          return (
            <g key={`${point.x}-${point.fx}`}>
              <circle cx={x} cy={y} r={active ? 8 : 5} fill={active ? '#dc2626' : '#ea580c'} stroke="#fff" strokeWidth="2" />
              <text x={x + 10} y={y - 10} fontSize="12" fill="#334155">
                {`x_${index}`}
              </text>
            </g>
          );
        })}
        <text x={width - padding.right - 26} y={height - 10} fontSize="12" fill="#475569">
          x
        </text>
        <text x={12} y={padding.top + 4} fontSize="12" fill="#475569">
          f(x)
        </text>
      </svg>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">当前位置</div>
          <div className="mt-1">x = {activePoint.x.toFixed(4)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">当前代价值</div>
          <div className="mt-1">f(x) = {activePoint.fx.toFixed(6)}</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">谷底位置</div>
          <div className="mt-1">x* = 3, f(x*) = 1</div>
        </div>
      </div>
    </div>
  );
}

export function ParetoFrontNativeFigure({
  selectedPointId,
  onSelectPoint,
}: {
  selectedPointId: string;
  onSelectPoint: (pointId: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const { width, height, padding } = UNIT_4_4_PARETO_FIGURE_LAYOUT;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const path = useMemo(
    () =>
      UNIT_4_4_PARETO_FRONT_POINTS.map((point, index) => {
        const { x, y } = getUnit44ParetoPlotPoint(point);
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      }).join(' '),
    [],
  );

  const selectNearestPoint = (clientX: number, clientY: number, bounds: DOMRect) => {
    const scaleX = width / bounds.width;
    const scaleY = height / bounds.height;
    const pointer = {
      x: (clientX - bounds.left) * scaleX,
      y: (clientY - bounds.top) * scaleY,
    };
    onSelectPoint(getUnit44NearestParetoPointId(pointer));
  };

  useEffect(() => {
    if (!dragging) return undefined;
    const handlePointerUp = () => setDragging(false);
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, [dragging]);

  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
      <div className="premium-lesson-kicker">Native Figure</div>
      <div className="premium-lesson-title mt-2 text-sm font-semibold">主案例的 Pareto front</div>
      <div className="premium-lesson-muted mt-2 text-sm leading-6">拖动曲线上的候选点，右侧面板会同步显示同一组非支配候选的数据统计。</div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white"
        onPointerDown={(event) => {
          setDragging(true);
          selectNearestPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
        }}
        onPointerMove={(event) => {
          if (!dragging) return;
          selectNearestPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect());
        }}
      >
        <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="#94a3b8" strokeWidth="1.5" />
        <line x1={padding.left} y1={height - padding.bottom} x2={padding.left} y2={padding.top} stroke="#94a3b8" strokeWidth="1.5" />
        <path d={path} fill="none" stroke="#0f766e" strokeWidth="3" />
        {UNIT_4_4_PARETO_FRONT_POINTS.map((point) => {
          const { x, y } = getUnit44ParetoPlotPoint(point);
          const selected = point.id === selectedPointId;
          return (
            <g key={point.id}>
              <circle cx={x} cy={y} r={14} fill="transparent" />
              <circle cx={x} cy={y} r={selected ? 8 : 5} fill={selected ? '#dc2626' : '#0f766e'} stroke="#fff" strokeWidth="2" />
              {point.markerLabel ? (
                <text x={x + 10} y={y - 10} fontSize="12" fill="#334155">
                  {point.markerLabel}
                </text>
              ) : null}
            </g>
          );
        })}
        <text x={width - padding.right - 4} y={height - 12} textAnchor="end" fontSize="12" fill="#475569">
          控制能量 E_u
        </text>
        <text x={18} y={padding.top + 4} fontSize="12" fill="#475569">
          ITAE
        </text>
        <text x={padding.left} y={height - 12} fontSize="12" fill="#475569">
          小
        </text>
        <text x={width - padding.right - 40} y={height - 26} fontSize="12" fill="#475569">
          大
        </text>
        <text x={18} y={height - padding.bottom + 2} fontSize="12" fill="#475569">
          大
        </text>
        <text x={18} y={padding.top + 20} fontSize="12" fill="#475569">
          小
        </text>
      </svg>
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export function ParetoPointStatsPanel({
  pointId = UNIT_4_4_PARETO_DEFAULT_POINT_ID,
}: {
  pointId?: string;
}) {
  const point = getUnit44ParetoPoint(pointId);
  return <ParetoPointStatsPanelInner point={point} />;
}

export function ParetoPointStatsPanelInner({ point }: { point: Unit44ParetoPoint }) {
  return (
    <div className="premium-lesson-surface-elevated rounded-2xl px-4 py-4">
      <div className="premium-lesson-kicker">当前候选点统计</div>
      <div className="premium-lesson-title mt-2 text-sm font-semibold">{point.pointLabel}</div>
      <div className="premium-lesson-muted mt-2 text-sm leading-6">
        当前面板与左侧曲线共用同一组前沿数据，用来查看这一组非支配候选究竟在交换什么。
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <StatCell label="ITAE" value={point.itae.toFixed(3)} />
        <StatCell label="E_u" value={point.eu.toFixed(3)} />
        <StatCell label="调节时间 / s" value={point.ts.toFixed(1)} />
        <StatCell label="控制峰值" value={point.peak.toFixed(3)} />
        <StatCell label="K" value={point.K.toFixed(4)} />
        <StatCell label="T" value={point.T.toFixed(4)} />
        <StatCell label="αT" value={point.alphaT.toFixed(4)} />
      </div>
    </div>
  );
}
