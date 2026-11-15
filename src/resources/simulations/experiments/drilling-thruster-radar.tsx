'use client';

import { AlertTriangle, Compass, Zap } from 'lucide-react';
import type { ThrusterState } from '../core/types';

export type DrillingThrusterReading = ThrusterState & {
  rpm?: number;
  positionBodyM?: [number, number, number];
};

export interface DrillingThrusterSummary {
  totalPowerMw: number;
  powerCapMw: number;
  powerRatio: number;
  failedIds: number[];
  t2Failed: boolean;
  activeCount: number;
}

const DEFAULT_THRUSTER_COORDS: Record<number, { x: number; y: number; column: string }> = {
  1: { x: 64, y: 72, column: '左艏柱' },
  2: { x: 64, y: 168, column: '左艉柱' },
  3: { x: 90, y: 98, column: '左舯前' },
  4: { x: 90, y: 142, column: '左舯后' },
  5: { x: 176, y: 72, column: '右艏柱' },
  6: { x: 176, y: 168, column: '右艉柱' },
  7: { x: 150, y: 98, column: '右舯前' },
  8: { x: 150, y: 142, column: '右舯后' },
};

// Adjacent column wake forbidden radial sectors around platform columns (deg).
const WAKE_FORBIDDEN_SECTORS = [
  { id: 'port-fwd', cx: 64, cy: 72, startDeg: 115, endDeg: 165, label: '邻柱尾流禁区' },
  { id: 'port-aft', cx: 64, cy: 168, startDeg: 195, endDeg: 245, label: '邻柱尾流禁区' },
  { id: 'stbd-fwd', cx: 176, cy: 72, startDeg: 15, endDeg: 65, label: '邻柱尾流禁区' },
  { id: 'stbd-aft', cx: 176, cy: 168, startDeg: 295, endDeg: 345, label: '邻柱尾流禁区' },
];

function sectorPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const s = ((startDeg - 90) * Math.PI) / 180;
  const e = ((endDeg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(s);
  const y1 = cy + r * Math.sin(s);
  const x2 = cx + r * Math.cos(e);
  const y2 = cy + r * Math.sin(e);
  const largeArc = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${largeArc} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}

export function analyzeDrillingThrusters(
  thrusters: DrillingThrusterReading[],
  totalPowerW?: number,
): DrillingThrusterSummary {
  const sumKw = thrusters.reduce((acc, item) => acc + (item.failed ? 0 : Math.max(0, item.power)), 0);
  const totalPowerMw =
    typeof totalPowerW === 'number' && Number.isFinite(totalPowerW) && totalPowerW > 0
      ? totalPowerW / 1e6
      : sumKw / 1000;
  const powerCapMw = 32;
  const failedIds = thrusters.filter((item) => item.failed).map((item) => item.id);
  return {
    totalPowerMw,
    powerCapMw,
    powerRatio: Math.min(1.2, totalPowerMw / powerCapMw),
    failedIds,
    t2Failed: failedIds.includes(2),
    activeCount: Math.max(0, thrusters.length - failedIds.length),
  };
}

export function DrillingThrusterRadar({
  thrusters,
  totalPowerW,
  normalizedResidual,
  timeS,
}: {
  thrusters: DrillingThrusterReading[];
  totalPowerW?: number;
  normalizedResidual?: number | null;
  timeS: number;
}) {
  const summary = analyzeDrillingThrusters(thrusters, totalPowerW);
  const powerPct = Math.min(100, summary.powerRatio * 100);
  const powerHigh = summary.totalPowerMw >= 28;
  const powerCritical = summary.totalPowerMw >= 31.2;

  return (
    <div className="sim-hud-tile space-y-2.5 p-2.5 text-xs" data-drilling-thruster-radar>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-platform-fg-primary">
          <Compass className="size-3.5 text-cyan-500" aria-hidden="true" />
          <span>8 推进器极坐标推力分配与立柱尾流禁区</span>
        </span>
        <span className="font-mono text-[11px] text-platform-fg-secondary">
          在线 {summary.activeCount}/{thrusters.length || 8}
        </span>
      </div>

      <div className="relative mx-auto w-full max-w-[15.5rem]">
        <svg viewBox="0 0 240 240" className="h-auto w-full" role="img" aria-label="海洋石油981八推力器极坐标矢量雷达图">
          {/* 极坐标距离参考环 */}
          <circle cx="120" cy="120" r="98" fill="none" stroke="currentColor" strokeOpacity="0.16" strokeDasharray="3 3" />
          <circle cx="120" cy="120" r="64" fill="none" stroke="currentColor" strokeOpacity="0.14" strokeDasharray="2 3" />
          {/* 十字罗经线 */}
          <line x1="120" y1="14" x2="120" y2="226" stroke="currentColor" strokeOpacity="0.16" />
          <line x1="14" y1="120" x2="226" y2="120" stroke="currentColor" strokeOpacity="0.16" />
          <text x="120" y="13" textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.65">船艏 N</text>

          {/* 邻柱尾流禁区红色扇区 */}
          {WAKE_FORBIDDEN_SECTORS.map((sector) => (
            <path
              key={sector.id}
              d={sectorPath(sector.cx, sector.cy, 34, sector.startDeg, sector.endDeg)}
              fill="rgba(239, 68, 68, 0.16)"
              stroke="rgba(239, 68, 68, 0.55)"
              strokeWidth="0.9"
            />
          ))}

          {/* 半潜式平台外框与四立柱 */}
          <rect
            x="56"
            y="58"
            width="128"
            height="124"
            rx="16"
            fill="rgba(14, 165, 233, 0.06)"
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="1.2"
          />
          {[
            [64, 72],
            [176, 72],
            [64, 168],
            [176, 168],
          ].map(([px, py], idx) => (
            <circle key={idx} cx={px} cy={py} r="10" fill="rgba(148, 163, 184, 0.2)" stroke="currentColor" strokeOpacity="0.4" />
          ))}

          {/* 8 推力器方位与推力矢量箭头 */}
          {thrusters.map((thruster) => {
            const coord = DEFAULT_THRUSTER_COORDS[thruster.id];
            if (!coord) return null;
            const azRad = ((thruster.azimuth - 90) * Math.PI) / 180;
            const magPx = thruster.failed
              ? 0
              : Math.max(10, Math.min(34, (Math.abs(thruster.thrust || 0) / 150) * 32));
            const tx = coord.x + magPx * Math.cos(azRad);
            const ty = coord.y + magPx * Math.sin(azRad);
            const isT2Reallocated = summary.t2Failed && !thruster.failed;
            const strokeColor = thruster.failed ? '#ef4444' : isT2Reallocated ? '#f59e0b' : '#06b6d4';

            return (
              <g key={thruster.id} data-radar-thruster={thruster.id}>
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r={thruster.failed ? 6.5 : 5}
                  fill={thruster.failed ? 'rgba(239, 68, 68, 0.25)' : strokeColor}
                  stroke={strokeColor}
                  strokeWidth={thruster.failed ? 2 : 1.2}
                />
                {!thruster.failed ? (
                  <line
                    x1={coord.x}
                    y1={coord.y}
                    x2={tx}
                    y2={ty}
                    stroke={strokeColor}
                    strokeWidth={isT2Reallocated ? 2.4 : 1.8}
                    strokeLinecap="round"
                  />
                ) : (
                  <path
                    d={`M${coord.x - 4},${coord.y - 4} L${coord.x + 4},${coord.y + 4} M${coord.x + 4},${coord.y - 4} L${coord.x - 4},${coord.y + 4}`}
                    stroke="#ef4444"
                    strokeWidth="2"
                  />
                )}
                <text
                  x={coord.x}
                  y={coord.y + (thruster.id % 2 === 0 ? 15 : -9)}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight={thruster.failed || isT2Reallocated ? 700 : 500}
                  fill={thruster.failed ? '#ef4444' : 'currentColor'}
                >
                  T{thruster.id}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-1 flex flex-wrap justify-center gap-3 text-[10px] text-platform-fg-muted">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-rose-500/70" /> 立柱尾流禁区
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-cyan-500" /> 正常分配矢量
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block size-2 rounded-full bg-amber-500" /> 断桨重分配增载
          </span>
        </div>
      </div>

      {/* 32 MW 总功率封顶条 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-platform-fg-secondary">
            <Zap className="size-3 text-amber-500" aria-hidden="true" />
            <span>电站总功封顶（32 MW）</span>
          </span>
          <span
            className={`font-mono font-semibold tabular-nums ${
              powerCritical
                ? 'text-rose-600 dark:text-rose-300'
                : powerHigh
                  ? 'text-amber-600 dark:text-amber-300'
                  : 'text-platform-fg-primary'
            }`}
          >
            {summary.totalPowerMw.toFixed(2)} / 32.00 MW
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-platform-fg-primary/10">
          <div
            className={`h-full rounded-full transition-[width] duration-300 ${
              powerCritical ? 'bg-rose-500' : powerHigh ? 'bg-amber-500' : 'bg-cyan-500'
            }`}
            style={{ width: `${powerPct}%` }}
          />
        </div>
      </div>

      {summary.t2Failed ? (
        <div
          role="status"
          data-t2-fault-active
          className="sim-panel-notice flex items-start gap-2 rounded-md border border-rose-500/50 bg-rose-500/15 px-2.5 py-2 text-[11px] text-rose-900 dark:text-rose-100"
          data-sim-tone="danger"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rose-500" aria-hidden="true" />
          <span>
            T2 推进器于 t={timeS >= 180 ? '180.0' : timeS.toFixed(1)}s 发生断桨停机：其余 7 推已进入在线重分配并避让邻柱尾流禁区
            {typeof normalizedResidual === 'number' ? `（分配残差 ${normalizedResidual.toFixed(4)}）` : ''}。
          </span>
        </div>
      ) : null}
    </div>
  );
}
