/**
 * Unified simulation physics facade.
 *
 * Second-batch pages import model-family capabilities through this file so
 * future Rust/WASM replacement can be staged behind one boundary.
 */

import { computeVirtualSimulationStep } from '../rust/control-engine-runtime';
import {
  createNomotoState,
  nomotoStep,
  nomotoToSimulationState,
  type NomotoState,
} from './models/nomoto-1st-order';
import {
  createNomoto2ndOrderDelayState,
  createPIDState as createPIDStateForLNG,
  pidControl2ndOrder,
  DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
  type Nomoto2ndOrderDelayState,
} from './models/nomoto-2nd-order-delay';
import {
  createContainerShipState,
  updateLoadRatio,
  getContainerShipSummary,
  shouldTriggerRollAlarm,
  type ContainerShipState,
} from './models/nomoto-variable-mass';
import {
  createRollCoupledState,
  computeWaveExcitation,
  DEFAULT_ROLL_COUPLED_PARAMS,
  type RollCoupledState,
} from './models/nomoto-roll-coupled';
import {
  createMMG3DOFState,
  mmgToSimulationState,
  DEFAULT_MMG_PARAMS,
  type MMG3DOFState,
} from './models/mmg-3dof';
import {
  createSemiSub3DOFState,
  semiSubToSimulationState,
  getDecouplingMatrix,
  type SemiSubmersible3DOFState,
} from './models/semisubmersible-3dof';
import {
  createAzipod3DOFState,
  azipodToSimulationState,
  setAzipodCommands,
  DEFAULT_AZIPOD_3DOF_PARAMS,
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
} from './models/azipod-3dof';
import { DEFAULT_NOMOTO_PARAMS } from '../core/constants';
import type {
  DisturbanceVector,
  MMG3DOFParams,
  NomotoParams,
  Nomoto2ndOrderParams,
  RollCoupledNomotoParams,
  RollState,
} from '../core/types';

export {
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
} from '../rust/control-engine-runtime';

export {
  createNomotoState,
  nomotoStep,
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
  pidControl2ndOrder,
  DEFAULT_NOMOTO_2ND_ORDER_PARAMS,
  type Nomoto2ndOrderDelayState,
};

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

export {
  createMMG3DOFState,
  mmgToSimulationState,
  DEFAULT_MMG_PARAMS,
  type MMG3DOFState,
};

export function mmg3dofStep(
  state: MMG3DOFState,
  rudderCommand: number,
  propellerRPM: number,
  dt: number,
  params: MMG3DOFParams = DEFAULT_MMG_PARAMS,
  shipLength = 127.5,
  shipDraft = 6.2,
  disturbance: DisturbanceVector = { forceX: 0, forceY: 0, momentN: 0 },
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
  });
}

export {
  dpControl,
  dpControlWithFeedforward,
  createDPState,
  HIGH_PRECISION_DP_GAINS,
  type DPState,
  type DPTarget,
  type DPCurrentState,
  type DPErrorMetrics,
} from './controllers/dp-controller';
export { DredgingImpactModel } from './disturbances/dredging-impact';

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
  updateCurrentEnvironment,
  updateWindEnvironment,
  computeTotalEnvironmentalForces,
  getTypicalEnvironment,
  type CurrentEnvironment,
  type WindEnvironment,
} from './disturbances/current-model';
export {
  allocateThrust,
  createThrusterConfigs,
  computeTotalPower,
  simulateThrusterFailure,
} from './controllers/thruster-allocation';
export {
  dpDecoupledControl,
  dpStandardControl,
  createDPControllerConfig,
  createDPState as createDPDecouplingState,
  type DPControllerConfig,
  type DPState as DPDecouplingState,
} from './controllers/dp-decoupling-controller';

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
  iceBreakingStep,
  getIceBreakingSummary,
  getIceZoneSafetyLevel,
  DEFAULT_ICE_BREAKING_PARAMS,
  type IceBreakingState,
} from './disturbances/ice-breaking-model';
export {
  createAzipodCourseKeeperState,
  azipodCourseKeeperControl,
  azipodCourseKeeperControlIceMode,
  getAzipodControllerDiagnostics,
  DEFAULT_AZIPOD_COURSE_KEEPER_CONFIG,
  type AzipodCourseKeeperState,
} from './controllers/azipod-course-keeper';
