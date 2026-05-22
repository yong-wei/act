import type { LearningFact } from '@prisma/client';
import {
  COMPETENCY_DIMENSIONS,
  type CompetencyDimension,
} from './competency-model';

export const STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION = 'student-evidence-features.v1';
export const STUDENT_EVIDENCE_FEATURE_RECENT_WINDOW_DAYS = 30;

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
  facts: LearningFact[];
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
    findMany: (args?: Record<string, unknown>) => Promise<Array<LearningFact | { userId: string }>>;
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
    }) as Promise<LearningFact[]>,
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

  return {
    state: staleByAge || markers.includes('stale') ? 'stale' : 'ready',
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

function buildEvidenceWindow(firstFact: LearningFact | null, lastFact: LearningFact | null): StudentEvidenceWindow {
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

function buildFactsWindow(facts: LearningFact[]): StudentEvidenceWindow {
  return buildEvidenceWindow(facts[0] ?? null, facts.at(-1) ?? null);
}

function buildActivitySummary(facts: LearningFact[]): StudentEvidenceActivitySummary {
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
  facts: LearningFact[]
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

function filterRecentFacts(facts: LearningFact[], now: Date, windowDays: number): LearningFact[] {
  const cutoff = new Date(now.getTime() - windowDays * DAY_MS);
  return facts.filter((fact) => fact.startedAt >= cutoff);
}

function filterContributionFacts(facts: LearningFact[]): LearningFact[] {
  return facts.filter((fact) => {
    const contribution = isObject(fact.competencyContribution) ? fact.competencyContribution : {};
    return COMPETENCY_DIMENSIONS.some((dimension) => numberValue(contribution[dimension]) !== 0);
  });
}

function buildConfidence(facts: LearningFact[], factsWithSourceCount: number): StudentEvidenceFeaturePayload['confidence'] {
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
  facts: LearningFact[];
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

function countByFactType(facts: LearningFact[]): Record<string, number> {
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

function compareFacts(left: LearningFact, right: LearningFact): number {
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
