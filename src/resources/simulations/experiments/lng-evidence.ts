import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { DestroyerComparisonEvidence, DestroyerModelEvidence } from './destroyer-evidence';
import { LNG_COURSE_STEPS, type LngCourseStep } from './lng-course';

function speedScheme(run: VesselRunSummary, variable?: 'tracking' | 'delay' | 'filter' | 'plan') {
  const input = run.initialInput;
  const speed = input.longitudinal;
  return JSON.stringify([run.designStudentModelId, speed?.localModel, speed?.kpMultiplier, speed?.tiMultiplier,
    variable === 'tracking' ? null : speed?.antiWindup,
    variable === 'delay' ? null : [speed?.additionalCommandDelayS, speed?.smithEnabled],
    variable === 'filter' ? null : speed?.filterTauS,
    variable === 'plan' ? null : input.berthPlan,
    input.controlMode, input.pid, input.derivativeFilterTauS]);
}

function condition(run: VesselRunSummary, variable?: 'loading' | 'environment') {
  const config = run.configuration;
  const overrides = config.environmentOverrides;
  return JSON.stringify([config.initialWaterSpeedMps, config.initialHeadingDeg, config.initialPositionNed,
    variable === 'loading' ? null : config.loadingRatio, config.waterDepthM, config.berth,
    variable === 'environment' ? null : [config.environment, config.noiseLevel, config.seed,
      overrides?.currentSpeedMps, overrides?.currentToDeg, overrides?.windSpeedMps]]);
}

export function validateLngCourseEvidence(step: LngCourseStep, evidence: {
  runs: VesselRunSummary[]; models: DestroyerModelEvidence[]; comparisons: DestroyerComparisonEvidence[];
  answers: Record<string, string>;
}): string | null {
  const { runs, models, comparisons, answers } = evidence;
  const complete = (run: VesselRunSummary) => run.stopReason !== 'failure' && run.stoppedAtMs !== null
    && (run.lastTimeS >= (LNG_COURSE_STEPS[run.stepSequence - 1]?.runDurationS ?? Infinity) - 1e-7
      || (Boolean(run.configuration.berth) && (run.stopReason === 'arrival'
        || (run.stopReason === 'student' && run.lastTimeS >= 60))));
  const speedModels = models.filter((model) => model.channel === 'shaft-reference-to-speed'
    && model.payload.structure.kind === 'fopdt');
  const own = runs.filter((run) => run.stepSequence === step.sequence && complete(run)
    && (!step.speedControl || speedModels.some((model) => {
      const structure = model.payload.structure;
      const local = run.initialInput.longitudinal?.localModel;
      return model.id === run.designStudentModelId && model.createdAtMs <= run.createdAtMs
        && structure.kind === 'fopdt' && local?.structure.kind === 'fopdt'
        && structure.k === local.structure.k && structure.t_s === local.structure.t_s && structure.delay_s === local.structure.delay_s
        && Number(model.payload.operatingPoint.inputOrigin) === local.shaftReferenceRpm
        && Number(model.payload.operatingPoint.speedMps) === local.speedMps;
    })));
  if (step.sequence !== 20 && (!answers.prediction?.trim() || !answers.observation?.trim() || !answers.interpretation?.trim())) {
    return '请先填写运行前预测、记录本人观察，并解释原因与适用边界。';
  }
  if (step.stepKind === 'run' && own.length < step.minimumRuns) return `本步需要至少${step.minimumRuns}次完整运行，失败方案的证据也会保留。`;
  const ownIds = new Set(own.map((run) => run.id));
  const independent = comparisons.filter((comparison) => comparison.purpose !== 'forecast'
    && comparison.actualSampleCount > 0 && ownIds.has(comparison.runId));
  if (step.sequence === 3 && !speedModels.some((model) => model.payload.trainingRuns.some((window) =>
    runs.some((run) => run.id === window.runRef && run.stepSequence === 2 && complete(run))))) {
    return '请从第2步本人运行的量测窗口辨识并冻结轴速参考—航速模型。';
  }
  if ([4, 8].includes(step.sequence) && !independent.some((comparison) => {
    const model = speedModels.find((item) => item.id === comparison.modelId);
    const run = own.find((item) => item.id === comparison.runId);
    return model && run && model.createdAtMs <= run.createdAtMs
      && !model.payload.trainingRuns.some((window) => window.runRef === run.id);
  })) return '请用运行开始前已冻结的本人模型，保存本步独立验证对照。';
  if (step.sequence === 6 && new Set(own.map((run) => run.finalInput?.actuators.shafts[0]?.speed_reference_rad_s)).size < 2) {
    return '请保留两种反车强度的完整制动运行。';
  }
  if (step.sequence === 7 && !comparisons.some((comparison) => comparison.purpose === 'forecast'
    && speedModels.some((model) => model.id === comparison.modelId)
    && (!runs.some((run) => run.id === comparison.runId)
      || runs.some((run) => run.id === comparison.runId && run.stepSequence === 8)))) {
    return '请选择本人冻结模型及减速计划，保存第8步运行前的独立速度与距离预测。';
  }
  if (step.sequence === 8 && !own.some((run) => comparisons.some((comparison) => comparison.runId === run.id
    && comparison.purpose === 'forecast' && comparison.modelId === run.designStudentModelId
    && comparison.createdAtMs <= run.createdAtMs))) return '请执行第7步已冻结预测对应的靠泊方案。';
  if (step.sequence === 9 && !own.some((first, index) => own.slice(index + 1).some((second) =>
    condition(first) === condition(second) && speedScheme(first, 'plan') === speedScheme(second, 'plan')
    && JSON.stringify(first.initialInput.berthPlan) !== JSON.stringify(second.initialInput.berthPlan)))) {
    return '请固定其余条件，保留两种减速起点或速度曲线的完整方案。';
  }
  if ([10, 17].includes(step.sequence)) {
    const variable = step.sequence === 10 ? 'tracking' : 'filter';
    if (!own.some((first, index) => own.slice(index + 1).some((second) => condition(first) === condition(second)
      && speedScheme(first, variable) === speedScheme(second, variable)
      && (variable === 'tracking' ? first.initialInput.longitudinal?.antiWindup !== second.initialInput.longitudinal?.antiWindup
        : first.initialInput.longitudinal?.filterTauS !== second.initialInput.longitudinal?.filterTauS)))) {
      return step.sequence === 10 ? '请保留同条件抗饱和关闭与开启的两次完整运行。' : '请固定其余方案，保留至少两档滤波的同条件完整运行。';
    }
  }
  if (step.sequence === 11) {
    const groups = new Map<string, Set<string>>();
    for (const run of own) {
      const key = `${condition(run)}${speedScheme(run, 'delay')}`;
      const group = groups.get(key) ?? new Set<string>();
      const speed = run.initialInput.longitudinal;
      group.add(`${speed?.additionalCommandDelayS}/${speed?.smithEnabled}`);
      groups.set(key, group);
    }
    if (![...groups.values()].some((group) => ['0/false', '0/true', '5/false', '5/true'].every((key) => group.has(key)))) {
      return '请保留同一方案在0/5秒额外时延与Smith关闭/开启下的四种完整运行。';
    }
  }
  if ([12, 14].includes(step.sequence)) {
    if (![.30, .70, .95].every((loading) => own.some((run) => run.configuration.loadingRatio === loading))) {
      return '请分别保留.30、.70及.95填充率下的完整运行。';
    }
    if (step.sequence === 12 && ![.30, .70, .95].every((loading) => speedModels.some((model) =>
      Number(model.payload.operatingPoint.loadingRatio) === loading
      && model.payload.trainingRuns.some((window) => ownIds.has(window.runRef))))) {
      return '请分别冻结三种填充率下的本人局部速度模型，并解释原模型的外推误差。';
    }
  }
  if (step.sequence === 15 && !own.some((first, index) => own.slice(index + 1).some((second) =>
    condition(first) === condition(second) && first.courseSettings?.headingRampS !== undefined
    && second.courseSettings?.headingRampS !== undefined
    && first.courseSettings.headingRampS !== second.courseSettings.headingRampS))) {
    return '请保留同填充率、同航向终值下两种转向斜坡的完整运行。';
  }
  if (step.sequence === 16) {
    const stillWater = runs.filter((run) => [8, 9].includes(run.stepSequence) && complete(run));
    if (stillWater.length === 0) {
      return '请先完成第 8 或第 9 步静水靠泊运行，并在控制栏引用该静水方案复现风流基准。';
    }
    if (!stillWater.some((source) => own.some((run) =>
      run.createdAtMs >= source.createdAtMs && speedScheme(run) === speedScheme(source)
    ))) {
      return '请先保持第 8 或第 9 步冻结的静水靠泊方案不变，在风流干扰下完成一次完整复现运行。';
    }
    if (!own.some((first, index) => own.slice(index + 1).some((second) =>
      condition(first) === condition(second) && speedScheme(first) !== speedScheme(second)
    ))) {
      return '请保留复现静水方案与至少一次修改速度、转向或控制策略的完整运行。';
    }
  }
  if (step.sequence === 19) {
    const frozen = runs.filter((run) => run.stepSequence === 18 && complete(run));
    if (!frozen.some((source) => [17, 29].every((seed) => own.some((run) => run.configuration.seed === seed
      && run.createdAtMs >= source.createdAtMs && speedScheme(run) === speedScheme(source))))) {
      return '请先保持第18步冻结方案，完成70%与95%两种未见装载工况，再保留一次有依据的修正。';
    }
    if (!own.some((run) => frozen.some((source) => speedScheme(run) !== speedScheme(source)))) {
      return '两种未见工况的原方案均需保留，再提交一次控制或速度计划修正的运行。';
    }
  }
  if (step.sequence === 20) {
    if (new Set(runs.filter(complete).map((run) => run.id)).size < 5) return '报告需要引用至少五次本人完整运行。';
    if (['problem', 'identification', 'validation', 'comparison', 'revision', 'conclusion'].some((key) => !answers[key]?.trim())) {
      return '请完成报告的六部分说明。';
    }
    const ids = new Set(runs.map((run) => run.id));
    if (!speedModels.some((model) => model.payload.trainingRuns.some((window) => ids.has(window.runRef)))
      || !comparisons.some((comparison) => ids.has(comparison.runId) && comparison.purpose !== 'forecast'
        && comparison.actualSampleCount > 0)) return '报告引用应包含本人辨识运行和独立模型验证。';
  }
  return null;
}
