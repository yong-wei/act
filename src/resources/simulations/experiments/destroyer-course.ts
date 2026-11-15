import type { ExperimentStep } from '../contracts/experiment-step';
import { STEP_SCORE_DISTRIBUTION, validateExperiment } from '../contracts/experiment-step';
import type { VesselSessionConfiguration, VesselSessionInput } from '@/lib/control-engine/vessel-session';
import { VESSEL_COURSES } from './course-catalog';

export const VESSEL_COURSE_VERSION = 'seven-vessel-2026.11.14';

export interface DestroyerCourseEvent {
  timeS: number;
  headingDeg?: number;
  rudderDeg?: number;
}

export interface DestroyerCourseStep extends ExperimentStep {
  sequence: number;
  points: number;
  configuration: VesselSessionConfiguration;
  controlMode: VesselSessionInput['controlMode'];
  allowedModes: VesselSessionInput['controlMode'][];
  events: readonly DestroyerCourseEvent[];
  minimumRuns: number;
}

interface Setting {
  durationS: number;
  mode: VesselSessionInput['controlMode'];
  environment?: VesselSessionConfiguration['environment'];
  noise?: VesselSessionConfiguration['noiseLevel'];
  speedMps?: number;
  seed?: number;
  analysis?: boolean;
  events?: readonly DestroyerCourseEvent[];
  artifacts?: string[];
  minimumRuns?: number;
}

const heading10 = [{ timeS: 20, headingDeg: 10 }];
const settings: readonly Setting[] = [
  { durationS: 60, mode: 'manual', artifacts: ['prediction', 'run', 'signal-annotations', 'interpretation'] },
  { durationS: 120, mode: 'manual', events: [{ timeS: 20, rudderDeg: 5 }, { timeS: 60, rudderDeg: 0 }],
    artifacts: ['prediction', 'run', 'actuator-time-constant', 'measurement-window', 'interpretation'] },
  { durationS: 300, mode: 'manual', events: [{ timeS: 20, rudderDeg: 5 }] },
  { durationS: 300, mode: 'manual', analysis: true, artifacts: ['training-run', 'measurement-window', 'student-model', 'fit-residual', 'interpretation'] },
  { durationS: 300, mode: 'manual', events: [{ timeS: 20, rudderDeg: -3 }],
    artifacts: ['prediction', 'run', 'frozen-model', 'independent-validation', 'interpretation'] },
  { durationS: 300, mode: 'manual', events: [{ timeS: 20, rudderDeg: 20 }],
    artifacts: ['prediction', 'run', 'frozen-model', 'comparison', 'interpretation'] },
  { durationS: 300, mode: 'manual', events: [{ timeS: 20, rudderDeg: 5 }], minimumRuns: 2,
    artifacts: ['prediction', 'two-operating-point-runs', 'student-models', 'parameter-table', 'interpretation'] },
  { durationS: 300, mode: 'manual', analysis: true,
    artifacts: ['frozen-model', 'sketch', 'model-characteristics', 'interpretation'] },
  { durationS: 300, mode: 'p', events: heading10, minimumRuns: 2 },
  { durationS: 300, mode: 'pd', events: heading10,
    artifacts: ['prediction', 'run', 'frozen-model', 'independent-closed-loop', 'interpretation'] },
  { durationS: 400, mode: 'pid', environment: 'W1', events: [{ timeS: 0, headingDeg: 10 }], minimumRuns: 2 },
  { durationS: 500, mode: 'pid', events: [{ timeS: 20, headingDeg: 60 }, { timeS: 250, headingDeg: 0 }], minimumRuns: 2 },
  { durationS: 400, mode: 'pid', environment: 'C1' },
  { durationS: 600, mode: 'pid', environment: 'V1', minimumRuns: 2 },
  { durationS: 400, mode: 'pd', noise: 'N1', events: heading10, minimumRuns: 2 },
  { durationS: 600, mode: 'pid', environment: 'E1', noise: 'N1', events: heading10 },
  { durationS: 600, mode: 'pid', environment: 'E1', noise: 'N1', events: heading10,
    artifacts: ['prediction', 'run', 'frozen-controller', 'fair-comparison', 'interpretation'] },
  { durationS: 600, mode: 'pid', environment: 'E1', noise: 'N1', events: heading10, speedMps: 6, seed: 17,
    artifacts: ['prediction', 'run', 'frozen-controller', 'unseen-validation', 'interpretation'] },
  { durationS: 600, mode: 'pid', environment: 'E1', noise: 'N1', events: heading10, speedMps: 10, seed: 29, minimumRuns: 2,
    artifacts: ['prediction', 'run', 'constraint-check', 'boundary-judgment', 'interpretation'] },
  { durationS: 600, mode: 'manual', analysis: true, minimumRuns: 4,
    artifacts: ['model-assumptions', 'four-own-runs', 'controller-comparison', 'applicability-boundary', 'report'] },
];

export const DESTROYER_COURSE_STEPS: readonly DestroyerCourseStep[] = VESSEL_COURSES.destroyer.steps.map((source, index) => {
  const setting = settings[index];
  const events = setting.events ?? [];
  const analysis = setting.analysis ?? false;
  const configuration: VesselSessionConfiguration = { vessel: 'destroyer-055', parameterVersion: 'research-nominal-v6',
    initialWaterSpeedMps: setting.speedMps ?? 8, initialHeadingDeg: 0, initialPositionNed: [-1800, 0, 0],
    environment: setting.environment ?? 'P0', noiseLevel: setting.noise ?? 'N0', seed: setting.seed ?? 20261106,
    courseEvidence:{rollWarningDeg:8} };
  if (source.sequence === 19) configuration.environmentOverrides = { windSpeedMps: 12, gustSigmaMps: 2 };
  const controls = setting.mode === 'manual' ? [{ key: 'manualRudderDeg', label: '手操舵角', min: -35, max: 35, unit: '°' }]
    : [{ key: 'kp', label: '比例增益相对建议值', min: .2, max: 3, unit: '倍' },
      { key: 'ki', label: '积分增益相对Kp/30', min: 0, max: 1, unit: '倍' },
      { key: 'kd', label: '微分增益相对建议值', min: 0, max: 3, unit: '倍' }];
  return { experimentId: VESSEL_COURSES.destroyer.experimentId, experimentVersion: VESSEL_COURSE_VERSION,
    stepId: `destroyer-step-${source.sequence}`, sequence: source.sequence, title: source.title,
    learningObjective: source.evidence,
    cognitiveLevel: source.sequence === 20 ? 'synthesize' : source.sequence >= 16 ? 'evaluate'
      : source.sequence >= 9 ? 'design' : source.sequence >= 4 ? 'analyze' : 'understand',
    stepKind: analysis ? 'analysis' : 'run',
    trainValidationRole: [5, 18, 19].includes(source.sequence) ? 'validation' : analysis ? 'none' : 'training',
    prerequisites: index === 0 ? [] : [`destroyer-step-${index}`],
    initialCondition: { speedMps: configuration.initialWaterSpeedMps!, seed: configuration.seed!, headingDeg: 0 },
    factorMask: source.sequence === 19 ? ['W2', 'V1', 'C1', 'N1'] : [configuration.environment!, configuration.noiseLevel!],
    studentControls: analysis ? [{ key: 'windowStartS', label: '分析窗口起点', min: 0, max: setting.durationS, unit: 's' }] : controls,
    eventTimeline: analysis ? [] : ['开始独立运行', ...events.map((event) => `${event.timeS}s ${JSON.stringify(event)}`)],
    runDurationS: analysis ? undefined : setting.durationS,
    termination: analysis ? '提交所需分析工件' : `运行至${setting.durationS}秒，或由学生结束并保留记录`,
    measurementSignals: ['Heading', 'YawRate', 'SpeedLog', 'SurfaceEncoder', 'ShaftSpeed', 'North', 'East'],
    observationWindowS: [0, setting.durationS], requiredArtifacts: setting.artifacts ?? ['prediction', 'run', 'interpretation'],
    rubric: { kind: source.sequence >= 9 && source.sequence <= 19 ? 'design' : 'standard',
      performanceCriteria: source.evidence, evidenceCriteria: source.interaction },
    hints: [source.interaction], retryPolicy: 'free', points: STEP_SCORE_DISTRIBUTION[index], configuration,
    controlMode: setting.mode, allowedModes: source.sequence === 11 ? ['pd', 'pid'] : [setting.mode],
    events, minimumRuns: setting.minimumRuns ?? (analysis ? 0 : 1) };
});

const errors = validateExperiment(DESTROYER_COURSE_STEPS);
if (errors.length) throw new Error(`驱逐舰教学步骤无效 ${JSON.stringify(errors)}`);

export function destroyerCourseCommands(step: DestroyerCourseStep, timeS: number) {
  let headingDeg = 0;
  let rudderDeg = 0;
  for (const event of step.events) {
    if (timeS + 1e-10 < event.timeS) break;
    if (event.headingDeg !== undefined) headingDeg = event.headingDeg;
    if (event.rudderDeg !== undefined) rudderDeg = event.rudderDeg;
  }
  return { headingDeg, rudderDeg };
}

export function destroyerCourseVariants(sequence: number): Array<{ value: string; label: string; configuration: Partial<VesselSessionConfiguration> }> {
  if (sequence === 7) return [
    { value: '4', label: '初始航速 4 m/s', configuration: { initialWaterSpeedMps: 4 } },
    { value: '12', label: '初始航速 12 m/s', configuration: { initialWaterSpeedMps: 12 } },
  ];
  if (sequence === 14) return [
    { value: 'V1', label: '有波对照', configuration: { environment: 'V1' } },
    { value: 'P0', label: '平静水面对照', configuration: { environment: 'P0' } },
  ];
  if (sequence === 19) return [
    { value: '10', label: '初始航速 10 m/s', configuration: { initialWaterSpeedMps: 10 } },
    { value: '8', label: '降速验证 8 m/s', configuration: { initialWaterSpeedMps: 8 } },
  ];
  return [];
}
