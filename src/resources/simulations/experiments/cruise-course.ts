import type {
  VesselCruiseFinInput,
  VesselSessionConfiguration,
  VesselSessionFrame,
  VesselSessionInput,
} from '@/lib/control-engine/vessel-session';
import { STEP_SCORE_DISTRIBUTION, validateExperiment } from '../contracts/experiment-step';
import type { VesselCourseAdapter, VesselCourseStep } from './course-adapter';
import { VESSEL_COURSES } from './course-catalog';
import { VESSEL_COURSE_VERSION } from './destroyer-course';
import type { FrozenVesselStudentModel } from './student-analysis';
import { validateCruiseCourseEvidence } from './cruise-evidence';
import type { VesselTracePoint } from '@/features/simulations/run-evidence';

export interface CruiseCourseSettings {
  speedMps: 0 | 2 | 4 | 8 | 10;
  finsEnabled: boolean;
  dampingRatio: 0.3 | 0.5 | 0.7;
  stiffnessFraction: 0 | 0.2 | 0.5;
  lowPassCutoffHz: 0.15 | 0.3 | 0.6;
  notchEnabled: boolean;
  notchCenterHz: number;
  notchBandwidthHz: 0.03 | 0.06 | 0.1;
  headingRampS: 10 | 40 | 80;
  identifiedPeriodS: number;
  resonanceRatio: 0.7 | 1 | 1.3;
  faultStrategy: 'keep' | 'slow' | 'long-turn';
}

export interface CruiseCourseStep extends VesselCourseStep {
  points: number;
  configuration: VesselSessionConfiguration;
  finControl: boolean;
}

export function cruiseCourseDefaultSettings(sequence: number): CruiseCourseSettings {
  return {
    speedMps: sequence === 7 ? 0 : sequence === 13 ? 4 : 8,
    finsEnabled: sequence >= 8,
    dampingRatio: sequence === 10 ? 0.3 : 0.5,
    stiffnessFraction: 0,
    lowPassCutoffHz: 0.3,
    notchEnabled: false,
    notchCenterHz: 1 / 7,
    notchBandwidthHz: 0.06,
    headingRampS: sequence === 12 ? 40 : 10,
    identifiedPeriodS: 20,
    resonanceRatio: 0.7,
    faultStrategy: 'keep',
  };
}

export function validateCruiseCourseSettings(settings: CruiseCourseSettings): string | null {
  if (
    !settings ||
    typeof settings !== 'object' ||
    ![0, 2, 4, 8, 10].includes(settings.speedMps) ||
    typeof settings.finsEnabled !== 'boolean' ||
    typeof settings.notchEnabled !== 'boolean' ||
    ![0.3, 0.5, 0.7].includes(settings.dampingRatio) ||
    ![0, 0.2, 0.5].includes(settings.stiffnessFraction) ||
    ![0.15, 0.3, 0.6].includes(settings.lowPassCutoffHz) ||
    ![0.03, 0.06, 0.1].includes(settings.notchBandwidthHz) ||
    !Number.isFinite(settings.notchCenterHz) ||
    settings.notchCenterHz < 0.02 ||
    settings.notchCenterHz > 2 ||
    ![10, 40, 80].includes(settings.headingRampS) ||
    ![0.7, 1, 1.3].includes(settings.resonanceRatio) ||
    !Number.isFinite(settings.identifiedPeriodS) ||
    settings.identifiedPeriodS < 3.72 ||
    settings.identifiedPeriodS > 23 ||
    !['keep', 'slow', 'long-turn'].includes(settings.faultStrategy)
  )
    return '请选择允许的航速、鳍反馈、滤波和转向参数。';
  return null;
}

export function cruiseStudentRollModel(
  model: Pick<FrozenVesselStudentModel, 'channel' | 'payload'> | undefined,
  requireControlGain = true,
): VesselCruiseFinInput['model'] {
  const structure = model?.payload.structure;
  const inertia = Number(model?.payload.operatingPoint.rollInertiaKgM2);
  if (
    !model ||
    model.channel !== 'fin-to-roll' ||
    structure?.kind !== 'roll_oscillator' ||
    !Number.isFinite(inertia) ||
    inertia <= 0 ||
    (requireControlGain && structure.control_gain <= 0)
  )
    throw new Error('请先完成本人自由衰减与差动鳍激励，冻结有效横摇模型。');
  return {
    inertiaKgM2: inertia,
    dampingNmSRad: 2 * structure.damping * structure.natural_freq_rad_s * inertia,
    stiffnessNmRad: structure.natural_freq_rad_s ** 2 * inertia,
  };
}

const durations = [
  60, 300, 300, 300, 600, 600, 120, 600, 600, 600, 400, 400, 600, 600, 600, 400, 400, 600, 600, 600,
];
const waveSteps = new Set([5, 6, 8, 9, 10, 13, 14, 15, 16, 17, 18, 19]);

export function cruiseCourseConfiguration(
  sequence: number,
  settings = cruiseCourseDefaultSettings(sequence),
): VesselSessionConfiguration {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > 20) throw new Error('实验步骤不存在。');
  const error = validateCruiseCourseSettings(settings);
  if (error) throw new Error(error);
  if (
    (sequence === 7 && ![0, 2, 8].includes(settings.speedMps)) ||
    (sequence === 13 && ![4, 8, 10].includes(settings.speedMps))
  )
    throw new Error('请选择本步指定的三个航速工作点。');
  if (sequence === 12 && ![40, 80].includes(settings.headingRampS))
    throw new Error('本步比较40或80秒转向斜坡。');
  const duration = durations[sequence - 1];
  const configuration: VesselSessionConfiguration = {
    vessel: VESSEL_COURSES.cruise.vessel,
    parameterVersion: VESSEL_COURSES.cruise.parameterVersion,
    initialWaterSpeedMps: [7, 13].includes(sequence) ? settings.speedMps : 8,
    initialHeadingDeg: 0,
    initialPositionNed: [0, 0, 0],
    initialRollDeg: sequence === 2 ? 2 : sequence === 4 ? 1 : 0,
    seed: sequence === 18 ? 17 : sequence === 19 ? 29 : 20261106,
    environment:
      sequence >= 16 && sequence <= 19
        ? 'E1'
        : [10, 13, 14, 15].includes(sequence)
          ? 'V2'
          : waveSteps.has(sequence)
            ? 'V1'
            : 'P0',
    noiseLevel: [14, 15, 16, 17, 18, 19].includes(sequence) ? 'N1' : 'N0',
    courseEvidence: { rollWarningDeg: 6 },
    cruise: {
      statisticsStartS: waveSteps.has(sequence) && duration === 600 ? 120 : 0,
      statisticsEndS: duration,
      finFailureTimeS: sequence === 19 ? 180 : null,
      failedFinIndex: sequence === 19 ? 0 : null,
    },
  };
  if (sequence === 6) {
    configuration.regularWaveHeightM = 0.5;
    configuration.environmentOverrides = {
      wave: {
        hs_m: Math.SQRT2 * 0.5,
        tp_s: settings.identifiedPeriodS * settings.resonanceRatio,
        direction_to_deg: 90,
        water_depth_m: 200,
      },
    };
  }
  if (sequence === 18)
    configuration.environmentOverrides = {
      wave: { hs_m: 1.5, tp_s: 10, direction_to_deg: 90, water_depth_m: 200 },
    };
  return configuration;
}

const minimumRuns: Record<number, number> = { 6: 3, 7: 3, 9: 2, 10: 2, 12: 2, 13: 3, 14: 2, 15: 2, 20: 5 };
export const CRUISE_COURSE_STEPS: readonly CruiseCourseStep[] = VESSEL_COURSES.cruise.steps.map(
  (source, index) => {
    const seq = source.sequence,
      configuration = cruiseCourseConfiguration(seq),
      duration = durations[index];
    return {
      experimentId: VESSEL_COURSES.cruise.experimentId,
      experimentVersion: VESSEL_COURSE_VERSION,
      stepId: `cruise-step-${seq}`,
      sequence: seq,
      title: source.title,
      learningObjective: source.evidence,
      cognitiveLevel: seq === 20 ? 'synthesize' : seq >= 16 ? 'evaluate' : seq >= 8 ? 'design' : 'analyze',
      stepKind: seq === 20 ? 'analysis' : 'run',
      trainValidationRole: [4, 18, 19].includes(seq) ? 'validation' : 'training',
      prerequisites: index ? [`cruise-step-${index}`] : [],
      initialCondition: { speedMps: configuration.initialWaterSpeedMps!, seed: configuration.seed! },
      factorMask: [configuration.environment!, configuration.noiseLevel!],
      studentControls: [{ key: 'dampingRatio', label: '目标横摇阻尼比', min: 0.3, max: 0.7, unit: '1' }],
      eventTimeline: seq === 20 ? [] : [source.condition],
      runDurationS: seq === 20 ? undefined : duration,
      observationWindowS: [configuration.cruise!.statisticsStartS, duration],
      termination: seq === 20 ? '提交六部分报告' : `运行至${duration}s并保存`,
      measurementSignals: [
        'RollRate',
        'SpecificForceY',
        'SpecificForceZ',
        'SurfaceEncoder0',
        'SurfaceEncoder1',
        'Heading',
        'SpeedLog',
      ],
      requiredArtifacts: seq === 20 ? ['five-own-runs', 'report'] : ['prediction', 'run', 'interpretation'],
      rubric: {
        kind: seq >= 8 && seq <= 19 ? 'design' : 'standard',
        performanceCriteria: source.evidence,
        evidenceCriteria: source.interaction,
      },
      hints: [source.interaction],
      retryPolicy: 'free',
      minimumRuns: minimumRuns[seq] ?? 1,
      points: STEP_SCORE_DISTRIBUTION[index],
      configuration,
      finControl: seq >= 8 && seq <= 19,
    };
  },
);
const errors = validateExperiment(CRUISE_COURSE_STEPS);
if (errors.length) throw new Error(`邮轮教学步骤无效 ${JSON.stringify(errors)}`);

export function cruiseCourseInput(
  sequence: number,
  settings: CruiseCourseSettings,
  initial: VesselSessionInput,
  frame: VesselSessionFrame,
  model?: FrozenVesselStudentModel,
): VesselSessionInput {
  const error = validateCruiseCourseSettings(settings);
  if (error) throw new Error(error);
  const input = structuredClone(initial),
    time = frame.timeS;
  input.controlMode = 'pd';
  input.pid = { kp: 1.5, ki: 0, kd: 20 };
  input.feedback = 'measurement';
  input.targetHeadingDeg = 0;
  if ([11, 12, 16, 17, 18, 19].includes(sequence)) {
    const start = sequence === 19 ? 180 : 20;
    const ramp =
      sequence === 11
        ? 10
        : sequence === 19 && settings.faultStrategy === 'long-turn'
          ? 80
          : settings.headingRampS;
    input.targetHeadingDeg = 20 * Math.max(0, Math.min(1, (time - start) / ramp));
  }
  for (const [index, fin] of input.actuators.surfaces.entries()) {
    const pulse =
      sequence === 3
        ? time >= 20 && time < 30
          ? 2
          : time >= 60 && time < 70
            ? -2
            : 0
        : sequence === 4 && time >= 20 && time < 30
          ? 1
          : sequence === 7 && time >= 20
            ? 5
            : 0;
    fin.angle_rad = ((index === 0 ? pulse : -pulse) * Math.PI) / 180;
    fin.enabled = pulse !== 0;
  }
  delete input.cruiseFins;
  if (sequence === 6) {
    cruiseStudentRollModel(model, false);
    const structure = model!.payload.structure;
    if (
      structure.kind !== 'roll_oscillator' ||
      Math.abs(settings.identifiedPeriodS - (2 * Math.PI) / structure.natural_freq_rad_s) > 1e-6
    ) {
      throw new Error('规则波周期需要引用本人冻结的固有周期。');
    }
  }
  if (CRUISE_COURSE_STEPS[sequence - 1].finControl)
    input.cruiseFins = {
      enabled: settings.finsEnabled,
      model: cruiseStudentRollModel(model),
      dampingRatio: sequence === 8 ? 0.5 : settings.dampingRatio,
      stiffnessFraction: settings.stiffnessFraction,
      lowPassCutoffHz: settings.lowPassCutoffHz,
      notch:
        sequence >= 15 && settings.notchEnabled
          ? { centerHz: settings.notchCenterHz, bandwidthHz: settings.notchBandwidthHz }
          : null,
    };
  if (sequence === 19 && settings.faultStrategy === 'slow' && time >= 180) {
    for (const shaft of input.actuators.shafts) shaft.speed_reference_rad_s *= 0.5;
  }
  return input;
}

export function cruiseCourseTraceSamples(trace: VesselTracePoint[]) {
  return trace
    .filter((_, index) => index % 20 === 0 || index === trace.length - 1)
    .map((point) => {
      const measured = (name: string) =>
        point.measurements[name]?.quality === 'Good' ? (point.measurements[name].value ?? NaN) : NaN;
      return {
        time: point.timeS,
        values: {
          heading: measured('Heading'),
          roll: point.cruise?.measurementGood ? (point.cruise.estimatedRollRad * 180) / Math.PI : NaN,
          rollRate: measured('RollRate'),
          portFin: measured('SurfaceEncoder0'),
          starboardFin: measured('SurfaceEncoder1'),
          portPod: measured('AzimuthEncoder0'),
          starboardPod: measured('AzimuthEncoder1'),
          speed: measured('SpeedLog'),
          finMoment: point.cruise?.allocatedMomentNm ?? NaN,
          actualRoll: point.truth.rollDeg,
        },
      };
    });
}

export const cruiseCourseAdapter: VesselCourseAdapter<CruiseCourseSettings> = {
  courseKey: 'cruise',
  experimentKey: 'cruise-comfort',
  steps: CRUISE_COURSE_STEPS,
  defaultSettings: cruiseCourseDefaultSettings,
  restoreSettings(value, seq) {
    const settings = (value ?? cruiseCourseDefaultSettings(seq)) as CruiseCourseSettings;
    const error = validateCruiseCourseSettings(settings);
    if (error) throw new Error(error);
    return settings;
  },
  configuration: cruiseCourseConfiguration,
  input: (seq, settings, initial, frame, models, id) =>
    cruiseCourseInput(
      seq,
      settings,
      initial,
      frame,
      models.find((model) => model.id === id),
    ),
  traceSamples: cruiseCourseTraceSamples,
  validateEvidence: (step, evidence) =>
    validateCruiseCourseEvidence(CRUISE_COURSE_STEPS[step.sequence - 1], evidence),
};
