export const CAPTURED_SOURCE_COMMIT = 'd4531207086d006f60d4ff8ea21e75410fea78c1' as const;
export const PROPOSAL_SOURCE_COMMIT = 'a3e6ce7435503050146cadeae6359d6b8eb9a2a5' as const;
export const ROLLBACK_COMMIT = 'd4531207086d006f60d4ff8ea21e75410fea78c1' as const;

export type RawLoaderRetirementStatus =
  | 'deleted'
  | 'retained-product-ui'
  | 'retained-arena-authority';

export const RAW_BUSINESS_LOADER_DENOMINATOR = [
  {
    id: 'generic-analysis-hook',
    path: 'src/resources/control-system/analysis/use-control-engine.ts',
    owner: 'Control Workbench/Analysis consumer',
    surface: 'generic analysis',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    status: 'retained-product-ui' as const,
    replacement: 'src/lib/control-engine/client.ts#computeAnalysisBrowser',
    deleteCondition: 'Workbench UI consumes facade envelopes without this product hook.',
  },
  {
    id: 'generic-analysis-worker',
    path: 'src/resources/control-system/analysis/control-analysis.worker.ts',
    owner: 'Control Workbench/Analysis consumer',
    surface: 'generic analysis',
    kind: 'compatibility',
    classification: 'contract',
    facadeException: false,
    status: 'deleted' as const,
    replacement: 'src/lib/control-engine/analysis.worker.ts',
    deleteCondition: 'zero active worker URL callers',
  },
  {
    id: 'generic-analysis-server',
    path: 'src/resources/control-system/analysis/control-engine-server-runtime.ts',
    owner: 'Control Workbench/Analysis consumer',
    surface: 'generic analysis',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    status: 'deleted' as const,
    replacement: 'src/lib/control-engine/server.ts#computeControlAnalysisServer',
    deleteCondition: 'zero active production callers after R3 cutover',
  },
  {
    id: 'simulation-client',
    path: 'src/resources/simulations/rust/control-engine-runtime.ts',
    owner: 'Practice Lab/Simulation consumer',
    surface: 'simulation',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    status: 'deleted' as const,
    replacement: 'src/lib/control-engine/client.ts#computeVirtualSimulationStepBrowserSync',
    deleteCondition: 'zero active production callers after facade rewire',
  },
  {
    id: 'simulation-server',
    path: 'src/resources/simulations/rust/control-engine-server-runtime.ts',
    owner: 'Practice Lab/Simulation consumer',
    surface: 'simulation',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    status: 'deleted' as const,
    replacement: 'src/lib/control-engine/server.ts#computeVirtualSimulationServerStep',
    deleteCondition: 'zero active production callers after R3/R5 cutover',
  },
  {
    id: 'control-odyssey-client',
    path: 'src/resources/interactive-learning/control-odyssey/engine/control-engine-runtime.ts',
    owner: 'Control Odyssey consumer',
    surface: 'Control Odyssey',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    status: 'deleted' as const,
    replacement: 'src/lib/control-engine/client.ts#computeSimulationStepBrowserSync',
    deleteCondition: 'zero active production callers after facade rewire',
  },
  {
    id: 'control-odyssey-server',
    path: 'src/resources/interactive-learning/control-odyssey/engine/control-engine-server-runtime.ts',
    owner: 'Control Odyssey consumer',
    surface: 'Control Odyssey',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    status: 'deleted' as const,
    replacement: 'src/lib/control-engine/server.ts#computeControlOdysseyServerStep',
    deleteCondition: 'zero active production callers after R3 cutover',
  },
  {
    id: 'arena-analysis-service',
    path: 'src/features/arena/evaluation/control-analysis-service.ts',
    owner: 'Arena evaluation authority',
    surface: 'Arena analysis',
    kind: 'product',
    classification: 'hard',
    facadeException: false,
    status: 'retained-arena-authority' as const,
    replacement: 'src/lib/control-engine/server.ts#computeAnalysisServer',
    deleteCondition: 'Not a raw WASM loader. Retain while Arena owns official score/validity.',
  },
  {
    id: 'unit-5-5-rl-training',
    path: 'src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts',
    owner: 'Unit 5-5 learning consumer',
    surface: 'Unit 5-5 policy learning',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    status: 'deleted' as const,
    replacement: 'src/lib/control-engine/client.ts#computeRlTrainingBrowser',
    deleteCondition: 'zero generated imports and zero loader callers',
  },
] as const;

export const RAW_BUSINESS_LOADERS = RAW_BUSINESS_LOADER_DENOMINATOR.filter(
  (item) => item.status !== 'deleted',
);

export const RETIRED_RAW_BUSINESS_LOADERS = RAW_BUSINESS_LOADER_DENOMINATOR.filter(
  (item) => item.status === 'deleted',
);

export const FACADE_GENERATED_IMPORT_ALLOWLIST = [
  'src/lib/control-engine/wasm-browser.ts',
  'src/lib/control-engine/wasm-server.ts',
] as const;

export const GENERATED_ARTIFACTS = [
  {
    path: 'src/resources/control-system/wasm/control_engine/index.js',
    classification: 'hard',
    owner: 'Platform/Delivery',
  },
  {
    path: 'src/resources/control-system/wasm/control_engine/index.d.ts',
    classification: 'hard',
    owner: 'Platform/Delivery',
  },
  {
    path: 'src/resources/control-system/wasm/control_engine/index_bg.wasm',
    classification: 'hard',
    owner: 'Platform/Delivery',
  },
  {
    path: 'src/resources/control-system/wasm/control_engine/index_bg.wasm.d.ts',
    classification: 'hard',
    owner: 'Platform/Delivery',
  },
  {
    path: 'src/resources/control-system/wasm/control_engine/.build-hash',
    classification: 'hard',
    owner: 'Platform/Delivery',
  },
] as const;

export const PROTECTED_LEGACY_PATHS = [
  'src/resources/simulations/destroyer-simulation.tsx',
  'prisma/schema.prisma',
] as const;

export const RETIRED_TS_STEPPER_EXPORTS = [
  'pidControl',
  'PIDController',
  'GainScheduler',
  'smithPredictorControl',
  'allocateThrust',
  'sloshingStep',
  'windLoadStep',
  'iceBreakingStep',
  'notchFilterStep',
  'dpControl',
  'dpControlWithFeedforward',
  'pidControl2ndOrder',
  'updateCurrentEnvironment',
  'updateWindEnvironment',
  'computeTotalEnvironmentalForces',
  'computeDredgingDisturbance',
  'azipodCourseKeeperControl',
  'azipodCourseKeeperControlIceMode',
  'dpDecoupledControl',
  'dpStandardControl',
  'finStabilizerStep',
] as const;

export const RETIRED_TS_STEPPER_MODULES = [
  'src/resources/simulations/physics/controllers/pid-controller.ts',
  'src/resources/simulations/physics/controllers/smith-predictor.ts',
  'src/resources/simulations/physics/controllers/thruster-allocation.ts',
  'src/resources/simulations/physics/controllers/gain-scheduler.ts',
  'src/resources/simulations/physics/controllers/notch-filter.ts',
  'src/resources/simulations/physics/controllers/dp-controller.ts',
  'src/resources/simulations/physics/controllers/dp-decoupling-controller.ts',
  'src/resources/simulations/physics/controllers/azipod-course-keeper.ts',
  'src/resources/simulations/physics/disturbances/sloshing-model.ts',
  'src/resources/simulations/physics/disturbances/wind-load.ts',
  'src/resources/simulations/physics/disturbances/current-model.ts',
  'src/resources/simulations/physics/disturbances/dredging-impact.ts',
  'src/resources/simulations/physics/disturbances/ice-breaking-model.ts',
  'src/resources/simulations/physics/disturbances/fin-stabilizer.ts',
  'src/resources/simulations/physics/model-state-helpers.ts',
] as const;
