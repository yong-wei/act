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
const CONTROL_CORRECTION_COURSE_ID_VALUES = [
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
  primaryCompetencies: {
    valueRange: '0-100 per primary competency',
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
    sourceFamilies: ['StudentCompetencySnapshot', 'LearningFact', 'AdaptiveMasteryUpdate', 'StudentEvidenceFeatureCache', 'ArenaSubmission'],
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

export interface ControlCorrectionGoalSlice {
  goalId: typeof CONTROL_CORRECTION_GOAL_ID;
  payloadVersion: typeof CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION;
  generatedAt: string;
  targetLevels: ControlCorrectionTargetLevel[];
  dimensions: ControlCorrectionGoalSliceDimension[];
  pathContext: ControlCorrectionGoalSlicePathContext;
  privacyClasses: Record<'student' | 'teacher' | 'admin' | 'audit' | 'internal', AdaptiveLearnerStatePrivacyScope>;
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
  primaryCompetencies: {
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
    }>;
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

interface AdaptiveLearnerStateDb {
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
  ] = await Promise.all([
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
  ]);

  const { vector, source } = resolvePrimaryCompetencyVector(latestSnapshot, featureSnapshot);
  const knowledgeMastery = buildKnowledgeMastery(masteryUpdates);
  const evidence = buildEvidenceSummary(featureRead, featureCache);
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
    facts: controlCorrectionFacts,
    arenaSubmissions: controlCorrectionArenaSubmissions,
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
    primaryCompetencies: {
      source,
      vector,
    },
    secondaryDimensions,
    knowledgeMastery,
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

function resolvePrimaryCompetencyVector(
  latestSnapshot: Record<string, unknown> | null,
  featureSnapshot: Record<string, unknown>,
): { vector: CompetencyVector; source: AdaptiveLearnerState['primaryCompetencies']['source'] } {
  const snapshotVector = latestSnapshot ? toCompetencyVector(latestSnapshot.competencyVector) : null;
  if (snapshotVector) {
    return { vector: snapshotVector, source: 'latest-snapshot' };
  }
  const cachedVector = toCompetencyVector(featureSnapshot.competencyVector);
  if (cachedVector) {
    return { vector: cachedVector, source: 'feature-cache' };
  }
  return { vector: createEmptyCompetencyVector(), source: 'fallback-empty' };
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
    dimensions,
    pathContext: buildControlCorrectionPathContext(input.paths, input.activeControlCorrectionPath),
    privacyClasses: CONTROL_CORRECTION_PRIVACY_CLASSES,
  };
  validateControlCorrectionGoalSliceContract(slice);
  return slice;
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

function buildKnowledgeMastery(rows: Array<Record<string, unknown>>): AdaptiveLearnerState['knowledgeMastery'] {
  const tags: AdaptiveLearnerState['knowledgeMastery']['tags'] = {};
  for (const row of rows) {
    const knowledgeTag = readString(row.knowledgeTag);
    if (!knowledgeTag || tags[knowledgeTag]) {
      continue;
    }
    tags[knowledgeTag] = {
      posteriorMastery: round(numberValue(row.posteriorMastery), 2),
      confidence: round(numberValue(row.confidence), 2),
      evidenceCount: 1,
      source: 'adaptive-assessment',
      algorithmVersion: readString(row.algorithmVersion) ?? 'unknown',
      lastUpdatedAt: dateToIso(row.createdAt),
    };
  }
  return {
    coverage: Object.keys(tags).length > 0 ? 'available' : 'missing',
    tags,
  };
}

function buildResourcePreference(facts: Array<Record<string, unknown>>): AdaptiveLearnerState['resourcePreference'] {
  const sourceCounts: Record<string, number> = {};
  for (const fact of facts) {
    const factType = readString(fact.factType) ?? '';
    const modality = factTypeToModality(factType);
    if (modality && modality !== 'path_choice' && !isControlCorrectionPathChoiceFactType(factType)) {
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
  if (factType !== 'path_choice' && !isControlCorrectionPathChoiceFactType(factType)) {
    return {};
  }
  const context = getObject(fact.contextJson);
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

function isControlCorrectionPathChoiceFactType(factType: string): boolean {
  return factType.startsWith('control_correction_path.') && factType.endsWith('_recorded');
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
    if (modality === 'ai' || modality === 'ai-collaboration' || modality === 'konling') counts.aiCollaboration += 1;
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
  return submissions.filter((submission) => {
    if (submission.valid !== true) return false;
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
  }).length;
}

function buildControlCorrectionSourceEvidence(input: {
  facts: Array<Record<string, unknown>>;
  arenaSubmissions: Array<Record<string, unknown>>;
  simulationArena: Record<string, unknown>;
}): ControlCorrectionSourceEvidence {
  const factSummary = summarizeControlCorrectionFacts(input.facts);
  const factCounts = factSummary.counts;
  const officialArenaCount = countOfficialControlCorrectionArenaSubmissions(input.arenaSubmissions);
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
    aiCollaborationCount: factCounts.aiCollaboration,
  };
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

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
