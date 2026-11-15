'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import { SimField } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';

interface Spectrum {
  resolutionHz: number;
  peakFrequencyHz: number | null;
  bins: Array<{ frequencyHz: number; amplitude: number }>;
}

export function CruiseRollSpectrum({
  run,
  startS,
  endS,
}: {
  run: VesselRunEvidence;
  startS: number;
  endS: number;
}) {
  const [channel, setChannel] = useState<'roll' | 'rate' | 'wave'>('roll');
  const [result, setResult] = useState<{ source: string; spectrum: Spectrum } | null>(null);
  const [message, setMessage] = useState('');
  const source = JSON.stringify([run.id, run.lastTimeS, startS, endS, channel]);
  const spectrum = result?.source === source ? result.spectrum : null;
  const unit = channel === 'wave' ? 'MN·m' : channel === 'rate' ? '°/s' : '°';

  function analyze() {
    setMessage('');
    try {
      const points = run.trace.filter((point) => point.timeS >= startS - 1e-8 && point.timeS <= endS + 1e-8);
      const values = points.map((point) => {
        if (channel === 'wave') {
          const first = point.truth.waveFirstLoad?.[3];
          const second = point.truth.waveSecondLoad?.[3];
          return typeof first === 'number' && typeof second === 'number' ? (first + second) / 1e6 : NaN;
        }
        if (channel === 'rate') {
          const reading = point.measurements.RollRate;
          return reading?.quality === 'Good' && reading.value !== null ? reading.value : NaN;
        }
        return point.cruise?.measurementGood ? (point.cruise.estimatedRollRad * 180) / Math.PI : NaN;
      });
      if (
        points.length < 32 ||
        values.some((value) => !Number.isFinite(value)) ||
        points.some(
          (point, index) => index > 0 && Math.abs(point.timeS - points[index - 1].timeS - 0.05) > 1e-7,
        )
      )
        throw new Error('所选窗口缺少连续20Hz有效记录，请选择包含该通道的完整运行。');
      const value = computeVirtualSimulationStep<Spectrum>({
        modelId: 'student_model_analysis',
        operation: 'signal_spectrum',
        values,
        dtS: 0.05,
        minimumFrequencyHz: 0.01,
        maximumFrequencyHz: 1,
      });
      setResult({ source, spectrum: value });
    } catch (error) {
      setResult(null);
      setMessage(error instanceof Error ? error.message : '频谱计算失败。');
    }
  }

  const peak = spectrum?.bins.reduce((maximum, bin) => Math.max(maximum, bin.amplitude), 0) ?? 0;
  const line = spectrum?.bins
    .map((bin, index, bins) => {
      const x =
        32 +
        (270 * (bin.frequencyHz - bins[0].frequencyHz)) /
          Math.max(bins.at(-1)!.frequencyHz - bins[0].frequencyHz, 1e-9);
      const y = 114 - (96 * bin.amplitude) / Math.max(peak, 1e-12);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <div className="space-y-2 rounded border border-platform-border p-2">
      <SimField label="横摇频谱通道">
        <select
          className="sim-hud-input"
          aria-label="横摇频谱通道"
          value={channel}
          onChange={(event) => setChannel(event.target.value as typeof channel)}
        >
          <option value="roll">仪器横摇姿态估计</option>
          <option value="rate">陀螺横摇角速度</option>
          <option value="wave">实际波浪横摇力矩诊断</option>
        </select>
      </SimField>
      <Button size="sm" className={simulationUi.buttonOutline} onClick={analyze}>
        计算所选窗口横摇频谱
      </Button>
      {spectrum ? (
        <>
          <p className="text-xs text-platform-fg-secondary">
            0.01至1Hz频带内谱峰{spectrum.peakFrequencyHz?.toFixed(4) ?? '未获得有效峰值'}Hz，分辨率
            {spectrum.resolutionHz.toFixed(4)}Hz。去均值、Hann窗单边幅值谱，幅值单位{unit}。
          </p>
          <svg
            viewBox="0 0 320 145"
            role="img"
            aria-label="所选横摇通道的幅值频谱"
            className="w-full text-platform-accent"
          >
            <path d="M32 14V114H304" fill="none" stroke="currentColor" opacity=".4" />
            <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" />
            <text x="32" y="132" fontSize="9" fill="currentColor">
              0.01
            </text>
            <text x="270" y="132" fontSize="9" fill="currentColor">
              1 Hz
            </text>
            <text x="3" y="15" fontSize="9" fill="currentColor">
              {peak.toPrecision(2)} {unit}
            </text>
          </svg>
        </>
      ) : null}
      <p className="text-xs text-platform-fg-secondary">
        波浪工况统一采用120至600秒统计窗口。波浪力矩诊断用于比较激励与响应频率。
      </p>
      {message ? (
        <p role="status" className="text-xs text-platform-fg-secondary">
          {message}
        </p>
      ) : null}
    </div>
  );
}
