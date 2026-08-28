export const OWNER_MATRIX = [
  { model: 'ArenaControllerArtifact', owner: 'artifact ownerId', authority: 'arena-artifact' },
  { model: 'ArenaSubmission', owner: 'submitting student userId', authority: 'arena-submission' },
  { model: 'ArenaEvaluationRun', owner: 'Arena evaluator/task; student only via accepted submission', authority: 'arena-evaluator' },
  { model: 'ArenaVirtualSimulationRun', owner: 'student userId', authority: 'simulation-run' },
  { model: 'SimulationTaskSpec', owner: 'canonical spec hash', authority: 'simulation-run' },
  { model: 'SimulationRun', owner: 'ownerUserId', authority: 'simulation-run' },
  { model: 'SimulationTrace', owner: 'canonical run owner', authority: 'simulation-run' },
] as const;

export const ROUTE_DENOMINATOR = [
  '/api/arena/blackbox-experiments',
  '/api/arena/virtual-simulation-runs',
  '/api/arena/evaluate',
  '/api/arena/submissions',
  '/api/simulation/runs',
] as const;

export const LEGACY_PRACTICE_ACCESSES = [
  'SimulationSession',
  'SimulationLog',
] as const;
