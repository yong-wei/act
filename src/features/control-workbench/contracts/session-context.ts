import type {
  ChallengeObject,
  ChallengeTask,
  ControllerMethod,
  LeaderboardPolicy,
  LeaderboardType,
  MetricProfile,
  WorkspaceMode,
} from '../../arena/types';
import type { WorkbenchLayoutPreset, WorkbenchPresetId } from './layout';
import type { WorkbenchExperimentSignalType } from './signals';
import type { WorkbenchPlantTarget } from './targets';
import type { NominalModelArtifact } from './nominal-model';
import type { WorkbenchViewId } from './views';

export type WorkbenchMode = 'challenge' | 'assignment' | 'explore' | 'odyssey';

export interface WorkbenchExperimentPolicy {
  enabled: boolean;
  signalTypes: WorkbenchExperimentSignalType[];
  maxRuns?: number;
  maxSamples?: number;
  budgetLimit?: number;
  requiresPersistedDataset: boolean;
  disabledReason?: string;
}

export interface WorkbenchSubmissionPolicy {
  officialEvaluationEnabled: boolean;
  leaderboardEnabled: boolean;
  requiresArtifactBridge: true;
  leaderboardTypes: LeaderboardType[];
  disabledReason?: string;
}

interface WorkbenchSessionBase {
  mode: WorkbenchMode;
  title?: string;
  officialTarget: WorkbenchPlantTarget | null;
  workingModel: NominalModelArtifact | null;
  allowedMethods: ControllerMethod[];
  allowedViews: WorkbenchViewId[];
  defaultPreset: WorkbenchPresetId;
  layoutPreset?: WorkbenchLayoutPreset;
  experimentPolicy: WorkbenchExperimentPolicy;
  submissionPolicy: WorkbenchSubmissionPolicy;
}

interface ArenaBoundWorkbenchSession extends WorkbenchSessionBase {
  taskId: string;
  task: ChallengeTask;
  object: ChallengeObject;
  metricProfile: MetricProfile;
  leaderboardPolicy: LeaderboardPolicy;
  recommendedWorkspaceMode: WorkspaceMode;
  officialTarget: WorkbenchPlantTarget;
}

export interface ChallengeWorkbenchSessionContext extends ArenaBoundWorkbenchSession {
  mode: 'challenge';
}

export interface AssignmentWorkbenchSessionContext extends ArenaBoundWorkbenchSession {
  mode: 'assignment';
  publicationId: string;
  classId: string;
  seasonId: string;
}

export interface OdysseyWorkbenchSessionContext extends ArenaBoundWorkbenchSession {
  mode: 'odyssey';
  seasonId?: string;
  levelId?: string;
}

export interface ExploreWorkbenchSessionContext extends WorkbenchSessionBase {
  mode: 'explore';
  officialTarget: null;
}

export type WorkbenchSessionContext =
  | ChallengeWorkbenchSessionContext
  | AssignmentWorkbenchSessionContext
  | OdysseyWorkbenchSessionContext
  | ExploreWorkbenchSessionContext;

export const DEFAULT_WORKBENCH_SUBMISSION_POLICIES: Record<WorkbenchMode, WorkbenchSubmissionPolicy> = {
  challenge: {
    officialEvaluationEnabled: true,
    leaderboardEnabled: true,
    requiresArtifactBridge: true,
    leaderboardTypes: ['main', 'method', 'metric'],
  },
  assignment: {
    officialEvaluationEnabled: true,
    leaderboardEnabled: true,
    requiresArtifactBridge: true,
    leaderboardTypes: ['main', 'method', 'metric', 'class'],
  },
  explore: {
    officialEvaluationEnabled: false,
    leaderboardEnabled: false,
    requiresArtifactBridge: true,
    leaderboardTypes: [],
    disabledReason: '自由探索模式不进入官方评价和榜单。',
  },
  odyssey: {
    officialEvaluationEnabled: true,
    leaderboardEnabled: true,
    requiresArtifactBridge: true,
    leaderboardTypes: ['main', 'method', 'metric', 'season'],
  },
};

export function createDefaultWorkbenchSubmissionPolicy(
  mode: WorkbenchMode,
  overrides: Partial<Omit<WorkbenchSubmissionPolicy, 'requiresArtifactBridge'>> = {},
): WorkbenchSubmissionPolicy {
  return {
    ...DEFAULT_WORKBENCH_SUBMISSION_POLICIES[mode],
    ...overrides,
    requiresArtifactBridge: true,
  };
}
