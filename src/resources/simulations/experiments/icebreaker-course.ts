import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { STEP_SCORE_DISTRIBUTION, validateExperiment, type ExperimentStep } from '../contracts/experiment-step';
import { VESSEL_COURSES } from './course-catalog';
import { VESSEL_COURSE_VERSION } from './destroyer-course';
import { designStudentHeadingController, type FrozenVesselStudentModel } from './student-analysis';

export interface IcebreakerCourseSettings {
  initialSpeedMps: .5 | 1 | 1.5 | 4;
  speedReferenceMps: number;
  headingBiasDeg?: number;
  thicknessM: .3 | .6 | .9;
  strengthMpa: .35 | .5 | .65;
  kpMultiplier: number;
  kdMultiplier: number;
  integralEnabled: boolean;
  integralTimeS: number;
  filterTauS: 0 | .2 | 1 | 3;
  rampS: 10 | 60;
  scheduling: boolean;
  iceModelId: string;
  validationSeed: 17 | 29;
  jamFault: boolean;
  stopOnJam: boolean;
}

export interface IcebreakerCourseStep extends ExperimentStep {
  sequence: number;
  points: number;
  minimumRuns: number;
  configuration: VesselSessionConfiguration;
  closedLoop: boolean;
}

export function icebreakerDefaultSettings(sequence: number): IcebreakerCourseSettings {
  return {
    initialSpeedMps: sequence <= 7 ? 4 : 1,
    speedReferenceMps: 1,
    headingBiasDeg: 0,
    thicknessM: sequence === 8 || sequence === 9 ? .3 : .6,
    strengthMpa: .5,
    kpMultiplier: 1,
    kdMultiplier: 1,
    integralEnabled: false,
    integralTimeS: 100,
    filterTauS: .2,
    rampS: 10,
    scheduling: false,
    iceModelId: '',
    validationSeed: 17,
    jamFault: false,
    stopOnJam: true,
  };
}

export function validateIcebreakerSettings(settings: IcebreakerCourseSettings): string | null {
  if (!settings || ![.5, 1, 1.5, 4].includes(settings.initialSpeedMps)
    || ![.3, .6, .9].includes(settings.thicknessM) || ![.35, .5, .65].includes(settings.strengthMpa)
    || ![0, .2, 1, 3].includes(settings.filterTauS) || ![10, 60].includes(settings.rampS)
    || ![17, 29].includes(settings.validationSeed) || typeof settings.iceModelId !== 'string'
    || [settings.integralEnabled, settings.scheduling, settings.jamFault, settings.stopOnJam].some((value) => typeof value !== 'boolean')
    || [settings.kpMultiplier, settings.kdMultiplier].some((value) => !Number.isFinite(value) || value < .2 || value > 3)
    || !Number.isFinite(settings.integralTimeS) || settings.integralTimeS < 50 || settings.integralTimeS > 400
    || (settings.headingBiasDeg !== undefined && (!Number.isFinite(settings.headingBiasDeg) || Math.abs(settings.headingBiasDeg) > 15))
    || !Number.isFinite(settings.speedReferenceMps) || settings.speedReferenceMps < .3 || settings.speedReferenceMps > 1.5) {
    return '请选择本步允许的航速、冰况和控制参数。';
  }
  return null;
}

export function icebreakerConfiguration(sequence: number,
  settings: IcebreakerCourseSettings = icebreakerDefaultSettings(sequence)): VesselSessionConfiguration {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 20) throw new Error('实验步骤不存在。');
  const error = validateIcebreakerSettings(settings);
  if (error) throw new Error(error);
  const inIce = sequence >= 8;
  let thickness = .6;
  let strength = .5;
  if (sequence === 8 || sequence === 9) thickness = .3;
  if (sequence === 12) thickness = settings.thicknessM;
  if (sequence === 13) strength = settings.strengthMpa;
  if (sequence === 19) {
    thickness = settings.validationSeed === 17 ? .45 : .75;
    strength = settings.validationSeed === 17 ? .35 : .65;
  }
  let speed = inIce ? 1 : 4;
  if (sequence === 6 || sequence === 16) speed = settings.initialSpeedMps;
  if (sequence === 6 && ![.5, 4].includes(speed)) throw new Error('本步选择0.5或4m/s初始航速。');
  if (sequence === 16 && ![.5, 1, 1.5].includes(speed)) throw new Error('冰区推进方案选择0.5、1或1.5m/s初始航速。');
  const combined = sequence >= 16;
  return {
    vessel: VESSEL_COURSES.icebreaker.vessel,
    parameterVersion: VESSEL_COURSES.icebreaker.parameterVersion,
    initialWaterSpeedMps: speed,
    initialHeadingDeg: 0,
    initialPositionNed: [0, 0, 0],
    seed: sequence === 19 ? settings.validationSeed : 20261106,
    noiseLevel: sequence === 7 || combined ? 'N1' : 'N0',
    environment: sequence === 7 ? 'V1' : combined ? 'E1' : 'P0',
    ...(combined ? { environmentSwitches: { wind_force_enabled: true, current_enabled: true, wave_enabled: false } } : {}),
    ...(inIce ? { ice: { thicknessM: thickness, flexuralStrengthPa: strength * 1e6, frictionCoefficient: .1, contactSegments: 64 as const } } : {}),
    azimuthJamFault: sequence === 19 && settings.jamFault,
    courseEvidence: { rollWarningDeg: 8 },
  };
}

const durations = [60, 180, 300, 300, 400, 400, 600, 1200, 1200, 1200, 600, 1200, 1200, 1200, 600, 1200, 1200, 1200, 1200, 1200];
const minimumRuns = new Map([[5, 2], [6, 2], [7, 2], [12, 3], [13, 2], [14, 2], [15, 2], [16, 3], [19, 3], [20, 6]]);

export const ICEBREAKER_COURSE_STEPS: readonly IcebreakerCourseStep[] = VESSEL_COURSES.icebreaker.steps.map((source, index): IcebreakerCourseStep => {
  const sequence = source.sequence;
  const duration = durations[index];
  const analysis = sequence === 9 || sequence === 20;
  return {
    experimentId: VESSEL_COURSES.icebreaker.experimentId,
    experimentVersion: VESSEL_COURSE_VERSION,
    stepId: `icebreaker-step-${sequence}`,
    sequence,
    title: source.title,
    learningObjective: source.evidence,
    cognitiveLevel: analysis ? 'synthesize' : sequence >= 17 ? 'evaluate' : sequence >= 5 ? 'design' : 'analyze',
    stepKind: analysis ? 'analysis' : 'run',
    trainValidationRole: [4, 19].includes(sequence) ? 'validation' : analysis ? 'none' : 'training',
    prerequisites: index ? [`icebreaker-step-${index}`] : [],
    initialCondition: { speedMps: sequence <= 7 ? 4 : 1 },
    factorMask: sequence === 7 ? ['V1', 'N1'] : sequence >= 16 ? ['W1', 'C1', 'N1'] : ['P0', 'N0'],
    studentControls: [{ key: 'kpMultiplier', label: '比例增益相对本人模型建议值', min: .2, max: 3, unit: '倍' }],
    eventTimeline: analysis ? [] : [source.condition],
    runDurationS: analysis ? undefined : duration,
    observationWindowS: [0, duration],
    termination: analysis ? '引用本人记录完成六部分报告'
      : sequence >= 8 ? `抵达北向800m或运行至${duration}s，保留停滞与未完成结果` : `运行至${duration}s`,
    measurementSignals: ['AzimuthEncoder0', 'AzimuthEncoder1', 'ShaftSpeed0', 'ShaftSpeed1', 'Heading', 'YawRate', 'SpeedLog', 'North', 'East'],
    requiredArtifacts: analysis ? ['six-own-runs', 'frozen-model', 'independent-validation', 'report'] : ['prediction', 'run', 'interpretation'],
    rubric: { kind: sequence >= 5 ? 'design' : 'standard', performanceCriteria: source.evidence, evidenceCriteria: source.interaction },
    hints: sequence === 9 ? ['在评估页签复用本人第8步记录，选择首次接触窗口，切换冰接触力、力矩与能量通道。'] : [source.interaction],
    retryPolicy: 'free',
    points: STEP_SCORE_DISTRIBUTION[index],
    minimumRuns: sequence === 9 ? 0 : minimumRuns.get(sequence) ?? 1,
    configuration: icebreakerConfiguration(sequence),
    closedLoop: ![1, 2, 3, 4, 8, 9].includes(sequence),
  };
});
const errors = validateExperiment(ICEBREAKER_COURSE_STEPS);
if (errors.length) throw new Error(`破冰课程步骤无效 ${JSON.stringify(errors)}`);

export function icebreakerHeadingReference(sequence: number, timeS: number, settings: IcebreakerCourseSettings) {
  if (sequence === 11) return timeS < 20 ? 0 : timeS < 300 ? 5 : -5;
  const target = sequence <= 7 ? 10 : sequence === 15 ? 15 : sequence === 14 ? 5 : sequence >= 17 ? settings.headingBiasDeg ?? 0 : 0;
  return target * Math.max(0, Math.min(1, (timeS - 20) / (sequence === 15 ? settings.rampS : 10)));
}

export function icebreakerUsesSpeedPi(sequence: number) {
  return ICEBREAKER_COURSE_STEPS[sequence - 1].closedLoop && ![10, 12, 13].includes(sequence);
}

export function icebreakerCourseInput(sequence: number, settings: IcebreakerCourseSettings, initial: VesselSessionInput,
  frame: VesselSessionFrame, models: FrozenVesselStudentModel[], designModelId: string): VesselSessionInput {
  const step = ICEBREAKER_COURSE_STEPS[sequence - 1];
  const error = validateIcebreakerSettings(settings);
  if (error) throw new Error(error);
  const input = structuredClone(initial);
  const time = frame.timeS;
  delete input.iceHeadingSchedule;
  delete input.longitudinal;
  input.controlMode = 'manual';
  input.feedback = 'measurement';
  input.derivativeFilterTauS = settings.filterTauS;
  input.headingIntegralTracking = { enabled: true, timeS: 1 };
  let equivalent = 0;
  if (sequence === 2 && time >= 20) equivalent = time < 80 ? 3 : time < 140 ? -3 : 0;
  if (sequence === 3 && time >= 20) equivalent = 3;
  if (sequence === 4 && time >= 20) equivalent = -2;
  for (const shaft of input.actuators.shafts) shaft.azimuth_rad = -equivalent * Math.PI / 180;
  input.targetHeadingDeg = 0;
  if (step.closedLoop) {
    const model = models.find((item) => item.id === designModelId && item.channel === 'azimuth-to-yaw');
    if (!model || model.payload.structure.kind !== 'nomoto1') throw new Error('请选择本人冻结的双吊舱等效偏转—转艏速率一阶模型。');
    const design = designStudentHeadingController(model);
    input.controlMode = settings.integralEnabled ? 'pid' : 'pd';
    input.pid = {
      kp: design.kp * settings.kpMultiplier,
      ki: settings.integralEnabled ? design.kp / settings.integralTimeS : 0,
      kd: design.kd * settings.kdMultiplier,
    };
    input.targetHeadingDeg = icebreakerHeadingReference(sequence, time, settings);
    if (settings.scheduling) {
      const iceModel = models.find((item) => item.id === settings.iceModelId && item.channel === 'azimuth-to-yaw'
        && Number(item.payload.operatingPoint.iceThicknessM) > 0
        && item.payload.trainingRuns.some((window) => window.runRef !== model.payload.trainingRuns[0]?.runRef));
      if (!iceModel || iceModel.payload.structure.kind !== 'nomoto1') throw new Error('两工况调度需要另一份本人冰区局部模型。');
      const iceDesign = designStudentHeadingController(iceModel);
      input.iceHeadingSchedule = {
        declaredThicknessM: icebreakerConfiguration(sequence, settings).ice?.thicknessM ?? 0,
        iceGains: {
          kp: iceDesign.kp * settings.kpMultiplier,
          ki: settings.integralEnabled ? iceDesign.kp / settings.integralTimeS : 0,
          kd: iceDesign.kd * settings.kdMultiplier,
        },
      };
    }
  }
  if (icebreakerUsesSpeedPi(sequence)) {
    const configuration = icebreakerConfiguration(sequence, settings);
    const speed = configuration.initialWaterSpeedMps!;
    const rpm = initial.actuators.shafts.reduce((sum, shaft) => sum + shaft.speed_reference_rad_s * 30 / Math.PI, 0)
      / initial.actuators.shafts.length;
    if (rpm <= 0) throw new Error('本次运行缺少正向推进平衡工作点。');
    // T级速度控制设计模板。静态增益取同一平衡点的u/n，时间尺度60s须由本人运行检验。
    input.longitudinal = {
      localModel: { structure: { kind: 'fopdt', k: speed / rpm, t_s: 60, delay_s: 0 }, speedMps: speed, shaftReferenceRpm: rpm },
      referenceMps: sequence === 16 ? speed : sequence >= 17 ? settings.speedReferenceMps : speed,
      kpMultiplier: 1, tiMultiplier: 1, antiWindup: true, smithEnabled: false,
      filterTauS: Math.max(.2, settings.filterTauS), additionalCommandDelayS: 0,
    };
  }
  if (sequence === 19 && settings.jamFault && settings.stopOnJam && time >= 180) {
    delete input.longitudinal;
    for (const shaft of input.actuators.shafts) shaft.speed_reference_rad_s = 0;
  }
  return input;
}
