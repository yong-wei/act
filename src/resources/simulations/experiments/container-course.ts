import type { VesselContainerSpeedInput, VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { STEP_SCORE_DISTRIBUTION, validateExperiment } from '../contracts/experiment-step';
import { VESSEL_COURSES } from './course-catalog';
import { VESSEL_COURSE_VERSION } from './destroyer-course';
import type { VesselCourseAdapter, VesselCourseStep } from './course-adapter';
import { lngStudentSpeedModel } from './lng-course';
import { forecastContainerSpeed, type FrozenVesselStudentModel } from './student-analysis';
import { validateContainerCourseEvidence } from './container-evidence';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

export interface ContainerCourseSettings {
  loadingRatio: .2 | .6 | .9;
  initialSpeedMps: 6 | 8 | 10;
  excitationPercent: -5 | 5;
  modelIds: [string, string, string];
  schedulingEnabled: boolean;
  bumpless: boolean;
  kpMultiplier: number;
  tiMultiplier: number;
  antiWindup: boolean;
  filterTauS: .2 | 1 | 3;
  feedback: 'water' | 'ground';
  losLookaheadM: number;
  segmentSpeedsMps: [number, number, number, number];
  validationSeed: 17 | 29;
  meanWaveResistanceEnabled?: boolean;
}

export interface ContainerCourseStep extends VesselCourseStep {
  points: number;
  configuration: VesselSessionConfiguration;
  speedControl: boolean;
  voyageTask: boolean;
}

export function containerCourseDefaultSettings(sequence: number): ContainerCourseSettings {
  return {loadingRatio: [2, 5, 8, 9, 14].includes(sequence) ? .2 : .6,
    initialSpeedMps: sequence === 6 ? 6 : 8, excitationPercent: sequence === 6 ? -5 : 5,
    modelIds: ['', '', ''], schedulingEnabled: sequence >= 9, bumpless: true,
    kpMultiplier: 1, tiMultiplier: 1, antiWindup: true, filterTauS: .2, feedback: 'water',
    losLookaheadM: 400, segmentSpeedsMps: [8, 8, 8, 8], validationSeed: 17,
    ...(sequence >= 15 ? {meanWaveResistanceEnabled: true} : {})};
}

export function validateContainerCourseSettings(settings: ContainerCourseSettings): string | null {
  if (!settings || typeof settings !== 'object' || ![.2, .6, .9].includes(settings.loadingRatio)
    || ![6, 8, 10].includes(settings.initialSpeedMps) || ![-5, 5].includes(settings.excitationPercent)
    || !Array.isArray(settings.modelIds) || settings.modelIds.length !== 3 || settings.modelIds.some((id) => typeof id !== 'string')
    || ![settings.schedulingEnabled, settings.bumpless, settings.antiWindup].every((value) => typeof value === 'boolean')
    || !Number.isFinite(settings.kpMultiplier) || settings.kpMultiplier < .2 || settings.kpMultiplier > 3
    || !Number.isFinite(settings.tiMultiplier) || settings.tiMultiplier < .3 || settings.tiMultiplier > 3
    || ![.2, 1, 3].includes(settings.filterTauS) || !['water', 'ground'].includes(settings.feedback)
    || !Number.isFinite(settings.losLookaheadM) || settings.losLookaheadM < 200 || settings.losLookaheadM > 800
    || !Array.isArray(settings.segmentSpeedsMps) || settings.segmentSpeedsMps.length !== 4
    || settings.segmentSpeedsMps.some((value) => !Number.isFinite(value) || value < 6 || value > 12)
    || ![17, 29].includes(settings.validationSeed)) return '请选择允许的装载、航速、三点模型及控制参数。';
  if (settings.meanWaveResistanceEnabled !== undefined && typeof settings.meanWaveResistanceEnabled !== 'boolean') {
    return '请选择是否启用教学平均附加阻力。';
  }
  return null;
}

export function containerCourseConfiguration(sequence: number,
  settings = containerCourseDefaultSettings(sequence)): VesselSessionConfiguration {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 20) throw new Error('实验步骤不存在。');
  const error = validateContainerCourseSettings(settings);
  if (error) throw new Error(error);
  if ([5, 8, 9, 14].includes(sequence) && ![.2, .9].includes(settings.loadingRatio)) {
    throw new Error('本步需要分别比较.2与.9装载。');
  }
  const config: VesselSessionConfiguration = {vessel: VESSEL_COURSES.container.vessel,
    parameterVersion: VESSEL_COURSES.container.parameterVersion,
    loadingRatio: sequence === 19 ? settings.validationSeed === 17 ? .35 : .8
      : [2, 5, 8, 9, 14].includes(sequence) ? settings.loadingRatio : .6,
    initialWaterSpeedMps: sequence === 2 ? 0 : sequence === 6 ? settings.initialSpeedMps : 8,
    initialHeadingDeg: 0, initialPositionNed: [0, 0, 0], waterDepthM: 200,
    seed: sequence === 19 ? settings.validationSeed : 20261106,
    environment: [17, 18, 19].includes(sequence) ? 'E1' : [13, 16].includes(sequence) ? 'C1'
      : sequence === 14 ? 'W1' : sequence === 15 ? 'V2' : 'P0',
    noiseLevel: sequence >= 16 && sequence <= 19 ? 'N1' : 'N0', courseEvidence: {rollWarningDeg: 8}};
  if (sequence >= 11 && sequence <= 19) config.containerVoyage = {
    segmentSpeedsMps: sequence === 11 ? [8, 8, 8, 8] : [...settings.segmentSpeedsMps]};
  if (sequence >= 15 && sequence <= 19 && settings.meanWaveResistanceEnabled) {
    config.meanWaveResistanceModel = 'container_reflection_teaching_v1';
  }
  return config;
}

const durations = [60, 1, 600, 600, 600, 600, 600, 600, 600, 900,
  1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200, 1200];
const minimumRuns: Record<number, number> = {2: 3, 5: 2, 6: 2, 8: 2, 9: 2, 10: 2, 12: 2, 13: 2, 14: 2, 15: 2, 16: 2, 19: 2, 20: 5};

export const CONTAINER_COURSE_STEPS: readonly ContainerCourseStep[] = VESSEL_COURSES.container.steps.map((source, index) => {
  const seq = source.sequence;
  const config = containerCourseConfiguration(seq);
  return {experimentId: VESSEL_COURSES.container.experimentId, experimentVersion: VESSEL_COURSE_VERSION,
    stepId: `container-step-${seq}`, sequence: seq, title: source.title, learningObjective: source.evidence,
    cognitiveLevel: seq === 20 ? 'synthesize' : seq >= 17 ? 'evaluate' : seq >= 7 ? 'design' : 'analyze',
    stepKind: seq === 20 ? 'analysis' : 'run', trainValidationRole: [4, 19].includes(seq) ? 'validation' : 'training',
    prerequisites: index ? [`container-step-${index}`] : [], initialCondition: {speedMps: config.initialWaterSpeedMps!, loadingRatio: config.loadingRatio!, seed: config.seed!},
    factorMask: [config.environment!, config.noiseLevel!],
    studentControls: [{key: 'loadingRatio', label: '装载率', min: .2, max: .9, unit: '倍'}],
    eventTimeline: seq === 20 ? [] : [source.condition], runDurationS: seq === 20 ? undefined : durations[index],
    observationWindowS: [0, durations[index]], termination: seq >= 11 && seq <= 19
      ? '实际北向航程达到6000m或运行1200s，保留到达、超时和约束结果' : `运行至${durations[index]}s并保存`,
    measurementSignals: ['ShaftSpeed0', 'SpeedLog', 'Heading', 'North', 'East'],
    requiredArtifacts: seq === 20 ? ['five-own-runs', 'report'] : ['prediction', 'run', 'interpretation'],
    rubric: {kind: seq >= 7 && seq <= 19 ? 'design' : 'standard', performanceCriteria: source.evidence, evidenceCriteria: source.interaction},
    hints: [seq === 15 ? '固定同一波场、本人模型和速度计划，分别关闭与开启T级教学平均附加阻力，比较实际航次、运动及燃油，并说明假设范围。' : source.interaction],
    retryPolicy: 'free', points: STEP_SCORE_DISTRIBUTION[index],
    minimumRuns: minimumRuns[seq] ?? 1, configuration: config, speedControl: seq >= 7 && seq <= 19,
    voyageTask: seq >= 11 && seq <= 19};
});

const errors = validateExperiment(CONTAINER_COURSE_STEPS);
if (errors.length) throw new Error(`集装箱船教学步骤无效 ${JSON.stringify(errors)}`);

export function containerModelBank(settings: ContainerCourseSettings, models: FrozenVesselStudentModel[]): VesselContainerSpeedInput['models'] {
  const selected = settings.modelIds.map((id) => models.find((model) => model.id === id));
  if (new Set(settings.modelIds).size !== 3 || selected.some((model) => !model)) throw new Error('请选定三个不同的本人冻结航速模型。');
  return selected.map((model) => ({loadingRatio: Number(model!.payload.operatingPoint.loadingRatio),
    operatingModel: lngStudentSpeedModel(model)})) as VesselContainerSpeedInput['models'];
}

export function containerCourseInput(sequence: number, settings: ContainerCourseSettings, initial: VesselSessionInput,
  frame: VesselSessionFrame, models: FrozenVesselStudentModel[]): VesselSessionInput {
  const error = validateContainerCourseSettings(settings);
  if (error) throw new Error(error);
  const input = structuredClone(initial);
  input.controlMode = sequence === 2 ? 'manual' : 'pd';
  input.pid = {kp: 1.5, ki: 0, kd: 20}; input.feedback = 'measurement'; input.targetHeadingDeg = 0;
  delete input.containerSpeed;
  if ([3, 4, 5, 6].includes(sequence) && frame.timeS >= 30) {
    const percent = sequence === 3 ? 5 : sequence === 4 ? -4 : settings.excitationPercent;
    for (const shaft of input.actuators.shafts) shaft.speed_reference_rad_s *= 1 + percent / 100;
  }
  if (sequence >= 7 && sequence <= 19) {
    input.containerSpeed = {models: containerModelBank(settings, models), referenceMps: containerReferenceMps(sequence, frame.timeS),
      fixedModelIndex: 1, schedulingEnabled: sequence >= 9 && settings.schedulingEnabled,
      bumpless: settings.bumpless, kpMultiplier: settings.kpMultiplier, tiMultiplier: settings.tiMultiplier,
      antiWindup: settings.antiWindup, filterTauS: settings.filterTauS,
      feedback: sequence === 13 ? settings.feedback : 'water',
      losLookaheadM: [13, 16, 17, 18, 19].includes(sequence) ? settings.losLookaheadM : null};
  }
  return input;
}

export function containerReferenceMps(sequence: number, timeS: number) {
  if (sequence === 10) return timeS < 30 || timeS >= 450 ? 8 : 10;
  return sequence >= 7 && sequence <= 9 && timeS >= 30 ? 9 : 8;
}

export function containerCourseTraceSamples(trace: VesselTracePoint[]) {
  return trace.filter((_, index) => index % 20 === 0 || index === trace.length - 1).map((point) => {
    const measured = (key: string) => point.measurements[key]?.quality === 'Good' ? point.measurements[key].value ?? NaN : NaN;
    return {time: point.timeS, values: {speed: measured('SpeedLog'), groundSpeed: point.estimate.groundBodySpeedMps,
      reference: point.container?.slewedReferenceMps ?? NaN, shaftRpm: measured('ShaftSpeed0'),
      referenceRpm: point.command.shaftRpm[0], heading: measured('Heading'), north: point.truth.northM, east: measured('East'),
      power: point.truth.motorPowerW.reduce((sum, power) => sum + power, 0) / 1e6,
      fuel: point.truth.fuelKg ?? NaN, firstOrder: (point.truth.waveFirstLoad?.[0] ?? NaN) / 1000,
      secondOrder: (point.truth.waveSecondLoad?.[0] ?? NaN) / 1000}};
  });
}

export const containerCourseAdapter: VesselCourseAdapter<ContainerCourseSettings> = {
  courseKey: 'container', experimentKey: 'container-voyage', steps: CONTAINER_COURSE_STEPS,
  defaultSettings: containerCourseDefaultSettings,
  restoreSettings(value, sequence) {
    const settings = (value ?? containerCourseDefaultSettings(sequence)) as ContainerCourseSettings;
    const error = validateContainerCourseSettings(settings);
    if (error) throw new Error(error);
    return settings;
  },
  configuration: containerCourseConfiguration,
  input: (sequence, settings, initial, frame, models) => containerCourseInput(sequence, settings, initial, frame, models),
  traceSamples: containerCourseTraceSamples,
  validateEvidence: (step, evidence) => validateContainerCourseEvidence(CONTAINER_COURSE_STEPS[step.sequence - 1], evidence),
  forecast: forecastContainerSpeed,
};
