'use client';

import { AlertTriangle, Smile } from 'lucide-react';
import type { VesselCruiseComfort } from '@/lib/control-engine/vessel-session';
import { SimPanelSection, SimReadout, SimReadoutGrid } from '../components/simulation-panels';
import { simulationScenePalette } from '../components/simulation-theme';

export interface CruiseMultiObjectiveMetrics {
  msiPercent: number | null;
  finWorkMj: number;
  propulsionWorkMj: number;
  wearIntegralDeg: number;
  maxFinAbsDeg: number;
  finSaturated: boolean;
  finFaultActive: boolean;
  stallOrFaultLabel: string;
}

/**
 * Derive passenger Motion Sickness Incidence (MSI) proxy, fin wear integral, and stall/fault lamp state.
 */
export function computeCruiseMultiObjectiveMetrics(input: {
  comfort: VesselCruiseComfort | null;
  finAnglesDeg?: [number, number];
  timeS?: number;
  finWearIntegralDeg?: number;
  finFaultLocked?: boolean;
}): CruiseMultiObjectiveMetrics {
  const { comfort, finAnglesDeg, finWearIntegralDeg = 0, finFaultLocked = false } = input;
  const passengerAccels =
    comfort?.passengers
      .map((item) => item.horizontalAccelerationRmsMps2)
      .filter((val): val is number => typeof val === 'number' && Number.isFinite(val)) ?? [];
  const effectiveAccel =
    passengerAccels.length > 0
      ? Math.max(...passengerAccels)
      : comfort?.rollRmsDeg != null
        ? comfort.rollRmsDeg * 0.035
        : null;

  const msiPercent =
    effectiveAccel === null
      ? null
      : Math.min(100, Math.max(0, 100 * (1 - Math.exp(-Math.pow(effectiveAccel / 0.55, 1.6)))));

  const finWorkMj = (comfort?.finServoElectricWorkJ ?? 0) / 1e6;
  const propulsionWorkMj = (comfort?.positivePropulsionWorkJ ?? 0) / 1e6;
  const maxFinAbsDeg = finAnglesDeg
    ? Math.max(Math.abs(finAnglesDeg[0]), Math.abs(finAnglesDeg[1]))
    : 0;
  const finSaturated = maxFinAbsDeg >= 22.5;
  const finFaultActive = Boolean(finFaultLocked);

  const stallOrFaultLabel = finFaultActive
    ? '左减摇鳍卡阻/冻结（t≥180s）'
    : finSaturated
      ? `减摇鳍达到限幅 ${maxFinAbsDeg.toFixed(1)}°（失速削顶警戒）`
      : '双减摇鳍工作在安全攻角区';

  return {
    msiPercent,
    finWorkMj,
    propulsionWorkMj,
    wearIntegralDeg: Math.max(0, finWearIntegralDeg),
    maxFinAbsDeg,
    finSaturated,
    finFaultActive,
    stallOrFaultLabel,
  };
}

export function CruiseComfortReadout({
  comfort,
  finAnglesDeg,
  timeS,
  finWearIntegralDeg,
  finFaultLocked,
}: {
  comfort: VesselCruiseComfort | null;
  finAnglesDeg?: [number, number];
  timeS?: number;
  finWearIntegralDeg?: number;
  finFaultLocked?: boolean;
}) {
  const rms = comfort?.rollRmsDeg;
  const angle = Math.min((rms ?? 0) / 6, 1) * Math.PI;
  const color =
    (comfort?.rollPeakDeg ?? 0) > 6 ? simulationScenePalette.danger : simulationScenePalette.success;
  const multiObj = computeCruiseMultiObjectiveMetrics({
    comfort,
    finAnglesDeg,
    timeS,
    finWearIntegralDeg,
    finFaultLocked,
  });
  const msiTone =
    multiObj.msiPercent === null
      ? 'bg-slate-400'
      : multiObj.msiPercent > 25
        ? 'bg-rose-500'
        : multiObj.msiPercent > 10
          ? 'bg-amber-500'
          : 'bg-emerald-500';
  const lampAlert = multiObj.finFaultActive || multiObj.finSaturated;

  return (
    <SimPanelSection title="教学舒适性代理与多目标权衡" icon={Smile}>
      <div className="relative mx-auto h-24 w-40">
        <svg viewBox="0 0 100 60" className="h-full w-full" aria-label="横摇均方根仪表" role="img">
          <path
            d="M10 50A40 40 0 0 1 90 50"
            fill="none"
            stroke={simulationScenePalette.neutralStroke}
            strokeWidth="8"
          />
          <line
            x1="50"
            y1="50"
            x2={50 + 30 * Math.cos(Math.PI - angle)}
            y2={50 - 30 * Math.sin(Math.PI - angle)}
            stroke={color}
            strokeWidth="3"
          />
          <circle cx="50" cy="50" r="4" fill={color} />
        </svg>
      </div>

      <div className="sim-hud-tile mb-3 space-y-2 p-2.5 text-xs" data-cruise-msi-meter>
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-platform-fg-primary">MSI 晕船率代理</span>
          <span className="font-mono font-semibold text-platform-fg-primary">
            {multiObj.msiPercent === null ? '等待有效窗口' : `${multiObj.msiPercent.toFixed(1)} %`}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-500/20">
          <div
            className={`h-full rounded-full transition-all ${msiTone}`}
            style={{ width: `${Math.min(100, multiObj.msiPercent ?? 0)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-platform-fg-secondary">
          <span>0% 舒适</span>
          <span>10%–25% 轻度晕动</span>
          <span>&gt;25% 高不适</span>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-platform-border-subtle pt-2">
          <div>
            <div className="text-[11px] text-platform-fg-secondary">鳍高频磨损积分</div>
            <div className="font-mono font-semibold text-platform-fg-primary">
              {multiObj.wearIntegralDeg.toFixed(0)}° · {multiObj.finWorkMj.toFixed(3)} MJ
            </div>
          </div>
          <div>
            <div className="text-[11px] text-platform-fg-secondary">当前最大鳍角</div>
            <div className="font-mono font-semibold text-platform-fg-primary">
              {multiObj.maxFinAbsDeg.toFixed(1)}° / 25.0°
            </div>
          </div>
        </div>

        <div
          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-[11px] ${
            lampAlert
              ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-200'
              : 'border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200'
          }`}
          data-cruise-fin-lamp
        >
          <span
            className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${
              lampAlert ? 'animate-pulse bg-rose-500' : 'bg-emerald-500'
            }`}
          />
          {lampAlert ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> : null}
          <span className="font-medium">{multiObj.stallOrFaultLabel}</span>
        </div>
      </div>

      <SimReadoutGrid>
        <SimReadout label="窗口横摇均方根" value={rms == null ? '等待有效窗口' : rms.toFixed(3)} unit="°" />
        <SimReadout label="窗口横摇峰值" value={comfort?.rollPeakDeg.toFixed(3) ?? '—'} unit="°" />
        <SimReadout label="横摇角速度均方根" value={comfort?.rollRateRmsDegS?.toFixed(3) ?? '—'} unit="°/s" />
        <SimReadout
          label="主推进正机械功"
          value={comfort ? (comfort.positivePropulsionWorkJ / 1e6).toFixed(2) : '—'}
          unit="MJ"
        />
        <SimReadout
          label="鳍伺服电能"
          value={comfort ? (comfort.finServoElectricWorkJ / 1e6).toFixed(3) : '—'}
          unit="MJ"
        />
      </SimReadoutGrid>
      <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">
        统计窗口{comfort?.statisticsWindowS[0] ?? 0}至{comfort?.statisticsWindowS[1] ?? 0}s，已覆盖
        {comfort?.durationS.toFixed(2) ?? '0'}s。 采用同一刚体的120Hz运动，记录未加权教学代理与实际能量。
      </p>
      {comfort?.passengers.map((point, index) => (
        <SimPanelSection key={index} title={`乘客点${index + 1}`}>
          <SimReadoutGrid>
            <SimReadout
              label="水平加速度均方根"
              value={point.horizontalAccelerationRmsMps2?.toFixed(4) ?? '—'}
              unit="m/s²"
            />
            <SimReadout
              label="水平加速度峰值"
              value={point.horizontalAccelerationPeakMps2.toFixed(4)}
              unit="m/s²"
            />
            <SimReadout
              label="加速度均方根"
              value={point.accelerationRmsMps2?.toFixed(4) ?? '—'}
              unit="m/s²"
            />
            <SimReadout label="加加速度均方根" value={point.jerkRmsMps3?.toFixed(4) ?? '—'} unit="m/s³" />
          </SimReadoutGrid>
          <p className="mt-1 text-xs text-platform-fg-secondary">
            船体坐标({point.positionBodyM.join('，')}
            )m，惯性加速度由质心加速度和角运动投影得到，比力包含重力转换。
          </p>
        </SimPanelSection>
      ))}
    </SimPanelSection>
  );
}
