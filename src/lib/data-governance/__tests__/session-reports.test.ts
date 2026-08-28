import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildSyncErrorIncidentSummary, generateSessionSummaryReports } from '../session-reports';

describe('generateSessionSummaryReports', () => {
  const prisma = {
    classSession: { findUnique: vi.fn() },
    studentState: { findMany: vi.fn() },
    interactionLog: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
    studentStepResponse: { findMany: vi.fn(), count: vi.fn().mockResolvedValue(0) },
    studentCompetencySnapshot: { findMany: vi.fn() },
    classSessionReport: { upsert: vi.fn() },
    studentSessionReport: { upsert: vi.fn() },
    user: { findMany: vi.fn() },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findMany.mockImplementation(async (args: { where?: { id?: { in?: string[] } } }) => (
      args.where?.id?.in ?? []
    ).map((id) => ({
      id,
      role: id.startsWith('teacher') ? 'TEACHER' : 'STUDENT',
    })));
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
        startedAt: new Date('2026-05-09T01:20:00.000Z'),
      },
      {
        userId: 'student-2',
        factType: 'interactive',
        outcome: 'partial',
        lessonId: '4-3',
        startedAt: new Date('2026-05-09T01:25:00.000Z'),
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
        summary: '3 名学生产生 4 条互动日志，沉淀 2 条学习事实。',
      }),
    }));
    expect(prisma.classSessionReport.upsert.mock.calls[0][0].create.reportData).toMatchObject({
      participants: 3,
      // 闭包统计排除晚到（afterSessionEnd）事件：5 条日志中 1 条晚到不计入
      interactionLogs: 4,
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
      evidenceQualityReasonCounts: {
        scoreable_objective_evidence: 1,
        subjective_or_answer_evidence_without_score: 1,
        unsupported_legacy_envelope: 1,
      },
      scoreableObjectiveSubmissions: 1,
      syncErrorIncidents: 2,
      legacyEventTypes: {
        lesson_submit: 1,
        error: 3,
      },
      canonicalEventTypes: {
        lesson_submit: 1,
        sync_error: 3,
      },
      afterSessionEndEvents: 1,
      learningContexts: {
        classroom_live: 4,
      },
      sessionGovernanceSummary: {
        qualityStatus: {
          status: 'red',
          reasons: [
            'sync_affected_user_ratio_high',
          ],
          metrics: expect.objectContaining({
            participants: 3,
            durableSubmissionCoverage: 2 / 3,
            richOrPartialEvidenceRatio: 2 / 3,
            legacyOrMissingRatio: 1 / 3,
            reportFresh: true,
            snapshotFresh: true,
            snapshotCoverageFresh: true,
            postClassUpdateWindowFresh: false,
            syncSeverity: 'medium',
            syncAffectedUserRatio: 2 / 3,
          }),
        },
        sessionParticipants: 3,
        loggedParticipants: 2,
        factParticipants: 2,
        submittedParticipants: 1,
        durableSubmittedParticipants: 2,
        durableSubmissionAttempts: 3,
        evidenceRichSubmissions: 1,
        partialEvidenceSubmissions: 1,
        legacyEvidenceSubmissions: 1,
        missingEvidenceSubmissions: 0,
        scoreableObjectiveSubmissions: 1,
        snapshotUpdatedParticipants: 1,
        snapshotCoveredParticipants: 2,
        snapshotCoverageExpectedParticipants: 2,
        postClassUpdatedParticipants: 1,
        postClassUpdateWindowExpectedParticipants: 3,
        syncErrorUsers: 2,
        rawSyncErrors: 3,
        syncErrorIncidents: 2,
        snapshotUpdateWindow: {
          startTime: '2026-05-09T02:04:23.000Z',
          endTime: '2026-05-09T04:04:23.000Z',
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
        denominatorCount: 2,
        coveredCount: 2,
        updatedCount: 2,
      },
      postClassUpdateWindowPolicy: {
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
          gte: new Date('2026-05-09T00:22:59.000Z'),
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

  it('excludes teacher logs from participant and sync coverage for quality status', async () => {
    prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-teacher-log',
      classId: 'class-1',
      status: 'FINISHED',
      startTime: new Date('2026-05-20T08:00:00.000Z'),
      endTime: new Date('2026-05-20T09:30:00.000Z'),
      plan: { title: '5-2：非线性系统的最小分析入口' },
    });
    prisma.interactionLog.findMany.mockResolvedValue([
      {
        userId: 'teacher-1',
        eventType: 'error',
        stepId: 'step-01',
        clientEventAt: new Date('2026-05-20T08:05:00.000Z'),
        lessonKey: '5-2',
        learningContext: 'teacher_live',
        invalidContextReason: null,
        actorRole: null,
        eventData: {
          eventType: 'sync_error',
          source: 'teacher_state_get',
          failureKind: 'network',
          message: 'teacher poll failed',
        },
      },
      {
        userId: 'teacher-1',
        eventType: 'lesson_submit',
        stepId: 'step-02',
        clientEventAt: new Date('2026-05-20T08:06:00.000Z'),
        lessonKey: '5-2',
        learningContext: 'teacher_live',
        invalidContextReason: null,
        actorRole: null,
        eventData: {
          eventType: 'lesson_submit',
        },
      },
    ]);
    prisma.studentState.findMany.mockResolvedValue([
      { userId: 'student-1', lessonKey: '5-2' },
    ]);
    prisma.learningFact.findMany.mockResolvedValue([
      {
        userId: 'teacher-1',
        factType: 'interactive',
        outcome: 'partial',
        lessonId: '5-2',
      },
    ]);
    prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        stepId: 'step-02',
        submittedAt: new Date('2026-05-20T08:20:00.000Z'),
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
        userId: 'teacher-1',
        stepId: 'step-02',
        submittedAt: new Date('2026-05-20T08:21:00.000Z'),
        responseData: { evidenceQuality: 'legacy-envelope' },
      },
    ]);
    prisma.studentCompetencySnapshot.findMany.mockResolvedValue([
      { userId: 'student-1', snapshotAt: new Date('2026-05-20T09:45:00.000Z') },
    ]);
    prisma.classSessionReport.upsert.mockResolvedValue({});
    prisma.studentSessionReport.upsert.mockResolvedValue({});

    await generateSessionSummaryReports(prisma as never, 'session-teacher-log');

    const reportData = prisma.classSessionReport.upsert.mock.calls[0][0].create.reportData;
    expect(reportData).toMatchObject({
      participants: 1,
      sessionGovernanceSummary: {
        sessionParticipants: 1,
        loggedParticipants: 0,
        qualityStatus: {
          status: 'green',
          metrics: expect.objectContaining({
            durableSubmissionCoverage: 1,
            richOrPartialEvidenceRatio: 1,
            legacyOrMissingRatio: 0,
            syncSeverity: 'none',
            syncAffectedUsers: 0,
            syncAffectedUserRatio: 0,
          }),
        },
        syncErrorIncidents: 1,
        syncAffectedUsers: 1,
        factParticipants: 0,
        submittedParticipants: 0,
        durableSubmittedParticipants: 1,
        durableSubmissionAttempts: 1,
      },
    });
    expect(prisma.studentSessionReport.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.studentSessionReport.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId_userId_reportType: {
          sessionId: 'session-teacher-log',
          userId: 'student-1',
          reportType: 'student-summary',
        },
      },
    }));
  });

  it('reports snapshot coverage separately from post-class update-window coverage', async () => {
    prisma.classSession.findUnique.mockResolvedValue({
      id: 'session-5-3-window-partial',
      classId: 'class-1',
      status: 'FINISHED',
      startTime: new Date('2026-05-20T08:00:00.000Z'),
      endTime: new Date('2026-05-20T09:30:00.000Z'),
      plan: { title: '5-3：从单回路控制到复杂自主系统链路' },
    });
    prisma.interactionLog.findMany.mockResolvedValue([]);
    prisma.studentState.findMany.mockResolvedValue([
      { userId: 'student-1', lessonKey: '5-3' },
      { userId: 'student-2', lessonKey: '5-3' },
    ]);
    prisma.learningFact.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        factType: 'interactive',
        outcome: 'success',
        lessonId: '5-3',
        startedAt: new Date('2026-05-20T09:10:00.000Z'),
      },
      {
        userId: 'student-2',
        factType: 'interactive',
        outcome: 'success',
        lessonId: '5-3',
        startedAt: new Date('2026-05-20T09:12:00.000Z'),
      },
    ]);
    prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        stepId: 'step-10',
        submittedAt: new Date('2026-05-20T09:10:00.000Z'),
        responseData: {
          schemaVersion: 'manifest-submission-v2',
          answers: { q1: 'A' },
          questionSummaries: [
            { questionId: 'q1', studentAnswer: 'A', referenceValue: 'A', isCorrect: true },
          ],
        },
      },
      {
        userId: 'student-2',
        stepId: 'step-10',
        submittedAt: new Date('2026-05-20T09:12:00.000Z'),
        responseData: {
          schemaVersion: 'manifest-submission-v2',
          answers: { q1: 'B' },
          questionSummaries: [
            { questionId: 'q1', studentAnswer: 'B', referenceValue: 'B', isCorrect: true },
          ],
        },
      },
    ]);
    prisma.studentCompetencySnapshot.findMany.mockResolvedValue([
      { userId: 'student-1', snapshotAt: new Date('2026-05-20T09:20:00.000Z') },
      { userId: 'student-2', snapshotAt: new Date('2026-05-20T09:45:00.000Z') },
    ]);
    prisma.classSessionReport.upsert.mockResolvedValue({});
    prisma.studentSessionReport.upsert.mockResolvedValue({});

    await generateSessionSummaryReports(prisma as never, 'session-5-3-window-partial');

    expect(prisma.studentCompetencySnapshot.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: ['student-1', 'student-2'] },
        snapshotAt: {
          gte: new Date('2026-05-20T08:00:00.000Z'),
          lte: new Date('2026-05-20T11:30:00.000Z'),
        },
      },
      select: {
        userId: true,
        snapshotAt: true,
      },
    });
    const reportData = prisma.classSessionReport.upsert.mock.calls[0][0].create.reportData;
    expect(reportData.sessionGovernanceSummary).toMatchObject({
      snapshotCoveredParticipants: 2,
      snapshotCoverageExpectedParticipants: 2,
      postClassUpdatedParticipants: 1,
      postClassUpdateWindowExpectedParticipants: 2,
      snapshotUpdatedParticipants: 1,
      qualityStatus: {
        status: 'yellow',
        reasons: ['post_class_update_window_partial'],
        metrics: expect.objectContaining({
          snapshotFresh: true,
          snapshotCoverageFresh: true,
          postClassUpdateWindowFresh: false,
        }),
      },
    });
    expect(reportData.sessionGovernanceSummary.qualityStatus.reasons)
      .not.toContain('snapshot_partially_missing');
  });
});

describe('buildSyncErrorIncidentSummary', () => {
  it('deduplicates bursts, keeps raw counts, and classifies recovered transient noise', () => {
    const incidentKey = [
      'student-1',
      'student-page',
      'step-03',
      'session_progress_get',
      '/api/session/session-001',
      'GET',
      'aborted',
      'none',
    ].join('\u0000');
    const logs = [
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:00:00.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'aborted',
          errorName: 'AbortError',
          documentVisibilityState: 'hidden',
          incidentKey: 'unknown\u0000unknown\u0000step-03\u0000session_progress_get\u0000/api/session/session-001\u0000GET\u0000aborted\u0000none',
          incidentSeverity: 'low',
        },
      },
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:00:10.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'aborted',
          errorName: 'AbortError',
          documentVisibilityState: 'hidden',
          incidentKey: 'unknown\u0000unknown\u0000step-03\u0000session_progress_get\u0000/api/session/session-001\u0000GET\u0000aborted\u0000none',
          incidentSeverity: 'low',
        },
      },
      {
        userId: 'student-1',
        eventType: 'interact',
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:00:20.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_recovered',
          incidentKey,
          scope: 'student-page',
          source: 'session_progress_get',
          failureKind: 'aborted',
          url: '/api/session/session-001',
          method: 'GET',
          recoveredIncidentCount: 1,
          recoveredFailureCount: 2,
        },
      },
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:01:00.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'aborted',
          errorName: 'AbortError',
          documentVisibilityState: 'hidden',
          incidentKey,
          incidentSeverity: 'low',
        },
      },
      {
        userId: 'student-2',
        eventType: 'error',
        stepId: 'step-04',
        clientEventAt: new Date('2026-05-09T01:03:00.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'teacher-page',
          source: 'teacher_state_get',
          url: '/api/session/session-001/state?scope=teacher-view',
          method: 'GET',
          failureKind: 'http',
          status: 503,
          statusText: 'Service Unavailable',
          incidentSeverity: 'high',
        },
      },
    ];

    expect(buildSyncErrorIncidentSummary(logs)).toMatchObject({
      rawErrorCount: 4,
      rawRecoveryCount: 1,
      incidentCount: 3,
      affectedUsers: 2,
      affectedUserIds: ['student-1', 'student-2'],
      dominantSource: 'session_progress_get',
      dominantFailureKind: 'aborted',
      severityDistribution: {
        low: 2,
        medium: 0,
        high: 1,
      },
      recoveredIncidentCount: 1,
      unresolvedIncidentCount: 2,
      transientClientNoiseCount: 2,
      broadServiceIncidentCount: 0,
      concentratedUserIncidentCount: 3,
    });
  });

  it('can match recovered incidents when the sync error timestamp is missing', () => {
    const incidentKey = [
      'student-1',
      'student-page',
      'step-03',
      'session_progress_get',
      '/api/session/session-001',
      'GET',
      'network',
      'none',
    ].join('\u0000');
    const logs = [
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-03',
        clientEventAt: null,
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'network',
          incidentSeverity: 'medium',
        },
      },
      {
        userId: 'student-1',
        eventType: 'interact',
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:00:20.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_recovered',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'network',
          incidentKey,
          recoveredIncidentCount: 1,
        },
      },
    ];

    expect(buildSyncErrorIncidentSummary(logs)).toMatchObject({
      rawErrorCount: 1,
      rawRecoveryCount: 1,
      incidentCount: 1,
      recoveredIncidentCount: 1,
      unresolvedIncidentCount: 0,
    });
  });

  it('keeps adjacent sync errors in one burst by advancing the burst anchor', () => {
    const logs = [0, 25, 50].map((offsetSeconds) => ({
      userId: 'student-1',
      eventType: 'error',
      stepId: 'step-03',
      clientEventAt: new Date(Date.UTC(2026, 4, 9, 1, 0, offsetSeconds)),
      lessonKey: '5-1',
      learningContext: 'classroom_live',
      invalidContextReason: null,
      eventData: {
        eventType: 'sync_error',
        scope: 'student-page',
        source: 'session_progress_get',
        url: '/api/session/session-001',
        method: 'GET',
        failureKind: 'network',
        incidentSeverity: 'medium',
      },
    }));

    expect(buildSyncErrorIncidentSummary(logs)).toMatchObject({
      rawErrorCount: 3,
      incidentCount: 1,
      recoveredIncidentCount: 0,
      unresolvedIncidentCount: 1,
    });
  });

  it('matches null-timestamp recoveries one-to-one', () => {
    const incidentKey = [
      'student-1',
      'student-page',
      'step-03',
      'session_progress_get',
      '/api/session/session-001',
      'GET',
      'network',
      'none',
    ].join('\u0000');
    const logs = [
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-03',
        clientEventAt: null,
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'network',
          incidentSeverity: 'medium',
        },
      },
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-03',
        clientEventAt: null,
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'network',
          incidentSeverity: 'medium',
        },
      },
      {
        userId: 'student-1',
        eventType: 'interact',
        stepId: 'step-03',
        clientEventAt: new Date('2026-05-09T01:00:20.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_recovered',
          scope: 'student-page',
          source: 'session_progress_get',
          url: '/api/session/session-001',
          method: 'GET',
          failureKind: 'network',
          incidentKey,
          recoveredIncidentCount: 1,
        },
      },
    ];

    expect(buildSyncErrorIncidentSummary(logs)).toMatchObject({
      rawErrorCount: 2,
      rawRecoveryCount: 1,
      incidentCount: 2,
      recoveredIncidentCount: 1,
      unresolvedIncidentCount: 1,
    });
  });

  it('uses the original recovery incident status when top-level recovery status is missing', () => {
    const incidentKey = [
      'student-1',
      'teacher-page',
      'step-04',
      'teacher_state_get',
      '/api/session/session-001/state?scope=teacher-view',
      'GET',
      'http',
      '503',
    ].join('\u0000');
    const logs = [
      {
        userId: 'student-1',
        eventType: 'error',
        stepId: 'step-04',
        clientEventAt: new Date('2026-05-09T01:00:00.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_error',
          scope: 'teacher-page',
          source: 'teacher_state_get',
          url: '/api/session/session-001/state?scope=teacher-view',
          method: 'GET',
          failureKind: 'http',
          status: 503,
          incidentSeverity: 'high',
        },
      },
      {
        userId: 'student-1',
        eventType: 'interact',
        stepId: 'step-04',
        clientEventAt: new Date('2026-05-09T01:00:15.000Z'),
        lessonKey: '5-1',
        learningContext: 'classroom_live',
        invalidContextReason: null,
        eventData: {
          eventType: 'sync_recovered',
          scope: 'teacher-page',
          source: 'teacher_state_get',
          url: '/api/session/session-001/state?scope=teacher-view',
          method: 'GET',
          failureKind: 'http',
          incidentKey,
          recoveredIncidentCount: 1,
        },
      },
    ];

    expect(buildSyncErrorIncidentSummary(logs)).toMatchObject({
      rawErrorCount: 1,
      rawRecoveryCount: 1,
      incidentCount: 1,
      recoveredIncidentCount: 1,
      unresolvedIncidentCount: 0,
    });
  });
});
