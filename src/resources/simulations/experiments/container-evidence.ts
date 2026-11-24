import type { VesselCourseEvidence } from './course-adapter';
import { CONTAINER_COURSE_STEPS, type ContainerCourseStep } from './container-course';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';

function condition(run: VesselRunSummary, variable?: 'loading' | 'seed' | 'meanResistance') {
  const config = {...run.configuration};
  if (variable === 'loading') delete config.loadingRatio;
  if (variable === 'seed') {delete config.loadingRatio; delete config.seed;}
  if (variable === 'meanResistance') delete config.meanWaveResistanceModel;
  return JSON.stringify(config);
}

function scheme(run: VesselRunSummary, variable?: 'bumpless' | 'feedback' | 'filter' | 'plan') {
  const controller = structuredClone(run.initialInput.containerSpeed);
  if (controller && variable === 'bumpless') controller.bumpless = false;
  if (controller && variable === 'feedback') controller.feedback = 'water';
  if (controller && variable === 'filter') {controller.filterTauS = .2; controller.losLookaheadM = 400;}
  const voyage = variable === 'plan' ? null : run.configuration.containerVoyage;
  return JSON.stringify([controller, voyage, run.initialInput.pid, run.initialInput.controlMode]);
}

export function validateContainerCourseEvidence(step: ContainerCourseStep, evidence: VesselCourseEvidence): string | null {
  const {runs, models, comparisons, answers} = evidence;
  const complete = (run: VesselRunSummary) => run.stoppedAtMs !== null && run.stopReason !== 'failure'
    && (run.lastTimeS >= (CONTAINER_COURSE_STEPS[run.stepSequence - 1]?.runDurationS ?? Infinity) - 1e-7
      || (run.stepSequence === 2 && run.stopReason === 'duration' && run.lastTimeS >= 1 - 1e-7)
      || Boolean(run.configuration.containerVoyage && ['arrival', 'time_limit'].includes(run.stopReason ?? '')));
  const speedModels = models.filter((model) => model.channel === 'shaft-reference-to-speed' && model.payload.structure.kind === 'fopdt');
  const own = runs.filter((run) => run.stepSequence === step.sequence && complete(run));
  if (step.sequence !== 20 && (!answers.prediction?.trim() || !answers.observation?.trim() || !answers.interpretation?.trim())) {
    return '请先填写运行前预测、记录本人观察，并解释因果关系及模型边界。';
  }
  if (step.stepKind === 'run' && own.length < step.minimumRuns) return `本步需要至少${step.minimumRuns}次完整独立运行。`;
  if (step.speedControl && own.some((run) => !run.initialInput.containerSpeed?.models.every((point) =>
    speedModels.some((model) => {
      const frozen = model.payload.structure;
      const applied = point.operatingModel.structure;
      return model.createdAtMs <= run.createdAtMs && frozen.kind === 'fopdt'
        && frozen.k === applied.k && frozen.t_s === applied.t_s && frozen.delay_s === applied.delay_s
        && Number(model.payload.operatingPoint.loadingRatio) === point.loadingRatio
        && Number(model.payload.operatingPoint.inputOrigin) === point.operatingModel.shaftReferenceRpm
        && Number(model.payload.operatingPoint.speedMps) === point.operatingModel.speedMps;
    })))) {
    return '控制方案的三个工作点必须来自本轮运行开始前已冻结的本人辨识模型。';
  }
  const modelFrom = (run: VesselRunSummary) => speedModels.some((model) => model.payload.trainingRuns.some((window) => window.runRef === run.id));
  if ([2, 5, 8, 9, 14].includes(step.sequence)) {
    const loadings = step.sequence === 2 ? [.2, .6, .9] : [.2, .9];
    if (!loadings.every((loading) => own.some((run) => run.configuration.loadingRatio === loading))) return '请保留本步各指定装载的独立运行。';
  }
  if ([3, 5, 6].includes(step.sequence) && !own.every(modelFrom)) return '请分别从本步各工作点的本人量测窗口辨识并冻结局部航速模型。';
  if (step.sequence === 6 && ![6, 10].every((speed) => own.some((run) => run.configuration.initialWaterSpeedMps === speed))) {
    return '请保留6与10m/s两个航速工作点的完整运行及辨识模型。';
  }
  const independent = comparisons.filter((comparison) => comparison.purpose !== 'forecast' && comparison.actualSampleCount > 0
    && own.some((run) => run.id === comparison.runId));
  if (step.sequence === 4 && !independent.some((comparison) => speedModels.some((model) => model.id === comparison.modelId
    && !model.payload.trainingRuns.some((window) => window.runRef === comparison.runId)
    && own.some((run) => run.id === comparison.runId && model.createdAtMs <= run.createdAtMs)))) {
    return '请用此前冻结的本人模型完成本步留出运行的独立对照。';
  }
  if ([7, 11].includes(step.sequence) && !own.some((run) => comparisons.some((comparison) => comparison.runId === run.id
    && comparison.purpose === 'forecast' && comparison.createdAtMs <= run.createdAtMs))) return '请保留运行前冻结的理想预测及对应实际运行。';
  if (step.sequence === 8 && !own.some((a, i) => own.slice(i + 1).some((b) => condition(a, 'loading') === condition(b, 'loading')
    && scheme(a) === scheme(b) && !a.initialInput.containerSpeed?.schedulingEnabled && !b.initialInput.containerSpeed?.schedulingEnabled))) {
    return '请在两种装载下使用相同的固定PI方案。';
  }
  if (step.sequence === 9 && own.some((run) => !run.initialInput.containerSpeed?.schedulingEnabled)) return '本步需要使用本人三点表的线性增益调度。';
  if ([10, 13, 16].includes(step.sequence)) {
    const variable = step.sequence === 10 ? 'bumpless' : step.sequence === 13 ? 'feedback' : 'filter';
    if (!own.some((a, i) => own.slice(i + 1).some((b) => condition(a) === condition(b)
      && scheme(a, variable) === scheme(b, variable) && scheme(a) !== scheme(b)))) return '请固定其余条件，保留本步要求的单因素对照。';
  }
  if (step.sequence === 12 && new Set(own.map((run) => JSON.stringify(run.configuration.containerVoyage))).size < 2) {
    return '请保存至少两种不同四段速度计划的实际航次。';
  }
  if (step.sequence === 14 && !own.some((a, i) => own.slice(i + 1).some((b) => condition(a, 'loading') === condition(b, 'loading')
    && scheme(a) === scheme(b)))) return '请保持相同计划和控制参数，比较两种装载的风力航次。';
  if (step.sequence === 15 && !own.some((a, i) => own.slice(i + 1).some((b) =>
    condition(a, 'meanResistance') === condition(b, 'meanResistance') && scheme(a) === scheme(b)
    && Boolean(a.configuration.meanWaveResistanceModel) !== Boolean(b.configuration.meanWaveResistanceModel)))) {
    return '请固定同一波场、本人模型和航速计划，分别关闭与开启教学平均附加阻力完成两次航次。';
  }
  if (step.sequence === 18 && !own.some((run) => runs.some((source) => source.stepSequence === 17 && complete(source)
    && condition(source) === condition(run) && scheme(source) !== scheme(run)
    && ['modelIds','segmentSpeedsMps','kpMultiplier','tiMultiplier','antiWindup','bumpless','schedulingEnabled','filterTauS','losLookaheadM']
      .filter((key) => JSON.stringify(source.courseSettings?.[key]) !== JSON.stringify(run.courseSettings?.[key])).length === 1))) {
    return '请在第17步相同工况下只调整一个设计维度，并保留第二方案。';
  }
  if (step.sequence === 19 && !runs.some((source) => [17, 18].includes(source.stepSequence) && complete(source)
    && [17, 29].every((seed) => own.some((run) => run.configuration.seed === seed && scheme(source) === scheme(run))))) {
    return '请保持已冻结的综合方案，完成seed17/.35与seed29/.8的未见工况验证。';
  }
  if (step.sequence === 20) {
    if (new Set(runs.filter(complete).map((run) => run.id)).size < 5) return '报告需要引用至少五次本人完整运行。';
    if (!speedModels.length || !comparisons.some((item) => item.purpose !== 'forecast' && item.actualSampleCount > 0)) return '报告需要引用本人模型及实际独立验证。';
    if (['problem', 'identification', 'validation', 'comparison', 'revision', 'conclusion'].some((key) => !answers[key]?.trim())) return '请完成报告六部分，并说明教学估计燃油的适用范围。';
  }
  return null;
}
