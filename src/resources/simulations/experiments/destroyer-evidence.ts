import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import { DESTROYER_COURSE_STEPS, type DestroyerCourseStep } from './destroyer-course';
import type { FrozenVesselStudentModel, VesselModelComparison } from './student-analysis';
import type { VesselSessionInput } from '@/lib/control-engine/vessel-session';

export type DestroyerModelEvidence = Pick<FrozenVesselStudentModel,'id'|'channel'|'createdAtMs'|'payload'>;
export type DestroyerComparisonEvidence = Pick<VesselModelComparison,'id'|'modelId'|'actuatorModelId'|'runId'|'mode'|'purpose'|'createdAtMs'|'controllerInput'> & {actualSampleCount:number};

export function headingControllerSignature(input:VesselSessionInput) {
  return JSON.stringify([input.controlMode,input.pid.kp,input.controlMode === 'pid' ? input.pid.ki : 0,
    ['pd','pid'].includes(input.controlMode) ? input.pid.kd : 0,input.derivativeFilterTauS ?? .2,
    input.headingIntegralTracking?.enabled ?? true,input.headingIntegralTracking?.timeS ?? 1,input.feedback]);
}

function comparisonConditions(run:VesselRunSummary,variable?:'environment'|'initialWaterSpeedMps') {
  const configuration = {...run.configuration};
  delete configuration.courseEvidence;
  if (variable) delete configuration[variable];
  return JSON.stringify([Object.entries(configuration).sort(([first],[second])=>first.localeCompare(second)),
    run.durationS,run.initialInput.targetHeadingDeg]);
}

function comparisonController(input:VesselSessionInput,variable:'integral'|'tracking'|'filter') {
  const normalized = {...input,pid:{...input.pid}};
  if (variable === 'integral') {normalized.controlMode='pid';normalized.pid.ki=0;}
  if (variable === 'tracking') normalized.headingIntegralTracking={enabled:true,timeS:input.headingIntegralTracking?.timeS ?? 1};
  if (variable === 'filter') normalized.derivativeFilterTauS=.2;
  return headingControllerSignature(normalized);
}

function controllerFrozen(run:VesselRunSummary) {
  return headingControllerSignature(run.initialInput) === headingControllerSignature(run.finalInput ?? run.initialInput);
}

export function validateDestroyerCourseEvidence(step: DestroyerCourseStep, evidence: {
  runs: VesselRunSummary[];
  models: DestroyerModelEvidence[];
  comparisons: DestroyerComparisonEvidence[];
  answers: Record<string, string>;
  designKp?: (model: DestroyerModelEvidence) => number | undefined;
}): string | null {
  const { runs, models, comparisons, answers } = evidence;
  const ownRuns = runs.filter((run) => run.stepSequence === step.sequence && run.stopReason !== 'failure'
    && run.lastTimeS+1e-7 >= (step.runDurationS ?? 0));
  if (step.sequence !== 20 && !answers.interpretation?.trim()) return '请填写证据解释与适用边界。';
  if (step.stepKind === 'run' && ownRuns.length < step.minimumRuns) return `本步需要至少${step.minimumRuns}次完整运行，各次记录均会保留。`;
  const hullModels = models.filter((model) => model.channel === 'rudder-to-yaw');
  const ownRunIds = new Set(ownRuns.map((run) => run.id));
  const independent = comparisons.filter((comparison) => ownRunIds.has(comparison.runId));
  if (step.sequence === 4 && !hullModels.some((model) => model.payload.trainingRuns.some((window) => runs.some((run) => run.id === window.runRef && run.stepSequence === 3)))) {
    return '请在评估页签选择第3步的量测窗口，辨识并冻结本人船体模型。';
  }
  if ([5,6].includes(step.sequence) && !independent.some((comparison) => comparison.mode === 'hull_model')) return '请在评估页签保存本步运行的独立船体模型对照。';
  if (step.sequence === 5 && !independent.some((comparison) => {
    const model = models.find((item) => item.id === comparison.modelId);
    const run = ownRuns.find((item) => item.id === comparison.runId);
    return model && run && model.createdAtMs < run.createdAtMs;
  })) return '本步需要使用在本次验证运行开始前已冻结的模型。';
  if (step.sequence === 7) {
    const speeds = new Set(ownRuns.map((run) => run.configuration.initialWaterSpeedMps));
    const identifiedSpeeds = new Set(hullModels.map((model) => model.payload.operatingPoint.speedMps));
    if (![4,12].every((speed) => speeds.has(speed) && identifiedSpeeds.has(speed))) return '请分别完成4 m/s和12 m/s运行，并各自冻结辨识模型。';
  }
  if (step.sequence === 8 && (!hullModels.length || !answers.sketchImage)) return '请保留本人冻结模型，并提交原始特征图手绘。';
  if (step.sequence === 9) {
    const choices = new Map<string,Set<number>>();
    for (const run of ownRuns) {
      const model = hullModels.find((item) => item.id === run.designStudentModelId && item.createdAtMs < run.createdAtMs
        && item.payload.structure.kind === 'nomoto1' && Number(item.payload.operatingPoint.speedMps) === 8);
      const recommended = model && evidence.designKp?.(model);
      if (!model || !recommended || headingControllerSignature(run.finalInput ?? run.initialInput) !== headingControllerSignature(run.initialInput)) continue;
      const choice = [.5,1,2].find((value) => Math.abs(run.initialInput.pid.kp/recommended-value) < 1e-6);
      if (choice !== undefined) {
        const key = JSON.stringify([model.id,comparisonConditions(run)]);
        const selected = choices.get(key) ?? new Set<number>();selected.add(choice);choices.set(key,selected);
      }
    }
    if (![...choices.values()].some((selected)=>selected.size >= 2)) return '请基于本人同一个已冻结的8 m/s一阶模型，保留建议比例增益0.5、1、2倍中的至少两种同条件完整独立运行。';
  }
  if (step.sequence === 10 && !independent.some((comparison) => comparison.mode === 'independent_closed_loop'
    && comparison.purpose === 'validation' && comparison.actualSampleCount > 0 && independent.some((forecast) => {
      const run = ownRuns.find((item) => item.id === forecast.runId);
      return forecast.purpose === 'forecast' && forecast.runId === comparison.runId && forecast.modelId === comparison.modelId
        && forecast.actuatorModelId === comparison.actuatorModelId && run && forecast.createdAtMs < run.createdAtMs;
    }))) return '请保留运行前冻结的本人闭环预测，并在评估页签用同一船体与舵机模型完成独立闭环验证。';
  if ([11,12,15].includes(step.sequence)) {
    const variable = step.sequence === 11 ? 'integral' : step.sequence === 12 ? 'tracking' : 'filter';
    const paired = ownRuns.some((first,index)=>ownRuns.slice(index+1).some((second)=> {
      const changed = step.sequence === 11
        ? new Set([first.initialInput.controlMode,second.initialInput.controlMode]).has('pd')
          && new Set([first.initialInput.controlMode,second.initialInput.controlMode]).has('pid')
        : step.sequence === 12 ? (first.initialInput.headingIntegralTracking?.enabled ?? true)
          !== (second.initialInput.headingIntegralTracking?.enabled ?? true)
          : (first.initialInput.derivativeFilterTauS ?? .2) !== (second.initialInput.derivativeFilterTauS ?? .2);
      return changed && controllerFrozen(first) && controllerFrozen(second)
        && comparisonConditions(first) === comparisonConditions(second)
        && comparisonController(first.initialInput,variable) === comparisonController(second.initialInput,variable);
    }));
    if (!paired) return step.sequence === 11 ? '请固定其余参数，分别保留同条件PD与PID的完整运行。'
      : step.sequence === 12 ? '请固定其余参数，分别保留同条件关闭与开启积分抗饱和的完整运行。'
        : '请固定其余参数，保留至少两档微分滤波设置的同条件完整运行。';
  }
  if (step.sequence === 14 && !ownRuns.some((first)=>first.configuration.environment === 'P0'
    && ownRuns.some((second)=>second.configuration.environment === 'V1'
      && controllerFrozen(first) && controllerFrozen(second)
      && headingControllerSignature(first.initialInput) === headingControllerSignature(second.initialInput)
      && comparisonConditions(first,'environment') === comparisonConditions(second,'environment')))) {
    return '请保留同一控制器、初态与种子在平静水面与有波条件下的两次完整运行。';
  }
  if (step.sequence === 17) {
    const baselines = runs.filter((run) => run.stepSequence === 16 && run.stopReason !== 'failure' && run.lastTimeS >= 600);
    if (!baselines.length) return '请先保留第16步的完整第一方案。';
    if (!ownRuns.some((run) => baselines.some((baseline)=>comparisonConditions(run) === comparisonConditions(baseline)
      && headingControllerSignature(run.finalInput ?? run.initialInput)
      !== headingControllerSignature(baseline.finalInput ?? baseline.initialInput)))) return '第二方案需要保持同条件并记录实际控制参数修订。';
  }
  const sourcedRuns = [18,19].includes(step.sequence) ? ownRuns.filter((run) => runs.some((source) => source.id === run.controllerSourceRunId
    && [16,17].includes(source.stepSequence) && source.lastTimeS >= 600 && source.createdAtMs < run.createdAtMs
    && headingControllerSignature(source.finalInput ?? source.initialInput) === headingControllerSignature(run.initialInput)
    && controllerFrozen(run))) : [];
  if ([18,19].includes(step.sequence) && !sourcedRuns.length) {
    return '未见工况验证需要引用并保持第16步或第17步已保存的控制方案。';
  }
  if (step.sequence === 19 && !sourcedRuns.some((first)=>first.configuration.initialWaterSpeedMps === 10
    && sourcedRuns.some((second)=>second.configuration.initialWaterSpeedMps === 8
      && first.controllerSourceRunId === second.controllerSourceRunId
      && comparisonConditions(first,'initialWaterSpeedMps') === comparisonConditions(second,'initialWaterSpeedMps')))) {
    return '请保留同一冻结方案在10m/s边界与降速8m/s修正下的两次同条件完整运行。';
  }
  if (step.sequence === 20) {
    if (new Set(runs.map((run) => run.id)).size < 4) return '请选择至少4次本人的运行作为报告证据。';
    for (const key of ['problem','identification','validation','comparison','revision','conclusion']) {
      if (!answers[key]?.trim()) return '请完成报告的六部分说明。';
    }
    const selectedIds = new Set(runs.map((run) => run.id));
    if (!hullModels.some((model) => model.payload.trainingRuns.some((window) => selectedIds.has(window.runRef)))) {
      return '报告引用需要包含本人冻结船体模型的辨识运行。';
    }
    if (!comparisons.some((comparison) => selectedIds.has(comparison.runId) && comparison.purpose !== 'forecast'
      && comparison.actualSampleCount > 0 && hullModels.some((model) => model.id === comparison.modelId
        && model.createdAtMs < (runs.find((run) => run.id === comparison.runId)?.createdAtMs ?? 0)
        && !model.payload.trainingRuns.some((window) => window.runRef === comparison.runId)))) {
      return '报告引用需要包含本人冻结模型在独立运行中的验证对照。';
    }
    const controlled = runs.filter((run) => run.stopReason !== 'failure' && run.initialInput.controlMode !== 'manual'
      && run.lastTimeS+1e-7 >= (DESTROYER_COURSE_STEPS[run.stepSequence-1]?.runDurationS ?? Infinity));
    if (!controlled.some((first,index) => controlled.slice(index+1).some((second) => first.durationS === second.durationS
      && JSON.stringify(first.configuration) === JSON.stringify(second.configuration)
      && JSON.stringify(DESTROYER_COURSE_STEPS[first.stepSequence-1].events) === JSON.stringify(DESTROYER_COURSE_STEPS[second.stepSequence-1].events)
      && headingControllerSignature(first.finalInput ?? first.initialInput) !== headingControllerSignature(second.finalInput ?? second.initialInput)))) {
      return '请选择相同初态、环境、激励和运行时长下的两种控制方案，完成公平对照。';
    }
  }
  return null;
}
