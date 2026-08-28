import type { Prisma, PrismaClient } from '@prisma/client';
import {
  buildSyncIncidentKey,
  classifySyncIncidentSeverity,
  isTransientSyncClientNoise,
  resolveSyncIncidentFailureKind,
  resolveSyncIncidentSource,
  SYNC_INCIDENT_BURST_WINDOW_MS,
  type SyncIncidentSeverity,
} from '@/lib/classroom-analytics/sync-incident-model';
import { resolveCanonicalEventType } from './event-normalization';
import {
  computeSessionQualityStatus,
  resolveSessionQualitySyncSeverity,
} from './session-quality-status';
import {
  createSubmissionEvidenceQualityCounts,
  summarizeSubmissionEvidencePayload,
} from './submission-evidence-quality';

type ReportPrisma = Pick<PrismaClient,
  | 'classSession'
  | 'studentState'
  | 'interactionLog'
  | 'learningFact'
  | 'studentStepResponse'
  | 'studentCompetencySnapshot'
  | 'classSessionReport'
  | 'studentSessionReport'
  | 'user'
>;

interface InteractionLogSummaryItem {
  userId: string;
  eventType: string;
  stepId: string | null;
  clientEventAt: Date | null;
  lessonKey: string | null;
  learningContext?: string | null;
  invalidContextReason?: string | null;
  actorRole?: string | null;
  userRole?: string | null;
  eventData: unknown;
}

interface LearningFactSummaryItem {
  userId: string;
  userRole?: string | null;
  factType: string;
  outcome: string;
  lessonId: string | null;
  startedAt?: Date | null;
}

interface StudentStateSummaryItem {
  userId: string;
  lessonKey: string | null;
}

interface StudentStepResponseSummaryItem {
  userId: string;
  userRole?: string | null;
  stepId: string;
  submittedAt: Date;
  responseData: unknown;
}

interface UserRoleSummaryItem {
  id: string;
  role: string | null;
}

interface StudentSnapshotSummaryItem {
  userId: string;
  snapshotAt: Date;
}

const SESSION_SNAPSHOT_UPDATE_WINDOW_MS = 2 * 60 * 60 * 1000;
const SYNC_ERROR_BURST_WINDOW_MS = SYNC_INCIDENT_BURST_WINDOW_MS;
const UNKNOWN_USER_ROLE = 'UNKNOWN';

function increment(map: Record<string, number>, key: string | null | undefined) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function resolveReportEventType(log: InteractionLogSummaryItem): string {
  return resolveCanonicalEventType(log.eventType, readObject(log.eventData));
}

function isStudentInteractionLog(log: InteractionLogSummaryItem) {
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

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function summarizeSubmissionEvidence(submissions: StudentStepResponseSummaryItem[]) {
  const evidenceQualityCounts = createSubmissionEvidenceQualityCounts();
  const evidenceQualityReasonCounts: Record<string, number> = {};
  let scoreableObjectiveSubmissions = 0;
  for (const submission of submissions) {
    const summary = summarizeSubmissionEvidencePayload(submission.responseData);
    evidenceQualityCounts[summary.quality] += 1;
    evidenceQualityReasonCounts[summary.reason] = (evidenceQualityReasonCounts[summary.reason] ?? 0) + 1;
    scoreableObjectiveSubmissions += summary.scoreableObjectiveSubmissions;
  }
  return {
    evidenceQualityCounts,
    evidenceQualityReasonCounts,
    scoreableObjectiveSubmissions,
  };
}

function latestFactAtByUserId(facts: LearningFactSummaryItem[]) {
  const latestByUserId = new Map<string, Date>();
  for (const fact of facts) {
    if (!(fact.startedAt instanceof Date) || !Number.isFinite(fact.startedAt.getTime())) continue;
    const current = latestByUserId.get(fact.userId);
    if (!current || fact.startedAt.getTime() > current.getTime()) {
      latestByUserId.set(fact.userId, fact.startedAt);
    }
  }
  return latestByUserId;
}

function latestSnapshotAtByUserId(snapshots: StudentSnapshotSummaryItem[]) {
  const latestByUserId = new Map<string, Date>();
  for (const snapshot of snapshots) {
    const current = latestByUserId.get(snapshot.userId);
    if (!current || snapshot.snapshotAt.getTime() > current.getTime()) {
      latestByUserId.set(snapshot.userId, snapshot.snapshotAt);
    }
  }
  return latestByUserId;
}

function buildStudentReportData(
  userId: string,
  logs: InteractionLogSummaryItem[],
  facts: LearningFactSummaryItem[],
  submissions: StudentStepResponseSummaryItem[],
) {
  const eventTypes: Record<string, number> = {};
  const canonicalEventTypes: Record<string, number> = {};
  const learningContexts: Record<string, number> = {};
  const outcomes: Record<string, number> = {};

  for (const log of logs) {
    increment(eventTypes, log.eventType);
    increment(canonicalEventTypes, resolveReportEventType(log));
    increment(learningContexts, log.learningContext);
  }
  for (const fact of facts) {
    increment(outcomes, fact.outcome);
  }
  const evidenceSummary = summarizeSubmissionEvidence(submissions);
  const syncHealth = buildSyncErrorIncidentSummary(logs);

  return {
    userId,
    interactionLogs: logs.length,
    learningFacts: facts.length,
    durableSubmissions: submissions.length,
    eventTypes,
    legacyEventTypes: eventTypes,
    canonicalEventTypes,
    learningContexts,
    outcomes,
    syncErrors: canonicalEventTypes.sync_error ?? 0,
    syncErrorIncidents: syncHealth.incidentCount,
    syncHealth,
    evidenceQualityCounts: evidenceSummary.evidenceQualityCounts,
    evidenceQualityReasonCounts: evidenceSummary.evidenceQualityReasonCounts,
    scoreableObjectiveSubmissions: evidenceSummary.scoreableObjectiveSubmissions,
  };
}

function resolveSyncErrorSignature(log: InteractionLogSummaryItem): string {
  const data = readObject(log.eventData);
  return firstNonEmpty([
    typeof data.incidentKey === 'string' ? data.incidentKey : null,
    typeof data.message === 'string' ? data.message : null,
    typeof data.error === 'string' ? data.error : null,
    typeof data.reason === 'string' ? data.reason : null,
    typeof data.scope === 'string' ? data.scope : null,
    log.eventType,
  ]) ?? 'sync_error';
}

interface SyncErrorIncidentSummary {
  [key: string]: unknown;
  rawErrorCount: number;
  rawRecoveryCount: number;
  incidentCount: number;
  affectedUsers: number;
  affectedUserIds: string[];
  dominantSource: string | null;
  dominantFailureKind: string | null;
  severityDistribution: Record<SyncIncidentSeverity, number>;
  recoveredIncidentCount: number;
  unresolvedIncidentCount: number;
  transientClientNoiseCount: number;
  broadServiceIncidentCount: number;
  concentratedUserIncidentCount: number;
  incidentWindowMs: number;
}

interface SyncErrorIncidentBucket {
  key: string;
  recoveryKey: string;
  userId: string;
  source: string;
  failureKind: string;
  severity: SyncIncidentSeverity;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  count: number;
  transientClientNoise: boolean;
}

function isSyncRecoveryLog(log: InteractionLogSummaryItem) {
  const data = readObject(log.eventData);
  return resolveReportEventType(log) === 'sync_recovered' || data.eventType === 'sync_recovered';
}

function readIncidentKeyPayload(value: unknown) {
  if (typeof value !== 'string') {
    return {};
  }
  const parts = value.split('\u0000');
  if (parts.length !== 8) {
    return {};
  }
  const status = parts[7] === 'none' ? null : Number(parts[7]);
  return {
    source: parts[3],
    url: parts[4],
    method: parts[5],
    failureKind: parts[6],
    status: status !== null && Number.isFinite(status) ? status : undefined,
  };
}

function createSyncErrorIncidentKey(log: InteractionLogSummaryItem) {
  const data = readObject(log.eventData);
  const rawDiagnostics = readObject(data.rawDiagnostics);
  const originalKeyPayload = readIncidentKeyPayload(data.incidentKey);
  const scope = typeof data.scope === 'string'
    ? data.scope
    : typeof data.actorRole === 'string'
      ? `${data.actorRole}-page`
      : null;
  const keyedPayload = {
    ...rawDiagnostics,
    ...data,
    message: resolveSyncErrorSignature(log),
    url: data.url ?? rawDiagnostics.url ?? originalKeyPayload.url ?? resolveSyncErrorSignature(log),
    method: data.method ?? rawDiagnostics.method ?? originalKeyPayload.method,
    source: data.source ?? rawDiagnostics.source ?? originalKeyPayload.source,
    failureKind: data.failureKind ?? rawDiagnostics.failureKind ?? originalKeyPayload.failureKind,
    status: data.status ?? rawDiagnostics.status ?? originalKeyPayload.status,
  };
  return buildSyncIncidentKey({
    payload: keyedPayload,
    userId: log.userId,
    stepId: log.stepId,
    scope,
  });
}

function incrementIncidentField(map: Record<string, number>, key: string | null | undefined) {
  increment(map, key && key !== 'unknown' ? key : null);
}

function topFieldValue(map: Record<string, number>) {
  const entries = Object.entries(map).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });
  return entries[0]?.[0] ?? null;
}

export function buildSyncErrorIncidentSummary(logs: InteractionLogSummaryItem[]): SyncErrorIncidentSummary {
  const sorted = logs
    .filter((log) => resolveReportEventType(log) === 'sync_error')
    .map((log, index) => ({
      log,
      index,
      time: log.clientEventAt instanceof Date ? log.clientEventAt.getTime() : null,
      key: createSyncErrorIncidentKey(log),
    }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key.localeCompare(b.key);
      if (a.time !== null && b.time !== null && a.time !== b.time) return a.time - b.time;
      return a.index - b.index;
    });

  const lastIncidentAtByKey = new Map<string, number>();
  const openIncidentByKey = new Map<string, SyncErrorIncidentBucket>();
  const incidents: SyncErrorIncidentBucket[] = [];

  for (const item of sorted) {
    const data = readObject(item.log.eventData);
    const severity = classifySyncIncidentSeverity({
      payload: data,
      occurrenceCount: typeof data.incidentOccurrenceCount === 'number' ? data.incidentOccurrenceCount : 1,
    });
    if (item.time === null) {
      incidents.push({
        key: `${item.key}\u0000${item.index}`,
        recoveryKey: item.key,
        userId: item.log.userId,
        source: resolveSyncIncidentSource(data),
        failureKind: resolveSyncIncidentFailureKind(data),
        severity,
        firstSeenAt: null,
        lastSeenAt: null,
        count: 1,
        transientClientNoise: isTransientSyncClientNoise(data),
      });
      continue;
    }
    const lastIncidentAt = lastIncidentAtByKey.get(item.key);
    if (lastIncidentAt === undefined || item.time - lastIncidentAt > SYNC_ERROR_BURST_WINDOW_MS) {
      const incident = {
        key: item.key,
        recoveryKey: item.key,
        userId: item.log.userId,
        source: resolveSyncIncidentSource(data),
        failureKind: resolveSyncIncidentFailureKind(data),
        severity,
        firstSeenAt: item.time,
        lastSeenAt: item.time,
        count: 1,
        transientClientNoise: isTransientSyncClientNoise(data),
      };
      incidents.push(incident);
      openIncidentByKey.set(item.key, incident);
      lastIncidentAtByKey.set(item.key, item.time);
      continue;
    }

    const incident = openIncidentByKey.get(item.key);
    if (incident) {
      incident.count += 1;
      incident.lastSeenAt = item.time;
      lastIncidentAtByKey.set(item.key, item.time);
      if (!incident.transientClientNoise) {
        incident.transientClientNoise = isTransientSyncClientNoise(data);
      }
    }
  }

  const recoveryEvents = logs
    .filter(isSyncRecoveryLog)
    .map((log, index) => ({
      key: createSyncErrorIncidentKey(log),
      time: log.clientEventAt instanceof Date ? log.clientEventAt.getTime() : null,
      index,
    }))
    .sort((left, right) => {
      if (left.key !== right.key) return left.key.localeCompare(right.key);
      if (left.time !== null && right.time !== null && left.time !== right.time) return left.time - right.time;
      return left.index - right.index;
    });
  const usedRecoveryIndexes = new Set<number>();
  const affectedUserIds = Array.from(new Set(incidents.map((incident) => incident.userId))).sort();
  const sourceCounts: Record<string, number> = {};
  const failureKindCounts: Record<string, number> = {};
  const severityDistribution: Record<SyncIncidentSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
  };
  let recoveredIncidentCount = 0;
  let transientClientNoiseCount = 0;

  for (const incident of incidents) {
    incrementIncidentField(sourceCounts, incident.source);
    incrementIncidentField(failureKindCounts, incident.failureKind);
    severityDistribution[incident.severity] += 1;
    const recoveryIndex = recoveryEvents.findIndex((recovery, index) => (
      !usedRecoveryIndexes.has(index)
      && recovery.key === incident.recoveryKey
      && (
        incident.lastSeenAt === null
        || recovery.time === null
        || recovery.time >= incident.lastSeenAt
      )
    ));
    const isRecovered = recoveryIndex >= 0;
    if (recoveryIndex >= 0) {
      usedRecoveryIndexes.add(recoveryIndex);
    }
    if (isRecovered) {
      recoveredIncidentCount += 1;
    }
    if (incident.transientClientNoise || (isRecovered && incident.severity === 'low')) {
      transientClientNoiseCount += 1;
    }
  }
  const highSeverityUserIds = new Set(
    incidents
      .filter((incident) => incident.severity === 'high')
      .map((incident) => incident.userId),
  );
  const broadServiceIncidentCount = highSeverityUserIds.size >= 2
    ? incidents.filter((incident) => incident.severity === 'high').length
    : 0;

  return {
    rawErrorCount: sorted.length,
    rawRecoveryCount: logs.filter(isSyncRecoveryLog).length,
    incidentCount: incidents.length,
    affectedUsers: affectedUserIds.length,
    affectedUserIds,
    dominantSource: topFieldValue(sourceCounts),
    dominantFailureKind: topFieldValue(failureKindCounts),
    severityDistribution,
    recoveredIncidentCount,
    unresolvedIncidentCount: Math.max(0, incidents.length - recoveredIncidentCount),
    transientClientNoiseCount,
    broadServiceIncidentCount,
    concentratedUserIncidentCount: incidents.length - broadServiceIncidentCount,
    incidentWindowMs: SYNC_ERROR_BURST_WINDOW_MS,
  };
}

/**
 * 显式重算选项：只有授权操作命名新 revision、输入水位与晚到证据输入界后，
 * POST_SESSION_REVIEW 证据才可进入重算报告。重算结果写入独立的
 * 'class-summary-recompute' 报告行，原 'class-summary' 闭包报告保持不变、
 * 可独立查询。
 */
export interface SessionReportRecomputeOptions {
  recomputeRevision: number;
  recomputeInputWatermark: bigint;
  /** 命名的晚到证据输入界：仅纳入 submittedAt 早于该时点的 POST_SESSION_REVIEW 行 */
  includeReviewSubmittedBefore: Date;
}

export async function generateSessionSummaryReports(
  db: ReportPrisma,
  sessionId: string,
  options?: { recompute?: SessionReportRecomputeOptions },
): Promise<{ classReports: number; studentReports: number; skipped: boolean }> {
  const recompute = options?.recompute ?? null;
  const session = await db.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      status: true,
      startTime: true,
      endTime: true,
      closureRevision: true,
      acceptedSubmissionWatermark: true,
      plan: {
        select: { title: true },
      },
    },
  });

  if (!session) {
    return { classReports: 0, studentReports: 0, skipped: true };
  }

  // 默认闭包读法：仅接受水位以内的 ACCEPTED 证据；POST_SESSION_REVIEW 一律排除。
  // 历史 ACCEPTED 行（submissionSequence 为 null，水位前写入）保持纳入。
  // 重算读法：水位以内 ACCEPTED + 调用方以 includeReviewSubmittedBefore 命名的晚到证据输入界。
  const acceptedSubmissionWatermark = session.acceptedSubmissionWatermark;
  const submissionEvidenceWhere: Prisma.StudentStepResponseWhereInput = recompute
    ? {
      sessionId,
      OR: [
        {
          evidenceStatus: 'ACCEPTED',
          ...(acceptedSubmissionWatermark != null
            ? {
              OR: [
                { submissionSequence: { lte: acceptedSubmissionWatermark } },
                { submissionSequence: null },
              ],
            }
            : {}),
        },
        {
          evidenceStatus: 'POST_SESSION_REVIEW',
          submittedAt: { lt: recompute.includeReviewSubmittedBefore },
        },
      ],
    }
    : {
      sessionId,
      evidenceStatus: 'ACCEPTED',
      ...(acceptedSubmissionWatermark != null
        ? {
          OR: [
            { submissionSequence: { lte: acceptedSubmissionWatermark } },
            { submissionSequence: null },
          ],
        }
        : {}),
    };

  const [studentStates, logs, facts, submissions] = await Promise.all([
    db.studentState.findMany({
      where: { sessionId, NOT: { stateKey: { startsWith: 'teacher' } } },
      select: {
        userId: true,
        lessonKey: true,
      },
    }) as Promise<StudentStateSummaryItem[]>,
    db.interactionLog.findMany({
      where: { sessionId },
      select: {
        userId: true,
        eventType: true,
        stepId: true,
        clientEventAt: true,
        lessonKey: true,
        learningContext: true,
        invalidContextReason: true,
        actorRole: true,
        eventData: true,
      },
    }) as Promise<InteractionLogSummaryItem[]>,
    db.learningFact.findMany({
      where: { sessionId },
      select: {
        userId: true,
        factType: true,
        outcome: true,
        lessonId: true,
        startedAt: true,
      },
    }) as Promise<LearningFactSummaryItem[]>,
    db.studentStepResponse.findMany({
      where: submissionEvidenceWhere,
      select: {
        userId: true,
        stepId: true,
        submittedAt: true,
        responseData: true,
      },
    }) as Promise<StudentStepResponseSummaryItem[]>,
  ]);
  const postSessionReviewTotal = await db.studentStepResponse.count({
    where: { sessionId, evidenceStatus: 'POST_SESSION_REVIEW' },
  });

  // 结构性闭包谓词：原闭包消费者一律使用 closureLogs；晚到（afterSessionEnd）
  // 事件单独留存，仅作为披露计数。任何新的统计口径都不得直接读取原始 logs。
  const afterSessionEndLogs = logs.filter((log) => readObject(log.eventData).afterSessionEnd === true);
  const closureLogs = logs.filter((log) => readObject(log.eventData).afterSessionEnd !== true);
  const includedReviewCount = recompute
    ? await db.studentStepResponse.count({
      where: {
        sessionId,
        evidenceStatus: 'POST_SESSION_REVIEW',
        submittedAt: { lt: recompute.includeReviewSubmittedBefore },
      },
    })
    : 0;
  // 默认闭包读法排除全部 POST_SESSION_REVIEW；显式重算修订仅纳入命名输入界以内的部分
  const excludedPostSessionReviewSubmissions = recompute
    ? postSessionReviewTotal - includedReviewCount
    : postSessionReviewTotal;

  const roleUserIds = Array.from(new Set([
    ...closureLogs.map((log) => log.userId),
    ...facts.map((fact) => fact.userId),
    ...submissions.map((submission) => submission.userId),
  ])).sort();
  const userRoles = roleUserIds.length > 0
    ? await db.user.findMany({
      where: { id: { in: roleUserIds } },
      select: { id: true, role: true },
    }) as UserRoleSummaryItem[]
    : [];
  const roleByUserId = new Map(userRoles.map((user) => [user.id, user.role]));
  const logsWithRoles = closureLogs.map((log) => ({
    ...log,
    userRole: resolveQueriedUserRole(roleByUserId, log.userId),
  }));
  const factsWithRoles = facts.map((fact) => ({
    ...fact,
    userRole: resolveQueriedUserRole(roleByUserId, fact.userId),
  }));
  const submissionsWithRoles = submissions.map((submission) => ({
    ...submission,
    userRole: resolveQueriedUserRole(roleByUserId, submission.userId),
  }));
  const studentLogs = logsWithRoles.filter(isStudentInteractionLog);
  const teacherUserIds = new Set([
    ...logsWithRoles.filter((log) => !isStudentInteractionLog(log)).map((log) => log.userId),
    ...factsWithRoles.filter((fact) => !isStudentUserRole(fact.userRole)).map((fact) => fact.userId),
    ...submissionsWithRoles.filter((submission) => !isStudentUserRole(submission.userRole)).map((submission) => submission.userId),
  ]);
  const studentFacts = factsWithRoles.filter((fact) => isStudentQualityRow(fact, teacherUserIds));
  const studentSubmissions = submissionsWithRoles.filter((submission) => isStudentQualityRow(submission, teacherUserIds));
  const loggedUserIds = new Set(studentLogs.map((log) => log.userId));
  const factUserIds = new Set(studentFacts.map((fact) => fact.userId));
  const durableSubmittedUserIds = new Set(studentSubmissions.map((submission) => submission.userId));
  const sessionParticipantUserIds = Array.from(new Set([
    ...studentStates.map((state) => state.userId),
    ...studentLogs.map((log) => log.userId),
    ...studentFacts.map((fact) => fact.userId),
    ...studentSubmissions.map((submission) => submission.userId),
  ])).sort();
  const lessonKey = firstNonEmpty([
    closureLogs.find((log) => log.lessonKey)?.lessonKey,
    studentFacts.find((fact) => fact.lessonId)?.lessonId,
    studentStates.find((state) => state.lessonKey)?.lessonKey,
  ]);
  const eventTypes: Record<string, number> = {};
  const canonicalEventTypes: Record<string, number> = {};
  const learningContexts: Record<string, number> = {};
  const invalidContextReasons: Record<string, number> = {};
  const submittedUserIds = new Set<string>();
  const syncErrorUserIds = new Set<string>();
  // 晚到事件不计入任何闭包统计，仅作为披露计数保留
  const afterSessionEndEvents = afterSessionEndLogs.length;

  for (const log of closureLogs) {
    const canonicalEventType = resolveReportEventType(log);
    increment(eventTypes, log.eventType);
    increment(canonicalEventTypes, canonicalEventType);
    increment(learningContexts, log.learningContext);
    increment(invalidContextReasons, log.invalidContextReason);
    if (canonicalEventType === 'sync_error') {
      syncErrorUserIds.add(log.userId);
    }
  }
  for (const log of studentLogs) {
    const canonicalEventType = resolveReportEventType(log);
    if (canonicalEventType === 'lesson_submit' || canonicalEventType === 'lesson_resubmit') {
      submittedUserIds.add(log.userId);
    }
  }

  const syncHealth = buildSyncErrorIncidentSummary(closureLogs);
  const qualitySyncHealth = buildSyncErrorIncidentSummary(studentLogs);
  const syncErrorIncidents = syncHealth.incidentCount;
  const evidenceSummary = summarizeSubmissionEvidence(studentSubmissions);

  const snapshotWindowStart = session.endTime ?? session.startTime;
  const snapshotWindowEnd = new Date(snapshotWindowStart.getTime() + SESSION_SNAPSHOT_UPDATE_WINDOW_MS);
  const snapshotQueryStart = session.startTime;
  const snapshots = sessionParticipantUserIds.length > 0
    ? await db.studentCompetencySnapshot.findMany({
      where: {
        userId: { in: sessionParticipantUserIds },
        snapshotAt: {
          gte: snapshotQueryStart,
          lte: snapshotWindowEnd,
        },
      },
      select: {
        userId: true,
        snapshotAt: true,
      },
    }) as StudentSnapshotSummaryItem[]
    : [];
  const snapshotUpdatedUserIds = new Set(
    snapshots
      .filter((snapshot) =>
        snapshot.snapshotAt.getTime() >= snapshotWindowStart.getTime() &&
        snapshot.snapshotAt.getTime() <= snapshotWindowEnd.getTime()
      )
      .map((snapshot) => snapshot.userId),
  );
  const latestFactAtByUser = latestFactAtByUserId(studentFacts);
  const latestSnapshotAtByUser = latestSnapshotAtByUserId(snapshots);
  const snapshotCoverageUserIds = sessionParticipantUserIds.filter((userId) => latestFactAtByUser.has(userId));
  const snapshotCoveredUserIds = snapshotCoverageUserIds.filter((userId) => {
    const latestFactAt = latestFactAtByUser.get(userId);
    const latestSnapshotAt = latestSnapshotAtByUser.get(userId);
    return Boolean(
      latestFactAt
      && latestSnapshotAt
      && latestSnapshotAt.getTime() >= latestFactAt.getTime()
      && latestSnapshotAt.getTime() <= snapshotWindowEnd.getTime()
    );
  });
  const snapshotCoverageFresh = snapshotCoverageUserIds.length === snapshotCoveredUserIds.length;
  const postClassUpdateWindowFresh = sessionParticipantUserIds.length === snapshotUpdatedUserIds.size;
  const qualityStatus = computeSessionQualityStatus({
    participants: sessionParticipantUserIds.length,
    durableSubmittedParticipants: durableSubmittedUserIds.size,
    durableSubmissions: studentSubmissions.length,
    evidenceQualityCounts: evidenceSummary.evidenceQualityCounts,
    reportFresh: true,
    snapshotFresh: snapshotCoverageFresh,
    snapshotCoverageFresh,
    postClassUpdateWindowFresh,
    syncSeverity: resolveSessionQualitySyncSeverity(qualitySyncHealth.severityDistribution),
    unresolvedSyncIncidents: qualitySyncHealth.unresolvedIncidentCount,
    syncAffectedUsers: qualitySyncHealth.affectedUsers,
    finalized: session.status === 'FINISHED',
  });
  const qualityStatusData = {
    status: qualityStatus.status,
    reasons: [...qualityStatus.reasons],
    metrics: { ...qualityStatus.metrics },
  };

  const classReportData = {
    sessionId,
    classId: session.classId,
    status: session.status,
    planTitle: session.plan.title,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime?.toISOString() ?? null,
    participants: sessionParticipantUserIds.length,
    interactionLogs: closureLogs.length,
    learningFacts: studentFacts.length,
    durableSubmissions: studentSubmissions.length,
    submittedParticipantsFromDurableResponses: durableSubmittedUserIds.size,
    evidenceQualityCounts: evidenceSummary.evidenceQualityCounts,
    evidenceQualityReasonCounts: evidenceSummary.evidenceQualityReasonCounts,
    scoreableObjectiveSubmissions: evidenceSummary.scoreableObjectiveSubmissions,
    eventTypes,
    legacyEventTypes: eventTypes,
    canonicalEventTypes,
    learningContexts,
    invalidContextReasons,
    syncErrors: canonicalEventTypes.sync_error ?? 0,
    syncErrorIncidents,
    syncHealth,
    qualityStatus: qualityStatusData,
    closure: {
      closureRevision: session.closureRevision,
      acceptedSubmissionWatermark: acceptedSubmissionWatermark != null ? acceptedSubmissionWatermark.toString() : null,
      sessionStatus: session.status,
      evidenceSelection: recompute
        ? 'explicit-recompute-revision'
        : acceptedSubmissionWatermark != null
          ? 'accepted-submission-watermark'
          : 'accepted-only',
      excludedPostSessionReviewSubmissions,
      postSessionReviewSubmissionsTotal: postSessionReviewTotal,
    },
    ...(recompute
      ? {
        recompute: {
          revision: recompute.recomputeRevision,
          inputWatermark: recompute.recomputeInputWatermark.toString(),
          includedReviewCutoffAt: recompute.includeReviewSubmittedBefore.toISOString(),
          includedPostSessionReviewSubmissions: includedReviewCount,
          generatedAt: new Date().toISOString(),
        },
      }
      : {}),
    phases: {
      captured: {
        status: 'SUCCEEDED',
        interactionLogs: closureLogs.length,
        acceptedSubmissions: studentSubmissions.length,
        postSessionReviewIncluded: recompute ? postSessionReviewTotal : 0,
      },
      materialized: {
        // 报告时点的观测计数：事实物化由事件摄取流水线异步推进，此处不声称完成
        status: 'OBSERVED',
        learningFacts: studentFacts.length,
        note: 'LearningFact rows linked to this session at report time; completion is owned by the event-ingestion pipeline',
      },
      summarized: {
        status: 'SUCCEEDED',
        generatedAt: new Date().toISOString(),
        reportTypes: recompute ? ['class-summary-recompute'] : ['class-summary', 'student-summary'],
      },
      cached: {
        status: 'DEFERRED',
        note: 'per-user cache refresh is a closure phase tracked in SessionClosurePhase; settlement requires its SUCCEEDED receipt',
      },
    },
    afterSessionEndEvents,
    sessionGovernanceSummary: {
      qualityStatus: qualityStatusData,
      sessionParticipants: sessionParticipantUserIds.length,
      loggedParticipants: loggedUserIds.size,
      factParticipants: factUserIds.size,
      submittedParticipants: submittedUserIds.size,
      durableSubmittedParticipants: durableSubmittedUserIds.size,
      durableSubmissionAttempts: studentSubmissions.length,
      evidenceRichSubmissions: evidenceSummary.evidenceQualityCounts.rich,
      partialEvidenceSubmissions: evidenceSummary.evidenceQualityCounts.partial,
      legacyEvidenceSubmissions: evidenceSummary.evidenceQualityCounts.legacy,
      missingEvidenceSubmissions: evidenceSummary.evidenceQualityCounts.missing,
      scoreableObjectiveSubmissions: evidenceSummary.scoreableObjectiveSubmissions,
      snapshotUpdatedParticipants: snapshotUpdatedUserIds.size,
      snapshotCoveredParticipants: snapshotCoveredUserIds.length,
      snapshotCoverageExpectedParticipants: snapshotCoverageUserIds.length,
      snapshotCoverageMissingParticipants: Math.max(0, snapshotCoverageUserIds.length - snapshotCoveredUserIds.length),
      postClassUpdatedParticipants: snapshotUpdatedUserIds.size,
      postClassUpdateWindowExpectedParticipants: sessionParticipantUserIds.length,
      postClassUpdateWindowMissingParticipants: Math.max(0, sessionParticipantUserIds.length - snapshotUpdatedUserIds.size),
      syncErrorUsers: syncErrorUserIds.size,
      rawSyncErrors: canonicalEventTypes.sync_error ?? 0,
      syncErrorIncidents,
      syncAffectedUsers: syncHealth.affectedUsers,
      syncDominantSource: syncHealth.dominantSource,
      syncDominantFailureKind: syncHealth.dominantFailureKind,
      syncIncidentSeverityDistribution: syncHealth.severityDistribution,
      recoveredSyncErrorIncidents: syncHealth.recoveredIncidentCount,
      unresolvedSyncErrorIncidents: syncHealth.unresolvedIncidentCount,
      transientClientSyncNoise: syncHealth.transientClientNoiseCount,
      broadServiceSyncIncidents: syncHealth.broadServiceIncidentCount,
      snapshotUpdateWindow: {
        startTime: snapshotWindowStart.toISOString(),
        endTime: snapshotWindowEnd.toISOString(),
      },
      snapshotCoverageWindow: {
        startTime: snapshotQueryStart.toISOString(),
        endTime: snapshotWindowEnd.toISOString(),
      },
    },
    evidenceSources: {
      interactionLogs: 'InteractionLog rows within the original closure; post-session (afterSessionEnd) events are excluded from statistics and only disclosed via afterSessionEndEvents',
      durableSubmissions: 'StudentStepResponse rows for this session',
      learningFacts: 'LearningFact rows for this session',
      stateParticipants: 'StudentState rows for this session, excluding teacher state',
      snapshotCoveredParticipants: 'StudentCompetencySnapshot rows whose latest snapshot covers the latest session LearningFact',
      snapshotUpdatedParticipants: 'Compatibility field for StudentCompetencySnapshot rows in the post-class update window',
      syncErrorIncidents: 'sync_error InteractionLog rows grouped by user, step, signature, and 30 second burst window',
    },
    snapshotCoveragePolicy: {
      denominator: 'participantsWithLearningFacts',
      denominatorCount: snapshotCoverageUserIds.length,
      coveredCount: snapshotCoveredUserIds.length,
      updatedCount: snapshotCoveredUserIds.length,
      windowStartTime: snapshotQueryStart.toISOString(),
      windowEndTime: snapshotWindowEnd.toISOString(),
    },
    postClassUpdateWindowPolicy: {
      denominator: 'sessionParticipants',
      denominatorCount: sessionParticipantUserIds.length,
      updatedCount: snapshotUpdatedUserIds.size,
      windowStartTime: snapshotWindowStart.toISOString(),
      windowEndTime: snapshotWindowEnd.toISOString(),
    },
    participationSemantics: {
      participants: 'distinct users from StudentState, InteractionLog, LearningFact, and StudentStepResponse for this session',
      activeStudentCount: 'class-level long-term snapshot count, not a classroom participation metric',
    },
  };
  const classReportJson = classReportData as Prisma.InputJsonValue;
  const summary = `${sessionParticipantUserIds.length} 名学生产生 ${studentLogs.length} 条互动日志，沉淀 ${studentFacts.length} 条学习事实。`;
  // 重算写入独立报告行：原 'class-summary' 闭包报告保持不变、可独立查询
  const classReportType = recompute ? 'class-summary-recompute' : 'class-summary';

  await db.classSessionReport.upsert({
    where: {
      sessionId_reportType: {
        sessionId,
        reportType: classReportType,
      },
    },
    create: {
      sessionId,
      lessonKey,
      reportType: classReportType,
      status: 'READY',
      summary,
      reportData: classReportJson,
      closureRevision: session.closureRevision,
      acceptedSubmissionWatermark,
      recomputeRevision: recompute?.recomputeRevision ?? null,
      recomputeInputWatermark: recompute?.recomputeInputWatermark ?? null,
    },
    update: {
      lessonKey,
      status: 'READY',
      summary,
      reportData: classReportJson,
      closureRevision: session.closureRevision,
      acceptedSubmissionWatermark,
      recomputeRevision: recompute?.recomputeRevision ?? null,
      recomputeInputWatermark: recompute?.recomputeInputWatermark ?? null,
    },
  });

  if (recompute) {
    return { classReports: 1, studentReports: 0, skipped: false };
  }

  for (const userId of sessionParticipantUserIds) {
    // 学生报告与班级报告使用同一闭包谓词：晚到事件不进入任何学生统计
    const studentLogs = closureLogs.filter((log) => log.userId === userId);
    const userFacts = studentFacts.filter((fact) => fact.userId === userId);
    const userSubmissions = studentSubmissions.filter((submission) => submission.userId === userId);
    const studentLessonKey = firstNonEmpty([
      studentLogs.find((log) => log.lessonKey)?.lessonKey,
      userFacts.find((fact) => fact.lessonId)?.lessonId,
      studentStates.find((state) => state.userId === userId)?.lessonKey,
      lessonKey,
    ]);
    const reportData = buildStudentReportData(userId, studentLogs, userFacts, userSubmissions);
    const reportDataJson = reportData as Prisma.InputJsonValue;
    await db.studentSessionReport.upsert({
      where: {
        sessionId_userId_reportType: {
          sessionId,
          userId,
          reportType: 'student-summary',
        },
      },
      create: {
        sessionId,
        userId,
        lessonKey: studentLessonKey,
        reportType: 'student-summary',
        status: 'READY',
        summary: `${studentLogs.length} 条互动日志，${userFacts.length} 条学习事实。`,
        reportData: reportDataJson,
      },
      update: {
        lessonKey: studentLessonKey,
        status: 'READY',
        summary: `${studentLogs.length} 条互动日志，${userFacts.length} 条学习事实。`,
        reportData: reportDataJson,
      },
    });
  }

  return { classReports: 1, studentReports: sessionParticipantUserIds.length, skipped: false };
}
