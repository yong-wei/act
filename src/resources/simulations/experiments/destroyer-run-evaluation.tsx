'use client';

import { useEffect, useState } from 'react';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { preloadVirtualSimulationRuntime } from '../physics/simulation-engine-facade';
import { SimPanelSection, SimReadout, SimReadoutGrid } from '../components/simulation-panels';
import { evaluateVesselHeadingRun } from './student-analysis';

const measured = (value:number | null) => value === null ? '缺少有效量测' : value.toFixed(3);

export function DestroyerRunEvaluation({run}:{run:VesselRunEvidence}) {
  const [evaluation,setEvaluation] = useState<ReturnType<typeof evaluateVesselHeadingRun> | null>(null);
  const [message,setMessage] = useState('');
  useEffect(()=> {
    let cancelled = false;
    setEvaluation(null);setMessage('');
    if (run.stoppedAtMs === null) return;
    void preloadVirtualSimulationRuntime().then(()=> {
      const result = evaluateVesselHeadingRun(run);
      if (!cancelled) setEvaluation(result);
    }).catch((error:unknown)=> {
      if (!cancelled) setMessage(error instanceof Error ? error.message : '暂时无法读取本次评价。');
    });
    return ()=> {cancelled = true;};
  },[run]);
  if (run.stoppedAtMs === null) return <p className="text-xs text-platform-fg-secondary">运行结束后可查看量测评价与安全指标。</p>;
  if (!evaluation) return <p role="status" className="text-xs text-platform-fg-secondary">{message || '正在读取运行评价…'}</p>;
  const {metrics,fineStepMetrics} = evaluation;
  return <SimPanelSection title="运行评价">
    <SimReadoutGrid>
      <SimReadout label="航向RMSE" value={measured(metrics.headingRmseDeg)} unit="°" />
      <SimReadout label="末段平均绝对误差" value={measured(metrics.final120sHeadingMaeDeg)} unit="°" />
      <SimReadout label="航向超调" value={measured(metrics.headingOvershootPercent)} unit="%" />
      <SimReadout label="调节时间" value={metrics.settlingTimeS === null ? '尚未持续收敛' : metrics.settlingTimeS.toFixed(2)} unit={metrics.settlingTimeS === null ? '' : 's'} />
      <SimReadout label="实际舵角总变差" value={metrics.rudderTotalVariationDeg.toFixed(2)} unit="°" />
      <SimReadout label="正机械功" value={(metrics.positiveMotorWorkJ/1e6).toFixed(2)} unit="MJ" />
      {fineStepMetrics ? <SimReadout label="物理细步最大横摇" value={fineStepMetrics.values.maximumRollDeg.toFixed(3)} unit="°"
        tone={fineStepMetrics.values.maximumRollDeg > fineStepMetrics.rollWarningDeg ? 'warning' : 'neutral'} /> : null}
      {fineStepMetrics ? <SimReadout label="横摇告警累计时间" value={fineStepMetrics.values.rollWarningDurationS.toFixed(3)} unit="s" /> : null}
      {fineStepMetrics ? <SimReadout label="舵角或舵速受限时间" value={fineStepMetrics.values.surfaceSaturationDurationS.toFixed(3)} unit="s" /> : null}
      {fineStepMetrics ? <SimReadout label="舵角或舵速受限占比" value={run.lastTimeS > 0
        ? (100*fineStepMetrics.values.surfaceSaturationDurationS/run.lastTimeS).toFixed(2) : '缺少运行区间'} unit="%" /> : null}
    </SimReadoutGrid>
    <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">航向指标采用20Hz仪器量测，末段窗口最长120s。调节时间要求最终连续60s保持误差带。{fineStepMetrics ? '安全峰值与告警时间采用120Hz物理细步。' : ''}</p>
  </SimPanelSection>;
}
