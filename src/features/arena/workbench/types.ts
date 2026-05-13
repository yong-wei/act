import type {
  ArenaModelCapabilities,
  ChallengeObject,
  ChallengeTask,
  ControllerMethod,
  LeaderboardPolicy,
  MetricProfile,
  WorkspaceMode,
} from '../types';

export type { ArenaModelCapabilities };

export type ArenaEntryMode =
  | 'challenge'
  | 'free-explore'
  | 'assignment'
  | 'odyssey'
  | 'virtual-sim';

export interface ArenaWorkbenchContext {
  entryMode: ArenaEntryMode;
  locked: boolean;
  task: ChallengeTask;
  object: ChallengeObject;
  metricProfile: MetricProfile;
  leaderboardPolicy: LeaderboardPolicy;
  capabilities: ArenaModelCapabilities;
  allowedMethods: ControllerMethod[];
  recommendedWorkspaceMode: WorkspaceMode;
  returnHref: string;
}

export interface ArenaWorkbenchPreviewSummary {
  metrics: Array<{
    id: string;
    label: string;
    value: number | null;
    unit?: string;
    satisfaction: number | null;
    status: 'pass' | 'warning' | 'fail' | 'unknown';
  }>;
  previewScore: number | null;
  missingOfficialOnlyMetrics: string[];
}
