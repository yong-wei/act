export const SERVER_FACADE_MODULE = 'src/lib/control-engine/server.ts' as const;
export const SERVER_FACADE_IMPORT = '@/lib/control-engine/server' as const;

export const SERVER_CONSUMER_CLASSES = [
  {
    id: 'generic-analysis',
    owner: 'Control Workbench/Analysis',
    facadeSymbol: 'computeControlAnalysisServer',
    routes: ['src/app/api/simulation/runs/route.ts'],
    callers: [
      'src/app/api/simulation/runs/route.ts',
    ],
    compatibilityLoader: null,
  },
  {
    id: 'simulation-virtual-runtime',
    owner: 'Practice Lab/Simulation',
    facadeSymbol: 'computeVirtualSimulationServerStep',
    routes: [
      'src/app/api/simulation/cruise-comfort-analysis/route.ts',
      'src/app/api/simulation/icebreaker-robust-analysis/route.ts',
    ],
    callers: [
      'src/app/api/simulation/cruise-comfort-analysis/route.ts',
      'src/app/api/simulation/icebreaker-robust-analysis/route.ts',
      'src/resources/simulations/lib/monte-carlo-optimizer.ts',
    ],
    compatibilityLoader: null,
  },
  {
    id: 'control-odyssey',
    owner: 'Control Odyssey',
    facadeSymbol: 'computeControlOdysseyServerStep',
    routes: ['src/app/actions/control-odyssey.ts'],
    callers: [
      'src/resources/interactive-learning/control-odyssey/engine/official-simulation.ts',
    ],
    compatibilityLoader: null,
  },
  {
    id: 'arena-analysis',
    owner: 'Arena evaluation',
    facadeSymbol: 'computeAnalysisServer',
    routes: [
      'src/app/api/arena/evaluate/route.ts',
      'src/app/api/arena/submissions/route.ts',
    ],
    callers: [
      'src/features/arena/evaluation/control-analysis-service.ts',
    ],
    compatibilityLoader: 'src/features/arena/evaluation/control-analysis-service.ts',
  },
  {
    id: 'arena-virtual-preview-persistence',
    owner: 'Arena Preview + Control Engine server',
    facadeSymbol: 'computeArenaVirtualPreviewResult',
    routes: ['src/app/api/arena/virtual-simulation-runs/route.ts'],
    callers: [
      'src/features/arena/blackbox/controller-preview.ts',
    ],
    compatibilityLoader: null,
  },
] as const;

export const RETIRED_SERVER_COMPATIBILITY_LOADERS = [
  'src/resources/control-system/analysis/control-engine-server-runtime.ts',
  'src/resources/simulations/rust/control-engine-server-runtime.ts',
  'src/resources/interactive-learning/control-odyssey/engine/control-engine-server-runtime.ts',
] as const;

export const R6_SERVER_LOADER_DELETION_CANDIDATES = [] as const;

export const ARENA_OFFICIAL_PROTOCOLS = [
  'analysis-whitebox-v1',
  'template-whitebox-v1',
  'blackbox-official-v1',
] as const;
