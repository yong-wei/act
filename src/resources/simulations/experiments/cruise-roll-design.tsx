'use client';

import { useMemo } from 'react';
import type { VesselCruiseFinInput } from '@/lib/control-engine/vessel-session';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import type { FrozenVesselStudentModel } from './student-analysis';
import { cruiseStudentRollModel, type CruiseCourseSettings } from './cruise-course';

interface RollDesign {
  angleGainNmRad: number;
  rateGainNmSRad: number;
  naturalFrequencyRadS: number;
  dampingRatio: number;
  bins: Array<{ frequencyHz: number; openAmplitudeDegPerMNm: number; closedAmplitudeDegPerMNm: number }>;
}

function freqToSvgX(hz: number): number {
  const safeHz = Math.max(0.01, Math.min(1.0, hz));
  const ratio = (Math.log10(safeHz) + 2) / 2;
  return 30 + 270 * Math.max(0, Math.min(1, ratio));
}

export function CruiseRollDesign({
  model,
  settings,
}: {
  model: FrozenVesselStudentModel | undefined;
  settings: CruiseCourseSettings;
}) {
  const result = useMemo(() => {
    if (!model) return null;
    try {
      const input: VesselCruiseFinInput = {
        enabled: true,
        model: cruiseStudentRollModel(model),
        dampingRatio: settings.dampingRatio,
        stiffnessFraction: settings.stiffnessFraction,
        lowPassCutoffHz: settings.lowPassCutoffHz,
        notch: settings.notchEnabled
          ? { centerHz: settings.notchCenterHz, bandwidthHz: settings.notchBandwidthHz }
          : null,
      };
      return {
        design: computeVirtualSimulationStep<RollDesign>({
          modelId: 'student_model_analysis',
          operation: 'roll_design',
          input,
        }),
        error: '',
      };
    } catch (error) {
      return { design: null, error: error instanceof Error ? error.message : '请核对本人横摇模型。' };
    }
  }, [
    model,
    settings.dampingRatio,
    settings.stiffnessFraction,
    settings.lowPassCutoffHz,
    settings.notchEnabled,
    settings.notchCenterHz,
    settings.notchBandwidthHz,
  ]);
  if (!result) return null;
  if (!result.design)
    return (
      <p role="status" className="text-xs text-platform-fg-secondary">
        {result.error}
      </p>
    );
  const design = result.design;
  const peak = Math.max(
    ...design.bins.map((bin) => Math.max(bin.openAmplitudeDegPerMNm, bin.closedAmplitudeDegPerMNm)),
  );
  const line = (closed: boolean) =>
    design.bins
      .map(
        (bin, index) =>
          `${30 + (270 * index) / (design.bins.length - 1)},${
            115 -
            (95 * (closed ? bin.closedAmplitudeDegPerMNm : bin.openAmplitudeDegPerMNm)) /
              Math.max(peak, 1e-12)
          }`,
      )
      .join(' ');

  const notchCenter = settings.notchEnabled && Number.isFinite(settings.notchCenterHz) ? settings.notchCenterHz : null;
  const halfBw = Number.isFinite(settings.notchBandwidthHz) ? settings.notchBandwidthHz / 2 : 0.03;
  const stopband =
    notchCenter !== null
      ? {
          xLow: freqToSvgX(Math.max(0.01, notchCenter - halfBw)),
          xHigh: freqToSvgX(Math.min(1.0, notchCenter + halfBw)),
          xCenter: freqToSvgX(notchCenter),
          centerHz: notchCenter,
          outOfBand: notchCenter > 1.0,
        }
      : null;

  return (
    <div className="space-y-2 rounded border border-platform-border p-2">
      <p className="text-xs leading-5 text-platform-fg-secondary">
        本人模型设计初值，角度反馈增益{(design.angleGainNmRad / 1e6).toFixed(3)}MN·m/rad， 角速度反馈增益
        {(design.rateGainNmSRad / 1e6).toFixed(3)}MN·m·s/rad，理想闭环阻尼比{design.dampingRatio.toFixed(3)}。
      </p>
      <svg
        viewBox="0 0 320 145"
        role="img"
        aria-label="本人横摇模型开环与理想闭环幅频响应"
        className="w-full"
      >
        <path d="M30 15V115H304" fill="none" stroke="currentColor" opacity=".4" />
        {stopband ? (
          <g data-cruise-notch-stopband>
            {!stopband.outOfBand ? (
              <rect
                x={stopband.xLow}
                y={15}
                width={Math.max(3, stopband.xHigh - stopband.xLow)}
                height={100}
                fill="#ef4444"
                fillOpacity={0.14}
                stroke="#ef4444"
                strokeOpacity={0.45}
                strokeWidth={0.8}
                strokeDasharray="3 2"
              />
            ) : null}
            <line
              x1={stopband.xCenter}
              y1={15}
              x2={stopband.xCenter}
              y2={115}
              stroke="#ef4444"
              strokeWidth={1.3}
              strokeDasharray="4 3"
              opacity={0.85}
            />
            <text
              x={stopband.xCenter > 215 ? stopband.xCenter - 4 : stopband.xCenter + 4}
              y={25}
              textAnchor={stopband.xCenter > 215 ? 'end' : 'start'}
              fontSize="8.5"
              fontWeight="600"
              fill="#ef4444"
            >
              陷波中心 {stopband.centerHz.toFixed(2)} Hz
            </text>
          </g>
        ) : null}
        <polyline points={line(false)} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
        <polyline points={line(true)} fill="none" stroke="#22d3ee" strokeWidth="1.5" />
        <text x="30" y="132" fontSize="9" fill="currentColor">
          0.01
        </text>
        <text x="160" y="132" fontSize="9" fill="currentColor">
          0.1
        </text>
        <text x="265" y="132" fontSize="9" fill="currentColor">
          1 Hz
        </text>
      </svg>
      <p className="text-xs leading-5 text-platform-fg-secondary">
        橙色为本人局部模型，青色为理想力矩反馈
        {settings.notchEnabled ? `，红色虚线区为陷波停带（带宽 ${settings.notchBandwidthHz.toFixed(2)} Hz）` : ''}
        ，幅值单位°/(MN·m)，频率为对数坐标。理想响应假设线性横摇、无限力矩和零测量时延，实际鳍能力、滤波、耦合及能量以运行记录为依据。
      </p>
    </div>
  );
}
