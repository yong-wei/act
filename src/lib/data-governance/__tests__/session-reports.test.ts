import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateSessionSummaryReports } from '../session-reports';

describe('generateSessionSummaryReports', () => {
  const prisma = {
    classSession: { findUnique: vi.fn() },
    interactionLog: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
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
        eventType: 'sync_error',
        lessonKey: '4-3',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {},
      },
      {
        userId: 'student-2',
        eventType: 'view',
        lessonKey: '4-3',
        learningContext: 'classroom_review',
        invalidContextReason: null,
        eventData: { afterSessionEnd: true },
      },
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
    prisma.classSessionReport.upsert.mockResolvedValue({});
    prisma.studentSessionReport.upsert.mockResolvedValue({});

    const result = await generateSessionSummaryReports(prisma as never, 'session-4-3');

    expect(result).toEqual({ classReports: 1, studentReports: 2, skipped: false });
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
        summary: '2 名学生产生 3 条互动日志，沉淀 2 条学习事实。',
      }),
    }));
    expect(prisma.classSessionReport.upsert.mock.calls[0][0].create.reportData).toMatchObject({
      participants: 2,
      interactionLogs: 3,
      learningFacts: 2,
      syncErrors: 1,
      afterSessionEndEvents: 1,
      learningContexts: {
        classroom_live: 2,
        classroom_review: 1,
      },
    });
    expect(prisma.studentSessionReport.upsert).toHaveBeenCalledTimes(2);
  });
});
