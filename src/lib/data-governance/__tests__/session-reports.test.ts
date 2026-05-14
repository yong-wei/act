import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateSessionSummaryReports } from '../session-reports';

describe('generateSessionSummaryReports', () => {
  const prisma = {
    classSession: { findUnique: vi.fn() },
    studentState: { findMany: vi.fn() },
    interactionLog: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
    studentCompetencySnapshot: { findMany: vi.fn() },
    classSessionReport: { upsert: vi.fn() },
    studentSessionReport: { upsert: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates deterministic class and student reports for a finished session', async () => {
    prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-4-3',
      classId: 'class-1',
      status: 'FINISHED',
      startTime: new Date('2026-05-09T00:22:59.000Z'),
      endTime: new Date('2026-05-09T02:04:23.000Z'),
      plan: { title: '4-3：经典复合控制的初始方案落地' },
    });
    prisma.interactionLog.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        eventType: 'lesson_submit',
        lessonKey: '4-3',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {},
      },
      {
        userId: 'student-1',
        eventType: 'error',
        lessonKey: '4-3',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: { eventType: 'sync_error' },
      },
      {
        userId: 'student-2',
        eventType: 'view',
        lessonKey: '4-3',
        learningContext: 'classroom_review',
        invalidContextReason: null,
        eventData: { afterSessionEnd: true },
      },
      {
        userId: 'student-2',
        eventType: 'error',
        lessonKey: '4-3',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {},
      },
    ]);
    prisma.studentState.findMany.mockResolvedValue([
      { userId: 'student-1', lessonKey: '4-3' },
      { userId: 'student-2', lessonKey: '4-3' },
      { userId: 'student-3', lessonKey: '4-3' },
    ]);
    prisma.learningFact.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        factType: 'interactive',
        outcome: 'success',
        lessonId: '4-3',
      },
      {
        userId: 'student-2',
        factType: 'interactive',
        outcome: 'partial',
        lessonId: '4-3',
      },
    ]);
    prisma.studentCompetencySnapshot.findMany.mockResolvedValue([
      { userId: 'student-1', snapshotAt: new Date('2026-05-09T02:30:00.000Z') },
      { userId: 'student-2', snapshotAt: new Date('2026-05-09T01:30:00.000Z') },
      { userId: 'student-3', snapshotAt: new Date('2026-05-10T02:30:00.000Z') },
    ]);
    prisma.classSessionReport.upsert.mockResolvedValue({});
    prisma.studentSessionReport.upsert.mockResolvedValue({});

    const result = await generateSessionSummaryReports(prisma as never, 'session-4-3');

    expect(result).toEqual({ classReports: 1, studentReports: 3, skipped: false });
    expect(prisma.classSessionReport.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_reportType: {
          sessionId: 'session-4-3',
          reportType: 'class-summary',
        },
      },
      create: expect.objectContaining({
        sessionId: 'session-4-3',
        lessonKey: '4-3',
        status: 'READY',
        summary: '3 名学生产生 4 条互动日志，沉淀 2 条学习事实。',
      }),
    }));
    expect(prisma.classSessionReport.upsert.mock.calls[0][0].create.reportData).toMatchObject({
      participants: 3,
      interactionLogs: 4,
      learningFacts: 2,
      syncErrors: 2,
      legacyEventTypes: {
        lesson_submit: 1,
        error: 2,
        view: 1,
      },
      canonicalEventTypes: {
        lesson_submit: 1,
        sync_error: 2,
        page_view: 1,
      },
      afterSessionEndEvents: 1,
      learningContexts: {
        classroom_live: 3,
        classroom_review: 1,
      },
      sessionGovernanceSummary: {
        sessionParticipants: 3,
        loggedParticipants: 2,
        factParticipants: 2,
        submittedParticipants: 1,
        snapshotUpdatedParticipants: 1,
        syncErrorUsers: 2,
        snapshotUpdateWindow: {
          startTime: '2026-05-09T02:04:23.000Z',
          endTime: '2026-05-09T04:04:23.000Z',
        },
      },
      participationSemantics: {
        participants: 'distinct users from StudentState, InteractionLog, and LearningFact for this session',
        activeStudentCount: 'class-level long-term snapshot count, not a classroom participation metric',
      },
    });
    expect(prisma.studentCompetencySnapshot.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: ['student-1', 'student-2', 'student-3'] },
        snapshotAt: {
          gte: new Date('2026-05-09T02:04:23.000Z'),
          lte: new Date('2026-05-09T04:04:23.000Z'),
        },
      },
      select: {
        userId: true,
        snapshotAt: true,
      },
    });
    expect(prisma.studentSessionReport.upsert).toHaveBeenCalledTimes(3);
    expect(prisma.studentSessionReport.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_userId_reportType: {
          sessionId: 'session-4-3',
          userId: 'student-3',
          reportType: 'student-summary',
        },
      },
      create: expect.objectContaining({
        lessonKey: '4-3',
        summary: '0 条互动日志，0 条学习事实。',
        reportData: expect.objectContaining({
          userId: 'student-3',
          interactionLogs: 0,
          learningFacts: 0,
          syncErrors: 0,
        }),
      }),
    }));
  });
});
