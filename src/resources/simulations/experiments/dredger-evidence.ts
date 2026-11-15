import type {VesselRunSummary} from '@/features/simulations/local-evidence-store';
import type {VesselDredgerInput} from '@/lib/control-engine/vessel-session';
import type {VesselCourseEvidence} from './course-adapter';
import {DREDGER_COURSE_STEPS, type DredgerCourseStep} from './dredger-course';
import {stableStringify} from '@/lib/control-engine/envelope';

function complete(run: VesselRunSummary) {
  return run.stoppedAtMs !== null && run.stopReason !== 'failure'
    && run.lastTimeS + 1e-7 >= (DREDGER_COURSE_STEPS[run.stepSequence - 1]?.runDurationS ?? Infinity);
}
function controller(run: VesselRunSummary, variable?: keyof VesselDredgerInput) {
  const input = {...run.initialInput.dredger};
  if (variable) delete input[variable];
  return stableStringify([run.designStudentModelId, input]);
}
function condition(run: VesselRunSummary, ignoreWave = false) {
  const configuration = {...run.configuration};
  if (ignoreWave) {
    configuration.environmentSwitches = {...configuration.environmentSwitches!, wave_enabled: false};
    configuration.environmentOverrides = {...configuration.environmentOverrides};
    delete configuration.environmentOverrides.wave;
  }
  return stableStringify(configuration);
}
function variables(run: VesselRunSummary) {
  const input = run.initialInput.dredger;
  return input ? [input.referenceMps, input.halfAngleDeg, input.kpMultiplier, input.tiMultiplier,
    input.reversalRampS, input.entrySpeedMps, input.entryHoldS, input.safetyFraction,
    input.integralPolicy, input.depthFilterTauS, input.swayFilterTauS,
    input.commands.cutterRpm, input.commands.depthReferenceM] : [];
}

export function validateDredgerEvidence(step: DredgerCourseStep, evidence: VesselCourseEvidence): string | null {
  const {runs, models, comparisons, answers} = evidence;
  const own = runs.filter((run) => run.stepSequence === step.sequence && complete(run));
  const ids = new Set(own.map((run) => run.id));
  const joint = models.filter((model) => model.channel === 'winch-reference-to-sway');
  const actualModels = models.filter((model) => model.channel === 'winch-speed-to-sway');
  const compared = comparisons.filter((comparison) => ids.has(comparison.runId)
    && comparison.purpose !== 'forecast' && comparison.actualSampleCount > 0);
  if (step.sequence !== 20 && ['prediction', 'observation', 'interpretation'].some((key) => !answers[key]?.trim())) {
    return '请保存运行前预测、本人观察与证据解释。';
  }
  if (step.stepKind === 'run' && own.length < step.minimumRuns) return `本步需要${step.minimumRuns}组完整运行，安全退出与未达性能目标的记录继续保留。`;
  if (step.sequence === 4 && !['port', 'starboard'].every((cable) => own.some((run) => run.courseSettings?.manualCable === cable))) {
    return '请分别保留左、右单侧绞车作用的两次实际运行。';
  }
  if (step.sequence === 5 && ![joint, actualModels].every((list) => list.some((model) =>
    model.payload.trainingRuns.some((window) => ids.has(window.runRef))))) {
    return '请从本步同一实际记录冻结绞车指令联合模型及实际绞车速度模型。';
  }
  if (step.sequence === 6 && !['hull_model', 'command_to_output'].every((mode) => compared.some((comparison) =>
    comparison.mode === mode && models.some((model) => model.id === comparison.modelId
      && model.createdAtMs <= (own.find((run) => run.id === comparison.runId)?.createdAtMs ?? 0))))) {
    return '请用运行前冻结的本人模型，保留反向窗口的A量测与B指令两种独立对照。';
  }
  if (step.closedLoop && !own.every((run) => joint.some((model) => model.id === run.designStudentModelId
    && model.createdAtMs <= run.createdAtMs) && comparisons.some((comparison) => comparison.runId === run.id
      && comparison.modelId === run.designStudentModelId && comparison.purpose === 'forecast'
      && comparison.createdAtMs <= run.createdAtMs && stableStringify(comparison.controllerInput) === stableStringify(run.initialInput)))) {
    return '每次横移闭环需要引用开始前冻结的本人联合模型及对应独立预测。';
  }
  const pair = (variable: keyof VesselDredgerInput) => own.some((first, index) => own.slice(index + 1).some((second) =>
    condition(first) === condition(second) && controller(first, variable) === controller(second, variable)
      && first.initialInput.dredger?.[variable] !== second.initialInput.dredger?.[variable]));
  if (step.sequence === 10 && (!pair('kpMultiplier') || !compared.some((comparison) => comparison.mode === 'independent_closed_loop'))) {
    return '请固定其余条件，完成两组不同PI增益，并保存本人模型的独立C闭环对照。';
  }
  if (step.sequence === 11 && (!joint.some((model) => model.payload.trainingRuns.some((window) => ids.has(window.runRef)))
    || !compared.some((comparison) => joint.some((model) => model.id === comparison.modelId
      && model.payload.operatingPoint.dredgerSoil === 'sand')))) {
    return '请保留砂层冻结模型在本步黏土记录的独立对照，并从黏土固定模式窗口重新辨识模型。';
  }
  if (step.sequence === 12 && ![20.3, 20.5].every((depth) => own.some((run) => run.initialInput.dredger?.commands.depthReferenceM === depth))) {
    return '请保留黏土层0.3m与0.5m目标切厚的两组实际记录，并解释转速、横移和能耗。';
  }
  if (step.sequence === 13 && ![5, 15, 30].every((ramp) => own.some((run) => run.initialInput.dredger?.reversalRampS === ramp))) {
    return '请完成5、15、30秒三档换向斜坡对照。';
  }
  if (step.sequence === 14 && (!pair('integralPolicy') || !['track', 'reset'].every((policy) => own.some((run) => run.initialInput.dredger?.integralPolicy === policy)))) {
    return '请在同一模式切换计划下比较积分直接重置与跟踪，并解释保持时间选择。';
  }
  if (step.sequence === 15 && !own.some((first, index) => own.slice(index + 1).some((second) =>
    condition(first) === condition(second) && first.designStudentModelId === second.designStudentModelId
      && variables(first).filter((value, i) => value !== variables(second)[i]).length === 1))) {
    return '请先保留风流下的原方案，再保持工况并只改变一项控制策略。';
  }
  if (step.sequence === 16 && !own.some((first) => !first.configuration.environmentSwitches?.wave_enabled
    && own.some((second) => second.configuration.environmentSwitches?.wave_enabled
      && controller(first) === controller(second) && condition(first, true) === condition(second, true)))) {
    return '请保留同一方案在无浪及0.5m横浪条件下的深度、切厚与负载对照。';
  }
  if (step.sequence === 17 && ![5, 10, 20].every((hold) => own.some((run) => run.initialInput.dredger?.entryHoldS === hold))) {
    return '请在相同波浪和量测误差下比较5、10、20秒进入保持时间。';
  }
  if (step.sequence === 18 && !own.some((run) => {
    const events = run.dredgerModeEvents ?? [];
    const fault = events.find((event) => event.kind === 'cable_break' && Math.abs(event.timeS - 180) < 0.05);
    const previousMode = events.filter((event) => event.kind.startsWith('mode_') && event.timeS < 180).at(-1);
    return run.configuration.dredger?.cableBreakTimeS === 180 && fault && previousMode?.kind === 'mode_CutSwing'
      && events.some((event) => event.kind === 'mode_PauseCut' && event.timeS >= fault.timeS);
  })) {
    return '请选择能够在180秒前进入横移切削的本人方案，保留实际作业中单侧断缆、停止切削与抬刀证据。';
  }
  if (step.sequence === 19 && (![17, 29].every((seed) => own.some((run) => run.configuration.seed === seed))
    || !runs.some((source) => [17, 18].includes(source.stepSequence) && complete(source)
      && [17, 29].every((seed) => own.some((run) => run.configuration.seed === seed && run.createdAtMs >= source.createdAtMs
        && controller(run) === controller(source)))))) {
    return '请保持第17或18步已保存的完整模式及控制方案，完成两种未见土层的验证。';
  }
  if (step.sequence === 20) {
    if (new Set(runs.filter(complete).map((run) => run.id)).size < 6) return '报告需要引用至少六组本人完整运行。';
    if (['problem', 'identification', 'validation', 'comparison', 'revision', 'conclusion'].some((key) => !answers[key]?.trim())) {
      return '请完成报告六部分的证据、推理、修改与适用范围。';
    }
    if (!joint.length || !actualModels.length || !['hull_model', 'command_to_output', 'independent_closed_loop'].every((mode) =>
      comparisons.some((comparison) => comparison.mode === mode && comparison.purpose !== 'forecast' && comparison.actualSampleCount > 0))) {
      return '请引用本人局部模型，以及A量测、B指令和C独立闭环的实际对照。';
    }
  }
  return null;
}
