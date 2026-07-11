import {
  COMPETENCY_DIMENSIONS,
  createEmptyCompetencyVector,
  type CompetencyDimension,
  type CompetencyVector,
} from './competency-model';
import { getArenaEvaluationProtocolVersion } from '@/features/arena/evaluation/protocol';
import {
  readStudentEvidenceFeatures,
  type StudentEvidenceCoverageState,
  type StudentEvidenceFeatureReadResult,
  type StudentEvidenceStatusMarker,
  type StudentEvidenceWindow,
} from './student-evidence-feature-cache';
import {
  CONTROL_CORRECTION_CAPABILITY_TARGETS,
  isRegisteredAdaptiveLearningPathGoal,
  type AdaptiveLearningCapabilityTarget,
} from '../adaptive-learning-path-planner';
import { readArenaSubmissionEvidenceWritebacks } from '@/features/arena/evidence-writeback-persistence';
import {
  derivePortraitV2Compatibility,
  PortraitV2SnapshotValidationError,
  projectPortraitV2ForConsumer,
  readLatestPortraitV2Snapshot,
  type PortraitV2CompatibilitySourceFamily,
  type PortraitV2Consumer,
  type PortraitV2ProjectedPayload,
  type PortraitV2SnapshotReadDb,
} from './portrait-v2-model';

export const ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION = 'adaptive-learner-state.v1';
export const ADAPTIVE_LEARNER_STATE_FEATURE_FLAG = 'ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED';
export const ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION = 'adaptive-learner-state.v1';

export type AdaptiveLearnerStateRole = 'student' | 'teacher' | 'admin' | 'system';
export type AdaptiveLearnerStatePrivacyScope =
  | 'student-visible'
  | 'teacher-scoped'
  | 'admin-scoped'
  | 'audit-only'
  | 'system-internal';

export type AdaptiveLearnerStateFieldFamily =
  | 'primaryPortrait'
  | 'primaryCompetencies'
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
export const CONTROL_CORRECTION_COURSE_ID_VALUES = [
  CONTROL_CORRECTION_GOAL_ID,
  '3-6',
  'unit-3-6-zero-design-workshop',
  'unit-3-6-zero-design-workshop-v1',
] as const;
const CONTROL_CORRECTION_ARENA_TASK_ID_VALUES = [
  'task-second-order-lead-pid',
] as const;
const CONTROL_CORRECTION_COURSE_IDS = new Set<string>(CONTROL_CORRECTION_COURSE_ID_VALUES);
const CONTROL_CORRECTION_ARENA_TASK_IDS = new Set<string>(CONTROL_CORRECTION_ARENA_TASK_ID_VALUES);
const CONTROL_CORRECTION_FACT_TAKE = 500;
const CONTROL_CORRECTION_LEGACY_FACT_SCAN_MAX_PAGES = 10;
const CONTROL_CORRECTION_EXPLICIT_FACT_SCAN_MAX_PAGES = 10;
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

export type AdaptiveLearnerSecondaryDimension =
  | 'conceptMastery'
  | 'timeFrequencyTransfer'
  | 'modelingReliability'
  | 'tuningEfficiency'
  | 'constrainedOptimization'
  | 'solutionStability'
  | 'crossModalTransfer'
  | 'scenarioGeneralization'
  | 'riskRecognition'
  | 'constraintCompliance'
  | 'explanationQuality'
  | 'aiUseStrategy'
  | 'reflectionDepth'
  | 'pathExecution'
  | 'persistence'
  | 'remedialInitiative';

export interface AdaptiveLearnerStateFieldContract {
  valueRange: string;
  sourceFamilies: string[];
  algorithmVersion: string;
  evidenceThreshold: string;
  confidencePolicy: string;
  fallbackReason: string;
  privacyScope: AdaptiveLearnerStatePrivacyScope;
}

export interface AdaptiveGoalSliceDimensionDefinition {
  id: ControlCorrectionDimensionId;
  valueRange: string;
  targetLevelMapping: Record<ControlCorrectionTargetLevel, string>;
  sourceFamilies: string[];
  evidenceThreshold: string;
  freshnessPolicy: string;
  confidencePolicy: string;
  privacy: ControlCorrectionGoalSliceDimension['privacy'];
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
  privacyClasses: ControlCorrectionGoalSlice['privacyClasses'];
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

export const ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS: Record<AdaptiveLearnerStateFieldFamily, AdaptiveLearnerStateFieldContract> = {
  primaryPortrait: {
    valueRange: 'exactly seven canonical portrait v2 dimensions with 0-100 scores',
    sourceFamilies: ['StudentPortraitV2Snapshot', 'StudentCompetencySnapshot'],
    algorithmVersion: 'portrait-v2-primary.v1',
    evidenceThreshold: 'native or migrated portrait v2 snapshot; explicit compatibility projection otherwise',
    confidencePolicy: 'dimension confidence and freshness are explicit and versioned',
    fallbackReason: 'legacy-six-dimensional-input-is-non-authoritative',
    privacyScope: 'student-visible',
  },
  primaryCompetencies: {
    valueRange: 'legacy six-dimensional compatibility values only',
    sourceFamilies: ['StudentCompetencySnapshot', 'StudentEvidenceFeatureCache'],
    algorithmVersion: 'competency-snapshot-versioned',
    evidenceThreshold: 'latest approved snapshot or fallback empty vector',
    confidencePolicy: 'snapshot-confidence-per-dimension',
    fallbackReason: 'missing-competency-snapshot',
    privacyScope: 'student-visible',
  },
  secondaryDimensions: {
    valueRange: '0-100 derived second-level dimension score',
    sourceFamilies: ['StudentCompetencySnapshot', 'LearningFact', 'StudentEvidenceFeatureCache'],
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
    sourceFamilies: ['LearningFact', 'StudentEvidenceFeatureCache'],
    algorithmVersion: ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
    evidenceThreshold: 'at least one governed resource or activity fact',
    confidencePolicy: 'count-and-recency-weighted-context',
    fallbackReason: 'missing-resource-activity-evidence',
    privacyScope: 'student-visible',
  },
  mediaAbsorption: {
    valueRange: '0-1 average media completion proxy',
    sourceFamilies: ['LearningFact', 'StudentEvidenceFeatureCache'],
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
    sourceFamilies: ['StudentEvidenceFeatureCache'],
    algorithmVersion: 'student-evidence-features.v3',
    evidenceThreshold: 'materialized simulation/Arena feature group from prerequisite change',
    confidencePolicy: 'consume-prerequisite-confidence-without-redefinition',
    fallbackReason: 'missing-prerequisite-feature-cache',
    privacyScope: 'student-visible',
  },
  controlCorrectionGoalSlice: {
    valueRange: 'stable governed dimensions for the control-correction goal',
    sourceFamilies: ['StudentCompetencySnapshot', 'LearningFact', 'AdaptiveMasteryUpdate', 'StudentEvidenceFeatureCache', 'ArenaSubmission', 'AgentToolRun'],
    algorithmVersion: CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
    evidenceThreshold: 'each dimension declares sufficient, partial, stale, or missing governed evidence',
    confidencePolicy: 'dimension confidence is capped by source coverage and fallback markers',
    fallbackReason: 'missing-control-correction-governed-evidence',
    privacyScope: 'student-visible',
  },
};

export interface AdaptiveLearnerStateInput {
  userId: string;
  role: AdaptiveLearnerStateRole;
  classId?: string | null;
  now?: Date;
  clientHints?: Record<string, unknown>;
  goal?: string | null;
  portraitConsumer?: 'student' | 'konling' | 'planner';
}

export interface ControlCorrectionGoalSliceDimension {
  id: ControlCorrectionDimensionId;
  targetLevel: ControlCorrectionTargetLevel;
  score: number;
  sourceCoverage: Record<'assessment' | 'simulation' | 'arena' | 'reflection' | 'aiCollaboration', StudentEvidenceCoverageState>;
  evidenceCount: number;
  freshness: 'current' | 'partial' | 'stale' | 'missing';
  evidenceProvenance: {
    assessment: 'assessment-backed' | 'snapshot-derived' | 'missing';
    simulation: 'governed-replay' | 'missing';
    arena: 'official' | 'preview' | 'missing';
    reflection: 'governed-reflection' | 'missing';
    aiCollaboration: 'governed-ai-collaboration' | 'missing';
  };
  confidence: {
    state: 'none' | 'low' | 'medium' | 'high';
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
  };
  privacy: Record<'score' | 'sourceCoverage' | 'confidence' | 'teacherExplanation' | 'auditRefs' | 'rawPayloads', AdaptiveLearnerStatePrivacyScope>;
  fallbackMarkers: string[];
}

export type MasteryEvidenceSourceType =
  | 'AdaptiveMasteryUpdate'
  | 'LearningFact'
  | 'ArenaSubmission'
  | 'AgentToolRun'
  | 'StudentEvidenceFeatureCache';

export interface MasteryEvidenceReference {
  sourceType: MasteryEvidenceSourceType;
  sourceId: string;
  evidenceAt: string | null;
  privacyLevel: Extract<AdaptiveLearnerStatePrivacyScope, 'student-visible' | 'teacher-scoped' | 'audit-only'>;
  confidence: 'low' | 'medium' | 'high' | 'unknown';
}

export interface MasteryTraceabilityEntry {
  targetId: string;
  targetKind: 'knowledge' | 'capability';
  masteryLevel: number | null;
  confidence: number;
  freshness: 'current' | 'stale' | 'missing' | 'partial';
  supportingEvidenceRefs: MasteryEvidenceReference[];
  sourceCoverage: Record<MasteryEvidenceSourceType, StudentEvidenceCoverageState>;
  limitations: string[];
}

export interface ControlCorrectionGoalSlice {
  goalId: typeof CONTROL_CORRECTION_GOAL_ID;
  payloadVersion: typeof CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION;
  generatedAt: string;
  targetLevels: ControlCorrectionTargetLevel[];
  capabilityTargets: ControlCorrectionCapabilityTargetEvidence[];
  dimensions: ControlCorrectionGoalSliceDimension[];
  pathContext: ControlCorrectionGoalSlicePathContext;
  privacyClasses: Record<'student' | 'teacher' | 'admin' | 'audit' | 'internal', AdaptiveLearnerStatePrivacyScope>;
}

export interface ControlCorrectionCapabilityTargetEvidence {
  target: AdaptiveLearningCapabilityTarget;
  observedEvidence: {
    state: 'missing' | 'low-confidence' | 'observed';
    knowledgeMastery: number | null;
    competencyScore: number | null;
    confidence: number;
    directEvidenceCount: number;
    supportingEvidenceCount: number;
    supportingEvidenceRefs?: MasteryEvidenceReference[];
    sourceCoverage?: MasteryTraceabilityEntry['sourceCoverage'];
    freshness?: MasteryTraceabilityEntry['freshness'];
    limitations?: string[];
    source: 'adaptive-learner-state';
    recommendationBias: 'starter-or-evidence-gathering' | 'targeted-practice';
  };
}

export interface ControlCorrectionGoalSlicePathContext {
  activePathId: string | null;
  activePathStatus: string | null;
  currentNodeId: string | null;
  terminalValidationState: string | null;
  recentPathIds: string[];
  noActivePath: boolean;
}

export interface UnsupportedAdaptiveGoalSlice {
  goalId: string;
  state: 'unsupported-goal';
  fallbackReason: 'unregistered-adaptive-goal';
  supportedGoalIds: AdaptiveLearnerStateGoalId[];
}

export interface AdaptiveLearnerState {
  userId: string;
  payloadVersion: string;
  generatedAt: string;
  authority: 'server-owned';
  roleScope: {
    role: AdaptiveLearnerStateRole;
    classId: string | null;
    privacyScopes: AdaptiveLearnerStatePrivacyScope[];
  };
  featureFlag: {
    name: typeof ADAPTIVE_LEARNER_STATE_FEATURE_FLAG;
    enabled: boolean;
    fallback: string;
  };
  clientHints: {
    received: boolean;
    authoritative: false;
    reason: 'client-hints-non-authoritative';
  };
  primaryPortrait: PortraitV2ProjectedPayload;
  primaryCompetencies: {
    authority: 'legacy-compatibility-only';
    source: 'latest-snapshot' | 'feature-cache' | 'fallback-empty';
    vector: CompetencyVector;
  };
  secondaryDimensions: Record<AdaptiveLearnerSecondaryDimension, {
    primaryDimension: CompetencyDimension;
    value: number;
    confidence: number;
    evidenceCount: number;
    source: string;
  }>;
  knowledgeMastery: {
    coverage: StudentEvidenceCoverageState;
    tags: Record<string, {
      posteriorMastery: number;
      confidence: number;
      evidenceCount: number;
      source: 'adaptive-assessment';
      algorithmVersion: string;
      lastUpdatedAt: string;
      freshness?: MasteryTraceabilityEntry['freshness'];
      supportingEvidenceRefs?: MasteryEvidenceReference[];
      sourceCoverage?: MasteryTraceabilityEntry['sourceCoverage'];
      limitations?: string[];
    }>;
  };
  masteryTraceability?: {
    knowledgeTargets: Record<string, MasteryTraceabilityEntry>;
    capabilityTargets: Record<string, MasteryTraceabilityEntry>;
  };
  resourcePreference: {
    preferredModalities: string[];
    sourceCounts: Record<string, number>;
    confidence: 'none' | 'low' | 'medium';
  };
  mediaAbsorption: {
    mediaFactCount: number;
    averageCompletion: number | null;
    confidence: 'none' | 'low' | 'medium';
  };
  pathContext: {
    activePathCount: number;
    bookmarkedPathCount: number;
    recentPathIds: string[];
    activeControlCorrectionPath: {
      state: 'active' | 'none';
      pathId: string | null;
      status: string | null;
      currentNodeId: string | null;
      terminalValidationState: string | null;
      lowConfidenceMarkers: string[];
    };
    statusMarkers: Array<'missing' | 'available'>;
  };
  risks: {
    riskLevel: string;
    activeFlags: Array<{
      type: string;
      severity: string;
      description: string;
      triggeredAt: string;
    }>;
  };
  assessmentState: {
    latestAbilityEstimate: {
      theta: number;
      confidenceInterval: [number, number];
      algorithmVersion: string;
      estimatedAt: string;
    } | null;
  };
  evidence: {
    readState: StudentEvidenceFeatureReadResult['state'];
    evidenceWindow: StudentEvidenceWindow;
    sourceCounts: Record<string, unknown>;
    sourceCoverage: Record<string, StudentEvidenceCoverageState>;
    confidence: {
      level: 'none' | 'low' | 'medium' | 'high';
      score: number;
      evidenceCount: number;
      sourceCompleteness: number;
    };
    statusMarkers: StudentEvidenceStatusMarker[];
  };
  prerequisiteFeatureGroups: {
    simulationArena: Record<string, unknown> | null;
    pathExecution: Record<string, unknown> | null;
  };
  goalSlices?: {
    controlCorrection?: ControlCorrectionGoalSlice;
    unsupported?: UnsupportedAdaptiveGoalSlice;
  };
  fieldContracts: typeof ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS;
  missingEvidence: string[];
}

interface AdaptiveLearnerStateDb extends PortraitV2SnapshotReadDb {
  studentEvidenceFeatureCache?: {
    findUnique?: (args: any) => Promise<any | null>;
  };
  studentCompetencySnapshot?: {
    findFirst?: (args: any) => Promise<any | null>;
  };
  studentProfileSummary?: {
    findUnique?: (args: any) => Promise<any | null>;
  };
  learningFact?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  arenaSubmission?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  evidenceOutbox?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  agentToolRun?: {
    findMany?: (args: any) => Promise<Array<any>>;
    findFirst?: (args: any) => Promise<unknown>;
    create?: (args: any) => Promise<unknown>;
    updateMany?: (args: any) => Promise<unknown>;
  };
  adaptiveMasteryUpdate?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  adaptiveAssessmentAbilityEstimate?: {
    findFirst?: (args: any) => Promise<any | null>;
  };
  studentRiskFlag?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
  learningPath?: {
    findMany?: (args: any) => Promise<Array<any>>;
  };
}

const SECONDARY_DIMENSION_PRIMARY: Record<AdaptiveLearnerSecondaryDimension, CompetencyDimension> = {
  conceptMastery: 'controlModeling',
  timeFrequencyTransfer: 'crossDomainTransfer',
  modelingReliability: 'controlModeling',
  tuningEfficiency: 'parameterDesign',
  constrainedOptimization: 'parameterDesign',
  solutionStability: 'engineeringDecision',
  crossModalTransfer: 'crossDomainTransfer',
  scenarioGeneralization: 'crossDomainTransfer',
  riskRecognition: 'engineeringDecision',
  constraintCompliance: 'engineeringDecision',
  explanationQuality: 'inquiryReflection',
  aiUseStrategy: 'inquiryReflection',
  reflectionDepth: 'inquiryReflection',
  pathExecution: 'selfDirectedLearning',
  persistence: 'selfDirectedLearning',
  remedialInitiative: 'selfDirectedLearning',
};

const CONTROL_CORRECTION_DIMENSION_PRIMARY: Record<ControlCorrectionDimensionId, CompetencyDimension> = {
  'time-domain-analysis': 'controlModeling',
  'root-locus-reasoning': 'parameterDesign',
  'frequency-domain-margin-analysis': 'crossDomainTransfer',
  'method-selection': 'engineeringDecision',
  'constraint-tradeoff': 'engineeringDecision',
  'simulation-validation': 'parameterDesign',
  'arena-transfer': 'crossDomainTransfer',
  reflection: 'inquiryReflection',
  'ai-collaboration': 'selfDirectedLearning',
};

const CONTROL_CORRECTION_DIMENSION_REQUIRED_SOURCES: Record<
  ControlCorrectionDimensionId,
  Array<keyof ControlCorrectionGoalSliceDimension['sourceCoverage']>
> = {
  'time-domain-analysis': ['assessment'],
  'root-locus-reasoning': ['assessment', 'simulation', 'arena'],
  'frequency-domain-margin-analysis': ['assessment'],
  'method-selection': ['assessment'],
  'constraint-tradeoff': ['assessment'],
  'simulation-validation': ['simulation'],
  'arena-transfer': ['arena'],
  reflection: ['reflection'],
  'ai-collaboration': ['aiCollaboration'],
};

const CONTROL_CORRECTION_PRIVACY: ControlCorrectionGoalSliceDimension['privacy'] = {
  score: 'student-visible',
  sourceCoverage: 'student-visible',
  confidence: 'student-visible',
  teacherExplanation: 'teacher-scoped',
  auditRefs: 'audit-only',
  rawPayloads: 'system-internal',
};

const CONTROL_CORRECTION_PRIVACY_CLASSES: ControlCorrectionGoalSlice['privacyClasses'] = {
  student: 'student-visible',
  teacher: 'teacher-scoped',
  admin: 'admin-scoped',
  audit: 'audit-only',
  internal: 'system-internal',
};

const CONTROL_CORRECTION_TARGET_LEVEL_MAPPING: Record<ControlCorrectionTargetLevel, string> = {
  foundation: 'recognizes canonical control-correction concepts with guided evidence',
  developing: 'applies corrective reasoning with partial multi-source evidence',
  proficient: 'selects and validates corrective methods across governed evidence',
  advanced: 'transfers corrective strategies across constrained tasks with robust validation',
};

const CONTROL_CORRECTION_DIMENSION_DEFINITIONS: AdaptiveGoalSliceDimensionDefinition[] =
  CONTROL_CORRECTION_GOAL_DIMENSIONS.map((id) => ({
    id,
    valueRange: '0-100',
    targetLevelMapping: CONTROL_CORRECTION_TARGET_LEVEL_MAPPING,
    sourceFamilies: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice.sourceFamilies,
    evidenceThreshold: 'dimension declares sufficient, partial, stale, or missing governed evidence',
    freshnessPolicy: 'current within governed learner-state evidence window, stale when sources age out, missing when no declared source is present',
    confidencePolicy: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice.confidencePolicy,
    privacy: CONTROL_CORRECTION_PRIVACY,
    fallbackReason: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice.fallbackReason,
  }));

export const ADAPTIVE_GOAL_SLICE_REGISTRY: Record<AdaptiveLearnerStateGoalId, AdaptiveGoalSliceDefinition> = {
  [CONTROL_CORRECTION_GOAL_ID]: {
    goalId: CONTROL_CORRECTION_GOAL_ID,
    displayLabel: 'Control Correction',
    shortLabel: 'Control Correction',
    payloadVersion: CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
    dimensions: CONTROL_CORRECTION_DIMENSION_DEFINITIONS,
    targetLevels: CONTROL_CORRECTION_TARGET_LEVELS,
    capabilityTargets: CONTROL_CORRECTION_CAPABILITY_TARGETS,
    evidenceSourceFamilies: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice.sourceFamilies,
    privacyClasses: CONTROL_CORRECTION_PRIVACY_CLASSES,
    confidencePolicy: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice.confidencePolicy,
    fieldFamilies: {
      pathContext: {
        ...ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.pathContext,
        valueRange: 'active path id/status/current node, terminal validation state, recent path references, no-active-path marker',
      },
      report: {
        ...ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice,
        valueRange: 'declared report-ready control-correction dimensions and metadata',
      },
      konling: {
        ...ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice,
        valueRange: 'declared Konling-readable control-correction dimensions and metadata',
      },
      grading: {
        ...ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS.controlCorrectionGoalSlice,
        valueRange: 'not declared for grading decisions',
        fallbackReason: 'grading-eligibility-not-declared',
      },
    },
    eligibility: {
      path: 'declared',
      report: 'declared',
      konling: 'declared',
      grading: 'not-declared',
    },
    validationFixtures: [
      'registered-control-correction-parity',
      'unknown-goal-unsupported',
      'undeclared-dimension-fail-closed',
      'path-context-preservation',
    ],
  },
};

const DEFAULT_EVIDENCE_WINDOW: StudentEvidenceWindow = {
  firstStartedAt: null,
  lastStartedAt: null,
  daysCovered: 0,
};

export function resolveAdaptiveGoalSliceDefinition(goal: string | null | undefined): AdaptiveGoalSliceDefinition | null {
  const normalizedGoal = normalizeRequestedGoal(goal);
  if (!normalizedGoal) return null;
  if (!Object.hasOwn(ADAPTIVE_GOAL_SLICE_REGISTRY, normalizedGoal)) {
    return null;
  }
  return ADAPTIVE_GOAL_SLICE_REGISTRY[normalizedGoal as AdaptiveLearnerStateGoalId];
}

export function isAdaptiveLearnerStateServiceEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED === 'true';
}

export async function readAdaptiveLearnerState(
  db: AdaptiveLearnerStateDb,
  input: AdaptiveLearnerStateInput,
): Promise<AdaptiveLearnerState> {
  const now = input.now ?? new Date();
  const requestedGoal = normalizeRequestedGoal(input.goal);
  const requestedGoalDefinition = resolveAdaptiveGoalSliceDefinition(requestedGoal);
  const shouldBuildControlCorrectionGoalSlice = requestedGoalDefinition?.goalId === CONTROL_CORRECTION_GOAL_ID;
  const featureRead = await readFeatureCache(db, input.userId, now);
  const featureCache = asRecord(featureRead.cache);
  const featureSnapshot = getObject(getObject(getObject(featureCache.features).approvedAggregates).latestSnapshot);
  const featureSimulationArena = getObject(getObject(featureCache.features).simulationArena);
  const featurePathExecution = getObject(getObject(featureCache.features).pathExecution);

  const [
    persistedPrimaryPortraitRead,
    latestSnapshot,
    profileSummary,
    facts,
    masteryUpdates,
    latestAbility,
    riskFlags,
    paths,
    activeControlCorrectionPaths,
    controlCorrectionFacts,
    controlCorrectionArenaSubmissions,
    controlCorrectionAgentToolRuns,
  ] = await Promise.all([
    readPortraitV2WithCompatibilityFallback(db, input.userId, portraitConsumerForInput(input), now),
    db.studentCompetencySnapshot?.findFirst?.({
      where: { userId: input.userId },
      orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
    }) ?? Promise.resolve(null),
    db.studentProfileSummary?.findUnique?.({
      where: { userId: input.userId },
    }) ?? Promise.resolve(null),
    db.learningFact?.findMany?.({
      where: { userId: input.userId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    }) ?? Promise.resolve([]),
    db.adaptiveMasteryUpdate?.findMany?.({
      where: { userId: input.userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    }) ?? Promise.resolve([]),
    db.adaptiveAssessmentAbilityEstimate?.findFirst?.({
      where: { userId: input.userId },
      orderBy: [{ estimatedAt: 'desc' }, { id: 'desc' }],
    }) ?? Promise.resolve(null),
    db.studentRiskFlag?.findMany?.({
      where: { userId: input.userId, isResolved: false },
      orderBy: { triggeredAt: 'desc' },
      take: 20,
    }) ?? Promise.resolve([]),
    db.learningPath?.findMany?.({
      where: { userId: input.userId },
      select: {
        id: true,
        goalId: true,
        pathStatus: true,
        currentNodeId: true,
        terminalValidation: true,
        lastExecutionMetadata: true,
        isBookmarked: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    }) ?? Promise.resolve([]),
    db.learningPath?.findMany?.({
      where: {
        userId: input.userId,
        goalId: CONTROL_CORRECTION_GOAL_ID,
        pathStatus: { in: ['active', 'fallback'] },
      },
      select: {
        id: true,
        goalId: true,
        pathStatus: true,
        currentNodeId: true,
        terminalValidation: true,
        lastExecutionMetadata: true,
        isBookmarked: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    }) ?? Promise.resolve([]),
    shouldBuildControlCorrectionGoalSlice
      ? readControlCorrectionLearningFacts(db, input.userId)
      : Promise.resolve([]),
    shouldBuildControlCorrectionGoalSlice
      ? db.arenaSubmission?.findMany?.({
          where: {
            userId: input.userId,
            valid: true,
            taskId: { in: [...CONTROL_CORRECTION_ARENA_TASK_ID_VALUES] },
          },
          include: {
            controllerArtifact: true,
            evaluationRun: true,
          },
          orderBy: { submittedAt: 'desc' },
          take: 200,
        }) ?? Promise.resolve([])
      : Promise.resolve([]),
    shouldBuildControlCorrectionGoalSlice
      ? db.agentToolRun?.findMany?.({
          where: {
            targetUserId: input.userId,
            courseId: { in: [...CONTROL_CORRECTION_COURSE_ID_VALUES] },
            status: { in: ['completed', 'succeeded', 'success'] },
          },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          take: 100,
        }) ?? Promise.resolve([])
      : Promise.resolve([]),
  ]);

  const controlCorrectionArenaSubmissionsWithWriteback = shouldBuildControlCorrectionGoalSlice
    ? await attachPersistedArenaWritebacks(db, controlCorrectionArenaSubmissions)
    : controlCorrectionArenaSubmissions;
  const {
    vector,
    source,
    compatibilitySourceFamily,
    compatibilitySnapshotId,
    compatibilitySnapshotAt,
  } = resolvePrimaryCompetencyVector(latestSnapshot, featureSnapshot, now);
  const primaryPortrait = persistedPrimaryPortraitRead.payload ?? projectPortraitV2ForConsumer(derivePortraitV2Compatibility({
    userId: input.userId,
    snapshotId: compatibilitySnapshotId,
    snapshotAt: compatibilitySnapshotAt,
    sourceFamily: compatibilitySourceFamily,
    vector,
    limitations: persistedPrimaryPortraitRead.limitations,
    now,
  }), portraitConsumerForInput(input), { now });
  const knowledgeMastery = buildKnowledgeMastery(masteryUpdates, now);
  const evidence = buildEvidenceSummary(featureRead, featureCache);
  const masteryTraceability = filterMasteryTraceabilityForRole(buildMasteryTraceability({
    knowledgeMastery,
    vector,
    facts: controlCorrectionFacts,
    arenaSubmissions: controlCorrectionArenaSubmissionsWithWriteback,
    agentToolRuns: controlCorrectionAgentToolRuns,
    featureRead,
    evidence,
    now,
  }), input.role, now);
  const secondaryDimensions = buildSecondaryDimensions(vector);
  const prerequisiteFeatureGroups = {
    simulationArena: Object.keys(featureSimulationArena).length > 0
      ? getObject(featureSimulationArena.allTime)
      : null,
    pathExecution: Object.keys(featurePathExecution).length > 0
      ? filterPathExecutionForRole(getObject(featurePathExecution.allTime), input.role)
      : null,
  };
  const missingEvidence = buildMissingEvidence({
    latestSnapshot,
    profileSummary,
    featureRead,
    masteryUpdates,
  });
  const goalSlices = buildAdaptiveGoalSlices({
    requestedGoal,
    requestedGoalDefinition,
    shouldBuildControlCorrectionGoalSlice,
    now,
    vector,
    evidence,
    knowledgeMastery,
    masteryTraceability,
    facts: controlCorrectionFacts,
    arenaSubmissions: controlCorrectionArenaSubmissionsWithWriteback,
    prerequisiteFeatureGroups,
    paths,
    activeControlCorrectionPath: activeControlCorrectionPaths.find(isControlCorrectionPathRound) ?? null,
  });

  return {
    userId: input.userId,
    payloadVersion: ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
    generatedAt: now.toISOString(),
    authority: 'server-owned',
    roleScope: {
      role: input.role,
      classId: input.classId ?? null,
      privacyScopes: privacyScopesForRole(input.role),
    },
    featureFlag: {
      name: ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
      enabled: isAdaptiveLearnerStateServiceEnabled(),
      fallback: 'legacy-profile-summary-and-recommendation-consumers',
    },
    clientHints: {
      received: Boolean(input.clientHints && Object.keys(input.clientHints).length > 0),
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    },
    primaryPortrait,
    primaryCompetencies: {
      authority: 'legacy-compatibility-only',
      source,
      vector,
    },
    secondaryDimensions,
    knowledgeMastery,
    masteryTraceability,
    resourcePreference: buildResourcePreference(facts),
    mediaAbsorption: buildMediaAbsorption(facts),
    pathContext: buildPathContext(paths, activeControlCorrectionPaths[0] ?? null),
    risks: buildRiskState(profileSummary, riskFlags, input.role),
    assessmentState: {
      latestAbilityEstimate: buildAbilityEstimate(latestAbility),
    },
    evidence,
    prerequisiteFeatureGroups,
    ...(goalSlices ? { goalSlices } : {}),
    fieldContracts: ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
    missingEvidence,
  };
}

function portraitConsumerForRole(role: AdaptiveLearnerStateRole): PortraitV2Consumer {
  if (role === 'admin') return 'admin';
  if (role === 'teacher') return 'reviewer';
  if (role === 'system') return 'planner';
  return 'student';
}

function portraitConsumerForInput(input: AdaptiveLearnerStateInput): PortraitV2Consumer {
  return input.portraitConsumer ?? portraitConsumerForRole(input.role);
}

async function readPortraitV2WithCompatibilityFallback(
  db: AdaptiveLearnerStateDb,
  userId: string,
  consumer: PortraitV2Consumer,
  now: Date,
): Promise<{ payload: PortraitV2ProjectedPayload | null; limitations: string[] }> {
  try {
    return {
      payload: await readLatestPortraitV2Snapshot(db, userId, consumer, { now }),
      limitations: [],
    };
  } catch (error) {
    if (!(error instanceof PortraitV2SnapshotValidationError)) throw error;
    return {
      payload: null,
      limitations: ['persisted-portrait-v2-invalid-or-incompatible'],
    };
  }
}

export async function readPathPlannerLearnerState(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<AdaptiveLearnerState> {
  return readAdaptiveLearnerState(db, {
    userId,
    role: 'system',
  });
}

async function readFeatureCache(
  db: AdaptiveLearnerStateDb,
  userId: string,
  now: Date,
): Promise<StudentEvidenceFeatureReadResult> {
  if (!db.studentEvidenceFeatureCache?.findUnique) {
    return {
      state: 'missing',
      cache: null,
      rawReadExceptions: ['audit', 'debug', 'drilldown', 'migration'],
    };
  }
  return readStudentEvidenceFeatures(db as Parameters<typeof readStudentEvidenceFeatures>[0], userId, { now });
}

async function attachPersistedArenaWritebacks(
  db: AdaptiveLearnerStateDb,
  submissions: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  const submissionIds = submissions
    .map((submission) => readString(submission.id))
    .filter((id): id is string => Boolean(id));
  if (!submissionIds.length || typeof db.evidenceOutbox?.findMany !== 'function') {
    return submissions;
  }

  const writebacks = await readArenaSubmissionEvidenceWritebacks(db, submissionIds, 'service');
  if (writebacks.size === 0) return submissions;
  return submissions.map((submission) => {
    const id = readString(submission.id);
    const evidenceWriteback = id ? writebacks.get(id) : null;
    return evidenceWriteback ? { ...submission, evidenceWriteback } : submission;
  });
}

function resolvePrimaryCompetencyVector(
  latestSnapshot: Record<string, unknown> | null,
  featureSnapshot: Record<string, unknown>,
  now: Date,
): {
  vector: CompetencyVector;
  source: AdaptiveLearnerState['primaryCompetencies']['source'];
  compatibilitySourceFamily: PortraitV2CompatibilitySourceFamily | null;
  compatibilitySnapshotId: string | null;
  compatibilitySnapshotAt: string;
} {
  const snapshotVector = latestSnapshot ? toCompetencyVector(latestSnapshot.competencyVector) : null;
  if (snapshotVector) {
    return {
      vector: snapshotVector,
      source: 'latest-snapshot',
      compatibilitySourceFamily: 'StudentCompetencySnapshot',
      compatibilitySnapshotId: readString(latestSnapshot?.id),
      compatibilitySnapshotAt: dateToIsoOrNull(latestSnapshot?.snapshotAt) ?? now.toISOString(),
    };
  }
  const cachedVector = toCompetencyVector(featureSnapshot.competencyVector);
  if (cachedVector) {
    return {
      vector: cachedVector,
      source: 'feature-cache',
      compatibilitySourceFamily: 'StudentEvidenceFeatureCache',
      compatibilitySnapshotId: null,
      compatibilitySnapshotAt: dateToIsoOrNull(featureSnapshot.snapshotAt) ?? now.toISOString(),
    };
  }
  return {
    vector: createEmptyCompetencyVector(),
    source: 'fallback-empty',
    compatibilitySourceFamily: null,
    compatibilitySnapshotId: null,
    compatibilitySnapshotAt: now.toISOString(),
  };
}

function buildSecondaryDimensions(vector: CompetencyVector): AdaptiveLearnerState['secondaryDimensions'] {
  return Object.fromEntries(
    Object.entries(SECONDARY_DIMENSION_PRIMARY).map(([dimension, primaryDimension]) => {
      const primary = vector[primaryDimension];
      return [dimension, {
        primaryDimension,
        value: round(primary.score),
        confidence: round(primary.confidence, 2),
        evidenceCount: primary.evidenceCount,
        source: 'primary-competency-derived',
      }];
    }),
  ) as AdaptiveLearnerState['secondaryDimensions'];
}

function buildAdaptiveGoalSlices(input: {
  requestedGoal: string | null;
  requestedGoalDefinition: AdaptiveGoalSliceDefinition | null;
  shouldBuildControlCorrectionGoalSlice: boolean;
  now: Date;
  vector: CompetencyVector;
  evidence: AdaptiveLearnerState['evidence'];
  knowledgeMastery: AdaptiveLearnerState['knowledgeMastery'];
  masteryTraceability: AdaptiveLearnerState['masteryTraceability'];
  facts: Array<Record<string, unknown>>;
  arenaSubmissions: Array<Record<string, unknown>>;
  prerequisiteFeatureGroups: AdaptiveLearnerState['prerequisiteFeatureGroups'];
  paths: Array<Record<string, unknown>>;
  activeControlCorrectionPath: Record<string, unknown> | null;
}): AdaptiveLearnerState['goalSlices'] | undefined {
  if (!input.requestedGoal) {
    return undefined;
  }

  if (!input.requestedGoalDefinition) {
    return {
      unsupported: {
        goalId: input.requestedGoal,
        state: 'unsupported-goal',
        fallbackReason: 'unregistered-adaptive-goal',
        supportedGoalIds: Object.keys(ADAPTIVE_GOAL_SLICE_REGISTRY) as AdaptiveLearnerStateGoalId[],
      },
    };
  }

  if (input.shouldBuildControlCorrectionGoalSlice) {
    return {
      controlCorrection: buildControlCorrectionGoalSlice({
        now: input.now,
        vector: input.vector,
        evidence: input.evidence,
        knowledgeMastery: input.knowledgeMastery,
        masteryTraceability: input.masteryTraceability,
        facts: input.facts,
        arenaSubmissions: input.arenaSubmissions,
        prerequisiteFeatureGroups: input.prerequisiteFeatureGroups,
        paths: input.paths,
        activeControlCorrectionPath: input.activeControlCorrectionPath,
      }),
    };
  }

  return undefined;
}

function buildControlCorrectionGoalSlice(input: {
  now: Date;
  vector: CompetencyVector;
  evidence: AdaptiveLearnerState['evidence'];
  knowledgeMastery: AdaptiveLearnerState['knowledgeMastery'];
  masteryTraceability: AdaptiveLearnerState['masteryTraceability'];
  facts: Array<Record<string, unknown>>;
  arenaSubmissions: Array<Record<string, unknown>>;
  prerequisiteFeatureGroups: AdaptiveLearnerState['prerequisiteFeatureGroups'];
  paths: Array<Record<string, unknown>>;
  activeControlCorrectionPath: Record<string, unknown> | null;
}): ControlCorrectionGoalSlice {
  const simulationArena = getObject(input.prerequisiteFeatureGroups.simulationArena);
  const sourceEvidence = buildControlCorrectionSourceEvidence({
    facts: input.facts,
    arenaSubmissions: input.arenaSubmissions,
    masteryTraceability: input.masteryTraceability,
    simulationArena,
  });
  const dimensions = CONTROL_CORRECTION_GOAL_DIMENSIONS.map((id) => {
    const primary = input.vector[CONTROL_CORRECTION_DIMENSION_PRIMARY[id]];
    const sourceCoverage = buildControlCorrectionDimensionSourceCoverage(id, sourceEvidence);
    const evidenceCount = buildControlCorrectionDimensionEvidenceCount(id, primary.evidenceCount, sourceEvidence);
    const evidenceProvenance = buildControlCorrectionEvidenceProvenance(sourceEvidence);
    const fallbackMarkers = buildControlCorrectionFallbackMarkers(
      id,
      sourceCoverage,
      evidenceProvenance,
      sourceEvidence.simulationArenaQualityMarkers,
      input.evidence.statusMarkers,
      input.evidence.readState,
    );
    const confidence = buildControlCorrectionConfidence({
      id,
      baseScore: primary.confidence,
      evidenceCount,
      sourceCoverage,
      fallbackMarkers,
    });

    return {
      id,
      targetLevel: controlCorrectionTargetLevel(primary.score),
      score: round(primary.score),
      sourceCoverage,
      evidenceCount: confidence.evidenceCount,
      freshness: controlCorrectionFreshness(confidence.evidenceCount, fallbackMarkers, input.evidence.statusMarkers),
      evidenceProvenance,
      confidence,
      privacy: CONTROL_CORRECTION_PRIVACY,
      fallbackMarkers,
    };
  });

  const slice: ControlCorrectionGoalSlice = {
    goalId: CONTROL_CORRECTION_GOAL_ID,
    payloadVersion: CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
    generatedAt: input.now.toISOString(),
    targetLevels: CONTROL_CORRECTION_TARGET_LEVELS,
    capabilityTargets: buildControlCorrectionCapabilityTargets(
      input.knowledgeMastery,
      input.masteryTraceability,
      input.vector,
      sourceEvidence,
    ),
    dimensions,
    pathContext: buildControlCorrectionPathContext(input.paths, input.activeControlCorrectionPath),
    privacyClasses: CONTROL_CORRECTION_PRIVACY_CLASSES,
  };
  validateControlCorrectionGoalSliceContract(slice);
  return slice;
}

function buildControlCorrectionCapabilityTargets(
  knowledgeMastery: AdaptiveLearnerState['knowledgeMastery'],
  masteryTraceability: AdaptiveLearnerState['masteryTraceability'],
  vector: CompetencyVector,
  sourceEvidence: ControlCorrectionSourceEvidence,
): ControlCorrectionCapabilityTargetEvidence[] {
  return CONTROL_CORRECTION_CAPABILITY_TARGETS.map((target) => {
    const knowledge = knowledgeMastery.tags[target.knowledgeNodeRef];
    const traceability = masteryTraceability?.capabilityTargets[target.id];
    const competencies = target.competencyDimensions
      .map((dimension) => vector[dimension as CompetencyDimension])
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const competencyScore = competencies.length > 0
      ? round(competencies.reduce((sum, competency) => sum + competency.score, 0) / competencies.length)
      : null;
    const knowledgeEvidenceCount = knowledge?.evidenceCount ?? 0;
    const observableEvidenceCount = countControlCorrectionCapabilityObservableEvidence(target, sourceEvidence);
    const traceabilityRefs = traceability?.supportingEvidenceRefs ?? [];
    const agentToolEvidenceCount = traceabilityRefs.filter((ref) => ref.sourceType === 'AgentToolRun').length;
    const directEvidenceCount = knowledgeEvidenceCount + observableEvidenceCount + agentToolEvidenceCount;
    const observableEvidenceConfidence = controlCorrectionCapabilityObservableEvidenceConfidence(target, observableEvidenceCount);
    const agentToolEvidenceConfidence = agentToolEvidenceCount > 0 ? confidenceForVisibleRefs(
      traceabilityRefs.filter((ref) => ref.sourceType === 'AgentToolRun'),
      traceability?.confidence ?? 0.6,
    ) : 0;
    const directConfidence = Math.max(knowledge?.confidence ?? 0, observableEvidenceConfidence, agentToolEvidenceConfidence);
    const supportingEvidenceCount = Math.max(0, ...competencies.map((competency) => competency.evidenceCount));
    const state = directEvidenceCount === 0
      ? 'missing'
      : directConfidence < 0.5
        ? 'low-confidence'
        : 'observed';
    return {
      target,
      observedEvidence: {
        state,
        knowledgeMastery: knowledge?.posteriorMastery ?? null,
        competencyScore,
        confidence: round(directConfidence, 2),
        directEvidenceCount,
        supportingEvidenceCount,
        supportingEvidenceRefs: traceability?.supportingEvidenceRefs ?? [],
        sourceCoverage: traceability?.sourceCoverage ?? emptyMasterySourceCoverage(),
        freshness: traceability?.freshness ?? 'missing',
        limitations: traceability?.limitations ?? ['missing-governed-evidence'],
        source: 'adaptive-learner-state',
        recommendationBias: state === 'observed' ? 'targeted-practice' : 'starter-or-evidence-gathering',
      },
    };
  });
}

function countControlCorrectionCapabilityObservableEvidence(
  target: AdaptiveLearningCapabilityTarget,
  sourceEvidence: ControlCorrectionSourceEvidence,
): number {
  if (target.observableEvidenceType === 'question') {
    return sourceEvidence.assessmentCount;
  }
  if (target.observableEvidenceType === 'simulation-run') {
    return sourceEvidence.simulationCount;
  }
  if (target.observableEvidenceType === 'arena-official-evaluation') {
    return sourceEvidence.officialArenaCount;
  }
  if (target.observableEvidenceType === 'reflection') {
    return sourceEvidence.reflectionCount;
  }
  if (target.observableEvidenceType === 'agent-interaction') {
    return sourceEvidence.aiCollaborationCount;
  }
  return 0;
}

function controlCorrectionCapabilityObservableEvidenceConfidence(
  target: AdaptiveLearningCapabilityTarget,
  evidenceCount: number,
): number {
  if (evidenceCount === 0) {
    return 0;
  }
  if (target.observableEvidenceType === 'arena-official-evaluation') {
    return 0.7;
  }
  return 0.45;
}

export function validateControlCorrectionGoalSliceContract(value: unknown): asserts value is ControlCorrectionGoalSlice {
  const slice = getObject(value);
  const dimensions = Array.isArray(slice.dimensions) ? slice.dimensions : [];
  if (slice.goalId !== CONTROL_CORRECTION_GOAL_ID) {
    throw new Error('control-correction goal slice missing canonical goal id');
  }
  if (slice.payloadVersion !== CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION) {
    throw new Error('control-correction goal slice missing payload version');
  }
  if (!sameStringSet(arrayOfStrings(slice.targetLevels), CONTROL_CORRECTION_TARGET_LEVELS)) {
    throw new Error('control-correction goal slice missing target levels');
  }
  const capabilityTargets = Array.isArray(slice.capabilityTargets) ? slice.capabilityTargets : [];
  if (capabilityTargets.length !== CONTROL_CORRECTION_CAPABILITY_TARGETS.length) {
    throw new Error('control-correction goal slice missing capability targets');
  }
  const capabilityTargetIds = capabilityTargets
    .map((targetValue) => readString(getObject(getObject(targetValue).target).id))
    .filter((id): id is string => Boolean(id));
  if (!sameStringSet(capabilityTargetIds, CONTROL_CORRECTION_CAPABILITY_TARGETS.map((target) => target.id))) {
    throw new Error('control-correction goal slice missing capability targets');
  }
  const registeredCapabilityTargets = new Map(CONTROL_CORRECTION_CAPABILITY_TARGETS.map((target) => [target.id, target]));
  for (const targetValue of capabilityTargets) {
    const item = getObject(targetValue);
    const target = getObject(item.target);
    const observedEvidence = getObject(item.observedEvidence);
    const registeredTarget = registeredCapabilityTargets.get(readString(target.id) ?? '');
    if (
      typeof target.id !== 'string' ||
      typeof target.knowledgeNodeRef !== 'string' ||
      typeof target.capabilityLevel !== 'string' ||
      typeof target.behaviorVerb !== 'string' ||
      !Array.isArray(target.successCriteria) ||
      typeof target.observableEvidenceType !== 'string' ||
      typeof target.evaluationMethod !== 'string'
    ) {
      throw new Error('control-correction capability target missing required metadata');
    }
    if (
      !registeredTarget ||
      target.knowledgeNodeRef !== registeredTarget.knowledgeNodeRef ||
      target.capabilityLevel !== registeredTarget.capabilityLevel ||
      target.observableEvidenceType !== registeredTarget.observableEvidenceType ||
      target.goalSliceId !== registeredTarget.goalSliceId
    ) {
      throw new Error('control-correction goal slice missing capability targets');
    }
    if (
      observedEvidence.state !== 'missing' &&
      observedEvidence.state !== 'low-confidence' &&
      observedEvidence.state !== 'observed'
    ) {
      throw new Error('control-correction capability target missing observed evidence state');
    }
    if (observedEvidence.state === 'missing' && observedEvidence.recommendationBias !== 'starter-or-evidence-gathering') {
      throw new Error('control-correction capability target overstates missing evidence');
    }
  }
  const privacyClasses = getObject(slice.privacyClasses);
  if (
    privacyClasses.student !== 'student-visible' ||
    privacyClasses.teacher !== 'teacher-scoped' ||
    privacyClasses.admin !== 'admin-scoped' ||
    privacyClasses.audit !== 'audit-only' ||
    privacyClasses.internal !== 'system-internal'
  ) {
    throw new Error('control-correction goal slice missing privacy classes');
  }
  if (dimensions.length !== CONTROL_CORRECTION_GOAL_DIMENSIONS.length) {
    throw new Error('control-correction goal slice missing required dimensions');
  }
  const pathContext = getObject(slice.pathContext);
  if (
    typeof pathContext.noActivePath !== 'boolean' ||
    !Array.isArray(pathContext.recentPathIds) ||
    pathContext.recentPathIds.some((id) => typeof id !== 'string')
  ) {
    throw new Error('control-correction goal slice missing path context metadata');
  }
  const dimensionIds = dimensions.map((dimension) => readString(getObject(dimension).id)).filter((id): id is string => Boolean(id));
  if (!sameStringSet(dimensionIds, CONTROL_CORRECTION_GOAL_DIMENSIONS)) {
    throw new Error('control-correction goal slice missing required dimensions');
  }
  for (const dimensionValue of dimensions) {
    const dimension = getObject(dimensionValue);
    if (!dimension.confidence) {
      throw new Error('control-correction dimension missing confidence metadata');
    }
    if (!dimension.privacy) {
      throw new Error('control-correction dimension missing privacy metadata');
    }
    const confidence = getObject(dimension.confidence);
    const privacy = getObject(dimension.privacy);
    const sourceCoverage = getObject(dimension.sourceCoverage);
    const freshness = readString(dimension.freshness);
    if (
      !isControlCorrectionConfidenceState(confidence.state) ||
      !Number.isFinite(confidence.score) ||
      !Number.isFinite(confidence.evidenceCount) ||
      !Number.isFinite(confidence.sourceCompleteness)
    ) {
      throw new Error('control-correction dimension missing confidence metadata');
    }
    if (
      !isCoverageState(sourceCoverage.assessment) ||
      !isCoverageState(sourceCoverage.simulation) ||
      !isCoverageState(sourceCoverage.arena) ||
      !isCoverageState(sourceCoverage.reflection) ||
      !isCoverageState(sourceCoverage.aiCollaboration)
    ) {
      throw new Error('control-correction dimension missing source coverage metadata');
    }
    if (freshness !== 'current' && freshness !== 'partial' && freshness !== 'stale' && freshness !== 'missing') {
      throw new Error('control-correction dimension missing freshness metadata');
    }
    if (privacy.score !== 'student-visible' || privacy.sourceCoverage !== 'student-visible' || privacy.confidence !== 'student-visible') {
      throw new Error('control-correction dimension missing privacy metadata');
    }
    if (privacy.teacherExplanation !== 'teacher-scoped' || privacy.auditRefs !== 'audit-only' || privacy.rawPayloads !== 'system-internal') {
      throw new Error('control-correction dimension missing privacy metadata');
    }
  }
}

function buildKnowledgeMastery(rows: Array<Record<string, unknown>>, now: Date): AdaptiveLearnerState['knowledgeMastery'] {
  const tags: AdaptiveLearnerState['knowledgeMastery']['tags'] = {};
  for (const row of rows) {
    const knowledgeTag = readString(row.knowledgeTag);
    if (!knowledgeTag || tags[knowledgeTag]) {
      continue;
    }
    const confidence = round(numberValue(row.confidence), 2);
    const evidenceRef = masteryEvidenceRef(
      'AdaptiveMasteryUpdate',
      readString(row.id),
      row.createdAt,
      'student-visible',
      confidenceLevel(confidence),
    );
    const limitations = [
      ...(evidenceRef ? [] : ['missing-privacy-safe-evidence-ref']),
      ...(evidenceRef && isStaleEvidenceRef(evidenceRef, now) ? ['stale-evidence'] : []),
      ...(confidence < 0.45 ? ['low-confidence'] : []),
    ];
    tags[knowledgeTag] = {
      posteriorMastery: round(numberValue(row.posteriorMastery), 2),
      confidence,
      evidenceCount: 1,
      source: 'adaptive-assessment',
      algorithmVersion: readString(row.algorithmVersion) ?? 'unknown',
      lastUpdatedAt: dateToIso(row.createdAt),
      freshness: freshnessForMastery(evidenceRef ? [evidenceRef] : [], limitations),
      supportingEvidenceRefs: evidenceRef ? [evidenceRef] : [],
      sourceCoverage: {
        ...emptyMasterySourceCoverage(),
        AdaptiveMasteryUpdate: 'available',
      },
      limitations: unique(limitations),
    };
  }
  return {
    coverage: Object.keys(tags).length > 0 ? 'available' : 'missing',
    tags,
  };
}

function buildMasteryTraceability(input: {
  knowledgeMastery: AdaptiveLearnerState['knowledgeMastery'];
  vector: CompetencyVector;
  facts: Array<Record<string, unknown>>;
  arenaSubmissions: Array<Record<string, unknown>>;
  agentToolRuns: Array<Record<string, unknown>>;
  featureRead: StudentEvidenceFeatureReadResult;
  evidence: AdaptiveLearnerState['evidence'];
  now: Date;
}): NonNullable<AdaptiveLearnerState['masteryTraceability']> {
  const knowledgeTargets = Object.fromEntries(Object.entries(input.knowledgeMastery.tags).map(([targetId, mastery]) => [
    targetId,
    {
      targetId,
      targetKind: 'knowledge' as const,
      masteryLevel: mastery.posteriorMastery,
      confidence: mastery.confidence,
      freshness: mastery.freshness ?? 'missing',
      supportingEvidenceRefs: mastery.supportingEvidenceRefs ?? [],
      sourceCoverage: mastery.sourceCoverage ?? emptyMasterySourceCoverage(),
      limitations: mastery.limitations ?? ['missing-governed-evidence'],
    },
  ]));

  const capabilityTargets = Object.fromEntries(CONTROL_CORRECTION_CAPABILITY_TARGETS.map((target) => {
    const refs = refsForCapabilityTarget(target, input);
    const competencies = target.competencyDimensions
      .map((dimension) => input.vector[dimension as CompetencyDimension])
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const score = competencies.length > 0
      ? round(competencies.reduce((sum, competency) => sum + competency.score, 0) / competencies.length)
      : null;
    const confidence = refs.length === 0
      ? 0
      : round(Math.max(...competencies.map((competency) => competency.confidence), 0.45), 2);
  const sourceCoverage = sourceCoverageForRefs(refs);
    const limitations = buildMasteryLimitations({
      target,
      refs,
      sourceCoverage,
      featureRead: input.featureRead,
      evidenceStatusMarkers: input.evidence.statusMarkers,
      evidenceConfidenceLevel: input.evidence.confidence.level,
      now: input.now,
    });

    return [target.id, {
      targetId: target.id,
      targetKind: 'capability' as const,
      masteryLevel: score,
      confidence,
      freshness: freshnessForMastery(refs, limitations),
      supportingEvidenceRefs: refs,
      sourceCoverage,
      limitations,
    }];
  }));

  return { knowledgeTargets, capabilityTargets };
}

function filterMasteryTraceabilityForRole(
  traceability: NonNullable<AdaptiveLearnerState['masteryTraceability']>,
  role: AdaptiveLearnerStateRole,
  now: Date,
): NonNullable<AdaptiveLearnerState['masteryTraceability']> {
  const allowedScopes = new Set(privacyScopesForRole(role));
  return {
    knowledgeTargets: filterTraceabilityEntries(traceability.knowledgeTargets, allowedScopes, now),
    capabilityTargets: filterTraceabilityEntries(traceability.capabilityTargets, allowedScopes, now),
  };
}

function filterTraceabilityEntries(
  entries: Record<string, MasteryTraceabilityEntry>,
  allowedScopes: Set<AdaptiveLearnerStatePrivacyScope>,
  now: Date,
): Record<string, MasteryTraceabilityEntry> {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => {
    const refs = entry.supportingEvidenceRefs.filter((ref) => allowedScopes.has(ref.privacyLevel));
    const limitations = refs.length === entry.supportingEvidenceRefs.length
      ? entry.limitations
      : buildRoleFilteredMasteryLimitations(entry.limitations, refs, now);
    return [id, {
      ...entry,
      masteryLevel: refs.length === 0 ? null : entry.masteryLevel,
      confidence: confidenceForVisibleRefs(refs, entry.confidence),
      supportingEvidenceRefs: refs,
      sourceCoverage: sourceCoverageForRefs(refs),
      freshness: freshnessForMastery(refs, limitations),
      limitations,
    }];
  }));
}

function buildRoleFilteredMasteryLimitations(
  limitations: string[],
  refs: MasteryEvidenceReference[],
  now: Date,
): string[] {
  return unique([
    ...limitations.filter((limitation) => (
      limitation !== 'stale-evidence' &&
      limitation !== 'missing-governed-evidence' &&
      limitation !== 'low-confidence-source' &&
      limitation !== 'restricted-evidence-hidden'
    )),
    ...(refs.length === 0 ? ['missing-governed-evidence'] : []),
    ...(refs.some((ref) => ref.confidence === 'low') ? ['low-confidence-source'] : []),
    ...(refs.some((ref) => isStaleEvidenceRef(ref, now)) ? ['stale-evidence'] : []),
    'restricted-evidence-hidden',
  ]);
}

function refsForCapabilityTarget(
  target: AdaptiveLearningCapabilityTarget,
  input: {
    facts: Array<Record<string, unknown>>;
    arenaSubmissions: Array<Record<string, unknown>>;
    agentToolRuns: Array<Record<string, unknown>>;
    featureRead: StudentEvidenceFeatureReadResult;
  },
): MasteryEvidenceReference[] {
  const featureRefs = refsFromFeatureCache(target, input.featureRead);
  const agentToolRunRefs = refsFromAgentToolRunsForTarget(input.agentToolRuns, target);
  if (target.observableEvidenceType === 'question') {
    return [...refsFromFacts(input.facts, ['assessment']), ...agentToolRunRefs, ...featureRefs];
  }
  if (target.observableEvidenceType === 'simulation-run') {
    return [...refsFromFacts(input.facts, ['simulation']), ...agentToolRunRefs, ...featureRefs];
  }
  if (target.observableEvidenceType === 'arena-official-evaluation') {
    return [
      ...input.arenaSubmissions
        .filter(isOfficialControlCorrectionArenaSubmission)
        .map((submission) => masteryEvidenceRef('ArenaSubmission', readString(submission.id), submission.submittedAt, 'student-visible', 'high'))
        .filter((ref): ref is MasteryEvidenceReference => Boolean(ref)),
      ...agentToolRunRefs,
      ...featureRefs,
    ];
  }
  if (target.observableEvidenceType === 'reflection') {
    return [...refsFromFacts(input.facts, ['reflection']), ...agentToolRunRefs, ...featureRefs];
  }
  if (target.observableEvidenceType === 'agent-interaction') {
    return [
      ...refsFromFacts(input.facts, ['ai', 'ai-collaboration', 'konling']),
      ...agentToolRunRefs,
      ...featureRefs,
    ].filter((ref): ref is MasteryEvidenceReference => Boolean(ref));
  }
  return [...agentToolRunRefs, ...featureRefs];
}

function refsFromAgentToolRunsForTarget(
  agentToolRuns: Array<Record<string, unknown>>,
  target: AdaptiveLearningCapabilityTarget,
): MasteryEvidenceReference[] {
  return agentToolRuns
    .filter(isAcceptedAgentToolRun)
    .filter((run) => agentToolRunTargetsCapability(run, target))
    .map((run) => masteryEvidenceRef('AgentToolRun', readString(run.id), run.completedAt ?? run.updatedAt ?? run.createdAt, 'teacher-scoped', 'medium'))
    .filter((ref): ref is MasteryEvidenceReference => Boolean(ref));
}

function refsFromFeatureCache(
  target: AdaptiveLearningCapabilityTarget,
  featureRead: StudentEvidenceFeatureReadResult,
): MasteryEvidenceReference[] {
  if (!featureRead.cache || !target.learnerStateFeatureGroups?.includes('pathExecution')) {
    return [];
  }
  const cache = asRecord(featureRead.cache);
  const cacheId = readString(cache.id);
  const pathExecution = getObject(getObject(getObject(cache.features).pathExecution).allTime);
  const sourceReferences = Array.isArray(pathExecution.sourceReferences) ? pathExecution.sourceReferences : [];
  return sourceReferences
    .filter((entry) => pathExecutionReferenceMatchesCapability(getObject(entry), target))
    .map((entry) => {
      const reference = getObject(entry);
      const sourceId = readString(reference.sourceId);
      return masteryEvidenceRef(
        'StudentEvidenceFeatureCache',
        cacheId && sourceId ? `${cacheId}:${sourceId}` : cacheId ?? sourceId,
        reference.occurredAt,
        readString(reference.privacyLevel) === 'teacher-scoped' ? 'teacher-scoped' : 'student-visible',
        confidenceLevelFromString(readString(reference.confidence)),
      );
    })
    .filter((ref): ref is MasteryEvidenceReference => Boolean(ref));
}

function pathExecutionReferenceMatchesCapability(
  reference: Record<string, unknown>,
  target: AdaptiveLearningCapabilityTarget,
): boolean {
  const status = readString(reference.status);
  const terminalValidationState = readString(reference.terminalValidationState);
  const completed = status === 'completed' ||
    status === 'success' ||
    status === 'validated' ||
    terminalValidationState === 'completed';
  if (!completed) return false;
  if (!pathExecutionReferenceMatchesGoal(reference, target)) return false;
  const resourceType = readString(reference.resourceType);
  if (target.observableEvidenceType === 'simulation-run') {
    return resourceType === 'simulation' || resourceType === 'control_workbench';
  }
  if (target.observableEvidenceType === 'arena-official-evaluation') {
    return resourceType === 'arena_task';
  }
  if (target.observableEvidenceType === 'question') {
    return resourceType === 'quiz' || resourceType === 'adaptive_quiz' || resourceType === 'checkpoint';
  }
  if (target.observableEvidenceType === 'reflection') {
    return resourceType === 'reflection';
  }
  if (target.observableEvidenceType === 'agent-interaction') {
    return resourceType === 'ai_intervention' || resourceType === 'konling';
  }
  return false;
}

function pathExecutionReferenceMatchesGoal(
  reference: Record<string, unknown>,
  target: AdaptiveLearningCapabilityTarget,
): boolean {
  const goalId = readString(reference.goalId ?? reference.goal);
  if (goalId !== target.goalSliceId) return false;
  const goalSliceId = readString(reference.goalSliceId);
  if (goalSliceId !== null && goalSliceId !== target.goalSliceId) return false;
  if (pathExecutionReferenceHasStructuredTarget(reference)) {
    return structuredContainerTargetsCapability(reference, target);
  }
  return true;
}

function pathExecutionReferenceHasStructuredTarget(reference: Record<string, unknown>): boolean {
  return [
    reference.capabilityTargetRef,
    reference.capabilityTargetRefs,
    reference.capabilityTargetId,
    reference.capabilityTargetIds,
    reference.targetCapabilityId,
    reference.targetCapabilityIds,
    reference.knowledgeNodeRef,
    reference.knowledgeNodeRefs,
    reference.knowledgeTag,
    reference.knowledgeTags,
  ].some((value) => typeof value === 'string' || Array.isArray(value));
}

function refsFromFacts(facts: Array<Record<string, unknown>>, modalities: string[]): MasteryEvidenceReference[] {
  return facts
    .filter((fact) => {
      const modality = factTypeToModality(readString(fact.factType));
      if (!modality || !modalities.includes(modality)) return false;
      if (modality === 'ai' || modality === 'ai-collaboration' || modality === 'konling') {
        return isGovernedAiLearningFact(fact);
      }
      return true;
    })
    .map((fact) => masteryEvidenceRef('LearningFact', readString(fact.id), fact.startedAt, 'student-visible', confidenceFromFact(fact)))
    .filter((ref): ref is MasteryEvidenceReference => Boolean(ref));
}

function masteryEvidenceRef(
  sourceType: MasteryEvidenceSourceType,
  sourceId: string | null,
  evidenceAt: unknown,
  privacyLevel: MasteryEvidenceReference['privacyLevel'],
  confidence: MasteryEvidenceReference['confidence'],
): MasteryEvidenceReference | null {
  if (!sourceId) return null;
  return {
    sourceType,
    sourceId,
    evidenceAt: dateToIsoOrNull(evidenceAt),
    privacyLevel,
    confidence,
  };
}

function emptyMasterySourceCoverage(): MasteryTraceabilityEntry['sourceCoverage'] {
  return {
    AdaptiveMasteryUpdate: 'missing',
    LearningFact: 'missing',
    ArenaSubmission: 'missing',
    AgentToolRun: 'missing',
    StudentEvidenceFeatureCache: 'missing',
  };
}

function sourceCoverageForRefs(refs: MasteryEvidenceReference[]): MasteryTraceabilityEntry['sourceCoverage'] {
  const coverage = emptyMasterySourceCoverage();
  for (const ref of refs) {
    coverage[ref.sourceType] = 'available';
  }
  return coverage;
}

function buildMasteryLimitations(input: {
  target: AdaptiveLearningCapabilityTarget;
  refs: MasteryEvidenceReference[];
  sourceCoverage: MasteryTraceabilityEntry['sourceCoverage'];
  featureRead: StudentEvidenceFeatureReadResult;
  evidenceStatusMarkers: StudentEvidenceStatusMarker[];
  evidenceConfidenceLevel: AdaptiveLearnerState['evidence']['confidence']['level'];
  now: Date;
}): string[] {
  const limitations: string[] = [];
  if (input.refs.length === 0) limitations.push('missing-governed-evidence');
  if (input.featureRead.state === 'missing') limitations.push('missing-feature-cache');
  if (input.featureRead.state === 'stale' || input.evidenceStatusMarkers.includes('stale')) limitations.push('stale-evidence');
  if (input.evidenceStatusMarkers.includes('partial')) limitations.push('partial-evidence');
  if (input.evidenceStatusMarkers.includes('missing-source')) limitations.push('missing-source');
  if (input.evidenceConfidenceLevel === 'none' || input.evidenceConfidenceLevel === 'low') limitations.push('low-confidence');
  if (input.refs.some((ref) => ref.confidence === 'low')) limitations.push('low-confidence-source');
  if (
    input.target.observableEvidenceType === 'arena-official-evaluation' &&
    input.sourceCoverage.ArenaSubmission === 'missing'
  ) {
    limitations.push('non-official-or-preview-only-evidence');
  }
  if (input.refs.some((ref) => isStaleEvidenceRef(ref, input.now))) limitations.push('stale-evidence');
  return unique(limitations);
}

function freshnessForMastery(
  refs: MasteryEvidenceReference[],
  limitations: string[],
): MasteryTraceabilityEntry['freshness'] {
  if (refs.length === 0) return 'missing';
  if (limitations.includes('stale-evidence')) return 'stale';
  if (limitations.some((limitation) => limitation !== 'restricted-evidence-hidden')) return 'partial';
  return 'current';
}

function confidenceFromFact(fact: Record<string, unknown>): MasteryEvidenceReference['confidence'] {
  return confidenceLevel(finiteNumber(fact.score) ?? (readString(fact.outcome) === 'success' ? 0.8 : 0.45));
}

function confidenceForVisibleRefs(refs: MasteryEvidenceReference[], fallback: number): number {
  if (refs.length === 0) return 0;
  const refConfidence = Math.max(...refs.map((ref) => confidenceScoreFromReference(ref.confidence)));
  return round(Math.min(fallback, refConfidence), 2);
}

function confidenceScoreFromReference(value: MasteryEvidenceReference['confidence']): number {
  if (value === 'high') return 0.85;
  if (value === 'medium') return 0.6;
  if (value === 'low') return 0.35;
  return 0.45;
}

function isGovernedAiLearningFact(fact: Record<string, unknown>): boolean {
  const context = getObject(fact.contextJson);
  const agentTool = getObject(context.agentTool);
  const agentToolGovernance = getObject(agentTool.governanceContext);
  const interventionOutcome = getObject(context.interventionOutcome);
  const evidenceSummary = getObject(context.evidenceSummary);
  return Boolean(
    context.materializedEvidence === true ||
    context.verifiedCitationSummary === true ||
    evidenceSummary.materialized === true ||
    evidenceSummary.verifiedCitations === true ||
    readString(evidenceSummary.reviewerState) === 'approved' ||
    readString(evidenceSummary.reviewerState) === 'auto_approved' ||
    interventionOutcome.approved === true ||
    readString(interventionOutcome.approvalState) === 'approved' ||
    readString(agentTool.reviewerState) === 'approved' ||
    readString(agentTool.reviewerState) === 'auto_approved' ||
    readString(agentToolGovernance.reviewerState) === 'approved' ||
    readString(agentToolGovernance.reviewerState) === 'auto_approved' ||
    readString(context.reviewerState) === 'approved' ||
    readString(context.reviewerState) === 'auto_approved',
  );
}

function confidenceLevel(value: number): MasteryEvidenceReference['confidence'] {
  if (!Number.isFinite(value)) return 'unknown';
  if (value >= 0.7) return 'high';
  if (value >= 0.45) return 'medium';
  return 'low';
}

function confidenceLevelFromString(value: string | null): MasteryEvidenceReference['confidence'] {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'unknown') {
    return value;
  }
  return 'unknown';
}

function isAcceptedAgentToolRun(run: Record<string, unknown>): boolean {
  const status = readString(run.status);
  const approvalState = readString(run.approvalState) ?? 'not_required';
  if (!status || !['completed', 'succeeded', 'success'].includes(status)) return false;
  if (!['not_required', 'approved', 'teacher_approved', 'reviewed'].includes(approvalState)) return false;
  return agentToolRunHasGovernedEvidenceSummary(run);
}

function agentToolRunHasGovernedEvidenceSummary(run: Record<string, unknown>): boolean {
  const output = getObject(run.outputSummary);
  const evidenceSummary = getObject(output.evidenceSummary);
  const materializedEvidence = getObject(output.materializedEvidence);
  return Boolean(
    output.materializedEvidence === true ||
    output.verifiedCitationSummary === true ||
    evidenceSummary.materialized === true ||
    evidenceSummary.verifiedCitations === true ||
    readString(evidenceSummary.reviewerState) === 'approved' ||
    readString(evidenceSummary.reviewerState) === 'auto_approved' ||
    materializedEvidence.status === 'approved' ||
    materializedEvidence.reviewed === true,
  );
}

function agentToolRunHasStructuredTarget(run: Record<string, unknown>): boolean {
  const structuredContainers = [
    run,
    getObject(run.outputSummary),
    getObject(getObject(run.outputSummary).evidenceSummary),
    getObject(getObject(run.outputSummary).materializedEvidence),
  ];
  return structuredContainers.some((container) => [
    container.capabilityTargetRef,
    container.capabilityTargetRefs,
    container.capabilityTargetId,
    container.capabilityTargetIds,
    container.targetCapabilityId,
    container.targetCapabilityIds,
    container.knowledgeNodeRef,
    container.knowledgeNodeRefs,
    container.knowledgeTag,
    container.knowledgeTags,
  ].some((value) => typeof value === 'string' || Array.isArray(value)));
}

function agentToolRunTargetsCapability(
  run: Record<string, unknown>,
  target: AdaptiveLearningCapabilityTarget,
): boolean {
  const structuredContainers = [
    run,
    getObject(run.outputSummary),
    getObject(getObject(run.outputSummary).evidenceSummary),
    getObject(getObject(run.outputSummary).materializedEvidence),
  ];
  return structuredContainers.some((container) => structuredContainerTargetsCapability(container, target));
}

function structuredContainerTargetsCapability(
  value: Record<string, unknown>,
  target: AdaptiveLearningCapabilityTarget,
): boolean {
  const targetValues = new Set([
    target.id,
    target.knowledgeNodeRef,
    `capability:${target.knowledgeNodeRef.replace(/^control-correction:/, '')}`,
  ]);
  const structuredValues = [
    value.capabilityTargetRef,
    value.capabilityTargetRefs,
    value.capabilityTargetId,
    value.capabilityTargetIds,
    value.targetCapabilityId,
    value.targetCapabilityIds,
    value.knowledgeNodeRef,
    value.knowledgeNodeRefs,
    value.knowledgeTag,
    value.knowledgeTags,
  ];
  return structuredValues.some((entry) => structuredTargetValueMatches(entry, targetValues));
}

function structuredTargetValueMatches(value: unknown, targetValues: Set<string>): boolean {
  if (typeof value === 'string') {
    return targetValues.has(normalizeCapabilityTargetRef(value));
  }
  if (Array.isArray(value)) {
    return value.some((entry) => structuredTargetValueMatches(entry, targetValues));
  }
  return false;
}

function normalizeCapabilityTargetRef(value: string): string {
  return value.trim();
}

function isStaleEvidenceRef(ref: MasteryEvidenceReference, now: Date): boolean {
  if (!ref.evidenceAt) return false;
  const evidenceAt = new Date(ref.evidenceAt);
  if (Number.isNaN(evidenceAt.getTime())) return false;
  return now.getTime() - evidenceAt.getTime() > 90 * 86400000;
}

function buildResourcePreference(facts: Array<Record<string, unknown>>): AdaptiveLearnerState['resourcePreference'] {
  const sourceCounts: Record<string, number> = {};
  for (const fact of facts) {
    const factType = readString(fact.factType) ?? '';
    const modality = factTypeToModality(factType);
    if (modality && modality !== 'path_choice' && !isPathChoiceFactType(factType)) {
      sourceCounts[modality] = (sourceCounts[modality] ?? 0) + 1;
    }
    for (const [pathChoiceModality, count] of Object.entries(readPathChoiceResourceMix(fact))) {
      sourceCounts[pathChoiceModality] = (sourceCounts[pathChoiceModality] ?? 0) + count;
    }
  }
  const preferredModalities = Object.entries(sourceCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([modality]) => modality);
  return {
    preferredModalities,
    sourceCounts,
    confidence: preferredModalities.length >= 5 ? 'medium' : preferredModalities.length > 0 ? 'low' : 'none',
  };
}

function readPathChoiceResourceMix(fact: Record<string, unknown>): Record<string, number> {
  const factType = readString(fact.factType) ?? '';
  if (factType !== 'path_choice' && !isPathChoiceFactType(factType)) {
    return {};
  }
  const context = getObject(fact.contextJson);
  if (factType.startsWith('learning_path.')) {
    const goalId = readString(context.goalId);
    if (!goalId || !isRegisteredAdaptiveLearningPathGoal(goalId)) {
      return {};
    }
  }
  const preferenceEvidence = getObject(context.preferenceEvidence);
  const action = readString(preferenceEvidence.action ?? context.action);
  const helpful = typeof preferenceEvidence.helpful === 'boolean'
    ? preferenceEvidence.helpful
    : typeof context.helpful === 'boolean' ? context.helpful : null;
  if (action === 'rejection' || (action === 'helpfulness' && helpful !== true)) {
    return {};
  }
  const resourceMix = getObject(preferenceEvidence.resourceMix ?? context.resourceMix);
  return Object.fromEntries(Object.entries(resourceMix).filter(([, value]) => (
    typeof value === 'number' && Number.isFinite(value) && value > 0
  ))) as Record<string, number>;
}

function isPathChoiceFactType(factType: string): boolean {
  return (
    factType.startsWith('control_correction_path.') ||
    factType.startsWith('learning_path.')
  ) && factType.endsWith('_recorded');
}

function buildMediaAbsorption(facts: Array<Record<string, unknown>>): AdaptiveLearnerState['mediaAbsorption'] {
  const mediaProgress = facts
    .filter((fact) => factTypeToModality(readString(fact.factType)) === 'media')
    .map((fact) => {
      const context = getObject(fact.contextJson);
      const media = getObject(context.media);
      return finiteNumber(media.progress) ?? scoreToProgress(fact.score);
    })
    .filter((value): value is number => value !== null);
  return {
    mediaFactCount: mediaProgress.length,
    averageCompletion: mediaProgress.length
      ? round(mediaProgress.reduce((sum, value) => sum + value, 0) / mediaProgress.length, 2)
      : null,
    confidence: mediaProgress.length >= 3 ? 'medium' : mediaProgress.length > 0 ? 'low' : 'none',
  };
}

function buildPathContext(
  paths: Array<Record<string, unknown>>,
  activeControlCorrectionPath: Record<string, unknown> | null,
): AdaptiveLearnerState['pathContext'] {
  return {
    activePathCount: paths.length,
    bookmarkedPathCount: paths.filter((path) => path.isBookmarked === true).length,
    recentPathIds: paths.map((path) => readString(path.id)).filter((id): id is string => Boolean(id)),
    activeControlCorrectionPath: activeControlCorrectionPath
      ? {
          state: 'active',
          pathId: readString(activeControlCorrectionPath.id) ?? null,
          status: readString(activeControlCorrectionPath.pathStatus) ?? null,
          currentNodeId: readString(activeControlCorrectionPath.currentNodeId) ?? null,
          terminalValidationState: readString(getObject(activeControlCorrectionPath.terminalValidation).state) ?? null,
          lowConfidenceMarkers: arrayOfStrings(getObject(activeControlCorrectionPath.lastExecutionMetadata).lowConfidenceMarkers),
        }
      : {
          state: 'none',
          pathId: null,
          status: null,
          currentNodeId: null,
          terminalValidationState: null,
          lowConfidenceMarkers: [],
        },
    statusMarkers: paths.length > 0 ? ['available'] : ['missing'],
  };
}

function buildControlCorrectionPathContext(
  paths: Array<Record<string, unknown>>,
  activeControlCorrectionPath: Record<string, unknown> | null,
): ControlCorrectionGoalSlicePathContext {
  const recentPathIds = unique([
    ...paths
    .map((path) => readString(path.id))
      .filter((id): id is string => Boolean(id)),
    ...(activeControlCorrectionPath ? [readString(activeControlCorrectionPath.id)].filter((id): id is string => Boolean(id)) : []),
  ]);
  const activePath = activeControlCorrectionPath ?? paths.find((path) => {
    const goalId = readString(path.goalId);
    if (goalId !== null && goalId !== CONTROL_CORRECTION_GOAL_ID) return false;
    if (path.isActive === true) return true;
    const status = readString(path.pathStatus) ?? readString(path.status);
    return status === 'active' || status === 'in-progress' || status === 'fallback';
  }) ?? null;
  const activePathStatus = readString(activePath?.pathStatus) ?? readString(activePath?.status) ?? (activePath ? 'active' : null);

  return {
    activePathId: readString(activePath?.id),
    activePathStatus,
    currentNodeId: readString(activePath?.currentNodeId) ?? readString(getObject(activePath?.currentNode).id),
    terminalValidationState: readString(activePath?.terminalValidationState)
      ?? readString(getObject(activePath?.terminalValidation).state),
    recentPathIds,
    noActivePath: activePath === null,
  };
}

function isControlCorrectionPathRound(path: Record<string, unknown>): boolean {
  return readString(path.goalId) === CONTROL_CORRECTION_GOAL_ID;
}

function buildRiskState(
  profileSummary: Record<string, unknown> | null,
  riskFlags: Array<Record<string, unknown>>,
  role: AdaptiveLearnerStateRole,
): AdaptiveLearnerState['risks'] {
  if (!privacyScopesForRole(role).includes('teacher-scoped')) {
    return {
      riskLevel: 'redacted',
      activeFlags: [],
    };
  }

  return {
    riskLevel: readString(profileSummary?.riskLevel) ?? (riskFlags.length > 0 ? 'medium' : 'none'),
    activeFlags: riskFlags.map((flag) => ({
      type: readString(flag.flagType) ?? 'unknown',
      severity: readString(flag.severity) ?? 'unknown',
      description: readString(flag.description) ?? '',
      triggeredAt: dateToIso(flag.triggeredAt),
    })),
  };
}

function buildAbilityEstimate(value: Record<string, unknown> | null): AdaptiveLearnerState['assessmentState']['latestAbilityEstimate'] {
  if (!value) {
    return null;
  }
  return {
    theta: round(numberValue(value.theta), 2),
    confidenceInterval: [
      round(numberValue(value.confidenceLow), 2),
      round(numberValue(value.confidenceHigh), 2),
    ],
    algorithmVersion: readString(value.algorithmVersion) ?? 'unknown',
    estimatedAt: dateToIso(value.estimatedAt),
  };
}

function buildEvidenceSummary(
  featureRead: StudentEvidenceFeatureReadResult,
  featureCache: Record<string, unknown>,
): AdaptiveLearnerState['evidence'] {
  const sourceCounts = getObject(featureCache.sourceCounts);
  const sourceCoverage = normalizeCoverageRecord(featureCache.sourceCoverage);
  const confidence = normalizeConfidence(featureCache.confidenceMarkers);
  const statusMarkers = normalizeStatusMarkers(featureCache.statusMarkers);
  if (!featureRead.cache) {
    statusMarkers.push('missing-source', 'low-confidence');
  }
  return {
    readState: featureRead.state,
    evidenceWindow: normalizeEvidenceWindow(featureCache.evidenceWindow),
    sourceCounts,
    sourceCoverage,
    confidence,
    statusMarkers: unique(statusMarkers),
  };
}

function buildMissingEvidence(input: {
  latestSnapshot: Record<string, unknown> | null;
  profileSummary: Record<string, unknown> | null;
  featureRead: StudentEvidenceFeatureReadResult;
  masteryUpdates: Array<Record<string, unknown>>;
}): string[] {
  const missing: string[] = [];
  if (!input.latestSnapshot) missing.push('StudentCompetencySnapshot');
  if (!input.profileSummary) missing.push('StudentProfileSummary');
  if (!input.featureRead.cache) missing.push('StudentEvidenceFeatureCache');
  if (input.masteryUpdates.length === 0) missing.push('AdaptiveMasteryUpdate');
  return missing;
}

interface ControlCorrectionSourceEvidence {
  assessmentCoverage: StudentEvidenceCoverageState;
  assessmentCount: number;
  simulationCoverage: StudentEvidenceCoverageState;
  simulationCount: number;
  arenaCoverage: StudentEvidenceCoverageState;
  officialArenaCount: number;
  previewArenaCount: number;
  simulationArenaQualityMarkers: string[];
  reflectionCount: number;
  aiCollaborationCount: number;
  agentToolRunCount: number;
}

interface ControlCorrectionFactCounts {
  assessment: number;
  simulation: number;
  arena: number;
  previewArena: number;
  reflection: number;
  aiCollaboration: number;
}

interface ControlCorrectionScopedFactSummary {
  counts: ControlCorrectionFactCounts;
}

function summarizeControlCorrectionFacts(facts: Array<Record<string, unknown>>): ControlCorrectionScopedFactSummary {
  const scopedFacts = facts.filter(isControlCorrectionFact);
  const counts = scopedFacts.reduce<ControlCorrectionFactCounts>((counts, fact) => {
    if (isControlCorrectionArenaFact(fact)) {
      counts.arena += 1;
      counts.previewArena += 1;
      return counts;
    }
    const modality = factTypeToModality(readString(fact.factType));
    if (modality === 'assessment') counts.assessment += 1;
    if (modality === 'simulation') counts.simulation += 1;
    if (modality === 'arena') {
      counts.arena += 1;
      counts.previewArena += 1;
    }
    if (modality === 'reflection') counts.reflection += 1;
    if ((modality === 'ai' || modality === 'ai-collaboration' || modality === 'konling') && isGovernedAiLearningFact(fact)) {
      counts.aiCollaboration += 1;
    }
    return counts;
  }, {
    assessment: 0,
    simulation: 0,
    arena: 0,
    previewArena: 0,
    reflection: 0,
    aiCollaboration: 0,
  });
  return { counts };
}

async function readControlCorrectionLearningFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  if (!db.learningFact?.findMany) {
    return [];
  }

  const [explicitFacts, legacyFacts] = await Promise.all([
    readPagedControlCorrectionLearningFacts({
      findMany: db.learningFact.findMany,
      where: buildExplicitControlCorrectionLearningFactWhere(userId),
      filter: isControlCorrectionFact,
      maxPages: CONTROL_CORRECTION_EXPLICIT_FACT_SCAN_MAX_PAGES,
    }),
    readLegacyControlCorrectionLearningFacts(db, userId),
  ]);

  return uniqueFactsById([...explicitFacts, ...legacyFacts]);
}

async function readLegacyControlCorrectionLearningFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  const findMany = db.learningFact?.findMany;
  if (!findMany) {
    return [];
  }

  return readPagedControlCorrectionLearningFacts({
    findMany,
    where: buildLegacyControlCorrectionLearningFactWhere(userId),
    filter: (fact) => !hasExplicitAdaptiveGoal(fact) && isLegacyControlCorrectionFact(fact, getObject(fact.contextJson)),
    maxPages: CONTROL_CORRECTION_LEGACY_FACT_SCAN_MAX_PAGES,
  });
}

async function readPagedControlCorrectionLearningFacts(input: {
  findMany: (args: any) => Promise<Array<Record<string, unknown>>>;
  where: Record<string, unknown>;
  filter: (fact: Record<string, unknown>) => boolean;
  maxPages: number;
}): Promise<Array<Record<string, unknown>>> {
  const facts: Array<Record<string, unknown>> = [];
  let cursorId: string | null = null;
  for (let page = 0; page < input.maxPages; page += 1) {
    const rows = await input.findMany({
      where: input.where,
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: CONTROL_CORRECTION_FACT_TAKE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    facts.push(...rows.filter(input.filter));
    if (facts.length >= CONTROL_CORRECTION_FACT_TAKE || rows.length < CONTROL_CORRECTION_FACT_TAKE) {
      break;
    }
    const lastId = readString(rows.at(-1)?.id);
    if (!lastId) {
      break;
    }
    cursorId = lastId;
  }

  return facts.slice(0, CONTROL_CORRECTION_FACT_TAKE);
}

function isControlCorrectionArenaFact(fact: Record<string, unknown>): boolean {
  const context = getObject(fact.contextJson);
  const taskId = readString(getObject(context.arena).taskId);
  return taskId !== null && CONTROL_CORRECTION_ARENA_TASK_IDS.has(taskId);
}

function isControlCorrectionFact(fact: Record<string, unknown>): boolean {
  const context = getObject(fact.contextJson);
  const explicitGoalValues = explicitAdaptiveGoalValues(fact);
  if (explicitGoalValues.length > 0) {
    return explicitGoalValues.every((value) => value === CONTROL_CORRECTION_GOAL_ID);
  }
  return isLegacyControlCorrectionFact(fact, context);
}

function hasExplicitAdaptiveGoal(fact: Record<string, unknown>): boolean {
  return explicitAdaptiveGoalValues(fact).length > 0;
}

function explicitAdaptiveGoalValues(fact: Record<string, unknown>): string[] {
  const context = getObject(fact.contextJson);
  return [
    readString(context.goalId),
    readString(context.goal),
    readString(context.targetGoal),
    readString(context.learningGoal),
  ].filter((value): value is string => value !== null);
}

function isLegacyControlCorrectionFact(
  fact: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  return [
    readString(fact.courseId),
    readString(fact.lessonId),
    readString(fact.moduleId),
    readString(getObject(context.adaptiveAssessment).courseId),
    readString(getObject(context.adaptiveAssessment).lessonId),
    readString(getObject(context.adaptiveAssessment).moduleId),
    readString(getObject(context.simulation).courseId),
    readString(getObject(context.simulation).lessonId),
    readString(getObject(context.simulation).taskId),
    readString(getObject(getObject(context.simulation).summary).sourceId),
    readString(getObject(getObject(context.simulation).summary).taskId),
    readString(getObject(context.agentTool).courseId),
    readString(getObject(context.agentTool).lessonId),
    readString(getObject(context.agentTool).taskId),
  ].some((value) => value !== null && CONTROL_CORRECTION_COURSE_IDS.has(value))
    || [
      readString(getObject(context.arena).taskId),
      readString(getObject(context.simulation).taskId),
      readString(getObject(getObject(context.simulation).summary).taskId),
      readString(getObject(context.agentTool).taskId),
    ].some((value) => value !== null && CONTROL_CORRECTION_ARENA_TASK_IDS.has(value));
}

function buildExplicitControlCorrectionLearningFactWhere(userId: string) {
  return {
    userId,
    OR: [
      { contextJson: { path: ['goalId'], equals: CONTROL_CORRECTION_GOAL_ID } },
      { contextJson: { path: ['goal'], equals: CONTROL_CORRECTION_GOAL_ID } },
      { contextJson: { path: ['targetGoal'], equals: CONTROL_CORRECTION_GOAL_ID } },
      { contextJson: { path: ['learningGoal'], equals: CONTROL_CORRECTION_GOAL_ID } },
    ],
  };
}

function buildLegacyControlCorrectionLearningFactWhere(userId: string) {
  return {
    userId,
    OR: [
      { courseId: { in: [...CONTROL_CORRECTION_COURSE_ID_VALUES] } },
      { lessonId: { in: [...CONTROL_CORRECTION_COURSE_ID_VALUES] } },
      { moduleId: { in: [...CONTROL_CORRECTION_COURSE_ID_VALUES] } },
      ...controlCorrectionJsonPathWhere(
        [
          ['adaptiveAssessment', 'courseId'],
          ['adaptiveAssessment', 'lessonId'],
          ['adaptiveAssessment', 'moduleId'],
          ['simulation', 'courseId'],
          ['simulation', 'lessonId'],
          ['simulation', 'taskId'],
          ['simulation', 'summary', 'sourceId'],
          ['simulation', 'summary', 'taskId'],
          ['agentTool', 'courseId'],
          ['agentTool', 'lessonId'],
          ['agentTool', 'taskId'],
        ],
        CONTROL_CORRECTION_COURSE_ID_VALUES,
      ),
      ...controlCorrectionJsonPathWhere(
        [
          ['arena', 'taskId'],
          ['simulation', 'taskId'],
          ['simulation', 'summary', 'taskId'],
          ['agentTool', 'taskId'],
        ],
        CONTROL_CORRECTION_ARENA_TASK_ID_VALUES,
      ),
    ],
  };
}

function controlCorrectionJsonPathWhere(
  paths: string[][],
  values: readonly string[],
) {
  return paths.flatMap((path) => values.map((value) => ({
    contextJson: { path, equals: value },
  })));
}

function uniqueFactsById(facts: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  const seen = new Set<string>();
  const result: Array<Record<string, unknown>> = [];
  for (const fact of facts) {
    const id = readString(fact.id);
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    result.push(fact);
  }
  return result;
}

function countOfficialControlCorrectionArenaSubmissions(submissions: Array<Record<string, unknown>>): number {
  return submissions.filter(isOfficialControlCorrectionArenaSubmission).length;
}

function isOfficialControlCorrectionArenaSubmission(submission: Record<string, unknown>): boolean {
  if (submission.valid !== true) return false;
  if (submission.isLate === true) return false;
  if (typeof submission.score === 'number' && submission.score <= 0) return false;
  const evidenceWriteback = getObject(submission.evidenceWriteback);
  if (Object.keys(evidenceWriteback).length === 0) return false;
  if (evidenceWriteback.status !== 'accepted') return false;
  if (evidenceWriteback.terminalValidationAccepted !== true) return false;
  const evaluationRun = getObject(submission.evaluationRun);
  const controllerArtifact = getObject(submission.controllerArtifact);
  const artifactPayload = getObject(controllerArtifact.payload);
  const taskId = readString(submission.taskId);
  if (!taskId) return false;
  if (!CONTROL_CORRECTION_ARENA_TASK_IDS.has(taskId)) return false;
  const method = readString(submission.method) ?? readString(artifactPayload.method);
  return readString(evaluationRun.protocolVersion) === getArenaEvaluationProtocolVersion({
    taskId,
    ...(method ? { method: method as Parameters<typeof getArenaEvaluationProtocolVersion>[0]['method'] } : {}),
  });
}

function buildControlCorrectionSourceEvidence(input: {
  facts: Array<Record<string, unknown>>;
  arenaSubmissions: Array<Record<string, unknown>>;
  masteryTraceability: AdaptiveLearnerState['masteryTraceability'];
  simulationArena: Record<string, unknown>;
}): ControlCorrectionSourceEvidence {
  const factSummary = summarizeControlCorrectionFacts(input.facts);
  const factCounts = factSummary.counts;
  const officialArenaCount = countOfficialControlCorrectionArenaSubmissions(input.arenaSubmissions);
  const agentToolRunCount = countVisibleAgentToolRunRefs(input.masteryTraceability);
  const simulationArenaCoverage = getObject(input.simulationArena.sourceCoverage);
  return {
    assessmentCoverage: factCounts.assessment > 0 ? 'available' : 'missing',
    assessmentCount: factCounts.assessment,
    simulationCoverage: factCounts.simulation > 0 ? normalizeCoverageState(simulationArenaCoverage.simulation) : 'missing',
    simulationCount: factCounts.simulation,
    arenaCoverage: officialArenaCount > 0
      ? 'available'
      : factCounts.arena > 0 ? previewArenaCoverage(simulationArenaCoverage.arena) : 'missing',
    officialArenaCount,
    previewArenaCount: factCounts.previewArena,
    simulationArenaQualityMarkers: arrayOfStrings(input.simulationArena.qualityMarkers),
    reflectionCount: factCounts.reflection,
    aiCollaborationCount: factCounts.aiCollaboration + agentToolRunCount,
    agentToolRunCount,
  };
}

function countVisibleAgentToolRunRefs(masteryTraceability: AdaptiveLearnerState['masteryTraceability']): number {
  if (!masteryTraceability) return 0;
  const sourceIds = new Set<string>();
  for (const entry of Object.values(masteryTraceability.capabilityTargets)) {
    for (const ref of entry.supportingEvidenceRefs) {
      if (ref.sourceType === 'AgentToolRun') sourceIds.add(ref.sourceId);
    }
  }
  return sourceIds.size;
}

function previewArenaCoverage(value: unknown): StudentEvidenceCoverageState {
  const coverage = normalizeCoverageState(value);
  return coverage === 'missing' ? 'partial' : coverage;
}

function buildControlCorrectionDimensionSourceCoverage(
  id: ControlCorrectionDimensionId,
  sourceEvidence: ControlCorrectionSourceEvidence,
): ControlCorrectionGoalSliceDimension['sourceCoverage'] {
  const requiredSources = new Set(CONTROL_CORRECTION_DIMENSION_REQUIRED_SOURCES[id]);
  return {
    assessment: requiredSources.has('assessment') ? sourceEvidence.assessmentCoverage : 'missing',
    simulation: requiredSources.has('simulation') ? sourceEvidence.simulationCoverage : 'missing',
    arena: requiredSources.has('arena') ? sourceEvidence.arenaCoverage : 'missing',
    reflection: requiredSources.has('reflection')
      ? sourceEvidence.reflectionCount > 0 ? 'available' : 'missing'
      : 'missing',
    aiCollaboration: requiredSources.has('aiCollaboration')
      ? sourceEvidence.aiCollaborationCount > 0 ? 'available' : 'missing'
      : 'missing',
  };
}

function buildControlCorrectionDimensionEvidenceCount(
  id: ControlCorrectionDimensionId,
  _primaryEvidenceCount: number,
  sourceEvidence: ControlCorrectionSourceEvidence,
): number {
  return CONTROL_CORRECTION_DIMENSION_REQUIRED_SOURCES[id].reduce((count, source) => {
    if (source === 'assessment') return count + sourceEvidence.assessmentCount;
    if (source === 'simulation') return count + sourceEvidence.simulationCount;
    if (source === 'arena') return count + (sourceEvidence.officialArenaCount > 0
      ? sourceEvidence.officialArenaCount
      : sourceEvidence.previewArenaCount);
    if (source === 'reflection') return count + sourceEvidence.reflectionCount;
    return count + sourceEvidence.aiCollaborationCount;
  }, 0);
}

function buildControlCorrectionEvidenceProvenance(
  sourceEvidence: ControlCorrectionSourceEvidence,
): ControlCorrectionGoalSliceDimension['evidenceProvenance'] {
  return {
    assessment: sourceEvidence.assessmentCount > 0 ? 'assessment-backed' : sourceEvidence.assessmentCoverage !== 'missing' ? 'snapshot-derived' : 'missing',
    simulation: sourceEvidence.simulationCount > 0 ? 'governed-replay' : 'missing',
    arena: sourceEvidence.officialArenaCount > 0 ? 'official' : sourceEvidence.previewArenaCount > 0 ? 'preview' : 'missing',
    reflection: sourceEvidence.reflectionCount > 0 ? 'governed-reflection' : 'missing',
    aiCollaboration: sourceEvidence.aiCollaborationCount > 0 ? 'governed-ai-collaboration' : 'missing',
  };
}

function buildControlCorrectionFallbackMarkers(
  id: ControlCorrectionDimensionId,
  sourceCoverage: ControlCorrectionGoalSliceDimension['sourceCoverage'],
  evidenceProvenance: ControlCorrectionGoalSliceDimension['evidenceProvenance'],
  simulationArenaQualityMarkers: string[],
  statusMarkers: StudentEvidenceStatusMarker[],
  readState: StudentEvidenceFeatureReadResult['state'],
): string[] {
  const markers: string[] = statusMarkers.map((marker) => marker === 'missing-source' ? 'missing-governed-evidence' : marker);
  if (readState === 'stale') {
    markers.push('stale');
  }
  for (const source of CONTROL_CORRECTION_DIMENSION_REQUIRED_SOURCES[id]) {
    if (sourceCoverage[source] === 'missing') {
      markers.push(`missing-${controlCorrectionSourceMarker(source)}-evidence`);
    }
    if (sourceCoverage[source] === 'partial') {
      markers.push(`partial-${controlCorrectionSourceMarker(source)}-evidence`);
    }
  }
  if (CONTROL_CORRECTION_DIMENSION_REQUIRED_SOURCES[id].includes('arena') && evidenceProvenance.arena !== 'official') {
    markers.push(evidenceProvenance.arena === 'preview' ? 'preview-only-arena-evidence' : 'missing-official-arena-evidence');
  }
  const requiredSources = CONTROL_CORRECTION_DIMENSION_REQUIRED_SOURCES[id];
  if (requiredSources.some((source) => source === 'simulation' || source === 'arena')) {
    if (simulationArenaQualityMarkers.includes('stale')) {
      markers.push('stale');
    }
    if (simulationArenaQualityMarkers.includes('low-confidence')) {
      markers.push('low-confidence');
    }
    if (simulationArenaQualityMarkers.includes('preview-only')) {
      markers.push('preview-only-simulation-arena-evidence', 'low-confidence');
    }
    if (simulationArenaQualityMarkers.includes('standalone-only')) {
      markers.push('standalone-only-simulation-arena-evidence', 'low-confidence');
    }
    if (simulationArenaQualityMarkers.includes('partial')) {
      if (requiredSources.includes('simulation')) {
        markers.push('partial-simulation-evidence');
      }
      if (requiredSources.includes('arena')) {
        markers.push('partial-arena-evidence');
      }
    }
  }
  if (Object.values(sourceCoverage).every((coverage) => coverage === 'missing')) {
    markers.push('missing-governed-evidence');
  }
  return unique(markers);
}

function buildControlCorrectionConfidence(input: {
  id: ControlCorrectionDimensionId;
  baseScore: number;
  evidenceCount: number;
  sourceCoverage: ControlCorrectionGoalSliceDimension['sourceCoverage'];
  fallbackMarkers: string[];
}): ControlCorrectionGoalSliceDimension['confidence'] {
  const sourceValues = CONTROL_CORRECTION_DIMENSION_REQUIRED_SOURCES[input.id].map((source) => input.sourceCoverage[source]);
  const sourceCompleteness = round(
    sourceValues.reduce((sum, coverage) => sum + (coverage === 'available' ? 1 : coverage === 'partial' ? 0.5 : 0), 0) /
      sourceValues.length,
    2,
  );
  const hasMissingRequired = input.fallbackMarkers.some((marker) => marker.startsWith('missing-'));
  const hasLowConfidenceMarker = input.fallbackMarkers.includes('low-confidence');
  const score = input.evidenceCount === 0
    ? 0
    : round(Math.min(input.baseScore, sourceCompleteness), 2);
  const state = input.evidenceCount === 0
    ? 'none'
    : hasMissingRequired || hasLowConfidenceMarker || score < 0.4
      ? 'low'
      : score < 0.7
        ? 'medium'
        : 'high';
  return {
    state,
    score,
    evidenceCount: input.evidenceCount,
    sourceCompleteness,
  };
}

function controlCorrectionFreshness(
  evidenceCount: number,
  fallbackMarkers: string[],
  statusMarkers: StudentEvidenceStatusMarker[],
): ControlCorrectionGoalSliceDimension['freshness'] {
  if (evidenceCount === 0) return 'missing';
  if (fallbackMarkers.some((marker) => marker.startsWith('missing-'))) return 'missing';
  if (statusMarkers.includes('stale') || fallbackMarkers.includes('stale')) return 'stale';
  if (
    statusMarkers.includes('partial') ||
    statusMarkers.includes('missing-source') ||
    fallbackMarkers.some((marker) => marker.startsWith('partial-') || marker === 'preview-only-arena-evidence')
  ) return 'partial';
  return 'current';
}

function controlCorrectionTargetLevel(score: number): ControlCorrectionTargetLevel {
  if (score >= 85) return 'advanced';
  if (score >= 70) return 'proficient';
  if (score >= 50) return 'developing';
  return 'foundation';
}

function controlCorrectionSourceMarker(source: keyof ControlCorrectionGoalSliceDimension['sourceCoverage']): string {
  if (source === 'aiCollaboration') return 'ai-collaboration';
  return source;
}

function privacyScopesForRole(role: AdaptiveLearnerStateRole): AdaptiveLearnerStatePrivacyScope[] {
  if (role === 'admin') {
    return ['student-visible', 'teacher-scoped', 'admin-scoped'];
  }
  if (role === 'teacher') {
    return ['student-visible', 'teacher-scoped'];
  }
  if (role === 'system') {
    return ['student-visible', 'teacher-scoped', 'admin-scoped', 'audit-only', 'system-internal'];
  }
  return ['student-visible'];
}

function filterPathExecutionForRole(
  value: Record<string, unknown>,
  role: AdaptiveLearnerStateRole,
): Record<string, unknown> {
  const allowedScopes = new Set(privacyScopesForRole(role));
  const sourceReferences = Array.isArray(value.sourceReferences)
    ? value.sourceReferences.filter((entry) => {
        const reference = getObject(entry);
        return allowedScopes.has(readString(reference.privacyLevel) as AdaptiveLearnerStatePrivacyScope);
      })
    : [];
  return {
    ...value,
    sourceReferences,
  };
}

function factTypeToModality(factType: string | null): string | null {
  if (!factType) return null;
  if (factType === 'question' || factType === 'assessment') return 'assessment';
  if (factType === 'media' || factType === 'video' || factType === 'audio') return 'media';
  if (factType === 'simulation' || factType === 'design') return 'simulation';
  if (factType === 'arena') return 'arena';
  if (factType === 'reflection') return 'reflection';
  if (factType === 'ai_intervention' || factType === 'prompt_design') return 'ai-collaboration';
  if (factType === 'ai' || factType === 'ai-collaboration' || factType === 'konling') return factType;
  if (factType === 'resource') return 'resource';
  return factType;
}

function toCompetencyVector(value: unknown): CompetencyVector | null {
  if (!isObject(value)) {
    return null;
  }
  if (!COMPETENCY_DIMENSIONS.every((dimension) => isObject(value[dimension]) && Number.isFinite(value[dimension].score))) {
    return null;
  }
  return value as unknown as CompetencyVector;
}

function normalizeEvidenceWindow(value: unknown): StudentEvidenceWindow {
  const window = getObject(value);
  return {
    firstStartedAt: readString(window.firstStartedAt),
    lastStartedAt: readString(window.lastStartedAt),
    daysCovered: numberValue(window.daysCovered),
  };
}

function normalizeCoverageRecord(value: unknown): Record<string, StudentEvidenceCoverageState> {
  const sourceCoverage = getObject(value);
  return Object.fromEntries(
    Object.entries(sourceCoverage).map(([key, entry]) => [key, normalizeCoverageState(entry)]),
  );
}

function normalizeCoverageState(value: unknown): StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing' ? value : 'missing';
}

function isCoverageState(value: unknown): value is StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing';
}

function isControlCorrectionConfidenceState(value: unknown): value is ControlCorrectionGoalSliceDimension['confidence']['state'] {
  return value === 'none' || value === 'low' || value === 'medium' || value === 'high';
}

function normalizeConfidence(value: unknown): AdaptiveLearnerState['evidence']['confidence'] {
  const confidence = getObject(value);
  const level = confidence.level;
  return {
    level: level === 'none' || level === 'low' || level === 'medium' || level === 'high' ? level : 'none',
    score: numberValue(confidence.score),
    evidenceCount: numberValue(confidence.evidenceCount),
    sourceCompleteness: numberValue(confidence.sourceCompleteness),
  };
}

function normalizeStatusMarkers(value: unknown): StudentEvidenceStatusMarker[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is StudentEvidenceStatusMarker =>
    item === 'stale' ||
    item === 'partial' ||
    item === 'low-confidence' ||
    item === 'missing-source'
  );
}

function scoreToProgress(value: unknown): number | null {
  const score = finiteNumber(value);
  if (score === null) return null;
  return score > 1 ? round(score / 100, 2) : round(score, 2);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function getObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function normalizeRequestedGoal(value: string | null | undefined): string | null {
  return readString(value);
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((item) => leftSet.has(item));
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function dateToIso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(0).toISOString();
}

function dateToIsoOrNull(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  return null;
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
