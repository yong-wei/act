/**
 * Unified simulation physics facade.
 *
 * Second-batch pages import model-family capabilities through this file so
 * future Rust/WASM replacement can be staged behind one boundary.
 */

import { computeVirtualSimulationStep } from '../rust/control-engine-runtime';
import {
  createMMG3DOFState,
  mmgToSimulationState,
  DEFAULT_MMG_PARAMS,
  type MMG3DOFState,
} from './models/mmg-3dof';
import {
  createSemiSub3DOFState,
  type SemiSubmersible3DOFState,
} from './models/semisubmersible-3dof';
import {
  createAzipod3DOFState,
  azipodToSimulationState,
  DEFAULT_AZIPOD_3DOF_PARAMS,
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
} from './models/azipod-3dof';
import type { DisturbanceVector, MMG3DOFParams } from '../core/types';

export {
  preloadVirtualSimulationRuntime,
  isVirtualSimulationRuntimeReady,
} from '../rust/control-engine-runtime';

export {
  createMMG3DOFState,
  mmgToSimulationState,
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
