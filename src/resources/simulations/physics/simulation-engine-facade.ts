/**
 * Unified simulation physics facade.
 *
 * Second-batch pages import model-family capabilities through this file so
 * future Rust/WASM replacement can be staged behind one boundary.
 */

export {
  createMMG3DOFState,
  mmg3dofStep,
  mmgToSimulationState,
  type MMG3DOFState,
} from './models/mmg-3dof';
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
  semiSub3DOFStep,
  type SemiSubmersible3DOFState,
} from './models/semisubmersible-3dof';
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
  azipod3dofStepRK4,
  azipodToSimulationState,
  DEFAULT_AZIPOD_3DOF_PARAMS,
  type Azipod3DOFInternalState,
  type Azipod3DOFParams,
} from './models/azipod-3dof';
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
