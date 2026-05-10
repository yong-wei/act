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
  | 'composite-compensation'
  | 'mpc'
  | 'black-box-control';

export type LeaderboardType = 'main' | 'method' | 'metric' | 'pareto' | 'class' | 'season';

export type WorkspaceMode =
  | 'multi-representation-linkage'
  | 'block-diagram-workbench'
  | 'black-box-identification'
  | 'predictive-control';

export type MetricDirection = 'minimize' | 'maximize' | 'target';

export interface TransferFunctionModel {
  display: string;
  numerator: number[];
  denominator: number[];
}

export interface ChallengeObject {
  id: string;
  name: string;
  source: ChallengeObjectSource;
  visibility: ModelVisibility;
  chapter: string;
  tags: string[];
  model: TransferFunctionModel;
  relatedKnowledge: string[];
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
  participantCount: number;
  topScore: number;
  homeworkPolicy: string;
}

export interface ControllerArtifact {
  id: string;
  taskId: string;
  method: ControllerMethod;
  params: Record<string, number | string | boolean>;
  createdAt: string;
}
