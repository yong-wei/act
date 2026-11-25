import type { StudentModelSaveInput } from '@/lib/student-model-artifact-contract';
import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselModelComparison } from '@/resources/simulations/experiments/student-analysis';
import { studentModelFormula } from '@/resources/simulations/experiments/student-model-presentation';
import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import type { VesselStepReview } from '@/features/ilab/course-report-review-contract';
import { VESSEL_COURSES, VESSEL_GUIDE_EDITION } from '@/resources/simulations/experiments/course-catalog';
import { VESSEL_COURSE_VERSION } from '@/resources/simulations/experiments/destroyer-course';

export interface VesselReportEvidence {
  runs:Array<{id:string;stepSequence:number;timeS:number;status:string;configuration:VesselSessionConfiguration;
    input:VesselSessionInput;metrics?:Record<string,number|null>;fineStepMetrics?:VesselSessionFrame['fineStepMetrics'];
    parameters?:VesselSessionFrame['parameters'];fuelKg?:number;
    cruiseComfort?:VesselSessionFrame['cruiseComfort'];
    voyage?:NonNullable<VesselSessionFrame['containerVoyage']>['progress']}>;
  models:Array<{id?:string;label:string;payload:Pick<StudentModelSaveInput,'structure'|'ioContract'|'operatingPoint'|'trainingRuns'>;frozenAtMs:number}>;
  comparisons:Array<Pick<VesselModelComparison,'runId'|'modelId'|'actuatorModelId'|'mode'|'purpose'|'timeS'|'actual'|'predicted'|'metrics'|'outputUnit'|'actualHeadingDeg'|'predictedHeadingDeg'|'actualEastM'|'predictedEastM'|'actualBowClearanceM'|'predictedBowClearanceM'>>;
}

const escapeHtml = (value:unknown) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const number = (value:number|null|undefined,digits = 3) => value === null || value === undefined || !Number.isFinite(value) ? '未获得有效值' : value.toFixed(digits);

const REPORT_STYLES = `
:root{--ink:#102a43;--muted:#486581;--navy:#0f2942;--teal:#0b7285;--amber:#b45309;--border:#d9e2ec;--surface:#f8fafc;--card:#ffffff;--accent-bg:#eff6ff}
*{box-sizing:border-box}
body{font:15px/1.75 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Noto Sans SC",system-ui,sans-serif;color:var(--ink);background:#f1f5f9;margin:0;padding:24px 16px}
.report-shell{max-width:1040px;margin:0 auto;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:32px 36px;box-shadow:0 4px 20px rgba(15,41,66,.06)}
.report-header{border-bottom:2px solid var(--navy);padding-bottom:20px;margin-bottom:28px}
.project-badge{display:inline-block;background:var(--navy);color:#fff;font-size:12px;font-weight:600;letter-spacing:.03em;padding:4px 10px;border-radius:6px;margin-bottom:10px}
h1{font-size:26px;line-height:1.3;margin:0 0 8px;color:var(--navy)}
.lead-status{margin:0 0 14px;color:var(--muted);font-size:14px}
.meta-strip{display:flex;flex-wrap:wrap;gap:10px 16px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--muted)}
.meta-strip a.guide-link{display:inline-block;background:#fff;border:1px solid var(--teal);color:var(--teal);text-decoration:none;font-weight:600;padding:2px 10px;border-radius:999px;font-size:12px}
.meta-pill{display:inline-flex;align-items:center;gap:4px;background:#fff;border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:12px;color:var(--ink);font-variant-numeric:tabular-nums}
h2{font-size:18px;line-height:1.4;color:var(--navy);border-bottom:1px solid var(--border);padding-bottom:8px;margin:28px 0 14px;display:flex;align-items:center;gap:8px}
.sec-index{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:6px;background:var(--accent-bg);color:var(--navy);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}
h3{font-size:15px;line-height:1.45;color:var(--navy);margin:0 0 10px;display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}
article{break-inside:avoid;border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin:14px 0;background:#fff}
.prose-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin:10px 0 18px}
.prose-card p{margin:0;white-space:normal}
.kv-row{margin:6px 0;font-size:14px;color:#243b53}
.status-tag{display:inline-block;padding:1px 8px;border-radius:999px;font-size:12px;font-weight:600;border:1px solid var(--border);background:var(--surface)}
.status-ok{color:#0b7285;border-color:#99e9f2;background:#e6fcf5}
.status-warn{color:#b45309;border-color:#fcd34d;background:#fffbeb}
.formula-box{background:var(--accent-bg);border-left:4px solid var(--teal);padding:10px 14px;border-radius:6px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;color:var(--navy);margin:8px 0 10px}
pre{overflow:auto;white-space:pre-wrap;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:12px;line-height:1.5;margin:8px 0}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;font-variant-numeric:tabular-nums}
th,td{border:1px solid var(--border);padding:8px 10px;text-align:left;vertical-align:top}
th{background:var(--navy);color:#fff;font-weight:600;white-space:nowrap}
tbody tr:nth-child(even){background:var(--surface)}
tfoot td{background:#e2e8f0;font-weight:700;color:var(--navy)}
.num{text-align:right;white-space:nowrap}
.chart-wrap{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin:10px 0}
svg{width:100%;height:auto;display:block}
.legend{font-size:12px;color:var(--muted);margin:6px 0 0;display:flex;align-items:center;gap:14px}
.legend-dot{display:inline-block;width:12px;height:3px;border-radius:2px;vertical-align:middle;margin-right:5px}
.metric-banner{background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px;font-weight:600;color:var(--navy);margin-top:8px;font-variant-numeric:tabular-nums}
.final-summary{display:flex;flex-wrap:wrap;gap:16px;align-items:center;background:linear-gradient(135deg,#0f2942,#164e63);color:#fff;border-radius:10px;padding:18px 22px;margin:14px 0 18px;break-inside:avoid}
.final-score{font-size:32px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}
.final-meta{flex:1;min-width:240px;font-size:14px;line-height:1.6}
@media print{
  body{background:#fff;margin:0;padding:0}
  .report-shell{border:none;box-shadow:none;max-width:none;padding:12mm}
  article,.final-summary,.prose-card,tr{break-inside:avoid}
  th{background:#0f2942 !important;color:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .final-summary{background:#0f2942 !important;color:#fff !important;-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;

function runStatusLabel(status: string): string {
  return status === 'failed' ? '数值运行中断' : status === 'running' ? '采集中' : '已结束';
}

function summarizeRunKeyMetric(run: VesselReportEvidence['runs'][number]): string {
  const m = run.metrics;
  if (run.voyage?.termination) {
    return `航程 ${number(run.voyage.northM, 1)} m · 燃油 ${number(run.fuelKg, 0)} kg`;
  }
  if (run.cruiseComfort) {
    return `横摇 RMS ${number(run.cruiseComfort.rollRmsDeg, 2)}° · 峰值 ${number(run.cruiseComfort.rollPeakDeg, 2)}°`;
  }
  if (m?.positionRmsM !== undefined) {
    return `定位 RMS ${number(m.positionRmsM, 2)} m · 航向 RMS ${number(m.headingRmsDeg, 2)}°`;
  }
  if (m?.dredgerProductionM3 !== undefined) {
    return `产量 ${number(m.dredgerProductionM3, 1)} m³ · 横移 RMS ${number(m.dredgerSwayRmsMps, 3)} m/s`;
  }
  if (m?.actualDistanceM !== undefined) {
    return `航程 ${number(m.actualDistanceM, 1)} m · 横偏 ${number(m.maximumCrossTrackM, 1)} m`;
  }
  if (m?.headingRmseDeg !== undefined) {
    return `航向 RMSE ${number(m.headingRmseDeg, 2)}° · 超调 ${number(m.headingOvershootPercent, 1)}%`;
  }
  return '已保存完整仿真样本';
}

/** 仅将已保存的本人证据排版，正文推理始终来自学生填写的六部分。 */
export function buildVesselCourseReportHtml(title:string,sections:Record<string,string>,evidence?:VesselReportEvidence) {
  const orderedRuns = evidence ? [...evidence.runs].sort((a,b) => a.stepSequence - b.stepSequence) : [];
  const course = Object.values(VESSEL_COURSES).find((entry) => entry.vessel === orderedRuns[0]?.configuration.vessel);
  const guide = course
    ? `<div class="meta-strip"><span>课程版本 ${escapeHtml(VESSEL_COURSE_VERSION)}，指导书版本 ${escapeHtml(VESSEL_GUIDE_EDITION)}。</span><a class="guide-link" href="https://act.adapt-learn.online/supporting/${VESSEL_GUIDE_EDITION}/${course.guideFile}">查看本版实验指导书</a><span class="meta-pill">运行记录 ${orderedRuns.length} 次</span><span class="meta-pill">冻结模型 ${evidence?.models.length ?? 0} 个</span><span class="meta-pill">独立对照 ${evidence?.comparisons.length ?? 0} 组</span></div>`
    : evidence
      ? `<div class="meta-strip"><span>课程版本 ${escapeHtml(VESSEL_COURSE_VERSION)}</span><span class="meta-pill">运行记录 ${orderedRuns.length} 次</span><span class="meta-pill">冻结模型 ${evidence.models.length} 个</span><span class="meta-pill">独立对照 ${evidence.comparisons.length} 组</span></div>`
      : '';
  const body = Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key,label], index) => {
    const rawText = (sections[key] ?? '').trim();
    const formatted = rawText ? escapeHtml(rawText).replace(/\n/g,'<br>') : '本节暂未填写说明。';
    return `<section><h2><span class="sec-index">0${index + 1}</span>${escapeHtml(label)}</h2><div class="prose-card"><p>${formatted}</p></div></section>`;
  }).join('\n');
  const runLabels = new Map(orderedRuns.map((run,index)=>[run.id,`运行${index+1}（第${run.stepSequence}步）`]));
  const modelLabels = new Map(evidence?.models.flatMap((model,index)=>model.id
    ? [[model.id,`本人冻结模型${index+1}`] as const] : []));
  const runSummaryTable = orderedRuns.length
    ? `<table><thead><tr><th>运行</th><th>步序</th><th class="num">仿真时长 (s)</th><th>状态</th><th>工况环境 / 控制器</th><th>核心指标摘要</th></tr></thead><tbody>${orderedRuns.map((run, index) =>
      `<tr><td>运行${index + 1}</td><td>第${run.stepSequence}步</td><td class="num">${number(run.timeS, 1)}</td><td>${runStatusLabel(run.status)}</td><td>${escapeHtml(run.configuration.environment)} / ${escapeHtml(run.configuration.noiseLevel)} · ${escapeHtml(run.input.controlMode.toUpperCase())}</td><td>${escapeHtml(summarizeRunKeyMetric(run))}</td></tr>`).join('')}</tbody></table>`
    : '';
  const runs = orderedRuns.map((run,index)=> {
    const metrics = run.metrics;
    const fine = run.fineStepMetrics;
    const voyage = run.voyage;
    const statusText = runStatusLabel(run.status);
    const statusClass = run.status === 'failed' ? 'status-tag status-warn' : 'status-tag status-ok';
    return `<article><h3><span>运行${index+1} · 第${run.stepSequence}步 · ${number(run.timeS,1)} s</span><span class="${statusClass}">${statusText}</span></h3>
      <p class="kv-row">${statusText}，初始航速 ${number(run.configuration.initialWaterSpeedMps,1)} m/s，随机种子 ${escapeHtml(run.configuration.seed)}，环境 ${escapeHtml(run.configuration.environment)}，噪声 ${escapeHtml(run.configuration.noiseLevel)}</p>
      <p class="kv-row">航向控制器 ${escapeHtml(run.input.controlMode.toUpperCase())}，Kp=${number(run.input.pid.kp,5)}，Ki=${number(run.input.pid.ki,5)}，Kd=${number(run.input.pid.kd,5)}，微分滤波 ${number(run.input.derivativeFilterTauS ?? .2)} s</p>
      ${run.parameters ? `<p class="kv-row">装载率 ${number(run.configuration.loadingRatio,2)}，质量 ${number(run.parameters.massKg/1e6)} 千吨，吃水 ${number(run.parameters.draftM)} m，横稳心高 ${number(run.parameters.effectiveGmTransverseM)} m${run.parameters.windAreasM2 ? `，正向/侧向风面积 ${number(run.parameters.windAreasM2.frontal,1)}/${number(run.parameters.windAreasM2.lateral,1)} m²` : ''}。</p>` : ''}
      ${run.input.containerSpeed ? `<p class="kv-row">航速采用本人三点模型，${run.input.containerSpeed.schedulingEnabled ? '线性增益调度' : '固定中间工作点PI'}，无扰积分跟踪${run.input.containerSpeed.bumpless ? '开启' : '关闭'}，反馈${run.input.containerSpeed.feedback === 'water' ? '对水计程仪' : '低频对地估计'}，Kp/Ti倍率 ${number(run.input.containerSpeed.kpMultiplier,2)}/${number(run.input.containerSpeed.tiMultiplier,2)}。</p>` : ''}
      ${run.input.semisubDp ? `<p class="kv-row">定位闭环带宽 ${number(run.input.semisubDp.bandwidthRadS)}rad/s，积分时间 ${number(run.input.semisubDp.integralTimeS,1)}s，积分${run.input.semisubDp.integralEnabled ? '开启' : '关闭'}，反馈采用${run.input.semisubDp.feedback === 'raw' ? '原始量测' : '低频观测器'}，观测截止 ${number(run.input.semisubDp.lowFrequencyCutoffHz)}Hz。本人模型交叉补偿${run.input.semisubDp.decoupling ? '开启' : '关闭'}，测量风前馈${run.input.semisubDp.windFeedforward ? '开启' : '关闭'}。</p>
      <p class="kv-row">推进采用${run.input.semisubDp.allocation === 'pseudoinverse' ? '加权伪逆' : '顺序凸约束分配'}，任务权重 ${run.input.semisubDp.axisWeights.map((value) => number(value,2)).join('，')}，节能权重 ${number(run.input.semisubDp.energyWeight,2)}，失效重新分配${run.input.semisubDp.reallocate ? '开启' : '关闭'}，缺测策略${{predict:'继续模型预测',freeze_integral:'继续预测并冻结积分',safe_exit:'退出定位并降低出力'}[run.input.semisubDp.navigationLossStrategy]}。</p>` : ''}
      ${run.configuration.waveTableProfile === 'teaching-v1'
        ? '<p class="kv-row">差频载荷复用已有结果的16个代表频率、9个波向及插值，按50%幅值统计容差验收，适用于低频定位与控制因果比较。相同对照使用同一版本与随机种子。</p>'
        : run.configuration.waveFrequencyBins === 16 ? '<p class="kv-row">波浪载荷复用已有一阶与完整差频数据，采用16个代表频率及7个方向。固定姿态600s对照中，纵向和艏摇一阶载荷均方根与完整频谱分别相差约39%和31%，适用于本课低频定位与控制因果比较，具体误差随工况变化。</p>' : ''}
      ${run.configuration.meanWaveResistanceModel ? '<p class="kv-row">已启用T级教学平均附加阻力。迎浪短波反射尺度采用ITTC 2024程序7.5-04-01-01.1附录G.1，方向扩展及跨装载复用为教学假设。参考范围为航速6至12m/s、波高不超过1.5m、谱峰波长不超过半船长。标称的0.5至1.5倍为假设敏感性范围，真实误差尚未校准。平均阻力和水线作用点力矩共同参与物理运动，燃油由实际轴功率积分。<a href="https://www.ittc.info/media/11972/75-04-01-011.pdf">ITTC原始程序</a></p>' : ''}
      ${run.configuration.containerVoyage ? `<p class="kv-row">6000m航次，四段速度 ${run.configuration.containerVoyage.segmentSpeedsMps.map((speed) => number(speed,2)).join('，')} m/s，教学估计燃油 ${number(run.fuelKg)} kg。</p>` : ''}
      ${voyage ? `<p class="kv-row">实际航程 ${number(voyage.northM)} m，横偏峰值 ${number(voyage.maximumCrossTrackM)} m，末段航向平均绝对误差 ${number(voyage.finalSegmentDurationS > 0 ? voyage.finalSegmentHeadingIntegralDegS/voyage.finalSegmentDurationS : null)}°，${voyage.termination?.reason === 'arrived' ? '已实际到达' : voyage.termination?.reason === 'time_limit' ? '达到运行时限' : '航次尚未结束'}，结束航速 ${number(voyage.termination?.finalWaterSpeedMps)} m/s。</p>` : ''}
      ${run.cruiseComfort ? `<p class="kv-row">教学舒适性代理采用120Hz刚体运动，统计窗 ${number(run.cruiseComfort.statisticsWindowS[0],1)}至${number(run.cruiseComfort.statisticsWindowS[1],1)}s，实际统计${number(run.cruiseComfort.durationS,1)}s。横摇RMS/峰值 ${number(run.cruiseComfort.rollRmsDeg)}/${number(run.cruiseComfort.rollPeakDeg)}°，角速度RMS ${number(run.cruiseComfort.rollRateRmsDegS)}°/s。</p>
      <p class="kv-row">主推进正功 ${number(run.cruiseComfort.positivePropulsionWorkJ/1e6)}MJ，鳍伺服电能 ${number(run.cruiseComfort.finServoElectricWorkJ/1e6)}MJ。</p>
      ${run.cruiseComfort.passengers.map((point,idx) => `<p class="kv-row">乘客点${idx+1}，坐标(${point.positionBodyM.map((v)=>number(v,1)).join('，')})m，水平加速度RMS/峰值 ${number(point.horizontalAccelerationRmsMps2)}/${number(point.horizontalAccelerationPeakMps2)}m/s²，总加速度RMS/峰值 ${number(point.accelerationRmsMps2)}/${number(point.accelerationPeakMps2)}m/s²，jerk RMS ${number(point.jerkRmsMps3)}m/s³。</p>`).join('')}` : ''}
      ${run.input.longitudinal ? `<p class="kv-row">纵向PI采用${run.configuration.vessel === 'icebreaker-xuelong2' ? 'T级推进平衡点与60秒标称时间尺度' : '本人冻结的局部模型'}，Kp为IMC建议值的${number(run.input.longitudinal.kpMultiplier,2)}倍，Ti为模型时间常数的${number(run.input.longitudinal.tiMultiplier,2)}倍，量测滤波${number(run.input.longitudinal.filterTauS,2)} s，积分回算${run.input.longitudinal.antiWindup ? '开启' : '关闭'}，Smith结构${run.input.longitudinal.smithEnabled ? '开启' : '关闭'}，额外命令时延${number(run.input.longitudinal.additionalCommandDelayS,1)} s。</p>` : ''}
      ${run.configuration.dredger ? `<p class="kv-row">天鲸T级作业机构，土层采用${run.configuration.dredger.soil === 'sand' ? '饱和砂' : '均质黏土'}，工作水深20m。钢桩和弹性悬链线参与六自由度，桥架200t包含在同一船舶总质量中，绞刀18齿按实际刀位和新移除体积累计产量。能耗范围为绞刀、横移绞车和推进轴系。切削采用Miedema局部二维条带教学近似。<a href="https://doi.org/10.5074/t.2019.001">Miedema原始模型</a></p>` : ''}
      ${run.input.dredger ? `<p class="kv-row">横移参考${number(run.input.dredger.referenceMps)}m/s，半幅${number(run.input.dredger.halfAngleDeg,1)}°，换向斜坡${number(run.input.dredger.reversalRampS,1)}s，深度目标${number(run.input.dredger.commands.depthReferenceM)}m，绞刀参考${number(run.input.dredger.commands.cutterRpm,1)}rpm。本人局部模型的Kp/Ti倍率${number(run.input.dredger.kpMultiplier,2)}/${number(run.input.dredger.tiMultiplier,2)}，进入保持${number(run.input.dredger.entryHoldS,1)}s，提前中止阈值倍率${number(run.input.dredger.safetyFraction,2)}。积分采用${{track:'输出跟踪',freeze:'冻结',reset:'直接重置'}[run.input.dredger.integralPolicy]}，深度/横移滤波${number(run.input.dredger.depthFilterTauS)}/${number(run.input.dredger.swayFilterTauS)}s。</p>` : ''}
      ${metrics?.dredgerProductionM3 !== undefined ? `<p class="kv-row">末180秒实际切削样本的横移RMS${number(metrics.dredgerSwayRmsMps)}m/s、深度RMS${number(metrics.dredgerDepthRmsM)}m，教学目标分别0.02m/s、0.15m。实际切削模式${number(metrics.dredgerCutDurationS)}s，实际移除${number(metrics.dredgerProductionM3)}m³，正机械功${number(metrics.dredgerMechanicalWorkJ == null ? null : metrics.dredgerMechanicalWorkJ/1e6)}MJ，单位实际产量能耗${number(metrics.dredgerSpecificEnergyJPerM3 == null ? null : metrics.dredgerSpecificEnergyJPerM3/1e6)}MJ/m³。</p>
      <p class="kv-row">物理细步的张力/钢桩反力峰值${number((metrics.dredgerMaximumCableTensionN ?? 0)/1000)}/${number((metrics.dredgerMaximumSpudReactionN ?? 0)/1000)}kN，机构硬约束违反${number(metrics.dredgerHardViolationDurationS,4)}s，切削适用域越界${number(metrics.dredgerSoilDomainViolationDurationS,4)}s。实际换向${number(metrics.dredgerReversalCount,0)}次，反复切换${number(metrics.dredgerChatterEventCount,0)}次。断缆后停止指令${number(metrics.dredgerStopCommandAfterFaultS)}s，安全抬刀${number(metrics.dredgerLiftAfterFaultS)}s。</p>` : ''}
      ${run.configuration.ice ? `<p class="kv-row">平整无雪冰厚${number(run.configuration.ice.thicknessM,2)}m，抗弯强度${number(run.configuration.ice.flexuralStrengthPa/1e6,2)}MPa，摩擦系数${number(run.configuration.ice.frictionCoefficient,2)}。接触采用T级条带冰板与有限浮冰近似，省略浮冰间挤压与裂纹传播。</p>` : ''}
      ${run.input.iceHeadingSchedule ? `<p class="kv-row">按已声明冰厚${number(run.input.iceHeadingSchedule.declaredThicknessM,2)}m，在本人开水与冰区两份局部模型的控制增益间插值。</p>` : ''}
      ${metrics?.actualDistanceM !== undefined ? `<p class="kv-row">实际航程${number(metrics.actualDistanceM)}m，终点北向${number(metrics.finalNorthM)}m，${metrics.iceTaskCompleted == null ? '到达状态待核对' : metrics.iceTaskCompleted ? '已到达北向800m' : '尚未到达北向800m'}，最大横偏${number(metrics.maximumCrossTrackM)}m，最长前进停滞${number(metrics.stallDurationS)}s，单位实际航程能量${number(metrics.energyPerDistanceJPerM == null ? null : metrics.energyPerDistanceJPerM/1000)}kJ/m。${metrics.eligibleForEnergyComparison ? '已到达且保持通道，可结合响应与约束比较能耗。' : '保留观察与工程判断，本次结果不进入能耗排序。'}</p>` : ''}
      ${run.input.berthPlan ? `<p class="kv-row">减速起点${number(run.input.berthPlan.brakingDistanceM,1)} m，速度计划${run.input.berthPlan.nodes.map((node) => `${number(node.distanceM,1)} m处${number(node.speedMps,2)} m/s`).join('，')}。</p>
      ${run.input.berthPlan.headingNodes ? `<p class="kv-row">时序航向计划${run.input.berthPlan.headingNodes.map((node) => `${number(node.timeS,1)} s处${number(node.headingDeg,2)}°`).join('，')}，相邻节点线性过渡。</p>` : ''}` : ''}
      ${metrics ? `<p class="kv-row">20Hz量测航向RMSE ${number(metrics.headingRmseDeg)}°，末120s平均绝对误差 ${number(metrics.final120sHeadingMaeDeg)}°，超调 ${number(metrics.headingOvershootPercent)}%，调节时间 ${metrics.settlingTimeS == null ? '末段尚未持续保持60s' : `${number(metrics.settlingTimeS)} s`}，${run.configuration.vessel === 'icebreaker-xuelong2' ? '等效偏转' : '舵角'}总变差 ${number(metrics.rudderTotalVariationDeg)}°</p>` : ''}
      ${metrics?.positionRmsM !== undefined ? `<p class="kv-row">末180s实际位置RMS ${number(metrics.positionRmsM)}m，航向RMS ${number(metrics.headingRmsDeg)}°，最大位置误差 ${number(metrics.maximumPositionErrorM)}m，归一化分配残差RMS ${number(metrics.normalizedAllocationResidualRms)}。</p>` : ''}
      ${fine ? `<p class="kv-row">120Hz物理细步最大横摇 ${number(fine.values.maximumRollDeg)}°，超过${number(fine.rollWarningDeg,1)}°累计 ${number(fine.values.rollWarningDurationS)} s，单轴功率峰值 ${number(fine.values.maximumShaftPowerW/1e6)} MW，正机械功 ${number(fine.values.positiveMotorWorkJ/1e6)} MJ</p>
      <p class="kv-row">约束违反持续时间，操纵面角 ${number(fine.values.surfaceAngleViolationS,4)} s，操纵面速率 ${number(fine.values.surfaceRateViolationS,4)} s，轴速 ${number(fine.values.shaftSpeedViolationS,4)} s，单轴功率 ${number(fine.values.shaftPowerViolationS,4)} s，系统功率 ${number(fine.values.systemPowerViolationS,4)} s</p>
      ${fine.values.lng ? `<p class="kv-row">120Hz全程液面角点峰值 ${number(fine.values.lng.maximumCornerHeightM)} m，均方根 ${number(run.timeS > 0 ? Math.sqrt(fine.values.lng.cornerHeightSquaredIntegralM2S/run.timeS) : null)} m，超出液舱小幅适用域 ${number(fine.values.lng.outsideLiquidDomainDurationS,4)} s。</p>
      <p class="kv-row">结束时船艏剩余距离 ${number(fine.values.lng.finalBowClearanceM)} m，北向对地航速 ${number(fine.values.lng.finalNorthGroundSpeedMps)} m/s，航向 ${number(fine.values.lng.finalHeadingDeg)}°，末${number(fine.values.lng.lateralWindowDurationS,1)} s最大横偏 ${number(fine.values.lng.final60sLateralMaximumM)} m。</p>` : ''}` : ''}</article>`;
  }).join('\n') ?? '';
  const models = evidence?.models.map((model,index)=>`<article><h3><span>本人冻结模型${index+1} · ${escapeHtml(model.label)}</span><span class="meta-pill">输入输出 ${escapeHtml(model.payload.ioContract.inputUnit)} → ${escapeHtml(model.payload.ioContract.outputUnit)}</span></h3>
    <div class="formula-box">${escapeHtml(studentModelFormula(model.payload.structure))}</div>
    <pre>${escapeHtml(JSON.stringify(model.payload.structure,null,2))}</pre>
    ${model.payload.structure.kind === 'nomoto1' && model.payload.structure.t_s < 0 ? '<p class="kv-row">该局部模型具有开环不稳定极点。PD设计需满足K·Kp/T大于0及(1+K·Kd)/T大于0，适用范围由本人训练窗口、误差与独立验证确定。</p>' : ''}
    <p class="kv-row">冻结于 ${escapeHtml(new Date(model.frozenAtMs).toLocaleString('zh-CN'))}，输入输出单位 ${escapeHtml(model.payload.ioContract.inputUnit)} → ${escapeHtml(model.payload.ioContract.outputUnit)}</p>
    <p class="kv-row">训练窗口 ${model.payload.trainingRuns.map((window)=>`${escapeHtml(runLabels.get(window.runRef) ?? '本人训练运行')} ${number(window.startS,2)}–${number(window.endS,2)} s`).join('，')}</p>
    <p class="kv-row">${typeof model.payload.operatingPoint.speedMps === 'number' ? `辨识运行初始航速 ${number(model.payload.operatingPoint.speedMps)} m/s，窗口内实际航速及其变化以计程仪量测为依据。` : '采用本人已保存的辨识工作点'}</p></article>`).join('\n') ?? '';
  const comparisons = evidence?.comparisons.map((comparison,index)=> {
    const jointReferenceModel = evidence.models.some((model)=>model.id === comparison.modelId
      && ['ShaftReference0', 'WinchReferenceDifferential'].includes(model.payload.ioContract.inputChannel));
    const azimuthModel = evidence.models.some((model)=>model.id === comparison.modelId
      && model.payload.ioContract.inputChannel === 'EquivalentAzimuth');
    const modeLabel = comparison.mode === 'command_to_output' && jointReferenceModel
      ? 'B · 指令经联合模型驱动输出'
      : {hull_model:'A · 实际执行器量测驱动船体模型',command_to_output:`B · 指令经${azimuthModel ? '吊舱伺服' : '舵机'}模型驱动船体模型`,independent_closed_loop:'C · 独立闭环'}[comparison.mode];
    const fit = comparison.metrics.fit_percent == null ? '不适用' : `${number(comparison.metrics.fit_percent)}%`;
    return `<article><h3><span>独立对照${index+1} · ${escapeHtml(runLabels.get(comparison.runId) ?? '本人运行')}</span><span class="meta-pill">${comparison.purpose === 'forecast' ? '运行前冻结预测' : '独立验证'}</span></h3>
    <p class="kv-row">${modeLabel}，${comparison.purpose === 'forecast' ? '运行前冻结预测' : '独立验证'}</p>
    <p class="kv-row">计算模型 ${escapeHtml(modelLabels.get(comparison.modelId) ?? '已保存的本人模型')}${comparison.actuatorModelId
      ? `，执行器采用${escapeHtml(modelLabels.get(comparison.actuatorModelId) ?? '已保存的执行器模型')}` : ''}，分析窗口 ${number(comparison.timeS[0],2)}–${number(comparison.timeS.at(-1),2)} s</p>
    ${lineChart(comparison.timeS,comparison.actual,comparison.predicted,comparison.outputUnit ?? '输出量')}
    ${comparison.predictedEastM?.length ? lineChart(comparison.timeS,comparison.actualEastM ?? [],comparison.predictedEastM,'东向位置 m') : ''}
    ${comparison.predictedHeadingDeg?.length ? lineChart(comparison.timeS,comparison.actualHeadingDeg ?? [],comparison.predictedHeadingDeg,'航向 °') : ''}
    ${comparison.predictedBowClearanceM?.length ? lineChart(comparison.timeS,comparison.actualBowClearanceM ?? [],comparison.predictedBowClearanceM,'船艏剩余距离 m') : ''}
    ${comparison.metrics.ideal_arrival_s !== undefined ? `<p class="kv-row">理想到达时间 ${comparison.metrics.ideal_arrival_s === null ? '窗口内未到达' : `${number(comparison.metrics.ideal_arrival_s,1)} s`}，理想燃油 ${number(comparison.metrics.ideal_fuel_kg)} kg，采用固定工作点速度立方近似与教学发动机曲线。</p>` : ''}
    <div class="metric-banner">${comparison.purpose === 'forecast' ? '运行前预测的误差指标待独立验证后生成。'
      : `RMSE ${number(comparison.metrics.rmse)} ${escapeHtml(comparison.outputUnit ?? '')}，FIT ${fit}，最大绝对误差 ${number(comparison.metrics.peak_error)} ${escapeHtml(comparison.outputUnit ?? '')}`}</div></article>`;
  }).join('\n') ?? '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}实验报告</title>
    <style>${REPORT_STYLES}</style></head>
    <body><main class="report-shell"><header class="report-header"><div class="project-badge">面向深远海作业的船舶智能航行与动力定位控制虚拟仿真实验 · 课程实验报告</div><h1>${escapeHtml(title)}实验报告</h1><p class="lead-status">学生说明与本人已保存证据。待评分项由教师复核确认。</p>${guide}</header>${body}
    ${evidence ? `<section><h2><span class="sec-index">07</span>本人运行与确定性指标</h2>${runSummaryTable}${runs}</section><section><h2><span class="sec-index">08</span>冻结模型与参数</h2>${models}</section><section><h2><span class="sec-index">09</span>预测、独立验证与曲线</h2>${comparisons}<p class="lead-status">报告曲线为显示摘要，原始20Hz记录、原生传感器序列及物理细步事件窗口随运行证据保存。</p></section>` : ''}</main></body></html>`;
}

function lineChart(time:number[],actual:Array<number|null>,predicted:number[],unit:string) {
  const values = [...actual,...predicted].filter((value):value is number=>value !== null && Number.isFinite(value));
  if (!time.length || !values.length) return '<p class="kv-row">尚无有效曲线。</p>';
  const rawMin = values.reduce((a,b)=>Math.min(a,b),Infinity);
  const rawMax = values.reduce((a,b)=>Math.max(a,b),-Infinity);
  const pad = Math.max((rawMax - rawMin) * 0.08, 1e-6);
  const minimum = rawMin - pad * 0.2;
  const maximum = rawMax + pad * 0.2;
  const timeStart = time[0],timeEnd = time.at(-1)!;
  const x = (t:number) => 68+790*(t-timeStart)/Math.max(timeEnd-timeStart,1e-9);
  const y = (v:number) => 226-184*(v-minimum)/Math.max(maximum-minimum,1e-9);
  const hGrid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const py = (42 + 184 * ratio).toFixed(1);
    const val = number(maximum - (maximum - minimum) * ratio, 2);
    return `<line x1="68" y1="${py}" x2="858" y2="${py}" stroke="#e2e8f0" stroke-dasharray="3 3"/><text x="62" y="${py}" text-anchor="end" dominant-baseline="middle" font-size="11" fill="#486581">${val}</text>`;
  }).join('');
  const vGrid = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const px = (68 + 790 * ratio).toFixed(1);
    const tVal = number(timeStart + (timeEnd - timeStart) * ratio, 1);
    return `<line x1="${px}" y1="42" x2="${px}" y2="226" stroke="#e2e8f0" stroke-dasharray="3 3"/><text x="${px}" y="246" text-anchor="middle" font-size="11" fill="#486581">${tVal} s</text>`;
  }).join('');
  const path = (series:Array<number|null>,color:string, dashed = false) => {
    const stride = Math.max(1,Math.ceil(time.length/800));
    let move = true;
    const points:string[] = [];
    for (let index = 0;index < time.length;index++) {
      const value = series[index];
      if (value == null || !Number.isFinite(value)) { move = true;continue; }
      if (index%stride !== 0 && index !== time.length-1) continue;
      points.push(`${move ? 'M' : 'L'}${x(time[index]).toFixed(2)} ${y(value).toFixed(2)}`);move = false;
    }
    const dashAttr = dashed ? ' stroke-dasharray="6 4"' : '';
    return `<path d="${points.join(' ')}" stroke="${color}" fill="none" stroke-width="2"${dashAttr}/>`;
  };
  return `<div class="chart-wrap"><svg viewBox="0 0 900 268" role="img" aria-label="测量与学生模型预测曲线"><rect x="68" y="42" width="790" height="184" fill="#ffffff" rx="4"/>${hGrid}${vGrid}<path d="M68 42 V226 H858" stroke="#627d98" stroke-width="1.2" fill="none"/><text x="68" y="24" font-size="12" font-weight="600" fill="#102a43">物理量：${escapeHtml(unit)}</text>${path(actual,'#0b7285')}${path(predicted,'#b45309', true)}</svg><p class="legend"><span><i class="legend-dot" style="background:#0b7285"></i>实测</span><span><i class="legend-dot" style="background:#b45309"></i>学生模型预测（虚线）</span><span>· 青色为测量，棕色为学生模型预测。</span></p></div>`;
}

export function finalizeVesselReportHtml(html:string,review:{score:number;reviewerName:string;confirmedAt:Date;
  feedback:string;steps:VesselStepReview[]}) {
  const ordered = [...review.steps].sort((a, b) => a.stepSequence - b.stepSequence);
  let sumPred = 0;
  let sumOp = 0;
  let sumPerf = 0;
  let sumInterp = 0;
  const rows = ordered.map((step)=>{
    const p = step.prediction ?? 0;
    const o = step.operation ?? 0;
    const pf = step.performance ?? 0;
    const i = step.interpretation ?? 0;
    const total = p + o + pf + i;
    sumPred += p;
    sumOp += o;
    sumPerf += pf;
    sumInterp += i;
    return `<tr><td>第${step.stepSequence}步</td><td class="num">${number(step.prediction,2)}</td>
    <td class="num">${number(step.operation,2)}</td><td class="num">${number(step.performance,2)}</td><td class="num">${number(step.interpretation,2)}</td>
    <td class="num">${number(total,2)}</td><td>${escapeHtml(step.feedback)}</td></tr>`;
  }).join('');
  const rawTotal = sumPred + sumOp + sumPerf + sumInterp;
  const result = `<section><h2><span class="sec-index">10</span>教师最终评价</h2><div class="final-summary"><div><div style="font-size:12px;opacity:.85">最终总评成绩</div><div class="final-score">${review.score} <span style="font-size:16px;font-weight:500">/ 100 分</span></div></div><div class="final-meta"><div>最终成绩 ${review.score}/100分，确认教师 ${escapeHtml(review.reviewerName)}，确认于 ${escapeHtml(review.confirmedAt.toLocaleString('zh-CN'))}</div><div style="margin-top:4px;opacity:.92">${escapeHtml(review.feedback).replace(/\n/g,'<br>')}</div></div></div><table><thead><tr><th>步骤</th><th class="num">预测</th><th class="num">操作</th><th class="num">性能</th><th class="num">解释</th><th class="num">小计</th><th>教师评语</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td>合计</td><td class="num">${number(sumPred,2)}</td><td class="num">${number(sumOp,2)}</td><td class="num">${number(sumPerf,2)}</td><td class="num">${number(sumInterp,2)}</td><td class="num">${number(rawTotal,2)}</td><td>最终取整得分：${review.score} 分</td></tr></tfoot></table></section>`;
  const closingTag = html.includes('</main>') ? '</main>' : '</body>';
  return html.replace('学生说明与本人已保存证据。待评分项由教师复核确认。','学生说明、本人已保存证据与教师确认的最终评价。')
    .replace(closingTag,`${result}${closingTag}`);
}
