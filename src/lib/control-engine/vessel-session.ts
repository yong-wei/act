import { assertFiniteTree, ControlEngineFailure, mapFailure } from './envelope';
import { CONTROL_ENGINE_BUILD_HASH } from './identity.generated';
import { createBrowserVesselSessionBinding, ensureBrowserControlEngine, loadVesselWaveAssets, type VesselWaveAssets } from './wasm-browser';
export type { VesselWaveAssets } from './wasm-browser';

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
  containerVoyage?: { segmentSpeedsMps: [number, number, number, number] };
  cruise?: { statisticsStartS:number;statisticsEndS:number;finFailureTimeS:number|null;failedFinIndex:number|null };
  regularWaveHeightM?: number;
  waveFrequencyBins?: 16 | 32 | 128;
  waveTableProfile?: 'teaching-v1';
  courseEvidence?: { rollWarningDeg: number };
  seed?: number;
  noiseLevel?: 'N0' | 'N1' | 'N2';
  environment?: 'P0' | 'W1' | 'W2' | 'C1' | 'C2' | 'V1' | 'V2' | 'V3' | 'E1' | 'E2';
  environmentOverrides?: { windSpeedMps?: number; windFromDeg?: number; gustSigmaMps?: number;
    currentSpeedMps?: number; currentToDeg?: number;
    wave?: { hs_m: number; tp_s: number; direction_to_deg: number; water_depth_m: number } };
  environmentSwitches?: { wind_force_enabled: boolean; wave_enabled: boolean; current_enabled: boolean };
  secondOrderEnabled?: boolean;
  meanWaveResistanceModel?: 'container_reflection_teaching_v1';
  propulsionPowerBudgetW?: number;
  waterDepthM?: number;
  initialWaterSpeedMps?: number;
  initialRollDeg?: number;
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
  engine_running?: boolean;
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
  headingIntegralTracking?: { enabled: boolean; timeS: number };
  longitudinal?: VesselSpeedPiInput;
  berthPlan?: { brakingDistanceM: number; nodes: Array<{ distanceM: number; speedMps: number }>;
    headingNodes?: Array<{timeS: number; headingDeg: number}> };
  containerSpeed?: VesselContainerSpeedInput;
  cruiseFins?: VesselCruiseFinInput;
  semisubDp?: VesselSemisubDpInput;
}

export interface VesselSemisubDpInput {
  targetPositionM: [number, number];
  targetHeadingDeg: number;
  bandwidthRadS: 0.015 | 0.025 | 0.04;
  integralEnabled: boolean;
  integralTimeS: 100 | 200 | 400;
  feedback: 'raw' | 'low_frequency';
  lowFrequencyCutoffHz: 0.02 | 0.04 | 0.08;
  decoupling: boolean;
  studentModel: { a: number[]; b: number[] } | null;
  windFeedforward: boolean;
  allocation: 'pseudoinverse' | 'sequential_convex';
  axisWeights: [number, number, number];
  energyWeight: number;
  reallocate: boolean;
  navigationLossStrategy: 'predict' | 'freeze_integral' | 'safe_exit';
}

export interface VesselDpDiagnostics {
  ticks: number;
  integralEarth: [number, number, number];
  requestedBody: [number, number, number];
  actualEstimatedBody: [number, number, number];
  positionErrorBody: [number, number, number];
  feedbackPositionHeading: [number, number, number];
  feedbackBodyVelocity: [number, number, number];
  targetPositionM: [number, number];
  targetHeadingDeg: number;
  measuredWindFeedforwardBody: [number, number, number];
  navigationGood: boolean;
  missingNavigationS: number;
  integralFrozen: boolean;
  safeExit: boolean;
  kp: [number, number, number];
  kd: [number, number, number];
  ki: [number, number, number];
  estimatedRollRad: number;
  estimatedPitchRad: number;
  allocation: {
    requestedBody: [number, number, number];
    allocatedBody: [number, number, number];
    residualBody: [number, number, number];
    normalizedResidual: number;
    forcesBodyN: Array<[number, number]>;
    predictedPowerW: number;
    iterations: number;
    feasible: boolean;
    turningWithoutThrust: boolean[];
    commands: VesselActuatorCommands;
  } | null;
}

export interface VesselCruiseFinInput {
  enabled:boolean;
  model:{inertiaKgM2:number;dampingNmSRad:number;stiffnessNmRad:number};
  dampingRatio:number;
  stiffnessFraction:number;
  lowPassCutoffHz:number;
  notch:{centerHz:number;bandwidthHz:number}|null;
}

export interface VesselCruiseComfort {
  sampleCadenceS:number;
  statisticsWindowS:[number,number];
  physicsSamples:number;
  durationS:number;
  rollRmsDeg:number|null;
  rollPeakDeg:number;
  rollRateRmsDegS:number|null;
  rollRatePeakDegS:number;
  positivePropulsionWorkJ:number;
  finServoElectricWorkJ:number;
  comfortInterpretation:'teaching_proxy_unweighted';
  passengers:Array<{
    positionBodyM:[number,number,number];
    accelerationBodyMps2:[number,number,number];
    specificForceBodyMps2:[number,number,number];
    accelerationNedMps2:[number,number,number];
    horizontalAccelerationRmsMps2:number|null;
    horizontalAccelerationPeakMps2:number;
    accelerationRmsMps2:number|null;
    accelerationPeakMps2:number;
    jerkRmsMps3:number|null;
  }>;
}

export interface VesselScheduledSpeedModel {
  loadingRatio: number;
  operatingModel: VesselSpeedPiInput['localModel'];
}

export interface VesselContainerSpeedInput {
  models: [VesselScheduledSpeedModel, VesselScheduledSpeedModel, VesselScheduledSpeedModel];
  referenceMps: number;
  fixedModelIndex: number;
  schedulingEnabled: boolean;
  bumpless: boolean;
  kpMultiplier: number;
  tiMultiplier: number;
  antiWindup: boolean;
  filterTauS: 0.2 | 1 | 3;
  feedback: 'water' | 'ground';
  losLookaheadM: number | null;
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
  referenceMps?: number;
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
  fuel?: VesselFuelState;
}

export interface VesselFuelState {
  fuel_kg: number;
  positive_propeller_work_j: number;
  negative_propeller_work_j: number;
  engine_work_j: number;
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
  dpController?: VesselDpDiagnostics;
  propulsorThrustN?: number[];
  liquidObservation?: VesselLiquidObservation;
  headingReferenceDeg?: number;
  cruiseComfort?:VesselCruiseComfort;
  cruiseController?:{
    estimatedRollRad:number;estimatedPitchRad:number;filteredRollRad:number;filteredRollRateRadS:number;
    requestedMomentNm:number;availableMomentNm:number;allocatedMomentNm:number;anglesRad:[number,number];
    measurementGood:boolean;lowSpeedAuthority:boolean;samples:number;
  };
  schema: 'act.vessel-session.v1';
  modelVersion: 'sixdof-session-v1' | 'sixdof-session-v2';
  parameterHash: string;
  timeS: number;
  physicsTicks: number;
  controllerTicks: number;
  paused: boolean;
  truth: VesselTruthState;
  attitudeDeg: { roll: number; pitch: number; heading: number };
  waterVelocityBody: [number, number, number, number, number, number];
  controlSamples: VesselControlSample[];
  fineStepSamples?: VesselFineStepPoint[];
  fineStepWindowSampleCount?: number;
  fineStepMetrics?: {sampleCadenceS:number;algorithm:string;rollWarningDeg:number;
    eventWindowBeforeS:number;eventWindowAfterS:number;values:VesselFineStepMetrics};
  parameters: {
    windAreasM2?: {frontal: number; lateral: number};
    liquidModalFrequenciesHz?:number[];
    liquidDepthM?:number;
    rollInertiaKgM2?:number;
    massKg: number;
    draftM: number;
    lengthM: number;
    beamM: number;
    cgAboveWaterlineM: number;
    geometricGmTransverseM: number | null;
    effectiveGmTransverseM: number | null;
    effectiveInertia: [number, number, number];
    shaftConfigurations: Array<{ ratedRpm: number; maximumPowerW: number; diameterM: number;
      positionBodyM: [number, number, number]; azimuthAvailable: boolean }>;
    surfaceConfigurations: Array<{ normalBody: [number, number, number]; maximumAngleDeg: number;
      maximumRateDegS: number; areaM2: number }>;
  };
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
  waveModel?: {
    firstOrderLoaded: boolean;
    firstOrderEnabled: boolean;
    secondOrderLoaded: boolean;
    secondOrderEnabled: boolean;
    waterDepthM: number;
    meanForwardSpeedMps: number;
    firstOrderMetadataHash: string;
    fullDifferenceMetadataHash: string | null;
  };
  meanWaveResistance?: {
    model: 'container_reflection_teaching_v1'; grade: 'T'; enabled: boolean;
    inReferenceDomain: boolean; resistanceN: number;
    loadBody: [number, number, number, number, number, number];
    definition: Record<string, unknown>;
  };
  longitudinalController?: VesselSpeedControlDiagnostics;
  containerController?: {
    ticks: number;
    requestedReferenceMps: number;
    slewedReferenceMps: number;
    filteredWaterSpeedMps: number | null;
    filteredFeedbackMps: number | null;
    errorMps: number;
    modelWeights: [number, number, number];
    outsideIdentifiedDomain: boolean;
    gains: VesselSpeedControlDiagnostics['gains'];
    operatingReferenceRpm: number;
    integralRpm: number;
    integralRateRpmPerS: number;
    unsaturatedRpm: number;
    commandRpm: number;
    integralFrozen: boolean;
  };
  containerSpeedFeedback?: 'water_speed_log' | 'gnss_low_frequency_estimate' | null;
  containerVoyage?: {
    progress: {
      lastTimeS: number;
      northM: number;
      eastM: number;
      maximumCrossTrackM: number;
      maximumRollDeg: number;
      headingReferenceDeg: number;
      finalSegmentHeadingIntegralDegS: number;
      finalSegmentDurationS: number;
      termination: { reason: 'arrived' | 'time_limit'; timeS: number; finalWaterSpeedMps: number } | null;
    };
    segmentIndex: number;
    meanFinalHeadingErrorDeg: number;
    rollWarning: boolean;
    eligibleForFuelComparison: boolean;
  };
  hydrodynamicDepthM?: number;
  teachingFuel?: {
    state: VesselFuelState;
    rates: {
      signed_shaft_power_w: number;
      load_fraction: number;
      sfoc_g_per_kwh: number;
      engine_power_w: number;
      fuel_kg_per_s: number;
      running: boolean;
    };
    model: {
      rated_shaft_power_w: number;
      auxiliary_power_w: number;
      efficiency: number;
      load_fractions: number[];
      sfoc_g_per_kwh: number[];
    };
    positiveMotorWorkJ: number;
    motorBrakingWorkJ: number;
  };
  propulsionPower?: {
    budgetW: number;
    shaftMechanicalPowerW: number[];
    positiveMechanicalPowerW: number;
    positiveMechanicalWorkJ: number;
  };
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

export interface VesselFineStepPoint {
  timeS:number;
  positionNedM:[number,number,number];
  attitudeDeg:[number,number,number];
  bodyVelocitySi:[number,number,number,number,number,number];
  surfaceDeg:number[];shaftRpm:number[];azimuthDeg:number[];motorPowerW:number[];
}

export interface VesselFineStepMetrics {
  lng?: {
    physicsSamples:number;maximumCornerHeightM:number;cornerHeightSquaredIntegralM2S:number;
    outsideLiquidDomainDurationS:number;liquidDepthM:number;finalHeadingDeg:number;
    finalNorthGroundSpeedMps:number;finalBowClearanceM:number|null;
    final60sLateralMaximumM:number;lateralWindowDurationS:number;
  };
  physicsSamples:number;maximumRollDeg:number;maximumPitchDeg:number;maximumYawRateDegS:number;
  maximumSurfaceAngleDeg:number;maximumSurfaceRateDegS:number;maximumShaftPowerW:number;
  maximumPositiveSystemPowerW:number;rollWarningDurationS:number;surfaceAngleViolationS:number;
  surfaceRateViolationS:number;shaftPowerViolationS:number;systemPowerViolationS:number;
  shaftSpeedViolationS:number;surfaceSaturationDurationS:number;positiveMotorWorkJ:number;
}

export interface VesselLiquidObservation {
  modeHeightsM:number[];
  cornerHeightsM:number[];
  modalFrequenciesHz:number[];
  liquidDepthM:number;
  withinSmallAmplitude:boolean;
}

export interface VesselControlSample {
  dp?: VesselDpDiagnostics;
  estimatedControlLoadBody?: [number, number, number];
  propulsorThrustN?: number[];
  cruise?: VesselSessionFrame['cruiseController'];
  liquid?: VesselLiquidObservation;
  longitudinal?: VesselSpeedControlDiagnostics;
  container?: VesselSessionFrame['containerController'];
  bowClearanceM?: number;
  timeS: number;
  truth: VesselTruthState;
  observer: VesselSessionFrame['observer'];
  attitudeDeg: VesselSessionFrame['attitudeDeg'];
  waterVelocityBody: VesselSessionFrame['waterVelocityBody'];
  targetHeadingDeg: number;
  heldCommands: VesselActuatorCommands;
  samples: VesselObservedSample[];
  dynamics: VesselSessionFrame['dynamics'];
}

export interface VesselSession {
  readonly runtimeVersion?:string;
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
  assets?: VesselWaveAssets,
): Promise<VesselSession> {
  await ensureBrowserControlEngine();
  assets ??= await loadVesselWaveAssets(configuration);
  let native: ReturnType<typeof createBrowserVesselSessionBinding>;
  try {
    native = assets ? createBrowserVesselSessionBinding(JSON.stringify(configuration), assets)
      : createBrowserVesselSessionBinding(JSON.stringify(configuration));
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
    runtimeVersion:CONTROL_ENGINE_BUILD_HASH,
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
