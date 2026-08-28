export const CAPTURED_SOURCE_COMMIT = '653b4a7cd0cedf3e70902411404f0c297cd00901' as const;
export const PROPOSAL_SOURCE_COMMIT = 'a3e6ce7435503050146cadeae6359d6b8eb9a2a5' as const;

export const RAW_BUSINESS_LOADERS = [
  {
    id: 'generic-analysis-hook',
    path: 'src/resources/control-system/analysis/use-control-engine.ts',
    owner: 'Control Workbench/Analysis consumer',
    surface: 'generic analysis',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Keep as compatibility hook until R4 callers consume facade state directly; do not delete in R1.',
  },
  {
    id: 'generic-analysis-worker',
    path: 'src/resources/control-system/analysis/control-analysis.worker.ts',
    owner: 'Control Workbench/Analysis consumer',
    surface: 'generic analysis',
    kind: 'compatibility',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Worker script remains a compatibility entry that loads the facade worker adapter; delete only after R6 caller scan is empty.',
  },
  {
    id: 'generic-analysis-server',
    path: 'src/resources/control-system/analysis/control-engine-server-runtime.ts',
    owner: 'Control Workbench/Analysis consumer',
    surface: 'generic analysis',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Server analysis runtime becomes a thin facade wrapper; retire after R3 consumer cutover.',
  },
  {
    id: 'simulation-client',
    path: 'src/resources/simulations/rust/control-engine-runtime.ts',
    owner: 'Practice Lab/Simulation consumer',
    surface: 'simulation',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Client virtual-simulation runtime wraps facade; delete after R4/R5 zero callers.',
  },
  {
    id: 'simulation-server',
    path: 'src/resources/simulations/rust/control-engine-server-runtime.ts',
    owner: 'Practice Lab/Simulation consumer',
    surface: 'simulation',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Server virtual-simulation runtime wraps facade; delete after R3/R5 zero callers.',
  },
  {
    id: 'control-odyssey-client',
    path: 'src/resources/interactive-learning/control-odyssey/engine/control-engine-runtime.ts',
    owner: 'Control Odyssey consumer',
    surface: 'Control Odyssey',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Odyssey client runtime wraps facade; delete after R5 zero callers.',
  },
  {
    id: 'control-odyssey-server',
    path: 'src/resources/interactive-learning/control-odyssey/engine/control-engine-server-runtime.ts',
    owner: 'Control Odyssey consumer',
    surface: 'Control Odyssey',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Odyssey server runtime wraps facade; delete after R3/R5 zero callers.',
  },
  {
    id: 'arena-analysis-service',
    path: 'src/features/arena/evaluation/control-analysis-service.ts',
    owner: 'Arena evaluation authority',
    surface: 'Arena analysis',
    kind: 'product',
    classification: 'hard',
    facadeException: false,
    r6Handoff: 'Official evaluator continues to own score/validity; this loader only borrows the server facade. Do not delete until R3 ledger proves zero generated imports.',
  },
  {
    id: 'unit-5-5-rl-training',
    path: 'src/features/interactive/unit-5-5-policy-learning-entry-risk/rl-training-runtime.ts',
    owner: 'Unit 5-5 learning consumer',
    surface: 'Unit 5-5 policy learning',
    kind: 'product',
    classification: 'contract',
    facadeException: false,
    r6Handoff: 'Unit 5-5 is a business consumer, never a facade/build exception. Retire generated import in R1; delete the compatibility file only in R6.',
  },
] as const;

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
