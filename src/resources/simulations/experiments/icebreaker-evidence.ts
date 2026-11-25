import type {VesselRunSummary} from '@/features/simulations/local-evidence-store';
import {stableStringify} from '@/lib/control-engine/envelope';
import type {VesselCourseEvidence} from './course-adapter';
import {ICEBREAKER_COURSE_STEPS,type IcebreakerCourseStep} from './icebreaker-course';

function controller(run:VesselRunSummary,variable?:'filter'|'schedule'|'ramp'|'gains') {
  const input=run.initialInput;
  const settings=run.courseSettings;
  return stableStringify([run.designStudentModelId,input.controlMode,
    variable==='gains' ? null : [input.pid.kp,input.pid.ki,input.pid.kd],
    variable==='filter' ? null : input.derivativeFilterTauS,
    variable==='schedule' ? null : input.iceHeadingSchedule,
    variable==='ramp' ? null : settings?.rampS,
    input.longitudinal ? {...input.longitudinal, filterTauS: variable==='filter' ? undefined : input.longitudinal.filterTauS} : undefined,
    settings?.speedReferenceMps, settings?.headingBiasDeg ?? 0]);
}

function condition(run:VesselRunSummary) {
  const c=run.configuration;
  return stableStringify([c.initialWaterSpeedMps,c.environment,c.environmentSwitches,c.noiseLevel,c.seed,
    c.ice?.thicknessM,c.ice?.flexuralStrengthPa,c.azimuthJamFault]);
}

export function validateIcebreakerEvidence(step:IcebreakerCourseStep,evidence:VesselCourseEvidence):string|null {
  const {runs,models,comparisons,answers}=evidence;
  const complete=(run:VesselRunSummary)=>run.stoppedAtMs!==null && run.stopReason!=='failure'
    && (run.stopReason==='arrival'
      || run.lastTimeS+1e-7>=(ICEBREAKER_COURSE_STEPS[run.stepSequence-1]?.runDurationS??Infinity)
      || (run.stepSequence===19 && run.configuration.azimuthJamFault && run.courseSettings?.stopOnJam
        && run.stopReason==='student' && run.lastTimeS>=180));
  const own=runs.filter((run)=>run.stepSequence===step.sequence && complete(run));
  const ids=new Set(own.map((run)=>run.id));
  const hull=models.filter((model)=>model.channel==='azimuth-to-yaw');
  if (step.sequence!==20 && (!answers.prediction?.trim() || !answers.observation?.trim() || !answers.interpretation?.trim())) {
    return '请保存运行前预测、本人观察及机理解释。';
  }
  if (step.stepKind==='run' && own.length<step.minimumRuns) return `本步需要${step.minimumRuns}组完整运行，未达性能目标的记录继续保留。`;
  if (step.sequence===9 && !runs.some((run)=>run.stepSequence===8 && complete(run))) {
    return '请在评估页签打开本人第8步的接触记录，选择事件窗口并解释各项力与功。';
  }
  if (step.sequence===2 && !models.some((model)=>model.channel==='azimuth-servo'
    && model.payload.trainingRuns.some((window)=>ids.has(window.runRef)))) return '请从本步实际吊舱量测辨识并冻结伺服模型。';
  if (step.sequence===3 && !hull.some((model)=>model.payload.trainingRuns.some((window)=>ids.has(window.runRef)))) {
    return '请在评估页签冻结本步实际等效偏转—转艏速率模型。';
  }
  if ([4,10,11].includes(step.sequence) && !comparisons.some((comparison)=>ids.has(comparison.runId)
    && comparison.purpose!=='forecast' && comparison.actualSampleCount>0
    && hull.some((model)=>model.id===comparison.modelId))) return '请保存本步本人局部模型的独立量测对照。';
  if (step.closedLoop && !own.every((run)=>hull.some((model)=>model.id===run.designStudentModelId
    && model.createdAtMs<=run.createdAtMs))) return '控制运行须引用开始前已冻结的本人吊舱模型。';
  if (step.closedLoop && !own.every((run)=>comparisons.some((comparison)=>comparison.runId===run.id
    && comparison.purpose==='forecast' && comparison.modelId===run.designStudentModelId
    && comparison.createdAtMs<=run.createdAtMs
    && stableStringify(comparison.controllerInput)===stableStringify(run.initialInput)))) {
    return '请在每次闭环开始前冻结对应本人模型与控制方案的独立预测。';
  }
  const pair=(variable:'filter'|'schedule'|'ramp'|'gains',different:(a:VesselRunSummary,b:VesselRunSummary)=>boolean)=>
    own.some((first,index)=>own.slice(index+1).some((second)=>condition(first)===condition(second)
      && controller(first,variable)===controller(second,variable) && different(first,second)));
  if (step.sequence===5 && !pair('gains',(a,b)=>stableStringify(a.initialInput.pid)!==stableStringify(b.initialInput.pid))) {
    return '请固定工况并保留两组不同增益的实际闭环运行。';
  }
  if (step.sequence===6 && ![.5,4].every((speed)=>own.some((run)=>run.configuration.initialWaterSpeedMps===speed))) {
    return '请保留0.5和4m/s两种初态的低速能力对照。';
  }
  if (step.sequence===7 && !pair('filter',(a,b)=>a.initialInput.derivativeFilterTauS!==b.initialInput.derivativeFilterTauS)) {
    return '请固定其余条件，比较至少两档测量微分滤波。';
  }
  if (step.sequence===11 && !hull.some((model)=>model.payload.trainingRuns.some((window)=>ids.has(window.runRef)))) {
    return '请从本步冰区窗口辨识局部模型，并保留非重叠验证窗口。';
  }
  if (step.sequence===12 && ![.3,.6,.9].every((h)=>own.some((run)=>run.configuration.ice?.thicknessM===h))) {
    return '请保留0.30、0.60和0.90m冰厚的同推进计划对照。';
  }
  if (step.sequence===13 && ![350000,650000].every((strength)=>own.some((run)=>run.configuration.ice?.flexuralStrengthPa===strength))) {
    return '请保留相同冰厚下0.35和0.65MPa强度的对照。';
  }
  if (step.sequence===14 && !pair('schedule',(a,b)=>Boolean(a.initialInput.iceHeadingSchedule)!==Boolean(b.initialInput.iceHeadingSchedule))) {
    return '请保留固定控制器与本人两工况调度的同条件对照。';
  }
  if (step.sequence===15 && !pair('ramp',(a,b)=>a.courseSettings?.rampS!==b.courseSettings?.rampS)) {
    return '请保留同一终值和控制器的10与60秒参考斜坡。';
  }
  if (step.sequence===16 && ![.5,1,1.5].every((speed)=>own.some((run)=>run.configuration.initialWaterSpeedMps===speed))) {
    return '请比较0.5、1和1.5m/s三种推进初态。';
  }
  if (step.sequence===18 && !own.some((run)=>runs.some((source)=>source.stepSequence===17 && complete(source)
    && condition(source)===condition(run) && controller(source)!==controller(run)))) {
    return '请保留同一工况的第17步方案，再运行一项有依据的策略修正。';
  }
  if (step.sequence===19 && (![17,29].every((seed)=>own.some((run)=>run.configuration.seed===seed
    && !run.configuration.azimuthJamFault)) || !own.some((run)=>run.configuration.azimuthJamFault))) {
    return '请分别保留两种未见冰况的原方案验证，以及180秒吊舱卡滞运行。';
  }
  if (step.sequence===19 && !runs.some((source)=>[17,18].includes(source.stepSequence) && complete(source)
    && [17,29].every((seed)=>own.some((run)=>run.configuration.seed===seed && !run.configuration.azimuthJamFault
      && run.createdAtMs>=source.createdAtMs && controller(run)===controller(source))))) {
    return '请保持第17或18步本人已保存的完整控制方案，完成两种未见冰况的验证。';
  }
  if (step.sequence===20) {
    if (new Set(runs.filter(complete).map((run)=>run.id)).size<6) return '报告需要引用至少六组本人完整运行。';
    if (['problem','identification','validation','comparison','revision','conclusion'].some((key)=>!answers[key]?.trim())) {
      return '请完成报告六部分的证据、推理与适用范围。';
    }
    const runIds=new Set(runs.map((run)=>run.id));
    if (!hull.some((model)=>model.payload.trainingRuns.some((window)=>runIds.has(window.runRef)))
      || !comparisons.some((comparison)=>runIds.has(comparison.runId) && comparison.actualSampleCount>0)) {
      return '报告引用须覆盖本人辨识与独立验证。';
    }
  }
  return null;
}
