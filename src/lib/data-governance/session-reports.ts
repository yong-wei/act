import type { PrismaClient } from '@prisma/client';
import { resolveCanonicalEventType } from './event-normalization';

type ReportPrisma = Pick<PrismaClient,
  | 'classSession'
  | 'studentState'
  | 'interactionLog'
  | 'learningFact'
  | 'studentStepResponse'
  | 'studentCompetencySnapshot'
  | 'classSessionReport'
  | 'studentSessionReport'
>;

interface InteractionLogSummaryItem {
  userId: string;
  eventType: string;
  stepId: string | null;
  clientEventAt: Date | null;
  lessonKey: string | null;
  learningContext?: string | null;
  invalidContextReason?: string | null;
  eventData: unknown;
}

interface LearningFactSummaryItem {
  userId: string;
  factType: string;
  outcome: string;
  lessonId: string | null;
}

interface StudentStateSummaryItem {
  userId: string;
  lessonKey: string | null;
}

interface StudentStepResponseSummaryItem {
  userId: string;
  stepId: string;
  submittedAt: Date;
  responseData: unknown;
}

interface StudentSnapshotSummaryItem {
  userId: string;
  snapshotAt: Date;
}

const SESSION_SNAPSHOT_UPDATE_WINDOW_MS = 2 * 60 * 60 * 1000;
const SYNC_ERROR_BURST_WINDOW_MS = 30 * 1000;

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

function firstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
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
  };
}

function resolveSyncErrorSignature(log: InteractionLogSummaryItem): string {
  const data = readObject(log.eventData);
  return firstNonEmpty([
    typeof data.message === 'string' ? data.message : null,
    typeof data.error === 'string' ? data.error : null,
    typeof data.reason === 'string' ? data.reason : null,
    typeof data.scope === 'string' ? data.scope : null,
    log.eventType,
  ]) ?? 'sync_error';
}

function buildSyncErrorIncidentCount(logs: InteractionLogSummaryItem[]): number {
  const sorted = logs
    .filter((log) => resolveReportEventType(log) === 'sync_error')
    .map((log, index) => ({
      log,
      index,
      time: log.clientEventAt instanceof Date ? log.clientEventAt.getTime() : null,
      key: [
        log.userId,
        log.stepId ?? 'unknown_step',
        resolveSyncErrorSignature(log),
      ].join('\u0000'),
    }))
    .sort((a, b) => {
      if (a.key !== b.key) return a.key.localeCompare(b.key);
      if (a.time !== null && b.time !== null && a.time !== b.time) return a.time - b.time;
      return a.index - b.index;
    });

  const lastIncidentAtByKey = new Map<string, number>();
  let incidents = 0;

  for (const item of sorted) {
    if (item.time === null) {
      incidents += 1;
      continue;
    }
    const lastIncidentAt = lastIncidentAtByKey.get(item.key);
    if (lastIncidentAt === undefined || item.time - lastIncidentAt > SYNC_ERROR_BURST_WINDOW_MS) {
      incidents += 1;
      lastIncidentAtByKey.set(item.key, item.time);
    }
  }

  return incidents;
}

export async function generateSessionSummaryReports(
  db: ReportPrisma,
  sessionId: string,
): Promise<{ classReports: number; studentReports: number; skipped: boolean }> {
  const session = await db.classSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      classId: true,
      status: true,
      startTime: true,
      endTime: true,
      plan: {
        select: { title: true },
      },
    },
  });

  if (!session) {
    return { classReports: 0, studentReports: 0, skipped: true };
  }

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
      },
    }) as Promise<LearningFactSummaryItem[]>,
    db.studentStepResponse.findMany({
      where: { sessionId },
      select: {
        userId: true,
        stepId: true,
        submittedAt: true,
        responseData: true,
      },
    }) as Promise<StudentStepResponseSummaryItem[]>,
  ]);

  const loggedUserIds = new Set(logs.map((log) => log.userId));
  const factUserIds = new Set(facts.map((fact) => fact.userId));
  const durableSubmittedUserIds = new Set(submissions.map((submission) => submission.userId));
  const sessionParticipantUserIds = Array.from(new Set([
    ...studentStates.map((state) => state.userId),
    ...logs.map((log) => log.userId),
    ...facts.map((fact) => fact.userId),
    ...submissions.map((submission) => submission.userId),
  ])).sort();
  const lessonKey = firstNonEmpty([
    logs.find((log) => log.lessonKey)?.lessonKey,
    facts.find((fact) => fact.lessonId)?.lessonId,
    studentStates.find((state) => state.lessonKey)?.lessonKey,
  ]);
  const eventTypes: Record<string, number> = {};
  const canonicalEventTypes: Record<string, number> = {};
  const learningContexts: Record<string, number> = {};
  const invalidContextReasons: Record<string, number> = {};
  const submittedUserIds = new Set<string>();
  const syncErrorUserIds = new Set<string>();
  let afterSessionEndEvents = 0;

  for (const log of logs) {
    const canonicalEventType = resolveReportEventType(log);
    increment(eventTypes, log.eventType);
    increment(canonicalEventTypes, canonicalEventType);
    increment(learningContexts, log.learningContext);
    increment(invalidContextReasons, log.invalidContextReason);
    if (canonicalEventType === 'lesson_submit' || canonicalEventType === 'lesson_resubmit') {
      submittedUserIds.add(log.userId);
    }
    if (canonicalEventType === 'sync_error') {
      syncErrorUserIds.add(log.userId);
    }
    if (readObject(log.eventData).afterSessionEnd === true) {
      afterSessionEndEvents += 1;
    }
  }

  const syncErrorIncidents = buildSyncErrorIncidentCount(logs);

  const snapshotWindowStart = session.endTime ?? session.startTime;
  const snapshotWindowEnd = new Date(snapshotWindowStart.getTime() + SESSION_SNAPSHOT_UPDATE_WINDOW_MS);
  const snapshots = sessionParticipantUserIds.length > 0
    ? await db.studentCompetencySnapshot.findMany({
      where: {
        userId: { in: sessionParticipantUserIds },
        snapshotAt: {
          gte: snapshotWindowStart,
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

  const classReportData = {
    sessionId,
    classId: session.classId,
    status: session.status,
    planTitle: session.plan.title,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime?.toISOString() ?? null,
    participants: sessionParticipantUserIds.length,
    interactionLogs: logs.length,
    learningFacts: facts.length,
    durableSubmissions: submissions.length,
    submittedParticipantsFromDurableResponses: durableSubmittedUserIds.size,
    eventTypes,
    legacyEventTypes: eventTypes,
    canonicalEventTypes,
    learningContexts,
    invalidContextReasons,
    syncErrors: canonicalEventTypes.sync_error ?? 0,
    syncErrorIncidents,
    afterSessionEndEvents,
    sessionGovernanceSummary: {
      sessionParticipants: sessionParticipantUserIds.length,
      loggedParticipants: loggedUserIds.size,
      factParticipants: factUserIds.size,
      submittedParticipants: submittedUserIds.size,
      durableSubmittedParticipants: durableSubmittedUserIds.size,
      durableSubmissionAttempts: submissions.length,
      snapshotUpdatedParticipants: snapshotUpdatedUserIds.size,
      syncErrorUsers: syncErrorUserIds.size,
      rawSyncErrors: canonicalEventTypes.sync_error ?? 0,
      syncErrorIncidents,
      snapshotUpdateWindow: {
        startTime: snapshotWindowStart.toISOString(),
        endTime: snapshotWindowEnd.toISOString(),
      },
    },
    evidenceSources: {
      interactionLogs: 'InteractionLog rows for this session',
      durableSubmissions: 'StudentStepResponse rows for this session',
      learningFacts: 'LearningFact rows for this session',
      stateParticipants: 'StudentState rows for this session, excluding teacher state',
      snapshotUpdatedParticipants: 'StudentCompetencySnapshot rows in the report snapshot update window',
      syncErrorIncidents: 'sync_error InteractionLog rows grouped by user, step, signature, and 30 second burst window',
    },
    snapshotCoveragePolicy: {
      denominator: 'sessionParticipants',
      denominatorCount: sessionParticipantUserIds.length,
      updatedCount: snapshotUpdatedUserIds.size,
      windowStartTime: snapshotWindowStart.toISOString(),
      windowEndTime: snapshotWindowEnd.toISOString(),
    },
    participationSemantics: {
      participants: 'distinct users from StudentState, InteractionLog, and LearningFact for this session',
      activeStudentCount: 'class-level long-term snapshot count, not a classroom participation metric',
    },
  };
  const summary = `${sessionParticipantUserIds.length} 名学生产生 ${logs.length} 条互动日志，沉淀 ${facts.length} 条学习事实。`;

  await db.classSessionReport.upsert({
    where: {
      sessionId_reportType: {
        sessionId,
        reportType: 'class-summary',
      },
    },
    create: {
      sessionId,
      lessonKey,
      reportType: 'class-summary',
      status: 'READY',
      summary,
      reportData: classReportData,
    },
    update: {
      lessonKey,
      status: 'READY',
      summary,
      reportData: classReportData,
    },
  });

  for (const userId of sessionParticipantUserIds) {
    const studentLogs = logs.filter((log) => log.userId === userId);
    const studentFacts = facts.filter((fact) => fact.userId === userId);
    const studentSubmissions = submissions.filter((submission) => submission.userId === userId);
    const studentLessonKey = firstNonEmpty([
      studentLogs.find((log) => log.lessonKey)?.lessonKey,
      studentFacts.find((fact) => fact.lessonId)?.lessonId,
      studentStates.find((state) => state.userId === userId)?.lessonKey,
      lessonKey,
    ]);
    const reportData = buildStudentReportData(userId, studentLogs, studentFacts, studentSubmissions);
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
        summary: `${studentLogs.length} 条互动日志，${studentFacts.length} 条学习事实。`,
        reportData,
      },
      update: {
        lessonKey: studentLessonKey,
        status: 'READY',
        summary: `${studentLogs.length} 条互动日志，${studentFacts.length} 条学习事实。`,
        reportData,
      },
    });
  }

  return { classReports: 1, studentReports: sessionParticipantUserIds.length, skipped: false };
}
