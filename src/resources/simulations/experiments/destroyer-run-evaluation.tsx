'use client';

import { useEffect, useState } from 'react';
import type { VesselRunEvidence } from '@/features/simulations/run-evidence';
import { preloadVirtualSimulationRuntime } from '../physics/simulation-engine-facade';
import { SimPanelSection, SimReadout, SimReadoutGrid } from '../components/simulation-panels';
import { evaluateVesselHeadingRun } from './student-analysis';

const measured = (value:number | null | undefined) => value == null ? '缺少有效量测' : value.toFixed(3);

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
  if (run.courseKey === 'dredger') return <SimPanelSection title="作业与安全评价">
    <SimReadoutGrid>
      <SimReadout label="末段切削横移RMS" value={measured(metrics.dredgerSwayRmsMps)} unit="m/s"
        tone={(metrics.dredgerSwayRmsMps ?? 0) > 0.02 ? 'warning' : 'neutral'} />
      <SimReadout label="末段切削深度RMS" value={measured(metrics.dredgerDepthRmsM)} unit="m"
        tone={(metrics.dredgerDepthRmsM ?? 0) > 0.15 ? 'warning' : 'neutral'} />
      <SimReadout label="实际移除体积" value={measured(metrics.dredgerProductionM3)} unit="m³" />
      <SimReadout label="机械能耗" value={measured((metrics.dredgerMechanicalWorkJ ?? 0) / 1e6)} unit="MJ" />
      <SimReadout label="单位实际产量能耗" value={metrics.dredgerSpecificEnergyJPerM3 == null ? '待形成实际产量'
        : (metrics.dredgerSpecificEnergyJPerM3 / 1e6).toFixed(3)} unit="MJ/m³" />
      <SimReadout label="实际切削模式时长" value={measured(metrics.dredgerCutDurationS)} unit="s" />
      <SimReadout label="钢桩反力峰值" value={measured((metrics.dredgerMaximumSpudReactionN ?? 0) / 1000)} unit="kN" />
      <SimReadout label="锚缆张力峰值" value={measured((metrics.dredgerMaximumCableTensionN ?? 0) / 1000)} unit="kN" />
      <SimReadout label="机构硬约束违反" value={measured(metrics.dredgerHardViolationDurationS)} unit="s"
        tone={metrics.dredgerHardViolationDurationS ? 'warning' : 'neutral'} />
      <SimReadout label="切削模型越域" value={measured(metrics.dredgerSoilDomainViolationDurationS)} unit="s" />
      <SimReadout label="实际换向次数" value={String(metrics.dredgerReversalCount ?? 0)} />
      <SimReadout label="反复切换事件" value={String(metrics.dredgerChatterEventCount ?? 0)} />
      {metrics.dredgerStopCommandAfterFaultS != null ? <SimReadout label="断缆后停止指令" value={measured(metrics.dredgerStopCommandAfterFaultS)} unit="s" /> : null}
      {metrics.dredgerLiftAfterFaultS != null ? <SimReadout label="断缆后安全抬刀" value={measured(metrics.dredgerLiftAfterFaultS)} unit="s" /> : null}
    </SimReadoutGrid>
    <p className="mt-2 text-xs leading-5 text-platform-fg-secondary">横移与深度目标分别为0.02m/s、0.15m，采用末180秒中实际切削模式的样本。
      峰值及硬约束来自物理细步，能耗覆盖绞刀、横移绞车和推进轴系。未达目标的方案保留实际证据与解释。</p>
  </SimPanelSection>;
  return <SimPanelSection title="运行评价">
    <SimReadoutGrid>
      <SimReadout label="航向RMSE" value={measured(metrics.headingRmseDeg)} unit="°" />
      <SimReadout label="末段平均绝对误差" value={measured(metrics.final120sHeadingMaeDeg)} unit="°" />
      <SimReadout label="航向超调" value={measured(metrics.headingOvershootPercent)} unit="%" />
      <SimReadout label="调节时间" value={metrics.settlingTimeS === null ? '尚未持续收敛' : metrics.settlingTimeS.toFixed(2)} unit={metrics.settlingTimeS === null ? '' : 's'} />
      <SimReadout label={run.courseKey === 'icebreaker' ? '实际等效偏转总变差' : '实际舵角总变差'} value={metrics.rudderTotalVariationDeg.toFixed(2)} unit="°" />
      <SimReadout label="正机械功" value={(metrics.positiveMotorWorkJ/1e6).toFixed(2)} unit="MJ" />
      {metrics.actualDistanceM !== undefined ? <>
        <SimReadout label="实际航程" value={metrics.actualDistanceM.toFixed(1)} unit="m" />
        <SimReadout label="终点北向位置" value={(metrics.finalNorthM ?? 0).toFixed(1)} unit="m" />
        <SimReadout label="最大横偏" value={(metrics.maximumCrossTrackM ?? 0).toFixed(2)} unit="m" />
        <SimReadout label="最长前进停滞" value={(metrics.stallDurationS ?? 0).toFixed(2)} unit="s" tone={metrics.stalled ? 'warning' : 'neutral'} />
        <SimReadout label="单位实际航程能量" value={metrics.energyPerDistanceJPerM == null ? '缺少有效航程'
          : (metrics.energyPerDistanceJPerM / 1000).toFixed(2)} unit="kJ/m" />
        <SimReadout label="能耗比较资格" value={metrics.eligibleForEnergyComparison ? '到达且保持通道' : '保留观察与判断'} />
      </> : null}
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
