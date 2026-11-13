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
  modelVersion: 'sixdof-session-v1';
  parameterHash: string;
  timeS: number;
  physicsTicks: number;
  controllerTicks: number;
  paused: boolean;
  truth: VesselTruthState;
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
  samples: VesselObservedSample[];
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
