import { assertFiniteTree, ControlEngineFailure, mapFailure } from './envelope';
import { createBrowserVesselSessionBinding, ensureBrowserControlEngine } from './wasm-browser';

export interface VesselSensorInstallations {
  gnss_body_m: [number, number, number];
  imu_body_m: [number, number, number];
  speed_log_body_m: [number, number, number];
  wind_body_m: [number, number, number];
  cg_waterline_height_m: number;
}

export interface VesselSessionConfiguration {
  vessel?: string;
  parameterVersion?: string;
  loadingRatio?: number;
  berth?: { stopLineNorthM: number; initialBowDistanceM: number };
  seed?: number;
  noiseLevel?: 'N0' | 'N1' | 'N2';
  environment?: 'P0' | 'W1' | 'W2' | 'C1' | 'C2' | 'V1' | 'V2' | 'V3' | 'E1' | 'E2';
  initialHeadingDeg?: number;
  initialPositionNed?: [number, number, number];
  headingBiasFault?: boolean;
  gnssOutageFault?: boolean;
  driveCutFault?: boolean;
  azimuthJamFault?: boolean;
  sensorInstallations?: VesselSensorInstallations;
}

export interface VesselShaftCommand {
  speed_reference_rad_s: number;
  motor_torque_override_nm: number | null;
  azimuth_rad: number;
  drive_cut: boolean;
  azimuth_jammed: boolean;
}

export interface VesselSurfaceCommand {
  angle_rad: number;
  jammed: boolean;
  enabled: boolean;
}

export interface VesselActuatorCommands {
  shafts: VesselShaftCommand[];
  surfaces: VesselSurfaceCommand[];
}

export interface VesselSessionInput {
  controlMode: 'manual' | 'p' | 'pd' | 'pid';
  pid: { kp: number; ki: number; kd: number };
  targetHeadingDeg: number;
  feedback: 'measurement' | 'estimate';
  actuators: VesselActuatorCommands;
  derivativeFilterTauS?: number;
  longitudinal?: VesselSpeedPiInput;
}

export interface VesselSpeedPiInput {
  localModel: {
    structure: { kind: 'fopdt'; k: number; t_s: number; delay_s: number };
    speedMps: number;
    shaftReferenceRpm: number;
  };
  referenceMps: number;
  kpMultiplier: number;
  tiMultiplier: number;
  antiWindup: boolean;
  smithEnabled: boolean;
  filterTauS: number;
  additionalCommandDelayS: 0 | 5;
}

export interface VesselSpeedControlDiagnostics {
  ticks: number;
  gains: { kpRpmPerMps: number; tiS: number; lambdaS: number; trackingTimeS: number };
  filteredMeasurementMps: number | null;
  feedbackMps: number | null;
  modelWithoutDelayDeltaMps: number;
  modelWithDelayDeltaMps: number;
  errorMps: number;
  integralRpm: number;
  integralRateRpmPerS: number;
  unsaturatedRpm: number;
  requestedRpm: number;
  appliedRpm: number;
  feedbackAvailable: boolean;
  integralFrozen: boolean;
}

export interface VesselActuatorState {
  propeller_shaft_speed_rad_s: number[];
  control_surface_angles_rad: number[];
  azimuth_angles_rad: number[];
  motor_torques_nm: number[];
  motor_torque_demand_nm: number[];
  shaft_reference_speed_rad_s: number[];
  positive_motor_work_j: number[];
  motor_work_j: number[];
  propeller_work_j: number[];
  shaft_friction_work_j: number[];
  control_surface_work_j: number[];
}

export interface VesselTruthState {
  position_ned: [number, number, number];
  quaternion: [number, number, number, number];
  body_velocity: [number, number, number, number, number, number];
  radiation_states: number[];
  actuator_states: VesselActuatorState;
  specialist_states: number[];
}

export type VesselSensorSignal =
  | 'Heading' | 'YawRate' | 'North' | 'East' | 'SpeedLog' | 'RollRate' | 'PitchRate'
  | 'SpecificForceX' | 'SpecificForceY' | 'SpecificForceZ' | 'WindSpeed' | 'WindDirection'
  | { SurfaceEncoder: number } | { AzimuthEncoder: number } | { ShaftSpeed: number };

export interface VesselObservedSample {
  signal: VesselSensorSignal;
  measurement: {
    t_sample_s: number;
    t_arrive_s: number;
    value: number | null;
    quality: 'Good' | 'Missing' | 'Undefined';
  };
}

export interface VesselSessionFrame {
  schema: 'act.vessel-session.v1';
  modelVersion: 'sixdof-session-v1' | 'sixdof-session-v2';
  parameterHash: string;
  timeS: number;
  physicsTicks: number;
  controllerTicks: number;
  paused: boolean;
  truth: VesselTruthState;
  dynamics?: {
    nu_dot: [number, number, number, number, number, number];
    position_dot_ned: [number, number, number];
    quaternion_dot: [number, number, number, number];
    euler_rates: [number, number, number];
    external_components?: Record<'tau_hull_viscous' | 'tau_actuator' | 'tau_wind' | 'tau_wave_1' | 'tau_wave_2' | 'tau_special',
      [number, number, number, number, number, number]>;
    breakdown: Record<'coriolis_rb' | 'coriolis_added_mass' | 'radiation' | 'restoring' | 'current_inertia' | 'external',
      [number, number, number, number, number, number]>;
  } | null;
  observer: {
    position_heading: [number, number, number];
    body_velocity: [number, number, number];
    wave_integral: [number, number, number];
    wave_motion: [number, number, number];
    bias_earth: [number, number, number];
    parameters: { mass_diagonal: number[]; damping_diagonal: number[]; wave_frequency_rad_s: number };
  };
  input: VesselSessionInput;
  heldCommands: VesselActuatorCommands;
  longitudinalController?: VesselSpeedControlDiagnostics;
  berth?: {
    bowClearanceM: number;
    northGroundSpeedMps: number;
    termination: {
      reason: 'stop_line_crossed' | 'time_limit';
      timeS: number;
      bowClearanceM: number;
    } | null;
  };
  samples: VesselObservedSample[];
  liquidCargo: {
    within_small_amplitude: boolean;
    wall_heights_m: number[];
    wall_height_rates_mps: number[];
    coupled_additional_energy_j: number;
    mass_partition: {
      liquid_mass_kg: number;
      fixed_mass_kg: number;
      fixed_center_body_m: [number, number, number];
      fixed_inertia_about_own_cg_kg_m2: number[][];
    };
  } | null;
  headingController: {
    integralOutputDeg: number;
    derivativeDegS: number;
    previousMeasurementDeg: number | null;
    previousMeasurementTimeS: number | null;
    errorDeg: number;
    unsaturatedDeg: number;
    commandDeg: number;
    integralRateDegS: number;
    integralFrozen: boolean;
    feedbackAvailable: boolean;
  } | null;
}

export interface VesselSession {
  read(): VesselSessionFrame;
  advance(seconds: number, input?: VesselSessionInput): VesselSessionFrame;
  setPaused(paused: boolean): void;
  snapshot(): string;
  restore(snapshot: string): void;
  reset(): void;
  dispose(): void;
}

function parseFrame(raw: string): VesselSessionFrame {
  const result = JSON.parse(raw) as VesselSessionFrame;
  assertFiniteTree(result, 'computeVirtualSimulationStep');
  if (result.schema !== 'act.vessel-session.v1') {
    throw new ControlEngineFailure({
      state: 'error', category: 'session-schema', message: '仿真状态版本不匹配。', retryable: false,
    });
  }
  return result;
}

export async function createVesselSimulationSessionBrowser(
  configuration: VesselSessionConfiguration = {},
): Promise<VesselSession> {
  await ensureBrowserControlEngine();
  let native: ReturnType<typeof createBrowserVesselSessionBinding>;
  try {
    native = createBrowserVesselSessionBinding(JSON.stringify(configuration));
  } catch (error) {
    throw mapFailure(typeof error === 'string' ? new Error(error) : error);
  }
  let disposed = false;
  function invoke<T>(work: () => T): T {
    if (disposed) {
      throw new ControlEngineFailure({
        state: 'error', category: 'session-disposed', message: '这次仿真已经结束。', retryable: false,
      });
    }
    try {
      return work();
    } catch (error) {
      throw mapFailure(typeof error === 'string' ? new Error(error) : error);
    }
  }
  return {
    read: () => invoke(() => parseFrame(native.read())),
    advance: (seconds, input) => invoke(() => parseFrame(native.advance(seconds, input ? JSON.stringify(input) : ''))),
    setPaused: (paused) => invoke(() => native.setPaused(paused)),
    snapshot: () => invoke(() => native.snapshot()),
    restore: (snapshot) => invoke(() => native.restore(snapshot)),
    reset: () => invoke(() => native.reset()),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      native.free();
    },
  };
}
