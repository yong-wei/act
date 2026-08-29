import { CONTROL_CORRECTION_GOAL_ID } from './mappings';

export { CONTROL_CORRECTION_GOAL_ID };

export const CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION = 'control-correction-goal-slice.v1';

export const CONTROL_CORRECTION_TARGET_LEVELS = [
  'foundation',
  'developing',
  'proficient',
  'advanced',
] as const;

export const CONTROL_CORRECTION_GOAL_DIMENSIONS = [
  'time-domain-analysis',
  'root-locus-reasoning',
  'frequency-domain-margin-analysis',
  'method-selection',
  'constraint-tradeoff',
  'simulation-validation',
  'arena-transfer',
  'reflection',
  'ai-collaboration',
] as const;

export const CONTROL_CORRECTION_PRIVACY = {
  score: 'student-visible',
  sourceCoverage: 'student-visible',
  confidence: 'student-visible',
  teacherExplanation: 'teacher-scoped',
  auditRefs: 'audit-only',
  rawPayloads: 'system-internal',
} as const;

export const CONTROL_CORRECTION_PRIVACY_CLASSES = {
  student: 'student-visible',
  teacher: 'teacher-scoped',
  admin: 'admin-scoped',
  audit: 'audit-only',
  internal: 'system-internal',
} as const;

export const PATH_CONTEXT_FIELD_CONTRACT = {
  valueRange: 'active/bookmarked/recent path counts and references',
  sourceFamilies: ['LearningPath', 'future AdaptiveLearningPath'],
  algorithmVersion: 'adaptive-learner-state.v1',
  evidenceThreshold: 'at least one path record or empty explicit path context',
  confidencePolicy: 'path-context-is-contextual',
  fallbackReason: 'path-planning-not-started',
  privacyScope: 'student-visible',
} as const;

export const CONTROL_CORRECTION_GOAL_SLICE_FIELD_CONTRACT = {
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy goal sources remain explicit compatibility fallbacks.
  valueRange: 'stable governed dimensions for the control-correction goal',
  sourceFamilies: [
    'StudentPortraitV2Snapshot',
    'StudentCompetencySnapshot', // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: snapshot is a non-authoritative fallback family.
    'LearningFact',
    'AdaptiveMasteryUpdate',
    'StudentEvidenceFeatureCache', // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: cache is a compatibility evidence family.
    'ArenaSubmission',
    'AgentToolRun',
  ],
  algorithmVersion: CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
  evidenceThreshold: 'each dimension declares sufficient, partial, stale, or missing governed evidence',
  confidencePolicy: 'dimension confidence is capped by source coverage and fallback markers',
  fallbackReason: 'missing-control-correction-governed-evidence',
  privacyScope: 'student-visible',
} as const;
