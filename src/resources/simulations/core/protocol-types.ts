/**
 * SceneSpec v1 — canonical scene description contract.
 * Consumed by standalone /simulations/*, Arena runs, and DB BOPPPS resources.
 */
export interface SceneSpecV1 {
  scene: SceneIdentityV1;
  model: ModelIdentityV1;
  disturbance: DisturbancePolicyV1;
  evaluation: EvaluationPolicyV1;
  assets: AssetManifestV1;
  telemetry: TelemetryPolicyV1;
  replay: ReplayPolicyV1;
  governance: EvidenceGovernanceV1;
}

export interface SceneIdentityV1 {
  /** Unique scene id, e.g. "sim/cruise" */
  id: string;
  /** Human-readable title */
  title: string;
  /** Route under /simulations/ */
  route: string;
  /** Course resource id when launched from BOPPPS lesson (optional) */
  resourceId?: string;
  /** Course alignment: e.g. unit codes */
  courseAlignment?: string[];
  /** Supported launch modes */
  launchModes: LaunchMode[];
}

export type LaunchMode = 'standalone' | 'course-resource' | 'arena-task';

export interface ModelIdentityV1 {
  /** Model family: Nomoto1stOrder, MMG3DOF, Azipod3DOF, SemiSubmersible3DOF, etc. */
  family: string;
  /** Runtime model id used by Rust/WASM compute_virtual_simulation_step */
  runtimeModelId: string;
  /** Parameter schema version */
  parameterSchema: string;
  /** Semver of the model implementation */
  version: string;
  /** Unit policy: rad vs deg boundaries */
  unitPolicy: 'rad' | 'deg';
}

export interface DisturbancePolicyV1 {
  /** Supported environment families */
  environmentFamilies: EnvironmentFamily[];
  /** Whether stochastic paths require explicit seed */
  stochasticPolicy: 'deterministic' | 'seeded' | 'mixed';
  /** If seeded, whether seed is required or optional */
  seedRequirement: 'required' | 'optional' | 'none';
}

export type EnvironmentFamily = 'waves' | 'wind' | 'current' | 'ice' | 'none';

export interface EvaluationPolicyV1 {
  /** Metric ids evaluated for this scene */
  metrics: string[];
  /** Hard constraint ids */
  hardConstraints: string[];
  /** Success criteria expressed against metrics */
  successCriteria: EvaluationCriterion[];
  /** Evaluation protocol reference */
  evaluationProtocol: EvaluationSpecV1;
}

export interface EvaluationCriterion {
  metricId: string;
  operator: 'lt' | 'lte' | 'gt' | 'gte' | 'between';
  value: number;
  /** Required and must be > value when operator is 'between' */
  value2?: number;
}

/**
 * EvaluationSpec v1 — binds scene and Arena evaluation semantics.
 */
export interface EvaluationSpecV1 {
  /** Reference id, e.g. "eval/cruise-official" */
  id: string;
  /** Metric ids */
  metrics: string[];
  /** Hard constraint ids */
  hardConstraints: string[];
  /** Whether preview (student-facing) metrics are shown */
  visibility: 'preview' | 'official' | 'both';
  /**
   * Model relation between Arena object and 3D scene object.
   * - same: identical model
   * - simplified: lower-fidelity variant
   * - surrogate: different model used as proxy
   */
  modelRelation: ModelRelation;
  /** Whether preview and official claims must be kept separate */
  prohibitsMixedClaims: boolean;
}

export interface ModelRelation {
  relation: 'same' | 'simplified' | 'surrogate';
  /** Teaching meaning of the relation */
  teachingSemantics: string;
  /** Claims that must NOT be mixed across fidelity boundaries */
  evaluationBoundary: string;
}

export interface AssetManifestV1 {
  /** Asset ids required for this scene */
  assetIds: string[];
  /** Visual layer dependencies (3D models, textures, shaders) */
  visualLayers: string[];
  /** Asset bundle version */
  version: string;
}

export interface TelemetryPolicyV1 {
  /** Telemetry channels recorded */
  sampleChannels: TelemetryChannel[];
  /** Default recording interval in seconds (recommend 0.05s) */
  defaultRecordInterval: number;
  /** Summary metrics computed from telemetry */
  summaryMetrics: string[];
}

export type TelemetryChannel = 'time' | 'position' | 'heading' | 'speed' | 'rudder' | 'yawRate' | 'surgeVelocity' | 'swayVelocity' | 'roll' | 'pitch' | 'thrust' | 'azimuth' | 'power' | 'error' | 'comfort';

export interface ReplayPolicyV1 {
  /** Seed fields required for deterministic replay */
  seedFields: string[];
  /** Runtime version at time of run */
  runtimeVersion: string;
  /** Model version at time of run */
  modelVersion: string;
  /** Checksum policy */
  checksumPolicy: 'sha256' | 'none';
}

export interface EvidenceGovernanceV1 {
  /** Evidence source identifier */
  evidenceSource: string;
  /** Privacy level */
  privacyLevel: 'public' | 'internal' | 'restricted';
  /** Retention class */
  retentionClass: 'temporary' | 'permanent' | 'graded';
  /** Class/session context fields for privacy filtering */
  contextFields: GovernanceContextField[];
}

export type GovernanceContextField = 'classId' | 'sessionId' | 'userId' | 'courseId' | 'unitId';

// Re-export EvaluationSpecV1 as a standalone type
export type { EvaluationSpecV1 as EvaluationSpecV1Standalone };

/**
 * SimulationTrace v1 — separates high-frequency samples from compact summaries.
 */
export interface SimulationTraceV1 {
  /** Run envelope */
  envelope: TraceEnvelopeV1;
  /** High-frequency sample reference (storage path or inline) */
  samples: TraceSampleRef;
  /** Compact summary metrics */
  summary: TraceSummaryV1;
}

export interface TraceEnvelopeV1 {
  /** Unique run id */
  runId: string;
  /** Scene id */
  sceneId: string;
  /** Scenario id within the scene */
  scenarioId: string;
  /** Protocol version (this spec version) */
  protocolVersion: '1.0';
  /** Runtime version at run time */
  runtimeVersion: string;
  /** Model version at run time */
  modelVersion: string;
  /** Seed used for this run */
  seed: number;
  /** ISO 8601 timestamp when run started */
  startedAt: string;
  /** ISO 8601 timestamp when run completed */
  completedAt: string;
  /** Sample cadence in seconds */
  sampleCadence: number;
  /** Checksum over the trace for replay verification */
  checksum: string;
}

export interface TraceSampleRef {
  /** Storage path or empty if inline */
  path: string;
  /** Number of sample frames */
  frameCount: number;
  /** Channels recorded */
  channels: TelemetryChannel[];
}

export interface TraceSummaryV1 {
  /** Aggregate metrics keyed by metric id */
  metrics: Record<string, number>;
  /** Whether the run met success criteria */
  passed: boolean;
  /** Duration in seconds */
  durationSeconds: number;
}

export type {
  SimulationRunContext,
  SimulationReplayMetadata,
} from './seeded-rng';
