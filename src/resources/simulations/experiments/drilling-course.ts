import type { VesselActuatorCommands, VesselSemisubDpInput, VesselSessionConfiguration,
  VesselSessionFrame, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';
import type { FrozenVesselStudentModel } from './student-analysis';
import type { VesselCourseAdapter, VesselCourseStep } from './course-adapter';
import { STEP_SCORE_DISTRIBUTION, validateExperiment } from '../contracts/experiment-step';
import { VESSEL_COURSES } from './course-catalog';
import { VESSEL_COURSE_VERSION } from './destroyer-course';
import { computeVirtualSimulationStep } from '../physics/simulation-engine-facade';
import { DRILLING_RUN_DURATIONS_S, validateDrillingCourseEvidence } from './drilling-evidence';

export interface DrillingCourseSettings {
  thrusterIndex: number;
  excitationAxis: 'x' | 'y' | 'yaw';
  bandwidthRadS: 0.015 | 0.025 | 0.04;
  integralEnabled: boolean;
  integralTimeS: 100 | 200 | 400;
  feedback: VesselSemisubDpInput['feedback'];
  lowFrequencyCutoffHz: 0.02 | 0.04 | 0.08;
  decoupling: boolean;
  windFeedforward: boolean;
  allocation: VesselSemisubDpInput['allocation'];
  axisWeights: [number, number, number];
  energyWeight: number;
  reallocate: boolean;
  navigationLossStrategy: VesselSemisubDpInput['navigationLossStrategy'];
  referenceRampS: 30 | 90 | 180;
  powerBudgetMw: 8 | 16 | 32;
  windSpeedMps: 8 | 12 | 18 | 24 | 30;
  validationSeed: 17 | 29;
}

export interface DrillingCourseStep extends VesselCourseStep {
  points: number;
  configuration: VesselSessionConfiguration;
}

export function drillingCourseDefaultSettings(sequence: number): DrillingCourseSettings {
  return { thrusterIndex: 0, excitationAxis: 'x', bandwidthRadS: 0.025,
    integralEnabled: sequence >= 8, integralTimeS: 200, feedback: 'low_frequency', lowFrequencyCutoffHz: 0.04,
    decoupling: sequence === 7, windFeedforward: sequence >= 9,
    allocation: 'sequential_convex', axisWeights: [1, 1, 1], energyWeight: 1,
    reallocate: true, navigationLossStrategy: 'freeze_integral', referenceRampS: 90,
    powerBudgetMw: 32, windSpeedMps: 8, validationSeed: 17 };
}

export function validateDrillingCourseSettings(settings: DrillingCourseSettings): string | null {
  if (!settings || !Number.isInteger(settings.thrusterIndex) || settings.thrusterIndex < 0 || settings.thrusterIndex > 7
    || !['x', 'y', 'yaw'].includes(settings.excitationAxis)
    || ![0.015, 0.025, 0.04].includes(settings.bandwidthRadS)
    || ![100, 200, 400].includes(settings.integralTimeS)
    || !['raw', 'low_frequency'].includes(settings.feedback)
    || ![0.02, 0.04, 0.08].includes(settings.lowFrequencyCutoffHz)
    || !['pseudoinverse', 'sequential_convex'].includes(settings.allocation)
    || !Array.isArray(settings.axisWeights) || settings.axisWeights.length !== 3
    || settings.axisWeights.some((value) => !Number.isFinite(value) || value < 0.5 || value > 2)
    || !Number.isFinite(settings.energyWeight) || settings.energyWeight < 0.5 || settings.energyWeight > 2
    || !['predict', 'freeze_integral', 'safe_exit'].includes(settings.navigationLossStrategy)
    || ![30, 90, 180].includes(settings.referenceRampS) || ![8, 16, 32].includes(settings.powerBudgetMw)
    || ![8, 12, 18, 24, 30].includes(settings.windSpeedMps)
    || ![17, 29].includes(settings.validationSeed)
    || [settings.integralEnabled, settings.decoupling, settings.windFeedforward, settings.reallocate].some((value) => typeof value !== 'boolean')) {
    return '请选择允许的定位控制、观测、分配与故障策略。';
  }
  return null;
}

const minimumRuns: Record<number, number> = { 3: 3, 6: 2, 7: 2, 8: 2, 9: 2, 12: 2, 13: 2, 15: 2, 18: 2, 19: 2, 20: 6 };

export function drillingCourseConfiguration(sequence: number,
  settings = drillingCourseDefaultSettings(sequence)): VesselSessionConfiguration {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 20) throw new Error('实验步骤不存在。');
  const error = validateDrillingCourseSettings(settings);
  if (error) throw new Error(error);
  const environment = sequence === 8 ? 'C1' : [9, 18].includes(sequence) ? 'W1'
    : [10, 11, 12].includes(sequence) ? 'V2' : sequence === 19 ? 'E2'
      : sequence >= 13 && sequence <= 17 ? 'E1' : 'P0';
  return { vessel: VESSEL_COURSES.drilling.vessel, parameterVersion: VESSEL_COURSES.drilling.parameterVersion,
    initialHeadingDeg: 0, initialPositionNed: [0, 0, 0], seed: sequence === 19 ? settings.validationSeed : 20261106,
    environment, noiseLevel: sequence >= 12 ? 'N1' : 'N0',
    waveFrequencyBins: 16, waveTableProfile: 'teaching-v1',
    secondOrderEnabled: [11, 12, 13, 14, 15, 16, 17, 19].includes(sequence),
    propulsionPowerBudgetW: settings.powerBudgetMw * 1e6,
    driveCutFault: [15, 16, 19].includes(sequence), gnssOutageFault: sequence === 17,
    courseEvidence: { rollWarningDeg: 6 },
    ...(sequence === 18 ? { environmentOverrides: { windSpeedMps: settings.windSpeedMps, windFromDeg: 45, gustSigmaMps: 0 } } : {}),
  };
}

export const DRILLING_COURSE_STEPS: readonly DrillingCourseStep[] = VESSEL_COURSES.drilling.steps.map((source, index) => {
  const sequence = source.sequence;
  const analysis = [4, 20].includes(sequence);
  const configuration = drillingCourseConfiguration(sequence);
  return { experimentId: VESSEL_COURSES.drilling.experimentId, experimentVersion: VESSEL_COURSE_VERSION,
    stepId: `drilling-step-${sequence}`, sequence, title: source.title, learningObjective: source.evidence,
    cognitiveLevel: sequence === 20 ? 'synthesize' : sequence >= 13 ? 'evaluate' : sequence >= 6 ? 'design' : 'analyze',
    stepKind: analysis ? 'analysis' : 'run', trainValidationRole: [5, 19].includes(sequence) ? 'validation' : 'training',
    prerequisites: index ? [`drilling-step-${index}`] : [],
    initialCondition: { speedMps: 0, seed: configuration.seed! }, factorMask: [configuration.environment!, configuration.noiseLevel!],
    studentControls: [{ key: 'bandwidthRadS', label: '定位闭环带宽', min: 0.015, max: 0.04, unit: 'rad/s' }],
    eventTimeline: analysis ? [] : [source.condition], runDurationS: analysis ? undefined : DRILLING_RUN_DURATIONS_S[index],
    observationWindowS: [analysis ? 0 : Math.max(0, DRILLING_RUN_DURATIONS_S[index] - 180), analysis ? 300 : DRILLING_RUN_DURATIONS_S[index]],
    termination: analysis ? sequence === 4 ? '冻结本人低频模型' : '提交六部分报告' : `运行至${DRILLING_RUN_DURATIONS_S[index]}s并保存`,
    measurementSignals: ['North', 'East', 'Heading', 'YawRate', 'WindSpeed', 'WindDirection'],
    requiredArtifacts: sequence === 4 ? ['student-model'] : sequence === 20 ? ['six-own-runs', 'report'] : ['prediction', 'run', 'interpretation'],
    rubric: { kind: sequence >= 6 && sequence <= 19 ? 'design' : 'standard', performanceCriteria: source.evidence, evidenceCriteria: source.interaction },
    hints: [source.interaction], retryPolicy: 'free', minimumRuns: minimumRuns[sequence] ?? 1,
    points: STEP_SCORE_DISTRIBUTION[index], configuration };
});
const contractErrors = validateExperiment(DRILLING_COURSE_STEPS);
if (contractErrors.length) throw new Error(`平台课程定义无效 ${JSON.stringify(contractErrors)}`);

const manualCommands = new Map<string, VesselActuatorCommands>();
function excitationCommands(sequence: number, settings: DrillingCourseSettings) {
  const index = sequence === 2 ? settings.thrusterIndex : null;
  const axis = sequence === 2 ? 'x' : settings.excitationAxis;
  const key = `${index}:${axis}`;
  let commands = manualCommands.get(key);
  if (!commands) {
    const targetBody = axis === 'x' ? [sequence === 2 ? 50e3 : 100e3, 0, 0] : axis === 'y' ? [0, 100e3, 0] : [0, 0, 4e6];
    commands = computeVirtualSimulationStep<VesselActuatorCommands>({ modelId: 'student_model_analysis', operation: 'dp_manual_commands', targetBody, thrusterIndex: index });
    manualCommands.set(key, commands);
  }
  return structuredClone(commands);
}

export function drillingCourseInput(sequence: number, settings: DrillingCourseSettings,
  initial: VesselSessionInput, frame: VesselSessionFrame, model?: FrozenVesselStudentModel): VesselSessionInput {
  const error = validateDrillingCourseSettings(settings);
  if (error) throw new Error(error);
  const input = structuredClone(initial);
  input.controlMode = 'manual';
  delete input.semisubDp;
  input.targetHeadingDeg = 0;
  if ([2, 3].includes(sequence)) {
    input.actuators = excitationCommands(sequence, settings);
    const time = frame.timeS;
    const active = sequence === 2 ? time >= 30 && time < 60
      : [30, 90, 150, 210].some((start) => time >= start && time < start + 30);
    for (const shaft of input.actuators.shafts) {
      if (!active) shaft.speed_reference_rad_s = 0;
      else if (sequence === 3 && ((time >= 90 && time < 120) || (time >= 210 && time < 240))) shaft.speed_reference_rad_s *= -1;
    }
  } else if (sequence >= 5 && sequence <= 19) {
    const ramp = Math.max(0, Math.min(1, (frame.timeS - 30) / (sequence === 14 ? settings.referenceRampS : 1)));
    const target: [number, number] = sequence === 5 ? [2, -2] : [6, 7].includes(sequence) ? [5, 3] : sequence === 14 ? [20, 10] : [0, 0];
    let studentModel: VesselSemisubDpInput['studentModel'] = null;
    if (settings.decoupling) {
      if (model?.channel !== 'dp-low-frequency' || model.payload.structure.kind !== 'dp_low_freq3') {
        throw new Error('请先选择本人冻结的三通道模型，再开启解耦补偿。');
      }
      studentModel = { a: model.payload.structure.a, b: model.payload.structure.b };
    }
    input.controlMode = 'pid';
    input.targetHeadingDeg = (sequence === 14 ? 15 : [6, 7].includes(sequence) ? 5 : 0) * ramp;
    input.semisubDp = { targetPositionM: target.map((value) => value * ramp) as [number, number], targetHeadingDeg: input.targetHeadingDeg,
      bandwidthRadS: settings.bandwidthRadS, integralEnabled: settings.integralEnabled, integralTimeS: settings.integralTimeS,
      feedback: settings.feedback, lowFrequencyCutoffHz: settings.lowFrequencyCutoffHz,
      decoupling: settings.decoupling, studentModel, windFeedforward: settings.windFeedforward,
      allocation: settings.allocation, axisWeights: settings.axisWeights, energyWeight: settings.energyWeight,
      reallocate: settings.reallocate, navigationLossStrategy: settings.navigationLossStrategy };
  }
  return input;
}

export function drillingCourseTraceSamples(trace: VesselTracePoint[]) {
  return trace.filter((_, index) => index % 10 === 0 || index === trace.length - 1).map((point) => {
    const measured = (name: string) => point.measurements[name]?.quality === 'Good' ? point.measurements[name].value ?? NaN : NaN;
    return { time: point.timeS, values: { north: measured('North'), east: measured('East'), heading: measured('Heading'),
      lfNorth: point.estimate.northM, lfEast: point.estimate.eastM, lfHeading: point.estimate.headingDeg,
      requestedX: (point.dp?.requestedBody[0] ?? NaN) / 1000, actualX: (point.dynamics?.external_components?.tau_actuator?.[0] ?? NaN) / 1000,
      requestedY: (point.dp?.requestedBody[1] ?? NaN) / 1000, actualY: (point.dynamics?.external_components?.tau_actuator?.[1] ?? NaN) / 1000,
      requestedYaw: (point.dp?.requestedBody[2] ?? NaN) / 1e6, actualYaw: (point.dynamics?.external_components?.tau_actuator?.[5] ?? NaN) / 1e6,
      roll: point.truth.rollDeg, pitch: point.truth.pitchDeg, heave: -(point.truth.positionNedM?.[2] ?? NaN),
      power: point.truth.motorPowerW.reduce((sum, value) => sum + Math.max(0, value), 0) / 1e6,
      waterSpeed: point.truth.waterSpeedMps, groundSpeed: point.truth.groundBodySpeedMps } };
  });
}

export const drillingCourseAdapter: VesselCourseAdapter<DrillingCourseSettings> = {
  courseKey: 'drilling', experimentKey: 'drilling-dp', steps: DRILLING_COURSE_STEPS,
  defaultSettings: drillingCourseDefaultSettings,
  restoreSettings(value, sequence) {
    const settings = (value ?? drillingCourseDefaultSettings(sequence)) as DrillingCourseSettings;
    const error = validateDrillingCourseSettings(settings);
    if (error) throw new Error(error);
    return settings;
  },
  configuration: drillingCourseConfiguration,
  input: (sequence, settings, initial, frame, models, id) => drillingCourseInput(sequence, settings, initial, frame, models.find((model) => model.id === id)),
  traceSamples: drillingCourseTraceSamples,
  validateEvidence: (step, evidence) => validateDrillingCourseEvidence(DRILLING_COURSE_STEPS[step.sequence - 1], evidence),
};
