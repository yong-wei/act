import type { PrismaClient } from '@prisma/client';

type ReportPrisma = Pick<PrismaClient,
  | 'classSession'
  | 'interactionLog'
  | 'learningFact'
  | 'classSessionReport'
  | 'studentSessionReport'
>;

interface InteractionLogSummaryItem {
  userId: string;
  eventType: string;
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

function increment(map: Record<string, number>, key: string | null | undefined) {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
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
) {
  const eventTypes: Record<string, number> = {};
  const learningContexts: Record<string, number> = {};
  const outcomes: Record<string, number> = {};

  for (const log of logs) {
    increment(eventTypes, log.eventType);
    increment(learningContexts, log.learningContext);
  }
  for (const fact of facts) {
    increment(outcomes, fact.outcome);
  }

  return {
    userId,
    interactionLogs: logs.length,
    learningFacts: facts.length,
    eventTypes,
    learningContexts,
    outcomes,
    syncErrors: eventTypes.sync_error ?? 0,
  };
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

  const [logs, facts] = await Promise.all([
    db.interactionLog.findMany({
      where: { sessionId },
      select: {
        userId: true,
        eventType: true,
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
  ]);

  const userIds = Array.from(new Set([
    ...logs.map((log) => log.userId),
    ...facts.map((fact) => fact.userId),
  ])).sort();
  const lessonKey = firstNonEmpty([
    logs.find((log) => log.lessonKey)?.lessonKey,
    facts.find((fact) => fact.lessonId)?.lessonId,
  ]);
  const eventTypes: Record<string, number> = {};
  const learningContexts: Record<string, number> = {};
  const invalidContextReasons: Record<string, number> = {};
  let afterSessionEndEvents = 0;

  for (const log of logs) {
    increment(eventTypes, log.eventType);
    increment(learningContexts, log.learningContext);
    increment(invalidContextReasons, log.invalidContextReason);
    if (readObject(log.eventData).afterSessionEnd === true) {
      afterSessionEndEvents += 1;
    }
  }

  const classReportData = {
    sessionId,
    classId: session.classId,
    status: session.status,
    planTitle: session.plan.title,
    startTime: session.startTime.toISOString(),
    endTime: session.endTime?.toISOString() ?? null,
    participants: userIds.length,
    interactionLogs: logs.length,
    learningFacts: facts.length,
    eventTypes,
    learningContexts,
    invalidContextReasons,
    syncErrors: eventTypes.sync_error ?? 0,
    afterSessionEndEvents,
  };
  const summary = `${userIds.length} 名学生产生 ${logs.length} 条互动日志，沉淀 ${facts.length} 条学习事实。`;

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

  for (const userId of userIds) {
    const studentLogs = logs.filter((log) => log.userId === userId);
    const studentFacts = facts.filter((fact) => fact.userId === userId);
    const reportData = buildStudentReportData(userId, studentLogs, studentFacts);
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
        lessonKey,
        reportType: 'student-summary',
        status: 'READY',
        summary: `${studentLogs.length} 条互动日志，${studentFacts.length} 条学习事实。`,
        reportData,
      },
      update: {
        lessonKey,
        status: 'READY',
        summary: `${studentLogs.length} 条互动日志，${studentFacts.length} 条学习事实。`,
        reportData,
      },
    });
  }

  return { classReports: 1, studentReports: userIds.length, skipped: false };
}
