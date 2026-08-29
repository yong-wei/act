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
    sessionClosureOutbox: {
      create: vi.fn().mockResolvedValue({}),
    },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
    $transaction: vi.fn(),
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
    mocks.prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(mocks.prisma));
  });

  it('keeps a classless direct-start session unattributed when it is finished', async () => {
    mocks.prisma.classSession.findUnique
      // 授权读取
      .mockResolvedValueOnce({ teacherId: 'teacher-1', status: 'ACTIVE' })
      // end 事务内的会话锁读取
      .mockResolvedValueOnce({
        status: 'ACTIVE',
        submissionSequence: 0n,
        closureRevision: 0,
        acceptedSubmissionWatermark: null,
      })
      // 事务后的可读会话读取
      .mockResolvedValueOnce({
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
        plan: { title: 'Plan' },
        class: null,
      });
    const response = await PATCH(
      new Request('http://localhost/api/session/session-1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'FINISHED' }),
      }),
      { params: Promise.resolve({ sessionId: 'session-1' }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.prisma.classSession.updateMany).not.toHaveBeenCalled();
    expect(payload.classId).toBeNull();
  });

  it('uses event ingestion instead of direct snapshot jobs when a classroom session is finished', () => {
    const commandSource = readFileSync(join(process.cwd(), 'src/features/classroom/session/adapters/lifecycle-commands.ts'), 'utf8');
    const applicationSource = readFileSync(join(process.cwd(), 'src/features/classroom/session/application/lifecycle.ts'), 'utf8');

    expect(commandSource).not.toContain('enqueueSessionFinalizationSnapshots');
    expect(commandSource).toContain('enqueueSessionFinalizationEventIngestion');
    expect(commandSource).toContain('enqueueSessionSummaryReportRefresh');
    expect(applicationSource).toContain("input.status === 'FINISHED'");
  });
});
