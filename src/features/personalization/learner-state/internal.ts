// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: these six-dimensional types remain non-authoritative compatibility inputs.
import {
  COMPETENCY_DIMENSIONS,
  createEmptyCompetencyVector,
  type CompetencyDimension,
  type CompetencyVector, // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility type.
} from '@/lib/data-governance/competency-model';
import {
  projectCoexistingLearningFactIdentities,
  projectLearningFactServingIdentity,
  type LearningFactServingIdentity,
} from '@/lib/canonical-learning-fact-identity';
import { getArenaEvaluationProtocolVersion } from '@/features/arena/evaluation/protocol';
import {
  readStudentEvidenceFeatures,
  type StudentEvidenceCoverageState,
  type StudentEvidenceFeatureReadResult,
  type StudentEvidenceStatusMarker,
  type StudentEvidenceWindow,
} from '@/lib/data-governance/student-evidence-feature-cache';
import { CONTROL_CORRECTION_CAPABILITY_TARGETS } from '@/features/personalization/plugins/control-correction/capability-targets';
import type { AdaptiveLearningCapabilityTarget } from '@/features/personalization/path-planning/contracts';
import { isRegisteredAdaptiveLearningPathGoal } from '@/features/personalization/path-planning/registered-goal-ids';
import { readArenaSubmissionEvidenceWritebacks } from '@/features/arena/evidence-writeback-persistence';
import {
  resolvePrimaryPortraitV2,
  type PortraitV2ConsumerDb,
  type PortraitV2Consumer,
  type PortraitV2LegacyCompatibility,
} from '@/lib/data-governance/portrait-v2-consumer';
import {
  isAuthoritativeConsumerRead,
  readAuthorizedCumulativePortrait,
  viewerForPortraitConsumer,
} from '@/features/learning-record/consumers/public-api';
import {
  mapAdaptiveGoalSliceDimensionToPortraitV2,
  mapLegacyCompetencyDimensionToPortraitV2,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  PORTRAIT_V2_FRESHNESS_CURRENT_MAX_AGE_DAYS,
  type PortraitV2ProjectedPayload,
} from '@/lib/data-governance/portrait-v2-model';
import {
  inferStudentSafeEvidenceSource,
  projectStudentSafeEvidenceSource,
  type StudentSafeEvidenceEventReference,
} from '@/lib/data-governance/evidence-timeline';
import { isLearningFactEligibleForPersonalization } from '@/lib/data-governance/learning-fact-quality-weight';
import {
  ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_PRIVACY,
  CONTROL_CORRECTION_PRIVACY_CLASSES,
  CONTROL_CORRECTION_TARGET_LEVELS,
  type AdaptiveGoalSliceDefinition,
  type AdaptiveGoalSliceDimensionDefinition,
  type AdaptiveLearnerStateFieldContract,
  type AdaptiveLearnerStateFieldFamily,
  type AdaptiveLearnerStateGoalId,
  type AdaptiveLearnerStatePrivacyScope,
  type ControlCorrectionDimensionId,
  type ControlCorrectionTargetLevel,
} from './goal-slice-constants';

export {
  ADAPTIVE_LEARNER_STATE_ALGORITHM_VERSION,
  ADAPTIVE_LEARNER_STATE_FEATURE_FLAG,
  ADAPTIVE_LEARNER_STATE_FIELD_CONTRACTS,
  ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_GOAL_DIMENSIONS,
  CONTROL_CORRECTION_GOAL_ID,
  CONTROL_CORRECTION_GOAL_SLICE_PAYLOAD_VERSION,
  CONTROL_CORRECTION_PRIVACY,
  CONTROL_CORRECTION_PRIVACY_CLASSES,
  CONTROL_CORRECTION_TARGET_LEVELS,
};

export type {
  AdaptiveGoalSliceDefinition,
  AdaptiveGoalSliceDimensionDefinition,
  AdaptiveLearnerStateFieldContract,
  AdaptiveLearnerStateFieldFamily,
  AdaptiveLearnerStateGoalId,
  AdaptiveLearnerStatePrivacyScope,
  ControlCorrectionDimensionId,
  ControlCorrectionTargetLevel,
};

export type AdaptiveLearnerStateRole = 'student' | 'teacher' | 'admin' | 'system';
export type AdaptiveLearnerStatePrimaryPortraitState = 'SNAPSHOT' | 'NO_EVIDENCE' | 'UNAVAILABLE';

const LEARNER_STATE_FACT_TAKE = 100;

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
  | 'StudentEvidenceFeatureCache'; // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: cache refs remain non-primary.

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
    eventReferences?: StudentSafeEvidenceEventReference[];
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
  fallbackReason: 'unregistered-adaptive-goal' | 'goal-plugin-unavailable';
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
  primaryPortrait: PortraitV2ProjectedPayload | null;
  primaryPortraitState: AdaptiveLearnerStatePrimaryPortraitState;
  primaryPortraitAvailability: string;
  primaryCompetencies: { // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: compatibility-only six-dimensional output.
    authority: 'legacy-compatibility-only';
    source: 'latest-snapshot' | 'feature-cache' | 'portrait-v2-derived' | 'portrait-v2-mixed' | 'fallback-empty';
    vector: CompetencyVector; // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: non-authoritative compatibility vector.
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
      eventReferences?: StudentSafeEvidenceEventReference[];
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

export type PortraitResolution = {
  primaryPortrait: PortraitV2ProjectedPayload | null;
  primaryPortraitState: AdaptiveLearnerStatePrimaryPortraitState;
  primaryPortraitAvailability: string;
  legacyCompatibility: PortraitV2LegacyCompatibility;
  limitations: string[];
};

export interface LearnerStateReducerInput {
  userId: string;
  role: AdaptiveLearnerStateRole;
  classId?: string | null;
  now: Date;
  clientHints?: Record<string, unknown>;
  algorithmVersion: string;
  featureFlagEnabled: boolean;
  requestedGoal: string | null;
  requestedGoalDefinition: AdaptiveGoalSliceDefinition | null;
  supportedGoalIds?: AdaptiveLearnerStateGoalId[];
  goalPluginAvailable: boolean;
  featureRead: StudentEvidenceFeatureReadResult;
  featureCache: Record<string, unknown>;
  latestSnapshot: Record<string, unknown> | null;
  profileSummary: Record<string, unknown> | null;
  personalizationFacts: Array<Record<string, unknown>>;
  masteryFacts: Array<Record<string, unknown>>;
  masteryUpdates: Array<Record<string, unknown>>;
  latestAbility: Record<string, unknown> | null;
  riskFlags: Array<Record<string, unknown>>;
  paths: Array<Record<string, unknown>>;
  activeControlCorrectionPaths: Array<Record<string, unknown>>;
  controlCorrectionFacts: Array<Record<string, unknown>>;
  controlCorrectionArenaSubmissions: Array<Record<string, unknown>>;
  controlCorrectionAgentToolRuns: Array<Record<string, unknown>>;
  portraitResolution: PortraitResolution;
}

export interface AdaptiveLearnerStateDb extends PortraitV2ConsumerDb {
  cumulativePortraitCutoverFence?: { findUnique?: (args: any) => Promise<any | null> };
  cumulativePortraitMigrationRun?: { findUnique?: (args: any) => Promise<any | null> };
  learningMaterializationRebuildRequest?: { findFirst?: (args: any) => Promise<any | null> };
  learnerPortraitCurrentState?: { findUnique?: (args: any) => Promise<any | null> };
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

const DEFAULT_EVIDENCE_WINDOW: StudentEvidenceWindow = {
  firstStartedAt: null,
  lastStartedAt: null,
  daysCovered: 0,
};

/**
 * Project LearningFact knowledge identities for multi-era learner-state /
 * audit serving. Each fact keeps its own namespace and revision; historical
 * facts are never reinterpreted through the current Canonical graph (#1116).
 */
export function projectLearnerStateFactIdentities(
  facts: ReadonlyArray<{
    id: string;
    knowledgeIdentityNamespace?: string | null;
    canonicalObjectId?: string | null;
    aggregateReleaseSetId?: string | null;
    aggregateReleaseId?: string | null;
    knowledgeProjectionId?: string | null;
    knowledgeRevisionRef?: string | null;
    contextJson?: unknown;
  }>,
): LearningFactServingIdentity[] {
  return projectCoexistingLearningFactIdentities(facts);
}

export function projectLearnerStateFactIdentity(
  fact: {
    id: string;
    knowledgeIdentityNamespace?: string | null;
    canonicalObjectId?: string | null;
    aggregateReleaseSetId?: string | null;
    aggregateReleaseId?: string | null;
    knowledgeProjectionId?: string | null;
    knowledgeRevisionRef?: string | null;
    contextJson?: unknown;
  },
): LearningFactServingIdentity {
  return projectLearningFactServingIdentity(fact);
}

export function isAdaptiveLearnerStateServiceEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED === 'true';
}

export async function readEligibleLearnerStateFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
): Promise<Array<Record<string, unknown>>> {
  const findMany = db.learningFact?.findMany;
  if (!findMany) return [];

  const facts: Array<Record<string, unknown>> = [];
  let cursorId: string | null = null;
  while (facts.length < LEARNER_STATE_FACT_TAKE) {
    const rows = await findMany({
      where: { userId },
      orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
      take: LEARNER_STATE_FACT_TAKE,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    });
    facts.push(...rows
      .filter((fact) => isLearningFactEligibleForPersonalization(fact.contextJson))
      .slice(0, LEARNER_STATE_FACT_TAKE - facts.length));

    const nextCursorId = readString(rows.at(-1)?.id);
    if (rows.length < LEARNER_STATE_FACT_TAKE || !nextCursorId || nextCursorId === cursorId) {
      break;
    }
    cursorId = nextCursorId;
  }

  return facts;
}

export function reduceLearnerState(input: LearnerStateReducerInput): AdaptiveLearnerState {
  const {
    now,
    featureRead,
    featureCache,
    latestSnapshot,
    profileSummary,
    personalizationFacts,
    masteryFacts,
    masteryUpdates,
    latestAbility,
    riskFlags,
    paths,
    activeControlCorrectionPaths,
    controlCorrectionFacts,
    controlCorrectionArenaSubmissions,
    controlCorrectionAgentToolRuns,
    portraitResolution,
  } = input;
  const featureSimulationArena = getObject(getObject(featureCache.features).simulationArena);
  const featurePathExecution = getObject(getObject(featureCache.features).pathExecution);
  const {
    vector: legacyCompatibilityVector,
    source: compatibilitySource,
  } = portraitResolution.legacyCompatibility;
  const portraitCompatibility = deriveLearnerStateCompatibilityVector(
    portraitResolution.primaryPortrait,
    now,
    legacyCompatibilityVector,
  );
  const portraitCompatibilityVector = portraitCompatibility?.vector ?? null;
  const vector = portraitCompatibilityVector ?? legacyCompatibilityVector;
  const portraitDrivenVector = portraitResolution.primaryPortraitState === 'SNAPSHOT'
    ? (portraitCompatibilityVector ?? createEmptyCompetencyVector())
    : createEmptyCompetencyVector();
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: expose legacy provenance only for compatibility consumers.
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: map the compatibility source to the legacy output label.
  const source: AdaptiveLearnerState['primaryCompetencies']['source'] =
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: retain the legacy source label only for compatibility output.
    portraitCompatibility?.derivedDimensionCount === COMPETENCY_DIMENSIONS.length
      ? 'portrait-v2-derived'
      : portraitCompatibility && portraitCompatibility.derivedDimensionCount > 0
        ? 'portrait-v2-mixed'
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: expose legacy source names only when their fallback supplied the result.
      : compatibilitySource === 'StudentCompetencySnapshot'
      ? 'latest-snapshot'
      : compatibilitySource === 'StudentEvidenceFeatureCache'
        ? 'feature-cache'
        : 'fallback-empty';
  const primaryPortrait = portraitResolution.primaryPortrait;
  const knowledgeMastery = buildKnowledgeMastery(masteryUpdates, masteryFacts, now);
  const evidence = buildEvidenceSummary(featureRead, featureCache);
  const masteryTraceability = filterMasteryTraceabilityForRole(buildMasteryTraceability({
    knowledgeMastery,
    vector: portraitDrivenVector,
    facts: controlCorrectionFacts,
    arenaSubmissions: controlCorrectionArenaSubmissions,
    agentToolRuns: controlCorrectionAgentToolRuns,
    featureRead,
    evidence,
    now,
  }), input.role, now);
  const secondaryDimensions = buildSecondaryDimensions(portraitDrivenVector);
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
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: suppress legacy-source gaps only for a complete v2 projection.
    hasPortraitCompatibility: portraitCompatibility?.derivedDimensionCount === COMPETENCY_DIMENSIONS.length,
  });
  const goalSlices = buildAdaptiveGoalSlices({
    requestedGoal: input.requestedGoal,
    requestedGoalDefinition: input.requestedGoalDefinition,
    supportedGoalIds: input.supportedGoalIds ?? [],
    goalPluginAvailable: input.goalPluginAvailable,
    now,
    vector: portraitDrivenVector,
    primaryPortrait,
    usePrimaryPortrait: portraitResolution.primaryPortraitState === 'SNAPSHOT',
    evidence,
    knowledgeMastery,
    masteryTraceability,
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
      enabled: input.featureFlagEnabled,
      fallback: 'legacy-profile-summary-and-recommendation-consumers',
    },
    clientHints: {
      received: Boolean(input.clientHints && Object.keys(input.clientHints).length > 0),
      authoritative: false,
      reason: 'client-hints-non-authoritative',
    },
    primaryPortrait,
    primaryPortraitState: portraitResolution.primaryPortraitState,
    primaryPortraitAvailability: portraitResolution.primaryPortraitAvailability,
    primaryCompetencies: { // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: emit the compatibility slice only.
      authority: 'legacy-compatibility-only',
      source,
      vector,
    },
    secondaryDimensions,
    knowledgeMastery,
    masteryTraceability,
    resourcePreference: buildResourcePreference(personalizationFacts),
    mediaAbsorption: buildMediaAbsorption(personalizationFacts),
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

export async function resolveFencedAdaptivePortrait(
  db: AdaptiveLearnerStateDb,
  input: {
    userId: string;
    consumer: PortraitV2Consumer;
    now: Date;
    legacySnapshot: any;
  },
): Promise<PortraitResolution> {
  const currentRead = await readAuthorizedCumulativePortrait({
    db,
    viewer: viewerForPortraitConsumer(input.consumer, input.userId),
    targetUserId: input.userId,
    consumer: input.consumer,
  });
  const current = currentRead.portrait;
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: the legacy vector is retained only as non-authoritative compatibility output.
  const legacyVector = input.legacySnapshot?.competencyVector &&
    typeof input.legacySnapshot.competencyVector === 'object'
    ? input.legacySnapshot.competencyVector as CompetencyVector
    : createEmptyCompetencyVector();
  const authoritative = isAuthoritativeConsumerRead(currentRead);
  const primaryPortrait = authoritative && current.stateKind === 'SNAPSHOT' && current.payload
    ? current.payload
    : null;
  const primaryPortraitState = authoritative && current.stateKind === 'SNAPSHOT'
    ? 'SNAPSHOT' as const
    : currentRead.knownZero || current.stateKind === 'NO_EVIDENCE'
      ? 'NO_EVIDENCE' as const
      : 'UNAVAILABLE' as const;
  const primaryPortraitAvailability = authoritative && current.stateKind === 'SNAPSHOT'
    ? 'available'
    : currentRead.reason ?? current.availabilityReason;
  return {
    primaryPortrait,
    primaryPortraitState,
    primaryPortraitAvailability,
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this source label documents non-authoritative legacy provenance.
    legacyCompatibility: {
      authority: 'legacy-compatibility-only' as const,
      source: input.legacySnapshot ? 'StudentCompetencySnapshot' as const : 'fallback-empty' as const,
      vector: legacyVector,
      snapshotId: typeof input.legacySnapshot?.id === 'string' ? input.legacySnapshot.id : null,
      snapshotAt: input.legacySnapshot?.snapshotAt instanceof Date
        ? input.legacySnapshot.snapshotAt.toISOString()
        : input.now.toISOString(),
    },
    limitations: authoritative && current.stateKind === 'SNAPSHOT'
      ? []
      : [
        `cumulative-portrait-${current.availabilityReason}`,
        ...(currentRead.reason && currentRead.reason !== current.availabilityReason
          ? [`projection-${currentRead.reason}`]
          : []),
      ],
  };
}

function portraitConsumerForRole(role: AdaptiveLearnerStateRole): PortraitV2Consumer {
  if (role === 'admin') return 'admin';
  if (role === 'teacher') return 'reviewer';
  if (role === 'system') return 'planner';
  return 'student';
}

export function portraitConsumerForInput(input: AdaptiveLearnerStateInput): PortraitV2Consumer {
  return input.portraitConsumer ?? portraitConsumerForRole(input.role);
}

export async function readFeatureCache(
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

export async function attachPersistedArenaWritebacks(
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

function buildSecondaryDimensions(vector: CompetencyVector): AdaptiveLearnerState['secondaryDimensions'] { // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: derive secondary scores from the compatibility vector.
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

function deriveLearnerStateCompatibilityVector(
  portrait: PortraitV2ProjectedPayload | null,
  now: Date,
  fallback: CompetencyVector,
): { vector: CompetencyVector; derivedDimensionCount: number } | null {
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: project v2 dimensions into the legacy competency vector shape.
  if (!portrait) return null;
  if (!['native', 'migrated'].includes(portrait.derivation.kind)) return null;

  const entries: Array<[CompetencyDimension, CompetencyVector[CompetencyDimension]]> = [];
  let derivedDimensionCount = 0;
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: iterate non-authoritative legacy fields solely to build compatibility output.
  for (const dimension of COMPETENCY_DIMENSIONS) {
    const targetDimensions = mapLegacyCompetencyDimensionToPortraitV2(dimension).targetDimensions;
    const mapped = targetDimensions
      .map((id) => portrait.dimensions.find((item) => item.id === id))
      .filter((item): item is PortraitV2ProjectedPayload['dimensions'][number] => Boolean(
        item
          && item.evidenceSummary.totalCount > 0
          && isCurrentPortraitDimension(item, now),
      ));
    if (mapped.length !== targetDimensions.length) {
      entries.push([dimension, fallback[dimension]]);
      continue;
    }

    const trends = new Set(mapped.map((item) => item.trend ?? 'stable'));
    derivedDimensionCount += 1;
    entries.push([dimension, {
      score: mapped.reduce((sum, item) => sum + item.score, 0) / mapped.length,
      confidence: Math.min(...mapped.map((item) => item.confidence)),
      evidenceCount: Math.max(...mapped.map((item) => item.evidenceSummary.totalCount)),
      trend: trends.size === 1 ? [...trends][0] : 'stable',
      lastUpdated: oldestPortraitAsOf(mapped, portrait.generatedAt),
    }]);
  }

  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: downstream legacy-shaped fields use a validated v2 projection.
  return {
    vector: Object.fromEntries(entries) as unknown as CompetencyVector,
    derivedDimensionCount,
  };
}

function deriveControlCorrectionDimensionFromPortrait(
  portrait: PortraitV2ProjectedPayload | null,
  dimensionId: ControlCorrectionDimensionId,
  now: Date,
): CompetencyVector[CompetencyDimension] | null {
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: project each v2 goal dimension into its legacy vector field.
  if (!portrait) return null;
  const targetDimensions = mapAdaptiveGoalSliceDimensionToPortraitV2(dimensionId).targetDimensions;
  const mapped = targetDimensions
    .map((id) => portrait.dimensions.find((item) => item.id === id))
    .filter((item): item is PortraitV2ProjectedPayload['dimensions'][number] => Boolean(
      item && item.evidenceSummary.totalCount > 0 && isCurrentPortraitDimension(item, now),
    ));
  if (mapped.length !== targetDimensions.length) return null;
  const trends = new Set(mapped.map((item) => item.trend ?? 'stable'));
  return {
    score: mapped.reduce((sum, item) => sum + item.score, 0) / mapped.length,
    confidence: Math.min(...mapped.map((item) => item.confidence)),
    evidenceCount: Math.max(...mapped.map((item) => item.evidenceSummary.totalCount)),
    trend: trends.size === 1 ? [...trends][0] : 'stable',
    lastUpdated: oldestPortraitAsOf(mapped, portrait.generatedAt),
  };
}

function oldestPortraitAsOf(
  dimensions: PortraitV2ProjectedPayload['dimensions'],
  fallback: string,
): string {
  return dimensions
    .map((item) => item.freshness.asOf ?? fallback)
    .sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? fallback;
}

function isCurrentPortraitDimension(
  dimension: PortraitV2ProjectedPayload['dimensions'][number],
  now: Date,
): boolean {
  const asOf = dimension.freshness.asOf ? Date.parse(dimension.freshness.asOf) : Number.NaN;
  if (!Number.isFinite(asOf)) return false;
  const ageMs = now.getTime() - asOf;
  return ageMs >= 0
    && Math.floor(ageMs / 86_400_000) <= PORTRAIT_V2_FRESHNESS_CURRENT_MAX_AGE_DAYS;
}

function buildAdaptiveGoalSlices(input: {
  requestedGoal: string | null;
  requestedGoalDefinition: AdaptiveGoalSliceDefinition | null;
  supportedGoalIds: AdaptiveLearnerStateGoalId[];
  goalPluginAvailable: boolean;
  now: Date;
  vector: CompetencyVector; // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: goal slice may read the compatibility vector.
  primaryPortrait: PortraitV2ProjectedPayload | null;
  usePrimaryPortrait: boolean;
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
        supportedGoalIds: input.supportedGoalIds,
      },
    };
  }

  if (!input.goalPluginAvailable) {
    return {
      unsupported: {
        goalId: input.requestedGoal,
        state: 'unsupported-goal',
        fallbackReason: 'goal-plugin-unavailable',
        supportedGoalIds: input.supportedGoalIds,
      },
    };
  }

  if (input.requestedGoalDefinition.goalId === CONTROL_CORRECTION_GOAL_ID) {
    return {
      controlCorrection: buildControlCorrectionGoalSlice({
        now: input.now,
        vector: input.vector,
        primaryPortrait: input.primaryPortrait,
        usePrimaryPortrait: input.usePrimaryPortrait,
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
  vector: CompetencyVector; // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: goal slice may read the compatibility vector.
  primaryPortrait: PortraitV2ProjectedPayload | null;
  usePrimaryPortrait: boolean;
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
  const emptyVector = createEmptyCompetencyVector();
  const sourceEvidence = buildControlCorrectionSourceEvidence({
    facts: input.facts,
    arenaSubmissions: input.arenaSubmissions,
    masteryTraceability: input.masteryTraceability,
    simulationArena,
  });
  const dimensions = CONTROL_CORRECTION_GOAL_DIMENSIONS.map((id) => {
    const primary = input.usePrimaryPortrait
      ? deriveControlCorrectionDimensionFromPortrait(input.primaryPortrait, id, input.now)
        ?? emptyVector[CONTROL_CORRECTION_DIMENSION_PRIMARY[id]]
      : emptyVector[CONTROL_CORRECTION_DIMENSION_PRIMARY[id]];
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
      input.facts,
      input.arenaSubmissions,
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
  vector: CompetencyVector, // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: capability targets may read the compatibility vector.
  sourceEvidence: ControlCorrectionSourceEvidence,
  facts: Array<Record<string, unknown>>,
  arenaSubmissions: Array<Record<string, unknown>>,
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
    const eventReferences = projectStudentSafeEventReferences(
      traceabilityRefs,
      facts,
      arenaSubmissions,
    );
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
        eventReferences,
        sourceCoverage: traceability?.sourceCoverage ?? emptyMasterySourceCoverage(),
        freshness: traceability?.freshness ?? 'missing',
        limitations: unique([
          ...(traceability?.limitations ?? ['missing-governed-evidence']),
          ...(eventReferences.length === 0 ? ['missing-verifiable-event-reference'] : []),
        ]),
        source: 'adaptive-learner-state',
        recommendationBias: state === 'observed' ? 'targeted-practice' : 'starter-or-evidence-gathering',
      },
    };
  });
}

function projectStudentSafeEventReferences(
  refs: MasteryEvidenceReference[],
  facts: Array<Record<string, unknown>>,
  arenaSubmissions: Array<Record<string, unknown>>,
): StudentSafeEvidenceEventReference[] {
  const factById = new Map(facts
    .map((fact) => [readString(fact.id), fact] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  const arenaSubmissionById = new Map(arenaSubmissions
    .filter(isOfficialControlCorrectionArenaSubmission)
    .map((submission) => [readString(submission.id), submission] as const)
    .filter((entry): entry is [string, Record<string, unknown>] => Boolean(entry[0])));
  const projected = refs.flatMap((ref): StudentSafeEvidenceEventReference[] => {
    if (ref.privacyLevel !== 'student-visible') return [];
    if (ref.sourceType === 'LearningFact') {
      const fact = factById.get(ref.sourceId);
      if (!fact) return [];
      const source = inferStudentSafeEvidenceSource({
        factType: readString(fact.factType),
        moduleId: readString(fact.moduleId),
        lessonId: readString(fact.lessonId),
        sourceEventId: readString(fact.sourceEventId),
        contextJson: fact.contextJson,
      });
      const occurredAt = dateToIsoOrNull(fact.startedAt ?? ref.evidenceAt);
      return source && occurredAt ? [{ ...source, occurredAt }] : [];
    }
    if (ref.sourceType === 'ArenaSubmission') {
      const submission = arenaSubmissionById.get(ref.sourceId);
      const occurredAt = dateToIsoOrNull(submission?.submittedAt ?? ref.evidenceAt);
      if (!submission || !occurredAt) return [];
      return [{
        ...projectStudentSafeEvidenceSource({ sourceScope: 'arena-official-result' }),
        occurredAt,
      }];
    }
    return [];
  });
  const seen = new Set<string>();
  return projected
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
    .filter((reference) => {
      const key = `${reference.sourceScope}|${reference.occurredAt}|${reference.nextAction.href}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3);
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

function buildKnowledgeMastery(
  rows: Array<Record<string, unknown>>,
  facts: Array<Record<string, unknown>>,
  now: Date,
): AdaptiveLearnerState['knowledgeMastery'] {
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
    const answerId = readString(row.answerId);
    const linkedFactRefs = (answerId ? facts.filter((fact) =>
      adaptiveAssessmentAnswerIdFromFact(fact) === answerId
    ) : [])
      .map((fact) => masteryEvidenceRef(
        'LearningFact',
        readString(fact.id),
        fact.startedAt,
        'student-visible',
        confidenceLevel(confidence),
      ))
      .filter((ref): ref is MasteryEvidenceReference => Boolean(ref));
    const supportingEvidenceRefs = [
      ...(evidenceRef ? [evidenceRef] : []),
      ...linkedFactRefs,
    ];
    const eventReferences = projectStudentSafeEventReferences(linkedFactRefs, facts, []);
    const limitations = [
      ...(evidenceRef ? [] : ['missing-privacy-safe-evidence-ref']),
      ...(evidenceRef && isStaleEvidenceRef(evidenceRef, now) ? ['stale-evidence'] : []),
      ...(confidence < 0.45 ? ['low-confidence'] : []),
      ...(eventReferences.length === 0 ? ['missing-verifiable-event-reference'] : []),
    ];
    tags[knowledgeTag] = {
      posteriorMastery: round(numberValue(row.posteriorMastery), 2),
      confidence,
      evidenceCount: 1,
      source: 'adaptive-assessment',
      algorithmVersion: readString(row.algorithmVersion) ?? 'unknown',
      lastUpdatedAt: dateToIso(row.createdAt),
      freshness: freshnessForMastery(supportingEvidenceRefs, limitations),
      supportingEvidenceRefs,
      eventReferences,
      sourceCoverage: {
        ...emptyMasterySourceCoverage(),
        AdaptiveMasteryUpdate: 'available',
        LearningFact: linkedFactRefs.length > 0 ? 'available' : 'missing',
      },
      limitations: unique(limitations),
    };
  }
  return {
    coverage: Object.keys(tags).length > 0 ? 'available' : 'missing',
    tags,
  };
}

export async function readAdaptiveMasteryLearningFacts(
  db: AdaptiveLearnerStateDb,
  userId: string,
  masteryUpdates: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (!db.learningFact?.findMany) {
    return [];
  }

  const answerIds = latestMasteryAnswerIds(masteryUpdates);
  if (answerIds.length === 0) {
    return [];
  }

  const facts = await db.learningFact.findMany({
    where: {
      userId,
      sourceEventId: {
        in: answerIds.map((answerId) => `adaptive-assessment:${answerId}`),
      },
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
  });
  return facts.filter((fact) => isLearningFactEligibleForPersonalization(fact.contextJson));
}

function latestMasteryAnswerIds(rows: Array<Record<string, unknown>>): string[] {
  const seenKnowledgeTags = new Set<string>();
  const answerIds = new Set<string>();
  for (const row of rows) {
    const knowledgeTag = readString(row.knowledgeTag);
    if (!knowledgeTag || seenKnowledgeTags.has(knowledgeTag)) {
      continue;
    }
    seenKnowledgeTags.add(knowledgeTag);
    const answerId = readString(row.answerId);
    if (answerId) {
      answerIds.add(answerId);
    }
  }
  return [...answerIds];
}

function adaptiveAssessmentAnswerIdFromFact(fact: Record<string, unknown>): string | undefined {
  const context = getObject(fact.contextJson);
  const adaptiveAssessment = getObject(context.adaptiveAssessment);
  const adaptiveAssessmentRef = getObject(adaptiveAssessment.adaptiveAssessmentRef);
  return readString(adaptiveAssessmentRef.answerId) ?? undefined;
}

function buildMasteryTraceability(input: {
  knowledgeMastery: AdaptiveLearnerState['knowledgeMastery'];
  vector: CompetencyVector; // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: traceability may read the compatibility vector.
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
      : round(Math.min(...competencies.map((competency) => competency.confidence)), 2);
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
        'StudentEvidenceFeatureCache', // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: cache refs remain non-primary.
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
    StudentEvidenceFeatureCache: 'missing', // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: cache coverage is non-primary.
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
  if (!Number.isFinite(fallback) || fallback <= 0) {
    return round(refConfidence, 2);
  }
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
  hasPortraitCompatibility: boolean;
}): string[] {
  const missing: string[] = [];
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: complete v2 evidence replaces only legacy compatibility-source gaps.
  if (!input.latestSnapshot && !input.hasPortraitCompatibility) missing.push('StudentCompetencySnapshot');
  if (!input.profileSummary) missing.push('StudentProfileSummary');
  if (!input.featureRead.cache && !input.hasPortraitCompatibility) missing.push('StudentEvidenceFeatureCache');
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

function isOfficialArenaLearningFact(fact: Record<string, unknown>): boolean {
  const arena = getObject(getObject(fact.contextJson).arena);
  return arena.official === true || arena.evaluationMode === 'official';
}

function hasArenaTaskContext(fact: Record<string, unknown>): boolean {
  const arena = getObject(getObject(fact.contextJson).arena);
  return Boolean(readString(arena.taskId));
}

function summarizeControlCorrectionFacts(facts: Array<Record<string, unknown>>): ControlCorrectionScopedFactSummary {
  const counts = facts.reduce<ControlCorrectionFactCounts>((counts, fact) => {
    if (isOfficialArenaLearningFact(fact) || hasArenaTaskContext(fact)) {
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

export function uniqueFactsById(facts: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
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

export function asRecord(value: unknown): Record<string, unknown> {
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

export function normalizeRequestedGoal(value: string | null | undefined): string | null {
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
