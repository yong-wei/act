'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import { SimField } from '../components/simulation-panels';
import { simulationUi } from '../components/simulation-ui';

interface Spectrum {
  resolutionHz:number;
  peakFrequencyHz:number|null;
  bins:Array<{frequencyHz:number;amplitude:number}>;
}

/** 复用工作台所选本人运行和窗口，频谱由现有数值分析入口计算。 */
export function LngLiquidSpectrum({run,startS,endS}:{run:VesselRunEvidence;startS:number;endS:number}) {
  const [modeIndex,setModeIndex] = useState(1);
  const [result,setResult] = useState<{source:string;spectrum:Spectrum}|null>(null);
  const [message,setMessage] = useState('');
  const source = JSON.stringify([run.id,run.lastTimeS,startS,endS,modeIndex]);
  const spectrum = result?.source === source ? result.spectrum : null;
  const expected = run.parameters?.liquidModalFrequenciesHz?.[modeIndex];

  function analyze() {
    setMessage('');
    try {
      const points = run.trace.filter((point) => point.timeS >= startS - 1e-8 && point.timeS <= endS + 1e-8);
      if (points.length < 32 || points.some((point,index) => !Number.isFinite(point.liquid?.modeHeightsM[modeIndex])
        || (index > 0 && Math.abs(point.timeS - points[index - 1].timeS - .05) > 1e-7))) {
        throw new Error('所选窗口缺少连续20Hz液面模态记录，请选择包含液面证据的完整运行。');
      }
      const value = computeVirtualSimulationStep<Spectrum>({modelId:'student_model_analysis',operation:'signal_spectrum',
        values:points.map((point) => point.liquid!.modeHeightsM[modeIndex]),dtS:.05,minimumFrequencyHz:.02,maximumFrequencyHz:1});
      setResult({source,spectrum:value});
    } catch (error) {setResult(null);setMessage(error instanceof Error ? error.message : '液面频谱计算失败。');}
  }

  const peakAmplitude = spectrum?.bins.reduce((maximum,bin) => Math.max(maximum,bin.amplitude),0) ?? 0;
  const line = spectrum?.bins.map((bin,index,bins) => {
    const x = 32 + 270 * (bin.frequencyHz - bins[0].frequencyHz) / Math.max(bins.at(-1)!.frequencyHz - bins[0].frequencyHz,1e-9);
    const y = 114 - 96 * bin.amplitude / Math.max(peakAmplitude,1e-12);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return <div className="space-y-2 rounded border border-platform-border p-2">
    <SimField label="液面频谱通道">
      <select className="sim-hud-input" aria-label="液面频谱通道" value={modeIndex} onChange={(event) => setModeIndex(Number(event.target.value))}>
        {Array.from({length:4},(_,tank) => [0,1].map((axis) => <option key={2*tank+axis} value={2*tank+axis}>
          第{tank+1}舱 · {axis === 0 ? '纵向' : '横向'}液面模态
        </option>))}
      </select>
    </SimField>
    <p className="text-xs text-platform-fg-secondary">本运行公式频率 {expected === undefined ? '原记录未保存' : `${expected.toFixed(4)} Hz`}，液深 {run.parameters?.liquidDepthM?.toFixed(2) ?? '原记录未保存'} m。</p>
    <Button size="sm" className={simulationUi.buttonOutline} onClick={analyze}>计算所选窗口液面频谱</Button>
    {spectrum ? <>
      <p className="text-xs text-platform-fg-secondary">0.02至1Hz频带内谱峰 {spectrum.peakFrequencyHz?.toFixed(4) ?? '未获得有效峰值'} Hz，分辨率 {spectrum.resolutionHz.toFixed(4)} Hz。去均值、Hann窗单边幅值谱，幅值单位为米。</p>
      <svg viewBox="0 0 320 145" role="img" aria-label="所选液面模态的幅值频谱" className="w-full text-platform-accent">
        <path d="M32 14V114H304" fill="none" stroke="currentColor" opacity=".4" />
        <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" />
        <text x="32" y="132" fontSize="9" fill="currentColor">0.02</text><text x="270" y="132" fontSize="9" fill="currentColor">1 Hz</text>
        <text x="3" y="15" fontSize="9" fill="currentColor">{peakAmplitude.toPrecision(2)} m</text>
      </svg>
    </> : null}
    {message ? <p role="status" className="text-xs text-platform-fg-secondary">{message}</p> : null}
  </div>;
}
