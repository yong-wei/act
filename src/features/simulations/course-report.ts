import type { StudentModelSaveInput } from '@/lib/student-model-artifact-contract';
import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselModelComparison } from '@/resources/simulations/experiments/student-analysis';
import { studentModelFormula } from '@/resources/simulations/experiments/student-model-presentation';
import { VESSEL_REPORT_SECTION_LABELS } from '@/features/ilab/course-artifact-contract';
import type { VesselStepReview } from '@/features/ilab/course-report-review-contract';

export interface VesselReportEvidence {
  runs:Array<{id:string;stepSequence:number;timeS:number;status:string;configuration:VesselSessionConfiguration;
    input:VesselSessionInput;metrics?:Record<string,number|null>;fineStepMetrics?:VesselSessionFrame['fineStepMetrics']}>;
  models:Array<{label:string;payload:Pick<StudentModelSaveInput,'structure'|'ioContract'|'operatingPoint'|'trainingRuns'>;frozenAtMs:number}>;
  comparisons:Array<Pick<VesselModelComparison,'runId'|'mode'|'purpose'|'timeS'|'actual'|'predicted'|'metrics'|'outputUnit'|'actualHeadingDeg'|'predictedHeadingDeg'>>;
}

const escapeHtml = (value:unknown) => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const number = (value:number|null|undefined,digits = 3) => value === null || value === undefined || !Number.isFinite(value) ? '未获得有效值' : value.toFixed(digits);

/** 仅将已保存的本人证据排版，正文推理始终来自学生填写的六部分。 */
export function buildVesselCourseReportHtml(title:string,sections:Record<string,string>,evidence?:VesselReportEvidence) {
  const body = Object.entries(VESSEL_REPORT_SECTION_LABELS).map(([key,label]) =>
    `<section><h2>${label}</h2><p>${escapeHtml(sections[key] ?? '').replace(/\n/g,'<br>')}</p></section>`).join('\n');
  const runLabels = new Map(evidence?.runs.map((run,index)=>[run.id,`运行${index+1}（第${run.stepSequence}步）`]));
  const runs = evidence?.runs.map((run,index)=> {
    const metrics = run.metrics;
    const fine = run.fineStepMetrics;
    return `<article><h3>运行${index+1} · 第${run.stepSequence}步 · ${number(run.timeS,1)} s</h3>
      <p>${run.status === 'failed' ? '数值运行中断' : run.status === 'running' ? '采集中' : '已结束'}，初始航速 ${number(run.configuration.initialWaterSpeedMps,1)} m/s，随机种子 ${escapeHtml(run.configuration.seed)}，环境 ${escapeHtml(run.configuration.environment)}，噪声 ${escapeHtml(run.configuration.noiseLevel)}</p>
      <p>控制器 ${escapeHtml(run.input.controlMode.toUpperCase())}，Kp=${number(run.input.pid.kp,5)}，Ki=${number(run.input.pid.ki,5)}，Kd=${number(run.input.pid.kd,5)}，微分滤波 ${number(run.input.derivativeFilterTauS ?? .2)} s</p>
      ${metrics ? `<p>20Hz量测航向RMSE ${number(metrics.headingRmseDeg)}°，末120s平均绝对误差 ${number(metrics.final120sHeadingMaeDeg)}°，超调 ${number(metrics.headingOvershootPercent)}%，调节时间 ${metrics.settlingTimeS == null ? '末段尚未持续保持60s' : `${number(metrics.settlingTimeS)} s`}，舵角总变差 ${number(metrics.rudderTotalVariationDeg)}°</p>` : ''}
      ${fine ? `<p>120Hz物理细步最大横摇 ${number(fine.values.maximumRollDeg)}°，超过${number(fine.rollWarningDeg,1)}°累计 ${number(fine.values.rollWarningDurationS)} s，单轴功率峰值 ${number(fine.values.maximumShaftPowerW/1e6)} MW，正机械功 ${number(fine.values.positiveMotorWorkJ/1e6)} MJ</p>
      <p>约束违反持续时间，舵角 ${number(fine.values.surfaceAngleViolationS,4)} s，舵速 ${number(fine.values.surfaceRateViolationS,4)} s，轴速 ${number(fine.values.shaftSpeedViolationS,4)} s，单轴功率 ${number(fine.values.shaftPowerViolationS,4)} s，系统功率 ${number(fine.values.systemPowerViolationS,4)} s</p>` : ''}</article>`;
  }).join('\n') ?? '';
  const models = evidence?.models.map((model,index)=>`<article><h3>本人冻结模型${index+1} · ${escapeHtml(model.label)}</h3>
    <p>${escapeHtml(studentModelFormula(model.payload.structure))}</p>
    <pre>${escapeHtml(JSON.stringify(model.payload.structure,null,2))}</pre>
    <p>冻结于 ${escapeHtml(new Date(model.frozenAtMs).toLocaleString('zh-CN'))}，输入输出单位 ${escapeHtml(model.payload.ioContract.inputUnit)} → ${escapeHtml(model.payload.ioContract.outputUnit)}</p>
    <p>训练窗口 ${model.payload.trainingRuns.map((window)=>`${escapeHtml(runLabels.get(window.runRef) ?? '本人训练运行')} ${number(window.startS,2)}–${number(window.endS,2)} s`).join('，')}</p>
    <p>${typeof model.payload.operatingPoint.speedMps === 'number' ? `辨识运行初始航速 ${number(model.payload.operatingPoint.speedMps)} m/s，窗口内实际航速及其变化以计程仪量测为依据。` : '采用本人已保存的辨识工作点'}</p></article>`).join('\n') ?? '';
  const comparisons = evidence?.comparisons.map((comparison,index)=>`<article><h3>独立对照${index+1} · ${escapeHtml(runLabels.get(comparison.runId) ?? '本人运行')}</h3>
    <p>${{hull_model:'A · 实际执行器量测驱动船体模型',command_to_output:'B · 指令经舵机模型驱动船体模型',independent_closed_loop:'C · 独立闭环'}[comparison.mode]}，${comparison.purpose === 'forecast' ? '运行前冻结预测' : '独立验证'}</p>
    ${lineChart(comparison.timeS,comparison.actual,comparison.predicted,comparison.outputUnit ?? '输出量')}
    ${comparison.predictedHeadingDeg?.length ? lineChart(comparison.timeS,comparison.actualHeadingDeg ?? [],comparison.predictedHeadingDeg,'航向 °') : ''}
    <p>RMSE ${number(comparison.metrics.rmse)}，FIT ${number(comparison.metrics.fit_percent)}%，最大绝对误差 ${number(comparison.metrics.peak_error)}</p></article>`).join('\n') ?? '';
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
