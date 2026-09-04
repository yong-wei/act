/**
 * Unified simulation physics facade.
 *
 * Second-batch pages import model-family capabilities through this file so
 * future Rust/WASM replacement can be staged behind one boundary.
 */

import {
  computeVirtualSimulationStepBrowserSync,
  isBrowserControlEngineReady,
  preloadBrowserControlEngine,
} from '@/lib/control-engine/client';
import type {
  DestroyerHifiStepRequest,
  DestroyerHifiStepResult,
} from '../rust/destroyer-hifi-adapter';
import {
  createAzipod3DOFState,
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
  azipodToSimulationState,
  createContainerShipState,
  createMMG3DOFState,
  createNomoto2ndOrderDelayState,
  createNomotoState,
  createPIDStateForLNG,
  createRollCoupledState,
  createSemiSub3DOFState,
  computeWaveExcitation,
  DEFAULT_AZIPOD_3DOF_PARAMS,
  DEFAULT_MMG_PARAMS,
  DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
  DEFAULT_ROLL_COUPLED_PARAMS,
  getContainerShipSummary,
  getDecouplingMatrix,
  mmgToSimulationState,
  nomotoToSimulationState,
  semiSubToSimulationState,
  setAzipodCommands,
  shouldTriggerRollAlarm,
  updateLoadRatio,
  type ContainerShipState,
  type MMG3DOFState,
  type Nomoto2ndOrderDelayState,
  type NomotoState,
  type RollCoupledState,
  type SemiSubmersible3DOFState,
} from './model-state-helpers';
import { DEFAULT_NOMOTO_PARAMS } from '../core/constants';
import type {
  ControlMode,
  DisturbanceVector,
  FinStabilizerState,
  IceBreakingParams,
  IceBreakingState,
  MMG3DOFParams,
  NomotoParams,
  Nomoto2ndOrderParams,
  NotchFilterState,
  PIDGains,
  RollCoupledNomotoParams,
  RollState,
  SloshingParams,
  SloshingState,
  ThrusterConfig,
  ThrusterState,
  ThrustAllocationResult,
  ComfortMetrics,
  WindLoadState,
} from '../core/types';

export type { SloshingState, WindLoadState };
import type { RandomNumberGenerator } from '../core/seeded-rng';
import {
  DEFAULT_DP_GAINS,
  DP_LIMITS,
  type DPControlOutput as DredgerDPControlOutput,
  type DPCurrentState,
  type DPErrorMetrics,
  type DPState as DredgerDPState,
  type DPTarget,
} from './controllers/dp-controller';
import type {
  DPControllerConfig,
  DPControlOutput as DrillingDPControlOutput,
  DPState as DPDecouplingState,
} from './controllers/dp-decoupling-controller';
import type { CurrentEnvironment, EnvironmentalForces, WindEnvironment } from './disturbances/current-model';
import type { AzipodCourseKeeperConfig, AzipodCourseKeeperState } from './controllers/azipod-course-keeper';
import type { SmithPredictorConfig, SmithPredictorFullState } from './controllers/smith-predictor';
import type { PIDControllerState } from './controllers/pid-controller';
import type { WindEnvironment as ContainerWindEnvironment, WindLoadParams } from './disturbances/wind-load';
import { DEFAULT_WIND_PARAMS } from './disturbances/wind-load';
import {
  createDredgingImpactState,
  DEFAULT_DREDGING_CONFIG,
  type DredgingImpactConfig,
  type DredgingImpactState,
} from './disturbances/dredging-impact';

export {
  createDredgingImpactState,
  DEFAULT_DREDGING_CONFIG,
  type DredgingImpactConfig,
  type DredgingImpactState,
};

export const preloadVirtualSimulationRuntime = () => preloadBrowserControlEngine();
export const isVirtualSimulationRuntimeReady = () => isBrowserControlEngineReady();

export function computeVirtualSimulationStep<TResult>(request: unknown): TResult {
  return computeVirtualSimulationStepBrowserSync<TResult>(request);
}

export function computeDestroyerHifiStep(request: DestroyerHifiStepRequest): DestroyerHifiStepResult {
  return computeVirtualSimulationStep<DestroyerHifiStepResult>(request);
}

export {
  createNomotoState,
  nomotoToSimulationState,
  DEFAULT_NOMOTO_PARAMS,
  type NomotoState,
};

export function nomotoStepRK4(
  state: NomotoState,
  rudderDeg: number,
  dt: number,
  params: NomotoParams = DEFAULT_NOMOTO_PARAMS,
): NomotoState {
  return computeVirtualSimulationStep<NomotoState>({
    modelId: 'nomoto1st',
    state,
    rudderDeg,
    dt,
    params,
  });
}

export {
  createNomoto2ndOrderDelayState,
  createPIDStateForLNG,
  DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
  type Nomoto2ndOrderDelayState,
};

export function pidControl2ndOrder(
  targetHeadingDeg: number,
  currentHeadingDeg: number,
  currentYawRateDeg: number,
  pidState: { integral: number; prevError: number },
  gains: PIDGains,
  mode: 'manual' | 'p' | 'pd' | 'pid',
  dt: number,
  maxRudderDeg = 35,
  integralLimit = 30,
): { rudderDeg: number; newState: { integral: number; prevError: number } } {
  return computeVirtualSimulationStep({
    modelId: 'practice_pid_2nd_order',
    dt,
    targetHeading: targetHeadingDeg,
    currentHeading: currentHeadingDeg,
    currentYawRate: currentYawRateDeg,
    state: pidState,
    gains,
    controlMode: mode,
    maxRudderDeg,
    integralLimit,
  });
}

export function nomoto2ndOrderDelayStep(
  state: Nomoto2ndOrderDelayState,
  rudderDeg: number,
  dt: number,
  params: Nomoto2ndOrderParams,
): Nomoto2ndOrderDelayState {
  return computeVirtualSimulationStep<Nomoto2ndOrderDelayState>({
    modelId: 'nomoto2nd_delay',
    state,
    rudderDeg,
    dt,
    params,
  });
}

export {
  createContainerShipState,
  updateLoadRatio,
  getContainerShipSummary,
  shouldTriggerRollAlarm,
  type ContainerShipState,
};

export function nomotoVariableMassStep(
  state: ContainerShipState,
  rudderDeg: number,
  dt: number,
  externalMoment = 0,
): ContainerShipState {
  return computeVirtualSimulationStep<ContainerShipState>({
    modelId: 'nomoto_variable_mass',
    state,
    rudderDeg,
    dt,
    externalMoment,
  });
}

export function rollStep(
  state: RollState,
  windMoment: number,
  yawRateRad: number,
  loadRatio: number,
  dt: number,
): RollState {
  return computeVirtualSimulationStep<RollState>({
    modelId: 'container_roll',
    state,
    windMoment,
    yawRateRad,
    loadRatio,
    dt,
  });
}

export {
  createRollCoupledState,
  computeWaveExcitation,
  DEFAULT_ROLL_COUPLED_PARAMS,
  type RollCoupledState,
};

export function rollCoupledNomotoStep(
  state: RollCoupledState,
  rudderDeg: number,
  finMomentNormalized: number,
  waveExcitation: number,
  dt: number,
  params: RollCoupledNomotoParams = DEFAULT_ROLL_COUPLED_PARAMS,
  turningExcitation = 0,
): RollCoupledState {
  return computeVirtualSimulationStep<RollCoupledState>({
    modelId: 'roll_coupled_nomoto',
    state,
    rudderDeg,
    finMomentNormalized,
    waveExcitation,
    dt,
    params,
    turningExcitation,
  });
}

export interface PracticeCruiseLiveStepRequest {
  dt: number;
  time: number;
  targetHeading: number;
  controlMode: string;
  manualRudder: number;
  manualSpeed: number;
  maxRudderDeg: number;
  kp: number;
  ki: number;
  kd: number;
  seaState: number;
  waveDirection: number;
  prevRudder: number;
  finStabilizerEnabled: boolean;
  notchFilterEnabled: boolean;
  state: RollCoupledState;
  pidState: { integral: number; prevError: number };
  finState: FinStabilizerState;
  notchState: NotchFilterState;
  rollCoupledParams: RollCoupledNomotoParams;
}

export interface PracticeCruiseLiveStepResult {
  state: RollCoupledState;
  pidState: { integral: number; prevError: number };
  finState: FinStabilizerState;
  notchState: NotchFilterState;
  rudderDeg: number;
  rudderRate: number;
  currentHeading: number;
  currentYawRate: number;
}

export function computePracticeCruiseLiveStep(
  request: PracticeCruiseLiveStepRequest,
): PracticeCruiseLiveStepResult {
  return computeVirtualSimulationStep<PracticeCruiseLiveStepResult>({
    modelId: 'practice_cruise_live_step',
    ...request,
  });
}

const takeRngSamples = (rng: RandomNumberGenerator, count: number): number[] =>
  Array.from({ length: count }, () => rng());

export function computePracticePidControl(request: {
  dt: number;
  targetHeading: number;
  currentHeading: number;
  controlMode: ControlMode;
  gains: PIDGains;
  maxRudderDeg: number;
  state: PIDControllerState;
  maxIntegral?: number;
  derivativeFilter?: number;
  rateLimit?: number;
}): { output: { rudderDeg: number; error: number; derivative: number }; newState: PIDControllerState } {
  return computeVirtualSimulationStep({
    modelId: 'practice_pid_control',
    ...request,
  });
}

export function computePracticeCruiseComfortRealtime(
  prevMetrics: ComfortMetrics,
  currentRollDeg: number,
  rollPeriodSec: number,
  shipBeam: number,
  alpha: number,
  dt: number,
  lateralAccelG: number,
  yawRateDegPerSec: number,
): ComfortMetrics {
  return computeVirtualSimulationStep<ComfortMetrics>({
    modelId: 'practice_cruise_comfort_realtime',
    dt,
    prevMetrics,
    currentRollDeg,
    rollPeriodSec,
    shipBeam,
    alpha,
    lateralAccelG,
    yawRateDegPerSec,
  });
}

export function smithPredictorControl(
  targetHeadingDeg: number,
  actualHeadingDeg: number,
  state: SmithPredictorFullState,
  gains: PIDGains,
  config: SmithPredictorConfig,
  maxRudderDeg = 35,
  integralLimit = 30,
): { rudderDeg: number; newState: SmithPredictorFullState } {
  return computeVirtualSimulationStep({
    modelId: 'practice_smith_predictor',
    targetHeading: targetHeadingDeg,
    actualHeading: actualHeadingDeg,
    state,
    gains,
    config,
    maxRudderDeg,
    integralLimit,
  });
}

export function sloshingStep(
  state: SloshingState,
  shipYawRateRad: number,
  dt: number,
  params: SloshingParams,
): SloshingState {
  const result = computeVirtualSimulationStep<{ state: SloshingState; moment: number }>({
    modelId: 'practice_sloshing_step',
    state,
    shipYawRateRad,
    dt,
    params,
  });
  return result.state;
}

export function computeSloshingMoment(state: SloshingState, params: SloshingParams): number {
  return -params.coupling * state.angle * 0.001;
}

export function computePracticeGainScheduleStep(request: {
  dt: number;
  targetHeading: number;
  currentHeading: number;
  controlMode: ControlMode;
  schedulingVariable: number;
  schedulingEnabled: boolean;
  currentGains: PIDGains;
  targetGains: PIDGains;
  schedule: { empty: PIDGains; full: PIDGains };
  smoothingFactor: number;
  pidState: PIDControllerState;
  maxRudderDeg: number;
  derivativeFilter?: number;
  rateLimit?: number;
}): {
  output: { rudderDeg: number; error: number; derivative: number };
  pidState: PIDControllerState;
  currentGains: PIDGains;
  targetGains: PIDGains;
  schedulingVariable: number;
  gainsConverged: boolean;
  isSchedulingActive: boolean;
} {
  return computeVirtualSimulationStep({
    modelId: 'practice_gain_schedule_step',
    ...request,
  });
}

export function windLoadStep(
  shipHeading: number,
  loadRatio: number,
  env: ContainerWindEnvironment,
  time: number,
  params?: WindLoadParams,
): WindLoadState {
  return computeVirtualSimulationStep<WindLoadState>({
    modelId: 'practice_wind_load_step',
    shipHeading,
    loadRatio,
    environment: env,
    time,
    params: params ?? DEFAULT_WIND_PARAMS,
  });
}

function mixedDredgingForce(elapsed: number, config: DredgingImpactConfig): number {
  if (elapsed < 0) {
    return 0;
  }
  const stepForce =
    config.maxForce *
    config.stepRatio *
    (1 - Math.exp(-elapsed / 0.5)) *
    Math.exp(-elapsed / config.decayTimeConstant);
  const normalized = (elapsed - 0.1) / 0.3;
  const impulseForce = config.maxForce * config.impulseRatio * Math.exp(-0.5 * normalized * normalized);
  return stepForce + impulseForce;
}

export function computePracticeDredgingDisturbance(
  time: number,
  state: DredgingImpactState,
  config: DredgingImpactConfig = DEFAULT_DREDGING_CONFIG,
  rng: RandomNumberGenerator = Math.random,
): { disturbance: DisturbanceVector; newState: DredgingImpactState } {
  const rngSamples: number[] = [];
  const take = () => {
    const value = rng();
    rngSamples.push(value);
    return value;
  };
  if (!state.isImpactActive && time - state.lastImpactTime >= state.nextInterval) {
    take();
    take();
    take();
  } else if (state.isImpactActive) {
    const force = mixedDredgingForce(time - state.impactStartTime, config);
    if (force < config.maxForce * 0.01) {
      take();
    }
  }
  return computeVirtualSimulationStep({
    modelId: 'practice_dredging_disturbance',
    time,
    state,
    config,
    rngSamples,
  });
}

export {
  createDPState,
  HIGH_PRECISION_DP_GAINS,
} from './controllers/dp-controller';
export type {
  DredgerDPState as DPState,
  DPTarget,
  DPCurrentState,
  DPErrorMetrics,
};

export function dpControl(
  current: DPCurrentState,
  target: DPTarget,
  dpState: DredgerDPState,
  gains = DEFAULT_DP_GAINS,
  dt: number,
  limits = DP_LIMITS,
): { output: DredgerDPControlOutput; newState: DredgerDPState; metrics: DPErrorMetrics } {
  return computeVirtualSimulationStep({
    modelId: 'practice_dp_control',
    current,
    target,
    dpState,
    gains,
    dt,
    limits,
    feedforward: false,
  });
}

export function dpControlWithFeedforward(
  current: DPCurrentState,
  target: DPTarget,
  dpState: DredgerDPState,
  disturbance: DisturbanceVector,
  gains = DEFAULT_DP_GAINS,
  dt: number,
  limits = DP_LIMITS,
): { output: DredgerDPControlOutput; newState: DredgerDPState; metrics: DPErrorMetrics } {
  return computeVirtualSimulationStep({
    modelId: 'practice_dp_control',
    current,
    target,
    dpState,
    gains,
    dt,
    limits,
    disturbance,
    feedforward: true,
  });
}

export class DredgingImpactModel {
  private state: DredgingImpactState;
  private config: DredgingImpactConfig;
  private enabled = true;
  private createRng: () => RandomNumberGenerator;
  private rng: RandomNumberGenerator;

  constructor(
    config: Partial<DredgingImpactConfig> = {},
    createRng: () => RandomNumberGenerator = () => Math.random,
  ) {
    this.config = { ...DEFAULT_DREDGING_CONFIG, ...config };
    this.createRng = createRng;
    this.rng = this.createRng();
    this.state = createDredgingImpactState(this.rng);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.state.isImpactActive = false;
      this.state.currentForce = 0;
    }
  }

  reset(): void {
    this.rng = this.createRng();
    this.state = createDredgingImpactState(this.rng);
  }

  compute(time: number): DisturbanceVector {
    if (!this.enabled) {
      return { forceX: 0, forceY: 0, momentN: 0 };
    }
    const result = computePracticeDredgingDisturbance(time, this.state, this.config, this.rng);
    this.state = result.newState;
    return result.disturbance;
  }

  getState(): DredgingImpactState {
    return { ...this.state };
  }
}

export {
  createMMG3DOFState,
  mmgToSimulationState,
  DEFAULT_MMG_PARAMS,
  type MMG3DOFState,
};

/** mmg3dof 可选直接执行器输入（#1944 方案 A）：kN/kN·m 契约，与 rpm 推进路径互斥。 */
export interface MmgThrusterCommand {
  surgeKN: number;
  swayKN: number;
  yawMomentKNm: number;
}

export function mmg3dofStep(
  state: MMG3DOFState,
  rudderCommand: number,
  propellerRPM: number,
  dt: number,
  params: MMG3DOFParams = DEFAULT_MMG_PARAMS,
  shipLength = 127.5,
  shipDraft = 6.2,
  disturbance: DisturbanceVector = { forceX: 0, forceY: 0, momentN: 0 },
  thruster?: MmgThrusterCommand,
): MMG3DOFState {
  return computeVirtualSimulationStep<MMG3DOFState>({
    modelId: 'mmg3dof',
    state,
    rudderCommand,
    propellerRPM,
    dt,
    params,
    shipLength,
    shipDraft,
    disturbance,
    ...(thruster
      ? {
          surgeThrustKN: thruster.surgeKN,
          swayThrustKN: thruster.swayKN,
          yawMomentKNm: thruster.yawMomentKNm,
        }
      : {}),
  });
}

export {
  createSemiSub3DOFState,
  semiSubToSimulationState,
  getDecouplingMatrix,
  type SemiSubmersible3DOFState,
};

export function semiSub3DOFStep(
  state: SemiSubmersible3DOFState,
  thrusterForce: [number, number, number],
  envForce: [number, number, number],
  dt: number,
): SemiSubmersible3DOFState {
  return computeVirtualSimulationStep<SemiSubmersible3DOFState>({
    modelId: 'semisub3dof',
    state,
    thrusterForce,
    envForce,
    dt,
  });
}

export {
  createCurrentEnvironment,
  createWindEnvironment,
  getTypicalEnvironment,
  type CurrentEnvironment,
  type WindEnvironment,
} from './disturbances/current-model';

export function updateCurrentEnvironment(
  env: CurrentEnvironment,
  dt: number,
  rng: RandomNumberGenerator = Math.random,
): CurrentEnvironment {
  return computeVirtualSimulationStep<{ current: CurrentEnvironment }>({
    modelId: 'practice_drilling_environment',
    dt,
    evolve: true,
    current: env,
    wind: { speed: 0, direction: 0, gustFactor: 1.2 },
    meanWindSpeed: 0,
    waveHeight: 0,
    waveDirection: 0,
    psi: 0,
    rngSamples: takeRngSamples(rng, 2).concat([1, 0, 0]),
  }).current;
}

export function updateWindEnvironment(
  env: WindEnvironment,
  dt: number,
  meanSpeed: number,
  rng: RandomNumberGenerator = Math.random,
): WindEnvironment {
  const rngSamples = [0.5, 0.5, rng()];
  if (rngSamples[2] < dt / 10) {
    rngSamples.push(rng(), rng());
  }
  return computeVirtualSimulationStep<{ wind: WindEnvironment }>({
    modelId: 'practice_drilling_environment',
    dt,
    evolve: true,
    current: {
      speed: 0,
      direction: 0,
      meanSpeed: 0,
      meanDirection: 0,
      variability: 0,
    },
    wind: env,
    meanWindSpeed: meanSpeed,
    waveHeight: 0,
    waveDirection: 0,
    psi: 0,
    rngSamples,
  }).wind;
}

export function computeTotalEnvironmentalForces(
  current: CurrentEnvironment,
  wind: WindEnvironment,
  waveHeight: number,
  waveDirection: number,
  psi: number,
): EnvironmentalForces {
  return computeVirtualSimulationStep<{ forces: EnvironmentalForces }>({
    modelId: 'practice_drilling_environment',
    dt: 1 / 60,
    evolve: false,
    current,
    wind,
    waveHeight,
    waveDirection,
    psi,
  }).forces;
}

export {
  createThrusterConfigs,
  computeTotalPower,
  simulateThrusterFailure,
  getThrusterSummary,
} from './controllers/thruster-allocation';

export function allocateThrust(
  tauCmd: [number, number, number],
  currentStates: ThrusterState[],
  configs: ThrusterConfig[],
  dt: number,
): ThrustAllocationResult {
  return computeVirtualSimulationStep<ThrustAllocationResult>({
    modelId: 'practice_allocate_thrust',
    tauCmd,
    thrusters: currentStates,
    configs,
    dt,
  });
}

export {
  createDPControllerConfig,
  createDPState as createDPDecouplingState,
  type DPControllerConfig,
  type DPState as DPDecouplingState,
} from './controllers/dp-decoupling-controller';

export function dpDecoupledControl(
  platformState: SemiSubmersible3DOFState,
  controllerState: DPDecouplingState,
  config: DPControllerConfig,
  dt: number,
): [DrillingDPControlOutput, DPDecouplingState] {
  const result = computeVirtualSimulationStep<{
    output: DrillingDPControlOutput;
    newState: DPDecouplingState;
  }>({
    modelId: 'practice_dp_decoupled_control',
    platform: platformState,
    controllerState,
    config,
    dt,
    decouplingEnabled: true,
  });
  return [result.output, result.newState];
}

export function dpStandardControl(
  platformState: SemiSubmersible3DOFState,
  controllerState: DPDecouplingState,
  config: DPControllerConfig,
  dt: number,
): [DrillingDPControlOutput, DPDecouplingState] {
  const result = computeVirtualSimulationStep<{
    output: DrillingDPControlOutput;
    newState: DPDecouplingState;
  }>({
    modelId: 'practice_dp_decoupled_control',
    platform: platformState,
    controllerState,
    config: { ...config, decouplingEnabled: false },
    dt,
    decouplingEnabled: false,
  });
  return [result.output, result.newState];
}

export {
  createAzipod3DOFState,
  azipodToSimulationState,
  setAzipodCommands,
  DEFAULT_AZIPOD_3DOF_PARAMS,
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
};

export function azipod3dofStepRK4(
  state: Azipod3DOFInternalState,
  params: Azipod3DOFParams,
  iceResistance: number,
  dt: number,
): Azipod3DOFInternalState {
  return computeVirtualSimulationStep<Azipod3DOFInternalState>({
    modelId: 'azipod3dof',
    state,
    params,
    iceResistance,
    dt,
  });
}

export {
  createIceBreakingState,
  getIceBreakingSummary,
  getIceZoneSafetyLevel,
  shouldTriggerIceAlarm,
  computePropellerStress,
  DEFAULT_ICE_BREAKING_PARAMS,
  type IceBreakingState,
} from './disturbances/ice-breaking-model';

export function iceBreakingStep(
  state: IceBreakingState,
  params: IceBreakingParams,
  speed: number,
  dt: number,
  rng: RandomNumberGenerator = Math.random,
): IceBreakingState {
  const rngSamples: number[] = [];
  if (params.enabled && params.iceThickness > 0 && Math.abs(speed) > 0.1) {
    if (state.phaseTime + dt >= state.nextPhaseTime) {
      rngSamples.push(rng());
    }
    rngSamples.push(rng(), rng());
  }
  return computeVirtualSimulationStep<IceBreakingState>({
    modelId: 'practice_ice_breaking_step',
    state,
    params,
    speed,
    dt,
    rngSamples,
  });
}

export {
  createAzipodCourseKeeperState,
  getAzipodControllerDiagnostics,
  DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
  type AzipodCourseKeeperState,
} from './controllers/azipod-course-keeper';

export function azipodCourseKeeperControl(
  state: AzipodCourseKeeperState,
  currentHeading: number,
  targetHeading: number,
  yawRate: number,
  speedMps: number,
  mode: ControlMode,
  config: AzipodCourseKeeperConfig,
  perturbedK = 1.0,
  dt: number,
  time: number,
): AzipodCourseKeeperState {
  return computeVirtualSimulationStep<AzipodCourseKeeperState>({
    modelId: 'practice_azipod_course_keeper',
    state,
    currentHeading,
    targetHeading,
    yawRate,
    speedMps,
    controlMode: mode,
    config,
    perturbedK,
    dt,
    time,
    iceMode: false,
  });
}

export function azipodCourseKeeperControlIceMode(
  state: AzipodCourseKeeperState,
  currentHeading: number,
  targetHeading: number,
  yawRate: number,
  speedMps: number,
  mode: ControlMode,
  perturbedK: number,
  dt: number,
  time: number,
): AzipodCourseKeeperState {
  return computeVirtualSimulationStep<AzipodCourseKeeperState>({
    modelId: 'practice_azipod_course_keeper',
    state,
    currentHeading,
    targetHeading,
    yawRate,
    speedMps,
    controlMode: mode,
    perturbedK,
    dt,
    time,
    iceMode: true,
  });
}
