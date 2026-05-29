import type { Prisma } from '@prisma/client';
import {
  buildStudentEvidenceFeaturePayload,
  STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION,
  type StudentEvidenceFeatureLearningFact,
  type StudentEvidenceCoverageState,
  type StudentEvidenceStatusMarker,
  type StudentEvidenceWindow,
  type StudentSimulationArenaFeatureSummary,
  type StudentSimulationArenaWeakMetric,
  type StudentSimulationArenaTraceReference,
} from './student-evidence-feature-cache';

export type TeacherEvidenceState = 'ready' | 'stale' | 'missing';
export type TeacherSessionQualityStatus = 'green' | 'yellow' | 'red' | 'unknown';

export interface TeacherStudentEvidenceStatus {
  state: TeacherEvidenceState;
  refreshedAt: string | null;
  lastEvidenceAt: string | null;
  evidenceWindow: StudentEvidenceWindow;
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
  simulationArena: StudentSimulationArenaFeatureSummary;
}

export interface TeacherEvidenceCoverageSummary {
  totalStudents: number;
  readyStudents: number;
  staleStudents: number;
  missingStudents: number;
  lowConfidenceStudents: number;
  cacheCoverageRatio: number;
  sourceCoverage: Record<'LearningFact' | 'StudentCompetencySnapshot' | 'StudentProfileSummary', {
    available: number;
    partial: number;
    missing: number;
  }>;
  simulationArena: TeacherSimulationArenaCoverageSummary;
}

export interface TeacherSimulationArenaCoverageSummary {
  totalStudents: number;
  studentsWithEvidence: number;
  missingStudents: number;
  lowConfidenceStudents: number;
  previewOnlyStudents: number;
  agentAssistedStudents: number;
  standaloneOnlyStudents: number;
  officialStudents: number;
  courseLaunchedStudents: number;
  replayConfidence: {
    average: number | null;
    lowConfidenceStudents: number;
    missingStudents: number;
  };
  interventionOutcome: {
    reviewedStudents: number;
    improvedStudents: number;
    lowConfidenceStudents: number;
  };
  sourceCoverage: Record<'simulation' | 'arena' | 'traceReferences' | 'replayConfidence', {
    available: number;
    partial: number;
    missing: number;
  }>;
  weakMetricDistribution: Array<{
    metricId: string;
    affectedStudentCount: number;
    affectedFactCount: number;
    lowestValue: number;
  }>;
}

export interface TeacherSessionQualityReportSummary {
  sessionId: string;
  lessonKey: string | null;
  title: string;
  qualityStatus: TeacherSessionQualityStatus;
  qualityReasons: string[];
  updatedAt: string | null;
  startTime: string | null;
  endTime: string | null;
  summary: string | null;
}

export interface TeacherRecentSessionQualitySummary {
  totalReports: number;
  green: number;
  yellow: number;
  red: number;
  unknown: number;
  latestReports: TeacherSessionQualityReportSummary[];
}

export interface TeacherClassScopedEvidenceFactGroup {
  userId: string;
  factType: string;
  _count?: { _all?: number };
  _min?: { startedAt?: Date | string | null };
  _max?: { startedAt?: Date | string | null };
}

export interface TeacherClassScopedEvidenceCacheHealth {
  userId: string;
  payloadVersion?: string | null;
  refreshedAt?: Date | string | null;
  statusMarkers?: unknown;
  features?: unknown;
}

export interface TeacherScopedSimulationArenaOptions {
  classId: string;
  sessionIds?: string[];
  now?: Date;
  staleAfterDays?: number;
}

const DEFAULT_STALE_AFTER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export function buildTeacherStudentEvidenceStatus(
  _userId: string,
  cache: Record<string, unknown> | null,
  options: {
    now?: Date;
    staleAfterDays?: number;
    readState?: TeacherEvidenceState;
    simulationArena?: StudentSimulationArenaFeatureSummary;
  } = {},
): TeacherStudentEvidenceStatus {
  if (!cache) {
    return {
      ...createMissingStudentEvidenceStatus(),
      simulationArena: options.simulationArena ?? createEmptySimulationArenaFeature(),
    };
  }

  const sourceCounts = normalizeSourceCounts(cache.sourceCounts);
  const statusMarkers = normalizeStatusMarkers(cache.statusMarkers);
  const confidence = normalizeConfidence(cache.confidenceMarkers);
  const evidenceWindow = normalizeEvidenceWindow(cache.evidenceWindow);
  const state = options.readState ?? resolveEvidenceState(cache, statusMarkers, options);
  const lastEvidenceAt =
    dateToIso(cache.lastSourceFactAt) ??
    evidenceWindow.lastStartedAt ??
    null;

  return {
    state,
    refreshedAt: dateToIso(cache.refreshedAt),
    lastEvidenceAt,
    evidenceWindow,
    sourceCounts: {
      ...sourceCounts,
      LearningFact: Math.max(sourceCounts.LearningFact, numberValue(cache.sourceFactCount)),
    },
    sourceCoverage: normalizeSourceCoverage(cache.sourceCoverage),
    confidence,
    statusMarkers: state === 'stale' && !statusMarkers.includes('stale')
      ? [...statusMarkers, 'stale']
      : statusMarkers,
    simulationArena:
      options.simulationArena ??
      normalizeSimulationArenaFeature(readObject(cache.features).simulationArena),
  };
}

export function buildTeacherStudentEvidenceStatusMap(
  userIds: string[],
  caches: Array<Record<string, unknown>>,
  options: { now?: Date; staleAfterDays?: number } = {},
): Map<string, TeacherStudentEvidenceStatus> {
  const cacheMap = new Map(
    caches
      .map((cache) => [typeof cache.userId === 'string' ? cache.userId : '', cache] as const)
      .filter(([userId]) => userId.length > 0),
  );

  return new Map(
    userIds.map((userId) => [
      userId,
      buildTeacherStudentEvidenceStatus(userId, cacheMap.get(userId) ?? null, options),
    ]),
  );
}

export function buildTeacherClassScopedEvidenceStatusMap(
  userIds: string[],
  factGroups: TeacherClassScopedEvidenceFactGroup[],
  options: {
    now?: Date;
    staleAfterDays?: number;
    cacheHealthByUserId?: Map<string, TeacherClassScopedEvidenceCacheHealth>;
    scopedSimulationArenaByUserId?: Map<string, StudentSimulationArenaFeatureSummary>;
  } = {},
): Map<string, TeacherStudentEvidenceStatus> {
  const aggregates = new Map<string, {
    count: number;
    byFactType: Record<string, number>;
    firstStartedAt: Date | string | null;
    lastStartedAt: Date | string | null;
  }>();

  for (const group of factGroups) {
    const count = numberValue(group._count?._all);
    if (!group.userId || count <= 0) continue;

    const aggregate = aggregates.get(group.userId) ?? {
      count: 0,
      byFactType: {},
      firstStartedAt: null,
      lastStartedAt: null,
    };
    aggregate.count += count;
    aggregate.byFactType[group.factType] = (aggregate.byFactType[group.factType] ?? 0) + count;
    aggregate.firstStartedAt = minDateValue(aggregate.firstStartedAt, group._min?.startedAt);
    aggregate.lastStartedAt = maxDateValue(aggregate.lastStartedAt, group._max?.startedAt);
    aggregates.set(group.userId, aggregate);
  }

  return new Map(
    userIds.map((userId) => {
      const classScopedStatus = buildClassScopedEvidenceStatus(aggregates.get(userId), options);
      return [
        userId,
        applyClassScopedCacheHealth(
          classScopedStatus,
          options.cacheHealthByUserId?.get(userId) ?? null,
          {
            ...options,
            simulationArena: options.scopedSimulationArenaByUserId?.get(userId),
          },
        ),
      ];
    }),
  );
}

export function summarizeTeacherEvidenceCoverage(
  statuses: Iterable<TeacherStudentEvidenceStatus>,
): TeacherEvidenceCoverageSummary {
  const items = Array.from(statuses);
  const totalStudents = items.length;
  const sourceCoverage = {
    LearningFact: createSourceCoverageCounts(),
    StudentCompetencySnapshot: createSourceCoverageCounts(),
    StudentProfileSummary: createSourceCoverageCounts(),
  };

  let readyStudents = 0;
  let staleStudents = 0;
  let missingStudents = 0;
  let lowConfidenceStudents = 0;

  for (const status of items) {
    if (status.state === 'ready') readyStudents += 1;
    if (status.state === 'stale') staleStudents += 1;
    if (status.state === 'missing') missingStudents += 1;
    if (isLowConfidenceEvidence(status)) lowConfidenceStudents += 1;

    sourceCoverage.LearningFact[status.sourceCoverage.LearningFact] += 1;
    sourceCoverage.StudentCompetencySnapshot[status.sourceCoverage.StudentCompetencySnapshot] += 1;
    sourceCoverage.StudentProfileSummary[status.sourceCoverage.StudentProfileSummary] += 1;
  }

  return {
    totalStudents,
    readyStudents,
    staleStudents,
    missingStudents,
    lowConfidenceStudents,
    cacheCoverageRatio: totalStudents > 0
      ? roundTo((readyStudents + staleStudents) / totalStudents, 2)
      : 0,
    sourceCoverage,
    simulationArena: summarizeTeacherSimulationArenaCoverage(items),
  };
}

export function summarizeTeacherSessionQualityReports(
  reports: Array<Record<string, unknown>>,
): TeacherRecentSessionQualitySummary {
  const latestReports = reports.map((report) => {
    const reportData = readObject(report.reportData);
    const qualityStatus = readObject(reportData.qualityStatus);
    const session = readObject(report.session);
    const plan = readObject(session.plan);
    const status = normalizeSessionQualityStatus(qualityStatus.status);

    return {
      sessionId: stringValue(report.sessionId) ?? stringValue(session.id) ?? '',
      lessonKey: stringValue(report.lessonKey),
      title: stringValue(plan.title) ?? '未命名课堂',
      qualityStatus: status,
      qualityReasons: stringArray(qualityStatus.reasons),
      updatedAt: dateToIso(report.updatedAt),
      startTime: dateToIso(session.startTime),
      endTime: dateToIso(session.endTime),
      summary: stringValue(report.summary),
    };
  });

  return {
    totalReports: latestReports.length,
    green: latestReports.filter((item) => item.qualityStatus === 'green').length,
    yellow: latestReports.filter((item) => item.qualityStatus === 'yellow').length,
    red: latestReports.filter((item) => item.qualityStatus === 'red').length,
    unknown: latestReports.filter((item) => item.qualityStatus === 'unknown').length,
    latestReports,
  };
}

export function buildTeacherScopedSimulationArenaFeatureMap(
  userIds: string[],
  facts: StudentEvidenceFeatureLearningFact[],
  options: TeacherScopedSimulationArenaOptions,
): Map<string, StudentSimulationArenaFeatureSummary> {
  const sessionIds = new Set(options.sessionIds ?? []);
  const userIdSet = new Set(userIds);
  const grouped = new Map<string, StudentEvidenceFeatureLearningFact[]>();

  for (const fact of facts) {
    if (!userIdSet.has(fact.userId)) continue;
    if (!isSimulationArenaFactInTeacherScope(fact, options.classId, sessionIds)) continue;
    const userFacts = grouped.get(fact.userId);
    if (userFacts) {
      userFacts.push(fact);
    } else {
      grouped.set(fact.userId, [fact]);
    }
  }

  return new Map(
    userIds.map((userId) => {
      const payload = buildStudentEvidenceFeaturePayload({
        userId,
        facts: grouped.get(userId) ?? [],
        now: options.now,
        staleAfterDays: options.staleAfterDays,
      });
      return [userId, payload.features.simulationArena] as const;
    }),
  );
}

export function buildTeacherScopedLearningFactScopeFilters(
  classId: string,
  sessionIds: string[],
): Prisma.LearningFactWhereInput[] {
  return [
    ...(sessionIds.length > 0 ? [{ sessionId: { in: sessionIds } }] : []),
    { contextJson: { path: ['classId'], equals: classId } },
    { contextJson: { path: ['arena', 'classId'], equals: classId } },
    { contextJson: { path: ['simulation', 'classId'], equals: classId } },
    { contextJson: { path: ['simulationTrace', 'classId'], equals: classId } },
    { contextJson: { path: ['governanceContext', 'classId'], equals: classId } },
    { contextJson: { path: ['arena', 'governanceContext', 'classId'], equals: classId } },
    { contextJson: { path: ['simulation', 'governanceContext', 'classId'], equals: classId } },
    { contextJson: { path: ['simulationTrace', 'governanceContext', 'classId'], equals: classId } },
    { contextJson: { path: ['agentTool', 'governanceContext', 'classId'], equals: classId } },
  ];
}

function isSimulationArenaFactInTeacherScope(
  fact: StudentEvidenceFeatureLearningFact,
  classId: string,
  sessionIds: Set<string>,
): boolean {
  if (fact.sessionId && sessionIds.has(fact.sessionId)) {
    return true;
  }

  const context = readObject(fact.contextJson);
  return hasScopedClassId(context, classId);
}

function hasScopedClassId(record: Record<string, unknown>, classId: string): boolean {
  if (stringValue(record.classId) === classId) {
    return true;
  }

  const arena = readObject(record.arena);
  const simulation = readObject(record.simulation);
  const simulationTrace = readObject(record.simulationTrace);
  const agentTool = readObject(record.agentTool);
  const governanceContext = readObject(record.governanceContext);
  const arenaGovernanceContext = readObject(arena.governanceContext);
  const simulationGovernanceContext = readObject(simulation.governanceContext);
  const simulationTraceGovernanceContext = readObject(simulationTrace.governanceContext);
  const agentToolGovernanceContext = readObject(agentTool.governanceContext);

  return stringValue(arena.classId) === classId ||
    stringValue(simulation.classId) === classId ||
    stringValue(simulationTrace.classId) === classId ||
    stringValue(governanceContext.classId) === classId ||
    stringValue(arenaGovernanceContext.classId) === classId ||
    stringValue(simulationGovernanceContext.classId) === classId ||
    stringValue(simulationTraceGovernanceContext.classId) === classId ||
    stringValue(agentToolGovernanceContext.classId) === classId;
}

function summarizeTeacherSimulationArenaCoverage(
  statuses: TeacherStudentEvidenceStatus[],
): TeacherSimulationArenaCoverageSummary {
  const sourceCoverage = {
    simulation: createSourceCoverageCounts(),
    arena: createSourceCoverageCounts(),
    traceReferences: createSourceCoverageCounts(),
    replayConfidence: createSourceCoverageCounts(),
  };
  const weakMetrics = new Map<string, {
    affectedStudentCount: number;
    affectedFactCount: number;
    lowestValue: number;
  }>();
  let replayWeightedSum = 0;
  let replayWeight = 0;
  let studentsWithEvidence = 0;
  let lowConfidenceStudents = 0;
  let previewOnlyStudents = 0;
  let agentAssistedStudents = 0;
  let standaloneOnlyStudents = 0;
  let officialStudents = 0;
  let courseLaunchedStudents = 0;
  let replayLowConfidenceStudents = 0;
  let replayMissingStudents = 0;
  let interventionReviewedStudents = 0;
  let interventionImprovedStudents = 0;
  let interventionLowConfidenceStudents = 0;

  for (const status of statuses) {
    const allTime = status.simulationArena.allTime;
    if (allTime.evidenceCount > 0) studentsWithEvidence += 1;
    if (allTime.qualityMarkers.includes('low-confidence')) lowConfidenceStudents += 1;
    if (allTime.qualityMarkers.includes('preview-only')) previewOnlyStudents += 1;
    if (numberValue(allTime.agentAssistedCount) > 0) agentAssistedStudents += 1;
    if (allTime.qualityMarkers.includes('standalone-only')) standaloneOnlyStudents += 1;
    if (allTime.officialCount > 0) officialStudents += 1;
    if (allTime.courseLaunchedCount > 0) courseLaunchedStudents += 1;
    if (allTime.replayConfidence.lowConfidenceCount > 0) replayLowConfidenceStudents += 1;
    if (allTime.evidenceCount > 0 && allTime.replayConfidence.missingCount > 0) replayMissingStudents += 1;
    if (numberValue(allTime.interventionOutcome?.reviewedCount) > 0) interventionReviewedStudents += 1;
    if (numberValue(allTime.interventionOutcome?.improvedCount) > 0) interventionImprovedStudents += 1;
    if (numberValue(allTime.interventionOutcome?.lowConfidenceCount) > 0) interventionLowConfidenceStudents += 1;
    if (allTime.replayConfidence.average !== null) {
      const availableReplayCount = Math.max(
        allTime.evidenceCount - allTime.replayConfidence.missingCount,
        0,
      );
      replayWeightedSum += allTime.replayConfidence.average * availableReplayCount;
      replayWeight += availableReplayCount;
    }

    sourceCoverage.simulation[allTime.sourceCoverage.simulation] += 1;
    sourceCoverage.arena[allTime.sourceCoverage.arena] += 1;
    sourceCoverage.traceReferences[allTime.sourceCoverage.traceReferences] += 1;
    sourceCoverage.replayConfidence[allTime.sourceCoverage.replayConfidence] += 1;

    for (const metric of allTime.weakMetrics) {
      const current = weakMetrics.get(metric.metricId) ?? {
        affectedStudentCount: 0,
        affectedFactCount: 0,
        lowestValue: metric.lowestValue,
      };
      weakMetrics.set(metric.metricId, {
        affectedStudentCount: current.affectedStudentCount + 1,
        affectedFactCount: current.affectedFactCount + metric.affectedFactCount,
        lowestValue: Math.min(current.lowestValue, metric.lowestValue),
      });
    }
  }

  return {
    totalStudents: statuses.length,
    studentsWithEvidence,
    missingStudents: statuses.length - studentsWithEvidence,
    lowConfidenceStudents,
    previewOnlyStudents,
    agentAssistedStudents,
    standaloneOnlyStudents,
    officialStudents,
    courseLaunchedStudents,
    replayConfidence: {
      average: replayWeight > 0
        ? roundTo(replayWeightedSum / replayWeight, 2)
        : null,
      lowConfidenceStudents: replayLowConfidenceStudents,
      missingStudents: replayMissingStudents,
    },
    interventionOutcome: {
      reviewedStudents: interventionReviewedStudents,
      improvedStudents: interventionImprovedStudents,
      lowConfidenceStudents: interventionLowConfidenceStudents,
    },
    sourceCoverage,
    weakMetricDistribution: Array.from(weakMetrics.entries())
      .map(([metricId, metric]) => ({ metricId, ...metric }))
      .sort((left, right) => (
        right.affectedStudentCount - left.affectedStudentCount ||
        left.metricId.localeCompare(right.metricId)
      )),
  };
}

function normalizeSimulationArenaFeature(value: unknown): StudentSimulationArenaFeatureSummary {
  const feature = readObject(value);
  return {
    recent30d: normalizeSimulationArenaWindow(feature.recent30d),
    allTime: normalizeSimulationArenaWindow(feature.allTime),
  };
}

function normalizeSimulationArenaWindow(value: unknown): StudentSimulationArenaFeatureSummary['allTime'] {
  const window = readObject(value);
  const sourceCoverage = readObject(window.sourceCoverage);
  return {
    window: normalizeEvidenceWindow(window.window),
    evidenceCount: numberValue(window.evidenceCount),
    completedCount: numberValue(window.completedCount),
    officialCount: numberValue(window.officialCount),
    previewCount: numberValue(window.previewCount),
    agentAssistedCount: numberValue(window.agentAssistedCount),
    courseLaunchedCount: numberValue(window.courseLaunchedCount),
    standaloneCount: numberValue(window.standaloneCount),
    traceReferenceCount: numberValue(window.traceReferenceCount),
    sourceCoverage: {
      simulation: normalizeCoverageState(sourceCoverage.simulation),
      arena: normalizeCoverageState(sourceCoverage.arena),
      traceReferences: normalizeCoverageState(sourceCoverage.traceReferences),
      replayConfidence: normalizeCoverageState(sourceCoverage.replayConfidence),
    },
    replayConfidence: normalizeSimulationArenaReplayConfidence(window.replayConfidence),
    interventionOutcome: normalizeSimulationArenaInterventionOutcome(window.interventionOutcome),
    weakMetrics: normalizeSimulationArenaWeakMetrics(window.weakMetrics),
    qualityMarkers: normalizeSimulationArenaQualityMarkers(window.qualityMarkers),
    traceReferences: normalizeSimulationArenaTraceReferences(window.traceReferences),
  };
}

function normalizeSimulationArenaReplayConfidence(
  value: unknown,
): StudentSimulationArenaFeatureSummary['allTime']['replayConfidence'] {
  const replayConfidence = readObject(value);
  return {
    average: typeof replayConfidence.average === 'number' && Number.isFinite(replayConfidence.average)
      ? replayConfidence.average
      : null,
    highConfidenceCount: numberValue(replayConfidence.highConfidenceCount),
    lowConfidenceCount: numberValue(replayConfidence.lowConfidenceCount),
    missingCount: numberValue(replayConfidence.missingCount),
  };
}

function normalizeSimulationArenaInterventionOutcome(
  value: unknown,
): StudentSimulationArenaFeatureSummary['allTime']['interventionOutcome'] {
  const interventionOutcome = readObject(value);
  return {
    reviewedCount: numberValue(interventionOutcome.reviewedCount),
    improvedCount: numberValue(interventionOutcome.improvedCount),
    lowConfidenceCount: numberValue(interventionOutcome.lowConfidenceCount),
  };
}

function normalizeSimulationArenaWeakMetrics(value: unknown): StudentSimulationArenaWeakMetric[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const metric = readObject(item);
      const metricId = stringValue(metric.metricId);
      if (!metricId) return null;
      return {
        metricId,
        affectedFactCount: numberValue(metric.affectedFactCount),
        lowestValue: numberValue(metric.lowestValue),
      };
    })
    .filter((item): item is StudentSimulationArenaWeakMetric => Boolean(item));
}

function normalizeSimulationArenaQualityMarkers(
  value: unknown,
): StudentSimulationArenaFeatureSummary['allTime']['qualityMarkers'] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StudentSimulationArenaFeatureSummary['allTime']['qualityMarkers'][number] =>
    item === 'low-confidence' ||
    item === 'preview-only' ||
    item === 'standalone-only' ||
    item === 'stale' ||
    item === 'partial'
  );
}

function normalizeSimulationArenaTraceReferences(value: unknown): StudentSimulationArenaTraceReference[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const trace = readObject(item);
      const source = trace.source === 'simulation' || trace.source === 'arena' ? trace.source : null;
      const traceReference = stringValue(trace.traceReference);
      const factId = stringValue(trace.factId);
      const startedAt = stringValue(trace.startedAt);
      if (!source || !traceReference || !factId || !startedAt) return null;
      return compactTraceReference({
        source,
        traceReference,
        factId,
        sourceEventId: stringValue(trace.sourceEventId),
        sourceLogId: stringValue(trace.sourceLogId),
        startedAt,
        protocolVersion: stringValue(trace.protocolVersion) ?? undefined,
        checksum: stringValue(trace.checksum) ?? undefined,
      });
    })
    .filter((item): item is StudentSimulationArenaTraceReference => Boolean(item));
}

function compactTraceReference(
  value: StudentSimulationArenaTraceReference,
): StudentSimulationArenaTraceReference {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as unknown as StudentSimulationArenaTraceReference;
}

function createEmptySimulationArenaFeature(): StudentSimulationArenaFeatureSummary {
  return {
    recent30d: createEmptySimulationArenaWindow(),
    allTime: createEmptySimulationArenaWindow(),
  };
}

function createEmptySimulationArenaWindow(): StudentSimulationArenaFeatureSummary['allTime'] {
  return {
    window: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
    evidenceCount: 0,
    completedCount: 0,
    officialCount: 0,
    previewCount: 0,
    agentAssistedCount: 0,
    courseLaunchedCount: 0,
    standaloneCount: 0,
    traceReferenceCount: 0,
    sourceCoverage: {
      simulation: 'missing',
      arena: 'missing',
      traceReferences: 'missing',
      replayConfidence: 'missing',
    },
    replayConfidence: {
      average: null,
      highConfidenceCount: 0,
      lowConfidenceCount: 0,
      missingCount: 0,
    },
    interventionOutcome: {
      reviewedCount: 0,
      improvedCount: 0,
      lowConfidenceCount: 0,
    },
    weakMetrics: [],
    qualityMarkers: [],
    traceReferences: [],
  };
}

function buildClassScopedEvidenceStatus(
  aggregate: {
    count: number;
    byFactType: Record<string, number>;
    firstStartedAt: Date | string | null;
    lastStartedAt: Date | string | null;
  } | undefined,
  options: { now?: Date; staleAfterDays?: number },
): TeacherStudentEvidenceStatus {
  if (!aggregate || aggregate.count <= 0) {
    return createMissingStudentEvidenceStatus();
  }

  const firstStartedAt = dateToIso(aggregate.firstStartedAt);
  const lastStartedAt = dateToIso(aggregate.lastStartedAt);
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const stale = isOlderThanDays(aggregate.lastStartedAt, options.now ?? new Date(), staleAfterDays);
  const lowConfidence = aggregate.count < 3;
  const statusMarkers: StudentEvidenceStatusMarker[] = [
    ...(stale ? ['stale' as const] : []),
    ...(lowConfidence ? ['low-confidence' as const] : []),
  ];

  return {
    state: stale ? 'stale' : 'ready',
    refreshedAt: lastStartedAt,
    lastEvidenceAt: lastStartedAt,
    evidenceWindow: {
      firstStartedAt,
      lastStartedAt,
      daysCovered: calculateDaysCovered(aggregate.firstStartedAt, aggregate.lastStartedAt),
    },
    sourceCounts: {
      LearningFact: aggregate.count,
      StudentCompetencySnapshot: 0,
      StudentProfileSummary: 0,
      byFactType: aggregate.byFactType,
    },
    sourceCoverage: {
      LearningFact: 'available',
      StudentCompetencySnapshot: 'missing',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      level: aggregate.count >= 8 ? 'high' : aggregate.count >= 3 ? 'medium' : 'low',
      score: aggregate.count >= 8 ? 0.91 : aggregate.count >= 3 ? 0.64 : 0.31,
      evidenceCount: aggregate.count,
      sourceCompleteness: 1,
    },
    statusMarkers,
    simulationArena: createEmptySimulationArenaFeature(),
  };
}

function applyClassScopedCacheHealth(
  status: TeacherStudentEvidenceStatus,
  cacheHealth: TeacherClassScopedEvidenceCacheHealth | null,
  options: {
    now?: Date;
    staleAfterDays?: number;
    simulationArena?: StudentSimulationArenaFeatureSummary;
  },
): TeacherStudentEvidenceStatus {
  const simulationArena = options.simulationArena ?? createEmptySimulationArenaFeature();

  if (!cacheHealth) {
    if (status.state === 'missing') {
      return {
        ...status,
        simulationArena,
      };
    }
    return {
      ...status,
      state: 'stale',
      refreshedAt: null,
      statusMarkers: mergeStatusMarkers(status.statusMarkers, ['missing-source', 'stale']),
      simulationArena,
    };
  }

  const cacheVersionIsCurrent = cacheHealth.payloadVersion === STUDENT_EVIDENCE_FEATURE_PAYLOAD_VERSION;
  const cacheMarkers = mergeStatusMarkers(
    normalizeStatusMarkers(cacheHealth.statusMarkers),
    cacheVersionIsCurrent ? [] : ['stale'],
  );
  const cacheState = cacheVersionIsCurrent
    ? resolveEvidenceState(
        { refreshedAt: cacheHealth.refreshedAt },
        cacheMarkers,
        options,
      )
    : 'stale';
  const refreshedAt = dateToIso(cacheHealth.refreshedAt);
  const statusMarkers = mergeStatusMarkers(
    status.statusMarkers,
    cacheMarkers,
    cacheState === 'stale' ? ['stale'] : [],
  );
  if (status.state === 'missing') {
    return {
      ...status,
      refreshedAt,
      statusMarkers,
      simulationArena,
    };
  }

  return {
    ...status,
    state: cacheState === 'stale' ? 'stale' : status.state,
    refreshedAt: refreshedAt ?? status.refreshedAt,
    statusMarkers,
    simulationArena,
  };
}

function createMissingStudentEvidenceStatus(): TeacherStudentEvidenceStatus {
  return {
    state: 'missing',
    refreshedAt: null,
    lastEvidenceAt: null,
    evidenceWindow: {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    },
    sourceCounts: {
      LearningFact: 0,
      StudentCompetencySnapshot: 0,
      StudentProfileSummary: 0,
      byFactType: {},
    },
    sourceCoverage: {
      LearningFact: 'missing',
      StudentCompetencySnapshot: 'missing',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      level: 'none',
      score: 0,
      evidenceCount: 0,
      sourceCompleteness: 0,
    },
    statusMarkers: ['missing-source'],
    simulationArena: createEmptySimulationArenaFeature(),
  };
}

function mergeStatusMarkers(
  ...groups: Array<readonly StudentEvidenceStatusMarker[]>
): StudentEvidenceStatusMarker[] {
  return Array.from(new Set(groups.flat()));
}

function resolveEvidenceState(
  cache: Record<string, unknown>,
  markers: StudentEvidenceStatusMarker[],
  options: { now?: Date; staleAfterDays?: number },
): TeacherEvidenceState {
  const refreshedAt = dateMillis(cache.refreshedAt);
  const staleAfterDays = options.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const staleByAge = refreshedAt !== null
    ? (options.now ?? new Date()).getTime() - refreshedAt > staleAfterDays * DAY_MS
    : true;

  return staleByAge || markers.includes('stale') ? 'stale' : 'ready';
}

function isLowConfidenceEvidence(status: TeacherStudentEvidenceStatus) {
  if (status.state === 'missing') return false;
  return status.confidence.level === 'none' ||
    status.confidence.level === 'low' ||
    status.statusMarkers.includes('low-confidence');
}

function createSourceCoverageCounts() {
  return {
    available: 0,
    partial: 0,
    missing: 0,
  };
}

function normalizeEvidenceWindow(value: unknown): StudentEvidenceWindow {
  const window = readObject(value);
  return {
    firstStartedAt: stringValue(window.firstStartedAt),
    lastStartedAt: stringValue(window.lastStartedAt),
    daysCovered: numberValue(window.daysCovered),
  };
}

function normalizeSourceCounts(value: unknown): TeacherStudentEvidenceStatus['sourceCounts'] {
  const counts = readObject(value);
  return {
    LearningFact: numberValue(counts.LearningFact),
    StudentCompetencySnapshot: numberValue(counts.StudentCompetencySnapshot),
    StudentProfileSummary: numberValue(counts.StudentProfileSummary),
    byFactType: normalizeFactTypeCounts(counts.byFactType),
  };
}

function normalizeFactTypeCounts(value: unknown): Record<string, number> {
  const counts = readObject(value);
  return Object.fromEntries(
    Object.entries(counts).filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  );
}

function normalizeSourceCoverage(
  value: unknown,
): TeacherStudentEvidenceStatus['sourceCoverage'] {
  const coverage = readObject(value);
  return {
    LearningFact: normalizeCoverageState(coverage.LearningFact),
    StudentCompetencySnapshot: normalizeCoverageState(coverage.StudentCompetencySnapshot),
    StudentProfileSummary: normalizeCoverageState(coverage.StudentProfileSummary),
  };
}

function normalizeCoverageState(value: unknown): StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing'
    ? value
    : 'missing';
}

function normalizeConfidence(value: unknown): TeacherStudentEvidenceStatus['confidence'] {
  const confidence = readObject(value);
  const level = confidence.level;
  return {
    level: level === 'none' || level === 'low' || level === 'medium' || level === 'high'
      ? level
      : 'none',
    score: numberValue(confidence.score),
    evidenceCount: numberValue(confidence.evidenceCount),
    sourceCompleteness: numberValue(confidence.sourceCompleteness),
  };
}

function normalizeStatusMarkers(value: unknown): StudentEvidenceStatusMarker[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is StudentEvidenceStatusMarker =>
    item === 'stale' ||
    item === 'partial' ||
    item === 'low-confidence' ||
    item === 'missing-source'
  );
}

function normalizeSessionQualityStatus(value: unknown): TeacherSessionQualityStatus {
  return value === 'green' || value === 'yellow' || value === 'red' ? value : 'unknown';
}

function readObject(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function dateToIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (hasDateMethods(value)) return new Date(value.getTime()).toISOString();
  if (typeof value === 'string' && value.length > 0) return value;
  return null;
}

function isOlderThanDays(value: unknown, now: Date, days: number) {
  const timestamp = dateMillis(value);
  if (timestamp === null) return true;
  return now.getTime() - timestamp > days * DAY_MS;
}

function calculateDaysCovered(first: unknown, last: unknown) {
  const firstTimestamp = dateMillis(first);
  const lastTimestamp = dateMillis(last);
  if (firstTimestamp === null || lastTimestamp === null) return 0;
  return Math.max(1, Math.ceil((lastTimestamp - firstTimestamp) / DAY_MS));
}

function minDateValue(
  current: Date | string | null,
  candidate: Date | string | null | undefined,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentMillis = dateMillis(current);
  const candidateMillis = dateMillis(candidate);
  if (currentMillis === null) return candidate;
  if (candidateMillis === null) return current;
  return candidateMillis < currentMillis ? candidate : current;
}

function maxDateValue(
  current: Date | string | null,
  candidate: Date | string | null | undefined,
) {
  if (!candidate) return current;
  if (!current) return candidate;
  const currentMillis = dateMillis(current);
  const candidateMillis = dateMillis(candidate);
  if (currentMillis === null) return candidate;
  if (candidateMillis === null) return current;
  return candidateMillis > currentMillis ? candidate : current;
}

function dateMillis(value: unknown): number | null {
  if (value instanceof Date) return value.getTime();
  if (hasDateMethods(value)) return value.getTime();
  if (typeof value !== 'string' || value.length === 0) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function hasDateMethods(value: unknown): value is { getTime(): number } {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof (value as { getTime?: unknown }).getTime === 'function'
  );
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
