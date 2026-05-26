import { buildSyncErrorIncidentSummary } from './session-reports';
import {
  computeSessionQualityStatus,
  resolveSessionQualitySyncSeverity,
} from './session-quality-status';
import {
  createSubmissionEvidenceQualityCounts,
  summarizeSubmissionEvidencePayload,
} from './submission-evidence-quality';

export interface SessionDataQualityFilters {
  sessionIds?: string[];
  lessonKeys?: string[];
  from?: Date;
  to?: Date;
}

interface ClassSessionQualityRow {
  id: string;
  classId: string | null;
  status: string;
  startTime: Date;
  endTime: Date | null;
  plan: { title: string };
}

interface StudentStateQualityRow {
  sessionId: string;
  userId: string;
  stateKey?: string | null;
  lessonKey: string | null;
  submittedAt: Date;
  lastClientEventAt: Date | null;
}

interface InteractionLogQualityRow {
  sessionId: string | null;
  userId: string;
  eventType: string;
  stepId: string | null;
  lessonKey: string | null;
  actorRole?: string | null;
  userRole?: string | null;
  clientEventAt: Date | null;
  createdAt: Date;
  eventData: unknown;
}

interface LearningFactQualityRow {
  sessionId: string | null;
  userId: string;
  userRole?: string | null;
  lessonId: string | null;
  score: number | null;
  outcome: string;
  startedAt: Date;
  contextJson: unknown;
}

interface StudentStepResponseQualityRow {
  sessionId: string;
  userId: string;
  userRole?: string | null;
  lessonKey: string | null;
  stepId: string;
  submittedAt: Date;
  responseData: unknown;
}

interface UserRoleQualityRow {
  id: string;
  role: string | null;
}

interface StudentSnapshotQualityRow {
  userId: string;
  snapshotAt: Date;
}

interface SessionReportQualityRow {
  sessionId: string;
  userId?: string;
  lessonKey: string | null;
  reportType: string;
  status: string;
  updatedAt: Date;
}

interface StudentEvidenceFeatureCacheQualityRow {
  userId: string;
  refreshedAt: Date;
  lastSourceFactAt: Date | null;
  statusMarkers: unknown;
}

export interface BuildSessionDataQualityReportInput {
  generatedAt?: string;
  filters?: SessionDataQualityFilters;
  sessions: ClassSessionQualityRow[];
  studentStates: StudentStateQualityRow[];
  interactionLogs: InteractionLogQualityRow[];
  learningFacts: LearningFactQualityRow[];
  studentStepResponses: StudentStepResponseQualityRow[];
  studentCompetencySnapshots: StudentSnapshotQualityRow[];
  classSessionReports: SessionReportQualityRow[];
  studentSessionReports: SessionReportQualityRow[];
  studentEvidenceFeatureCaches?: StudentEvidenceFeatureCacheQualityRow[];
}

export type SessionDataQualityDb = {
  classSession: {
    findMany(args: unknown): Promise<ClassSessionQualityRow[]>;
  };
  studentState: {
    findMany(args: unknown): Promise<StudentStateQualityRow[]>;
  };
  interactionLog: {
    findMany(args: unknown): Promise<InteractionLogQualityRow[]>;
  };
  learningFact: {
    findMany(args: unknown): Promise<LearningFactQualityRow[]>;
  };
  studentStepResponse: {
    findMany(args: unknown): Promise<StudentStepResponseQualityRow[]>;
  };
  studentCompetencySnapshot: {
    findMany(args: unknown): Promise<StudentSnapshotQualityRow[]>;
  };
  classSessionReport: {
    findMany(args: unknown): Promise<SessionReportQualityRow[]>;
  };
  studentSessionReport: {
    findMany(args: unknown): Promise<SessionReportQualityRow[]>;
  };
  studentEvidenceFeatureCache?: {
    findMany(args: unknown): Promise<StudentEvidenceFeatureCacheQualityRow[]>;
  };
  user: {
    findMany(args: unknown): Promise<UserRoleQualityRow[]>;
  };
};

const SNAPSHOT_FRESHNESS_WINDOW_MS = 2 * 60 * 60 * 1000;
const UNKNOWN_USER_ROLE = 'UNKNOWN';

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function latestDate(dates: Date[]) {
  return dates
    .filter((date) => date instanceof Date && Number.isFinite(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : null;
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function buildDateWhere(filters: SessionDataQualityFilters, field: string) {
  const range: Record<string, Date> = {};
  if (filters.from) range.gte = filters.from;
  if (filters.to) range.lte = filters.to;
  return Object.keys(range).length > 0 ? { [field]: range } : {};
}

function buildLessonWhere(filters: SessionDataQualityFilters, field: string) {
  return filters.lessonKeys?.length ? { [field]: { in: filters.lessonKeys } } : {};
}

function buildSessionWhere(sessionIds: string[]) {
  return sessionIds.length ? { sessionId: { in: sessionIds } } : {};
}

function isStudentStateRow(state: StudentStateQualityRow) {
  return !state.stateKey?.startsWith('teacher');
}

function isStudentInteractionLog(log: InteractionLogQualityRow) {
  const actorRole = typeof log.actorRole === 'string' ? log.actorRole.trim().toLowerCase() : null;
  if (actorRole === 'student') return true;
  if (actorRole === 'teacher' || actorRole === 'admin') return false;
  return isStudentUserRole(log.userRole);
}

function isStudentUserRole(role: string | null | undefined) {
  if (role === undefined || role === null) return true;
  return role === 'STUDENT';
}

function isStudentQualityRow(row: { userId: string; userRole?: string | null }, teacherUserIds: Set<string>) {
  return isStudentUserRole(row.userRole) && !teacherUserIds.has(row.userId);
}

function resolveQueriedUserRole(roleByUserId: Map<string, string | null>, userId: string) {
  return roleByUserId.has(userId) ? roleByUserId.get(userId) ?? UNKNOWN_USER_ROLE : UNKNOWN_USER_ROLE;
}

function toSyncIncidentSummaryLog(log: InteractionLogQualityRow) {
  return {
    userId: log.userId,
    eventType: log.eventType,
    stepId: log.stepId,
    clientEventAt: log.clientEventAt,
    lessonKey: log.lessonKey,
    eventData: log.eventData,
  };
}

async function collectSessionIdsFromLessonFilters(
  db: SessionDataQualityDb,
  filters: SessionDataQualityFilters,
) {
  if (!filters.lessonKeys?.length) return [];

  const [logs, states, facts, submissions] = await Promise.all([
    db.interactionLog.findMany({
      where: {
        sessionId: { not: null },
        ...buildLessonWhere(filters, 'lessonKey'),
        ...buildDateWhere(filters, 'createdAt'),
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }) as Promise<Array<{ sessionId: string | null }>>,
    db.studentState.findMany({
      where: {
        NOT: { stateKey: { startsWith: 'teacher' } },
        ...buildLessonWhere(filters, 'lessonKey'),
        ...buildDateWhere(filters, 'submittedAt'),
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }) as Promise<Array<{ sessionId: string }>>,
    db.learningFact.findMany({
      where: {
        sessionId: { not: null },
        ...buildLessonWhere(filters, 'lessonId'),
        ...buildDateWhere(filters, 'startedAt'),
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }) as Promise<Array<{ sessionId: string | null }>>,
    db.studentStepResponse.findMany({
      where: {
        ...buildLessonWhere(filters, 'lessonKey'),
        ...buildDateWhere(filters, 'submittedAt'),
      },
      select: { sessionId: true },
      distinct: ['sessionId'],
    }) as Promise<Array<{ sessionId: string }>>,
  ]);

  return uniqueSorted([
    ...logs.map((row) => row.sessionId),
    ...states.map((row) => row.sessionId),
    ...facts.map((row) => row.sessionId),
    ...submissions.map((row) => row.sessionId),
  ]);
}

function buildReportFreshness(
  session: ClassSessionQualityRow,
  classReports: SessionReportQualityRow[],
  studentReports: SessionReportQualityRow[],
  participantCount: number,
) {
  const referenceTime = session.endTime ?? session.startTime;
  const latestClassReportAt = latestDate(classReports.map((report) => report.updatedAt));
  const latestStudentReportAt = latestDate(studentReports.map((report) => report.updatedAt));
  return {
    classReportAvailable: classReports.some((report) => report.status === 'READY'),
    studentReportCount: studentReports.filter((report) => report.status === 'READY').length,
    expectedStudentReports: participantCount,
    latestClassReportAt: latestClassReportAt?.toISOString() ?? null,
    latestStudentReportAt: latestStudentReportAt?.toISOString() ?? null,
    classReportFresh: Boolean(latestClassReportAt && latestClassReportAt.getTime() >= referenceTime.getTime()),
    studentReportsFresh: participantCount === 0
      ? true
      : studentReports.filter((report) => report.status === 'READY' && report.updatedAt.getTime() >= referenceTime.getTime()).length >= participantCount,
  };
}

function buildSnapshotFreshness(
  session: ClassSessionQualityRow,
  participantUserIds: string[],
  snapshots: StudentSnapshotQualityRow[],
  latestFactAtByUserId: Map<string, Date>,
) {
  const windowStart = session.endTime ?? session.startTime;
  const windowEnd = new Date(windowStart.getTime() + SNAPSHOT_FRESHNESS_WINDOW_MS);
  const participantSet = new Set(participantUserIds);
  const latestSnapshotAtByUserId = new Map<string, Date>();

  for (const snapshot of snapshots) {
    if (!participantSet.has(snapshot.userId)) continue;
    if (snapshot.snapshotAt.getTime() > windowEnd.getTime()) continue;
    const current = latestSnapshotAtByUserId.get(snapshot.userId);
    if (!current || snapshot.snapshotAt.getTime() > current.getTime()) {
      latestSnapshotAtByUserId.set(snapshot.userId, snapshot.snapshotAt);
    }
  }

  const postClassUpdatedUserIds = new Set(
    snapshots
      .filter((snapshot) => (
        participantSet.has(snapshot.userId)
        && snapshot.snapshotAt.getTime() >= windowStart.getTime()
        && snapshot.snapshotAt.getTime() <= windowEnd.getTime()
      ))
      .map((snapshot) => snapshot.userId),
  );
  const expectedSnapshotCoverageUserIds = participantUserIds.filter((userId) => latestFactAtByUserId.has(userId));
  const snapshotCoveredUserIds = expectedSnapshotCoverageUserIds.filter((userId) => {
    const latestFactAt = latestFactAtByUserId.get(userId);
    const latestSnapshotAt = latestSnapshotAtByUserId.get(userId);
    return Boolean(
      latestFactAt
      && latestSnapshotAt
      && latestSnapshotAt.getTime() >= latestFactAt.getTime()
      && latestSnapshotAt.getTime() <= windowEnd.getTime()
    );
  });
  const snapshotCoverageFresh = expectedSnapshotCoverageUserIds.length === snapshotCoveredUserIds.length;
  const postClassWindowFresh = participantUserIds.length === postClassUpdatedUserIds.size;

  return {
    snapshotCoverage: {
      coveredParticipants: snapshotCoveredUserIds.length,
      expectedParticipants: expectedSnapshotCoverageUserIds.length,
      missingParticipants: Math.max(0, expectedSnapshotCoverageUserIds.length - snapshotCoveredUserIds.length),
      latestSnapshotAt: latestDate(Array.from(latestSnapshotAtByUserId.values()))?.toISOString() ?? null,
      fresh: snapshotCoverageFresh,
    },
    postClassUpdateWindowCoverage: {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      updatedParticipants: postClassUpdatedUserIds.size,
      expectedParticipants: participantUserIds.length,
      missingParticipants: Math.max(0, participantUserIds.length - postClassUpdatedUserIds.size),
      fresh: postClassWindowFresh,
    },
    compatibilitySnapshotFreshness: {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      updatedParticipants: postClassUpdatedUserIds.size,
      expectedParticipants: participantUserIds.length,
      missingParticipants: Math.max(0, participantUserIds.length - postClassUpdatedUserIds.size),
      coverageFresh: snapshotCoverageFresh,
      fresh: postClassWindowFresh,
    },
  };
}

function hasSessionFinalizeCapture(logs: InteractionLogQualityRow[]) {
  return logs.some((log) => (
    log.eventType === 'session_finalize'
    || readString(readObject(log.eventData).eventType) === 'session_finalize'
  ));
}

function buildCacheFreshness(
  session: ClassSessionQualityRow,
  participantUserIds: string[],
  caches: StudentEvidenceFeatureCacheQualityRow[],
  latestFactAtByUserId: Map<string, Date>,
) {
  const windowStart = session.endTime ?? session.startTime;
  const participantSet = new Set(participantUserIds);
  const cacheByUserId = new Map<string, StudentEvidenceFeatureCacheQualityRow>();
  for (const cache of caches) {
    if (!participantSet.has(cache.userId)) continue;
    const current = cacheByUserId.get(cache.userId);
    if (!current || cache.refreshedAt.getTime() > current.refreshedAt.getTime()) {
      cacheByUserId.set(cache.userId, cache);
    }
  }
  const freshUserIds = new Set<string>();
  const staleUserIds = new Set<string>();
  const postClassRefreshedUserIds = new Set<string>();
  const latestFactCoveredUserIds = new Set<string>();
  const reasonCounts: Record<string, number> = {};

  function addReason(reason: string) {
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
  }

  for (const userId of participantUserIds) {
    const cache = cacheByUserId.get(userId);
    const latestFactAt = latestFactAtByUserId.get(userId) ?? null;
    if (!cache) {
      addReason('feature_cache_missing');
      if (latestFactAt) addReason('feature_cache_missing_latest_fact');
      continue;
    }
    const markers = Array.isArray(cache.statusMarkers) ? cache.statusMarkers : [];
    const staleByMarker = markers.includes('stale');
    const refreshedAt = cache.refreshedAt;
    const refreshedAfterSession = refreshedAt.getTime() >= windowStart.getTime();
    const cacheIncludesLatestFact = !latestFactAt
      || Boolean(cache.lastSourceFactAt && cache.lastSourceFactAt.getTime() >= latestFactAt.getTime());

    if (refreshedAfterSession) {
      postClassRefreshedUserIds.add(userId);
    } else {
      addReason('feature_cache_not_post_class_refreshed');
    }
    if (latestFactAt && cacheIncludesLatestFact) {
      latestFactCoveredUserIds.add(userId);
    } else if (latestFactAt) {
      addReason('feature_cache_missing_latest_fact');
    }
    if (staleByMarker) addReason('feature_cache_stale_marker');

    if (staleByMarker || !refreshedAfterSession || !cacheIncludesLatestFact) {
      staleUserIds.add(userId);
    } else {
      freshUserIds.add(userId);
    }
  }

  return {
    windowStart: windowStart.toISOString(),
    minimumRefreshedAt: windowStart.toISOString(),
    refreshedParticipants: freshUserIds.size,
    postClassRefreshedParticipants: postClassRefreshedUserIds.size,
    latestFactCoveredParticipants: latestFactCoveredUserIds.size,
    expectedParticipantsWithFacts: latestFactAtByUserId.size,
    expectedParticipants: participantUserIds.length,
    missingParticipants: Math.max(0, participantUserIds.length - cacheByUserId.size),
    staleParticipants: staleUserIds.size,
    reasonCounts,
    latestRefreshedAt: latestDate(
      Array.from(cacheByUserId.values()).map((cache) => cache.refreshedAt),
    )?.toISOString() ?? null,
    fresh: participantUserIds.length === freshUserIds.size,
  };
}

function summarizeSubmissions(submissions: StudentStepResponseQualityRow[]) {
  const evidenceQualityCounts = createSubmissionEvidenceQualityCounts();
  const evidenceQualityReasonCounts: Record<string, number> = {};
  const submittedUserIds = new Set<string>();
  let answerAvailableRows = 0;
  let scoreAvailableRows = 0;
  let questionSummaryAvailableRows = 0;
  let scoreableObjectiveSubmissions = 0;

  for (const submission of submissions) {
    submittedUserIds.add(submission.userId);
    const summary = summarizeSubmissionEvidencePayload(submission.responseData);
    evidenceQualityCounts[summary.quality] += 1;
    evidenceQualityReasonCounts[summary.reason] = (evidenceQualityReasonCounts[summary.reason] ?? 0) + 1;
    if (summary.hasAnswerEvidence) answerAvailableRows += 1;
    if (summary.hasScoreEvidence) scoreAvailableRows += 1;
    if (summary.hasQuestionSummaryEvidence) questionSummaryAvailableRows += 1;
    scoreableObjectiveSubmissions += summary.scoreableObjectiveSubmissions;
  }

  return {
    totalRows: submissions.length,
    submittedParticipants: submittedUserIds.size,
    answerAvailableRows,
    scoreAvailableRows,
    questionSummaryAvailableRows,
    scoreableObjectiveSubmissions,
    evidenceQualityCounts,
    evidenceQualityReasonCounts,
  };
}

function latestFactAtByUserId(facts: LearningFactQualityRow[]) {
  const latestByUserId = new Map<string, Date>();

  for (const fact of facts) {
    const current = latestByUserId.get(fact.userId);
    if (!current || fact.startedAt.getTime() > current.getTime()) {
      latestByUserId.set(fact.userId, fact.startedAt);
    }
  }

  return latestByUserId;
}

function buildReadinessMetrics(input: {
  participantCount: number;
  loggedParticipantCount: number;
  submissionCoverage: ReturnType<typeof summarizeSubmissions>;
  snapshotCoverage: ReturnType<typeof buildSnapshotFreshness>['snapshotCoverage'];
  postClassUpdateWindowCoverage: ReturnType<typeof buildSnapshotFreshness>['postClassUpdateWindowCoverage'];
  featureCacheFreshness: ReturnType<typeof buildCacheFreshness>;
}) {
  const totalRows = input.submissionCoverage.totalRows;
  const scoreableRows = input.submissionCoverage.scoreableObjectiveSubmissions;
  return {
    participants: {
      count: input.participantCount,
    },
    loggedUsers: {
      count: input.loggedParticipantCount,
      expectedParticipants: input.participantCount,
      coverage: ratio(input.loggedParticipantCount, input.participantCount),
    },
    durableSubmissionCoverage: {
      submittedParticipants: input.submissionCoverage.submittedParticipants,
      expectedParticipants: input.participantCount,
      totalRows,
      coverage: ratio(input.submissionCoverage.submittedParticipants, input.participantCount),
    },
    requiredEvidenceCoverage: {
      availableRows: input.submissionCoverage.answerAvailableRows,
      submittedRows: totalRows,
      coverage: ratio(input.submissionCoverage.answerAvailableRows, totalRows),
    },
    scoreableEvidenceCoverage: {
      scoreableRows,
      submittedRows: totalRows,
      coverage: ratio(scoreableRows, totalRows),
    },
    scoringCoverage: {
      scoredRows: input.submissionCoverage.scoreAvailableRows,
      scoreableRows,
      coverage: ratio(input.submissionCoverage.scoreAvailableRows, scoreableRows),
    },
    snapshotCoverage: input.snapshotCoverage,
    postClassUpdateWindowCoverage: input.postClassUpdateWindowCoverage,
    featureCacheFreshness: input.featureCacheFreshness,
  };
}

export function buildSessionDataQualityReport(input: BuildSessionDataQualityReportInput) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const sessions = input.sessions.map((session) => {
    const logs = input.interactionLogs.filter((log) => log.sessionId === session.id);
    const studentLogs = logs.filter(isStudentInteractionLog);
    const states = input.studentStates.filter((state) => state.sessionId === session.id);
    const facts = input.learningFacts.filter((fact) => fact.sessionId === session.id);
    const submissions = input.studentStepResponses.filter((submission) => submission.sessionId === session.id);
    const classReports = input.classSessionReports.filter((report) => report.sessionId === session.id);
    const studentReports = input.studentSessionReports.filter((report) => report.sessionId === session.id);
    const teacherUserIds = new Set([
      ...states.filter((state) => !isStudentStateRow(state)).map((state) => state.userId),
      ...logs.filter((log) => !isStudentInteractionLog(log)).map((log) => log.userId),
      ...facts.filter((fact) => !isStudentUserRole(fact.userRole)).map((fact) => fact.userId),
      ...submissions.filter((submission) => !isStudentUserRole(submission.userRole)).map((submission) => submission.userId),
    ]);
    const studentFacts = facts.filter((fact) => isStudentQualityRow(fact, teacherUserIds));
    const studentSubmissions = submissions.filter((submission) => isStudentQualityRow(submission, teacherUserIds));
    const participantUserIds = uniqueSorted([
      ...states.filter(isStudentStateRow).map((state) => state.userId),
      ...studentLogs.map((log) => log.userId),
      ...studentFacts.map((fact) => fact.userId),
      ...studentSubmissions.map((submission) => submission.userId),
    ]);
    const lessonKeys = uniqueSorted([
      ...states.map((state) => state.lessonKey),
      ...logs.map((log) => log.lessonKey),
      ...studentFacts.map((fact) => fact.lessonId),
      ...studentSubmissions.map((submission) => submission.lessonKey),
      ...classReports.map((report) => report.lessonKey),
      ...studentReports.map((report) => report.lessonKey),
    ]);
    const submissionCoverage = summarizeSubmissions(studentSubmissions);
    const syncHealth = buildSyncErrorIncidentSummary(logs.map(toSyncIncidentSummaryLog));
    const qualitySyncHealth = buildSyncErrorIncidentSummary(studentLogs.map(toSyncIncidentSummaryLog));
    const loggedUserIds = new Set(studentLogs.map((log) => log.userId));
    const latestStudentFactAtByUserId = latestFactAtByUserId(studentFacts);
    const participantUserIdSet = new Set(participantUserIds);
    const participantStudentReports = studentReports.filter((report) => participantUserIdSet.has(report.userId ?? ''));
    const reportFreshness = buildReportFreshness(
      session,
      classReports,
      participantStudentReports,
      participantUserIds.length,
    );
    const snapshotFreshness = buildSnapshotFreshness(
      session,
      participantUserIds,
      input.studentCompetencySnapshots,
      latestStudentFactAtByUserId,
    );
    const cacheFreshness = buildCacheFreshness(
      session,
      participantUserIds,
      input.studentEvidenceFeatureCaches ?? [],
      latestStudentFactAtByUserId,
    );
    const featureCacheEvaluated = input.studentEvidenceFeatureCaches !== undefined;
    const featureCacheFreshness = {
      ...cacheFreshness,
      evaluated: featureCacheEvaluated,
    };
    const readinessMetrics = buildReadinessMetrics({
      participantCount: participantUserIds.length,
      loggedParticipantCount: loggedUserIds.size,
      submissionCoverage,
      snapshotCoverage: snapshotFreshness.snapshotCoverage,
      postClassUpdateWindowCoverage: snapshotFreshness.postClassUpdateWindowCoverage,
      featureCacheFreshness,
    });
    const syncSeverity = resolveSessionQualitySyncSeverity(syncHealth.severityDistribution);
    const qualitySyncSeverity = resolveSessionQualitySyncSeverity(qualitySyncHealth.severityDistribution);
    const syncQuality = {
      rawSyncErrors: syncHealth.rawErrorCount,
      rawSyncRecoveries: syncHealth.rawRecoveryCount,
      incidentCount: syncHealth.incidentCount,
      affectedUsers: syncHealth.affectedUsers,
      dominantSource: syncHealth.dominantSource,
      dominantFailureKind: syncHealth.dominantFailureKind,
      severityClassification: syncSeverity,
      severityDistribution: syncHealth.severityDistribution,
      recoveredIncidentCount: syncHealth.recoveredIncidentCount,
      unresolvedIncidentCount: syncHealth.unresolvedIncidentCount,
    };
    const qualityStatus = computeSessionQualityStatus({
      participants: participantUserIds.length,
      durableSubmittedParticipants: submissionCoverage.submittedParticipants,
      durableSubmissions: submissionCoverage.totalRows,
      evidenceQualityCounts: submissionCoverage.evidenceQualityCounts,
      reportFresh: reportFreshness.classReportAvailable
        && reportFreshness.classReportFresh
        && reportFreshness.studentReportsFresh,
      snapshotFresh: snapshotFreshness.snapshotCoverage.fresh,
      snapshotCoverageFresh: snapshotFreshness.snapshotCoverage.fresh,
      postClassUpdateWindowFresh: snapshotFreshness.postClassUpdateWindowCoverage.fresh,
      featureCacheFresh: featureCacheEvaluated ? featureCacheFreshness.fresh : true,
      syncSeverity: qualitySyncSeverity,
      unresolvedSyncIncidents: qualitySyncHealth.unresolvedIncidentCount,
      syncAffectedUsers: qualitySyncHealth.affectedUsers,
      finalized: session.status === 'FINISHED',
    });

    return {
      sessionId: session.id,
      classId: session.classId,
      status: session.status,
      planTitle: session.plan.title,
      startTime: session.startTime.toISOString(),
      endTime: session.endTime?.toISOString() ?? null,
      lessonKeys,
      participants: participantUserIds.length,
      interactionLogs: logs.length,
      learningFacts: studentFacts.length,
      qualityStatus,
      submissionCoverage,
      reportFreshness,
      snapshotCoverage: snapshotFreshness.snapshotCoverage,
      postClassUpdateWindowCoverage: snapshotFreshness.postClassUpdateWindowCoverage,
      featureCacheFreshness,
      readinessMetrics,
      snapshotFreshness: snapshotFreshness.compatibilitySnapshotFreshness,
      postClassClosure: {
        captured: {
          complete: hasSessionFinalizeCapture(logs),
          sessionFinalizeEvents: logs.filter((log) => (
            log.eventType === 'session_finalize'
            || readString(readObject(log.eventData).eventType) === 'session_finalize'
          )).length,
        },
        materialized: {
          complete: facts.length > 0,
          learningFacts: facts.length,
        },
        summarized: {
          complete: reportFreshness.classReportAvailable
            && reportFreshness.classReportFresh
            && reportFreshness.studentReportsFresh,
          classReportAvailable: reportFreshness.classReportAvailable,
          studentReportCount: reportFreshness.studentReportCount,
          expectedStudentReports: reportFreshness.expectedStudentReports,
        },
        cached: {
          complete: cacheFreshness.fresh,
          ...cacheFreshness,
        },
      },
      syncQuality,
    };
  });

  return {
    generatedAt,
    filters: input.filters ?? {},
    totals: {
      sessions: sessions.length,
      participants: sessions.reduce((sum, session) => sum + session.participants, 0),
      durableSubmissions: sessions.reduce((sum, session) => sum + session.submissionCoverage.totalRows, 0),
      answerAvailableRows: sessions.reduce((sum, session) => sum + session.submissionCoverage.answerAvailableRows, 0),
      scoreAvailableRows: sessions.reduce((sum, session) => sum + session.submissionCoverage.scoreAvailableRows, 0),
      questionSummaryAvailableRows: sessions.reduce((sum, session) => sum + session.submissionCoverage.questionSummaryAvailableRows, 0),
      rawSyncErrors: sessions.reduce((sum, session) => sum + session.syncQuality.rawSyncErrors, 0),
      syncIncidents: sessions.reduce((sum, session) => sum + session.syncQuality.incidentCount, 0),
    },
    sessions,
  };
}

export async function collectSessionDataQualityReport(
  db: SessionDataQualityDb,
  filters: SessionDataQualityFilters = {},
) {
  const explicitSessionIds = filters.sessionIds ?? [];
  const lessonSessionIds = explicitSessionIds.length === 0
    ? await collectSessionIdsFromLessonFilters(db, filters)
    : [];
  if (explicitSessionIds.length === 0 && filters.lessonKeys?.length && lessonSessionIds.length === 0) {
    return buildSessionDataQualityReport({
      filters,
      sessions: [],
      studentStates: [],
      interactionLogs: [],
      learningFacts: [],
      studentStepResponses: [],
      studentCompetencySnapshots: [],
      classSessionReports: [],
      studentSessionReports: [],
    });
  }
  const sessionIds = uniqueSorted([...explicitSessionIds, ...lessonSessionIds]);
  const sessionWhere = {
    ...(sessionIds.length ? { id: { in: sessionIds } } : {}),
    ...(sessionIds.length === 0 ? buildDateWhere(filters, 'startTime') : {}),
  };
  const sessions = await db.classSession.findMany({
    where: sessionWhere,
    orderBy: { startTime: 'desc' },
    take: sessionIds.length > 0 ? undefined : 20,
    select: {
      id: true,
      classId: true,
      status: true,
      startTime: true,
      endTime: true,
      plan: { select: { title: true } },
    },
  });
  if (sessions.length === 0) {
    return buildSessionDataQualityReport({
      filters,
      sessions: [],
      studentStates: [],
      interactionLogs: [],
      learningFacts: [],
      studentStepResponses: [],
      studentCompetencySnapshots: [],
      classSessionReports: [],
      studentSessionReports: [],
    });
  }
  const resolvedSessionIds = sessions.map((session) => session.id);
  const whereBySession = buildSessionWhere(resolvedSessionIds);
  const [studentStates, interactionLogs, learningFacts, studentStepResponses, classSessionReports, studentSessionReports] = await Promise.all([
    db.studentState.findMany({
      where: {
        ...whereBySession,
        NOT: { stateKey: { startsWith: 'teacher' } },
        ...buildLessonWhere(filters, 'lessonKey'),
      },
      select: {
        sessionId: true,
        userId: true,
        stateKey: true,
        lessonKey: true,
        submittedAt: true,
        lastClientEventAt: true,
      },
    }),
    db.interactionLog.findMany({
      where: {
        ...whereBySession,
        ...buildLessonWhere(filters, 'lessonKey'),
      },
      select: {
        sessionId: true,
        userId: true,
        eventType: true,
        stepId: true,
        lessonKey: true,
        actorRole: true,
        clientEventAt: true,
        createdAt: true,
        eventData: true,
      },
    }),
    db.learningFact.findMany({
      where: {
        ...whereBySession,
        ...buildLessonWhere(filters, 'lessonId'),
      },
      select: {
        sessionId: true,
        userId: true,
        lessonId: true,
        score: true,
        outcome: true,
        startedAt: true,
        contextJson: true,
      },
    }),
    db.studentStepResponse.findMany({
      where: {
        ...whereBySession,
        ...buildLessonWhere(filters, 'lessonKey'),
      },
      select: {
        sessionId: true,
        userId: true,
        lessonKey: true,
        stepId: true,
        submittedAt: true,
        responseData: true,
      },
    }),
    db.classSessionReport.findMany({
      where: {
        ...whereBySession,
        ...buildLessonWhere(filters, 'lessonKey'),
      },
      select: {
        sessionId: true,
        lessonKey: true,
        reportType: true,
        status: true,
        updatedAt: true,
      },
    }),
    db.studentSessionReport.findMany({
      where: {
        ...whereBySession,
        ...buildLessonWhere(filters, 'lessonKey'),
      },
      select: {
        sessionId: true,
        userId: true,
        lessonKey: true,
        reportType: true,
        status: true,
        updatedAt: true,
      },
    }),
  ]);
  const roleUserIds = uniqueSorted([
    ...interactionLogs.map((log) => log.userId),
    ...learningFacts.map((fact) => fact.userId),
    ...studentStepResponses.map((submission) => submission.userId),
  ]);
  const userRoles = roleUserIds.length > 0
    ? await db.user.findMany({
      where: { id: { in: roleUserIds } },
      select: { id: true, role: true },
    })
    : [];
  const roleByUserId = new Map(userRoles.map((user) => [user.id, user.role]));
  const interactionLogsWithRoles = interactionLogs.map((log) => ({
    ...log,
    userRole: resolveQueriedUserRole(roleByUserId, log.userId),
  }));
  const learningFactsWithRoles = learningFacts.map((fact) => ({
    ...fact,
    userRole: resolveQueriedUserRole(roleByUserId, fact.userId),
  }));
  const studentStepResponsesWithRoles = studentStepResponses.map((submission) => ({
    ...submission,
    userRole: resolveQueriedUserRole(roleByUserId, submission.userId),
  }));
  const teacherUserIds = new Set([
    ...studentStates.filter((state) => !isStudentStateRow(state)).map((state) => state.userId),
    ...interactionLogsWithRoles.filter((log) => !isStudentInteractionLog(log)).map((log) => log.userId),
    ...learningFactsWithRoles.filter((fact) => !isStudentUserRole(fact.userRole)).map((fact) => fact.userId),
    ...studentStepResponsesWithRoles.filter((submission) => !isStudentUserRole(submission.userRole)).map((submission) => submission.userId),
  ]);
  const participantUserIds = uniqueSorted([
    ...studentStates.filter(isStudentStateRow).map((state) => state.userId),
    ...interactionLogsWithRoles.filter(isStudentInteractionLog).map((log) => log.userId),
    ...learningFactsWithRoles.filter((fact) => isStudentQualityRow(fact, teacherUserIds)).map((fact) => fact.userId),
    ...studentStepResponsesWithRoles.filter((submission) => isStudentQualityRow(submission, teacherUserIds)).map((submission) => submission.userId),
  ]);
  const sessionTimes = sessions.flatMap((session) => [
    session.startTime,
    session.endTime ?? session.startTime,
  ]);
  const snapshotStart = sessionTimes.length > 0
    ? new Date(Math.min(...sessionTimes.map((date) => date.getTime())))
    : null;
  const snapshotEnd = latestDate(sessionTimes);
  const studentCompetencySnapshots = participantUserIds.length > 0
    ? await db.studentCompetencySnapshot.findMany({
      where: {
        userId: { in: participantUserIds },
        ...(snapshotStart && snapshotEnd ? {
          snapshotAt: {
            gte: snapshotStart,
            lte: new Date(snapshotEnd.getTime() + SNAPSHOT_FRESHNESS_WINDOW_MS),
          },
        } : {}),
      },
      select: {
        userId: true,
        snapshotAt: true,
      },
    })
    : [];
  const studentEvidenceFeatureCaches = participantUserIds.length > 0 && db.studentEvidenceFeatureCache
    ? await db.studentEvidenceFeatureCache.findMany({
      where: {
        userId: { in: participantUserIds },
      },
      select: {
        userId: true,
        refreshedAt: true,
        lastSourceFactAt: true,
        statusMarkers: true,
      },
    })
    : undefined;

  return buildSessionDataQualityReport({
    filters,
    sessions,
    studentStates,
    interactionLogs: interactionLogsWithRoles,
    learningFacts: learningFactsWithRoles,
    studentStepResponses: studentStepResponsesWithRoles,
    studentCompetencySnapshots,
    classSessionReports,
    studentSessionReports,
    studentEvidenceFeatureCaches,
  });
}
