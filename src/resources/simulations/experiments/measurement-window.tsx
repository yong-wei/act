'use client';

import { useEffect, useMemo, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { sensorKey, type VesselRunEvidence } from '@/features/simulations/run-evidence';
import { useSimulationChartTheme } from '../components/simulation-ui';

Chart.register(...registerables);
export interface MeasurementWindowPoint {timeS:number;value:number|null}
interface Selection {start:MeasurementWindowPoint;end:MeasurementWindowPoint}

/** 拖选与键盘窗口均读取仪器原生序列，图形显示降采样不改变选点数值。 */
export function MeasurementWindow({run,startS,endS,onSelect,signal='SurfaceEncoder0',unit='°'}:{
  run:VesselRunEvidence;startS:number;endS:number;onSelect:(selection:Selection)=>void;signal?:string;unit?:string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const chart = useRef<Chart|null>(null);
  const dragStart = useRef<number|null>(null);
  const theme = useSimulationChartTheme();
  const bucket = Math.floor(run.lastTimeS);
  const nativeSamples = run.nativeSensorSamples;
  const timeLimit = run.lastTimeS;
  const samples = useMemo<MeasurementWindowPoint[]>(()=>nativeSamples
    .filter((sample)=>sensorKey(sample.signal) === signal && sample.measurement.t_sample_s <= bucket+1)
    .map((sample)=>({timeS:sample.measurement.t_sample_s,value:sample.measurement.quality === 'Good' ? sample.measurement.value : null})),
  [nativeSamples,signal,bucket]);
  const nearest = (time:number) => samples.reduce((best,point)=>Math.abs(point.timeS-time) < Math.abs(best.timeS-time) ? point : best,
    samples[0] ?? {timeS:time,value:null});
  const first = nearest(startS),last = nearest(endS);
  const select = (start:number,end:number) => {
    const low = Math.max(0,Math.min(start,end,run.lastTimeS));
    const high = Math.min(run.lastTimeS,Math.max(start,end));
    if (high-low < .01) return;
    onSelect({start:nearest(low),end:nearest(high)});
  };
  useEffect(()=>{
    if (!canvas.current) return;
    const stride = Math.max(1,Math.ceil(samples.length/1500));
    const points = samples.filter((_,index)=>index%stride === 0 || index === samples.length-1);
    const instance = new Chart(canvas.current,{type:'line',data:{datasets:[{
      label:`仪器量测 / ${unit}`,data:points.map((point)=>({x:point.timeS,y:point.value})),
      borderColor:'#22d3ee',pointRadius:0,borderWidth:1.5,spanGaps:false,
    }]},options:{animation:false,responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false}},scales:{x:{type:'linear',min:0,max:Math.max(1,timeLimit),
        title:{display:true,text:'采样时间 / s',color:theme.tick},ticks:{color:theme.tick,maxTicksLimit:5},grid:{color:theme.grid}},
      y:{title:{display:true,text:unit,color:theme.tick},ticks:{color:theme.tick,maxTicksLimit:4},grid:{color:theme.grid}}}},
      plugins:[{id:'selected-measurement-window',beforeDatasetsDraw:(current)=>{
        const left = current.scales.x.getPixelForValue(startS),right = current.scales.x.getPixelForValue(endS);
        current.ctx.save();current.ctx.fillStyle='rgba(34,211,238,.12)';
        current.ctx.fillRect(left,current.chartArea.top,right-left,current.chartArea.bottom-current.chartArea.top);current.ctx.restore();
      }}]});
    chart.current = instance;
    return ()=>{instance.destroy();chart.current=null;};
  },[samples,timeLimit,startS,endS,unit,theme]);

  const valueAt = (clientX:number) => {
    const bounds = canvas.current!.getBoundingClientRect();
    return chart.current!.scales.x.getValueForPixel((clientX-bounds.left)*chart.current!.width/bounds.width) as number;
  };
  return <div className="space-y-2" data-vessel-measurement-window>
    <div className="h-40"><canvas ref={canvas} role="img" aria-label="拖选仪器量测窗口" style={{touchAction:'none'}}
      onPointerDown={(event)=>{if (!chart.current) return;dragStart.current=valueAt(event.clientX);event.currentTarget.setPointerCapture(event.pointerId);}}
      onPointerUp={(event)=>{if (dragStart.current === null || !chart.current) return;select(dragStart.current,valueAt(event.clientX));dragStart.current=null;}}
      onPointerCancel={()=>{dragStart.current=null;}} /></div>
    <label className="block text-xs text-platform-fg-secondary">窗口起点 {startS.toFixed(2)} s<input className="block w-full" type="range" aria-label="量测窗口起点" min={0} max={run.lastTimeS} step={.02} value={startS} onChange={(event)=>select(Number(event.target.value),endS)} /></label>
    <label className="block text-xs text-platform-fg-secondary">窗口终点 {endS.toFixed(2)} s<input className="block w-full" type="range" aria-label="量测窗口终点" min={0} max={run.lastTimeS} step={.02} value={endS} onChange={(event)=>select(startS,Number(event.target.value))} /></label>
    <p className="text-xs leading-5 text-platform-fg-secondary">选点1 {first.timeS.toFixed(2)} s，{first.value?.toFixed(4) ?? '缺测'}{unit} · 选点2 {last.timeS.toFixed(2)} s，{last.value?.toFixed(4) ?? '缺测'}{unit}</p>
  </div>;
}
