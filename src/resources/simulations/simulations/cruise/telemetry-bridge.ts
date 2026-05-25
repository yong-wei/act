import type {
  ModelRelation,
  SimulationTraceV1,
  TelemetryChannel,
} from '../../core/protocol-types';
import {
  DEFAULT_SIMULATION_RUNTIME_VERSION,
  SIMULATION_PROTOCOL_VERSION,
  normalizeSeed,
} from '../../core/seeded-rng';
import type { ComfortMetrics, ControlMode } from '../../core/types';

export const CRUISE_TRACE_SCENE_ID = 'sim/cruise';
export const CRUISE_TRACE_SCENARIO_ID = 'cruise-comfort-course-turn';
export const CRUISE_SCENE_MODEL_ID = 'fleet-cruise-adora';
export const CRUISE_SCENE_MODEL_VERSION = 'fleet-cruise-adora-scene-v1';
export const CRUISE_ARENA_OBJECT_ID = 'plant-cruise-roll-blackbox';

export const CRUISE_SCENE_TO_ARENA_MODEL_RELATION: ModelRelation = {
  relation: 'simplified',
  teachingSemantics:
    'Cruise 场景用于课程中的高保真舒适度与航向控制观察，Arena cruise-roll 对象用于简化黑箱辨识与控制训练。',
  evaluationBoundary:
    'Cruise 场景 telemetry、预览指标和舒适度摘要不能被声明为 Arena 官方隐藏评测指标。',
};

export interface CruiseTelemetryPerformance {
  overshoot: number;
  settlingTime: number;
  accel: number;
  settled: boolean;
}

export interface CruiseTelemetryConsistencyScore {
  score: number;
}

export interface CruiseTelemetryTargetForm {
  overshoot: number;
  settlingTime: number;
  steadyError: number;
  maxLateralAccel: number;
}

export interface CruiseTelemetryController {
  kp: number;
  ki: number;
  kd: number;
}

export interface CruiseTelemetryStateSnapshot {
  time: number;
  heading: number;
  targetHeading: number;
  yawRate: number;
  rudder: number;
  speed: number;
  rollAngle: number;
  seaState: number;
  waveDirection: number;
  finStabilizerEnabled: boolean;
  notchFilterEnabled: boolean;
  comfort: ComfortMetrics;
  finPower: number;
  controlMode: ControlMode;
  pidGains: CruiseTelemetryController;
  targetForm: CruiseTelemetryTargetForm;
}

export interface CruiseTelemetryBridgeInput {
  runId: string;
  startedAt: string;
  completedAt: string;
  seed?: number | string;
  state: CruiseTelemetryStateSnapshot;
  performance: CruiseTelemetryPerformance;
  consistencyScore: CruiseTelemetryConsistencyScore | null;
  sampleFrameCount: number;
  virtualModeEnabled: boolean;
}

export interface CruiseModelRelationSummary {
  sceneModelId: typeof CRUISE_SCENE_MODEL_ID;
  arenaObjectId: typeof CRUISE_ARENA_OBJECT_ID;
  relation: ModelRelation;
}

export interface CruiseTelemetryBridgeSummary {
  trace: SimulationTraceV1;
  modelRelation: CruiseModelRelationSummary;
  evidenceContext: {
    sourceId: 'simulation/cruise';
    sceneId: typeof CRUISE_TRACE_SCENE_ID;
    arenaObjectId: typeof CRUISE_ARENA_OBJECT_ID;
    boundary: string;
  };
}

const CRUISE_TELEMETRY_CHANNELS: TelemetryChannel[] = [
  'time',
  'position',
  'heading',
  'speed',
  'rudder',
  'yawRate',
  'roll',
  'comfort',
];

function roundMetric(value: number, digits = 3): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Number(value.toFixed(digits));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function normalizeForChecksum(value: unknown): unknown {
  if (typeof value === 'number') return roundMetric(value, 6);
  if (Array.isArray(value)) return value.map((item) => normalizeForChecksum(item));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== 'checksum')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeForChecksum(entry)]),
    );
  }
  return value;
}

function stableTelemetryStringify(value: unknown): string {
  return JSON.stringify(normalizeForChecksum(value));
}

function computeBrowserStableChecksum(value: unknown): string {
  const text = stableTelemetryStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `browser-fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function buildCruiseTraceMetrics(input: CruiseTelemetryBridgeInput): Record<string, number> {
  const { state, performance, consistencyScore, virtualModeEnabled } = input;
  const headingError = state.targetHeading - state.heading;
  const normalizedHeadingError = headingError > 180
    ? headingError - 360
    : headingError < -180
      ? headingError + 360
      : headingError;

  return {
    duration_s: roundMetric(state.time, 1),
    heading_deg: roundMetric(state.heading, 2),
    target_heading_deg: roundMetric(state.targetHeading, 2),
    heading_error_deg: roundMetric(normalizedHeadingError, 2),
    yaw_rate_deg_s: roundMetric(state.yawRate, 3),
    rudder_deg: roundMetric(state.rudder, 3),
    speed_mps: roundMetric(state.speed, 3),
    roll_angle_rad: roundMetric(state.rollAngle, 5),
    sea_state: roundMetric(state.seaState, 0),
    virtual_mode_enabled: virtualModeEnabled ? 1 : 0,
    wave_direction_deg: roundMetric(state.waveDirection, 0),
    fin_stabilizer_enabled: state.finStabilizerEnabled ? 1 : 0,
    notch_filter_enabled: state.notchFilterEnabled ? 1 : 0,
    comfort_msi_percent: roundMetric(state.comfort.msi, 2),
    comfort_roll_rms_deg: roundMetric(state.comfort.rollRms, 3),
    comfort_roll_peak_deg: roundMetric(state.comfort.rollPeak, 3),
    comfort_vdv: roundMetric(state.comfort.vdv, 3),
    comfort_weighted_accel: roundMetric(state.comfort.frequencyWeightedAccel, 4),
    fin_power_kw: roundMetric(state.finPower, 2),
    turn_overshoot_percent: roundMetric(performance.overshoot, 2),
    settling_time_s: roundMetric(performance.settlingTime, 2),
    peak_lateral_accel_g: roundMetric(performance.accel, 4),
    settled: performance.settled ? 1 : 0,
    consistency_score: roundMetric(consistencyScore?.score ?? 0, 2),
    controller_kp: roundMetric(state.pidGains.kp, 3),
    controller_ki: roundMetric(state.pidGains.ki, 3),
    controller_kd: roundMetric(state.pidGains.kd, 3),
  };
}

function hasPassedCruiseTarget(input: CruiseTelemetryBridgeInput): boolean {
  const { performance, state } = input;
  return (
    performance.settled
    && performance.overshoot <= state.targetForm.overshoot
    && performance.settlingTime <= state.targetForm.settlingTime
    && performance.accel <= state.targetForm.maxLateralAccel
  );
}

export function buildCruiseTelemetryBridgeSummary(input: CruiseTelemetryBridgeInput): CruiseTelemetryBridgeSummary {
  const summary = {
    metrics: buildCruiseTraceMetrics(input),
    passed: hasPassedCruiseTarget(input),
    durationSeconds: roundMetric(input.state.time, 1),
  };
  const envelopeWithoutChecksum = {
    runId: input.runId,
    sceneId: CRUISE_TRACE_SCENE_ID,
    scenarioId: CRUISE_TRACE_SCENARIO_ID,
    protocolVersion: SIMULATION_PROTOCOL_VERSION,
    runtimeVersion: DEFAULT_SIMULATION_RUNTIME_VERSION,
    modelVersion: CRUISE_SCENE_MODEL_VERSION,
    seed: normalizeSeed(input.seed, `${CRUISE_TRACE_SCENE_ID}:${input.runId}`),
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    sampleCadence: 0.5,
  };
  const samples = {
    path: '',
    frameCount: Math.max(0, Math.floor(input.sampleFrameCount)),
    channels: CRUISE_TELEMETRY_CHANNELS,
  };

  return {
    trace: {
      envelope: {
        ...envelopeWithoutChecksum,
        checksum: computeBrowserStableChecksum({
          envelope: envelopeWithoutChecksum,
          samples,
          summary,
        }),
      },
      samples,
      summary,
    },
    modelRelation: {
      sceneModelId: CRUISE_SCENE_MODEL_ID,
      arenaObjectId: CRUISE_ARENA_OBJECT_ID,
      relation: CRUISE_SCENE_TO_ARENA_MODEL_RELATION,
    },
    evidenceContext: {
      sourceId: 'simulation/cruise',
      sceneId: CRUISE_TRACE_SCENE_ID,
      arenaObjectId: CRUISE_ARENA_OBJECT_ID,
      boundary: CRUISE_SCENE_TO_ARENA_MODEL_RELATION.evaluationBoundary,
    },
  };
}
