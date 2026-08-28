import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    classSession: {
      findMany: vi.fn(),
    },
    interactionLog: {
      findMany: vi.fn(),
      createManyAndReturn: vi.fn(),
    },
    studentStepResponse: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    simulationRun: {
      findFirst: vi.fn(),
    },
    learningFact: {
      createMany: vi.fn(),
    },
  },
  // 分类提交共享写入器在路由测试中打桩；写入器本体由专属单测与真 PG 集成测试覆盖
  submissionEvidenceRuntime: {
    acceptClassifiedSubmission: vi.fn(),
  },
  eventRateLimiter: {
    check: vi.fn(),
  },
  routeEvent: vi.fn(),
  persistCoreLearningFact: vi.fn(),
  generateSessionSummaryReports: vi.fn(),
  enqueueSessionSummaryReportRefresh: vi.fn(),
  resolveTrustedControlWorkbenchContext: vi.fn(),
  persistedControlWorkbenchRunMatchesContext: vi.fn(),
  requestRealtimeSimulationTaskReconciliation: vi.fn(),
}));

vi.mock('next-auth', () => ({
  getServerSession: mocks.getServerSession,
}));

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

vi.mock('@/features/classroom/session/adapters/submission-evidence-commands', () => ({
  createPrismaSubmissionEvidenceRuntime: () => mocks.submissionEvidenceRuntime,
}));

vi.mock('@/lib/rate-limiter', () => ({
  eventRateLimiter: mocks.eventRateLimiter,
}));

vi.mock('@/lib/data-governance/event-buffer', () => ({
  routeEvent: mocks.routeEvent,
}));

vi.mock('@/lib/data-governance/learning-fact-materialization', () => ({
  persistCoreLearningFact: mocks.persistCoreLearningFact,
}));

vi.mock('@/lib/data-governance/session-reports', () => ({
  generateSessionSummaryReports: mocks.generateSessionSummaryReports,
}));

vi.mock('@/lib/data-governance/session-finalization-snapshots', () => ({
  enqueueSessionSummaryReportRefresh: mocks.enqueueSessionSummaryReportRefresh,
}));

vi.mock('@/lib/data-governance/control-workbench-run-context', () => ({
  resolveTrustedControlWorkbenchContext: mocks.resolveTrustedControlWorkbenchContext,
  persistedControlWorkbenchRunMatchesContext: mocks.persistedControlWorkbenchRunMatchesContext,
}));

vi.mock('@/lib/data-governance/simulation-task-reconciliation', () => ({
  requestRealtimeSimulationTaskReconciliation: mocks.requestRealtimeSimulationTaskReconciliation,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { GET, POST } from '../route';

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/interactive/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/interactive/events', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.eventRateLimiter.check.mockReturnValue({ allowed: true });
    mocks.prisma.classSession.findMany.mockResolvedValue([
      {
        id: 'cmoxloe52000uq5bcojma7r78',
        status: 'FINISHED',
        endTime: new Date('2026-05-09T02:04:23.000Z'),
      },
    ]);
    mocks.prisma.interactionLog.findMany.mockResolvedValue([
      { clientEventId: 'client-existing' },
    ]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-review', clientEventId: 'client-review', eventData: { clientEventId: 'client-review' } },
      { id: 'log-invalid', clientEventId: 'client-invalid-session', eventData: { clientEventId: 'client-invalid-session' } },
    ]);
    mocks.prisma.studentStepResponse.createMany.mockResolvedValue({ count: 0 });
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
    mocks.prisma.simulationRun.findFirst.mockResolvedValue(null);
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 1 });
    mocks.requestRealtimeSimulationTaskReconciliation.mockResolvedValue(1);
    mocks.routeEvent.mockResolvedValue({ destination: 'postgresql' });
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 0, actionType: 'page_view' });
    mocks.generateSessionSummaryReports.mockResolvedValue({
      classReports: 1,
      studentReports: 1,
      skipped: false,
    });
    mocks.enqueueSessionSummaryReportRefresh.mockResolvedValue({
      reportRefreshJobs: 1,
      skipped: false,
    });
    mocks.resolveTrustedControlWorkbenchContext.mockResolvedValue({
      sessionId: 'cmoxloe52000uq5bcojma7r78',
      classId: 'class-1',
      lessonPlanId: 'plan-1',
      manifestHash: 'manifest-hash-1',
      lessonId: '4-2',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      capabilityId: 'control-frequency-reading-workbench',
      registryId: 'classroom-objective',
    });
    mocks.persistedControlWorkbenchRunMatchesContext.mockReturnValue(true);
    // 默认回执：ACTIVE 会话接受，单调序列 1；血缘回执绑定 clientEventId
    mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mockImplementation(
      async (input: {
        userId: string;
        submissionIdentity: string;
        identityVersion: string;
        sourceEvent: { clientEventId: string | null; sessionId: string };
      }) => ({
        status: 'ACCEPTED' as const,
        evidenceStatus: 'ACCEPTED',
        evidenceId: `evidence-${input.sourceEvent.clientEventId ?? 'unknown'}`,
        sourceLogId: `source-${input.sourceEvent.clientEventId ?? 'unknown'}`,
        submissionIdentity: input.submissionIdentity,
        identityVersion: input.identityVersion,
        submissionSequence: 1n,
        sessionStatus: 'ACTIVE',
      }),
    );
  });

  it('deduplicates client events and removes invalid session ids before writing logs', async () => {
    const response = await POST(createPostRequest({
        events: [
          {
            id: 'client-existing',
            type: 'view',
            timestamp: Date.parse('2026-05-09T02:30:00.000Z'),
            resourceKey: 'unit-4-3',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            data: { originPath: '/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/cmoxloe52000uq5bcojma7r78' },
          },
          {
            id: 'client-review',
            type: 'view',
            timestamp: Date.parse('2026-05-09T02:30:00.000Z'),
            resourceKey: 'unit-4-3',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            data: { originPath: '/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/cmoxloe52000uq5bcojma7r78' },
          },
          {
            id: 'client-review',
            type: 'view',
            timestamp: Date.parse('2026-05-09T02:31:00.000Z'),
            resourceKey: 'unit-4-3',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            data: {},
          },
          {
            id: 'client-invalid-session',
            type: 'view',
            timestamp: Date.parse('2026-05-09T02:30:00.000Z'),
            resourceKey: 'unit-4-3',
            sessionId: 'cmoxloe52000uq5bcojma7r78.',
            data: {},
          },
        ],
      }));

    const payload = await response.json();
    const createArg = mocks.prisma.interactionLog.createManyAndReturn.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      count: 2,
      duplicates: 2,
    });
    expect(createArg.data).toHaveLength(2);
    expect(createArg.data[0]).toMatchObject({
      clientEventId: 'client-review',
      sessionId: 'cmoxloe52000uq5bcojma7r78',
      learningContext: 'classroom_review',
    });
    expect(createArg.data[0].eventData).toMatchObject({
      afterSessionEnd: true,
      learningContext: 'classroom_review',
    });
    expect(createArg.data[1]).toMatchObject({
      clientEventId: 'client-invalid-session',
      sessionId: null,
      learningContext: 'standalone_resource',
      invalidContextReason: 'invalid_session_id_format',
    });
    expect(mocks.routeEvent).toHaveBeenCalledTimes(2);
    expect(mocks.generateSessionSummaryReports).not.toHaveBeenCalled();
  });

  it('downgrades class-bound events when the student does not belong to the session class', async () => {
    mocks.prisma.classSession.findMany.mockResolvedValue([
      {
        id: 'cmoxloe52000uq5bcojma7r78',
        status: 'ACTIVE',
        endTime: null,
        classId: 'class-2',
        teacherId: 'teacher-1',
      },
    ]);
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT', profile: { classId: 'class-1' } },
    });
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-forbidden', clientEventId: 'client-forbidden-session', eventData: { clientEventId: 'client-forbidden-session' } },
    ]);

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-forbidden-session',
          type: 'view',
          timestamp: Date.parse('2026-05-09T02:30:00.000Z'),
          resourceKey: 'unit-4-3',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          data: { sessionId: 'cmoxloe52000uq5bcojma7r78' },
        },
      ],
    }));
    const createArg = mocks.prisma.interactionLog.createManyAndReturn.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(createArg.data).toEqual([
      expect.objectContaining({
        clientEventId: 'client-forbidden-session',
        sessionId: null,
        learningContext: 'standalone_resource',
        invalidContextReason: 'forbidden_session',
      }),
    ]);
    expect(createArg.data[0].eventData).toMatchObject({
      invalidContextReason: 'forbidden_session',
    });
    expect(createArg.data[0].eventData).not.toHaveProperty('sessionId');
    expect(mocks.persistCoreLearningFact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        sessionId: null,
        payload: expect.not.objectContaining({
          sessionId: 'cmoxloe52000uq5bcojma7r78',
        }),
      }),
    );
  });

  it('refreshes the session report after a session_finalize event is persisted', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-finalize', clientEventId: 'client-finalize', eventData: { clientEventId: 'client-finalize' } },
    ]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'session_finalize' });

    const response = await POST(createPostRequest({
        events: [
          {
            id: 'client-finalize',
            type: 'complete',
            timestamp: Date.parse('2026-05-09T02:04:24.000Z'),
            resourceKey: 'unit-4-3',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            data: { eventType: 'session_finalize' },
          },
        ],
      }));

    expect(response.status).toBe(200);
    expect(mocks.generateSessionSummaryReports).toHaveBeenCalledWith(
      mocks.prisma,
      'cmoxloe52000uq5bcojma7r78',
    );
    expect(mocks.enqueueSessionSummaryReportRefresh).toHaveBeenCalledWith('cmoxloe52000uq5bcojma7r78');
  });

  it('persists immutable student step responses for lesson submissions through the shared evidence writer', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_submit' });

    const response = await POST(createPostRequest({
        events: [
          {
            id: 'client-submit',
            type: 'submit',
            timestamp: Date.parse('2026-05-12T01:46:42.900Z'),
            resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
            lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            stepId: 'step-08',
            attemptKey: 'step-08:response:1778550421493',
            data: {
              eventType: 'lesson_submit',
              score: 100,
              answerDigest: { 'weight-preference': 'C' },
              questionSummaries: [
                {
                  questionId: 'weight-preference',
                  prompt: '若更担心动作代价继续抬高，更应优先保留哪一组偏好？',
                  studentAnswer: 'C',
                  referenceAnswer: 'C',
                  isCorrect: true,
                },
              ],
            },
          },
        ],
      }));

    expect(response.status).toBe(200);
    // 分类提交不再走批量 createManyAndReturn / createMany，而走会话事务写入器
    expect(mocks.prisma.interactionLog.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.prisma.studentStepResponse.createMany).not.toHaveBeenCalled();
    expect(mocks.submissionEvidenceRuntime.acceptClassifiedSubmission).toHaveBeenCalledTimes(1);
    const writerInput = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];
    expect(writerInput).toMatchObject({
      userId: 'student-1',
      identityVersion: 'classroom-submission-identity-v1',
      sourceEvent: {
        sessionId: 'cmoxloe52000uq5bcojma7r78',
        lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
        stepId: 'step-08',
        eventType: 'submit',
        clientEventId: 'client-submit',
      },
      response: {
        stepId: 'step-08',
        attemptKey: 'step-08:response:1778550421493',
        clientEventId: 'client-submit',
      },
    });
    expect(writerInput.submissionIdentity).toBeTruthy();
    expect(writerInput.response.buildResponseData('source-client-submit')).toMatchObject({
      eventType: 'lesson_submit',
      answerDigest: { 'weight-preference': 'C' },
    });
    // 事实物化使用写入器回执的持久化 sourceLogId
    expect(mocks.persistCoreLearningFact).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        payload: expect.objectContaining({
          sourceLogId: 'source-client-submit',
        }),
      }),
    );
  });

  it('deduplicates repeated classroom submissions through the shared evidence writer receipts', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_submit' });
    // 同批次同身份：首件 ACCEPTED，重件由写入器回执判 DUPLICATE
    mocks.submissionEvidenceRuntime.acceptClassifiedSubmission
      .mockImplementationOnce(async (input: {
        userId: string;
        submissionIdentity: string;
        identityVersion: string;
        sourceEvent: { clientEventId: string | null; sessionId: string };
      }) => ({
        status: 'ACCEPTED' as const,
        evidenceStatus: 'ACCEPTED',
        evidenceId: 'evidence-a',
        sourceLogId: 'source-client-submit-a',
        submissionIdentity: input.submissionIdentity,
        identityVersion: input.identityVersion,
        submissionSequence: 1n,
        sessionStatus: 'ACTIVE',
      }))
      .mockImplementationOnce(async (input: {
        userId: string;
        submissionIdentity: string;
        identityVersion: string;
        sourceEvent: { clientEventId: string | null; sessionId: string };
      }) => ({
        status: 'DUPLICATE' as const,
        evidenceStatus: 'ACCEPTED',
        evidenceId: 'evidence-a',
        sourceLogId: 'source-client-submit-a',
        submissionIdentity: input.submissionIdentity,
        identityVersion: input.identityVersion,
        submissionSequence: 1n,
        sessionStatus: 'ACTIVE',
      }));

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-submit-a',
          type: 'submit',
          timestamp: Date.parse('2026-05-12T01:46:42.900Z'),
          resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-08',
          attemptKey: 'step-08:response:1778550421493',
          data: {
            eventType: 'lesson_submit',
            cardId: 'weight-preference',
            score: 100,
          },
        },
        {
          id: 'client-submit-b',
          type: 'submit',
          timestamp: Date.parse('2026-05-12T01:46:43.900Z'),
          resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-08',
          attemptKey: 'step-08:response:1778550421493',
          data: {
            eventType: 'lesson_submit',
            cardId: 'weight-preference',
            score: 100,
          },
        },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      count: 2,
      duplicates: 1,
      submissionDuplicates: 1,
    });
    // 同身份证据只写一行；重件仅返回原回执，不再物化事实
    expect(mocks.prisma.interactionLog.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.prisma.studentStepResponse.createMany).not.toHaveBeenCalled();
    expect(mocks.submissionEvidenceRuntime.acceptClassifiedSubmission).toHaveBeenCalledTimes(2);
    expect(mocks.routeEvent).toHaveBeenCalledTimes(1);
    // 首件内联物化 1 次 + 重件 DUPLICATE 回执重放 1 次（均幂等）
    expect(mocks.persistCoreLearningFact).toHaveBeenCalledTimes(2);
  });

  it('returns the durable receipt when the same submission identity already exists', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mockResolvedValue({
      status: 'DUPLICATE',
      evidenceStatus: 'ACCEPTED',
      evidenceId: 'evidence-existing',
      sourceLogId: 'source-existing',
      submissionIdentity: 'identity',
      identityVersion: 'classroom-submission-identity-v1',
      submissionSequence: 1n,
      sessionStatus: 'ACTIVE',
    });

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-submit-later',
          type: 'submit',
          timestamp: Date.parse('2026-05-12T01:46:44.900Z'),
          resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-08',
          attemptKey: 'step-08:response:1778550421493',
          data: {
            eventType: 'lesson_submit',
            cardId: 'weight-preference',
            score: 100,
          },
        },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      duplicates: 1,
      submissionDuplicates: 1,
      acceptedSubmissions: 0,
    });
    expect(mocks.prisma.interactionLog.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.prisma.studentStepResponse.createMany).not.toHaveBeenCalled();
    expect(mocks.submissionEvidenceRuntime.acceptClassifiedSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.routeEvent).not.toHaveBeenCalled();
    // DUPLICATE 回执幂等重放事实物化（崩溃恢复边界），路由级事件路由不重跑
    expect(mocks.persistCoreLearningFact).toHaveBeenCalledTimes(1);
  });

  it('degrades identity-less submissions instead of persisting evidence that bypasses the closure boundary', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);

    const response = await POST(createPostRequest({
      events: [
        {
          type: 'submit',
          timestamp: Date.parse('2026-05-12T01:46:44.900Z'),
          resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-08',
          data: {
            eventType: 'lesson_submit',
            score: 100,
          },
        },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      count: 0,
      degraded: 1,
      acceptedSubmissions: 0,
    });
    expect(mocks.submissionEvidenceRuntime.acceptClassifiedSubmission).not.toHaveBeenCalled();
    expect(mocks.prisma.interactionLog.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.prisma.studentStepResponse.createMany).not.toHaveBeenCalled();
    expect(mocks.routeEvent).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });

  it('skips new classroom evidence when the same session step and attempt identity already exists', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mockResolvedValue({
      status: 'DUPLICATE',
      evidenceStatus: 'ACCEPTED',
      evidenceId: 'evidence-existing',
      sourceLogId: 'source-existing',
      submissionIdentity: 'identity',
      identityVersion: 'classroom-submission-identity-v1',
      submissionSequence: 1n,
      sessionStatus: 'ACTIVE',
    });

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-submit-later',
          type: 'submit',
          timestamp: Date.parse('2026-05-12T01:46:44.900Z'),
          resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-08',
          attemptKey: 'step-08:response:1778550421493',
          data: {
            eventType: 'lesson_submit',
            cardId: 'weight-preference',
            score: 100,
          },
        },
      ],
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      count: 1,
      duplicates: 1,
      submissionDuplicates: 1,
      acceptedSubmissions: 0,
    });
    expect(mocks.prisma.interactionLog.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.prisma.studentStepResponse.createMany).not.toHaveBeenCalled();
    expect(mocks.submissionEvidenceRuntime.acceptClassifiedSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.routeEvent).not.toHaveBeenCalled();
    expect(mocks.persistCoreLearningFact).toHaveBeenCalledTimes(1);
  });

  it('rejects the batch atomically when the shared evidence writer fails, without partial evidence', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mockRejectedValue(
      new Error('submission transaction failed'),
    );
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_submit' });

    const response = await POST(createPostRequest({
        events: [
          {
            id: 'client-submit',
            type: 'submit',
            timestamp: Date.parse('2026-05-12T01:46:42.900Z'),
            resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
            lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            stepId: 'step-08',
            data: {
              eventType: 'lesson_submit',
              answerDigest: { 'weight-preference': 'C' },
            },
          },
        ],
      }));

    // 写入器失败即整体失败：不落证据、不物化事实；客户端重试队列可安全重发（同身份幂等）
    expect(response.status).toBe(500);
    expect(mocks.prisma.studentStepResponse.createMany).not.toHaveBeenCalled();
    expect(mocks.persistCoreLearningFact).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('marks legacy lesson submissions as lower-quality evidence instead of full diagnostics', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_submit' });

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-legacy-submit',
          type: 'submit',
          timestamp: Date.parse('2026-05-12T01:57:42.900Z'),
          resourceKey: 'unit-5-1-linear-backbone-boundaries',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-03',
          data: {
            eventType: 'lesson_submit',
            stepId: 'step-03',
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    const writerInput = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];
    expect(writerInput.response.buildResponseData('source-legacy')).toMatchObject({
      eventType: 'lesson_submit',
      evidenceQuality: 'legacy-envelope',
      evidenceQualityReason: 'unsupported_legacy_envelope',
      evidenceSourceState: 'legacy-envelope',
    });
    expect(mocks.persistCoreLearningFact.mock.calls[0][1].payload).toMatchObject({
      evidenceQuality: 'legacy-envelope',
    });
  });

  it('preserves v2 evidence quality for immutable student step responses', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_submit' });

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-v2-submit',
          type: 'submit',
          timestamp: Date.parse('2026-05-12T01:58:42.900Z'),
          resourceKey: 'unit-5-1-linear-backbone-boundaries',
          lessonKey: 'unit-5-1-linear-backbone-boundaries-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-03',
          data: {
            schemaVersion: 'manifest-submission-v2',
            eventType: 'lesson_submit',
            stepId: 'step-03',
            answers: { boundary: 'A' },
            questionSummaries: [
              {
                questionId: 'boundary',
                studentAnswer: 'A',
                referenceValue: 'A',
                isCorrect: true,
              },
            ],
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    const writerInput = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];
    expect(writerInput.response.buildResponseData('source-v2')).toMatchObject({
      schemaVersion: 'manifest-submission-v2',
      evidenceQuality: 'rich',
      evidenceQualityReason: 'scoreable_objective_evidence',
      evidenceSourceState: 'manifest-submission-v2',
      answers: { boundary: 'A' },
    });
  });

  it('persists lesson resubmissions when the client event id is carried in the payload', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_resubmit' });

    const response = await POST(createPostRequest({
        events: [
          {
            type: 'submit',
            timestamp: Date.parse('2026-05-12T01:50:42.900Z'),
            resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
            lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            stepId: 'step-10',
            attemptKey: 'step-10:response:1778550642900',
            data: {
              clientEventId: 'client-resubmit',
              eventType: 'lesson_resubmit',
              answerDigest: { 'constraint-priority': 'B' },
            },
          },
        ],
      }));

    expect(response.status).toBe(200);
    expect(mocks.submissionEvidenceRuntime.acceptClassifiedSubmission).toHaveBeenCalledTimes(1);
    const writerInput = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];
    expect(writerInput).toMatchObject({
      userId: 'student-1',
      sourceEvent: {
        sessionId: 'cmoxloe52000uq5bcojma7r78',
        lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
        stepId: 'step-10',
        eventType: 'submit',
        clientEventId: 'client-resubmit',
      },
      response: {
        stepId: 'step-10',
        attemptKey: 'step-10:response:1778550642900',
        clientEventId: 'client-resubmit',
      },
    });
    expect(writerInput.response.buildResponseData('source-resubmit')).toMatchObject({
      eventType: 'lesson_resubmit',
      answerDigest: { 'constraint-priority': 'B' },
    });
  });

  it('ignores forged client sourceLogId and uses the persisted interaction log id', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_submit' });

    const response = await POST(createPostRequest({
        events: [
          {
            type: 'submit',
            timestamp: Date.parse('2026-05-12T01:54:42.900Z'),
            resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
            lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            stepId: 'step-08',
            data: {
              clientEventId: 'client-forged-source',
              eventType: 'lesson_submit',
              sessionId: 'cmoxloe52000uq5bcojma7r78',
              stepId: 'step-08',
              sourceLogId: 'forged-log-id',
              answerDigest: { 'weight-preference': 'C' },
            },
          },
        ],
      }));

    const learningEvent = mocks.persistCoreLearningFact.mock.calls[0][1];
    const writerInput = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];

    expect(response.status).toBe(200);
    // 客户端伪造的 sourceLogId 不进入源事件载荷，也不进入响应证据
    expect(writerInput.sourceEvent.eventData).toEqual(expect.objectContaining({
      clientEventId: 'client-forged-source',
      eventType: 'lesson_submit',
      dedupeIdentity: 'cmoxloe52000uq5bcojma7r78:lesson_submit:student:step-08:client-forged-source',
    }));
    expect(writerInput.sourceEvent.eventData).not.toHaveProperty('sourceLogId');
    expect(writerInput.response.buildResponseData('source-client-forged-source')).toMatchObject({
      sourceLogId: 'source-client-forged-source',
    });
    // 事实物化使用写入器回执的持久化 sourceLogId
    expect(learningEvent.payload).toMatchObject({
      sourceLogId: 'source-client-forged-source',
    });
    expect(learningEvent.payload.sourceLogId).not.toBe('forged-log-id');
  });

  it('derives actorRole from the authenticated user before persisting interaction events', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);

    const response = await POST(createPostRequest({
        events: [
          {
            id: 'client-forged-role',
            type: 'submit',
            timestamp: Date.parse('2026-05-12T01:54:42.900Z'),
            resourceKey: 'unit-4-4-fixed-structure-optimization-modeling',
            lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
            sessionId: 'cmoxloe52000uq5bcojma7r78',
            stepId: 'step-08',
            actorRole: 'teacher',
            data: {
              clientEventId: 'client-forged-role',
              eventType: 'lesson_submit',
              sessionId: 'cmoxloe52000uq5bcojma7r78',
              stepId: 'step-08',
              actorRole: 'teacher',
              answerDigest: { 'weight-preference': 'C' },
            },
          },
        ],
      }));

    const writerInput = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];

    expect(response.status).toBe(200);
    expect(writerInput.sourceEvent.actorRole).toBe('student');
    expect(writerInput.sourceEvent.eventData).toEqual(expect.objectContaining({
      actorRole: 'student',
      dedupeIdentity: 'cmoxloe52000uq5bcojma7r78:lesson_submit:student:step-08:client-forged-role',
    }));
  });

  it('materializes control workbench evidence with trusted source log fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T01:00:00.000Z'));
    mocks.prisma.learningFact.createMany.mockResolvedValue({ count: 0 });
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    // 该分类提交的持久化血缘由写入器回执提供
    mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mockImplementation(
      async (input: {
        userId: string;
        submissionIdentity: string;
        identityVersion: string;
        sourceEvent: { clientEventId: string | null; sessionId: string };
      }) => ({
        status: 'ACCEPTED' as const,
        evidenceStatus: 'ACCEPTED',
        evidenceId: 'evidence-workbench',
        sourceLogId: 'actual-workbench-log-id',
        submissionIdentity: input.submissionIdentity,
        identityVersion: input.identityVersion,
        submissionSequence: 1n,
        sessionStatus: 'ACTIVE',
      }),
    );
    mocks.prisma.simulationRun.findFirst.mockImplementation(
      async (args: { where?: { id?: string } }) => ({
        id: args.where?.id ?? 'workbench-simulation-run',
        resourceId: 'frequency-workbench',
        taskSpecSnapshot: {
          sceneId: 'frequency-workbench',
          plantRef: 'second-order-plant',
          disturbancePolicy: {
            wave: args.where?.id === 'workbench-simulation-run' ? 1 : 2,
          },
          evaluationSpecRef: { id: 'frequency-workbench-quality-v1' },
        },
        controllerSnapshotRef: 'lead-controller-snapshot',
        summary: {
          qualityTargetMet: args.where?.id !== 'workbench-simulation-run-invalid',
          metrics: {
            settlingTime: 2.5,
            stable: true,
          },
        },
        modelVersion: 'second-order-v1',
        completedAt: new Date('2026-06-18T00:00:00.000Z'),
      }),
    );

    const workbenchDraft = {
      eventType: 'lesson_submit',
      clientEventId: 'client-workbench',
      attemptKey: 'step-04:response:1',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      componentKind: 'compute.panel',
      componentId: 'frequency-workbench',
      actorRole: 'student',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      schemaVersion: 'control-workbench-evidence-v1',
      payload: {
        capabilityId: 'control-frequency-reading-workbench',
        visiblePanelIds: ['bode', 'root-locus'],
        parameterSnapshot: { 'gain.k': 1 },
        selectedDesignState: { controller: 'lead', gain: 2 },
        derivedResultRefs: [
          { kind: 'SimulationRun', id: 'workbench-simulation-run' },
          { kind: 'SimulationRun', id: 'workbench-simulation-run-2' },
          { kind: 'SimulationRun', id: 'workbench-simulation-run-invalid' },
        ],
        answerPayload: { responseContractId: 'parameter.set' },
        releaseState: 'released',
        fallbackState: 'supported',
        classification: ['InteractionLog', 'StudentStepResponse'],
        serverRecordedAt: null,
      },
    };

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-workbench',
          type: 'submit',
          timestamp: Date.parse('2026-06-18T00:00:00.000Z'),
          resourceKey: 'unit-4-2-controller-selection-first-start-v1',
          lessonKey: 'unit-4-2-controller-selection-first-start-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-04',
          data: {
            clientEventId: 'client-workbench',
            eventType: 'lesson_submit',
            answerDigest: {
              'parameter.set': JSON.stringify(workbenchDraft),
            },
          },
        },
      ],
    }));

    const writerCall = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];
    const persistedRowResponseData = writerCall.response.buildResponseData('actual-workbench-log-id') as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(persistedRowResponseData.controlWorkbenchEvidence).toMatchObject({
      sourceLogId: 'actual-workbench-log-id',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      actorRole: 'student',
      payload: {
        capabilityId: 'control-frequency-reading-workbench',
        serverRecordedAt: '2026-06-18T01:00:00.000Z',
      },
    });
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          userId: 'student-1',
          factType: 'simulation_task_evidence',
          moduleId: 'control-workbench:free',
          sourceLogId: 'actual-workbench-log-id',
          competencyContribution: {},
        }),
      ],
    }));
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledTimes(2);
    expect(mocks.requestRealtimeSimulationTaskReconciliation).toHaveBeenCalledTimes(1);
    expect(mocks.requestRealtimeSimulationTaskReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: 'student-1',
        reason: 'control-workbench-task-evidence',
      },
    );
    expect(mocks.prisma.learningFact.createMany.mock.calls.map(
      ([call]) => call.data[0].contextJson.simulationTaskEvidence.summary.sourceRef,
    )).toEqual([
      'SimulationRun:workbench-simulation-run',
      'SimulationRun:workbench-simulation-run-2',
    ]);
    expect(mocks.resolveTrustedControlWorkbenchContext).toHaveBeenCalledWith({
      user: { id: 'student-1', role: 'STUDENT' },
      sessionId: 'cmoxloe52000uq5bcojma7r78',
      lessonId: 'unit-4-2-controller-selection-first-start-v1',
      stepId: 'step-04',
      moduleId: 'frequency-workbench',
      capabilityId: 'control-frequency-reading-workbench',
      requireActive: false,
    });
    expect(mocks.persistedControlWorkbenchRunMatchesContext).toHaveBeenCalledTimes(3);
    const writerSourceEventData = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0]
      .sourceEvent.eventData as Record<string, unknown>;
    const routedLearningEvent = mocks.routeEvent.mock.calls[0][0];
    const routedDraft = JSON.parse(routedLearningEvent.payload.answerDigest['parameter.set']);
    expect(writerSourceEventData.actorRole).toBe('student');
    expect(routedDraft.actorRole).toBe('student');
    vi.useRealTimers();
  });

  it('does not promote a control workbench submission with a client-invented result reference', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'design-only-workbench',
          type: 'submit',
          timestamp: Date.parse('2026-06-18T00:00:00.000Z'),
          resourceKey: 'unit-4-2-controller-selection-first-start-v1',
          lessonKey: 'unit-4-2-controller-selection-first-start-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-04',
          data: {
            clientEventId: 'design-only-workbench',
            eventType: 'lesson_submit',
            answerDigest: {
              'parameter.set': JSON.stringify({
                eventType: 'lesson_submit',
                clientEventId: 'design-only-workbench',
                attemptKey: 'step-04:response:1',
                lessonKey: 'unit-4-2-controller-selection-first-start-v1',
                stepId: 'step-04',
                moduleId: 'frequency-workbench',
                componentKind: 'compute.panel',
                componentId: 'frequency-workbench',
                actorRole: 'student',
                clientEventAt: '2026-06-18T00:00:00.000Z',
                schemaVersion: 'control-workbench-evidence-v1',
                payload: {
                  capabilityId: 'control-frequency-reading-workbench',
                  visiblePanelIds: ['bode'],
                  parameterSnapshot: { 'gain.k': 1 },
                  selectedDesignState: { controller: 'lead', gain: 2 },
                  derivedResultRefs: [{ kind: 'fake', id: 'fake-result-1' }],
                  answerPayload: null,
                  releaseState: 'released',
                  fallbackState: 'supported',
                  classification: ['InteractionLog', 'StudentStepResponse'],
                  serverRecordedAt: null,
                },
              }),
            },
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.submissionEvidenceRuntime.acceptClassifiedSubmission).toHaveBeenCalledTimes(1);
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('materializes a student-owned completed virtual simulation run', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      {
        id: 'simulation-log-1',
        clientEventId: 'client-simulation-finish',
        eventData: { clientEventId: 'client-simulation-finish' },
      },
    ]);
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'canonical-simulation-run-1',
      resourceId: 'sim-pid-v1',
      taskSpecSnapshot: {
        sceneId: 'sim-pid-v1',
        plantRef: 'ship',
        initialConditions: { heading: 0 },
      },
      controllerSnapshotRef: 'controller-snapshot-1',
      summary: {
        metrics: {
          settlingTime: 3.2,
          stable: true,
          rawAnswer: 'must-not-be-copied',
        },
      },
      modelVersion: 'ship-v1',
      completedAt: new Date('2026-06-18T00:00:00.000Z'),
    });

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-simulation-finish',
          type: 'complete',
          timestamp: Date.parse('2026-06-18T00:00:00.000Z'),
          resourceKey: 'sim-pid-v1',
          data: {
            clientEventId: 'client-simulation-finish',
            eventType: 'simulation_finish',
            registryId: 'sim-pid-v1',
            simulationRunId: 'canonical-simulation-run-1',
            modelVersion: 'ship-v1',
            controllerConfig: { kp: 2, ki: 0.4, kd: 0.1 },
            input: { setpoint: 1 },
            metrics: { settlingTime: 3.2, stable: true },
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      skipDuplicates: true,
      data: [
        expect.objectContaining({
          userId: 'student-1',
          factType: 'simulation_task_evidence',
          moduleId: 'virtual-simulation:sim-pid-v1',
          sourceLogId: 'simulation-log-1',
          competencyContribution: {},
        }),
      ],
    }));
    const taskContext = mocks.prisma.learningFact.createMany.mock.calls[0][0].data[0].contextJson;
    expect(taskContext.simulationTaskEvidence.summary).toEqual({
      sourceRef: 'SimulationRun:canonical-simulation-run-1',
      qualityBand: 'full',
      metrics: {
        settlingTime: 3.2,
        stable: true,
      },
      label: 'Virtual simulation completed run',
    });
    expect(mocks.requestRealtimeSimulationTaskReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: 'student-1',
        reason: 'virtual-simulation-task-evidence',
      },
    );
  });

  it('repairs virtual-simulation task evidence from an existing interaction log on retry', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([
      { id: 'existing-simulation-log', clientEventId: 'retry-simulation-finish' },
    ]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([]);
    mocks.prisma.learningFact.createMany.mockResolvedValueOnce({ count: 0 });
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'canonical-existing-run',
      resourceId: 'sim-pid-v1',
      taskSpecSnapshot: { sceneId: 'sim-pid-v1' },
      controllerSnapshotRef: 'controller-snapshot-existing',
      summary: {},
      modelVersion: 'ship-v1',
      completedAt: new Date('2026-06-18T00:00:00.000Z'),
    });

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'retry-simulation-finish',
          type: 'complete',
          timestamp: Date.parse('2026-06-18T00:00:00.000Z'),
          resourceKey: 'sim-pid-v1',
          data: {
            clientEventId: 'retry-simulation-finish',
            eventType: 'simulation_finish',
            registryId: 'sim-pid-v1',
            simulationRunId: 'canonical-existing-run',
            modelVersion: 'ship-v1',
            controllerConfig: { kp: 2, ki: 0.4, kd: 0.1 },
            input: { setpoint: 1 },
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.interactionLog.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          moduleId: 'virtual-simulation:sim-pid-v1',
          sourceLogId: 'existing-simulation-log',
        }),
      ],
      skipDuplicates: true,
    }));
    expect(mocks.requestRealtimeSimulationTaskReconciliation).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: 'student-1',
        reason: 'virtual-simulation-task-evidence',
      },
    );
  });

  it('does not reuse a completed simulation run in a different classroom session', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      {
        id: 'cross-session-log',
        clientEventId: 'cross-session-finish',
        eventData: { clientEventId: 'cross-session-finish' },
      },
    ]);
    mocks.prisma.simulationRun.findFirst.mockResolvedValue({
      id: 'run-from-another-session',
      sessionId: 'cmoxloe52000uq5bcojma7r79',
      resourceId: 'sim-pid-v1',
      taskSpecSnapshot: { sceneId: 'sim-pid-v1' },
      controllerSnapshotRef: 'controller-snapshot-cross-session',
      summary: {},
      modelVersion: 'ship-v1',
      completedAt: new Date('2026-06-18T00:00:00.000Z'),
    });

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'cross-session-finish',
          type: 'complete',
          timestamp: Date.parse('2026-06-18T00:00:00.000Z'),
          resourceKey: 'sim-pid-v1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          data: {
            clientEventId: 'cross-session-finish',
            eventType: 'simulation_finish',
            registryId: 'sim-pid-v1',
            simulationRunId: 'run-from-another-session',
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('does not materialize virtual task evidence without an owned durable completed run', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      {
        id: 'untrusted-simulation-log',
        clientEventId: 'untrusted-simulation-finish',
        eventData: { clientEventId: 'untrusted-simulation-finish' },
      },
    ]);

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'untrusted-simulation-finish',
          type: 'complete',
          timestamp: Date.parse('2026-06-18T00:00:00.000Z'),
          resourceKey: 'sim-pid-v1',
          data: {
            clientEventId: 'untrusted-simulation-finish',
            eventType: 'simulation_finish',
            registryId: 'sim-pid-v1',
            controllerConfig: { kp: 999 },
            metrics: { rawAnswer: 'client-controlled', score: 100 },
          },
        },
      ],
    }));

    expect(response.status).toBe(200);
    expect(mocks.prisma.simulationRun.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.learningFact.createMany).not.toHaveBeenCalled();
  });

  it('materializes annotated media evidence with trusted source log fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T01:00:00.000Z'));
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    // 该分类提交的持久化血缘由写入器回执提供
    mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mockImplementation(
      async (input: {
        userId: string;
        submissionIdentity: string;
        identityVersion: string;
        sourceEvent: { clientEventId: string | null; sessionId: string };
      }) => ({
        status: 'ACCEPTED' as const,
        evidenceStatus: 'ACCEPTED',
        evidenceId: 'evidence-annotated-media',
        sourceLogId: 'actual-annotated-media-log-id',
        submissionIdentity: input.submissionIdentity,
        identityVersion: input.identityVersion,
        submissionSequence: 1n,
        sessionStatus: 'ACTIVE',
      }),
    );

    const annotatedMediaDraft = {
      eventType: 'media_submit',
      clientEventId: 'client-annotated-media',
      attemptKey: 'step-05:response:1',
      lessonKey: 'annotated-media-activity-fixture',
      stepId: 'step-05',
      moduleId: 'annotated-media',
      componentKind: 'visual.annotatedMedia',
      componentId: 'closed-loop-media',
      actorRole: 'teacher',
      clientEventAt: '2026-06-18T00:00:00.000Z',
      schemaVersion: 'annotated-media-evidence-v1',
      serverRecordedAt: null,
      classification: ['InteractionLog', 'StudentStepResponse'],
      affectsTeacherDiagnostics: true,
      affectsAbilitySnapshots: false,
      affectsRecommendationInputs: false,
      payload: {
        mediaId: 'closed-loop-media',
        activeRevealState: 'diagnostic-reveal',
        selectedAnnotationIds: ['input-hotspot', 'output-hotspot'],
        omittedRequiredAnnotationIds: ['risk-hotspot'],
        evidenceRoles: {
          'input-hotspot': 'input',
          'output-hotspot': 'output',
          'risk-hotspot': 'risk',
        },
        embeddedActivityAnchorId: 'media-choice-anchor',
        answerPayload: {
          responseContractId: 'choice.single',
          selectedAnswerId: 'output-hotspot',
          visualModuleId: 'annotated-media',
        },
        teachingLabels: {
          'input-hotspot': '输入信号',
          'output-hotspot': '输出响应',
          'risk-hotspot': '反馈风险',
        },
        feedback: {
          misconceptionTagIds: ['missed-risk-hotspot'],
          studentFeedbackMode: 'hint',
          teacherNextPrompt: '请学生补充遗漏的图上证据。',
          reviewAction: 'review',
        },
        classification: ['InteractionLog', 'StudentStepResponse'],
        serverRecordedAt: null,
      },
    };

    const response = await POST(createPostRequest({
      events: [
        {
          id: 'client-annotated-media',
          type: 'submit',
          timestamp: Date.parse('2026-06-18T00:00:00.000Z'),
          resourceKey: 'annotated-media-activity-fixture',
          lessonKey: 'annotated-media-activity-fixture',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          stepId: 'step-05',
          data: {
            clientEventId: 'client-annotated-media',
            eventType: 'lesson_submit',
            answers: {
              annotatedMediaEvidenceDraft: JSON.stringify(annotatedMediaDraft),
            },
          },
        },
      ],
    }));

    const writerCall = mocks.submissionEvidenceRuntime.acceptClassifiedSubmission.mock.calls[0][0];
    const persistedRowResponseData = writerCall.response.buildResponseData('actual-annotated-media-log-id') as Record<string, unknown>;
    expect(response.status).toBe(200);
    expect(persistedRowResponseData.annotatedMediaEvidence).toMatchObject({
      sourceLogId: 'actual-annotated-media-log-id',
      lessonKey: 'annotated-media-activity-fixture',
      actorRole: 'student',
      payload: {
        mediaId: 'closed-loop-media',
        selectedAnnotationIds: ['input-hotspot', 'output-hotspot'],
        embeddedActivityAnchorId: 'media-choice-anchor',
        answerPayload: {
          selectedAnswerId: 'output-hotspot',
        },
        serverRecordedAt: '2026-06-18T01:00:00.000Z',
      },
    });
    const writerSourceEventData = writerCall.sourceEvent.eventData as Record<string, unknown>;
    const routedLearningEvent = mocks.routeEvent.mock.calls[0][0];
    const routedDraft = JSON.parse(routedLearningEvent.payload.answers.annotatedMediaEvidenceDraft);
    const persistedDraft = JSON.parse(writerSourceEventData.answers.annotatedMediaEvidenceDraft);
    expect(persistedDraft.actorRole).toBe('student');
    expect(routedDraft.actorRole).toBe('student');
    vi.useRealTimers();
  });

  it('returns teacher-only control workbench diagnostics from materialized responses', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        responseData: {
          controlWorkbenchEvidence: {
            eventType: 'lesson_submit',
            clientEventId: 'client-workbench',
            attemptKey: 'step-04:response:1',
            sourceLogId: 'actual-workbench-log-id',
            lessonKey: 'unit-4-2-controller-selection-first-start-v1',
            stepId: 'step-04',
            moduleId: 'frequency-workbench',
            payload: {
              capabilityId: 'control-frequency-reading-workbench',
              parameterSnapshot: { 'gain.k': 1 },
              answerPayload: { judgment: 'safe-margin' },
              releaseState: 'released',
              fallbackState: 'supported',
              serverRecordedAt: '2026-06-18T00:00:00.000Z',
            },
          },
        },
      },
    ]);

    const response = await GET(new NextRequest(
      'http://localhost/api/interactive/events?diagnostics=control-workbench&resourceKey=unit-4-2-controller-selection-first-start-v1',
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.diagnostics).toMatchObject({
      viewedCount: 1,
      submittedCount: 1,
      releasedCount: 1,
      parameterCoverage: [{ parameterId: 'gain.k', count: 1 }],
      judgmentOutcomes: [{ outcome: 'safe-margin', count: 1 }],
    });
  });

  it('returns teacher-only annotated media diagnostics from materialized responses', async () => {
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        responseData: {
          annotatedMediaEvidence: {
            eventType: 'media_submit',
            clientEventId: 'client-annotated-media',
            attemptKey: 'step-05:response:1',
            sourceLogId: 'actual-annotated-media-log-id',
            lessonKey: 'annotated-media-activity-fixture',
            stepId: 'step-05',
            moduleId: 'annotated-media',
            actorRole: 'student',
            payload: {
              mediaId: 'closed-loop-media',
              activeRevealState: 'diagnostic-reveal',
              selectedAnnotationIds: ['input-hotspot', 'output-hotspot'],
              omittedRequiredAnnotationIds: ['risk-hotspot'],
              evidenceRoles: {
                'input-hotspot': 'input',
                'output-hotspot': 'output',
                'risk-hotspot': 'risk',
              },
              teachingLabels: {
                'input-hotspot': '输入信号',
                'output-hotspot': '输出响应',
                'risk-hotspot': '反馈风险',
              },
              feedback: {
                misconceptionTagIds: ['missed-risk-hotspot'],
              },
              serverRecordedAt: '2026-06-18T00:00:00.000Z',
            },
          },
        },
      },
    ]);

    const response = await GET(new NextRequest(
      'http://localhost/api/interactive/events?diagnostics=annotated-media&resourceKey=annotated-media-activity-fixture',
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.diagnostics).toMatchObject({
      viewedCount: 1,
      submittedCount: 1,
      selectedAnnotationDistribution: [
        { annotationId: 'input-hotspot', label: '输入信号', count: 1 },
        { annotationId: 'output-hotspot', label: '输出响应', count: 1 },
      ],
      omittedRequiredAnnotationDistribution: [
        { annotationId: 'risk-hotspot', label: '反馈风险', count: 1 },
      ],
    });

    mocks.getServerSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    const forbidden = await GET(new NextRequest(
      'http://localhost/api/interactive/events?diagnostics=annotated-media&resourceKey=annotated-media-activity-fixture',
    ));
    expect(forbidden.status).toBe(403);
  });
});
