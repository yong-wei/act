import type {VesselDredgerInput, VesselDredgerMode, VesselSessionConfiguration, VesselSessionFrame,
  VesselSessionInput} from '@/lib/control-engine/vessel-session';
import {STEP_SCORE_DISTRIBUTION, validateExperiment, type ExperimentStep} from '../contracts/experiment-step';
import {VESSEL_COURSES} from './course-catalog';
import {VESSEL_COURSE_VERSION} from './destroyer-course';
import type {FrozenVesselStudentModel} from './student-analysis';

export interface DredgerCourseSettings {
  transitRpm: number;
  rudderDeg: number;
  manualCable: 'port' | 'starboard';
  manualWinchMps: number;
  targetDepthM: number;
  cutterRpm: number;
  referenceMps: number;
  halfAngleDeg: number;
  kpMultiplier: number;
  tiMultiplier: number;
  reversalRampS: 5 | 15 | 30;
  entrySpeedMps: number;
  entryHoldS: 5 | 10 | 20;
  safetyFraction: number;
  integralPolicy: 'track' | 'freeze' | 'reset';
  depthFilterTauS: number;
  swayFilterTauS: number;
  wavesEnabled: boolean;
  validationSeed: 17 | 29;
}

export interface DredgerCourseStep extends ExperimentStep {
  sequence: number;
  points: number;
  minimumRuns: number;
  closedLoop: boolean;
}

export function dredgerDefaultSettings(_sequence: number): DredgerCourseSettings {
  return {transitRpm: 80, rudderDeg: 0, manualCable: 'port', manualWinchMps: -0.015,
    targetDepthM: 20.3, cutterRpm: 30, referenceMps: 0.08, halfAngleDeg: 10,
    kpMultiplier: 0.2, tiMultiplier: 3, reversalRampS: 15, entrySpeedMps: 0.05,
    entryHoldS: 10, safetyFraction: 1, integralPolicy: 'track', depthFilterTauS: 0.2,
    swayFilterTauS: 0.2, wavesEnabled: true, validationSeed: 17};
}

export function validateDredgerSettings(value: DredgerCourseSettings): string | null {
  const ranges = [[value.transitRpm, -180, 180], [value.rudderDeg, -35, 35],
    [value.manualWinchMps, -0.05, 0.05], [value.targetDepthM, 19.5, 20.5],
    [value.cutterRpm, 10, 40], [value.referenceMps, 0.03, 0.15], [value.halfAngleDeg, 1, 15],
    [value.kpMultiplier, 0.2, 3], [value.tiMultiplier, 0.2, 3], [value.entrySpeedMps, 0.03, 0.1],
    [value.safetyFraction, 0.7, 1], [value.depthFilterTauS, 0.05, 5], [value.swayFilterTauS, 0.05, 5]];
  if (ranges.some(([number, low, high]) => !Number.isFinite(number) || number < low || number > high)
    || ![5, 15, 30].includes(value.reversalRampS) || ![5, 10, 20].includes(value.entryHoldS)
    || ![17, 29].includes(value.validationSeed) || !['port', 'starboard'].includes(value.manualCable)
    || !['track', 'freeze', 'reset'].includes(value.integralPolicy) || typeof value.wavesEnabled !== 'boolean') {
    return '请选择本步允许的桥架、绞刀、横移与模式转换参数。';
  }
  return null;
}

export function dredgerConfiguration(sequence: number,
  settings: DredgerCourseSettings = dredgerDefaultSettings(sequence)): VesselSessionConfiguration {
  const error = validateDredgerSettings(settings);
  if (error) throw new Error(error);
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 20) throw new Error('实验步骤不存在。');
  const combined = sequence >= 15;
  const wave = combined && sequence !== 15 && (sequence !== 16 || settings.wavesEnabled);
  const clay = sequence === 11 || sequence === 12 || (sequence === 19 && settings.validationSeed === 29);
  return {vessel: VESSEL_COURSES.dredger.vessel, parameterVersion: VESSEL_COURSES.dredger.parameterVersion,
    initialHeadingDeg: 0, initialPositionNed: [0, 0, 0],
    seed: sequence === 19 ? settings.validationSeed : 20261106,
    noiseLevel: sequence >= 17 ? 'N1' : 'N0',
    environment: sequence === 2 ? 'C1' : combined ? 'E1' : 'P0',
    ...(combined ? {environmentSwitches: {wind_force_enabled: true, current_enabled: true, wave_enabled: wave}} : {}),
    ...(wave ? {environmentOverrides: {wave: {hs_m: 0.5, tp_s: 6, direction_to_deg: 90, water_depth_m: 20}}} : {}),
    dredger: {soil: clay ? 'clay' : 'sand', initialDepthM: sequence >= 4 ? 19.5 : null,
      initialSpudDown: sequence >= 4, initialCablesAttached: sequence >= 4,
      cableBreakTimeS: sequence === 18 ? 180 : null, brokenCableIndex: 1},
    courseEvidence: {rollWarningDeg: 8}};
}

const minimumRuns = new Map([[4, 2], [10, 2], [12, 2], [13, 3], [14, 2], [15, 2], [16, 2], [17, 3], [19, 2], [20, 6]]);
export const DREDGER_COURSE_STEPS: readonly DredgerCourseStep[] = VESSEL_COURSES.dredger.steps.map((source, index) => {
  const sequence = source.sequence;
  const duration = sequence === 1 ? 120 : sequence < 9 ? 300 : 600;
  return {experimentId: VESSEL_COURSES.dredger.experimentId, experimentVersion: VESSEL_COURSE_VERSION,
    stepId: `dredger-step-${sequence}`, sequence, title: source.title,
    learningObjective: source.evidence, cognitiveLevel: sequence === 20 ? 'synthesize'
      : sequence >= 15 ? 'evaluate' : sequence >= 9 ? 'design' : 'analyze',
    stepKind: sequence === 20 ? 'analysis' : 'run',
    trainValidationRole: [6, 19].includes(sequence) ? 'validation' : sequence === 20 ? 'none' : 'training',
    prerequisites: index ? [`dredger-step-${index}`] : [], initialCondition: {speedMps: 0},
    factorMask: sequence === 2 ? ['C1', 'N0'] : sequence >= 17 ? ['W1', 'C1', 'V1', 'N1']
      : sequence >= 16 ? ['W1', 'C1', 'V1', 'N0'] : sequence === 15 ? ['W1', 'C1', 'N0'] : ['P0', 'N0'],
    studentControls: [{key: 'referenceMps', label: '横移速度参考', min: 0.03, max: 0.15, unit: 'm/s'}],
    eventTimeline: sequence === 20 ? [] : [source.condition], runDurationS: sequence === 20 ? undefined : duration,
    observationWindowS: [0, duration], termination: sequence === 20 ? '引用六组本人运行完成报告' : `运行至${duration}s，保留安全退出与未达结果`,
    measurementSignals: ['DredgerDepth', 'DredgerSwaySpeed', 'DredgerCutterRpm', 'DredgerCableTension0', 'DredgerCableTension1', 'DredgerSpudForce'],
    requiredArtifacts: sequence === 20 ? ['six-own-runs', 'frozen-model', 'independent-validation', 'report'] : ['prediction', 'run', 'interpretation'],
    rubric: {kind: sequence >= 9 ? 'design' : 'standard', performanceCriteria: source.evidence, evidenceCriteria: source.interaction},
    hints: [source.interaction], retryPolicy: 'free', points: STEP_SCORE_DISTRIBUTION[index],
    minimumRuns: minimumRuns.get(sequence) ?? 1, closedLoop: sequence >= 9 && sequence < 20};
});
const errors = validateExperiment(DREDGER_COURSE_STEPS);
if (errors.length) throw new Error(`天鲸课程步骤无效 ${JSON.stringify(errors)}`);

export function dredgerCourseInput(sequence: number, settings: DredgerCourseSettings, initial: VesselSessionInput,
  frame: VesselSessionFrame, models: FrozenVesselStudentModel[], designModelId: string): VesselSessionInput {
  const error = validateDredgerSettings(settings);
  if (error) throw new Error(error);
  const input = structuredClone(initial);
  input.controlMode = 'manual';
  input.feedback = 'measurement';
  input.targetHeadingDeg = 0;
  const time = frame.timeS;
  for (const shaft of input.actuators.shafts) {
    shaft.speed_reference_rad_s = (sequence === 2 ? settings.transitRpm : 0) * Math.PI / 30;
    shaft.motor_torque_override_nm = null;
  }
  for (const rudder of input.actuators.surfaces) rudder.angle_rad = settings.rudderDeg * Math.PI / 180;
  const model = models.find((model) => model.id === designModelId && model.channel === 'winch-reference-to-sway');
  const structure = model?.payload.structure;
  input.dredger = dredgerCourseControl(sequence, settings, time,
    structure && ['nomoto1', 'nomoto2', 'fopdt'].includes(structure.kind)
      ? structure as NonNullable<VesselDredgerInput['localModel']> : null);
  return input;
}

/** 页面与证据入口共同核对同一课程命令，物理状态和模式转换由原生会话决定。 */
export function dredgerCourseControl(sequence: number, settings: DredgerCourseSettings, time: number,
  localModel: VesselDredgerInput['localModel']): VesselDredgerInput {
  let mode: VesselDredgerMode = sequence <= 2 ? 'transit' : sequence === 3 ? 'prepare' : 'spud_hold';
  if (sequence === 3 && time >= 60 && time < 80) mode = 'exit';
  if (sequence === 3 && time >= 80 && time < 140) mode = 'transit';
  if (sequence >= 9) mode = 'cut_swing';
  if (sequence === 14 && ((time >= 180 && time < 240) || (time >= 360 && time < 420))) mode = 'spud_hold';
  const winch: [number, number] = [0, 0];
  if (sequence === 4 && time >= 30 && time < 90) winch[settings.manualCable === 'port' ? 0 : 1] = settings.manualWinchMps;
  if (sequence === 5 || sequence === 6) {
    const sign = sequence === 5 ? 1 : -1;
    const pulse = time >= 40 && time < 100 ? 0.015 * sign : time >= 160 && time < 220 ? -0.015 * sign : 0;
    winch[0] = pulse; winch[1] = -pulse;
  }
  const targetDepth = sequence <= 3 ? -0.5 : sequence === 7 || sequence >= 9 ? settings.targetDepthM : 19.5;
  const control: VesselDredgerInput = {
    requestedMode: mode,
    commands: {spudDown: sequence >= 3, cablesAttached: sequence >= 3, winchSpeedMps: winch,
      depthReferenceM: targetDepth, cutterRpm: sequence >= 8 ? settings.cutterRpm : 0,
      carriageSpeedMps: sequence === 3 && time >= 80 && time < 120 ? 0.025 : 0},
    automaticSwing: sequence >= 9, localModel: null,
    referenceMps: settings.referenceMps, halfAngleDeg: settings.halfAngleDeg, reversalRampS: settings.reversalRampS,
    kpMultiplier: settings.kpMultiplier, tiMultiplier: settings.tiMultiplier,
    entrySpeedMps: settings.entrySpeedMps, entryHoldS: settings.entryHoldS, safetyFraction: settings.safetyFraction,
    integralPolicy: settings.integralPolicy, depthFilterTauS: settings.depthFilterTauS, swayFilterTauS: settings.swayFilterTauS,
  };
  if (control.automaticSwing) {
    if (!localModel) {
      throw new Error('请先冻结并选择本人绞车指令—横移速度的局部联合模型。');
    }
    control.localModel = localModel;
  }
  return control;
}
