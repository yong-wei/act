import type { LearningFact } from '@prisma/client';
import {
  COMPETENCY_DIMENSIONS,
  type CompetencyDimension,
} from './competency-model';

export const STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION = 'student-evidence-features.v3';
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
export type StudentEvidenceStatusMarker = 'stale' | 'partial' | 'low-confidence' | 'missing-source';
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
  | 'competencyContributionsAll';

export interface StudentSimulationArenaFeatureWindow {
  window: StudentEvidenceWindow;
  evidenceCount: number;
  completedCount: number;
  officialCount: number;
  previewCount: number;
  courseLaunchedCount: number;
  standaloneCount: number;
  traceReferenceCount: number;
  sourceCoverage: Record<
    'simulation' | 'arena' | 'traceReferences' | 'replayConfidence',
    StudentEvidenceCoverageState
  >;
  replayConfidence: StudentSimulationArenaReplayConfidence;
  weakMetrics: StudentSimulationArenaWeakMetric[];
  qualityMarkers: StudentSimulationArenaEvidenceMarker[];
  traceReferences: StudentSimulationArenaTraceReference[];
}

export interface StudentSimulationArenaFeatureSummary {
  recent30d: StudentSimulationArenaFeatureWindow;
  allTime: StudentSimulationArenaFeatureWindow;
}

export interface StudentEvidenceFeaturePayload {
  userId: string;
  payloadVersion: string;
  evidenceWindow: StudentEvidenceWindow;
  sourceWindows: Record<StudentEvidenceSourceWindowKey, StudentEvidenceWindow>;
  sourceCounts: {
    LearningFact: number;
    StudentCompetencySnapshot: number;
    StudentProfileSummary: number;
    byFactType: Record<string, number>;
  };
  sourceCoverage: Record<'LearningFact' | 'StudentCompetencySnapshot' | 'StudentProfileSummary', StudentEvidenceCoverageState>;
  confidence: {
    level: 'none' | 'low' | 'medium' | 'high';
    score: number;
    evidenceCount: number;
    sourceCompleteness: number;
  };
  statusMarkers: StudentEvidenceStatusMarker[];
  features: {
    activity: StudentEvidenceActivitySummary;
    activity30d: StudentEvidenceActivitySummary;
    activityAll: StudentEvidenceActivitySummary;
    competencyContributions: StudentEvidenceCompetencyContributions;
    competencyContributions30d: StudentEvidenceCompetencyContributions;
    competencyContributionsAll: StudentEvidenceCompetencyContributions;
    simulationArena: StudentSimulationArenaFeatureSummary;
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
        snapshotAt: string;
        factCount: number;
        calculationVersion: string;
        competencyVector: unknown;
      } | null;
      profileSummary: {
        updatedAt: string;
        overallScore: number;
        riskLevel: string;
        trendDirection: string;
      } | null;
    };
  };
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

interface StudentProfileSummaryAggregate {
  updatedAt: Date;
  overallScore: number;
  riskLevel: string;
  trendDirection: string;
}

interface BuildStudentEvidenceFeaturePayloadInput {
  userId: string;
  facts: StudentEvidenceFeatureLearningFact[];
  latestSnapshot?: StudentCompetencySnapshotAggregate | null;
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

interface StudentEvidenceFeatureCacheDb {
  learningFact?: {
    findMany: (args?: Record<string, unknown>) => Promise<Array<StudentEvidenceFeatureLearningFact | { userId: string }>>;
  };
  studentCompetencySnapshot?: {
    findMany?: (args?: Record<string, unknown>) => Promise<Array<{ userId: string }>>;
    findFirst: (args?: Record<string, unknown>) => Promise<StudentCompetencySnapshotAggregate | null>;
  };
  studentProfileSummary?: {
    findMany?: (args?: Record<string, unknown>) => Promise<Array<{ userId: string }>>;
    findUnique: (args?: Record<string, unknown>) => Promise<StudentProfileSummaryAggregate | null>;
  };
  studentEvidenceFeatureCache: StudentEvidenceFeatureCacheDelegate;
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
  const facts = [...input.facts].sort(compareFacts);
  const factsWithSource = facts.filter((item) => Boolean(item.sourceEventId || item.sourceLogId));
  const recentFacts = filterRecentFacts(facts, now, STUDENT_EVIDENCE_FEATURE_RECENT_WINDOW_DAYS);
  const firstFact = facts[0] ?? null;
  const lastFact = facts[facts.length - 1] ?? null;
  const evidenceWindow = buildEvidenceWindow(firstFact, lastFact);
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
  const sourceWindows = {
    activity30d: buildFactsWindow(recentFacts),
    activityAll: evidenceWindow,
    competencyContributions30d: buildFactsWindow(filterContributionFacts(recentFacts)),
    competencyContributionsAll: buildFactsWindow(filterContributionFacts(facts)),
  } satisfies StudentEvidenceFeaturePayload['sourceWindows'];
  const byFactType = countByFactType(facts);
  const sourceCoverage = {
    LearningFact: resolveLearningFactCoverage(facts.length, factsWithSource.length),
    StudentCompetencySnapshot: input.latestSnapshot ? 'available' : 'missing',
    StudentProfileSummary: input.profileSummary ? 'available' : 'missing',
  } satisfies StudentEvidenceFeaturePayload['sourceCoverage'];
  const confidence = buildConfidence(facts, factsWithSource.length);
  const statusMarkers = buildStatusMarkers({
    facts,
    confidenceLevel: confidence.level,
    sourceCoverage,
    lastFactStartedAt: lastFact?.startedAt ?? null,
    now,
    staleAfterDays,
  });
  const adaptiveLearnerState = buildAdaptiveLearnerStateFeature({
    facts,
    recentFacts,
    latestSnapshot: input.latestSnapshot,
    profileSummary: input.profileSummary,
    confidence,
    statusMarkers,
    simulationArena,
  });

  return {
    userId: input.userId,
    payloadVersion: STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
    evidenceWindow,
    sourceWindows,
    sourceCounts: {
      LearningFact: facts.length,
      StudentCompetencySnapshot: input.latestSnapshot ? 1 : 0,
      StudentProfileSummary: input.profileSummary ? 1 : 0,
      byFactType,
    },
    sourceCoverage,
    confidence,
    statusMarkers,
    features: {
      activity: activityAll,
      activity30d,
      activityAll,
      competencyContributions: competencyContributionsAll,
      competencyContributions30d,
      competencyContributionsAll,
      simulationArena,
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
              snapshotAt: input.latestSnapshot.snapshotAt.toISOString(),
              factCount: input.latestSnapshot.factCount,
              calculationVersion: input.latestSnapshot.calculationVersion,
              competencyVector: input.latestSnapshot.competencyVector,
            }
          : null,
        profileSummary: input.profileSummary
          ? {
              updatedAt: input.profileSummary.updatedAt.toISOString(),
              overallScore: input.profileSummary.overallScore,
              riskLevel: input.profileSummary.riskLevel,
              trendDirection: input.profileSummary.trendDirection,
            }
          : null,
      },
    },
  };
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
  const [facts, latestSnapshot, profileSummary] = await Promise.all([
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
  const payload = buildStudentEvidenceFeaturePayload({
    userId,
    facts,
    latestSnapshot,
    profileSummary,
    now,
    staleAfterDays: options.staleAfterDays,
  });
  const refreshedAt = now;
  const lastSourceFactAt = payload.evidenceWindow.lastStartedAt
    ? new Date(payload.evidenceWindow.lastStartedAt)
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
    sourceFactCount: facts.length,
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

  const [factRows, snapshotRows, profileRows] = await Promise.all([
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
    db.studentProfileSummary?.findMany?.({
      select: { userId: true },
      orderBy: { userId: 'asc' },
    }) ?? Promise.resolve([]),
  ]);
  const userIds = uniqueSorted(
    [...factRows, ...snapshotRows, ...profileRows]
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

  const refreshedAt = cache.refreshedAt instanceof Date ? cache.refreshedAt : null;
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const staleByAge = refreshedAt
    ? (options.now ?? new Date()).getTime() - refreshedAt.getTime() > staleAfterDays * DAY_MS
    : true;
  const markers = Array.isArray(cache.statusMarkers) ? cache.statusMarkers : [];
  const staleBySchema = !hasCurrentFeaturePayloadSchema(cache);

  return {
    state: staleByAge || markers.includes('stale') || staleBySchema ? 'stale' : 'ready',
    cache,
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

function buildCompetencyContributions(
  facts: StudentEvidenceFeatureLearningFact[]
): StudentEvidenceFeaturePayload['features']['competencyContributions'] {
  const contributions = {} as StudentEvidenceFeaturePayload['features']['competencyContributions'];

  for (const dimension of COMPETENCY_DIMENSIONS) {
    const dimensionValues = facts
      .map((item) => ({
        value: numberValue(isObject(item.competencyContribution) ? item.competencyContribution[dimension] : undefined),
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
  courseLaunched: boolean;
  standalone: boolean;
  replayConfidence: number | null;
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
  profileSummary?: StudentProfileSummaryAggregate | null;
  confidence: StudentEvidenceFeaturePayload['confidence'];
  statusMarkers: StudentEvidenceStatusMarker[];
  simulationArena: StudentSimulationArenaFeatureSummary;
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
      primaryCompetencies: input.latestSnapshot ? 'available' : 'missing',
      knowledgeMastery: resolveCoverageCount(masteryEvidenceCount),
      resourcePreference: resolveCoverageCount(resourceEvidenceCount),
      mediaAbsorption: resolveCoverageCount(mediaEvidenceCount),
      pathContext: 'missing',
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
  const historicalMaterialization = isObject(context.historicalMaterialization)
    ? context.historicalMaterialization
    : {};
  const source: StudentSimulationArenaEvidenceSource | null = arenaContext
    ? 'arena'
    : simulationContext || fact.factType === 'simulation' || historicalMaterialization.sourceId === 'SimulationLog'
      ? 'simulation'
      : null;

  if (!source) {
    return null;
  }

  const sourceContext = source === 'arena'
    ? arenaContext ?? {}
    : simulationContext ?? context;
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
  const official = resolveSimulationArenaOfficial(sourceContext, context, fact);
  const preview = resolveSimulationArenaPreview(sourceContext, fact, official);
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
    courseLaunched,
    standalone,
    replayConfidence: resolveReplayConfidence(sourceContext, context, historicalMaterialization, envelope),
    weakMetrics: extractWeakMetrics(sourceContext, summary),
    traceReference,
  };
}

function resolveSimulationArenaOfficial(
  sourceContext: Record<string, unknown>,
  context: Record<string, unknown>,
  fact: StudentEvidenceFeatureLearningFact
): boolean {
  const governance = isObject(context.evidenceGovernance) ? context.evidenceGovernance : {};
  return sourceContext.official === true ||
    sourceContext.evaluationMode === 'official' ||
    sourceContext.evaluationVisibility === 'official' ||
    governance.policyReason === 'official_arena_evaluation' ||
    (fact.sourceEventId ?? '').includes('arena_evaluation_complete');
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

function buildStatusMarkers(input: {
  facts: StudentEvidenceFeatureLearningFact[];
  confidenceLevel: StudentEvidenceFeaturePayload['confidence']['level'];
  sourceCoverage: StudentEvidenceFeaturePayload['sourceCoverage'];
  lastFactStartedAt: Date | null;
  now: Date;
  staleAfterDays: number;
}): StudentEvidenceStatusMarker[] {
  const markers = new Set<StudentEvidenceStatusMarker>();

  if (!input.lastFactStartedAt || input.now.getTime() - input.lastFactStartedAt.getTime() > input.staleAfterDays * DAY_MS) {
    markers.add('stale');
  }
  if (input.facts.some((item) => ['partial', 'failure', 'abandoned'].includes(item.outcome))) {
    markers.add('partial');
  }
  if (['none', 'low'].includes(input.confidenceLevel)) {
    markers.add('low-confidence');
  }
  if (Object.values(input.sourceCoverage).some((state) => state !== 'available')) {
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

function isPresent(value: string | null | undefined): value is string {
  return Boolean(value);
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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

function hasCurrentFeaturePayloadSchema(cache: Record<string, unknown>): boolean {
  if (cache.payloadVersion !== STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION) {
    return false;
  }
  const features = isObject(cache.features) ? cache.features : {};
  const simulationArena = isObject(features.simulationArena) ? features.simulationArena : {};
  const adaptiveLearnerState = isObject(features.adaptiveLearnerState) ? features.adaptiveLearnerState : {};
  return hasSimulationArenaFeatureWindowSchema(simulationArena.recent30d) &&
    hasSimulationArenaFeatureWindowSchema(simulationArena.allTime) &&
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
    hasWeakMetricsSchema(value.weakMetrics) &&
    hasQualityMarkersSchema(value.qualityMarkers) &&
    hasTraceReferencesSchema(value.traceReferences);
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
