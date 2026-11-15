import type { StudentModelSaveInput } from '@/lib/student-model-artifact-contract';
import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselModelComparison } from '@/resources/simulations/experiments/student-analysis';
import { studentModelFormula } from '@/resources/simulations/experiments/student-model-presentation';
import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import type { VesselStepReview } from '@/features/ilab/course-report-review-contract';

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

/** 仅将已保存的本人证据排版，正文推理始终来自学生填写的六部分。 */
export function buildVesselCourseReportHtml(title:string,sections:Record<string,string>,evidence?:VesselReportEvidence) {
  const body = Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key,label]) =>
    `<section><h2>${label}</h2><p>${escapeHtml(sections[key] ?? '').replace(/\n/g,'<br>')}</p></section>`).join('\n');
  const runLabels = new Map(evidence?.runs.map((run,index)=>[run.id,`运行${index+1}（第${run.stepSequence}步）`]));
  const modelLabels = new Map(evidence?.models.flatMap((model,index)=>model.id
    ? [[model.id,`本人冻结模型${index+1}`] as const] : []));
  const runs = evidence?.runs.map((run,index)=> {
    const metrics = run.metrics;
    const fine = run.fineStepMetrics;
    const voyage = run.voyage;
    return `<article><h3>运行${index+1} · 第${run.stepSequence}步 · ${number(run.timeS,1)} s</h3>
      <p>${run.status === 'failed' ? '数值运行中断' : run.status === 'running' ? '采集中' : '已结束'}，初始航速 ${number(run.configuration.initialWaterSpeedMps,1)} m/s，随机种子 ${escapeHtml(run.configuration.seed)}，环境 ${escapeHtml(run.configuration.environment)}，噪声 ${escapeHtml(run.configuration.noiseLevel)}</p>
      <p>航向控制器 ${escapeHtml(run.input.controlMode.toUpperCase())}，Kp=${number(run.input.pid.kp,5)}，Ki=${number(run.input.pid.ki,5)}，Kd=${number(run.input.pid.kd,5)}，微分滤波 ${number(run.input.derivativeFilterTauS ?? .2)} s</p>
      ${run.parameters ? `<p>装载率 ${number(run.configuration.loadingRatio,2)}，质量 ${number(run.parameters.massKg/1e6)} 千吨，吃水 ${number(run.parameters.draftM)} m，横稳心高 ${number(run.parameters.effectiveGmTransverseM)} m${run.parameters.windAreasM2 ? `，正向/侧向风面积 ${number(run.parameters.windAreasM2.frontal,1)}/${number(run.parameters.windAreasM2.lateral,1)} m²` : ''}。</p>` : ''}
      ${run.input.containerSpeed ? `<p>航速采用本人三点模型，${run.input.containerSpeed.schedulingEnabled ? '线性增益调度' : '固定中间工作点PI'}，无扰积分跟踪${run.input.containerSpeed.bumpless ? '开启' : '关闭'}，反馈${run.input.containerSpeed.feedback === 'water' ? '对水计程仪' : '低频对地估计'}，Kp/Ti倍率 ${number(run.input.containerSpeed.kpMultiplier,2)}/${number(run.input.containerSpeed.tiMultiplier,2)}。</p>` : ''}
      ${run.input.semisubDp ? `<p>定位闭环带宽 ${number(run.input.semisubDp.bandwidthRadS)}rad/s，积分时间 ${number(run.input.semisubDp.integralTimeS,1)}s，积分${run.input.semisubDp.integralEnabled ? '开启' : '关闭'}，反馈采用${run.input.semisubDp.feedback === 'raw' ? '原始量测' : '低频观测器'}，观测截止 ${number(run.input.semisubDp.lowFrequencyCutoffHz)}Hz。本人模型交叉补偿${run.input.semisubDp.decoupling ? '开启' : '关闭'}，测量风前馈${run.input.semisubDp.windFeedforward ? '开启' : '关闭'}。</p>
      <p>推进采用${run.input.semisubDp.allocation === 'pseudoinverse' ? '加权伪逆' : '顺序凸约束分配'}，任务权重 ${run.input.semisubDp.axisWeights.map((value) => number(value,2)).join('，')}，节能权重 ${number(run.input.semisubDp.energyWeight,2)}，失效重新分配${run.input.semisubDp.reallocate ? '开启' : '关闭'}，缺测策略${{predict:'继续模型预测',freeze_integral:'继续预测并冻结积分',safe_exit:'退出定位并降低出力'}[run.input.semisubDp.navigationLossStrategy]}。</p>` : ''}
      ${run.configuration.waveTableProfile === 'teaching-v1'
        ? '<p>差频载荷复用已有结果的16个代表频率、9个波向及插值，按50%幅值统计容差验收，适用于低频定位与控制因果比较。相同对照使用同一版本与随机种子。</p>'
        : run.configuration.waveFrequencyBins === 16 ? '<p>波浪载荷复用已有一阶与完整差频数据，采用16个代表频率及7个方向。固定姿态600s对照中，纵向和艏摇一阶载荷均方根与完整频谱分别相差约39%和31%，适用于本课低频定位与控制因果比较，具体误差随工况变化。</p>' : ''}
      ${run.configuration.meanWaveResistanceModel ? '<p>已启用T级教学平均附加阻力。迎浪短波反射尺度采用ITTC 2024程序7.5-04-01-01.1附录G.1，方向扩展及跨装载复用为教学假设。参考范围为航速6至12m/s、波高不超过1.5m、谱峰波长不超过半船长。标称的0.5至1.5倍为假设敏感性范围，真实误差尚未校准。平均阻力和水线作用点力矩共同参与物理运动，燃油由实际轴功率积分。<a href="https://www.ittc.info/media/11972/75-04-01-011.pdf">ITTC原始程序</a></p>' : ''}
      ${run.configuration.containerVoyage ? `<p>6000m航次，四段速度 ${run.configuration.containerVoyage.segmentSpeedsMps.map((speed) => number(speed,2)).join('，')} m/s，教学估计燃油 ${number(run.fuelKg)} kg。</p>` : ''}
      ${voyage ? `<p>实际航程 ${number(voyage.northM)} m，横偏峰值 ${number(voyage.maximumCrossTrackM)} m，末段航向平均绝对误差 ${number(voyage.finalSegmentDurationS > 0 ? voyage.finalSegmentHeadingIntegralDegS/voyage.finalSegmentDurationS : null)}°，${voyage.termination?.reason === 'arrived' ? '已实际到达' : voyage.termination?.reason === 'time_limit' ? '达到运行时限' : '航次尚未结束'}，结束航速 ${number(voyage.termination?.finalWaterSpeedMps)} m/s。</p>` : ''}
      ${run.cruiseComfort ? `<p>教学舒适性代理采用120Hz刚体运动，统计窗 ${number(run.cruiseComfort.statisticsWindowS[0],1)}至${number(run.cruiseComfort.statisticsWindowS[1],1)}s，实际统计${number(run.cruiseComfort.durationS,1)}s。横摇RMS/峰值 ${number(run.cruiseComfort.rollRmsDeg)}/${number(run.cruiseComfort.rollPeakDeg)}°，角速度RMS ${number(run.cruiseComfort.rollRateRmsDegS)}°/s。</p>
      <p>主推进正功 ${number(run.cruiseComfort.positivePropulsionWorkJ/1e6)}MJ，鳍伺服电能 ${number(run.cruiseComfort.finServoElectricWorkJ/1e6)}MJ。</p>
      ${run.cruiseComfort.passengers.map((point,index) => `<p>乘客点${index+1}，坐标(${point.positionBodyM.map((v)=>number(v,1)).join('，')})m，水平加速度RMS/峰值 ${number(point.horizontalAccelerationRmsMps2)}/${number(point.horizontalAccelerationPeakMps2)}m/s²，总加速度RMS/峰值 ${number(point.accelerationRmsMps2)}/${number(point.accelerationPeakMps2)}m/s²，jerk RMS ${number(point.jerkRmsMps3)}m/s³。</p>`).join('')}` : ''}
      ${run.input.longitudinal ? `<p>纵向PI采用${run.configuration.vessel === 'icebreaker-xuelong2' ? 'T级推进平衡点与60秒标称时间尺度' : '本人冻结的局部模型'}，Kp为IMC建议值的${number(run.input.longitudinal.kpMultiplier,2)}倍，Ti为模型时间常数的${number(run.input.longitudinal.tiMultiplier,2)}倍，量测滤波${number(run.input.longitudinal.filterTauS,2)} s，积分回算${run.input.longitudinal.antiWindup ? '开启' : '关闭'}，Smith结构${run.input.longitudinal.smithEnabled ? '开启' : '关闭'}，额外命令时延${number(run.input.longitudinal.additionalCommandDelayS,1)} s。</p>` : ''}
      ${run.configuration.ice ? `<p>平整无雪冰厚${number(run.configuration.ice.thicknessM,2)}m，抗弯强度${number(run.configuration.ice.flexuralStrengthPa/1e6,2)}MPa，摩擦系数${number(run.configuration.ice.frictionCoefficient,2)}。接触采用T级条带冰板与有限浮冰近似，省略浮冰间挤压与裂纹传播。</p>` : ''}
      ${run.input.iceHeadingSchedule ? `<p>按已声明冰厚${number(run.input.iceHeadingSchedule.declaredThicknessM,2)}m，在本人开水与冰区两份局部模型的控制增益间插值。</p>` : ''}
      ${metrics?.actualDistanceM !== undefined ? `<p>实际航程${number(metrics.actualDistanceM)}m，终点北向${number(metrics.finalNorthM)}m，${metrics.iceTaskCompleted == null ? '到达状态待核对' : metrics.iceTaskCompleted ? '已到达北向800m' : '尚未到达北向800m'}，最大横偏${number(metrics.maximumCrossTrackM)}m，最长前进停滞${number(metrics.stallDurationS)}s，单位实际航程能量${number(metrics.energyPerDistanceJPerM == null ? null : metrics.energyPerDistanceJPerM/1000)}kJ/m。${metrics.eligibleForEnergyComparison ? '已到达且保持通道，可结合响应与约束比较能耗。' : '保留观察与工程判断，本次结果不进入能耗排序。'}</p>` : ''}
      ${run.input.berthPlan ? `<p>减速起点${number(run.input.berthPlan.brakingDistanceM,1)} m，速度计划${run.input.berthPlan.nodes.map((node) => `${number(node.distanceM,1)} m处${number(node.speedMps,2)} m/s`).join('，')}。</p>
      ${run.input.berthPlan.headingNodes ? `<p>时序航向计划${run.input.berthPlan.headingNodes.map((node) => `${number(node.timeS,1)} s处${number(node.headingDeg,2)}°`).join('，')}，相邻节点线性过渡。</p>` : ''}` : ''}
      ${metrics ? `<p>20Hz量测航向RMSE ${number(metrics.headingRmseDeg)}°，末120s平均绝对误差 ${number(metrics.final120sHeadingMaeDeg)}°，超调 ${number(metrics.headingOvershootPercent)}%，调节时间 ${metrics.settlingTimeS == null ? '末段尚未持续保持60s' : `${number(metrics.settlingTimeS)} s`}，${run.configuration.vessel === 'icebreaker-xuelong2' ? '等效偏转' : '舵角'}总变差 ${number(metrics.rudderTotalVariationDeg)}°</p>` : ''}
      ${metrics?.positionRmsM !== undefined ? `<p>末180s实际位置RMS ${number(metrics.positionRmsM)}m，航向RMS ${number(metrics.headingRmsDeg)}°，最大位置误差 ${number(metrics.maximumPositionErrorM)}m，归一化分配残差RMS ${number(metrics.normalizedAllocationResidualRms)}。</p>` : ''}
      ${fine ? `<p>120Hz物理细步最大横摇 ${number(fine.values.maximumRollDeg)}°，超过${number(fine.rollWarningDeg,1)}°累计 ${number(fine.values.rollWarningDurationS)} s，单轴功率峰值 ${number(fine.values.maximumShaftPowerW/1e6)} MW，正机械功 ${number(fine.values.positiveMotorWorkJ/1e6)} MJ</p>
      <p>约束违反持续时间，操纵面角 ${number(fine.values.surfaceAngleViolationS,4)} s，操纵面速率 ${number(fine.values.surfaceRateViolationS,4)} s，轴速 ${number(fine.values.shaftSpeedViolationS,4)} s，单轴功率 ${number(fine.values.shaftPowerViolationS,4)} s，系统功率 ${number(fine.values.systemPowerViolationS,4)} s</p>
      ${fine.values.lng ? `<p>120Hz全程液面角点峰值 ${number(fine.values.lng.maximumCornerHeightM)} m，均方根 ${number(run.timeS > 0 ? Math.sqrt(fine.values.lng.cornerHeightSquaredIntegralM2S/run.timeS) : null)} m，超出液舱小幅适用域 ${number(fine.values.lng.outsideLiquidDomainDurationS,4)} s。</p>
      <p>结束时船艏剩余距离 ${number(fine.values.lng.finalBowClearanceM)} m，北向对地航速 ${number(fine.values.lng.finalNorthGroundSpeedMps)} m/s，航向 ${number(fine.values.lng.finalHeadingDeg)}°，末${number(fine.values.lng.lateralWindowDurationS,1)} s最大横偏 ${number(fine.values.lng.final60sLateralMaximumM)} m。</p>` : ''}` : ''}</article>`;
  }).join('\n') ?? '';
  const models = evidence?.models.map((model,index)=>`<article><h3>本人冻结模型${index+1} · ${escapeHtml(model.label)}</h3>
    <p>${escapeHtml(studentModelFormula(model.payload.structure))}</p>
    <pre>${escapeHtml(JSON.stringify(model.payload.structure,null,2))}</pre>
    ${model.payload.structure.kind === 'nomoto1' && model.payload.structure.t_s < 0 ? '<p>该局部模型具有开环不稳定极点。PD设计需满足K·Kp/T大于0及(1+K·Kd)/T大于0，适用范围由本人训练窗口、误差与独立验证确定。</p>' : ''}
    <p>冻结于 ${escapeHtml(new Date(model.frozenAtMs).toLocaleString('zh-CN'))}，输入输出单位 ${escapeHtml(model.payload.ioContract.inputUnit)} → ${escapeHtml(model.payload.ioContract.outputUnit)}</p>
    <p>训练窗口 ${model.payload.trainingRuns.map((window)=>`${escapeHtml(runLabels.get(window.runRef) ?? '本人训练运行')} ${number(window.startS,2)}–${number(window.endS,2)} s`).join('，')}</p>
    <p>${typeof model.payload.operatingPoint.speedMps === 'number' ? `辨识运行初始航速 ${number(model.payload.operatingPoint.speedMps)} m/s，窗口内实际航速及其变化以计程仪量测为依据。` : '采用本人已保存的辨识工作点'}</p></article>`).join('\n') ?? '';
  const comparisons = evidence?.comparisons.map((comparison,index)=> {
    const jointReferenceModel = evidence.models.some((model)=>model.id === comparison.modelId
      && model.payload.ioContract.inputChannel === 'ShaftReference0');
    const azimuthModel = evidence.models.some((model)=>model.id === comparison.modelId
      && model.payload.ioContract.inputChannel === 'EquivalentAzimuth');
    const modeLabel = comparison.mode === 'command_to_output' && jointReferenceModel
      ? 'B · 指令经联合模型驱动输出'
      : {hull_model:'A · 实际执行器量测驱动船体模型',command_to_output:`B · 指令经${azimuthModel ? '吊舱伺服' : '舵机'}模型驱动船体模型`,independent_closed_loop:'C · 独立闭环'}[comparison.mode];
    const fit = comparison.metrics.fit_percent == null ? '不适用' : `${number(comparison.metrics.fit_percent)}%`;
    return `<article><h3>独立对照${index+1} · ${escapeHtml(runLabels.get(comparison.runId) ?? '本人运行')}</h3>
    <p>${modeLabel}，${comparison.purpose === 'forecast' ? '运行前冻结预测' : '独立验证'}</p>
    <p>计算模型 ${escapeHtml(modelLabels.get(comparison.modelId) ?? '已保存的本人模型')}${comparison.actuatorModelId
      ? `，执行器采用${escapeHtml(modelLabels.get(comparison.actuatorModelId) ?? '已保存的执行器模型')}` : ''}，分析窗口 ${number(comparison.timeS[0],2)}–${number(comparison.timeS.at(-1),2)} s</p>
    ${lineChart(comparison.timeS,comparison.actual,comparison.predicted,comparison.outputUnit ?? '输出量')}
    ${comparison.predictedEastM?.length ? lineChart(comparison.timeS,comparison.actualEastM ?? [],comparison.predictedEastM,'东向位置 m') : ''}
    ${comparison.predictedHeadingDeg?.length ? lineChart(comparison.timeS,comparison.actualHeadingDeg ?? [],comparison.predictedHeadingDeg,'航向 °') : ''}
    ${comparison.predictedBowClearanceM?.length ? lineChart(comparison.timeS,comparison.actualBowClearanceM ?? [],comparison.predictedBowClearanceM,'船艏剩余距离 m') : ''}
    ${comparison.metrics.ideal_arrival_s !== undefined ? `<p>理想到达时间 ${comparison.metrics.ideal_arrival_s === null ? '窗口内未到达' : `${number(comparison.metrics.ideal_arrival_s,1)} s`}，理想燃油 ${number(comparison.metrics.ideal_fuel_kg)} kg，采用固定工作点速度立方近似与教学发动机曲线。</p>` : ''}
    <p>${comparison.purpose === 'forecast' ? '运行前预测的误差指标待独立验证后生成。'
      : `RMSE ${number(comparison.metrics.rmse)} ${escapeHtml(comparison.outputUnit ?? '')}，FIT ${fit}，最大绝对误差 ${number(comparison.metrics.peak_error)} ${escapeHtml(comparison.outputUnit ?? '')}`}</p></article>`;
  }).join('\n') ?? '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>
    <style>body{font:16px/1.7 system-ui,sans-serif;color:#172b3a;max-width:1000px;margin:32px auto;padding:0 24px}h1,h2,h3{line-height:1.4}h2{border-bottom:1px solid #ccd6dd;padding-bottom:8px}article{break-inside:avoid;border:1px solid #dce3e8;border-radius:8px;padding:16px;margin:16px 0}pre{overflow:auto;white-space:pre-wrap}svg{width:100%;height:auto}section{margin:32px 0}.legend{font-size:13px}@media print{body{margin:0;max-width:none}article{break-inside:avoid}}</style></head>
    <body><h1>${escapeHtml(title)}实验报告</h1><p>学生说明与本人已保存证据。待评分项由教师复核确认。</p>${body}
    ${evidence ? `<section><h2>本人运行与确定性指标</h2>${runs}</section><section><h2>冻结模型与参数</h2>${models}</section><section><h2>预测、独立验证与曲线</h2>${comparisons}<p>报告曲线为显示摘要，原始20Hz记录、原生传感器序列及物理细步事件窗口随运行证据保存。</p></section>` : ''}</body></html>`;
}

function lineChart(time:number[],actual:Array<number|null>,predicted:number[],unit:string) {
  const values = [...actual,...predicted].filter((value):value is number=>value !== null && Number.isFinite(value));
  if (!time.length || !values.length) return '<p>尚无有效曲线。</p>';
  const minimum = values.reduce((a,b)=>Math.min(a,b),Infinity), maximum = values.reduce((a,b)=>Math.max(a,b),-Infinity);
  const timeStart = time[0],timeEnd = time.at(-1)!;
  const x = (t:number) => 60+800*(t-timeStart)/Math.max(timeEnd-timeStart,1e-9);
  const y = (v:number) => 230-190*(v-minimum)/Math.max(maximum-minimum,1e-9);
  const path = (series:Array<number|null>,color:string) => {
    const stride = Math.max(1,Math.ceil(time.length/800));
    let move = true;
    const points:string[] = [];
    for (let index = 0;index < time.length;index++) {
      const value = series[index];
      if (value == null || !Number.isFinite(value)) { move = true;continue; }
      if (index%stride !== 0 && index !== time.length-1) continue;
      points.push(`${move ? 'M' : 'L'}${x(time[index]).toFixed(2)} ${y(value).toFixed(2)}`);move = false;
    }
    return `<path d="${points.join(' ')}" stroke="${color}" fill="none" stroke-width="1.5"/>`;
  };
  return `<svg viewBox="0 0 900 280" role="img" aria-label="测量与学生模型预测曲线"><path d="M60 30 V230 H865" stroke="#667988" fill="none"/>
    <text x="10" y="20" font-size="12">${escapeHtml(unit)}</text><text x="10" y="45" font-size="11">${number(maximum)}</text><text x="10" y="230" font-size="11">${number(minimum)}</text>
    <text x="60" y="250" font-size="12">${number(timeStart,1)} s</text><text x="790" y="250" font-size="12">${number(timeEnd,1)} s</text>
    ${path(actual,'#007b83')}${path(predicted,'#b06413')}</svg><p class="legend">青色为测量，棕色为学生模型预测。</p>`;
}

export function finalizeVesselReportHtml(html:string,review:{score:number;reviewerName:string;confirmedAt:Date;
  feedback:string;steps:VesselStepReview[]}) {
  const rows = review.steps.map((step)=>`<tr><td>第${step.stepSequence}步</td><td>${number(step.prediction,2)}</td>
    <td>${number(step.operation,2)}</td><td>${number(step.performance,2)}</td><td>${number(step.interpretation,2)}</td>
    <td>${escapeHtml(step.feedback)}</td></tr>`).join('');
  const result = `<section><h2>教师最终评价</h2><p>最终成绩 ${review.score}/100分，确认教师 ${escapeHtml(review.reviewerName)}，确认于 ${escapeHtml(review.confirmedAt.toLocaleString('zh-CN'))}</p>
    <p>${escapeHtml(review.feedback).replace(/\n/g,'<br>')}</p><table><thead><tr><th>步骤</th><th>预测</th><th>操作</th><th>性能</th><th>解释</th><th>教师评语</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  return html.replace('学生说明与本人已保存证据。待评分项由教师复核确认。','学生说明、本人已保存证据与教师确认的最终评价。')
    .replace('</body>',`${result}</body>`);
}
