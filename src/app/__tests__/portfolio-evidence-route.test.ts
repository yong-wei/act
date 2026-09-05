import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    studentStepResponse: { count: vi.fn(), findMany: vi.fn() },
    simulationRun: { findMany: vi.fn() },
    simulationLog: { findMany: vi.fn() },
    ethicalLog: { count: vi.fn(), findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));

import { GET } from '@/app/api/profile/portfolio-evidence/route';

function canonicalRunRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    ownerUserId: 'student-1',
    runKind: 'scene_simulation',
    sourceDomain: 'simulation_scene',
    sourceRefId: 'control-workbench:hash-1',
    resourceId: null,
    status: 'completed',
    summary: {
      metrics: { score: 88, duration: 120, valid: true },
      evaluation: { passed: true, meetsQualityTarget: true },
      qualityTargetMet: true,
      runContract: { evaluationVisibility: 'preview', officialEligible: false },
    },
    completedAt: new Date('2026-09-01T00:00:00.000Z'),
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('GET /api/profile/portfolio-evidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.studentStepResponse.count.mockResolvedValue(1);
    mocks.prisma.studentStepResponse.findMany.mockResolvedValue([]);
    mocks.prisma.simulationRun.findMany.mockResolvedValue([]);
    mocks.prisma.simulationLog.findMany.mockResolvedValue([]);
    mocks.prisma.ethicalLog.count.mockResolvedValue(0);
    mocks.prisma.ethicalLog.findMany.mockResolvedValue([]);
  });

  it('requires authentication before reading any source', async () => {
    mocks.getServerAuthSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mocks.prisma.studentStepResponse.count).not.toHaveBeenCalled();
    expect(mocks.prisma.simulationRun.findMany).not.toHaveBeenCalled();
    expect(mocks.prisma.simulationLog.findMany).not.toHaveBeenCalled();
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
    expect(mocks.prisma.simulationRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ ownerUserId: 'student-1' }),
    }));
    expect(mocks.prisma.simulationLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'student-1' },
    }));
    expect(mocks.prisma.ethicalLog.count).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
  });

  it('projects canonical runs into simulation designs with the shared projection', async () => {
    mocks.prisma.simulationRun.findMany.mockResolvedValue([canonicalRunRow()]);

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.simulations).toMatchObject({
      state: 'available',
      total: 1,
      items: [
        expect.objectContaining({
          id: 'simulation-run:run-1',
          name: '控制工作台分析',
          score: 88,
          createdAt: '2026-09-01T00:00:00.000Z',
        }),
      ],
    });
  });

  it('marks only the failed simulation source unavailable', async () => {
    mocks.prisma.studentStepResponse.count.mockResolvedValue(0);
    mocks.prisma.simulationRun.findMany.mockRejectedValue(new Error('simulation source unavailable'));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.classroom.state).toBe('empty');
    expect(body.simulations).toMatchObject({ state: 'unavailable', total: null, items: [] });
    expect(body.ethics.state).toBe('empty');
  });
});
