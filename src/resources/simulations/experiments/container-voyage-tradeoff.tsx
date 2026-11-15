'use client';

import { AlertTriangle, Fuel, Gauge, Scale } from 'lucide-react';
import type { VesselSessionFrame } from '@/lib/control-engine/vessel-session';

export interface ContainerTradeoffMetrics {
  distanceM: number;
  progressPct: number;
  projectedEtaS: number | null;
  etaDeltaS: number | null;
  fuelKg: number;
  powerMw: number;
  cubicLoadRatio: number;
  rudderDeg: number;
  rudderSaturated: boolean;
  balanceNormalized: number; // -1 favors ETA speed, +1 favors SFOC fuel saving
}

const TARGET_VOYAGE_DISTANCE_M = 6000;
const TARGET_ETA_S = 900;
const NOMINAL_SPEED_MPS = 8;

/**
 * Compute voyage progress, projected ETA vs 900s limit, SFOC cubic fuel proxy, and rudder saturation.
 */
export function computeContainerTradeoffMetrics(input: {
  timeS: number;
  positionX: number;
  speedMps: number;
  powerW: number;
  fuelKg: number;
  rudderDeg: number;
  voyage?: VesselSessionFrame['containerVoyage'];
}): ContainerTradeoffMetrics {
  const distanceM = Math.max(0, input.voyage?.progress.northM ?? input.positionX);
  const progressPct = Math.min(100, Math.max(0, (distanceM / TARGET_VOYAGE_DISTANCE_M) * 100));
  const arrived = input.voyage?.progress.termination?.reason === 'arrived' || distanceM >= TARGET_VOYAGE_DISTANCE_M;
  const speedSafe = Math.max(1.0, Math.abs(input.speedMps));
  const remainingM = Math.max(0, TARGET_VOYAGE_DISTANCE_M - distanceM);
  const projectedEtaS = arrived
    ? input.timeS
    : input.speedMps > 0.3
      ? input.timeS + remainingM / speedSafe
      : null;
  const etaDeltaS = projectedEtaS !== null ? projectedEtaS - TARGET_ETA_S : null;
  const cubicLoadRatio = Math.pow(Math.max(0, input.speedMps) / NOMINAL_SPEED_MPS, 3);
  const rudderSaturated = Math.abs(input.rudderDeg) >= 34.5;

  // Balance: higher speed shifts needle toward ETA (-1), lower speed / lower power shifts toward SFOC (+1).
  const speedBias = Math.max(-1, Math.min(1, (NOMINAL_SPEED_MPS - input.speedMps) / 3.5));

  return {
    distanceM,
    progressPct,
    projectedEtaS,
    etaDeltaS,
    fuelKg: Math.max(0, input.fuelKg),
    powerMw: Math.max(0, input.powerW / 1e6),
    cubicLoadRatio,
    rudderDeg: input.rudderDeg,
    rudderSaturated,
    balanceNormalized: speedBias,
  };
}

export function ContainerVoyageTradeoff({
  timeS,
  positionX,
  speedMps,
  powerW,
  fuelKg,
  rudderDeg,
  voyage,
  compact = false,
}: {
  timeS: number;
  positionX: number;
  speedMps: number;
  powerW: number;
  fuelKg: number;
  rudderDeg: number;
  voyage?: VesselSessionFrame['containerVoyage'];
  compact?: boolean;
}) {
  const metrics = computeContainerTradeoffMetrics({
    timeS,
    positionX,
    speedMps,
    powerW,
    fuelKg,
    rudderDeg,
    voyage,
  });

  const etaStatusLabel =
    metrics.etaDeltaS === null
      ? '待起航测算'
      : metrics.etaDeltaS <= 0
        ? `提前 ${Math.abs(metrics.etaDeltaS).toFixed(0)}s（达标）`
        : `预计超时 +${metrics.etaDeltaS.toFixed(0)}s`;

  const etaDanger = metrics.etaDeltaS !== null && metrics.etaDeltaS > 0;
  const needlePct = ((metrics.balanceNormalized + 1) / 2) * 100;

  return (
    <div
      className={compact ? 'sim-hud-tile space-y-2 p-2.5 text-xs' : 'sim-hud-tile mt-2.5 space-y-2.5 p-3 text-xs'}
      data-container-tradeoff-hud
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold text-platform-fg-primary">
          <Scale className="size-3.5 text-cyan-500" aria-hidden="true" />
          <span>ETA 900s ↔ SFOC 立方油耗权衡天平</span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            etaDanger
              ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          }`}
        >
          {etaStatusLabel}
        </span>
      </div>

      {/* 6000m 四段航程条 */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[11px] text-platform-fg-secondary">
          <span>6000 m 四段航程进度</span>
          <span className="font-mono tabular-nums">
            {metrics.distanceM.toFixed(0)} / 6000 m（{metrics.progressPct.toFixed(1)}%）
          </span>
        </div>
        <div className="relative grid h-2 grid-cols-4 gap-0.5 overflow-hidden rounded-full bg-platform-fg-primary/10">
          <div
            className="col-span-4 h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-[width] duration-300"
            style={{ width: `${metrics.progressPct}%` }}
          />
        </div>
      </div>

      {/* 双轴权衡天平 */}
      <div className="space-y-1 rounded-md border border-platform-border/70 bg-background/40 p-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="inline-flex items-center gap-1 text-cyan-700 dark:text-cyan-300">
            <Gauge className="size-3" aria-hidden="true" />
            <span>准点优先（ETA ≤ 900s）</span>
          </span>
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
            <span>节油优先（SFOC ∝ V³）</span>
            <Fuel className="size-3" aria-hidden="true" />
          </span>
        </div>
        <div className="relative h-2.5 rounded-full bg-gradient-to-r from-cyan-500/35 via-emerald-500/35 to-amber-500/35">
          <div
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-primary shadow"
            style={{ left: `${needlePct}%` }}
            aria-label="准点与能耗天平指示器"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-platform-fg-secondary">
          <span>
            预计到达：
            <strong className="ml-1 font-mono text-platform-fg-primary">
              {metrics.projectedEtaS !== null ? `${metrics.projectedEtaS.toFixed(1)} s` : '—'}
            </strong>
          </span>
          <span>
            立方功率因子：
            <strong className="ml-1 font-mono text-platform-fg-primary">
              {metrics.cubicLoadRatio.toFixed(2)}×
            </strong>
          </span>
          <span>
            累计燃油：
            <strong className="ml-1 font-mono text-platform-fg-primary">
              {metrics.fuelKg.toFixed(1)} kg
            </strong>
          </span>
        </div>
      </div>

      {metrics.rudderSaturated ? (
        <div
          role="status"
          data-rudder-saturation-alert
          className="sim-panel-notice flex items-start gap-2 rounded-md border border-rose-500/45 bg-rose-500/12 px-2.5 py-1.5 text-[11px] text-rose-800 dark:text-rose-200"
          data-sim-tone="danger"
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-rose-500" aria-hidden="true" />
          <span>
            ⚠️ 35° 满舵饱和掉速（当前舵角 {metrics.rudderDeg.toFixed(1)}°）：大舵角诱导阻力激增并拖慢航速，请检查推进功耗与 ETA 偏差。
          </span>
        </div>
      ) : null}
    </div>
  );
}
