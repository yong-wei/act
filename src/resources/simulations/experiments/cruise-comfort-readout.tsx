'use client';

import { Smile } from 'lucide-react';
import type { VesselCruiseComfort } from '@/lib/control-engine/vessel-session';
import { SimPanelSection, SimReadout, SimReadoutGrid } from '../components/simulation-panels';
import { simulationScenePalette } from '../components/simulation-theme';

export function CruiseComfortReadout({ comfort }: { comfort: VesselCruiseComfort | null }) {
  const rms = comfort?.rollRmsDeg;
  const angle = Math.min((rms ?? 0) / 6, 1) * Math.PI;
  const color =
    (comfort?.rollPeakDeg ?? 0) > 6 ? simulationScenePalette.danger : simulationScenePalette.success;
  return (
    <SimPanelSection title="教学舒适性代理" icon={Smile}>
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
