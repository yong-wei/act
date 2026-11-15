import type { VesselSample } from '../simulations/vessel-experiment';
import type { MismatchDiagnostics } from './mismatch-diagnostics';
import type { VesselModelComparison } from './student-analysis';

export type CurveAnomalyKind =
  | 'overshoot_peak'
  | 'actuator_saturation'
  | 'wave_modulation'
  | 'fault_inflection_180s';

export interface CurveAnomalySnapshot {
  id: string;
  kind: CurveAnomalyKind;
  badgeLabel: string;
  timeS: number;
  valueLabel: string;
  snapshotSummary: string;
  socraticQuestion: string;
  antiGhostwriting: true;
}

const ANOMALY_PRIORITY: Record<CurveAnomalyKind, number> = {
  fault_inflection_180s: 4,
  actuator_saturation: 3,
  overshoot_peak: 2,
  wave_modulation: 1,
};

function sortByPriority(list: CurveAnomalySnapshot[]): CurveAnomalySnapshot[] {
  return [...list].sort((a, b) => ANOMALY_PRIORITY[b.kind] - ANOMALY_PRIORITY[a.kind]);
}

function estimateWaveModulation(
  timeS: number[],
  values: Array<number | null>,
): { timeS: number; peakToPeak: number; reversals: number } | null {
  const valid: Array<{ t: number; v: number }> = [];
  for (let i = 0; i < Math.min(timeS.length, values.length); i += 1) {
    const t = timeS[i];
    const v = values[i];
    if (typeof t === 'number' && typeof v === 'number' && Number.isFinite(t) && Number.isFinite(v)) {
      valid.push({ t, v });
    }
  }
  if (valid.length < 16) return null;

  let reversals = 0;
  let prevSign = 0;
  let maxHfSwing = 0;
  let maxSwingTime = valid[0].t;

  // High-pass residual around 3-point local mean highlights wave-frequency oscillation.
  for (let i = 1; i < valid.length - 1; i += 1) {
    const localMean = (valid[i - 1].v + valid[i].v + valid[i + 1].v) / 3;
    const hf = valid[i].v - localMean;
    const swing = Math.abs(hf) * 2;
    if (swing > maxHfSwing) {
      maxHfSwing = swing;
      maxSwingTime = valid[i].t;
    }
    const diff = valid[i].v - valid[i - 1].v;
    if (Math.abs(diff) > 1e-4) {
      const sign = diff > 0 ? 1 : -1;
      if (prevSign !== 0 && sign !== prevSign) reversals += 1;
      prevSign = sign;
    }
  }

  const totalSpan = Math.max(1e-6, valid[valid.length - 1].t - valid[0].t);
  const reversalRate = reversals / totalSpan;
  if (reversals >= 6 && reversalRate >= 0.12 && maxHfSwing > 0.12) {
    return { timeS: maxSwingTime, peakToPeak: maxHfSwing, reversals };
  }
  return null;
}

/**
 * Inspect model comparison traces and residuals to surface causal inflection anomalies.
 */
export function detectComparisonAnomalies({
  comparison,
  actual,
  predicted,
  diagnostics,
  unit,
  channelLabel,
  linearBaseline,
}: {
  comparison: VesselModelComparison;
  actual: Array<number | null>;
  predicted: Array<number | null>;
  diagnostics: MismatchDiagnostics;
  unit: string;
  channelLabel: string;
  linearBaseline?: Array<number | null> | null;
}): CurveAnomalySnapshot[] {
  const anomalies: CurveAnomalySnapshot[] = [];
  const timeS = comparison.timeS;
  const len = Math.min(timeS.length, actual.length, predicted.length);
  if (len < 4) return anomalies;

  // 1. Fault inflection around t = 180s.
  let preSq = 0;
  let preCount = 0;
  let postMaxRes = 0;
  let postPeakTime: number | null = null;
  for (let i = 0; i < len; i += 1) {
    const r = diagnostics.residuals[i];
    if (typeof r !== 'number') continue;
    if (timeS[i] < 180) {
      preSq += r * r;
      preCount += 1;
    } else if (r >= postMaxRes) {
      postMaxRes = r;
      postPeakTime = timeS[i];
    }
  }
  const preRms = preCount > 0 ? Math.sqrt(preSq / preCount) : 0;
  if (
    postPeakTime !== null &&
    postMaxRes > diagnostics.thresholds.pointThreshold &&
    (preCount === 0 || postMaxRes >= Math.max(preRms * 1.8, diagnostics.thresholds.rmseThreshold * 1.5))
  ) {
    anomalies.push({
      id: `fault-180-${comparison.id}`,
      kind: 'fault_inflection_180s',
      badgeLabel: 't=180s 故障拐点',
      timeS: postPeakTime,
      valueLabel: `残差 ${postMaxRes.toFixed(2)} ${unit}`,
      snapshotSummary: `${channelLabel}在 t=${postPeakTime.toFixed(1)}s 处出现 ${postMaxRes.toFixed(2)} ${unit} 突变残差（180s 前 RMS=${preRms.toFixed(2)} ${unit}）。`,
      socraticQuestion: `在对照曲线 ${channelLabel} 中，为什么 t=180s 之后（约 t=${postPeakTime.toFixed(1)}s）残差突然放大到 ${postMaxRes.toFixed(2)} ${unit}？这对应物理对象发生了什么机理变化？`,
      antiGhostwriting: true,
    });
  }

  // 2. Actuator saturation clipping in measured input or factorFlags.
  const inputArr = comparison.measuredInput ?? [];
  let satTime: number | null = null;
  let satPeak = 0;
  let satRun = 0;
  for (let i = 0; i < Math.min(len, inputArr.length); i += 1) {
    const absIn = Math.abs(inputArr[i] ?? 0);
    if (absIn >= 24.5) {
      satRun += 1;
      if (satRun >= 3 && absIn >= satPeak) {
        satPeak = absIn;
        satTime = timeS[i];
      }
    } else {
      satRun = 0;
    }
  }
  const hasSaturationFlag = Boolean(
    comparison.factorFlags?.physical?.some((item) => item.includes('饱和') || item.includes('限幅')) ||
      comparison.factorFlags?.unmodeled?.some((item) => item.includes('饱和') || item.includes('限幅')),
  );
  if ((satTime !== null && satPeak >= 24.5) || (hasSaturationFlag && diagnostics.peakTimeS !== null)) {
    const triggerT = satTime ?? diagnostics.peakTimeS ?? timeS[len - 1];
    anomalies.push({
      id: `sat-${comparison.id}`,
      kind: 'actuator_saturation',
      badgeLabel: '执行器饱和削顶',
      timeS: triggerT,
      valueLabel: satPeak > 0 ? `输入峰值 ${satPeak.toFixed(1)}` : `RMSE ${diagnostics.rmse.toFixed(2)} ${unit}`,
      snapshotSummary: `${channelLabel}在 t=${triggerT.toFixed(1)}s 附近出现执行器幅值受限（${satPeak > 0 ? `输入幅值 ${satPeak.toFixed(1)}，近似削顶` : '物理限幅生效'}），实际与线性预测出现分岔。`,
      socraticQuestion: `为什么在 t=${triggerT.toFixed(1)}s 出现执行器指令与实际出力脱节的削顶现象？这种硬限幅非线性会对闭环相位和积分器造成什么后果？`,
      antiGhostwriting: true,
    });
  }

  // 3. Overshoot peak vs predicted/baseline or RMSE excess.
  let maxPeakDiff = 0;
  let maxPeakT: number | null = null;
  let peakActual = 0;
  const baselineSeries = linearBaseline && linearBaseline.length === actual.length ? linearBaseline : predicted;
  for (let i = 0; i < len; i += 1) {
    const a = actual[i];
    const b = baselineSeries[i];
    if (typeof a !== 'number' || typeof b !== 'number') continue;
    const diff = Math.abs(a - b);
    if (diff > maxPeakDiff) {
      maxPeakDiff = diff;
      maxPeakT = timeS[i];
      peakActual = a;
    }
  }
  if (maxPeakT !== null && maxPeakDiff > diagnostics.thresholds.rmseThreshold) {
    anomalies.push({
      id: `overshoot-${comparison.id}`,
      kind: 'overshoot_peak',
      badgeLabel: '峰值失配拐点',
      timeS: maxPeakT,
      valueLabel: `实测 ${peakActual.toFixed(2)} ${unit} · 偏差 ${maxPeakDiff.toFixed(2)} ${unit}`,
      snapshotSummary: `${channelLabel}在 t=${maxPeakT.toFixed(1)}s 实测 ${peakActual.toFixed(2)} ${unit}，偏离模型基准 ${maxPeakDiff.toFixed(2)} ${unit}（全段 RMSE ${diagnostics.rmse.toFixed(2)} ${unit}）。`,
      socraticQuestion: `在 t=${maxPeakT.toFixed(1)}s 附近实测与模型预测相差 ${maxPeakDiff.toFixed(2)} ${unit}，请结合被控通道的非线性阻尼、工作点变化或耦合项解释为何此处偏差最大？`,
      antiGhostwriting: true,
    });
  }

  // 4. Wave modulation detection.
  const wave = estimateWaveModulation(timeS, actual);
  if (wave) {
    anomalies.push({
      id: `wave-${comparison.id}`,
      kind: 'wave_modulation',
      badgeLabel: '波频高频调制',
      timeS: wave.timeS,
      valueLabel: `高频摆幅 ${wave.peakToPeak.toFixed(2)} ${unit}`,
      snapshotSummary: `${channelLabel}在 t=${wave.timeS.toFixed(1)}s 附近出现明显的周期性波频高频振荡（局地峰峰值 ${wave.peakToPeak.toFixed(2)} ${unit}，换向 ${wave.reversals} 次）。`,
      socraticQuestion: `曲线上叠加的约 ${wave.peakToPeak.toFixed(2)} ${unit} 波频周期振荡应归因于哪一层扰动？如果直接放大控制器高频增益来抵消它，会导致什么代价？`,
      antiGhostwriting: true,
    });
  }

  return sortByPriority(anomalies);
}

/**
 * Inspect live/recorded experiment step samples to detect physical inflections for Socratic inquiry.
 */
export function detectVesselCurveAnomalies({
  shipKey,
  stepSeq,
  stepTitle,
  samples,
  targetValue,
  primarySignalKey,
  primaryLabel,
  unit,
  rudderKey = 'rudderDeg',
  finKey = 'finDeg',
}: {
  shipKey: string;
  stepSeq: number;
  stepTitle: string;
  samples: VesselSample[];
  targetValue?: number | null;
  primarySignalKey: string;
  primaryLabel: string;
  unit: string;
  rudderKey?: string;
  finKey?: string;
}): CurveAnomalySnapshot[] {
  if (samples.length < 10) return [];

  const timeS = samples.map((s) => s.time);
  const values = samples.map((s) => {
    const v = s.values[primarySignalKey];
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  });

  const anomalies: CurveAnomalySnapshot[] = [];

  // 1. t = 180s fault inflection.
  const post180Idx = samples.findIndex((s) => s.time >= 180);
  if (post180Idx > 4 && post180Idx < samples.length - 2) {
    let preMaxRate = 0;
    let postMaxJump = 0;
    let jumpTime = samples[post180Idx].time;
    let jumpVal = values[post180Idx] ?? 0;

    for (let i = 1; i < post180Idx; i += 1) {
      const a = values[i];
      const b = values[i - 1];
      const dt = Math.max(1e-3, timeS[i] - timeS[i - 1]);
      if (a !== null && b !== null) preMaxRate = Math.max(preMaxRate, Math.abs(a - b) / dt);
    }
    const baseVal = values[post180Idx - 1] ?? 0;
    for (let i = post180Idx; i < samples.length; i += 1) {
      const cur = values[i];
      if (cur === null) continue;
      const diff = Math.abs(cur - baseVal);
      if (diff >= postMaxJump) {
        postMaxJump = diff;
        jumpTime = timeS[i];
        jumpVal = cur;
      }
    }
    if (postMaxJump > Math.max(0.5, preMaxRate * 0.8)) {
      anomalies.push({
        id: `${shipKey}-step${stepSeq}-fault180`,
        kind: 'fault_inflection_180s',
        badgeLabel: 't=180s 故障拐点',
        timeS: jumpTime,
        valueLabel: `${primaryLabel} ${jumpVal.toFixed(2)} ${unit}`,
        snapshotSummary: `第${stepSeq}步（${stepTitle}）在 t ≥ 180 s 后于 t=${jumpTime.toFixed(1)}s 出现拐点，${primaryLabel}变化幅度达 ${postMaxJump.toFixed(2)} ${unit}。`,
        socraticQuestion: `为什么第${stepSeq}步在 t=180s 之后出现明显的动态拐点（${primaryLabel}变化 ${postMaxJump.toFixed(2)} ${unit}）？若此时继续保持原控制律或推进配置会带来什么后果？`,
        antiGhostwriting: true,
      });
    }
  }

  // 2. Rudder (>= 34.5 deg) or fin (>= 24.5 deg) saturation clipping.
  let satTime: number | null = null;
  let satActuator = '';
  let satDeg = 0;
  for (const s of samples) {
    const rudderVal = s.values[rudderKey];
    const finVal = s.values[finKey];
    if (typeof rudderVal === 'number' && Math.abs(rudderVal) >= 34.5) {
      satTime = s.time;
      satActuator = '舵角';
      satDeg = rudderVal;
      break;
    }
    if (typeof finVal === 'number' && Math.abs(finVal) >= 24.5) {
      satTime = s.time;
      satActuator = '减摇鳍角';
      satDeg = finVal;
      break;
    }
  }
  if (satTime !== null) {
    anomalies.push({
      id: `${shipKey}-step${stepSeq}-sat`,
      kind: 'actuator_saturation',
      badgeLabel: `${satActuator}饱和削顶`,
      timeS: satTime,
      valueLabel: `${satActuator} ${satDeg.toFixed(1)}°`,
      snapshotSummary: `第${stepSeq}步在 t=${satTime.toFixed(1)}s 触及${satActuator}物理限幅（${satDeg.toFixed(1)}°），进入执行器饱和区。`,
      socraticQuestion: `第${stepSeq}步中${satActuator}在 t=${satTime.toFixed(1)}s 达到 ${satDeg.toFixed(1)}° 满限幅削顶。请分析此时为何闭环超调难以迅速回落，以及掉速/积分饱和是怎么相互强化的？`,
      antiGhostwriting: true,
    });
  }

  // 3. Overshoot peak around target or initial transient.
  const finite = samples
    .map((s) => ({ t: s.time, v: s.values[primarySignalKey] }))
    .filter((item): item is { t: number; v: number } => typeof item.v === 'number' && Number.isFinite(item.v));
  if (finite.length >= 6) {
    const startVal = finite[0].v;
    const endVal = finite[finite.length - 1].v;
    const refVal = typeof targetValue === 'number' && Number.isFinite(targetValue) ? targetValue : endVal;
    const direction = refVal >= startVal ? 1 : -1;
    let peakSample = finite[0];
    for (const item of finite) {
      if ((item.v - refVal) * direction > (peakSample.v - refVal) * direction) {
        peakSample = item;
      }
    }
    const overshoot = (peakSample.v - refVal) * direction;
    const stepAmp = Math.max(0.5, Math.abs(refVal - startVal));
    if (overshoot > Math.max(0.4, stepAmp * 0.12)) {
      anomalies.push({
        id: `${shipKey}-step${stepSeq}-overshoot`,
        kind: 'overshoot_peak',
        badgeLabel: '超调峰值拐点',
        timeS: peakSample.t,
        valueLabel: `峰值 ${peakSample.v.toFixed(2)} ${unit}（超调 +${overshoot.toFixed(2)} ${unit}）`,
        snapshotSummary: `第${stepSeq}步 ${primaryLabel}在 t=${peakSample.t.toFixed(1)}s 出现超调峰值 ${peakSample.v.toFixed(2)} ${unit}（相对基准 ${refVal.toFixed(2)} ${unit} 超调 ${overshoot.toFixed(2)} ${unit}）。`,
        socraticQuestion: `第${stepSeq}步中 ${primaryLabel} 在 t=${peakSample.t.toFixed(1)}s 出现了 +${overshoot.toFixed(2)} ${unit} 的超调峰值。从二阶惯性滞后、比例/微分/积分项分配或非线性效应看，是什么主导了这个峰值？`,
        antiGhostwriting: true,
      });
    }
  }

  // 4. Wave modulation detection.
  const wave = estimateWaveModulation(timeS, values);
  if (wave) {
    anomalies.push({
      id: `${shipKey}-step${stepSeq}-wave`,
      kind: 'wave_modulation',
      badgeLabel: '波频周期调制',
      timeS: wave.timeS,
      valueLabel: `高频摆幅 ${wave.peakToPeak.toFixed(2)} ${unit}`,
      snapshotSummary: `第${stepSeq}步 ${primaryLabel}于 t=${wave.timeS.toFixed(1)}s 周围呈现高频波频调制（局地峰峰值 ${wave.peakToPeak.toFixed(2)} ${unit}）。`,
      socraticQuestion: `第${stepSeq}步测量曲线带有明显的高频波频调制（约 ${wave.peakToPeak.toFixed(2)} ${unit} 峰峰值）。在观测器滤波与执行器带宽之间应如何权衡，才不会把波浪能量误当作低频稳态误差去跟踪？`,
      antiGhostwriting: true,
    });
  }

  return sortByPriority(anomalies);
}
