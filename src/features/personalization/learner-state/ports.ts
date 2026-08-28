import type { PortraitV2Consumer } from '@/lib/data-governance/portrait-v2-consumer';
import type { StudentEvidenceFeatureReadResult } from '@/lib/data-governance/student-evidence-feature-cache';
import type { PortraitResolution } from './internal';

export interface LearningRecordReadPort {
  readFeatureCache(userId: string, now: Date): Promise<StudentEvidenceFeatureReadResult>;
  readLatestCompetencySnapshot(userId: string): Promise<Record<string, unknown> | null>;
  readProfileSummary(userId: string): Promise<Record<string, unknown> | null>;
  readEligibleFacts(userId: string): Promise<Array<Record<string, unknown>>>;
  readMasteryLinkedFacts(
    userId: string,
    masteryUpdates: Array<Record<string, unknown>>,
  ): Promise<Array<Record<string, unknown>>>;
  readRiskFlags(userId: string): Promise<Array<Record<string, unknown>>>;
  resolvePortrait(input: {
    userId: string;
    consumer: PortraitV2Consumer;
    now: Date;
    legacySnapshot: Record<string, unknown> | null;
    featureCache: Record<string, unknown>;
  }): Promise<PortraitResolution>;
}

export interface AssessmentReadPort {
  listMasteryUpdates(userId: string): Promise<Array<Record<string, unknown>>>;
  readLatestAbilityEstimate(userId: string): Promise<Record<string, unknown> | null>;
}

export interface PathReadPort {
  readRecentPaths(userId: string): Promise<Array<Record<string, unknown>>>;
  readActiveControlCorrectionPaths(userId: string): Promise<Array<Record<string, unknown>>>;
}

export interface ControlCorrectionGoalPluginPort {
  readFacts(userId: string): Promise<Array<Record<string, unknown>>>;
  readArenaSubmissions(userId: string): Promise<Array<Record<string, unknown>>>;
  readAgentToolRuns(userId: string): Promise<Array<Record<string, unknown>>>;
}

export interface LearnerStateRuntime {
  learningRecord: LearningRecordReadPort;
  assessment: AssessmentReadPort;
  paths: PathReadPort;
  controlCorrectionPlugin: ControlCorrectionGoalPluginPort | null;
  isFeatureFlagEnabled(): boolean;
}
