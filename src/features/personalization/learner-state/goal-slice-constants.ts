import type { AdaptiveLearningCapabilityTarget } from '@/features/personalization/path-planning/contracts';

export const ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION = 'adaptive-learner-state.v1';
export const ADAPTIVE_LEARNER_STATE_FEATURE_FLAG = 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED';
export const ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION = 'adaptive-learner-state.v1';

export type AdaptiveLearnerStatePrivacyScope =
  | 'student-visible'
  | 'teacher-scoped'
  | 'admin-scoped'
  | 'audit-only'
  | 'system-internal';

export type AdaptiveLearnerStateFieldFamily =
  | 'primaryPortrait'
  | 'primaryCompetencies' // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: family name only; not a primary portrait.
  | 'secondaryDimensions'
  | 'knowledgeMastery'
  | 'resourcePreference'
  | 'mediaAbsorption'
  | 'pathContext'
  | 'riskState'
  | 'prerequisiteFeatureGroups'
  | 'controlCorrectionGoalSlice';

export type AdaptiveLearnerStateGoalId = 'control-correction';
export type ControlCorrectionTargetLevel = 'foundation' | 'developing' | 'proficient' | 'advanced';
export type ControlCorrectionDimensionId =
  | 'time-domain-analysis'
  | 'root-locus-reasoning'
  | 'frequency-domain-margin-analysis'
  | 'method-selection'
  | 'constraint-tradeoff'
  | 'simulation-validation'
  | 'arena-transfer'
  | 'reflection'
  | 'ai-collaboration';

export const CONTROL_CORRECTION_GOAL_ID: AdaptiveLearnerStateGoalId = 'control-correction';
export const CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION = 'control-correction-goal-slice.v1';
export const CONTROL_CORRECTION_TARGET_LEVELS: ControlCorrectionTargetLevel[] = [
  'foundation',
  'developing',
  'proficient',
  'advanced',
];
export const CONTROL_CORRECTION_GOAL_DIMENSIONS: ControlCorrectionDimensionId[] = [
  'time-domain-analysis',
  'root-locus-reasoning',
  'frequency-domain-margin-analysis',
  'method-selection',
  'constraint-tradeoff',
  'simulation-validation',
  'arena-transfer',
  'reflection',
  'ai-collaboration',
];

export interface AdaptiveLearnerStateFieldContract {
  valueRange: string;
  sourceFamilies: string[];
  algorithmVersion: string;
  evidenceThreshold: string;
  confidencePolicy: string;
  fallbackReason: string;
  privacyScope: AdaptiveLearnerStatePrivacyScope;
}

export type ControlCorrectionGoalSlicePrivacy = Record<
  'score' | 'sourceCoverage' | 'confidence' | 'teacherExplanation' | 'auditRefs' | 'rawPayloads',
  AdaptiveLearnerStatePrivacyScope
>;

export type ControlCorrectionGoalSlicePrivacyClasses = Record<
  'student' | 'teacher' | 'admin' | 'audit' | 'internal',
  AdaptiveLearnerStatePrivacyScope
>;

export interface AdaptiveGoalSliceDimensionDefinition {
  id: ControlCorrectionDimensionId;
  valueRange: string;
  targetLevelMapping: Record<ControlCorrectionTargetLevel, string>;
  sourceFamilies: string[];
  evidenceThreshold: string;
  freshnessPolicy: string;
  confidencePolicy: string;
  privacy: ControlCorrectionGoalSlicePrivacy;
  fallbackReason: string;
}

export interface AdaptiveGoalSliceDefinition {
  goalId: AdaptiveLearnerStateGoalId;
  displayLabel: string;
  shortLabel: string;
  payloadVersion: typeof CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION;
  dimensions: AdaptiveGoalSliceDimensionDefinition[];
  targetLevels: ControlCorrectionTargetLevel[];
  capabilityTargets: AdaptiveLearningCapabilityTarget[];
  evidenceSourceFamilies: string[];
  privacyClasses: ControlCorrectionGoalSlicePrivacyClasses;
  confidencePolicy: string;
  fieldFamilies: {
    pathContext: AdaptiveLearnerStateFieldContract;
    report: AdaptiveLearnerStateFieldContract;
    konling: AdaptiveLearnerStateFieldContract;
    grading: AdaptiveLearnerStateFieldContract;
  };
  eligibility: Record<'path' | 'report' | 'konling' | 'grading', 'declared' | 'not-declared'>;
  validationFixtures: string[];
}

export const ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS: Record<
  AdaptiveLearnerStateFieldFamily,
  AdaptiveLearnerStateFieldContract
> = {
  primaryPortrait: {
    valueRange: 'exactly seven canonical portrait v2 dimensions with 0-100 scores',
    sourceFamilies: ['StudentPortraitV2Snapshot', 'StudentCompetencySnapshot'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: snapshot is a non-authoritative fallback family.
    algorithmVersion: 'portrait-v2-primary.v1',
    evidenceThreshold: 'native or migrated portrait v2 snapshot; explicit compatibility projection otherwise',
    confidencePolicy: 'dimension confidence and freshness are explicit and versioned',
    fallbackReason: 'legacy-six-dimensional-input-is-non-authoritative',
    privacyScope: 'student-visible',
  },
  primaryCompetencies: {
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy snapshots and feature caches remain per-dimension fallbacks.
    valueRange: 'legacy six-dimensional compatibility values only',
    sourceFamilies: ['StudentPortraitV2Snapshot', 'StudentCompetencySnapshot', 'StudentEvidenceFeatureCache'],
    algorithmVersion: 'portrait-v2-primary.v1-or-legacy-compatibility',
    evidenceThreshold: 'per-dimension current portrait v2 projection with explicit mixed legacy fallback, latest approved legacy snapshot, or fallback empty vector',
    confidencePolicy: 'portrait projection preserves minimum mapped confidence; legacy snapshot confidence remains per dimension',
    fallbackReason: 'missing-current-portrait-or-legacy-compatibility-evidence',
    privacyScope: 'student-visible',
  },
  secondaryDimensions: {
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: secondary legacy fields consume the compatibility projection.
    valueRange: '0-100 derived second-level dimension score',
    sourceFamilies: ['StudentPortraitV2Snapshot', 'StudentCompetencySnapshot', 'LearningFact', 'StudentEvidenceFeatureCache'],
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'primary dimension evidence plus matching governed facts where present',
    confidencePolicy: 'inherits-primary-confidence-capped-by-evidence',
    fallbackReason: 'missing-second-level-evidence',
    privacyScope: 'student-visible',
  },
  knowledgeMastery: {
    valueRange: '0-1 posterior mastery per knowledge tag',
    sourceFamilies: ['AdaptiveMasteryUpdate', 'AdaptiveAssessmentAnswer', 'LearningFact'],
    algorithmVersion: 'adaptive-assessment-bkt-v1',
    evidenceThreshold: 'at least one assessment-backed mastery update',
    confidencePolicy: 'assessment-backed-mastery',
    fallbackReason: 'missing-assessment-backed-mastery',
    privacyScope: 'student-visible',
  },
  resourcePreference: {
    valueRange: 'ranked modality list derived from governed evidence counts',
    sourceFamilies: ['LearningFact', 'StudentEvidenceFeatureCache'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: cache is a compatibility evidence family.
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'at least one governed resource or activity fact',
    confidencePolicy: 'count-and-recency-weighted-context',
    fallbackReason: 'missing-resource-activity-evidence',
    privacyScope: 'student-visible',
  },
  mediaAbsorption: {
    valueRange: '0-1 average media completion proxy',
    sourceFamilies: ['LearningFact', 'StudentEvidenceFeatureCache'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: cache is a compatibility evidence family.
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'at least one governed media fact',
    confidencePolicy: 'media-progress-context-never-high-alone',
    fallbackReason: 'missing-media-evidence',
    privacyScope: 'student-visible',
  },
  pathContext: {
    valueRange: 'active/bookmarked/recent path counts and references',
    sourceFamilies: ['LearningPath', 'future AdaptiveLearningPath'],
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'at least one path record or empty explicit path context',
    confidencePolicy: 'path-context-is-contextual',
    fallbackReason: 'path-planning-not-started',
    privacyScope: 'student-visible',
  },
  riskState: {
    valueRange: 'none/low/medium/high plus redacted active flags',
    sourceFamilies: ['StudentRiskFlag', 'StudentProfileSummary'],
    algorithmVersion: 'risk-detector-versioned',
    evidenceThreshold: 'active unresolved risk flags or profile summary risk level',
    confidencePolicy: 'risk-signals-are-actionable-not-mastery',
    fallbackReason: 'no-active-risk-record',
    privacyScope: 'teacher-scoped',
  },
  prerequisiteFeatureGroups: {
    valueRange: 'compact simulation/Arena feature groups with confidence markers',
    sourceFamilies: ['StudentEvidenceFeatureCache'], // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: cache is a compatibility evidence family.
    algorithmVersion: 'student-evidence-features.v3',
    evidenceThreshold: 'materialized simulation/Arena feature group from prerequisite change',
    confidencePolicy: 'consume-prerequisite-confidence-without-redefinition',
    fallbackReason: 'missing-prerequisite-feature-cache',
    privacyScope: 'student-visible',
  },
  controlCorrectionGoalSlice: {
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy goal sources remain explicit compatibility fallbacks.
    valueRange: 'stable governed dimensions for the control-correction goal',
    sourceFamilies: ['StudentPortraitV2Snapshot', 'StudentCompetencySnapshot', 'LearningFact', 'AdaptiveMasteryUpdate', 'StudentEvidenceFeatureCache', 'ArenaSubmission', 'AgentToolRun'],
    algorithmVersion: CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
    evidenceThreshold: 'each dimension declares sufficient, partial, stale, or missing governed evidence',
    confidencePolicy: 'dimension confidence is capped by source coverage and fallback markers',
    fallbackReason: 'missing-control-correction-governed-evidence',
    privacyScope: 'student-visible',
  },
};

export const CONTROL_CORRECTION_PRIVACY: ControlCorrectionGoalSlicePrivacy = {
  score: 'student-visible',
  sourceCoverage: 'student-visible',
  confidence: 'student-visible',
  teacherExplanation: 'teacher-scoped',
  auditRefs: 'audit-only',
  rawPayloads: 'system-internal',
};

export const CONTROL_CORRECTION_PRIVACY_CLASSES: ControlCorrectionGoalSlicePrivacyClasses = {
  student: 'student-visible',
  teacher: 'teacher-scoped',
  admin: 'admin-scoped',
  audit: 'audit-only',
  internal: 'system-internal',
};
