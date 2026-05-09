import { beforeEach, describe, expect, it, vi } from 'vitest';

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
  },
  eventRateLimiter: {
    check: vi.fn(),
  },
  routeEvent: vi.fn(),
  persistCoreLearningFact: vi.fn(),
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

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { POST } from '../route';

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
    mocks.routeEvent.mockResolvedValue({ destination: 'postgresql' });
    mocks.persistCoreLearningFact.mockResolvedValue({ created: 0, actionType: 'page_view' });
  });

  it('deduplicates client events and removes invalid session ids before writing logs', async () => {
    const response = await POST(new Request('http://localhost/api/interactive/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
      }),
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
  });
});
