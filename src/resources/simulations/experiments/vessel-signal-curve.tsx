'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';
import { useSimulationChartTheme } from '../components/simulation-ui';
import type { VesselModelComparison } from './student-analysis';

Chart.register(...registerables);
type Channel = 'heading' | 'yawRate' | 'rudder' | 'waterSpeed' | 'groundSpeed' | 'roll' | 'rollRate';
const channels: Array<{ value: Channel; label: string; unit: string; measurement?: string }> = [
  { value: 'heading', label: '航向', unit: '°', measurement: 'Heading' },
  { value: 'yawRate', label: '转艏速率', unit: '°/s', measurement: 'YawRate' },
  { value: 'rudder', label: '实际舵角', unit: '°', measurement: 'SurfaceEncoder0' },
  { value: 'waterSpeed', label: '对水航速', unit: 'm/s', measurement: 'SpeedLog' },
  { value: 'groundSpeed', label: '纵向对地速度', unit: 'm/s' },
  { value: 'roll', label: '横摇角', unit: '°' },
  { value: 'rollRate', label: '横摇角速度', unit: '°/s', measurement: 'RollRate' },
];
const sources = [
  { key: 'truth', label: '物理后台仿真', color: '#34d399' },
  { key: 'measurement', label: '仪器量测', color: '#22d3ee' },
  { key: 'estimate', label: '状态估计', color: '#a78bfa' },
  { key: 'model', label: '学生模型预测', color: '#fbbf24' },
] as const;

function physicalValue(point: VesselTracePoint, channel: Channel): number | null {
  if (channel === 'heading') return point.truth.headingDeg;
  if (channel === 'yawRate') return point.truth.yawRateDegS;
  if (channel === 'rudder') return point.truth.surfaceDeg[0] ?? null;
  if (channel === 'waterSpeed') return point.truth.waterSpeedMps;
  if (channel === 'groundSpeed') return point.truth.groundBodySpeedMps;
  if (channel === 'roll') return point.truth.rollDeg;
  return point.truth.rollRateDegS ?? null;
}

function estimatedValue(point: VesselTracePoint, channel: Channel): number | null {
  if (channel === 'heading') return point.estimate?.headingDeg ?? null;
  if (channel === 'yawRate') return point.estimate?.yawRateDegS ?? null;
  if (channel === 'groundSpeed') return point.estimate?.groundBodySpeedMps ?? null;
  return null;
}

export function VesselSignalCurve({ trace, comparison, postRun = false }: { trace: VesselTracePoint[]; comparison?: VesselModelComparison; postRun?:boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [channel, setChannel] = useState<Channel>('heading');
  const [visible, setVisible] = useState({ truth: true, measurement: true, estimate: true, model: true });
  const chartTheme = useSimulationChartTheme();
  const bucket = Math.floor(trace.at(-1)?.timeS ?? 0);
  const selected = channels.find((item) => item.value === channel)!;
  const predictions = useMemo(() => new Map(comparison?.timeS.map((time,index) => [Math.round(time*1e6),comparison.predicted[index]]) ?? []), [comparison]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const stride = Math.max(1,Math.ceil(trace.length/800));
    const points = trace.filter((_,index) => index%stride === 0 || index === trace.length-1);
    const datasets = sources.filter((source) => visible[source.key] && (source.key !== 'truth' || postRun)).map((source) => ({
      label: source.label, borderColor: source.color, borderWidth: 1.3, pointRadius: 0, spanGaps: false,
      data: points.map((point) => {
        if (source.key === 'truth') return physicalValue(point,channel);
        if (source.key === 'estimate') return estimatedValue(point,channel);
        if (source.key === 'model') return channel === 'yawRate' ? predictions.get(Math.round(point.timeS*1e6)) ?? null : null;
        const sample = selected.measurement ? point.measurements[selected.measurement] : undefined;
        return sample?.quality === 'Good' ? sample.value : null;
      }),
    }));
    const chart = new Chart(canvasRef.current, { type: 'line',
      data: { labels: points.map((point) => point.timeS.toFixed(1)), datasets },
      options: { animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { title: { display: true, text: '时间 / s', color: chartTheme.tick },
          ticks: { maxTicksLimit: 5, color: chartTheme.tick }, grid: { color: chartTheme.grid } },
        y: { title: { display: true, text: selected.unit, color: chartTheme.tick },
          ticks: { maxTicksLimit: 5, color: chartTheme.tick }, grid: { color: chartTheme.grid } } } } });
    return () => chart.destroy();
  }, [bucket, channel, selected, visible, chartTheme, predictions, trace, postRun]);

  return <div className="space-y-2" data-vessel-signal-curve>
    <select className="sim-hud-input text-xs" aria-label="曲线观测通道" value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
      {channels.map((item) => <option key={item.value} value={item.value}>{item.label} / {item.unit}</option>)}
    </select>
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {sources.map((source) => <label key={source.key} className="flex items-center gap-1" style={{ color: source.color }}>
        <input type="checkbox" checked={visible[source.key] && (source.key !== 'truth' || postRun)} disabled={source.key === 'truth' && !postRun} onChange={(event) => setVisible((previous) => ({ ...previous,[source.key]:event.target.checked }))} />{source.label}{source.key === 'truth' && !postRun ? '（运行结束后复盘）' : ''}
      </label>)}
    </div>
    <div className="h-44"><canvas ref={canvasRef} role="img" aria-label={`${selected.label}的真值、量测、估计与学生模型曲线`} /></div>
  </div>;
}
