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

  it('deduplicates repeated classroom submissions by session step and attempt identity before writing evidence', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-submit-a', clientEventId: 'client-submit-a', eventData: { clientEventId: 'client-submit-a' } },
    ]);
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 1, actionType: 'lesson_submit' });

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
      count: 1,
      duplicates: 1,
      submissionDuplicates: 1,
    });
    expect(mocks.prisma.interactionLog.createManyAndReturn).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({ clientEventId: 'client-submit-a' }),
      ],
    }));
    expect(mocks.prisma.studentStepResponse.createMany).toHaveBeenCalledWith(expect.objectContaining({
      data: [
        expect.objectContaining({
          clientEventId: 'client-submit-a',
          attemptKey: 'step-08:response:1778550421493',
        }),
      ],
    }));
    expect(mocks.routeEvent).toHaveBeenCalledTimes(1);
    expect(mocks.persistCoreLearningFact).toHaveBeenCalledTimes(1);
  });

  it('skips new classroom evidence when the same session step and attempt identity already exists', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        sessionId: 'cmoxloe52000uq5bcojma7r78',
        lessonKey: 'unit-4-4-fixed-structure-optimization-modeling-v1',
        stepId: 'step-08',
        attemptKey: 'step-08:response:1778550421493',
        responseData: {
          eventType: 'lesson_submit',
          cardId: 'weight-preference',
        },
      },
    ]);

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
      count: 0,
      duplicates: 1,
      submissionDuplicates: 1,
    });
    expect(mocks.prisma.interactionLog.createManyAndReturn).not.toHaveBeenCalled();
    expect(mocks.prisma.studentStepResponse.createMany).not.toHaveBeenCalled();
    expect(mocks.routeEvent).not.toHaveBeenCalled();
    expect(mocks.persistCoreLearningFact).not.toHaveBeenCalled();
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

  it('marks legacy lesson submissions as lower-quality evidence instead of full diagnostics', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-legacy-submit', clientEventId: 'client-legacy-submit', eventData: { clientEventId: 'client-legacy-submit' } },
    ]);
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
    expect(mocks.prisma.studentStepResponse.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          responseData: expect.objectContaining({
            eventType: 'lesson_submit',
            evidenceQuality: 'legacy-envelope',
            evidenceQualityReason: 'unsupported_legacy_envelope',
            evidenceSourceState: 'legacy-envelope',
          }),
        }),
      ],
      skipDuplicates: true,
    });
    expect(mocks.persistCoreLearningFact.mock.calls[0][1].payload).toMatchObject({
      evidenceQuality: 'legacy-envelope',
    });
  });

  it('preserves v2 evidence quality for immutable student step responses', async () => {
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'log-v2-submit', clientEventId: 'client-v2-submit', eventData: { clientEventId: 'client-v2-submit' } },
    ]);
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
    expect(mocks.prisma.studentStepResponse.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          responseData: expect.objectContaining({
            schemaVersion: 'manifest-submission-v2',
            evidenceQuality: 'rich',
            evidenceQualityReason: 'scoreable_objective_evidence',
            evidenceSourceState: 'manifest-submission-v2',
            answers: { boundary: 'A' },
          }),
        }),
      ],
      skipDuplicates: true,
    });
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

  it('materializes control workbench evidence with trusted source log fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T01:00:00.000Z'));
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'actual-workbench-log-id', clientEventId: 'client-workbench', eventData: { clientEventId: 'client-workbench' } },
    ]);

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
        selectedDesignState: null,
        derivedResultRefs: [],
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

    const createArg = mocks.prisma.studentStepResponse.createMany.mock.calls[0][0];
    expect(response.status).toBe(200);
    expect(createArg.data[0].responseData.controlWorkbenchEvidence).toMatchObject({
      sourceLogId: 'actual-workbench-log-id',
      lessonKey: 'unit-4-2-controller-selection-first-start-v1',
      payload: {
        capabilityId: 'control-frequency-reading-workbench',
        serverRecordedAt: '2026-06-18T01:00:00.000Z',
      },
    });
    vi.useRealTimers();
  });

  it('materializes annotated media evidence with trusted source log fields', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-18T01:00:00.000Z'));
    mocks.prisma.interactionLog.findMany.mockResolvedValue([]);
    mocks.prisma.interactionLog.createManyAndReturn.mockResolvedValue([
      { id: 'actual-annotated-media-log-id', clientEventId: 'client-annotated-media', eventData: { clientEventId: 'client-annotated-media' } },
    ]);

    const annotatedMediaDraft = {
      eventType: 'media_submit',
      clientEventId: 'client-annotated-media',
      attemptKey: 'step-05:response:1',
      lessonKey: 'annotated-media-activity-fixture',
      stepId: 'step-05',
      moduleId: 'annotated-media',
      componentKind: 'visual.annotatedMedia',
      componentId: 'closed-loop-media',
      actorRole: 'student',
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

    const createArg = mocks.prisma.studentStepResponse.createMany.mock.calls[0][0];
    expect(response.status).toBe(200);
    expect(createArg.data[0].responseData.annotatedMediaEvidence).toMatchObject({
      sourceLogId: 'actual-annotated-media-log-id',
      lessonKey: 'annotated-media-activity-fixture',
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
