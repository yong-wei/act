import type { AdaptiveGoalSliceDefinition } from '@/features/personalization/learner-state/internal';

export type PersonalizationPluginStatus = 'active' | 'disabled' | 'retired';

export type PersonalizationGoalHintField = 'goalId' | 'courseId' | 'lessonId' | 'taskId';

export interface PersonalizationGoalHint {
  goalId?: string | null;
  courseId?: string | null;
  lessonId?: string | null;
  taskId?: string | null;
  pluginVersion?: string | null;
}

export interface PersonalizationGoalContext {
  goalId: string;
  pluginId: string;
  pluginVersion: string;
  matchedBy: PersonalizationGoalHintField[];
}

export type PersonalizationGoalUnsupportedReason =
  | 'unknown-mapping'
  | 'conflicting-mapping'
  | 'plugin-unavailable'
  | 'plugin-retired'
  | 'version-unavailable';

export type PersonalizationGoalResolution =
  | { status: 'resolved'; context: PersonalizationGoalContext }
  | {
      status: 'unsupported';
      reason: PersonalizationGoalUnsupportedReason;
      goalId: string | null;
      limitation: 'unsupported-goal' | 'limited-confidence';
    };

export interface GoalPluginEvidencePort {
  readFacts(userId: string): Promise<Array<Record<string, unknown>>>;
  readArenaSubmissions(userId: string): Promise<Array<Record<string, unknown>>>;
  readAgentToolRuns(userId: string): Promise<Array<Record<string, unknown>>>;
}

export interface PluginPersistenceRequest {
  pluginId: string;
  pluginVersion: string;
  subjectUserId: string;
  idempotencyKey: string;
  evidenceRevision: string;
  sourceCoverage: string;
  confidence: number;
  privacyClass: string;
  evidenceRefs: readonly string[];
}

export interface PluginPersistenceResult {
  accepted: boolean;
  duplicate: boolean;
  identity: string;
}

export interface PersonalizationPluginWritePort {
  persist(request: PluginPersistenceRequest): Promise<PluginPersistenceResult>;
}

export interface PersonalizationPluginRationaleCitation {
  pluginId: string;
  pluginVersion: string;
  goalId: string;
  sourceCategory: 'learning-record' | 'assessment' | 'path' | 'simulation' | 'arena';
  privacySafe: true;
}

export interface PersonalizationGoalPlugin<TDb = unknown> {
  pluginId: string;
  goalId: string;
  version: string;
  status: PersonalizationPluginStatus;
  courseIds: readonly string[];
  lessonIds: readonly string[];
  arenaTaskIds: readonly string[];
  sliceDefinition: AdaptiveGoalSliceDefinition;
  createEvidencePort(db: TDb): GoalPluginEvidencePort;
  createWritePort(): PersonalizationPluginWritePort;
}
