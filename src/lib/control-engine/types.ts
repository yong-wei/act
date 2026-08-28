export const FACADE_PROTOCOL_VERSION = 'control-engine-facade/v1' as const;
export const IDENTITY_SCHEMA = 'act-control-engine-identity/v1' as const;
export const GENERATED_PACKAGE_DIR = 'src/resources/control-system/wasm/control_engine' as const;

export const EXECUTORS = ['browser', 'worker', 'server'] as const;
export type ControlEngineExecutor = (typeof EXECUTORS)[number];

export const AUTHORITY_SOURCES = [
  'control-engine-browser-facade',
  'control-engine-worker-facade',
  'control-engine-server-facade',
  'arena-official-evaluator',
] as const;
export type ControlEngineAuthoritySource = (typeof AUTHORITY_SOURCES)[number];

export const LIFECYCLE_STATES = [
  'idle',
  'loading',
  'ready',
  'error',
  'timeout',
  'unavailable',
] as const;
export type ControlEngineLifecycle = (typeof LIFECYCLE_STATES)[number];

export const MODEL_RELATIONS = ['surrogate', 'identified'] as const;
export type ControlEngineModelRelation = (typeof MODEL_RELATIONS)[number];

export const CAPABILITIES = [
  'computeAnalysis',
  'computeNonlinearAnalysis',
  'computeSimulationStep',
  'computeVirtualSimulationStep',
  'computeRlTraining',
  'computeArenaVirtualPreview',
] as const;
export type ControlEngineCapability = (typeof CAPABILITIES)[number];

export const WASM_EXPORTS = [
  'compute_analysis',
  'compute_nonlinear_analysis',
  'compute_rl_training',
  'compute_simulation_step',
  'compute_virtual_simulation_step',
] as const;
export type ControlEngineWasmExport = (typeof WASM_EXPORTS)[number];

export const REQUIRED_GENERATED_FILES = [
  'index.js',
  'index.d.ts',
  'index_bg.wasm',
  'index_bg.wasm.d.ts',
] as const;

export const ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID = 'arena_cruise_roll_preview' as const;
export const ARENA_PREVIEW_TEACHING_SEMANTICS = 'cruise-roll-virtual-preview-surrogate' as const;

export const DEFAULT_ANALYSIS_TIMEOUT_MS = 12_000;
export const WORKER_RETRY_MS = 4_000;

export interface ControlEngineRuntimeIdentity {
  readonly schemaVersion: typeof IDENTITY_SCHEMA;
  readonly protocolVersion: typeof FACADE_PROTOCOL_VERSION;
  readonly packageDir: typeof GENERATED_PACKAGE_DIR;
  readonly buildHash: string;
  readonly exports: readonly ControlEngineWasmExport[];
}

export interface ControlEngineErrorState {
  readonly state: Extract<ControlEngineLifecycle, 'error' | 'timeout' | 'unavailable'>;
  readonly category: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface ControlEngineEnvelope<TResult> {
  readonly ok: true;
  readonly capability: ControlEngineCapability;
  readonly executor: ControlEngineExecutor;
  readonly authoritySource: ControlEngineAuthoritySource;
  readonly persisted: boolean;
  readonly modelRelation: ControlEngineModelRelation;
  readonly teachingSemantics: string;
  readonly prohibitsMixedClaims: true;
  readonly runtimeIdentity: ControlEngineRuntimeIdentity;
  readonly canonicalRequestHash: string;
  readonly requestId: string;
  readonly result: TResult;
}

export interface ArenaCruiseRollPreviewRequest {
  readonly modelId: typeof ARENA_CRUISE_ROLL_PREVIEW_MODEL_ID;
  readonly taskId: string;
  readonly datasetHash: string;
  readonly identificationModelId: string;
  readonly controllerHash: string;
  readonly controllerGain: number;
  readonly dampingCompensation: number;
  readonly energyBudget: number;
  readonly initialRoll: number;
  readonly sampleTime: number;
  readonly steps: number;
  readonly modelRelation: ControlEngineModelRelation;
  readonly authorizedModelParameters?: Record<string, number> | null;
}

export interface ArenaCruiseRollPreviewPoint {
  readonly t: number;
  readonly reference: number;
  readonly output: number;
  readonly control: number;
}

export interface ArenaCruiseRollPreviewResult {
  readonly trace: ArenaCruiseRollPreviewPoint[];
  readonly summary: {
    readonly trackingError: number;
    readonly maxDeviation: number;
    readonly controlEnergy: number;
    readonly safetyViolations: number;
    readonly smoothness: number;
  };
  readonly identity: {
    readonly taskId: string;
    readonly datasetHash: string;
    readonly identificationModelId: string;
    readonly controllerHash: string;
  };
  readonly modelRelation: ControlEngineModelRelation;
}

export const CLIENT_RESULT_FIELDS = ['trace', 'summary', 'checksum'] as const;
