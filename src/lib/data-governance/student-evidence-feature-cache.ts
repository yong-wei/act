import type { LearningFact } from '@prisma/client';
import type { LearningFactServingIdentity } from '@/lib/canonical-learning-fact-identity/contracts';
import { projectLearningFactServingIdentity } from '@/lib/canonical-learning-fact-identity/serving';
import {
  ADAPTIVE_LEARNING_GOAL_DEFINITIONS,
  isRegisteredAdaptiveLearningPathGoal,
} from '../adaptive-learning-path-planner';
import {
  COMPETENCY_DIMENSIONS,
  type CompetencyDimension,
} from './competency-model';
import {
  isLearningFactEligibleForPersonalization,
  resolveLearningFactProfileWeight,
} from './learning-fact-quality-weight';
import {
  PORTRAIT_V2_PAYLOAD_VERSION,
  validatePortraitV2Payload,
  type PortraitV2PayloadShape,
} from './portrait-v2-model';

export const STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION = 'student-evidence-features.v6';
export const STUDENT_EVIDENCE_ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION = 'adaptive-learner-state.v1';
export const STUDENT_EVIDENCE_FEATURE_RECENT_WINDOW_DAYS = 30;

export type StudentEvidenceFeatureLearningFact = Omit<LearningFact, 'createdAt'>;

export const STUDENT_EVIDENCE_FEATURE_LEARNING_FACT_SELECT = {
  id: true,
  userId: true,
  factType: true,
  moduleId: true,
  sessionId: true,
  startedAt: true,
  finishedAt: true,
  outcome: true,
  score: true,
  timeSpent: true,
  competencyContribution: true,
  sourceEventId: true,
  sourceLogId: true,
  courseId: true,
  lessonId: true,
  contextJson: true,
  // #1116 knowledge identity columns (nullable for historical rows)
  knowledgeIdentityNamespace: true,
  canonicalObjectId: true,
  aggregateReleaseSetId: true,
  aggregateReleaseId: true,
  knowledgeProjectionId: true,
  knowledgeRevisionRef: true,
} satisfies Record<keyof StudentEvidenceFeatureLearningFact, true>;

export const STUDENT_EVIDENCE_FEATURE_RAW_READ_EXCEPTIONS = [
  'audit',
  'debug',
  'drilldown',
  'migration',
] as const;

export type StudentEvidenceRawReadException =
  typeof STUDENT_EVIDENCE_FEATURE_RAW_READ_EXCEPTIONS[number];

export type StudentEvidenceCoverageState = 'available' | 'partial' | 'missing';
export type StudentEvidenceStatusMarker =
  | 'stale'
  | 'partial'
  | 'low-confidence'
  | 'missing-source'
  | 'mixed-knowledge-identity';

/**
 * Multi-era LearningFact identity coverage (#1116).
 * Aggregated competency scores may still sum raw contributions for continuity,
 * but mixed-namespace/revision diagnostics prevent recommendation from treating
 * the merged score as single-version evidence.
 */
export interface StudentEvidenceKnowledgeIdentityCoverage {
  totalFacts: number;
  byNamespace: Record<LearningFactServingIdentity['identityNamespace'], number>;
  distinctRevisionRefs: string[];
  mixedNamespaces: boolean;
  mixedRevisions: boolean;
  /** False when more than one namespace or more than one revision is present. */
  singleVersionComparable: boolean;
  availability: 'single-version' | 'mixed-version' | 'empty';
}

/**
 * Per-identity-layer aggregate: facts grouped by identityNamespace + revision.
 * Deterministic sort: namespace order, then revision ref.
 */
export interface StudentEvidenceKnowledgeIdentityLayer {
  layerKey: string;
  identityNamespace: LearningFactServingIdentity['identityNamespace'];
  knowledgeRevisionRef: string;
  factCount: number;
  evidenceWindow: StudentEvidenceWindow;
  activity: StudentEvidenceActivitySummary;
  competencyContributions: StudentEvidenceCompetencyContributions;
}

export interface StudentEvidenceMergedAggregateComparability {
  /**
   * True only when merged activity/competency fields are single-version safe.
   * When false, consumers must use knowledgeIdentityLayers for attribution.
   */
  singleVersionComparable: boolean;
  reason: 'single-layer' | 'mixed-layers' | 'empty';
  layerCount: number;
}
export type StudentSimulationArenaEvidenceSource = 'simulation' | 'arena';
export type StudentSimulationArenaEvidenceMarker =
  | 'low-confidence'
  | 'preview-only'
  | 'standalone-only'
  | 'stale'
  | 'partial';

export interface StudentSimulationArenaWeakMetric {
  metricId: string;
  affectedFactCount: number;
  lowestValue: number;
}

export interface StudentSimulationArenaReplayConfidence {
  average: number | null;
  highConfidenceCount: number;
  lowConfidenceCount: number;
  missingCount: number;
}

export interface StudentSimulationArenaTraceReference {
  source: StudentSimulationArenaEvidenceSource;
  traceReference: string;
  factId: string;
  sourceEventId: string | null;
  sourceLogId: string | null;
  startedAt: string;
  protocolVersion?: string;
  checksum?: string;
}

export interface StudentEvidenceWindow {
  firstStartedAt: string | null;
  lastStartedAt: string | null;
  daysCovered: number;
}

export interface StudentEvidenceActivitySummary {
  totalFacts: number;
  successfulFacts: number;
  partialFacts: number;
  failedFacts: number;
  averageScore: number | null;
  totalTimeSpentSeconds: number;
  distinctLessons: string[];
  distinctModules: string[];
}

export type StudentEvidenceCompetencyContributions = Record<CompetencyDimension, {
  averageContribution: number;
  evidenceCount: number;
  latestEvidenceAt: string | null;
}>;

export type StudentEvidenceSourceWindowKey =
  | 'activity30d'
  | 'activityAll'
  | 'competencyContributions30d'
  | 'competencyContributionsAll'
  | 'pathExecution30d'
  | 'pathExecutionAll';

export interface StudentSimulationArenaFeatureWindow {
  window: StudentEvidenceWindow;
  evidenceCount: number;
  completedCount: number;
  officialCount: number;
  previewCount: number;
  agentAssistedCount: number;
  courseLaunchedCount: number;
  standaloneCount: number;
  traceReferenceCount: number;
  sourceCoverage: Record<
    'simulation' | 'arena' | 'traceReferences' | 'replayConfidence',
    StudentEvidenceCoverageState
  >;
  replayConfidence: StudentSimulationArenaReplayConfidence;
  interventionOutcome: {
    reviewedCount: number;
    improvedCount: number;
    lowConfidenceCount: number;
  };
  weakMetrics: StudentSimulationArenaWeakMetric[];
  qualityMarkers: StudentSimulationArenaEvidenceMarker[];
  traceReferences: StudentSimulationArenaTraceReference[];
}

export interface StudentSimulationArenaFeatureSummary {
  recent30d: StudentSimulationArenaFeatureWindow;
  allTime: StudentSimulationArenaFeatureWindow;
}

export type StudentPathEvidenceSourceType =
  | 'LearningPathExecution'
  | 'LearningPathDeviation'
  | 'LearningPathIntervention';

export interface StudentPathEvidenceSourceReference {
  sourceType: StudentPathEvidenceSourceType;
  sourceId: string;
  pathId: string;
  goalId?: string;
  nodeId: string | null;
  occurredAt: string;
  privacyLevel: 'student-visible' | 'teacher-scoped';
  status?: string;
  resourceType?: string;
  deviationType?: string;
  interventionKind?: string;
  studentOutcome?: string;
  confidence?: 'low' | 'medium' | 'high' | 'unknown';
  terminalValidationState?: string;
  lowConfidenceMarkers?: string[];
  failureReasons?: string[];
}

export interface StudentPathEvidenceFeatureWindow {
  window: StudentEvidenceWindow;
  evidenceCount: number;
  adoptionCount: number;
  completionCount: number;
  deviationCount: number;
  fallbackCount: number;
  terminalValidationCount: number;
  sourceCoverage: Record<
    'adoption' | 'completion' | 'deviation' | 'fallback' | 'terminalValidation' | 'interventionOutcome',
    StudentEvidenceCoverageState
  >;
  confidence: {
    level: StudentEvidenceFeaturePayload['confidence']['level'];
    score: number;
    lowConfidenceCount: number;
  };
  interventionOutcome: {
    acceptedCount: number;
    completedCount: number;
    dismissedCount: number;
    ignoredCount: number;
    rejectedCount: number;
    partiallyAcceptedCount: number;
    lowConfidenceCount: number;
  };
  terminalValidation: {
    latestState: string | null;
    completedCount: number;
    failedCount: number;
    lowConfidenceCount: number;
    fallbackRequiredCount: number;
    lowConfidenceMarkers: string[];
    failureReasons: string[];
  };
  sourceReferences: StudentPathEvidenceSourceReference[];
}

export interface StudentPathEvidenceFeatureSummary {
  recent30d: StudentPathEvidenceFeatureWindow;
  allTime: StudentPathEvidenceFeatureWindow;
}

export interface StudentEvidenceFeaturePayload {
  userId: string;
  payloadVersion: string;
  evidenceWindow: StudentEvidenceWindow;
  sourceWindows: Record<StudentEvidenceSourceWindowKey, StudentEvidenceWindow>;
  sourceCounts: {
    LearningFact: number;
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy snapshot counts remain compatibility metadata.
    StudentCompetencySnapshot: number;
    StudentPortraitV2Snapshot: number;
    StudentProfileSummary: number;
    byFactType: Record<string, number>;
  };
  sourceCoverage: Record<
    'LearningFact' | 'StudentCompetencySnapshot' | 'StudentPortraitV2Snapshot' | 'StudentProfileSummary',
    StudentEvidenceCoverageState
  >;
  confidence: {
    level: 'none' | 'low' | 'medium' | 'high';
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
  };
  statusMarkers: StudentEvidenceStatusMarker[];
  /** Multi-era identity diagnostics for LearningFact aggregation. */
  knowledgeIdentityCoverage: StudentEvidenceKnowledgeIdentityCoverage;
  /**
   * Deterministic per-namespace+revision aggregates. Use these for attribution
   * when mergedAggregateComparability.singleVersionComparable is false.
   */
  knowledgeIdentityLayers: StudentEvidenceKnowledgeIdentityLayer[];
  /**
   * Marks whether merged activity/competency fields are single-version safe.
   * Merged fields remain for compatibility but are not comparable across layers.
   */
  mergedAggregateComparability: StudentEvidenceMergedAggregateComparability;
  features: {
    activity: StudentEvidenceActivitySummary;
    activity30d: StudentEvidenceActivitySummary;
    activityAll: StudentEvidenceActivitySummary;
    competencyContributions: StudentEvidenceCompetencyContributions;
    competencyContributions30d: StudentEvidenceCompetencyContributions;
    competencyContributionsAll: StudentEvidenceCompetencyContributions;
    simulationArena: StudentSimulationArenaFeatureSummary;
    pathExecution: StudentPathEvidenceFeatureSummary;
    adaptiveLearnerState: StudentEvidenceAdaptiveLearnerStateFeature;
    latestEvidence: {
      factType: string;
      outcome: string;
      score: number | null;
      moduleId: string | null;
      lessonId: string | null;
      startedAt: string;
    } | null;
    approvedAggregates: {
      latestSnapshot: {
        authority: 'legacy-compatibility-only';
        snapshotAt: string;
        factCount: number;
        calculationVersion: string;
        competencyVector: unknown;
      } | null;
      primaryPortrait: StudentEvidencePrimaryPortraitFeature | null;
      profileSummary: {
        updatedAt: string;
        overallScore: number;
        riskLevel: string;
        trendDirection: string;
      } | null;
    };
    /** Duplicated into features for Prisma JSON persistence (no schema migration). */
    knowledgeIdentityCoverage: StudentEvidenceKnowledgeIdentityCoverage;
    knowledgeIdentityLayers: StudentEvidenceKnowledgeIdentityLayer[];
    mergedAggregateComparability: StudentEvidenceMergedAggregateComparability;
  };
}

export interface StudentEvidencePrimaryPortraitFeature {
  authority: 'portrait-v2-primary';
  payloadVersion: typeof PORTRAIT_V2_PAYLOAD_VERSION;
  derivationKind: PortraitV2PayloadShape['derivation']['kind'];
  payload: PortraitV2PayloadShape;
}

export interface StudentEvidenceAdaptiveLearnerStateFeature {
  payloadVersion: typeof STUDENT_EVIDENCE_ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION;
  sourceWindows: Record<
    'learnerStateRecent30d' | 'learnerStateAllTime',
    StudentEvidenceWindow
  >;
  sourceCounts: {
    LearningFact: number;
    AdaptiveMasteryEvidence: number;
  };
  sourceCoverage: Record<
    | 'primaryCompetencies'
    | 'knowledgeMastery'
    | 'resourcePreference'
    | 'mediaAbsorption'
    | 'pathContext'
    | 'simulationArena',
    StudentEvidenceCoverageState
  >;
  confidence: {
    level: StudentEvidenceFeaturePayload['confidence']['level'];
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
    markers: StudentEvidenceStatusMarker[];
  };
}

interface StudentCompetencySnapshotAggregate {
  snapshotAt: Date;
  factCount: number;
  calculationVersion: string;
  competencyVector: unknown;
}

interface StudentPortraitV2SnapshotAggregate {
  payload: unknown;
}

interface StudentProfileSummaryAggregate {
  updatedAt: Date;
  overallScore: number;
  riskLevel: string;
  trendDirection: string;
}

interface BuildStudentEvidenceFeaturePayloadInput {
  userId: string;
  facts: StudentEvidenceFeatureLearningFact[];
  pathEvidence?: StudentPathEvidenceInput;
  latestSnapshot?: StudentCompetencySnapshotAggregate | null;
  latestPortraitV2?: StudentPortraitV2SnapshotAggregate | null;
  profileSummary?: StudentProfileSummaryAggregate | null;
  now?: Date;
  staleAfterDays?: number;
}

interface StudentEvidenceFeatureCacheDelegate {
  upsert?: (args: any) => Promise<Record<string, unknown>>;
  findUnique?: (args: any) => Promise<Record<string, unknown> | null>;
  findMany?: (args?: any) => Promise<Array<Record<string, unknown>>>;
  count?: (args?: any) => Promise<number>;
}

export interface StudentEvidenceFeatureCacheDb {
  learningFact?: {
    findMany: (args?: Record<string, unknown>) => Promise<Array<StudentEvidenceFeatureLearningFact | { userId: string }>>;
  };
  studentCompetencySnapshot?: {
    findMany?: (args?: Record<string, unknown>) => Promise<Array<{ userId: string }>>;
    findFirst: (args?: Record<string, unknown>) => Promise<StudentCompetencySnapshotAggregate | null>;
  };
  studentPortraitV2Snapshot?: {
    findFirst?: (args?: Record<string, unknown>) => Promise<StudentPortraitV2SnapshotAggregate | null>;
    findMany?: (args?: Record<string, unknown>) => Promise<Array<{ userId: string }>>;
  };
  studentProfileSummary?: {
    findMany?: (args?: Record<string, unknown>) => Promise<Array<{ userId: string }>>;
    findUnique: (args?: Record<string, unknown>) => Promise<StudentProfileSummaryAggregate | null>;
  };
  learningPathExecution?: StudentPathEvidenceDelegate;
  learningPathDeviation?: StudentPathEvidenceDelegate;
  learningPathIntervention?: StudentPathEvidenceDelegate;
  studentEvidenceFeatureCache: StudentEvidenceFeatureCacheDelegate;
}

interface StudentPathEvidenceDelegate {
  findMany: (args?: Record<string, unknown>) => Promise<Array<Record<string, any> | { userId: string }>>;
}

interface StudentPathEvidenceInput {
  executions: Array<Record<string, any>>;
  deviations: Array<Record<string, any>>;
  interventions: Array<Record<string, any>>;
}

export interface StudentEvidenceFeatureRefreshOptions {
  now?: Date;
  staleAfterDays?: number;
}

export interface StudentEvidenceFeatureRebuildResult {
  processedStudents: number;
  payloadVersion: string;
  rebuiltAt: string;
}

export interface StudentEvidenceFeatureReadResult {
  state: 'ready' | 'stale' | 'missing';
  cache: Record<string, unknown> | null;
  rawReadExceptions: StudentEvidenceRawReadException[];
}

export interface StudentEvidenceFeatureAdminSummary {
  payloadVersion: string;
  totalEntries: number;
  staleEntries: number;
  latestRefreshAt: string | null;
  totalSourceFacts: number;
  totalRebuilds: number;
  coverage: Record<string, Partial<Record<StudentEvidenceCoverageState, number>>>;
}

const DEFAULT_STALE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function buildStudentEvidenceFeaturePayload(
  input: BuildStudentEvidenceFeaturePayloadInput
): StudentEvidenceFeaturePayload {
  const now = input.now ?? new Date();
  const staleAfterDays = input.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const facts = input.facts
    .filter((fact) => isLearningFactEligibleForPersonalization(fact.contextJson))
    .sort(compareFacts);
  const factsWithSource = facts.filter((item) => Boolean(item.sourceEventId || item.sourceLogId));
  const recentFacts = filterRecentFacts(facts, now, STUDENT_EVIDENCE_FEATURE_RECENT_WINDOW_DAYS);
  const firstFact = facts[0] ?? null;
  const lastFact = facts[facts.length - 1] ?? null;
  const factEvidenceWindow = buildEvidenceWindow(firstFact, lastFact);
  const activityAll = buildActivitySummary(facts);
  const activity30d = buildActivitySummary(recentFacts);
  const competencyContributionsAll = buildCompetencyContributions(facts);
  const competencyContributions30d = buildCompetencyContributions(recentFacts);
  const simulationArena = buildSimulationArenaFeatures({
    facts,
    recentFacts,
    now,
    staleAfterDays,
  });
  const pathExecution = buildPathEvidenceFeatures({
    pathEvidence: input.pathEvidence ?? { executions: [], deviations: [], interventions: [] },
    now,
  });
  const evidenceWindow = mergeEvidenceWindows(factEvidenceWindow, pathExecution.allTime.window);
  const sourceWindows = {
    activity30d: buildFactsWindow(recentFacts),
    activityAll: factEvidenceWindow,
    competencyContributions30d: buildFactsWindow(filterContributionFacts(recentFacts)),
    competencyContributionsAll: buildFactsWindow(filterContributionFacts(facts)),
    pathExecution30d: pathExecution.recent30d.window,
    pathExecutionAll: pathExecution.allTime.window,
  } satisfies StudentEvidenceFeaturePayload['sourceWindows'];
  const byFactType = countByFactType(facts);
  const primaryPortrait = buildPrimaryPortraitFeature(input.latestPortraitV2, now);
  const hasPrimaryPortraitEvidence = Boolean(
    primaryPortrait?.payload.dimensions.some(
      (dimension) => dimension.evidenceSummary.totalCount > 0
    )
  );
  const sourceCoverage = {
    LearningFact: resolveLearningFactCoverage(facts.length, factsWithSource.length),
    StudentCompetencySnapshot: input.latestSnapshot ? 'available' : 'missing',
    StudentPortraitV2Snapshot: hasPrimaryPortraitEvidence ? 'available' : 'missing',
    StudentProfileSummary: input.profileSummary ? 'available' : 'missing',
  } satisfies StudentEvidenceFeaturePayload['sourceCoverage'];
  const confidence = buildConfidence(facts, factsWithSource.length);
  const combinedConfidence = mergeConfidence(confidence, pathExecution.allTime.evidenceCount);
  const knowledgeIdentityCoverage = buildKnowledgeIdentityCoverage(facts);
  const knowledgeIdentityLayers = buildKnowledgeIdentityLayers(facts);
  const mergedAggregateComparability: StudentEvidenceMergedAggregateComparability = {
    singleVersionComparable: knowledgeIdentityCoverage.singleVersionComparable,
    reason: facts.length === 0
      ? 'empty'
      : knowledgeIdentityCoverage.singleVersionComparable
        ? 'single-layer'
        : 'mixed-layers',
    layerCount: knowledgeIdentityLayers.length,
  };
  const statusMarkers = buildStatusMarkers({
    facts,
    pathEvidenceCount: pathExecution.allTime.evidenceCount,
    confidenceLevel: combinedConfidence.level,
    sourceCoverage,
    lastFactStartedAt: lastFact?.startedAt ?? null,
    now,
    staleAfterDays,
  });
  if (!knowledgeIdentityCoverage.singleVersionComparable && facts.length > 0) {
    if (!statusMarkers.includes('mixed-knowledge-identity')) {
      statusMarkers.push('mixed-knowledge-identity');
    }
    if (!statusMarkers.includes('partial')) {
      statusMarkers.push('partial');
    }
  }
  const adaptiveLearnerState = buildAdaptiveLearnerStateFeature({
    facts,
    recentFacts,
    latestSnapshot: input.latestSnapshot,
    hasPrimaryPortraitEvidence,
    profileSummary: input.profileSummary,
    confidence,
    statusMarkers,
    simulationArena,
    pathExecution,
  });

  return {
    userId: input.userId,
    payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    evidenceWindow,
    sourceWindows,
    sourceCounts: {
      LearningFact: facts.length,
      StudentCompetencySnapshot: input.latestSnapshot ? 1 : 0,
      StudentPortraitV2Snapshot: hasPrimaryPortraitEvidence ? 1 : 0,
      StudentProfileSummary: input.profileSummary ? 1 : 0,
      byFactType,
    },
    sourceCoverage,
    confidence: combinedConfidence,
    statusMarkers,
    knowledgeIdentityCoverage,
    knowledgeIdentityLayers,
    mergedAggregateComparability,
    features: {
      // Merged fields retained for compatibility. When
      // mergedAggregateComparability.singleVersionComparable is false they are
      // NOT single-version comparable — use knowledgeIdentityLayers instead.
      activity: activityAll,
      activity30d,
      activityAll,
      competencyContributions: competencyContributionsAll,
      competencyContributions30d,
      competencyContributionsAll,
      simulationArena,
      pathExecution,
      adaptiveLearnerState,
      latestEvidence: lastFact
        ? {
            factType: lastFact.factType,
            outcome: lastFact.outcome,
            score: lastFact.score,
            moduleId: lastFact.moduleId,
            lessonId: lastFact.lessonId,
            startedAt: lastFact.startedAt.toISOString(),
          }
        : null,
      approvedAggregates: {
        latestSnapshot: input.latestSnapshot
          ? {
              // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: retained only for historical compatibility reads.
              authority: 'legacy-compatibility-only',
              snapshotAt: input.latestSnapshot.snapshotAt.toISOString(),
              factCount: input.latestSnapshot.factCount,
              calculationVersion: input.latestSnapshot.calculationVersion,
              competencyVector: input.latestSnapshot.competencyVector,
            }
          : null,
        primaryPortrait,
        profileSummary: input.profileSummary
          ? {
              updatedAt: input.profileSummary.updatedAt.toISOString(),
              overallScore: input.profileSummary.overallScore,
              riskLevel: input.profileSummary.riskLevel,
              trendDirection: input.profileSummary.trendDirection,
            }
          : null,
      },
      // Persist identity diagnostics inside features JSON so the existing Prisma
      // StudentEvidenceFeatureCache.features column carries them without a migration.
      knowledgeIdentityCoverage,
      knowledgeIdentityLayers,
      mergedAggregateComparability,
    },
  };
}

function buildPrimaryPortraitFeature(
  snapshot: StudentPortraitV2SnapshotAggregate | null | undefined,
  now: Date,
): StudentEvidencePrimaryPortraitFeature | null {
  if (!snapshot?.payload) return null;
  try {
    validatePortraitV2Payload(snapshot.payload, { now });
    const payload = snapshot.payload as PortraitV2PayloadShape;
    return {
      authority: 'portrait-v2-primary',
      payloadVersion: PORTRAIT_V2_PAYLOAD_VERSION,
      derivationKind: payload.derivation.kind,
      payload,
    };
  } catch {
    return null;
  }
}

export async function refreshStudentEvidenceFeatureCache(
  db: StudentEvidenceFeatureCacheDb,
  userId: string,
  options: StudentEvidenceFeatureRefreshOptions = {}
): Promise<Record<string, unknown>> {
  if (!db.learningFact || !db.studentEvidenceFeatureCache.upsert) {
    throw new Error('student evidence feature cache refresh requires learningFact and cache upsert delegates');
  }

  const now = options.now ?? new Date();
  const [facts, latestSnapshot, latestPortraitV2, profileSummary] = await Promise.all([
    db.learningFact.findMany({
      where: { userId },
      orderBy: [{ startedAt: 'asc' }, { id: 'asc' }],
      select: STUDENT_EVIDENCE_FEATURE_LEARNING_FACT_SELECT,
    }) as Promise<StudentEvidenceFeatureLearningFact[]>,
    db.studentCompetencySnapshot?.findFirst({
      where: { userId },
      orderBy: [
        { snapshotAt: 'desc' },
        { id: 'desc' },
      ],
      select: {
        snapshotAt: true,
        factCount: true,
        calculationVersion: true,
        competencyVector: true,
      },
    }) ?? Promise.resolve(null),
    db.studentPortraitV2Snapshot?.findFirst?.({
      where: { userId },
      orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
      select: { payload: true },
    }) ?? Promise.resolve(null),
    db.studentProfileSummary?.findUnique({
      where: { userId },
      select: {
        updatedAt: true,
        overallScore: true,
        riskLevel: true,
        trendDirection: true,
      },
    }) ?? Promise.resolve(null),
  ]);
  const pathEvidence = await loadStudentPathEvidence(db, userId);
  const payload = buildStudentEvidenceFeaturePayload({
    userId,
    facts,
    pathEvidence,
    latestSnapshot,
    latestPortraitV2,
    profileSummary,
    now,
    staleAfterDays: options.staleAfterDays,
  });
  const refreshedAt = now;
  const lastSourceFactAt = payload.sourceWindows.activityAll.lastStartedAt
    ? new Date(payload.sourceWindows.activityAll.lastStartedAt)
    : null;
  const create = {
    userId,
    payloadVersion: payload.payloadVersion,
    features: payload.features,
    evidenceWindow: payload.evidenceWindow,
    sourceCounts: payload.sourceCounts,
    sourceCoverage: payload.sourceCoverage,
    freshness: {
      refreshedAt: refreshedAt.toISOString(),
      sourceLastUpdatedAt: payload.evidenceWindow.lastStartedAt,
      sourceWindows: payload.sourceWindows,
      staleAfterDays: options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS,
    },
    confidenceMarkers: payload.confidence,
    statusMarkers: payload.statusMarkers,
    sourceFactCount: payload.sourceCounts.LearningFact,
    lastSourceFactAt,
    refreshedAt,
    rebuiltAt: refreshedAt,
    rebuildCount: 1,
  };

  return db.studentEvidenceFeatureCache.upsert({
    where: { userId },
    create,
    update: {
      ...create,
      rebuildCount: { increment: 1 },
    },
  });
}

export async function rebuildStudentEvidenceFeatureCache(
  db: StudentEvidenceFeatureCacheDb,
  options: StudentEvidenceFeatureRefreshOptions = {}
): Promise<StudentEvidenceFeatureRebuildResult> {
  if (!db.learningFact) {
    throw new Error('student evidence feature cache rebuild requires learningFact delegate');
  }

  const [factRows, snapshotRows, portraitRows, profileRows] = await Promise.all([
    db.learningFact.findMany({
      select: { userId: true },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    }),
    db.studentCompetencySnapshot?.findMany?.({
      select: { userId: true },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    }) ?? Promise.resolve([]),
    db.studentPortraitV2Snapshot?.findMany?.({
      select: { userId: true },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    }) ?? Promise.resolve([]),
    db.studentProfileSummary?.findMany?.({
      select: { userId: true },
      orderBy: { userId: 'asc' },
    }) ?? Promise.resolve([]),
  ]);
  const [executionRows, deviationRows, interventionRows] = await Promise.all([
    db.learningPathExecution?.findMany({
      select: { userId: true },
      where: REGISTERED_LEARNING_PATH_EVIDENCE_WHERE,
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    }) ?? Promise.resolve([]),
    db.learningPathDeviation?.findMany({
      select: { userId: true },
      where: REGISTERED_LEARNING_PATH_EVIDENCE_WHERE,
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    }) ?? Promise.resolve([]),
    db.learningPathIntervention?.findMany({
      select: { userId: true },
      where: REGISTERED_LEARNING_PATH_EVIDENCE_WHERE,
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
    }) ?? Promise.resolve([]),
  ]);
  const userIds = uniqueSorted(
    [...factRows, ...snapshotRows, ...portraitRows, ...profileRows, ...executionRows, ...deviationRows, ...interventionRows]
      .map((row) => row.userId)
      .filter(isPresent)
  );

  for (const userId of userIds) {
    await refreshStudentEvidenceFeatureCache(db, userId, options);
  }

  return {
    processedStudents: userIds.length,
    payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    rebuiltAt: (options.now ?? new Date()).toISOString(),
  };
}

export async function readStudentEvidenceFeatures(
  db: Pick<StudentEvidenceFeatureCacheDb, 'studentEvidenceFeatureCache'>,
  userId: string,
  options: StudentEvidenceFeatureRefreshOptions = {}
): Promise<StudentEvidenceFeatureReadResult> {
  if (!db.studentEvidenceFeatureCache.findUnique) {
    throw new Error('student evidence feature read requires cache findUnique delegate');
  }

  const cache = await db.studentEvidenceFeatureCache.findUnique({ where: { userId } });
  if (!cache) {
    return {
      state: 'missing',
      cache: null,
      rawReadExceptions: [...STUDENT_EVIDENCE_FEATURE_RAW_READ_EXCEPTIONS],
    };
  }

  const compatibleCache = normalizeLegacyPortraitV2SourceFields(cache);
  const refreshedAt = compatibleCache.refreshedAt instanceof Date ? compatibleCache.refreshedAt : null;
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const staleByAge = refreshedAt
    ? (options.now ?? new Date()).getTime() - refreshedAt.getTime() > staleAfterDays * DAY_MS
    : true;
  const markers = Array.isArray(compatibleCache.statusMarkers) ? compatibleCache.statusMarkers : [];
  const staleByVersion = compatibleCache.payloadVersion !== STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION;
  const staleBySchema = !hasCurrentFeaturePayloadSchema(compatibleCache);

  return {
    state: staleByAge || markers.includes('stale') || staleBySchema ? 'stale' : 'ready',
    cache: staleByVersion ? null : compatibleCache,
    rawReadExceptions: [...STUDENT_EVIDENCE_FEATURE_RAW_READ_EXCEPTIONS],
  };
}

export async function getStudentEvidenceFeatureCacheAdminSummary(
  db: Pick<StudentEvidenceFeatureCacheDb, 'studentEvidenceFeatureCache'>,
  options: StudentEvidenceFeatureRefreshOptions = {}
): Promise<StudentEvidenceFeatureAdminSummary> {
  if (!db.studentEvidenceFeatureCache.count || !db.studentEvidenceFeatureCache.findMany) {
    return createEmptyAdminSummary();
  }

  const now = options.now ?? new Date();
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const staleCutoff = new Date(now.getTime() - staleAfterDays * DAY_MS);
  const [totalEntries, recentEntries] = await Promise.all([
    db.studentEvidenceFeatureCache.count(),
    db.studentEvidenceFeatureCache.findMany({
      orderBy: { refreshedAt: 'desc' },
      select: {
        refreshedAt: true,
        statusMarkers: true,
        sourceCoverage: true,
        sourceFactCount: true,
        rebuildCount: true,
      },
    }),
  ]);

  const coverage: StudentEvidenceFeatureAdminSummary['coverage'] = {};
  let totalSourceFacts = 0;
  let totalRebuilds = 0;
  let staleEntries = 0;
  let latestRefreshAt: string | null = null;

  for (const entry of recentEntries) {
    if (isStaleCacheEntry(entry, staleCutoff)) {
      staleEntries += 1;
    }
    if (entry.refreshedAt instanceof Date) {
      const candidate = entry.refreshedAt.toISOString();
      if (!latestRefreshAt || candidate > latestRefreshAt) {
        latestRefreshAt = candidate;
      }
    }
    totalSourceFacts += numberValue(entry.sourceFactCount);
    totalRebuilds += numberValue(entry.rebuildCount);
    const sourceCoverage = isObject(entry.sourceCoverage) ? entry.sourceCoverage : {};
    for (const [source, state] of Object.entries(sourceCoverage)) {
      if (!isCoverageState(state)) {
        continue;
      }
      coverage[source] ??= {};
      coverage[source][state] = (coverage[source][state] ?? 0) + 1;
    }
  }

  return {
    payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    totalEntries,
    staleEntries,
    latestRefreshAt,
    totalSourceFacts,
    totalRebuilds,
    coverage,
  };
}

function buildEvidenceWindow(
  firstFact: StudentEvidenceFeatureLearningFact | null,
  lastFact: StudentEvidenceFeatureLearningFact | null
): StudentEvidenceWindow {
  if (!firstFact || !lastFact) {
    return {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    };
  }

  return {
    firstStartedAt: firstFact.startedAt.toISOString(),
    lastStartedAt: lastFact.startedAt.toISOString(),
    daysCovered: Math.ceil((lastFact.startedAt.getTime() - firstFact.startedAt.getTime()) / DAY_MS),
  };
}

function buildFactsWindow(facts: StudentEvidenceFeatureLearningFact[]): StudentEvidenceWindow {
  return buildEvidenceWindow(facts[0] ?? null, facts.at(-1) ?? null);
}

function mergeEvidenceWindows(...windows: StudentEvidenceWindow[]): StudentEvidenceWindow {
  const dates = windows.flatMap((window) => [
    dateValue(window.firstStartedAt),
    dateValue(window.lastStartedAt),
  ]).filter((date): date is Date => Boolean(date));
  if (dates.length === 0) {
    return {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    };
  }
  const sorted = dates.sort((left, right) => left.getTime() - right.getTime());
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return {
    firstStartedAt: first.toISOString(),
    lastStartedAt: last.toISOString(),
    daysCovered: Math.ceil((last.getTime() - first.getTime()) / DAY_MS),
  };
}

function buildActivitySummary(facts: StudentEvidenceFeatureLearningFact[]): StudentEvidenceActivitySummary {
  const scoredFacts = facts.filter((item) => Number.isFinite(item.score));

  return {
    totalFacts: facts.length,
    successfulFacts: facts.filter((item) => item.outcome === 'success').length,
    partialFacts: facts.filter((item) => item.outcome === 'partial').length,
    failedFacts: facts.filter((item) => ['failure', 'abandoned'].includes(item.outcome)).length,
    averageScore: scoredFacts.length
      ? round(scoredFacts.reduce((sum, item) => sum + (item.score ?? 0), 0) / scoredFacts.length)
      : null,
    totalTimeSpentSeconds: facts.reduce((sum, item) => sum + (item.timeSpent ?? 0), 0),
    distinctLessons: uniqueSorted(facts.map((item) => item.lessonId).filter(isPresent)),
    distinctModules: uniqueSorted(facts.map((item) => item.moduleId).filter(isPresent)),
  };
}

async function loadStudentPathEvidence(
  db: StudentEvidenceFeatureCacheDb,
  userId: string,
): Promise<StudentPathEvidenceInput> {
  const orderBy = [{ createdAt: 'asc' }, { id: 'asc' }];
  const [executions, deviations, interventions] = await Promise.all([
    db.learningPathExecution?.findMany({
      where: { userId, ...REGISTERED_LEARNING_PATH_EVIDENCE_WHERE },
      orderBy,
      select: CONTROL_CORRECTION_PATH_EXECUTION_SELECT,
    }) ?? Promise.resolve([]),
    db.learningPathDeviation?.findMany({
      where: { userId, ...REGISTERED_LEARNING_PATH_EVIDENCE_WHERE },
      orderBy,
      select: CONTROL_CORRECTION_PATH_DEVIATION_SELECT,
    }) ?? Promise.resolve([]),
    db.learningPathIntervention?.findMany({
      where: { userId, ...REGISTERED_LEARNING_PATH_EVIDENCE_WHERE },
      orderBy,
      select: CONTROL_CORRECTION_PATH_INTERVENTION_SELECT,
    }) ?? Promise.resolve([]),
  ]);

  return {
    executions: (executions as Array<Record<string, any>>).filter(isRegisteredPathEvidenceRow),
    deviations: (deviations as Array<Record<string, any>>).filter(isRegisteredPathEvidenceRow),
    interventions: (interventions as Array<Record<string, any>>).filter(isRegisteredPathEvidenceRow),
  };
}

function isRegisteredPathEvidenceRow(row: Record<string, any>): boolean {
  const path = isObject(row.path) ? row.path : {};
  return typeof path.goalId === 'string' && isRegisteredAdaptiveLearningPathGoal(path.goalId);
}

const REGISTERED_LEARNING_PATH_EVIDENCE_WHERE = {
  path: { goalId: { in: Object.keys(ADAPTIVE_LEARNING_GOAL_DEFINITIONS) } },
} as const;

const CONTROL_CORRECTION_PATH_EXECUTION_SELECT = {
  id: true,
  pathId: true,
  userId: true,
  nodeId: true,
  resourceType: true,
  status: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  liftMetadata: true,
  idempotencyKey: true,
  createdAt: true,
  path: { select: { goalId: true, terminalValidation: true } },
} as const;

const CONTROL_CORRECTION_PATH_DEVIATION_SELECT = {
  id: true,
  pathId: true,
  userId: true,
  priorNodeId: true,
  deviationType: true,
  evidenceConfidence: true,
  idempotencyKey: true,
  createdAt: true,
  path: { select: { goalId: true } },
} as const;

const CONTROL_CORRECTION_PATH_INTERVENTION_SELECT = {
  id: true,
  pathId: true,
  userId: true,
  interventionKind: true,
  citedEvidence: true,
  studentOutcome: true,
  idempotencyKey: true,
  createdAt: true,
  path: { select: { goalId: true } },
} as const;

interface PathEvidenceEvent {
  dedupeKey: string;
  reference: StudentPathEvidenceSourceReference;
  adoption: boolean;
  completion: boolean;
  deviation: boolean;
  fallback: boolean;
  terminalValidation: boolean;
  interventionAccepted: boolean;
  interventionCompleted: boolean;
  interventionDismissed: boolean;
  interventionIgnored: boolean;
  interventionRejected: boolean;
  interventionPartiallyAccepted: boolean;
  lowConfidence: boolean;
}

function buildPathEvidenceFeatures(input: {
  pathEvidence: StudentPathEvidenceInput;
  now: Date;
}): StudentPathEvidenceFeatureSummary {
  const events = dedupePathEvidenceEvents([
    ...input.pathEvidence.executions.map(pathExecutionToEvent).filter(isPathEvidenceEvent),
    ...input.pathEvidence.deviations.map(pathDeviationToEvent).filter(isPathEvidenceEvent),
    ...input.pathEvidence.interventions.map(pathInterventionToEvent).filter(isPathEvidenceEvent),
  ]).sort((left, right) => {
    const byTime = new Date(left.reference.occurredAt).getTime() - new Date(right.reference.occurredAt).getTime();
    return byTime || left.reference.sourceId.localeCompare(right.reference.sourceId);
  });
  const recentCutoff = new Date(input.now.getTime() - STUDENT_EVIDENCE_FEATURE_RECENT_WINDOW_DAYS * DAY_MS);
  const recentEvents = events.filter((event) => new Date(event.reference.occurredAt).getTime() >= recentCutoff.getTime());

  return {
    recent30d: buildPathEvidenceWindow(recentEvents),
    allTime: buildPathEvidenceWindow(events),
  };
}

function isPathEvidenceEvent(value: PathEvidenceEvent | null): value is PathEvidenceEvent {
  return value !== null;
}

function pathExecutionToEvent(row: Record<string, any>): PathEvidenceEvent | null {
  const id = stringValue(row.id);
  const pathId = stringValue(row.pathId);
  const occurredAt = dateValue(row.completedAt) ?? dateValue(row.failedAt) ?? dateValue(row.startedAt) ?? dateValue(row.createdAt);
  if (!id || !pathId || !occurredAt) return null;
  const status = stringValue(row.status) ?? 'unknown';
  const resourceType = stringValue(row.resourceType) ?? 'unknown';
  const nodeId = stringValue(row.nodeId);
  const activityKind = readPathExecutionActivityKind(row);
  const nonCompletionActivity = activityKind !== null && NON_COMPLETION_PATH_ACTIVITY_KINDS.has(activityKind);
  const terminalValidation = readPathTerminalValidation(row);
  const terminalValidationState = stringValue(terminalValidation.state);
  const terminalValidationLowConfidenceMarkers = arrayOfStrings(terminalValidation.lowConfidenceMarkers);
  const terminalValidationFailureReasons = arrayOfStrings(terminalValidation.failureReasons);
  const terminalExecution = nodeId !== null && terminalValidation.nodeId === nodeId;
  const terminalFallbackRequired = terminalValidation.fallbackRequired === true ||
    terminalValidationState === 'failed' ||
    terminalValidationState === 'low-confidence';

  return {
    dedupeKey: pathDedupeKey('LearningPathExecution', row, id),
    reference: {
      sourceType: 'LearningPathExecution',
      sourceId: id,
      pathId,
      goalId: readPathEvidenceGoalId(row),
      nodeId,
      occurredAt: occurredAt.toISOString(),
      privacyLevel: 'student-visible',
      status,
      resourceType,
      ...(terminalExecution && terminalValidationState ? {
        terminalValidationState,
        lowConfidenceMarkers: terminalValidationLowConfidenceMarkers,
        failureReasons: terminalValidationFailureReasons,
      } : {}),
    },
    adoption: status === 'started',
    completion: status === 'completed' && !nonCompletionActivity,
    deviation: false,
    fallback: terminalExecution && terminalFallbackRequired,
    terminalValidation: terminalExecution,
    interventionAccepted: false,
    interventionCompleted: false,
    interventionDismissed: false,
    interventionIgnored: false,
    interventionRejected: false,
    interventionPartiallyAccepted: false,
    lowConfidence: terminalExecution && (
      terminalValidationState === 'low-confidence' ||
      terminalValidationLowConfidenceMarkers.length > 0
    ),
  };
}

function readPathEvidenceGoalId(row: Record<string, any>): string | undefined {
  const path = isObject(row.path) ? row.path : {};
  return stringValue(path.goalId) ?? undefined;
}

const NON_COMPLETION_PATH_ACTIVITY_KINDS = new Set([
  'continued-interaction',
  'review',
  'return-to-skipped',
  'external-resource-reference',
  'konling-support',
]);

function readPathExecutionActivityKind(row: Record<string, any>): string | null {
  const metadata = row.liftMetadata && typeof row.liftMetadata === 'object' && !Array.isArray(row.liftMetadata)
    ? row.liftMetadata as Record<string, unknown>
    : {};
  const value = metadata.pathActivityKind ?? metadata.activityKind;
  return typeof value === 'string' ? value : null;
}

function isTerminalPathExecution(row: Record<string, any>, nodeId: string | null): boolean {
  if (!nodeId) return false;
  const terminalValidation = readPathTerminalValidation(row);
  return terminalValidation.nodeId === nodeId;
}

function readPathTerminalValidation(row: Record<string, any>): Record<string, any> {
  const path = isObject(row.path) ? row.path : {};
  return isObject(path.terminalValidation)
    ? path.terminalValidation
    : isObject(row.terminalValidation)
      ? row.terminalValidation
      : {};
}

function pathDeviationToEvent(row: Record<string, any>): PathEvidenceEvent | null {
  const id = stringValue(row.id);
  const pathId = stringValue(row.pathId);
  const occurredAt = dateValue(row.createdAt);
  if (!id || !pathId || !occurredAt) return null;
  const deviationType = stringValue(row.deviationType) ?? 'unknown';
  const confidence = pathConfidence(row.evidenceConfidence);

  return {
    dedupeKey: pathDedupeKey('LearningPathDeviation', row, id),
    reference: {
      sourceType: 'LearningPathDeviation',
      sourceId: id,
      pathId,
      goalId: readPathEvidenceGoalId(row),
      nodeId: stringValue(row.priorNodeId),
      occurredAt: occurredAt.toISOString(),
      privacyLevel: 'student-visible',
      deviationType,
      confidence,
    },
    adoption: false,
    completion: false,
    deviation: true,
    fallback: deviationType === 'resource-failure' || deviationType === 'skip' || deviationType === 'timeout',
    terminalValidation: false,
    interventionAccepted: false,
    interventionCompleted: false,
    interventionDismissed: false,
    interventionIgnored: false,
    interventionRejected: false,
    interventionPartiallyAccepted: false,
    lowConfidence: confidence === 'low' || confidence === 'unknown',
  };
}

function pathInterventionToEvent(row: Record<string, any>): PathEvidenceEvent | null {
  const id = stringValue(row.id);
  const pathId = stringValue(row.pathId);
  const occurredAt = dateValue(row.createdAt);
  if (!id || !pathId || !occurredAt) return null;
  const interventionKind = stringValue(row.interventionKind) ?? 'unknown';
  const studentOutcome = stringValue(row.studentOutcome) ?? 'pending';
  const nodeId = readInterventionEvidenceNodeId(row.citedEvidence);

  return {
    dedupeKey: pathDedupeKey('LearningPathIntervention', row, id),
    reference: {
      sourceType: 'LearningPathIntervention',
      sourceId: id,
      pathId,
      goalId: readPathEvidenceGoalId(row),
      nodeId,
      occurredAt: occurredAt.toISOString(),
      privacyLevel: 'teacher-scoped',
      interventionKind,
      studentOutcome,
    },
    adoption: false,
    completion: false,
    deviation: false,
    fallback: false,
    terminalValidation: false,
    interventionAccepted: studentOutcome === 'accepted',
    interventionCompleted: studentOutcome === 'completed',
    interventionDismissed: studentOutcome === 'dismissed',
    interventionIgnored: studentOutcome === 'ignored' || studentOutcome === 'dismissed',
    interventionRejected: studentOutcome === 'rejected',
    interventionPartiallyAccepted: studentOutcome === 'partially-accepted',
    lowConfidence: false,
  };
}

function buildPathEvidenceWindow(events: PathEvidenceEvent[]): StudentPathEvidenceFeatureWindow {
  const evidenceCount = events.length;
  const lowConfidenceCount = events.filter((event) => event.lowConfidence).length;
  const score = evidenceCount === 0 ? 0 : round((evidenceCount - lowConfidenceCount * 0.5) / evidenceCount, 2);
  const terminalEvents = events.filter((event) => event.terminalValidation);
  const latestTerminalEvent = terminalEvents.at(-1) ?? null;

  return {
    window: buildPathEventWindow(events),
    evidenceCount,
    adoptionCount: events.filter((event) => event.adoption).length,
    completionCount: events.filter((event) => event.completion).length,
    deviationCount: events.filter((event) => event.deviation).length,
    fallbackCount: events.filter((event) => event.fallback).length,
    terminalValidationCount: events.filter((event) => event.terminalValidation).length,
    sourceCoverage: {
      adoption: resolveCoverageCount(events.filter((event) => event.adoption).length),
      completion: resolveCoverageCount(events.filter((event) => event.completion).length),
      deviation: resolveCoverageCount(events.filter((event) => event.deviation).length),
      fallback: resolveCoverageCount(events.filter((event) => event.fallback).length),
      terminalValidation: resolveCoverageCount(events.filter((event) => event.terminalValidation).length),
      interventionOutcome: resolveCoverageCount(events.filter((event) => (
        event.interventionAccepted ||
        event.interventionCompleted ||
        event.interventionDismissed ||
        event.interventionIgnored ||
        event.interventionRejected ||
        event.interventionPartiallyAccepted
      )).length),
    },
    confidence: {
      level: resolvePathConfidenceLevel(evidenceCount, lowConfidenceCount),
      score,
      lowConfidenceCount,
    },
    interventionOutcome: {
      acceptedCount: events.filter((event) => event.interventionAccepted).length,
      completedCount: events.filter((event) => event.interventionCompleted).length,
      dismissedCount: events.filter((event) => event.interventionDismissed).length,
      ignoredCount: events.filter((event) => event.interventionIgnored).length,
      rejectedCount: events.filter((event) => event.interventionRejected).length,
      partiallyAcceptedCount: events.filter((event) => event.interventionPartiallyAccepted).length,
      lowConfidenceCount,
    },
    terminalValidation: {
      latestState: latestTerminalEvent?.reference.terminalValidationState ?? null,
      completedCount: terminalEvents.filter((event) => event.reference.terminalValidationState === 'completed').length,
      failedCount: terminalEvents.filter((event) => event.reference.terminalValidationState === 'failed').length,
      lowConfidenceCount: terminalEvents.filter((event) => event.reference.terminalValidationState === 'low-confidence').length,
      fallbackRequiredCount: terminalEvents.filter((event) => event.fallback).length,
      lowConfidenceMarkers: uniqueSorted(terminalEvents.flatMap((event) => event.reference.lowConfidenceMarkers ?? [])),
      failureReasons: uniqueSorted(terminalEvents.flatMap((event) => event.reference.failureReasons ?? [])),
    },
    sourceReferences: events.map((event) => event.reference),
  };
}

function dedupePathEvidenceEvents(events: PathEvidenceEvent[]): PathEvidenceEvent[] {
  const byKey = new Map<string, PathEvidenceEvent>();
  for (const event of events) {
    if (!byKey.has(event.dedupeKey)) {
      byKey.set(event.dedupeKey, event);
    }
  }
  return [...byKey.values()];
}

function readInterventionEvidenceNodeId(citedEvidence: unknown): string | null {
  const evidence = Array.isArray(citedEvidence) ? citedEvidence : [];
  for (const entry of evidence) {
    if (!isObject(entry)) continue;
    const kind = stringValue(entry.kind) ?? stringValue(entry.sourceType);
    if (kind !== 'learning-path-node') continue;
    const nodeId = stringValue(entry.ref) ?? stringValue(entry.nodeId) ?? stringValue(entry.sourceId);
    if (nodeId) return nodeId;
  }
  return null;
}

function pathDedupeKey(sourceType: StudentPathEvidenceSourceType, row: Record<string, any>, fallbackId: string): string {
  const pathId = stringValue(row.pathId) ?? 'unknown-path';
  const idempotencyKey = stringValue(row.idempotencyKey);
  return idempotencyKey ? `${sourceType}:${pathId}:${idempotencyKey}` : `${sourceType}:${fallbackId}`;
}

const KNOWLEDGE_IDENTITY_NAMESPACE_ORDER: LearningFactServingIdentity['identityNamespace'][] = [
  'LEGACY_UNVERSIONED',
  'LEGACY',
  'CANONICAL',
];

function servingIdentityForFeatureFact(
  fact: StudentEvidenceFeatureLearningFact,
): LearningFactServingIdentity {
  return projectLearningFactServingIdentity({
    id: fact.id,
    knowledgeIdentityNamespace: fact.knowledgeIdentityNamespace,
    canonicalObjectId: fact.canonicalObjectId,
    aggregateReleaseSetId: fact.aggregateReleaseSetId,
    aggregateReleaseId: fact.aggregateReleaseId,
    knowledgeProjectionId: fact.knowledgeProjectionId,
    knowledgeRevisionRef: fact.knowledgeRevisionRef,
    contextJson: fact.contextJson,
  });
}

function knowledgeIdentityLayerKey(
  identity: Pick<LearningFactServingIdentity, 'identityNamespace' | 'knowledgeRevisionRef'>,
): string {
  return `${identity.identityNamespace}\u001f${identity.knowledgeRevisionRef}`;
}

export function buildKnowledgeIdentityCoverage(
  facts: readonly StudentEvidenceFeatureLearningFact[],
): StudentEvidenceKnowledgeIdentityCoverage {
  const byNamespace: StudentEvidenceKnowledgeIdentityCoverage['byNamespace'] = {
    LEGACY: 0,
    CANONICAL: 0,
    LEGACY_UNVERSIONED: 0,
  };
  const revisionRefs = new Set<string>();
  for (const fact of facts) {
    const identity = servingIdentityForFeatureFact(fact);
    byNamespace[identity.identityNamespace] += 1;
    revisionRefs.add(identity.knowledgeRevisionRef);
  }
  const activeNamespaces = (Object.entries(byNamespace) as Array<
    [LearningFactServingIdentity['identityNamespace'], number]
  >).filter(([, count]) => count > 0);
  const mixedNamespaces = activeNamespaces.length > 1;
  const mixedRevisions = revisionRefs.size > 1;
  const singleVersionComparable = facts.length > 0 && !mixedNamespaces && !mixedRevisions;
  return {
    totalFacts: facts.length,
    byNamespace,
    distinctRevisionRefs: [...revisionRefs].sort(),
    mixedNamespaces,
    mixedRevisions,
    singleVersionComparable,
    availability: facts.length === 0
      ? 'empty'
      : singleVersionComparable
        ? 'single-version'
        : 'mixed-version',
  };
}

/**
 * Group facts by serving identity namespace + revision and aggregate each layer
 * with the same activity/competency helpers used for merged fields.
 */
export function buildKnowledgeIdentityLayers(
  facts: readonly StudentEvidenceFeatureLearningFact[],
): StudentEvidenceKnowledgeIdentityLayer[] {
  const groups = new Map<string, {
    identityNamespace: LearningFactServingIdentity['identityNamespace'];
    knowledgeRevisionRef: string;
    facts: StudentEvidenceFeatureLearningFact[];
  }>();

  for (const fact of facts) {
    const identity = servingIdentityForFeatureFact(fact);
    const layerKey = knowledgeIdentityLayerKey(identity);
    const existing = groups.get(layerKey);
    if (existing) {
      existing.facts.push(fact);
      continue;
    }
    groups.set(layerKey, {
      identityNamespace: identity.identityNamespace,
      knowledgeRevisionRef: identity.knowledgeRevisionRef,
      facts: [fact],
    });
  }

  const layers = [...groups.entries()].map(([layerKey, group]) => {
    const orderedFacts = [...group.facts].sort(compareFacts);
    return {
      layerKey,
      identityNamespace: group.identityNamespace,
      knowledgeRevisionRef: group.knowledgeRevisionRef,
      factCount: orderedFacts.length,
      evidenceWindow: buildFactsWindow(orderedFacts),
      activity: buildActivitySummary(orderedFacts),
      competencyContributions: buildCompetencyContributions(orderedFacts),
    } satisfies StudentEvidenceKnowledgeIdentityLayer;
  });

  return layers.sort((left, right) => {
    const namespaceOrder = KNOWLEDGE_IDENTITY_NAMESPACE_ORDER.indexOf(left.identityNamespace)
      - KNOWLEDGE_IDENTITY_NAMESPACE_ORDER.indexOf(right.identityNamespace);
    if (namespaceOrder !== 0) return namespaceOrder;
    return left.knowledgeRevisionRef.localeCompare(right.knowledgeRevisionRef);
  });
}

function buildPathEventWindow(events: PathEvidenceEvent[]): StudentEvidenceWindow {
  if (events.length === 0) {
    return {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    };
  }
  const first = new Date(events[0].reference.occurredAt);
  const last = new Date(events[events.length - 1].reference.occurredAt);
  return {
    firstStartedAt: first.toISOString(),
    lastStartedAt: last.toISOString(),
    daysCovered: Math.ceil((last.getTime() - first.getTime()) / DAY_MS),
  };
}

function resolvePathConfidenceLevel(
  evidenceCount: number,
  lowConfidenceCount: number,
): StudentEvidenceFeaturePayload['confidence']['level'] {
  if (evidenceCount === 0) return 'none';
  if (evidenceCount >= 3 && lowConfidenceCount <= 1) return 'medium';
  return lowConfidenceCount > 0 ? 'low' : 'medium';
}

function pathConfidence(value: unknown): 'low' | 'medium' | 'high' | 'unknown' {
  return value === 'low' || value === 'medium' || value === 'high' || value === 'unknown' ? value : 'unknown';
}

function buildCompetencyContributions(
  facts: StudentEvidenceFeatureLearningFact[]
): StudentEvidenceFeaturePayload['features']['competencyContributions'] {
  const contributions = {} as StudentEvidenceFeaturePayload['features']['competencyContributions'];

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const dimensionValues = facts
      .map((item) => ({
        value: numberValue(
          isObject(item.competencyContribution) ? item.competencyContribution[dimension] : undefined,
        ) * resolveLearningFactProfileWeight(item.contextJson),
        startedAt: item.startedAt,
      }))
      .filter((item) => item.value !== 0);
    const latestEvidenceAt = dimensionValues.length
      ? dimensionValues
          .map((item) => item.startedAt)
          .sort((left, right) => left.getTime() - right.getTime())
          .at(-1)?.toISOString() ?? null
      : null;

    contributions[dimension] = {
      averageContribution: dimensionValues.length
        ? round(dimensionValues.reduce((sum, item) => sum + item.value, 0) / dimensionValues.length)
        : 0,
      evidenceCount: dimensionValues.length,
      latestEvidenceAt,
    };
  }

  return contributions;
}

interface BuildSimulationArenaFeaturesInput {
  facts: StudentEvidenceFeatureLearningFact[];
  recentFacts: StudentEvidenceFeatureLearningFact[];
  now: Date;
  staleAfterDays: number;
}

interface SimulationArenaFactEvidence {
  fact: StudentEvidenceFeatureLearningFact;
  source: StudentSimulationArenaEvidenceSource;
  completed: boolean;
  official: boolean;
  preview: boolean;
  agentAssisted: boolean;
  courseLaunched: boolean;
  standalone: boolean;
  replayConfidence: number | null;
  interventionOutcome: number | null;
  weakMetrics: Array<{ metricId: string; value: number }>;
  traceReference: StudentSimulationArenaTraceReference | null;
}

function buildSimulationArenaFeatures(
  input: BuildSimulationArenaFeaturesInput
): StudentSimulationArenaFeatureSummary {
  const allEvidence = input.facts
    .map(extractSimulationArenaFactEvidence)
    .filter((item): item is SimulationArenaFactEvidence => Boolean(item));
  const recentIds = new Set(input.recentFacts.map((fact) => fact.id));
  const recentEvidence = allEvidence.filter((item) => recentIds.has(item.fact.id));

  return {
    recent30d: buildSimulationArenaFeatureWindow(recentEvidence, input.now, input.staleAfterDays),
    allTime: buildSimulationArenaFeatureWindow(allEvidence, input.now, input.staleAfterDays),
  };
}

function buildAdaptiveLearnerStateFeature(input: {
  facts: StudentEvidenceFeatureLearningFact[];
  recentFacts: StudentEvidenceFeatureLearningFact[];
  latestSnapshot?: StudentCompetencySnapshotAggregate | null;
  hasPrimaryPortraitEvidence: boolean;
  profileSummary?: StudentProfileSummaryAggregate | null;
  confidence: StudentEvidenceFeaturePayload['confidence'];
  statusMarkers: StudentEvidenceStatusMarker[];
  simulationArena: StudentSimulationArenaFeatureSummary;
  pathExecution: StudentPathEvidenceFeatureSummary;
}): StudentEvidenceAdaptiveLearnerStateFeature {
  const masteryEvidenceCount = input.facts.filter(hasAdaptiveAssessmentMasteryEvidence).length;
  const mediaEvidenceCount = input.facts.filter((fact) => factTypeToLearnerModality(fact.factType) === 'media').length;
  const resourceEvidenceCount = input.facts.filter((fact) => Boolean(factTypeToLearnerModality(fact.factType))).length;

  return {
    payloadVersion: STUDENT_EVIDENCE_ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION,
    sourceWindows: {
      learnerStateRecent30d: buildFactsWindow(input.recentFacts),
      learnerStateAllTime: buildFactsWindow(input.facts),
    },
    sourceCounts: {
      LearningFact: input.facts.length,
      AdaptiveMasteryEvidence: masteryEvidenceCount,
    },
    sourceCoverage: {
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy primaryCompetencies is non-authoritative coverage.
      primaryCompetencies: input.latestSnapshot || input.hasPrimaryPortraitEvidence ? 'available' : 'missing',
      knowledgeMastery: resolveCoverageCount(masteryEvidenceCount),
      resourcePreference: resolveCoverageCount(resourceEvidenceCount),
      mediaAbsorption: resolveCoverageCount(mediaEvidenceCount),
      pathContext: resolveCoverageCount(input.pathExecution.allTime.evidenceCount),
      simulationArena: resolveCoverageCount(input.simulationArena.allTime.evidenceCount),
    },
    confidence: {
      level: input.confidence.level,
      score: input.confidence.score,
      evidenceCount: input.confidence.evidenceCount,
      sourceCompleteness: input.confidence.sourceCompleteness,
      markers: [...input.statusMarkers],
    },
  };
}

function hasAdaptiveAssessmentMasteryEvidence(fact: StudentEvidenceFeatureLearningFact): boolean {
  const context = isObject(fact.contextJson) ? fact.contextJson : {};
  const adaptiveAssessment = isObject(context.adaptiveAssessment) ? context.adaptiveAssessment : {};
  return fact.factType === 'question' && (
    finiteNumber(adaptiveAssessment.masteryPosterior) !== null ||
    finiteNumber(adaptiveAssessment.posteriorMastery) !== null ||
    finiteNumber(adaptiveAssessment.masteryConfidence) !== null
  );
}

function factTypeToLearnerModality(factType: string): string | null {
  if (factType === 'question' || factType === 'assessment') return 'assessment';
  if (factType === 'media' || factType === 'video' || factType === 'audio') return 'media';
  if (factType === 'simulation' || factType === 'design') return 'simulation';
  if (factType === 'reflection') return 'reflection';
  if (factType === 'resource') return 'resource';
  return null;
}

function buildSimulationArenaFeatureWindow(
  evidence: SimulationArenaFactEvidence[],
  now: Date,
  staleAfterDays: number
): StudentSimulationArenaFeatureWindow {
  const sorted = [...evidence].sort((left, right) => compareFacts(left.fact, right.fact));
  const evidenceCount = sorted.length;
  const traceReferences = sorted
    .map((item) => item.traceReference)
    .filter((item): item is StudentSimulationArenaTraceReference => Boolean(item));
  const replayValues = sorted
    .map((item) => item.replayConfidence)
    .filter((item): item is number => item !== null);
  const replayConfidence = {
    average: replayValues.length
      ? round(replayValues.reduce((sum, value) => sum + value, 0) / replayValues.length, 2)
      : null,
    highConfidenceCount: replayValues.filter((value) => value >= 0.75).length,
    lowConfidenceCount: replayValues.filter((value) => value < 0.5).length,
    missingCount: evidenceCount - replayValues.length,
  };
  const qualityMarkers = buildSimulationArenaQualityMarkers({
    evidence: sorted,
    replayConfidence,
    now,
    staleAfterDays,
  });

  return {
    window: buildFactsWindow(sorted.map((item) => item.fact)),
    evidenceCount,
    completedCount: sorted.filter((item) => item.completed).length,
    officialCount: sorted.filter((item) => item.official).length,
    previewCount: sorted.filter((item) => item.preview).length,
    agentAssistedCount: sorted.filter((item) => item.agentAssisted).length,
    courseLaunchedCount: sorted.filter((item) => item.courseLaunched).length,
    standaloneCount: sorted.filter((item) => item.standalone).length,
    traceReferenceCount: traceReferences.length,
    sourceCoverage: {
      simulation: resolveCoverageCount(sorted.filter((item) => item.source === 'simulation').length),
      arena: resolveCoverageCount(sorted.filter((item) => item.source === 'arena').length),
      traceReferences: resolveRequiredCoverage(evidenceCount, traceReferences.length),
      replayConfidence: resolveRequiredCoverage(evidenceCount, replayValues.length),
    },
    replayConfidence,
    interventionOutcome: buildSimulationArenaInterventionOutcome(sorted),
    weakMetrics: buildSimulationArenaWeakMetrics(sorted),
    qualityMarkers,
    traceReferences,
  };
}

function extractSimulationArenaFactEvidence(fact: StudentEvidenceFeatureLearningFact): SimulationArenaFactEvidence | null {
  const context = isObject(fact.contextJson) ? fact.contextJson : {};
  const arenaContext = isObject(context.arena) ? context.arena : null;
  const simulationContext =
    isObject(context.simulation) ? context.simulation :
    isObject(context.simulationTrace) ? context.simulationTrace :
    null;
  const agentToolContext = isObject(context.agentTool) ? context.agentTool : null;
  const historicalMaterialization = isObject(context.historicalMaterialization)
    ? context.historicalMaterialization
    : {};
  const source: StudentSimulationArenaEvidenceSource | null = arenaContext
    ? 'arena'
    : simulationContext || agentToolContext || fact.factType === 'simulation' || historicalMaterialization.sourceId === 'SimulationLog'
      ? 'simulation'
      : null;

  if (!source) {
    return null;
  }

  const sourceContext = source === 'arena'
    ? arenaContext ?? {}
    : simulationContext ?? agentToolContext ?? context;
  const trace = isObject(sourceContext.trace)
    ? sourceContext.trace
    : isObject(context.trace)
      ? context.trace
      : {};
  const envelope = isObject(trace.envelope) ? trace.envelope : {};
  const summary = isObject(sourceContext.summary)
    ? sourceContext.summary
    : isObject(trace.summary)
      ? trace.summary
      : {};
  const launchMode = readString(sourceContext.launchMode) ?? readString(context.launchMode);
  const official = resolveSimulationArenaOfficial(sourceContext, fact);
  const preview = resolveSimulationArenaPreview(sourceContext, fact, official);
  const agentAssisted = sourceContext.agentAssisted === true ||
    context.agentAssisted === true ||
    agentToolContext !== null ||
    isObject(context.agentTool) ||
    readString(sourceContext.sourceDomain)?.includes('konling') === true;
  const courseLaunched = resolveSimulationArenaCourseLaunched(fact, sourceContext, context, launchMode);
  const standalone = launchMode === 'standalone' || sourceContext.standalone === true || !courseLaunched;
  const traceReference = buildSimulationArenaTraceReference({
    source,
    fact,
    sourceContext,
    context,
    historicalMaterialization,
    envelope,
  });

  return {
    fact,
    source,
    completed: fact.outcome === 'success',
    official,
    preview,
    agentAssisted,
    courseLaunched,
    standalone,
    replayConfidence: resolveReplayConfidence(sourceContext, context, historicalMaterialization, envelope),
    interventionOutcome: resolveInterventionOutcome(sourceContext),
    weakMetrics: extractWeakMetrics(sourceContext, summary),
    traceReference,
  };
}

function resolveInterventionOutcome(sourceContext: Record<string, unknown>): number | null {
  const deterministicMetrics = isObject(sourceContext.deterministicMetrics)
    ? sourceContext.deterministicMetrics
    : {};
  const explicit =
    finiteNumber(sourceContext.interventionOutcome) ??
    finiteNumber(deterministicMetrics.interventionOutcome) ??
    finiteNumber(deterministicMetrics.outcomeScore);
  return explicit === null ? null : clamp01(explicit);
}

function resolveSimulationArenaOfficial(
  sourceContext: Record<string, unknown>,
  fact: StudentEvidenceFeatureLearningFact
): boolean {
  const evidenceWriteback = isObject(sourceContext.evidenceWriteback) ? sourceContext.evidenceWriteback : {};
  const acceptedPersistedWriteback = (fact.sourceEventId ?? '').startsWith('arena-official:') &&
    evidenceWriteback.status === 'accepted' &&
    evidenceWriteback.terminalValidationAccepted === true;
  return sourceContext.official === true ||
    sourceContext.evaluationMode === 'official' ||
    sourceContext.evaluationVisibility === 'official' ||
    acceptedPersistedWriteback;
}

function resolveSimulationArenaPreview(
  sourceContext: Record<string, unknown>,
  fact: StudentEvidenceFeatureLearningFact,
  official: boolean
): boolean {
  if (official) {
    return false;
  }
  const sourceEventId = fact.sourceEventId ?? '';
  return sourceContext.preview === true ||
    sourceContext.previewOnly === true ||
    sourceContext.evaluationMode === 'preview' ||
    sourceContext.evaluationVisibility === 'preview' ||
    sourceEventId.includes('arena_simulation_run') ||
    sourceEventId.includes('arena_virtual_simulation_import');
}

function resolveSimulationArenaCourseLaunched(
  fact: StudentEvidenceFeatureLearningFact,
  sourceContext: Record<string, unknown>,
  context: Record<string, unknown>,
  launchMode: string | null
): boolean {
  if (launchMode === 'standalone') {
    return false;
  }
  if (launchMode === 'course-resource') {
    return true;
  }
  return Boolean(
    fact.sessionId ||
    fact.lessonId ||
    fact.courseId ||
    readString(sourceContext.classId) ||
    readString(context.classId) ||
    readString(sourceContext.courseId) ||
    readString(context.courseId)
  );
}

function buildSimulationArenaTraceReference(input: {
  source: StudentSimulationArenaEvidenceSource;
  fact: StudentEvidenceFeatureLearningFact;
  sourceContext: Record<string, unknown>;
  context: Record<string, unknown>;
  historicalMaterialization: Record<string, unknown>;
  envelope: Record<string, unknown>;
}): StudentSimulationArenaTraceReference | null {
  const traceReference =
    readString(input.sourceContext.traceReference) ??
    readString(input.context.traceReference) ??
    readString(input.historicalMaterialization.traceReference) ??
    readString(input.envelope.runId);

  if (!traceReference) {
    return null;
  }

  return compactObject({
    source: input.source,
    traceReference,
    factId: input.fact.id,
    sourceEventId: input.fact.sourceEventId,
    sourceLogId: input.fact.sourceLogId,
    startedAt: input.fact.startedAt.toISOString(),
    protocolVersion:
      readString(input.sourceContext.protocolVersion) ??
      readString(input.context.protocolVersion) ??
      readString(input.envelope.protocolVersion) ??
      undefined,
    checksum:
      readString(input.sourceContext.checksum) ??
      readString(input.context.checksum) ??
      readString(input.envelope.checksum) ??
      undefined,
  }) as unknown as StudentSimulationArenaTraceReference;
}

function resolveReplayConfidence(
  sourceContext: Record<string, unknown>,
  context: Record<string, unknown>,
  historicalMaterialization: Record<string, unknown>,
  envelope: Record<string, unknown>
): number | null {
  const explicit =
    finiteNumber(sourceContext.replayConfidence) ??
    finiteNumber(context.replayConfidence);
  if (explicit !== null) {
    return clamp01(explicit);
  }

  const historicalConfidence = readString(historicalMaterialization.confidence);
  if (historicalConfidence === 'high') return 0.85;
  if (historicalConfidence === 'low') return 0.35;

  if (readString(envelope.checksum) && readString(envelope.protocolVersion)) {
    return 0.8;
  }

  return null;
}

function extractWeakMetrics(
  sourceContext: Record<string, unknown>,
  summary: Record<string, unknown>
): Array<{ metricId: string; value: number }> {
  const explicitWeakMetrics = Array.isArray(sourceContext.weakMetrics)
    ? sourceContext.weakMetrics
    : Array.isArray(summary.weakMetrics)
      ? summary.weakMetrics
      : [];
  const weakMetrics: Array<{ metricId: string; value: number }> = [];

  for (const entry of explicitWeakMetrics) {
    if (!isObject(entry)) continue;
    const metricId = readString(entry.metricId) ?? readString(entry.id);
    const value =
      finiteNumber(entry.lowestValue) ??
      finiteNumber(entry.value) ??
      finiteNumber(entry.satisfaction);
    if (metricId && value !== null) {
      weakMetrics.push({ metricId, value: round(value, 2) });
    }
  }

  const satisfaction = isObject(sourceContext.satisfaction)
    ? sourceContext.satisfaction
    : isObject(summary.satisfaction)
      ? summary.satisfaction
      : {};
  for (const [metricId, value] of Object.entries(satisfaction)) {
    const numeric = finiteNumber(value);
    if (numeric !== null && numeric < 0.6) {
      weakMetrics.push({ metricId, value: round(numeric, 2) });
    }
  }

  return weakMetrics;
}

function buildSimulationArenaWeakMetrics(
  evidence: SimulationArenaFactEvidence[]
): StudentSimulationArenaWeakMetric[] {
  const metrics = new Map<string, { affectedFactIds: Set<string>; lowestValue: number }>();

  for (const item of evidence) {
    for (const metric of item.weakMetrics) {
      const current = metrics.get(metric.metricId) ?? {
        affectedFactIds: new Set<string>(),
        lowestValue: metric.value,
      };
      current.affectedFactIds.add(item.fact.id);
      current.lowestValue = Math.min(current.lowestValue, metric.value);
      metrics.set(metric.metricId, current);
    }
  }

  return Array.from(metrics.entries())
    .map(([metricId, entry]) => ({
      metricId,
      affectedFactCount: entry.affectedFactIds.size,
      lowestValue: round(entry.lowestValue, 2),
    }))
    .sort((left, right) => left.metricId.localeCompare(right.metricId));
}

function buildSimulationArenaInterventionOutcome(
  evidence: SimulationArenaFactEvidence[]
): StudentSimulationArenaFeatureWindow['interventionOutcome'] {
  const outcomes = evidence
    .map((item) => item.interventionOutcome)
    .filter((value): value is number => value !== null);
  return {
    reviewedCount: outcomes.length,
    improvedCount: outcomes.filter((value) => value >= 0.6).length,
    lowConfidenceCount: evidence.filter((item) => item.agentAssisted && item.interventionOutcome === null).length,
  };
}

function buildSimulationArenaQualityMarkers(input: {
  evidence: SimulationArenaFactEvidence[];
  replayConfidence: StudentSimulationArenaReplayConfidence;
  now: Date;
  staleAfterDays: number;
}): StudentSimulationArenaEvidenceMarker[] {
  const markers = new Set<StudentSimulationArenaEvidenceMarker>();
  const { evidence } = input;
  if (evidence.length === 0) {
    return [];
  }

  const lastFact = evidence[evidence.length - 1]?.fact;
  if (lastFact && input.now.getTime() - lastFact.startedAt.getTime() > input.staleAfterDays * DAY_MS) {
    markers.add('stale');
  }
  if (evidence.some((item) => ['partial', 'failure', 'abandoned'].includes(item.fact.outcome))) {
    markers.add('partial');
  }
  if (
    input.replayConfidence.lowConfidenceCount > 0 ||
    input.replayConfidence.missingCount > 0 ||
    (input.replayConfidence.average !== null && input.replayConfidence.average < 0.5)
  ) {
    markers.add('low-confidence');
  }
  if (evidence.every((item) => item.preview)) {
    markers.add('preview-only');
  }
  if (evidence.every((item) => item.standalone)) {
    markers.add('standalone-only');
  }

  return Array.from(markers).sort();
}

function resolveCoverageCount(count: number): StudentEvidenceCoverageState {
  return count > 0 ? 'available' : 'missing';
}

function resolveRequiredCoverage(total: number, available: number): StudentEvidenceCoverageState {
  if (total === 0 || available === 0) {
    return 'missing';
  }
  return available === total ? 'available' : 'partial';
}

function filterRecentFacts(
  facts: StudentEvidenceFeatureLearningFact[],
  now: Date,
  windowDays: number
): StudentEvidenceFeatureLearningFact[] {
  const cutoff = new Date(now.getTime() - windowDays * DAY_MS);
  return facts.filter((fact) => fact.startedAt >= cutoff);
}

function filterContributionFacts(facts: StudentEvidenceFeatureLearningFact[]): StudentEvidenceFeatureLearningFact[] {
  return facts.filter((fact) => {
    if (resolveLearningFactProfileWeight(fact.contextJson) <= 0) return false;
    const contribution = isObject(fact.competencyContribution) ? fact.competencyContribution : {};
    return COMPETENCY_DIMENSIONS.some((dimension) => numberValue(contribution[dimension]) !== 0);
  });
}

function buildConfidence(
  facts: StudentEvidenceFeatureLearningFact[],
  factsWithSourceCount: number
): StudentEvidenceFeaturePayload['confidence'] {
  if (facts.length === 0) {
    return {
      level: 'none',
      score: 0,
      evidenceCount: 0,
      sourceCompleteness: 0,
    };
  }

  const evidenceComponent = Math.min(facts.length / 5, 1);
  const sourceCompleteness = factsWithSourceCount / facts.length;
  const scoredFacts = facts.filter((item) => Number.isFinite(item.score));
  const scoreComponent = scoredFacts.length
    ? scoredFacts.reduce((sum, item) => sum + (item.score ?? 0), 0) / scoredFacts.length / 100
    : 0.5;
  const score = round((evidenceComponent * 0.45) + (sourceCompleteness * 0.35) + (scoreComponent * 0.2), 2);
  const level = score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low';

  return {
    level,
    score,
    evidenceCount: facts.length,
    sourceCompleteness: round(sourceCompleteness, 2),
  };
}

function mergeConfidence(
  factConfidence: StudentEvidenceFeaturePayload['confidence'],
  pathEvidenceCount: number,
): StudentEvidenceFeaturePayload['confidence'] {
  if (pathEvidenceCount === 0) return factConfidence;
  if (factConfidence.evidenceCount > 0) {
    return {
      ...factConfidence,
      evidenceCount: factConfidence.evidenceCount + pathEvidenceCount,
    };
  }
  const score = Math.min(pathEvidenceCount / 5, 1) * 0.45;
  return {
    level: score >= 0.45 ? 'medium' : 'low',
    score: round(score, 2),
    evidenceCount: pathEvidenceCount,
    sourceCompleteness: 1,
  };
}

function buildStatusMarkers(input: {
  facts: StudentEvidenceFeatureLearningFact[];
  pathEvidenceCount: number;
  confidenceLevel: StudentEvidenceFeaturePayload['confidence']['level'];
  sourceCoverage: StudentEvidenceFeaturePayload['sourceCoverage'];
  lastFactStartedAt: Date | null;
  now: Date;
  staleAfterDays: number;
}): StudentEvidenceStatusMarker[] {
  const markers = new Set<StudentEvidenceStatusMarker>();

  if (
    input.pathEvidenceCount === 0 &&
    (!input.lastFactStartedAt || input.now.getTime() - input.lastFactStartedAt.getTime() > input.staleAfterDays * DAY_MS)
  ) {
    markers.add('stale');
  }
  if (input.facts.some((item) => ['partial', 'failure', 'abandoned'].includes(item.outcome))) {
    markers.add('partial');
  }
  if (['none', 'low'].includes(input.confidenceLevel)) {
    markers.add('low-confidence');
  }
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: either primary portrait or legacy compatibility may satisfy coverage.
  const primaryCompetenciesMissing = (
    input.sourceCoverage.StudentCompetencySnapshot !== 'available' &&
    input.sourceCoverage.StudentPortraitV2Snapshot !== 'available'
  );
  if (
    input.sourceCoverage.LearningFact !== 'available' ||
    primaryCompetenciesMissing ||
    input.sourceCoverage.StudentProfileSummary !== 'available'
  ) {
    markers.add('missing-source');
  }

  return Array.from(markers).sort();
}

function countByFactType(facts: StudentEvidenceFeatureLearningFact[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const fact of facts) {
    counts[fact.factType] = (counts[fact.factType] ?? 0) + 1;
  }

  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function resolveLearningFactCoverage(totalFacts: number, factsWithSourceCount: number): StudentEvidenceCoverageState {
  if (totalFacts === 0) {
    return 'missing';
  }
  if (factsWithSourceCount < totalFacts) {
    return 'partial';
  }
  return 'available';
}

function compareFacts(left: StudentEvidenceFeatureLearningFact, right: StudentEvidenceFeatureLearningFact): number {
  const timeDifference = left.startedAt.getTime() - right.startedAt.getTime();
  if (timeDifference !== 0) {
    return timeDifference;
  }
  return left.id.localeCompare(right.id);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value);
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringValue(value: unknown): string | null {
  return readString(value);
}

function dateValue(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  );
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCoverageState(value: unknown): value is StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing';
}

function normalizeLegacyPortraitV2SourceFields(
  cache: Record<string, unknown>
): Record<string, unknown> {
  if (!isObject(cache.sourceCounts) || !isObject(cache.sourceCoverage)) {
    return cache;
  }

  const missingCount = cache.sourceCounts.StudentPortraitV2Snapshot === undefined;
  const missingCoverage = cache.sourceCoverage.StudentPortraitV2Snapshot === undefined;
  if (!missingCount || !missingCoverage) {
    return cache;
  }

  return {
    ...cache,
    sourceCounts: {
      ...cache.sourceCounts,
      StudentPortraitV2Snapshot: 0,
    },
    sourceCoverage: {
      ...cache.sourceCoverage,
      StudentPortraitV2Snapshot: 'missing',
    },
  };
}

function hasCurrentFeaturePayloadSchema(cache: Record<string, unknown>): boolean {
  if (cache.payloadVersion !== STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION) {
    return false;
  }
  const features = isObject(cache.features) ? cache.features : {};
  const sourceCounts = isObject(cache.sourceCounts) ? cache.sourceCounts : {};
  const sourceCoverage = isObject(cache.sourceCoverage) ? cache.sourceCoverage : {};
  const simulationArena = isObject(features.simulationArena) ? features.simulationArena : {};
  const pathExecution = isObject(features.pathExecution) ? features.pathExecution : {};
  const adaptiveLearnerState = isObject(features.adaptiveLearnerState) ? features.adaptiveLearnerState : {};
  return hasFiniteNumber(sourceCounts.StudentPortraitV2Snapshot) &&
    isCoverageState(sourceCoverage.StudentPortraitV2Snapshot) &&
    hasSimulationArenaFeatureWindowSchema(simulationArena.recent30d) &&
    hasSimulationArenaFeatureWindowSchema(simulationArena.allTime) &&
    hasPathEvidenceFeatureWindowSchema(pathExecution.recent30d) &&
    hasPathEvidenceFeatureWindowSchema(pathExecution.allTime) &&
    hasAdaptiveLearnerStateFeatureSchema(adaptiveLearnerState);
}

function hasAdaptiveLearnerStateFeatureSchema(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  const sourceWindows = isObject(value.sourceWindows) ? value.sourceWindows : {};
  const sourceCounts = isObject(value.sourceCounts) ? value.sourceCounts : {};
  const sourceCoverage = isObject(value.sourceCoverage) ? value.sourceCoverage : {};
  const confidence = isObject(value.confidence) ? value.confidence : {};

  return value.payloadVersion === STUDENT_EVIDENCE_ADAPTIVE_LEARNER_STATE_PAYLOAD_VERSION &&
    hasEvidenceWindowSchema(sourceWindows.learnerStateRecent30d) &&
    hasEvidenceWindowSchema(sourceWindows.learnerStateAllTime) &&
    hasFiniteNumber(sourceCounts.LearningFact) &&
    hasFiniteNumber(sourceCounts.AdaptiveMasteryEvidence) &&
    isCoverageState(sourceCoverage.primaryCompetencies) &&
    isCoverageState(sourceCoverage.knowledgeMastery) &&
    isCoverageState(sourceCoverage.resourcePreference) &&
    isCoverageState(sourceCoverage.mediaAbsorption) &&
    isCoverageState(sourceCoverage.pathContext) &&
    isCoverageState(sourceCoverage.simulationArena) &&
    (
      confidence.level === 'none' ||
      confidence.level === 'low' ||
      confidence.level === 'medium' ||
      confidence.level === 'high'
    ) &&
    hasFiniteNumber(confidence.score) &&
    hasFiniteNumber(confidence.evidenceCount) &&
    hasFiniteNumber(confidence.sourceCompleteness) &&
    hasStatusMarkersSchema(confidence.markers);
}

function hasSimulationArenaFeatureWindowSchema(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  const sourceCoverage = isObject(value.sourceCoverage) ? value.sourceCoverage : {};
  const replayConfidence = isObject(value.replayConfidence) ? value.replayConfidence : {};

  return hasEvidenceWindowSchema(value.window) &&
    hasFiniteNumber(value.evidenceCount) &&
    hasFiniteNumber(value.completedCount) &&
    hasFiniteNumber(value.officialCount) &&
    hasFiniteNumber(value.previewCount) &&
    hasFiniteNumber(value.agentAssistedCount) &&
    hasFiniteNumber(value.courseLaunchedCount) &&
    hasFiniteNumber(value.standaloneCount) &&
    hasFiniteNumber(value.traceReferenceCount) &&
    isCoverageState(sourceCoverage.simulation) &&
    isCoverageState(sourceCoverage.arena) &&
    isCoverageState(sourceCoverage.traceReferences) &&
    isCoverageState(sourceCoverage.replayConfidence) &&
    (replayConfidence.average === null || hasFiniteNumber(replayConfidence.average)) &&
    hasFiniteNumber(replayConfidence.highConfidenceCount) &&
    hasFiniteNumber(replayConfidence.lowConfidenceCount) &&
    hasFiniteNumber(replayConfidence.missingCount) &&
    hasSimulationArenaInterventionOutcomeSchema(value.interventionOutcome) &&
    hasWeakMetricsSchema(value.weakMetrics) &&
    hasQualityMarkersSchema(value.qualityMarkers) &&
    hasTraceReferencesSchema(value.traceReferences);
}

function hasPathEvidenceFeatureWindowSchema(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  const sourceCoverage = isObject(value.sourceCoverage) ? value.sourceCoverage : {};
  const confidence = isObject(value.confidence) ? value.confidence : {};
  const interventionOutcome = isObject(value.interventionOutcome) ? value.interventionOutcome : {};
  const terminalValidation = isObject(value.terminalValidation) ? value.terminalValidation : null;

  return hasEvidenceWindowSchema(value.window) &&
    hasFiniteNumber(value.evidenceCount) &&
    hasFiniteNumber(value.adoptionCount) &&
    hasFiniteNumber(value.completionCount) &&
    hasFiniteNumber(value.deviationCount) &&
    hasFiniteNumber(value.fallbackCount) &&
    hasFiniteNumber(value.terminalValidationCount) &&
    isCoverageState(sourceCoverage.adoption) &&
    isCoverageState(sourceCoverage.completion) &&
    isCoverageState(sourceCoverage.deviation) &&
    isCoverageState(sourceCoverage.fallback) &&
    isCoverageState(sourceCoverage.terminalValidation) &&
    isCoverageState(sourceCoverage.interventionOutcome) &&
    (
      confidence.level === 'none' ||
      confidence.level === 'low' ||
      confidence.level === 'medium' ||
      confidence.level === 'high'
    ) &&
    hasFiniteNumber(confidence.score) &&
    hasFiniteNumber(confidence.lowConfidenceCount) &&
    hasFiniteNumber(interventionOutcome.acceptedCount) &&
    hasFiniteNumber(interventionOutcome.completedCount) &&
    hasFiniteNumber(interventionOutcome.dismissedCount) &&
    hasOptionalFiniteNumber(interventionOutcome.ignoredCount) &&
    hasOptionalFiniteNumber(interventionOutcome.rejectedCount) &&
    hasOptionalFiniteNumber(interventionOutcome.partiallyAcceptedCount) &&
    hasFiniteNumber(interventionOutcome.lowConfidenceCount) &&
    (terminalValidation === null || hasPathTerminalValidationSummarySchema(terminalValidation)) &&
    Array.isArray(value.sourceReferences) &&
    value.sourceReferences.every(hasPathEvidenceSourceReferenceSchema);
}

function hasPathTerminalValidationSummarySchema(value: unknown): boolean {
  if (!isObject(value)) return false;
  return (value.latestState === null || typeof value.latestState === 'string') &&
    hasFiniteNumber(value.completedCount) &&
    hasFiniteNumber(value.failedCount) &&
    hasFiniteNumber(value.lowConfidenceCount) &&
    hasFiniteNumber(value.fallbackRequiredCount) &&
    Array.isArray(value.lowConfidenceMarkers) &&
    value.lowConfidenceMarkers.every((item) => typeof item === 'string') &&
    Array.isArray(value.failureReasons) &&
    value.failureReasons.every((item) => typeof item === 'string');
}

function hasPathEvidenceSourceReferenceSchema(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }
  return (
    value.sourceType === 'LearningPathExecution' ||
    value.sourceType === 'LearningPathDeviation' ||
    value.sourceType === 'LearningPathIntervention'
  ) &&
    typeof value.sourceId === 'string' &&
    typeof value.pathId === 'string' &&
    (value.goalId === undefined || typeof value.goalId === 'string') &&
    (value.nodeId === null || typeof value.nodeId === 'string') &&
    typeof value.occurredAt === 'string' &&
    (value.privacyLevel === 'student-visible' || value.privacyLevel === 'teacher-scoped');
}

function hasSimulationArenaInterventionOutcomeSchema(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return hasFiniteNumber(value.reviewedCount) &&
    hasFiniteNumber(value.improvedCount) &&
    hasFiniteNumber(value.lowConfidenceCount);
}

function hasEvidenceWindowSchema(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return hasOptionalNonEmptyStringOrNull(value.firstStartedAt) &&
    hasOptionalNonEmptyStringOrNull(value.lastStartedAt) &&
    hasFiniteNumber(value.daysCovered);
}

function hasWeakMetricsSchema(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) => {
    if (!isObject(item)) {
      return false;
    }

    return Boolean(readString(item.metricId)) &&
      hasFiniteNumber(item.affectedFactCount) &&
      hasFiniteNumber(item.lowestValue);
  });
}

function hasQualityMarkersSchema(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every((item) =>
    item === 'low-confidence' ||
    item === 'preview-only' ||
    item === 'standalone-only' ||
    item === 'stale' ||
    item === 'partial'
  );
}

function hasStatusMarkersSchema(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }
  return value.every((item) =>
    item === 'stale' ||
    item === 'partial' ||
    item === 'low-confidence' ||
    item === 'missing-source'
  );
}

function hasTraceReferencesSchema(value: unknown): boolean {
  if (!Array.isArray(value)) {
    return false;
  }

  const allowedKeys = new Set([
    'source',
    'traceReference',
    'factId',
    'sourceEventId',
    'sourceLogId',
    'startedAt',
    'protocolVersion',
    'checksum',
  ]);

  return value.every((item) => {
    if (!isObject(item)) {
      return false;
    }

    return Object.keys(item).every((key) => allowedKeys.has(key)) &&
      (item.source === 'simulation' || item.source === 'arena') &&
      Boolean(readString(item.traceReference)) &&
      Boolean(readString(item.factId)) &&
      hasOptionalNonEmptyStringOrNull(item.sourceEventId) &&
      hasOptionalNonEmptyStringOrNull(item.sourceLogId) &&
      Boolean(readString(item.startedAt)) &&
      hasOptionalNonEmptyStringOrNull(item.protocolVersion) &&
      hasOptionalNonEmptyStringOrNull(item.checksum);
  });
}

function hasOptionalNonEmptyStringOrNull(value: unknown): boolean {
  return value === null || value === undefined || Boolean(readString(value));
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function hasOptionalFiniteNumber(value: unknown): boolean {
  return value === undefined || hasFiniteNumber(value);
}

function isStaleCacheEntry(entry: Record<string, unknown>, staleCutoff: Date): boolean {
  const refreshedAt = entry.refreshedAt instanceof Date ? entry.refreshedAt : null;
  const markers = Array.isArray(entry.statusMarkers) ? entry.statusMarkers : [];
  return markers.includes('stale') || !refreshedAt || refreshedAt < staleCutoff;
}

function createEmptyAdminSummary(): StudentEvidenceFeatureAdminSummary {
  return {
    payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    totalEntries: 0,
    staleEntries: 0,
    latestRefreshAt: null,
    totalSourceFacts: 0,
    totalRebuilds: 0,
    coverage: {},
  };
}
