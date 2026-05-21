export type ChallengeObjectSource =
  | 'typical'
  | 'homework'
  | 'control-odyssey'
  | 'virtual-simulation'
  | 'frontier';

export type ModelVisibility = 'white-box' | 'gray-box' | 'black-box';

export type ControllerMethod =
  | 'serial-compensator'
  | 'pid'
  | 'optimized-pid'
  | 'composite-compensation'
  | 'mpc'
  | 'black-box-control'
  | 'code-controller';

export type LeaderboardType = 'main' | 'method' | 'metric' | 'pareto' | 'class' | 'season';

export type ArenaTrainingStageId =
  | 'foundation'
  | 'analysis-integration'
  | 'structured-design'
  | 'robust-advanced'
  | 'blackbox-project';

export type ArenaTrainingCapabilityId =
  | 'time-domain-shaping'
  | 'steady-state-accuracy'
  | 'frequency-comfort'
  | 'stability-margin'
  | 'root-locus-reasoning'
  | 'structured-compensation'
  | 'black-box-identification'
  | 'constraint-optimization'
  | 'robustness-tradeoff'
  | 'hidden-scenario-robustness'
  | 'control-energy-tradeoff'
  | 'mpc-template-design';

export type ArenaHiddenTestSignal = 'none' | 'metric-only' | 'hidden-scenarios' | 'black-box-batch';

export type WorkspaceMode =
  | 'multi-representation-linkage'
  | 'block-diagram-workbench'
  | 'black-box-identification'
  | 'predictive-control'
  | 'control-odyssey';

export type ChallengeObjectAdapterType =
  | 'transfer-function'
  | 'homework'
  | 'control-odyssey'
  | 'virtual-simulation';

export type MetricDirection = 'minimize' | 'maximize' | 'target';

export interface TransferFunctionModel {
  display: string;
  latex?: string;
  numerator: number[];
  denominator: number[];
}

export interface RelatedKnowledgeRef {
  label: string;
  nodeId: string;
}

export interface ArenaModelCapabilities {
  isLti: boolean;
  isSiso: boolean;
  isMimo: boolean;
  isNonlinear: boolean;
  hasTransferFunction: boolean;
  hasStateSpace: boolean;
  supportsStepResponse: boolean;
  supportsRootLocus: boolean;
  supportsBode: boolean;
  supportsNyquist: boolean;
  supportsSerialCorrection: boolean;
  supportsPid: boolean;
  supportsCompositeControl: boolean;
  supportsIdentification: boolean;
  supportsMpc: boolean;
  supportsVirtualSimulationPreview: boolean;
  supportsOfficialEvaluation: boolean;
}

export interface ChallengeObject {
  id: string;
  name: string;
  source: ChallengeObjectSource;
  visibility: ModelVisibility;
  chapter: string;
  tags: string[];
  adapterType?: ChallengeObjectAdapterType;
  model?: TransferFunctionModel;
  publicInterface?: string;
  evaluationInterface?: string;
  scenarioSummary?: string;
  relatedKnowledge: RelatedKnowledgeRef[];
  capabilities?: ArenaModelCapabilities;
  modelVersion?: string;
  modelType?: 'transfer-function' | 'state-space' | 'nonlinear-simulation' | 'virtual-simulation' | 'data-only';
  timeRange?: { start: number; end: number; samples: number };
  frequencyRange?: { min: number; max: number; samples: number };
  workbenchSeed?: {
    poles: Array<{ re: number; im: number }>;
    zeros: Array<{ re: number; im: number }>;
    gain: number;
  };
}

export interface MetricDefinition {
  id: string;
  label: string;
  direction: MetricDirection;
  idealValue: number;
  unacceptableValue: number;
  unit?: string;
}

export interface MetricProfile {
  id: string;
  name: string;
  hardConstraints: string[];
  rankingMetrics: MetricDefinition[];
  diagnosticMetrics: string[];
}

export interface LeaderboardPolicy {
  id: string;
  name: string;
  types: LeaderboardType[];
  tieBreakers: string[];
  visibility: 'class' | 'course' | 'public';
}

export interface ArenaTrainingMetadata {
  stage: ArenaTrainingStageId;
  capabilityTags: ArenaTrainingCapabilityId[];
  prerequisiteCapabilityTags: ArenaTrainingCapabilityId[];
  goal: string;
  estimatedEffortMinutes: number;
  hiddenTestSignal: ArenaHiddenTestSignal;
  commonFailurePoints: string[];
}

export interface ChallengeTask {
  id: string;
  objectId: string;
  title: string;
  goal: string;
  difficulty: '基础' | '进阶' | '挑战';
  allowedMethods: ControllerMethod[];
  metricProfileId: string;
  leaderboardPolicyId: string;
  leaderboardTypes: LeaderboardType[];
  primaryMetrics: string[];
  workspaceMode: WorkspaceMode;
  homeworkPolicy: string;
  homeworkEligible: boolean;
  practiceMode: 'open' | 'guided' | 'project';
  training: ArenaTrainingMetadata;
}

export interface ControllerArtifact {
  id: string;
  taskId: string;
  method: ControllerMethod;
  params: Record<string, number | string | boolean>;
  createdAt: string;
}

export interface ArenaTaskStats {
  participantCount: number;
  submissionCount: number;
  topScore: number | null;
}
