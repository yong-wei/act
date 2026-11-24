import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';
import type { VesselCourseEvidence, VesselCourseStep } from './course-adapter';

export const DRILLING_RUN_DURATIONS_S = [120, 300, 300, 0, 300, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 600, 0] as const;

function scheme(run: VesselRunSummary, ignored: string[] = []) {
  const settings = { ...run.courseSettings };
  delete settings.validationSeed;
  for (const key of ignored) delete settings[key];
  return JSON.stringify([run.designStudentModelId, settings]);
}

function condition(run: VesselRunSummary, ignored: string[] = []) {
  const configuration = { ...run.configuration } as Record<string, unknown>;
  for (const key of ignored) delete configuration[key];
  return JSON.stringify(configuration);
}

export function validateDrillingCourseEvidence(step: VesselCourseStep, evidence: VesselCourseEvidence): string | null {
  const { runs, models, comparisons, answers } = evidence;
  const complete = (run: VesselRunSummary) => run.stoppedAtMs !== null && run.stopReason !== 'failure'
    && run.lastTimeS + 1e-7 >= (DRILLING_RUN_DURATIONS_S[run.stepSequence - 1] ?? Infinity);
  const own = runs.filter((run) => run.stepSequence === step.sequence && complete(run));
  const dpModels = models.filter((model) => model.channel === 'dp-low-frequency' && model.payload.structure.kind === 'dp_low_freq3');
  if (step.sequence !== 20 && (!answers.prediction?.trim() || !answers.observation?.trim() || !answers.interpretation?.trim())) {
    return '请填写运行前预测、本人观察，并说明因果关系和适用边界。';
  }
  if (step.stepKind === 'run' && own.length < step.minimumRuns) return `本步需要至少${step.minimumRuns}次完整独立运行。`;
  if (step.sequence === 3 && !['x', 'y', 'yaw'].every((axis) => own.some((run) => run.courseSettings?.excitationAxis === axis))) {
    return '请保留纯纵向、横向和艏摇三次完整物理激励。';
  }
  if (step.sequence === 4 && !dpModels.some((model) => model.payload.trainingRuns.length === 3
    && ['x', 'y', 'yaw'].every((axis) => model.payload.trainingRuns.some((window) => runs.some((run) =>
      run.id === window.runRef && run.stepSequence === 3 && complete(run) && run.courseSettings?.excitationAxis === axis))))) {
    return '请引用本人第3步的三次独立激励，冻结三通道低频模型。';
  }
  if (step.sequence === 5 && !comparisons.some((comparison) => comparison.mode === 'hull_model' && comparison.actualSampleCount > 0
    && own.some((run) => run.id === comparison.runId && dpModels.some((model) => model.id === comparison.modelId
      && model.createdAtMs <= run.createdAtMs && !model.payload.trainingRuns.some((window) => window.runRef === run.id))))) {
    return '请保存本步小位移的独立三通道模型对照。';
  }
  if (own.some((run) => run.initialInput.semisubDp?.decoupling && !dpModels.some((model) =>
    model.id === run.designStudentModelId && model.createdAtMs <= run.createdAtMs
    && model.payload.structure.kind === 'dp_low_freq3'
    && JSON.stringify(run.initialInput.semisubDp?.studentModel) === JSON.stringify({ a: model.payload.structure.a, b: model.payload.structure.b })))) {
    return '解耦方案需要绑定运行开始前已冻结的本人三通道模型。';
  }
  const variable: Record<number, string> = { 6: 'bandwidthRadS', 7: 'decoupling', 8: 'integralEnabled',
    9: 'windFeedforward', 12: 'feedback', 13: 'allocation', 15: 'reallocate' };
  if (variable[step.sequence] && !own.some((a, index) => own.slice(index + 1).some((b) =>
    condition(a) === condition(b) && scheme(a, [variable[step.sequence]]) === scheme(b, [variable[step.sequence]])
    && a.courseSettings?.[variable[step.sequence]] !== b.courseSettings?.[variable[step.sequence]]))) {
    return '请固定其余条件和方案，保留本步指定的单因素完整对照。';
  }
  if (step.sequence === 11 && !own.some((run) => runs.some((source) => source.stepSequence === 10 && complete(source)
    && scheme(source) === scheme(run) && condition(source, ['secondOrderEnabled']) === condition(run, ['secondOrderEnabled'])))) {
    return '请保持第10步控制器和同一波场，只开启差频载荷完成对照。';
  }
  if (step.sequence === 18 && (own.length < 2 || !own.some((a, index) => own.slice(index + 1).some((b) =>
    a.configuration.propulsionPowerBudgetW !== b.configuration.propulsionPowerBudgetW
    || a.courseSettings?.windSpeedMps !== b.courseSettings?.windSpeedMps)) || !answers.capacity?.trim())) {
    return '请保存静态能力计算、两个不同风速或预算的完整运行，再比较预测和实际表现。';
  }
  if (step.sequence === 19 && ![17, 29].every((seed) => own.some((run) => run.configuration.seed === seed
    && runs.some((source) => [16, 17].includes(source.stepSequence) && complete(source) && scheme(source) === scheme(run))))) {
    return '请引用本人第16或17步冻结方案，在17和29两个种子的未见海况分别验证。';
  }
  if (step.sequence === 20) {
    if (runs.filter(complete).length < 6 || !dpModels.length || !comparisons.some((comparison) => comparison.actualSampleCount > 0)) {
      return '请至少引用六次本人完整运行、低频模型与独立对照。';
    }
    if (['problem', 'identification', 'validation', 'comparison', 'revision', 'conclusion'].some((key) => !answers[key]?.trim())) return '请完成报告六部分。';
  }
  return null;
}
