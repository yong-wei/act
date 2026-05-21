import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    learningFact: {
      findMany: vi.fn(),
    },
    studentStepResponse: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: mocks.getServerAuthSession,
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { GET } from '@/app/api/student/evidence/route';

describe('GET /api/student/evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({
      user: { id: 'student-1', role: 'STUDENT' },
    });
    mocks.prisma.learningFact.findMany.mockResolvedValue([
      {
        id: 'fact-5-2',
        userId: 'student-1',
        factType: 'question',
        moduleId: 'step-09',
        sessionId: 'session-1',
        startedAt: new Date('2026-05-21T08:00:00.000Z'),
        finishedAt: new Date('2026-05-21T08:05:00.000Z'),
        outcome: 'success',
        score: 88,
        timeSpent: 300,
        competencyContribution: { engineeringDecision: 0.8 },
        sourceEventId: 'event-1',
        sourceLogId: 'log-1',
        courseId: 'automatic-control',
        lessonId: 'unit-5-2-phase-plane-disturbance-boundary',
        contextJson: {},
        createdAt: new Date('2026-05-21T08:05:01.000Z'),
      },
    ]);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
  });

  it('uses the current student identity and returns a paginated evidence page', async () => {
    const response = await GET(new NextRequest(
      'http://localhost/api/student/evidence?lessonId=unit-5-2-phase-plane-disturbance-boundary&limit=10'
    ));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: 'student-1',
        lessonId: 'unit-5-2-phase-plane-disturbance-boundary',
      }),
    }));
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({
      id: 'fact-5-2',
      lessonId: 'unit-5-2-phase-plane-disturbance-boundary',
      startedAt: '2026-05-21T08:00:00.000Z',
    });
  });

  it('rejects unauthenticated requests', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await GET(new NextRequest('http://localhost/api/student/evidence'));

    expect(response.status).toBe(401);
    expect(mocks.prisma.learningFact.findMany).not.toHaveBeenCalled();
  });
});
