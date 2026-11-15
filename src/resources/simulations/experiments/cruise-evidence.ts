import type { VesselCourseEvidence } from './course-adapter';
import { CRUISE_COURSE_STEPS, cruiseStudentRollModel, type CruiseCourseStep } from './cruise-course';
import type { VesselRunSummary } from '@/features/simulations/local-evidence-store';

function condition(run: VesselRunSummary, variable?: 'speed') {
  const config = { ...run.configuration };
  if (variable === 'speed') delete config.initialWaterSpeedMps;
  return JSON.stringify(config);
}

function scheme(
  run: VesselRunSummary,
  variable?:
    | 'finsEnabled'
    | 'dampingRatio'
    | 'lowPassCutoffHz'
    | 'notch'
    | 'headingRampS'
    | 'speedMps'
    | 'resonanceRatio',
) {
  const settings = { ...run.courseSettings };
  if (variable === 'notch') {
    delete settings.notchEnabled;
    delete settings.notchCenterHz;
    delete settings.notchBandwidthHz;
  } else if (variable) delete settings[variable];
  return JSON.stringify([run.designStudentModelId, settings, run.initialInput.pid]);
}

export function validateCruiseCourseEvidence(
  step: CruiseCourseStep,
  evidence: VesselCourseEvidence,
): string | null {
  const { runs, models, comparisons, answers } = evidence;
  const complete = (run: VesselRunSummary) =>
    run.stoppedAtMs !== null &&
    run.stopReason !== 'failure' &&
    run.lastTimeS + 1e-7 >= (CRUISE_COURSE_STEPS[run.stepSequence - 1]?.runDurationS ?? Infinity);
  const own = runs.filter((run) => run.stepSequence === step.sequence && complete(run));
  const rollModels = models.filter(
    (model) => model.channel === 'fin-to-roll' && model.payload.structure.kind === 'roll_oscillator',
  );
  if (step.sequence !== 20 && (!answers.observation?.trim() || !answers.interpretation?.trim()))
    return '请记录本人观察，并解释因果关系与模型边界。';
  if (step.stepKind === 'run' && own.length < step.minimumRuns)
    return `本步需要至少${step.minimumRuns}次完整独立运行。`;
  if (
    step.finControl &&
    own.some(
      (run) =>
        !rollModels.some((model) => {
          if (
            model.id !== run.designStudentModelId ||
            model.createdAtMs > run.createdAtMs ||
            model.payload.structure.kind !== 'roll_oscillator' ||
            model.payload.structure.control_gain <= 0
          )
            return false;
          if (
            !Number.isFinite(Number(model.payload.operatingPoint.rollInertiaKgM2)) ||
            Number(model.payload.operatingPoint.rollInertiaKgM2) <= 0
          )
            return false;
          const expected = cruiseStudentRollModel(model),
            actual = run.initialInput.cruiseFins?.model;
          return (
            expected.inertiaKgM2 === actual?.inertiaKgM2 &&
            expected.dampingNmSRad === actual?.dampingNmSRad &&
            expected.stiffnessNmRad === actual?.stiffnessNmRad
          );
        }),
    )
  )
    return '请使用在运行开始前已冻结的本人自由衰减与鳍控制效能模型。';
  if (
    [2, 3].includes(step.sequence) &&
    !rollModels.some(
      (model) =>
        model.payload.trainingRuns.some((window) => own.some((run) => run.id === window.runRef)) &&
        (step.sequence !== 3 ||
          (model.payload.structure.kind === 'roll_oscillator' && model.payload.structure.control_gain > 0)),
    )
  ) {
    return step.sequence === 2
      ? '请从本人第2步记录辨识并冻结固有频率与阻尼。'
      : '请引用本人自由衰减和本步脉冲记录，辨识并冻结鳍控制效能。';
  }
  if (
    step.sequence === 4 &&
    !comparisons.some(
      (comparison) =>
        comparison.mode === 'hull_model' &&
        comparison.actualSampleCount > 0 &&
        own.some(
          (run) =>
            run.id === comparison.runId &&
            rollModels.some(
              (model) =>
                model.id === comparison.modelId &&
                model.createdAtMs <= run.createdAtMs &&
                model.payload.structure.kind === 'roll_oscillator' &&
                model.payload.structure.control_gain > 0 &&
                !model.payload.trainingRuns.some((window) => window.runRef === run.id),
            ),
        ),
    )
  )
    return '请保存本步独立横摇模型对照。';
  if (
    step.sequence === 6 &&
    !own.some((reference) =>
      [0.7, 1, 1.3].every((ratio) =>
        own.some(
          (run) =>
            run.courseSettings?.resonanceRatio === ratio &&
            scheme(run, 'resonanceRatio') === scheme(reference, 'resonanceRatio'),
        ),
      ),
    )
  )
    return '请保留本人固有周期的.7、1与1.3倍三次规则波运行。';
  if ([7, 13].includes(step.sequence)) {
    const speeds = step.sequence === 7 ? [0, 2, 8] : [4, 8, 10];
    if (
      !own.some((reference) =>
        speeds.every((speed) =>
          own.some(
            (run) =>
              run.configuration.initialWaterSpeedMps === speed &&
              condition(run, 'speed') === condition(reference, 'speed') &&
              scheme(run, 'speedMps') === scheme(reference, 'speedMps'),
          ),
        ),
      )
    )
      return '请固定其余条件和控制方案，保留本步三个指定航速的完整运行。';
  }
  if ([9, 10, 12, 14, 15].includes(step.sequence)) {
    const variable =
      step.sequence === 9
        ? 'finsEnabled'
        : step.sequence === 10
          ? 'dampingRatio'
          : step.sequence === 12
            ? 'headingRampS'
            : step.sequence === 14
              ? 'lowPassCutoffHz'
              : 'notch';
    if (
      !own.some((a, i) =>
        own
          .slice(i + 1)
          .some(
            (b) =>
              condition(a) === condition(b) &&
              scheme(a, variable) === scheme(b, variable) &&
              scheme(a) !== scheme(b),
          ),
      )
    )
      return '请固定其余条件，保留本步要求的单因素完整对照。';
    if (
      step.sequence === 10 &&
      ![0.3, 0.7].every((ratio) => own.some((run) => run.initialInput.cruiseFins?.dampingRatio === ratio))
    )
      return '本步需要比较.3与.7目标阻尼比。';
  }
  if (
    step.sequence === 17 &&
    !own.some((run) =>
      runs.some(
        (source) =>
          source.stepSequence === 16 &&
          complete(source) &&
          condition(source) === condition(run) &&
          [
            'headingRampS',
            'dampingRatio',
            'stiffnessFraction',
            'lowPassCutoffHz',
            'notchEnabled',
            'notchCenterHz',
            'notchBandwidthHz',
          ].filter(
            (key) =>
              JSON.stringify(source.courseSettings?.[key]) !== JSON.stringify(run.courseSettings?.[key]),
          ).length === 1 &&
          source.designStudentModelId === run.designStudentModelId,
      ),
    )
  )
    return '请在第16步相同工况下只调整一项策略，保留两客点比较。';
  if (
    step.sequence === 18 &&
    !own.some((run) =>
      runs.some(
        (source) =>
          [16, 17].includes(source.stepSequence) && complete(source) && scheme(source) === scheme(run),
      ),
    )
  )
    return '请保持已冻结的联合方案，验证不同波谱。';
  if (
    step.sequence === 19 &&
    !own.some((run) =>
      runs.some((source) => {
        if (![16, 17].includes(source.stepSequence) || !complete(source)) return false;
        const sourceSettings = { ...source.courseSettings };
        const faultSettings = { ...run.courseSettings };
        delete sourceSettings.faultStrategy;
        delete faultSettings.faultStrategy;
        return (
          source.designStudentModelId === run.designStudentModelId &&
          JSON.stringify(sourceSettings) === JSON.stringify(faultSettings)
        );
      }),
    )
  )
    return '请引用第16或17步已冻结的联合方案，再选择故障后的保持、减速或延长转向策略。';
  if (step.sequence === 20) {
    if (new Set(runs.filter(complete).map((run) => run.id)).size < 5)
      return '报告需要引用至少五次本人完整运行及两个客点的实际指标。';
    if (!rollModels.length || !comparisons.some((comparison) => comparison.actualSampleCount > 0))
      return '报告需要本人横摇模型和独立验证。';
    if (
      ['problem', 'identification', 'validation', 'comparison', 'revision', 'conclusion'].some(
        (key) => !answers[key]?.trim(),
      )
    )
      return '请完成报告六部分，并说明教学舒适性代理的适用范围。';
  }
  return null;
}
