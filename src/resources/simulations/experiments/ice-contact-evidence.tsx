'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Chart, registerables } from 'chart.js';
import { Button } from '@/components/ui/button';
import type { VesselRunEvidence, VesselTracePoint } from '@/features/simulations/run-evidence';
import { SimField, SimReadout, SimReadoutGrid } from '../components/simulation-panels';
import { simulationUi, useSimulationChartTheme } from '../components/simulation-ui';

Chart.register(...registerables);

type Channel = 'force' | 'moment' | 'energy';

/** 本人所选运行的接触载荷和累计功，图形按原始采样显示峰值。 */
export function IceContactEvidence({ run, startS, endS, onWindow }: {
  run: VesselRunEvidence; startS: number; endS: number; onWindow: (startS: number, endS: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [channel, setChannel] = useState<Channel>('force');
  const theme = useSimulationChartTheme();
  const points = useMemo(() => run.trace.filter((point) => point.ice && point.timeS >= startS && point.timeS <= endS),
    [run, startS, endS]);
  const contact = run.trace.find((point) => (point.ice?.contactCount ?? 0) > 0 || (point.ice?.brokenAreaM2 ?? 0) > 0);
  const last = points.at(-1)?.ice;
  const unit = channel === 'force' ? 'kN' : channel === 'moment' ? 'MN·m' : 'MJ';
  useEffect(() => {
    if (!canvas.current || !points.length) return;
    const colors = ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#f472b6', '#94a3b8'];
    const series: Array<{ label: string; value: (point: VesselTracePoint) => number }> = channel === 'force'
      ? ['纵向力', '横向力', '垂向力'].map((label, index) => ({ label, value: (point) => point.ice!.loadBody[index] / 1000 }))
      : channel === 'moment'
        ? ['横摇力矩', '纵摇力矩', '艏摇力矩'].map((label, index) => ({ label, value: (point) => point.ice!.loadBody[index + 3] / 1e6 }))
        : [
          { label: '压碎耗散', value: (point) => point.ice!.crushingWorkJ / 1e6 },
          { label: '弯折破坏', value: (point) => point.ice!.fractureWorkJ / 1e6 },
          { label: '摩擦耗散', value: (point) => point.ice!.frictionWorkJ / 1e6 },
          { label: '浮冰水阻耗散', value: (point) => point.ice!.waterDissipationJ / 1e6 },
          { label: '船体接触功', value: (point) => point.ice!.contactBodyWorkJ / 1e6 },
          { label: '浮冰接触功', value: (point) => point.ice!.contactFloeWorkJ / 1e6 },
        ];
    const chart = new Chart(canvas.current, {
      type: 'line',
      data: { datasets: series.map((item, index) => ({ label: item.label,
        data: points.map((point) => ({ x: point.timeS, y: item.value(point) })),
        borderColor: colors[index], borderWidth: 1.5, pointRadius: 0, spanGaps: false })) },
      options: {
        animation: false, responsive: true, maintainAspectRatio: false, parsing: false,
        plugins: { decimation: { enabled: true, algorithm: 'min-max' }, legend: { labels: { color: theme.tick, boxWidth: 12, font: { size: 9 } } } },
        scales: {
          x: { type: 'linear', title: { display: true, text: '实验时间 / s', color: theme.tick },
            ticks: { color: theme.tick, maxTicksLimit: 5 }, grid: { color: theme.grid } },
          y: { title: { display: true, text: unit, color: theme.tick }, ticks: { color: theme.tick, maxTicksLimit: 5 }, grid: { color: theme.grid } },
        },
      },
    });
    return () => chart.destroy();
  }, [points, channel, theme, unit]);
  return <div className="space-y-2 rounded border border-platform-border p-2" data-ice-contact-evidence>
    <SimField label="冰接触记录">
      <select className="sim-hud-input" aria-label="冰接触记录通道" value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
        <option value="force">接触力真值</option><option value="moment">接触力矩真值</option><option value="energy">累计功与耗散真值</option>
      </select>
    </SimField>
    <div className="h-44"><canvas ref={canvas} role="img" aria-label="所选窗口冰接触与能量记录" /></div>
    {contact ? <Button size="sm" variant="outline" className={simulationUi.buttonOutline}
      onClick={() => onWindow(Math.max(0, contact.timeS - 1), Math.min(run.lastTimeS, contact.timeS + 1))}>
      定位首次接触前后1秒
    </Button> : null}
    <p className="text-xs leading-5 text-platform-fg-secondary">载荷与能量来自本人20Hz原始记录，显示采用保留峰值的绘图抽样。坐标为x向船艏、y向右舷、z向下。
      {contact ? `记录中的首次接触约为${contact.timeS.toFixed(2)}s。` : '这次记录尚未出现冰接触。'}累计功从本次运行开始积分。</p>
    {last ? <SimReadoutGrid>
      <SimReadout label="窗口末端破碎面积" value={last.brokenAreaM2.toFixed(1)} unit="m²" />
      <SimReadout label="窗口末端浮冰数" value={String(last.floeCount)} unit="块" />
      <SimReadout label="累计船体接触功" value={(last.contactBodyWorkJ / 1e6).toFixed(3)} unit="MJ" />
      <SimReadout label="累计浮冰接触功" value={(last.contactFloeWorkJ / 1e6).toFixed(3)} unit="MJ" />
    </SimReadoutGrid> : <p role="status" className="text-xs text-platform-fg-secondary">所选窗口尚无冰接触原始记录。</p>}
  </div>;
}
