import { beforeEach, describe, expect, it, vi } from 'vitest';

import { generateSessionSummaryReports } from '../session-reports';

describe('generateSessionSummaryReports', () => {
  const prisma = {
    classSession: { findUnique: vi.fn() },
    studentState: { findMany: vi.fn() },
    interactionLog: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
    studentStepResponse: { findMany: vi.fn() },
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
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:00:00.000Z'),
        lessonKey: '4-3',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: { eventType: 'sync_error', message: 'poll failed' },
      },
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:00:10.000Z'),
        lessonKey: '4-3',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: { eventType: 'sync_error', message: 'poll failed' },
      },
      {
        userId: 'student-2',
        eventType: 'view',
        stepId: 'step-04',
        clientEventAt: new Date('2026-05-09T01:01:00.000Z'),
        lessonKey: '4-3',
        learningContext: 'classroom_review',
        invalidContextReason: null,
        eventData: { afterSessionEnd: true },
      },
      {
        userId: 'student-2',
        eventType: 'error',
        stepId: 'step-04',
        clientEventAt: new Date('2026-05-09T01:02:00.000Z'),
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
    prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        stepId: 'step-02',
        submittedAt: new Date('2026-05-09T00:35:00.000Z'),
        responseData: {
          schemaVersion: 'manifest-submission-v2',
          evidenceQuality: 'rich',
          answers: { q1: 'A' },
          questionSummaries: [
            { questionId: 'q1', studentAnswer: 'A', referenceValue: 'A', isCorrect: true },
          ],
        },
      },
      {
        userId: 'student-1',
        stepId: 'step-02',
        submittedAt: new Date('2026-05-09T00:36:00.000Z'),
        responseData: {
          schemaVersion: 'manifest-submission-v2',
          evidenceQuality: 'partial',
          answers: { q1: 'B' },
        },
      },
      {
        userId: 'student-2',
        stepId: 'step-05',
        submittedAt: new Date('2026-05-09T00:37:00.000Z'),
        responseData: {
          evidenceQuality: 'legacy-envelope',
          stepId: 'step-05',
        },
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
        summary: '3 名学生产生 5 条互动日志，沉淀 2 条学习事实。',
      }),
    }));
    expect(prisma.classSessionReport.upsert.mock.calls[0][0].create.reportData).toMatchObject({
      participants: 3,
      interactionLogs: 5,
      learningFacts: 2,
      syncErrors: 3,
      durableSubmissions: 3,
      submittedParticipantsFromDurableResponses: 2,
      evidenceQualityCounts: {
        rich: 1,
        partial: 1,
        legacy: 1,
        missing: 0,
      },
      scoreableObjectiveSubmissions: 1,
      syncErrorIncidents: 2,
      legacyEventTypes: {
        lesson_submit: 1,
        error: 3,
        view: 1,
      },
      canonicalEventTypes: {
        lesson_submit: 1,
        sync_error: 3,
        page_view: 1,
      },
      afterSessionEndEvents: 1,
      learningContexts: {
        classroom_live: 4,
        classroom_review: 1,
      },
      sessionGovernanceSummary: {
        sessionParticipants: 3,
        loggedParticipants: 2,
        factParticipants: 2,
        submittedParticipants: 1,
        durableSubmittedParticipants: 2,
        durableSubmissionAttempts: 3,
        evidenceRichSubmissions: 1,
        partialEvidenceSubmissions: 1,
        legacyEvidenceSubmissions: 1,
        scoreableObjectiveSubmissions: 1,
        snapshotUpdatedParticipants: 1,
        syncErrorUsers: 2,
        rawSyncErrors: 3,
        syncErrorIncidents: 2,
        snapshotUpdateWindow: {
          startTime: '2026-05-09T02:04:23.000Z',
          endTime: '2026-05-09T04:04:23.000Z',
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
        denominatorCount: 3,
        updatedCount: 1,
      },
      participationSemantics: {
        participants: 'distinct users from StudentState, InteractionLog, LearningFact, and StudentStepResponse for this session',
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
          durableSubmissions: 0,
          evidenceQualityCounts: {
            rich: 0,
            partial: 0,
            legacy: 0,
            missing: 0,
          },
        }),
      }),
    }));
  });
});
