import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    studentStepResponse: { count: vi.fn(), findMany: vi.fn() },
    simulationLog: { count: vi.fn(), findMany: vi.fn() },
    ethicalLog: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));

import { GET } from '@/app/api/profile/portfolio-evidence/route';

describe('GET /api/profile/portfolio-evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.studentStepResponse.count.mockResolvedValue(1);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
    mocks.prisma.simulationLog.count.mockResolvedValue(0);
    mocks.prisma.simulationLog.findMany.mockResolvedValue([]);
    mocks.prisma.ethicalLog.count.mockResolvedValue(0);
    mocks.prisma.ethicalLog.findMany.mockResolvedValue([]);
  });

  it('requires authentication before reading any source', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.prisma.studentStepResponse.count).not.toHaveBeenCalled();
    expect(mocks.prisma.simulationLog.count).not.toHaveBeenCalled();
    expect(mocks.prisma.ethicalLog.count).not.toHaveBeenCalled();
  });

  it('uses the session user and reports empty and available sources separately', async () => {
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([
      {
        id: 'response-1',
        lessonKey: 'unit-1',
        stepId: 'step-1',
        submittedAt: new Date('2026-08-16T01:00:00.000Z'),
        responseData: { score: 80 },
        session: { plan: { title: '课堂练习' } },
      },
    ]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.classroom).toMatchObject({ state: 'available', total: 1 });
    expect(body.simulations).toMatchObject({ state: 'empty', total: 0, items: [] });
    expect(body.ethics).toMatchObject({ state: 'empty', total: 0, items: [] });
    expect(mocks.prisma.studentStepResponse.count).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
    expect(mocks.prisma.simulationLog.count).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
    expect(mocks.prisma.ethicalLog.count).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
  });

  it('marks only the failed source unavailable', async () => {
    mocks.prisma.studentStepResponse.count.mockResolvedValue(0);
    mocks.prisma.simulationLog.count.mockRejectedValue(new Error('simulation source unavailable'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.classroom.state).toBe('empty');
    expect(body.simulations).toMatchObject({ state: 'unavailable', total: null, items: [] });
    expect(body.ethics.state).toBe('empty');
  });
});
