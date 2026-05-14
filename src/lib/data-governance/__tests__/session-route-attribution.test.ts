import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    classSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    class: {
      findMany: vi.fn(),
    },
  },
  redisClient: {
    isReady: vi.fn(),
    setSessionState: vi.fn(),
    publishStateChange: vi.fn(),
  },
  classroomRateLimiter: {
    check: vi.fn(),
  },
  logClassroomEvent: vi.fn(),
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

vi.mock('@/lib/redis-client', () => ({
  redisClient: mocks.redisClient,
}));

vi.mock('@/lib/rate-limiter', () => ({
  classroomRateLimiter: mocks.classroomRateLimiter,
}));

vi.mock('@/lib/classroom-observability', () => ({
  logClassroomEvent: mocks.logClassroomEvent,
}));

vi.mock('@/lib/nextjs-dynamic-error', () => ({
  rethrowIfNextDynamicError: vi.fn(),
}));

import { PATCH } from '@/app/api/session/[sessionId]/route';

describe('PATCH /api/session/[sessionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({
      user: { id: 'teacher-1', role: 'TEACHER' },
    });
    mocks.classroomRateLimiter.check.mockReturnValue({ allowed: true });
    mocks.redisClient.isReady.mockReturnValue(false);
  });

  it('persists inferred class attribution when a direct-start session is finished', async () => {
    mocks.prisma.classSession.findUnique
      .mockResolvedValueOnce({
        teacherId: 'teacher-1',
        status: 'ACTIVE',
      })
      .mockResolvedValueOnce({
        classId: null,
        studentStates: [
          { user: { profile: { classId: 'class-2024' } } },
          { user: { profile: { classId: 'class-2024' } } },
          { user: { profile: { classId: 'class-2024' } } },
          { user: { profile: { classId: 'class-2024' } } },
          { user: { profile: { classId: 'class-2024' } } },
          { user: { profile: { classId: null } } },
        ],
      });
    mocks.prisma.classSession.update.mockResolvedValue({
      id: 'session-1',
      joinCode: '187470',
      planId: 'plan-1',
      teacherId: 'teacher-1',
      classId: null,
      status: 'FINISHED',
      currentStage: null,
      currentItemId: null,
      startTime: new Date('2026-04-28T00:24:02.789Z'),
      endTime: new Date('2026-04-28T02:03:12.410Z'),
      updatedAt: new Date('2026-04-28T02:03:12.410Z'),
    });
    mocks.prisma.class.findMany.mockResolvedValue([
      {
        id: 'class-2024',
        name: '2024自动化',
        code: 'AUTO2024',
        teacherId: 'teacher-1',
      },
    ]);
    mocks.prisma.classSession.updateMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(
      new Request('http://localhost/api/session/session-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINISHED' }),
      }),
      { params: { sessionId: 'session-1' } },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.classSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', classId: null },
      data: { classId: 'class-2024' },
    });
    expect(payload.classId).toBe('class-2024');
  });

  it('schedules student and class snapshots when a classroom session is finished', () => {
    const routeSource = readFileSync(join(process.cwd(), 'src/app/api/session/[sessionId]/route.ts'), 'utf8');

    expect(routeSource).toContain('enqueueSessionFinalizationSnapshots');
    expect(routeSource).toContain('enqueueSessionFinalizationEventIngestion');
    expect(routeSource).toContain('enqueueSessionSummaryReportRefresh');
    expect(routeSource).toContain("status === 'FINISHED'");
  });
});
