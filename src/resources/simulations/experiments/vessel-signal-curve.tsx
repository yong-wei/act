'use client';

import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';
import { useSimulationChartTheme } from '../components/simulation-ui';
import type { VesselModelComparison } from './student-analysis';

Chart.register(...registerables);
type Channel = 'heading' | 'yawRate' | 'rudder' | 'waterSpeed' | 'groundSpeed' | 'waterLateralSpeed'
  | 'groundLateralSpeed' | 'north' | 'east' | 'roll' | 'rollRate';
const channels: Array<{ value: Channel; label: string; unit: string; measurement?: string }> = [
  { value: 'heading', label: '航向', unit: '°', measurement: 'Heading' },
  { value: 'yawRate', label: '转艏速率', unit: '°/s', measurement: 'YawRate' },
  { value: 'rudder', label: '实际舵角', unit: '°', measurement: 'SurfaceEncoder0' },
  { value: 'waterSpeed', label: '对水航速', unit: 'm/s', measurement: 'SpeedLog' },
  { value: 'groundSpeed', label: '纵向对地速度', unit: 'm/s' },
  { value: 'groundLateralSpeed', label: '横向对地速度', unit: 'm/s' },
  { value: 'waterLateralSpeed', label: '横向对水速度', unit: 'm/s' },
  { value: 'north', label: '北向位置', unit: 'm', measurement: 'North' },
  { value: 'east', label: '东向横偏', unit: 'm', measurement: 'East' },
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
  if (channel === 'groundLateralSpeed') return point.truth.bodyVelocitySi?.[1] ?? null;
  if (channel === 'waterLateralSpeed') return point.truth.waterLateralSpeedMps ?? null;
  if (channel === 'north') return point.truth.northM;
  if (channel === 'east') return point.truth.eastM;
  if (channel === 'roll') return point.truth.rollDeg;
  return point.truth.rollRateDegS ?? null;
}

function estimatedValue(point: VesselTracePoint, channel: Channel): number | null {
  if (channel === 'heading') return point.estimate?.headingDeg ?? null;
  if (channel === 'yawRate') return point.estimate?.yawRateDegS ?? null;
  if (channel === 'groundSpeed') return point.estimate?.groundBodySpeedMps ?? null;
  if (channel === 'groundLateralSpeed') return point.estimate?.groundBodyLateralSpeedMps ?? null;
  if (channel === 'north') return point.estimate?.northM ?? null;
  if (channel === 'east') return point.estimate?.eastM ?? null;
  return null;
}

export function VesselSignalCurve({ trace, comparison, postRun = false }: { trace: VesselTracePoint[]; comparison?: VesselModelComparison; postRun?:boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [channel, setChannel] = useState<Channel>('heading');
  const [visible, setVisible] = useState({ truth: true, measurement: true, estimate: true, model: true });
  const chartTheme = useSimulationChartTheme();
  const bucket = Math.floor(trace.at(-1)?.timeS ?? 0);
  const selected = channels.find((item) => item.value === channel)!;
  const modelAvailable = selected.measurement === (comparison?.outputChannel ?? 'YawRate') && Boolean(comparison?.predicted.length);
  const available = {truth:postRun,measurement:Boolean(selected.measurement),
    estimate:['heading','yawRate','groundSpeed','groundLateralSpeed','north','east'].includes(channel)
      && (channel !== 'groundLateralSpeed' || trace.some((point)=>point.estimate?.groundBodyLateralSpeedMps !== undefined)),
    model:modelAvailable};
  useEffect(() => {
    if (!canvasRef.current) return;
    const stride = Math.max(1,Math.ceil(trace.length/800));
    const modelStride = Math.max(1,Math.ceil((comparison?.timeS.length ?? 0)/800));
    const points = trace.filter((_,index) => index%stride === 0 || index === trace.length-1);
    const datasets = sources.filter((source) => visible[source.key] && (source.key !== 'truth' || postRun)).map((source) => ({
      label: source.label, borderColor: source.color, borderWidth: 1.3, pointRadius: 0, spanGaps: false,
      data: source.key === 'model'
        ? modelAvailable && comparison ? comparison.timeS.flatMap((time,index)=> {
          if (index%modelStride !== 0 && index !== comparison.timeS.length-1) return [];
          return [{x:time,y:comparison.predicted[index]}];
        }) : []
        : points.map((point) => {
          const sample = selected.measurement ? point.measurements[selected.measurement] : undefined;
          const value = source.key === 'truth' ? physicalValue(point,channel)
            : source.key === 'estimate' ? estimatedValue(point,channel)
              : sample?.quality === 'Good' ? sample.value : null;
          return value === null ? null : {x:point.timeS,y:value};
        }),
    }));
    const chart = new Chart(canvasRef.current, { type: 'line',
      data: { datasets },
      options: { animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { type:'linear',title: { display: true, text: '时间 / s', color: chartTheme.tick },
          ticks: { maxTicksLimit: 5, color: chartTheme.tick }, grid: { color: chartTheme.grid } },
        y: { title: { display: true, text: selected.unit, color: chartTheme.tick },
          ticks: { maxTicksLimit: 5, color: chartTheme.tick }, grid: { color: chartTheme.grid } } } } });
    return () => chart.destroy();
  }, [bucket, channel, selected, visible, chartTheme, comparison, trace, postRun, modelAvailable]);

  return <div className="space-y-2" data-vessel-signal-curve>
    <select className="sim-hud-input text-xs" aria-label="曲线观测通道" value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
      {channels.map((item) => <option key={item.value} value={item.value}>{item.label} / {item.unit}</option>)}
    </select>
    {channel === 'waterLateralSpeed' && !trace.some((point)=>point.truth.waterLateralSpeedMps !== undefined)
      ? <p role="status" className="text-xs text-platform-fg-secondary">此记录的横向对水速度暂无已保存数据。</p> : null}
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
      {sources.map((source) => <label key={source.key} className="flex items-center gap-1" style={{ color: source.color }}>
        <input type="checkbox" checked={visible[source.key] && available[source.key]} disabled={!available[source.key]}
          onChange={(event) => setVisible((previous) => ({ ...previous,[source.key]:event.target.checked }))} />
        {source.label}{!available[source.key] ? source.key === 'truth' ? '（运行结束后复盘）' : '（此通道暂无数据）' : ''}
      </label>)}
    </div>
    <div className="h-44"><canvas ref={canvasRef} role="img" aria-label={`${selected.label}的真值、量测、估计与学生模型曲线`} /></div>
  </div>;
}
