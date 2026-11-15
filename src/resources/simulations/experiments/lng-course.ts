import type { VesselSessionConfiguration, VesselSessionFrame, VesselSessionInput,
  VesselSpeedPiInput } from '@/lib/control-engine/vessel-session';
import { STEP_SCORE_DISTRIBUTION, validateExperiment, type ExperimentStep } from '../contracts/experiment-step';
import { VESSEL_COURSES } from './course-catalog';
import { VESSEL_COURSE_VERSION } from './destroyer-course';
import type { FrozenVesselStudentModel } from './student-analysis';

export interface LngCourseSettings {
  excitationPercent: 3 | 5 | 8;
  reverseFraction: .3 | .6;
  loadingRatio: .30 | .70 | .85 | .95;
  headingRampS: 5 | 20 | 60;
  kpMultiplier: number;
  tiMultiplier: number;
  antiWindup: boolean;
  smithEnabled: boolean;
  additionalCommandDelayS: 0 | 5;
  filterTauS: .2 | 1 | 3;
  brakingDistanceM: number;
  speedNodes: Array<{ distanceM: number; speedMps: number }>;
  headingNodes?: Array<{timeS: number; headingDeg: number}>;
  validationSeed: 17 | 29;
}

export const DEFAULT_LNG_COURSE_SETTINGS: Readonly<LngCourseSettings> = {
  excitationPercent: 5, reverseFraction: .3, loadingRatio: .85, headingRampS: 20,
  kpMultiplier: 1, tiMultiplier: 1, antiWindup: true, smithEnabled: false,
  additionalCommandDelayS: 0, filterTauS: .2, brakingDistanceM: 1200,
  speedNodes: [{ distanceM: 600, speedMps: 2 }, { distanceM: 30, speedMps: 0 }],
  validationSeed: 17,
};

export interface LngCourseStep extends ExperimentStep {
  sequence: number;
  points: number;
  configuration: VesselSessionConfiguration;
  minimumRuns: number;
  speedControl: boolean;
  berthTask: boolean;
}

const durations = [120, 600, 600, 600, 1200, 1200, 1200, 1200, 1200, 600,
  600, 600, 600, 600, 600, 1200, 1200, 1200, 1200, 1200];
const analysisSteps = new Set([3, 7, 20]);
const berthSteps = new Set([7, 8, 9, 16, 17, 18, 19]);
const speedControlSteps = new Set([7, 8, 9, 10, 11, 16, 17, 18, 19]);
const minimumRuns = new Map([[6, 2], [9, 2], [10, 2], [11, 4], [12, 3],
  [14, 3], [15, 2], [16, 2], [17, 2], [19, 3], [20, 5]]);

export function lngCourseDefaultSettings(sequence: number): LngCourseSettings {
  const settings: LngCourseSettings = { ...structuredClone(DEFAULT_LNG_COURSE_SETTINGS) };
  if ([12, 14].includes(sequence)) settings.loadingRatio = .30;
  if ([13, 15, 19].includes(sequence)) settings.loadingRatio = .70;
  return settings;
}

export function validateLngCourseSettings(settings: LngCourseSettings): string | null {
  if (!settings || typeof settings !== 'object' || !Array.isArray(settings.speedNodes)
    || ![settings.antiWindup, settings.smithEnabled].every((value) => typeof value === 'boolean')
    || ![3, 5, 8].includes(settings.excitationPercent) || ![.3, .6].includes(settings.reverseFraction)
    || ![.30, .70, .85, .95].includes(settings.loadingRatio) || ![5, 20, 60].includes(settings.headingRampS)
    || !Number.isFinite(settings.kpMultiplier) || settings.kpMultiplier < .2 || settings.kpMultiplier > 3
    || !Number.isFinite(settings.tiMultiplier) || settings.tiMultiplier < .3 || settings.tiMultiplier > 3
    || ![.2, 1, 3].includes(settings.filterTauS) || ![0, 5].includes(settings.additionalCommandDelayS)
    || ![17, 29].includes(settings.validationSeed)) return '请选择本步允许的激励、装载或控制参数。';
  if (!Number.isFinite(settings.brakingDistanceM) || settings.brakingDistanceM < 300 || settings.brakingDistanceM > 1500
    || settings.speedNodes.length < 1 || settings.speedNodes.length > 4
    || settings.speedNodes.some((node, index) => !node || !Number.isFinite(node.distanceM) || !Number.isFinite(node.speedMps)
      || node.distanceM < 0 || node.distanceM >= settings.brakingDistanceM || node.speedMps < 0 || node.speedMps > 4
      || (index > 0 && node.distanceM >= settings.speedNodes[index - 1].distanceM))) {
    return '减速起点应为300至1500m，1至4个速度节点按剩余距离递减排列，速度为0至4m/s。';
  }
  if (settings.headingNodes !== undefined && (!Array.isArray(settings.headingNodes)
    || settings.headingNodes.length < 1 || settings.headingNodes.length > 4 || settings.headingNodes[0]?.timeS !== 0
    || settings.headingNodes.some((node, index) => !node || !Number.isFinite(node.timeS) || !Number.isFinite(node.headingDeg)
      || node.timeS < 0 || node.timeS > 1200 || Math.abs(node.headingDeg) > 30
      || (index > 0 && node.timeS <= settings.headingNodes![index - 1].timeS)))) {
    return '转向计划应从0秒开始，1至4个节点的时间递增，航向为正负30度。';
  }
  return null;
}

export function lngStudentSpeedModel(model: FrozenVesselStudentModel | undefined): VesselSpeedPiInput['localModel'] {
  if (!model || model.channel !== 'shaft-reference-to-speed' || model.payload.structure.kind !== 'fopdt') {
    throw new Error('请先在评估页签辨识并冻结本人轴速参考—航速的一阶惯性与时延模型。');
  }
  return {structure: model.payload.structure, speedMps: Number(model.payload.operatingPoint.speedMps),
    shaftReferenceRpm: Number(model.payload.operatingPoint.inputOrigin)};
}

export function lngCourseConfiguration(sequence: number,
  settings: LngCourseSettings = lngCourseDefaultSettings(sequence)): VesselSessionConfiguration {
  if (sequence < 1 || sequence > 20 || !Number.isInteger(sequence)) throw new Error('实验步骤不存在。');
  const error = validateLngCourseSettings(settings);
  if (error) throw new Error(error);
  if ([12, 14].includes(sequence) && ![.30, .70, .95].includes(settings.loadingRatio)) {
    throw new Error('本步需要选择.30、.70或.95填充率。');
  }
  const loading = sequence === 19 ? settings.validationSeed === 17 ? .70 : .95
    : [12, 14].includes(sequence) ? settings.loadingRatio : [13, 15].includes(sequence) ? .70 : .85;
  const configuration: VesselSessionConfiguration = {
    vessel: VESSEL_COURSES.lng.vessel, parameterVersion: VESSEL_COURSES.lng.parameterVersion, loadingRatio: loading,
    initialWaterSpeedMps: 4, initialHeadingDeg: 0, initialPositionNed: [0, 0, 0],
    environment: sequence >= 18 && sequence <= 19 ? 'E1' : sequence === 17 ? 'V1' : sequence === 16 ? 'W1' : 'P0',
    noiseLevel: sequence >= 17 && sequence <= 19 ? 'N1' : 'N0',
    seed: sequence === 19 ? settings.validationSeed : 20261106, courseEvidence: { rollWarningDeg: 8 },
  };
  if (berthSteps.has(sequence)) {
    configuration.berth = { stopLineNorthM: 0, initialBowDistanceM: 1500 };
    configuration.waterDepthM = 40;
  }
  if (sequence === 16) configuration.environmentOverrides = { currentSpeedMps: .3, currentToDeg: 90 };
  return configuration;
}

export const LNG_COURSE_STEPS: readonly LngCourseStep[] = VESSEL_COURSES.lng.steps.map((source, index) => {
  const sequence = source.sequence;
  const analysis = analysisSteps.has(sequence);
  const duration = durations[index];
  const configuration = lngCourseConfiguration(sequence);
  const controls: ExperimentStep['studentControls'] = analysis
    ? [{ key: 'windowStartS', label: '分析窗口起点', min: 0, max: duration, unit: 's' }]
    : sequence === 2 ? [{ key: 'excitationPercent', label: '轴速参考阶跃', min: 3, max: 8, unit: '%' }]
      : sequence === 6 ? [{ key: 'reverseFraction', label: '反车额定转速比例', min: .3, max: .6, unit: '倍' }]
        : [12, 14, 19].includes(sequence) ? [{ key: 'loadingRatio', label: '液舱填充率', min: .30, max: .95, unit: '倍' }]
          : [13, 15].includes(sequence) ? [{ key: 'headingRampS', label: '航向斜坡时间', min: 5, max: 60, unit: 's' }]
            : berthSteps.has(sequence) ? [{ key: 'brakingDistanceM', label: '减速起点', min: 300, max: 1500, unit: 'm' }]
              : speedControlSteps.has(sequence) ? [{ key: 'kpMultiplier', label: 'PI比例增益相对建议值', min: .2, max: 3, unit: '倍' }]
                : [{ key: 'windowStartS', label: '观测窗口起点', min: 0, max: duration, unit: 's' }];
  return {
    experimentId: VESSEL_COURSES.lng.experimentId, experimentVersion: VESSEL_COURSE_VERSION,
    stepId: `lng-step-${sequence}`, sequence, title: source.title, learningObjective: source.evidence,
    cognitiveLevel: sequence === 20 ? 'synthesize' : sequence >= 18 ? 'evaluate' : sequence >= 7 ? 'design'
      : sequence >= 3 ? 'analyze' : 'understand',
    stepKind: analysis ? 'analysis' : 'run',
    trainValidationRole: [4, 19].includes(sequence) ? 'validation' : analysis ? 'none' : 'training',
    prerequisites: index ? [`lng-step-${index}`] : [],
    initialCondition: { speedMps: 4, loadingRatio: configuration.loadingRatio!, seed: configuration.seed! },
    factorMask: sequence === 16 ? ['W1', 'C1', 'N0'] : [configuration.environment!, configuration.noiseLevel!],
    studentControls: controls, eventTimeline: analysis ? [] : ['从平衡初态开始独立运行', source.condition],
    runDurationS: analysis ? undefined : duration, observationWindowS: [0, duration],
    termination: analysis ? '提交本人分析工件' : berthSteps.has(sequence)
      ? '完成观察后可结束靠泊，船艏越线或达到1200s时自动停止，保留实际终止原因' : `运行至${duration}s并保留完整记录`,
    measurementSignals: ['ShaftSpeed0', 'ShaftSpeed1', 'SpeedLog', 'Heading', 'YawRate', 'North', 'East', 'RollRate'],
    requiredArtifacts: sequence === 3 ? ['training-run', 'measurement-window', 'student-model', 'fit-residual', 'interpretation']
      : sequence === 7 ? ['frozen-model', 'braking-plan', 'frozen-prediction', 'interpretation']
        : sequence === 20 ? ['five-own-runs', 'frozen-model', 'independent-validation', 'report']
          : ['prediction', 'run', 'interpretation'],
    rubric: { kind: sequence >= 7 && sequence <= 19 ? 'design' : 'standard',
      performanceCriteria: source.evidence, evidenceCriteria: source.interaction },
    hints: [source.interaction], retryPolicy: 'free', points: STEP_SCORE_DISTRIBUTION[index],
    configuration, minimumRuns: minimumRuns.get(sequence) ?? (analysis ? 0 : 1),
    speedControl: speedControlSteps.has(sequence), berthTask: berthSteps.has(sequence),
  };
});

const errors = validateExperiment(LNG_COURSE_STEPS);
if (errors.length) throw new Error(`LNG教学步骤无效 ${JSON.stringify(errors)}`);

/** 事件只改变执行器命令或控制参考，轴速、航速与位置由原生会话推进。 */
export function lngCourseInput(step: LngCourseStep, settings: LngCourseSettings,
  initial: VesselSessionInput, frame: Pick<VesselSessionFrame, 'timeS' | 'parameters'>,
  speedModel?: VesselSpeedPiInput['localModel']): VesselSessionInput {
  const error = validateLngCourseSettings(settings);
  if (error) throw new Error(error);
  const input = structuredClone(initial);
  const time = frame.timeS;
  const sequence = step.sequence;
  input.controlMode = 'pd';
  input.pid = { kp: 1.5, ki: 0, kd: 20 };
  input.targetHeadingDeg = [13, 14, 15].includes(sequence)
    ? 10 * Math.max(0, Math.min(1, (time - 20) / ([13, 15].includes(sequence) ? settings.headingRampS : 20))) : 0;
  input.feedback = 'measurement';
  for (let index = 0; index < input.actuators.shafts.length; index++) {
    const shaft = input.actuators.shafts[index];
    shaft.motor_torque_override_nm = null;
    shaft.drive_cut = false;
    if (time >= 20) {
      if ([2, 12].includes(sequence)) shaft.speed_reference_rad_s *= 1 + (sequence === 2 ? settings.excitationPercent : 5) / 100;
      if (sequence === 4) shaft.speed_reference_rad_s *= .96;
      if (sequence === 5) shaft.motor_torque_override_nm = 0;
      if (sequence === 6) {
        const maximum = frame.parameters.shaftConfigurations[index]?.ratedRpm;
        if (!maximum) throw new Error('本次参数缺少主轴额定转速。');
        shaft.speed_reference_rad_s = -maximum * Math.PI / 30 * settings.reverseFraction;
      }
    }
  }
  delete input.longitudinal;
  delete input.berthPlan;
  if (step.speedControl) {
    if (!speedModel) throw new Error('请先选择本人冻结的轴速参考—航速模型。');
    input.longitudinal = { localModel: structuredClone(speedModel), referenceMps: [10, 11].includes(sequence) && time >= 20 ? 3 : 4,
      kpMultiplier: settings.kpMultiplier, tiMultiplier: settings.tiMultiplier, antiWindup: settings.antiWindup,
      smithEnabled: sequence === 11 && settings.smithEnabled, filterTauS: settings.filterTauS,
      additionalCommandDelayS: sequence === 11 ? settings.additionalCommandDelayS : 0 };
    if (step.berthTask) input.berthPlan = { brakingDistanceM: settings.brakingDistanceM, nodes: structuredClone(settings.speedNodes),
      ...([16, 18, 19].includes(sequence) && settings.headingNodes ? {headingNodes: structuredClone(settings.headingNodes)} : {}) };
  }
  return input;
}
