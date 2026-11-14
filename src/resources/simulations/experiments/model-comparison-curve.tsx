'use client';

import { useEffect, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { useSimulationChartTheme } from '../components/simulation-ui';
import type { VesselModelComparison } from './student-analysis';
import { VESSEL_FACTOR_LABELS } from './comparison-factors';

Chart.register(...registerables);

export function ModelComparisonCurve({ comparison }: { comparison: VesselModelComparison }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [channel,setChannel] = useState<'output'|'heading'>('output');
  const chartTheme = useSimulationChartTheme();
  useEffect(() => {
    if (!canvasRef.current) return;
    const stride = Math.max(1, Math.ceil(comparison.timeS.length/1000));
    const indices = comparison.timeS.map((_,index) => index).filter((index) => index%stride === 0);
    const heading = channel === 'heading' && comparison.predictedHeadingDeg;
    const actual = heading ? comparison.actualHeadingDeg ?? [] : comparison.actual;
    const predicted = heading ? comparison.predictedHeadingDeg! : comparison.predicted;
    const chart = new Chart(canvasRef.current, {
      type: 'line', data: { labels: indices.map((index) => comparison.timeS[index].toFixed(1)), datasets: [
        { label: '仪器量测', data: indices.map((index) => actual[index]), borderColor: '#22d3ee', pointRadius: 0, borderWidth: 1.5 },
        { label: '学生模型预测', data: indices.map((index) => predicted[index]), borderColor: '#fbbf24', pointRadius: 0, borderWidth: 1.5 },
      ] },
      options: { animation: false, responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: chartTheme.tick, boxWidth: 10, font: { size: 10 } } } },
        scales: { x: { title:{display:true,text:'时间 / s',color:chartTheme.tick},ticks: { color: chartTheme.tick, maxTicksLimit: 5 }, grid: { color: chartTheme.grid } },
          y: { title:{display:true,text:heading ? '航向 / °' : comparison.outputUnit ?? '输出量',color:chartTheme.tick},ticks: { color: chartTheme.tick, maxTicksLimit: 5 }, grid: { color: chartTheme.grid } } } },
    });
    return () => chart.destroy();
  }, [comparison, chartTheme, channel]);
  const metric = (key: string, digits: number) => {
    const value = comparison.metrics[key]; return typeof value === 'number' ? value.toFixed(digits) : '不适用';
  };
  return <div className="space-y-2" data-vessel-comparison>
    {comparison.predictedHeadingDeg ? <select aria-label="独立闭环对照通道" className="sim-hud-input text-xs" value={channel} onChange={(event)=>setChannel(event.target.value as 'output'|'heading')}>
      <option value="output">转艏速率 / °/s</option><option value="heading">航向 / °</option>
    </select> : null}
    <div className="h-44"><canvas ref={canvasRef} aria-label="仪器量测与学生模型独立预测对照" role="img" /></div>
    <p className="text-xs text-platform-fg-secondary">{comparison.predictedHeadingDeg ? '转艏速率验证 ' : ''}RMSE {metric('rmse',4)} {comparison.outputUnit} · FIT {metric('fit_percent',1)}% · 峰值误差 {metric('peak_error',4)} {comparison.outputUnit}</p>
    <p className="text-xs text-platform-fg-muted">窗口 {comparison.startS.toFixed(1)}–{comparison.endS.toFixed(1)} s · 量测与模型保持各自状态</p>
    {comparison.factorFlags ? <div className="space-y-1 text-xs text-platform-fg-muted">
      <p>物理后台包含 {comparison.factorFlags.physical.map((key)=>VESSEL_FACTOR_LABELS[key] ?? '其他现实因素').join('、')}</p>
      <p>学生模型包含 {comparison.factorFlags.student.map((key)=>VESSEL_FACTOR_LABELS[key] ?? '其他模型环节').join('、')}</p>
      <p>模型适用边界涉及 {comparison.factorFlags.unmodeled.map((key)=>VESSEL_FACTOR_LABELS[key] ?? '其他现实因素').join('、')}</p>
    </div> : null}
  </div>;
}
