import { describe, expect, it, vi } from 'vitest';

import { buildSessionDataQualityReport, collectSessionDataQualityReport } from '../session-data-quality-report';

describe('buildSessionDataQualityReport', () => {
  it('summarizes evidence richness, report freshness, snapshots, and sync incidents', () => {
    const report = buildSessionDataQualityReport({
      generatedAt: '2026-05-20T15:00:00.000Z',
      filters: { sessionIds: ['session-5-2'] },
      sessions: [{
        id: 'session-5-2',
        classId: 'class-1',
        status: 'FINISHED',
        startTime: new Date('2026-05-20T08:00:00.000Z'),
        endTime: new Date('2026-05-20T09:30:00.000Z'),
        plan: { title: '5-2：非线性系统的最小分析入口' },
      }],
      studentStates: [
        {
          sessionId: 'session-5-2',
          userId: 'student-1',
          stateKey: 'course',
          lessonKey: '5-2',
          submittedAt: new Date('2026-05-20T08:05:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T09:20:00.000Z'),
        },
        {
          sessionId: 'session-5-2',
          userId: 'student-2',
          stateKey: 'course',
          lessonKey: '5-2',
          submittedAt: new Date('2026-05-20T08:06:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T09:21:00.000Z'),
        },
        {
          sessionId: 'session-5-2',
          userId: 'teacher-1',
          stateKey: 'teacher-sync',
          lessonKey: '5-2',
          submittedAt: new Date('2026-05-20T08:07:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T09:22:00.000Z'),
        },
      ],
      interactionLogs: [
        {
          sessionId: 'session-5-2',
          userId: 'student-1',
          eventType: 'lesson_submit',
          stepId: 'step-03',
          lessonKey: '5-2',
          actorRole: 'student',
          clientEventAt: new Date('2026-05-20T08:10:00.000Z'),
          createdAt: new Date('2026-05-20T08:10:01.000Z'),
          eventData: {},
        },
        {
          sessionId: 'session-5-2',
          userId: 'teacher-1',
          eventType: 'view',
          stepId: 'step-03',
          lessonKey: '5-2',
          actorRole: 'teacher',
          clientEventAt: new Date('2026-05-20T08:11:00.000Z'),
          createdAt: new Date('2026-05-20T08:11:01.000Z'),
          eventData: {},
        },
        {
          sessionId: 'session-5-2',
          userId: 'student-1',
          eventType: 'error',
          stepId: 'step-04',
          lessonKey: '5-2',
          actorRole: 'student',
          clientEventAt: new Date('2026-05-20T08:12:00.000Z'),
          createdAt: new Date('2026-05-20T08:12:01.000Z'),
          eventData: { eventType: 'sync_error', source: 'state', failureKind: 'network', message: 'poll failed' },
        },
        {
          sessionId: 'session-5-2',
          userId: 'student-1',
          eventType: 'error',
          stepId: 'step-04',
          lessonKey: '5-2',
          actorRole: 'student',
          clientEventAt: new Date('2026-05-20T08:12:10.000Z'),
          createdAt: new Date('2026-05-20T08:12:11.000Z'),
          eventData: { eventType: 'sync_error', source: 'state', failureKind: 'network', message: 'poll failed' },
        },
      ],
      learningFacts: [
        {
          sessionId: 'session-5-2',
          userId: 'student-1',
          lessonId: '5-2',
          score: 100,
          outcome: 'success',
          startedAt: new Date('2026-05-20T08:10:00.000Z'),
          contextJson: {},
        },
      ],
      studentStepResponses: [
        {
          sessionId: 'session-5-2',
          userId: 'student-1',
          lessonKey: '5-2',
          stepId: 'step-03',
          submittedAt: new Date('2026-05-20T08:10:00.000Z'),
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            evidenceQuality: 'rich',
            answers: { q1: 'A' },
            score: 100,
            questionSummaries: [{ questionId: 'q1', isCorrect: true }],
          },
        },
        {
          sessionId: 'session-5-2',
          userId: 'student-2',
          lessonKey: '5-2',
          stepId: 'step-04',
          submittedAt: new Date('2026-05-20T08:15:00.000Z'),
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            evidenceQuality: 'partial',
            answers: { q2: '观察相轨迹' },
          },
        },
        {
          sessionId: 'session-5-2',
          userId: 'student-2',
          lessonKey: '5-2',
          stepId: 'step-05',
          submittedAt: new Date('2026-05-20T08:18:00.000Z'),
          responseData: { evidenceQuality: 'legacy-envelope' },
        },
      ],
      studentCompetencySnapshots: [
        { userId: 'student-1', snapshotAt: new Date('2026-05-20T09:45:00.000Z') },
      ],
      classSessionReports: [
        {
          sessionId: 'session-5-2',
          lessonKey: '5-2',
          reportType: 'class-summary',
          status: 'READY',
          updatedAt: new Date('2026-05-20T09:40:00.000Z'),
        },
      ],
      studentSessionReports: [
        {
          sessionId: 'session-5-2',
          userId: 'student-1',
          lessonKey: '5-2',
          reportType: 'student-summary',
          status: 'READY',
          updatedAt: new Date('2026-05-20T09:41:00.000Z'),
        },
      ],
    });

    expect(report.totals).toMatchObject({
      sessions: 1,
      participants: 2,
      durableSubmissions: 3,
      answerAvailableRows: 2,
      scoreAvailableRows: 1,
      questionSummaryAvailableRows: 1,
      rawSyncErrors: 2,
      syncIncidents: 1,
    });
    expect(report.sessions[0]).toMatchObject({
      sessionId: 'session-5-2',
      lessonKeys: ['5-2'],
      qualityStatus: {
        status: 'red',
        reasons: [
          'report_missing_or_stale',
          'sync_affected_user_ratio_high',
        ],
        metrics: {
          participants: 2,
          durableSubmissionCoverage: 1,
          richEvidenceRatio: 1 / 3,
          richOrPartialEvidenceRatio: 2 / 3,
          legacyOrMissingRatio: 1 / 3,
          reportFresh: false,
          snapshotFresh: false,
          syncSeverity: 'low',
          unresolvedSyncIncidents: 1,
          syncAffectedUserRatio: 0.5,
        },
      },
      submissionCoverage: {
        totalRows: 3,
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
      },
      reportFreshness: {
        classReportAvailable: true,
        studentReportCount: 1,
        expectedStudentReports: 2,
        classReportFresh: true,
        studentReportsFresh: false,
      },
      snapshotFreshness: {
        updatedParticipants: 1,
        expectedParticipants: 2,
        missingParticipants: 1,
        fresh: false,
      },
      syncQuality: {
        rawSyncErrors: 2,
        incidentCount: 1,
        affectedUsers: 1,
        dominantSource: 'state',
        dominantFailureKind: 'network',
        severityClassification: 'low',
      },
    });
  });

  it('does not broaden a lesson-filtered report when no matching session exists', async () => {
    const db = {
      interactionLog: { findMany: vi.fn().mockResolvedValue([]) },
      studentState: { findMany: vi.fn().mockResolvedValue([]) },
      learningFact: { findMany: vi.fn().mockResolvedValue([]) },
      studentStepResponse: { findMany: vi.fn().mockResolvedValue([]) },
      classSession: { findMany: vi.fn() },
      studentCompetencySnapshot: { findMany: vi.fn() },
      classSessionReport: { findMany: vi.fn() },
      studentSessionReport: { findMany: vi.fn() },
    };

    const report = await collectSessionDataQualityReport(db, { lessonKeys: ['5-99'] });

    expect(report.totals.sessions).toBe(0);
    expect(db.classSession.findMany).not.toHaveBeenCalled();
    expect(db.classSessionReport.findMany).not.toHaveBeenCalled();
    expect(db.studentSessionReport.findMany).not.toHaveBeenCalled();
    expect(db.studentCompetencySnapshot.findMany).not.toHaveBeenCalled();
  });

  it('applies lesson filters to report freshness queries', async () => {
    const db = {
      interactionLog: {
        findMany: vi.fn()
          .mockResolvedValueOnce([{ sessionId: 'session-5-2' }])
          .mockResolvedValueOnce([]),
      },
      studentState: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      learningFact: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      studentStepResponse: {
        findMany: vi.fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
      },
      classSession: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'session-5-2',
          classId: 'class-1',
          status: 'FINISHED',
          startTime: new Date('2026-05-20T08:00:00.000Z'),
          endTime: new Date('2026-05-20T09:30:00.000Z'),
          plan: { title: '5-2' },
        }]),
      },
      studentCompetencySnapshot: { findMany: vi.fn() },
      classSessionReport: { findMany: vi.fn().mockResolvedValue([]) },
      studentSessionReport: { findMany: vi.fn().mockResolvedValue([]) },
    };

    await collectSessionDataQualityReport(db, { lessonKeys: ['5-2'] });

    expect(db.classSessionReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId: { in: ['session-5-2'] },
        lessonKey: { in: ['5-2'] },
      },
    }));
    expect(db.studentSessionReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sessionId: { in: ['session-5-2'] },
        lessonKey: { in: ['5-2'] },
      },
    }));
    expect(db.studentState.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
      where: expect.objectContaining({
        NOT: { stateKey: { startsWith: 'teacher' } },
        lessonKey: { in: ['5-2'] },
      }),
    }));
    expect(db.studentState.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({
        sessionId: { in: ['session-5-2'] },
        NOT: { stateKey: { startsWith: 'teacher' } },
        lessonKey: { in: ['5-2'] },
      }),
    }));
  });

  it('exposes a green quality status for a fully refreshed 5-2 report fixture', () => {
    const report = buildSessionDataQualityReport({
      generatedAt: '2026-05-20T15:00:00.000Z',
      filters: { sessionIds: ['session-green-5-2'] },
      sessions: [{
        id: 'session-green-5-2',
        classId: 'class-1',
        status: 'FINISHED',
        startTime: new Date('2026-05-20T08:00:00.000Z'),
        endTime: new Date('2026-05-20T09:30:00.000Z'),
        plan: { title: '5-2' },
      }],
      studentStates: [
        {
          sessionId: 'session-green-5-2',
          userId: 'student-1',
          stateKey: 'course',
          lessonKey: '5-2',
          submittedAt: new Date('2026-05-20T08:05:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T09:20:00.000Z'),
        },
        {
          sessionId: 'session-green-5-2',
          userId: 'student-2',
          stateKey: 'course',
          lessonKey: '5-2',
          submittedAt: new Date('2026-05-20T08:06:00.000Z'),
          lastClientEventAt: new Date('2026-05-20T09:21:00.000Z'),
        },
      ],
      interactionLogs: [],
      learningFacts: [],
      studentStepResponses: [
        {
          sessionId: 'session-green-5-2',
          userId: 'student-1',
          lessonKey: '5-2',
          stepId: 'step-03',
          submittedAt: new Date('2026-05-20T08:10:00.000Z'),
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            evidenceQuality: 'rich',
            answers: { q1: 'A' },
            questionSummaries: [{ questionId: 'q1', studentAnswer: 'A', referenceValue: 'A', isCorrect: true }],
          },
        },
        {
          sessionId: 'session-green-5-2',
          userId: 'student-2',
          lessonKey: '5-2',
          stepId: 'step-03',
          submittedAt: new Date('2026-05-20T08:11:00.000Z'),
          responseData: {
            schemaVersion: 'manifest-submission-v2',
            evidenceQuality: 'partial',
            answers: { q1: '描述函数适用条件' },
          },
        },
      ],
      studentCompetencySnapshots: [
        { userId: 'student-1', snapshotAt: new Date('2026-05-20T09:40:00.000Z') },
        { userId: 'student-2', snapshotAt: new Date('2026-05-20T09:41:00.000Z') },
      ],
      classSessionReports: [
        {
          sessionId: 'session-green-5-2',
          lessonKey: '5-2',
          reportType: 'class-summary',
          status: 'READY',
          updatedAt: new Date('2026-05-20T09:40:00.000Z'),
        },
      ],
      studentSessionReports: [
        {
          sessionId: 'session-green-5-2',
          userId: 'student-1',
          lessonKey: '5-2',
          reportType: 'student-summary',
          status: 'READY',
          updatedAt: new Date('2026-05-20T09:41:00.000Z'),
        },
        {
          sessionId: 'session-green-5-2',
          userId: 'student-2',
          lessonKey: '5-2',
          reportType: 'student-summary',
          status: 'READY',
          updatedAt: new Date('2026-05-20T09:42:00.000Z'),
        },
      ],
    });

    expect(report.sessions[0].qualityStatus).toMatchObject({
      status: 'green',
      reasons: ['healthy_quality_gate'],
      metrics: {
        participants: 2,
        durableSubmissionCoverage: 1,
        richOrPartialEvidenceRatio: 1,
        legacyOrMissingRatio: 0,
        reportFresh: true,
        snapshotFresh: true,
        syncSeverity: 'none',
      },
    });
  });
});
