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
    },
  },
  eventRateLimiter: {
    check: vi.fn(),
  },
  routeEvent: vi.fn(),
  persistCoreLearningFact: vi.fn(),
  generateSessionSummaryReports: vi.fn(),
  enqueueSessionSummaryReportRefresh: vi.fn(),
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

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { POST } from '../route';

function createPostRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/interactive/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/interactive/events', () => {
  beforeEach(() => {
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

  it('persists immutable student step responses for lesson submissions', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-submit', clientEventId: 'client-submit', eventData: { clientEventId: 'client-submit' } },
    ]);
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
    expect(mocks.prisma.studentStepResponse.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'student-1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          stepId: 'step-08',
          attemptKey: 'step-08:response:1778550421493',
          sourceLogId: 'log-submit',
          submittedAt: new Date('2026-05-12T01:46:42.900Z'),
          responseData: expect.objectContaining({
            answerDigest: { 'weight-preference': 'C' },
          }),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('does not block fact materialization when immutable step response persistence fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-submit', clientEventId: 'client-submit', eventData: { clientEventId: 'client-submit' } },
    ]);
    mocks.prisma.studentStepResponse.createMany.mockRejectedValue(new Error('step response write failed'));
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

    expect(response.status).toBe(200);
    expect(mocks.prisma.studentStepResponse.createMany).toHaveBeenCalled();
    expect(mocks.routeEvent).toHaveBeenCalledTimes(1);
    expect(mocks.persistCoreLearningFact).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(
      '[Interactive Events API] Failed to persist immutable student step responses:',
      expect.any(Error),
    );

    consoleError.mockRestore();
  });

  it('persists lesson resubmissions when the client event id is carried in the payload', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-resubmit', clientEventId: 'client-resubmit', eventData: { clientEventId: 'client-resubmit' } },
    ]);
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
    expect(mocks.prisma.studentStepResponse.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          userId: 'student-1',
          sessionId: 'cmoxloe52000uq5bcojma7r78',
          lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
          stepId: 'step-10',
          attemptKey: 'step-10:response:1778550642900',
          sourceLogId: 'log-resubmit',
          clientEventId: 'client-resubmit',
          responseData: expect.objectContaining({
            eventType: 'lesson_resubmit',
            answerDigest: { 'constraint-priority': 'B' },
          }),
        }),
      ],
      skipDuplicates: true,
    });
  });

  it('ignores forged client sourceLogId and uses the persisted interaction log id', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'actual-log-id', clientEventId: 'client-forged-source', eventData: { clientEventId: 'client-forged-source' } },
    ]);
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
              sourceLogId: 'forged-log-id',
              answerDigest: { 'weight-preference': 'C' },
            },
          },
        ],
      }));

    const learningEvent = mocks.persistCoreLearningFact.mock.calls[0][1];
    const persistedInteractionLogData = mocks.prisma.interactionLog.createManyAndReturn.mock.calls[0][0].data[0];

    expect(response.status).toBe(200);
    expect(persistedInteractionLogData.eventData).toEqual(expect.objectContaining({
      clientEventId: 'client-forged-source',
      eventType: 'lesson_submit',
    }));
    expect(persistedInteractionLogData.eventData).not.toHaveProperty('sourceLogId');
    expect(mocks.prisma.studentStepResponse.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceLogId: 'actual-log-id',
          responseData: expect.objectContaining({
            sourceLogId: 'actual-log-id',
          }),
        }),
      ],
      skipDuplicates: true,
    });
    expect(learningEvent.payload).toMatchObject({
      sourceLogId: 'actual-log-id',
    });
    expect(learningEvent.payload.sourceLogId).not.toBe('forged-log-id');
  });
});
