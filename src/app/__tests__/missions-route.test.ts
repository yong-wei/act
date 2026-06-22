import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GET } from '../api/missions/route';

const mocks = vi.hoisted(() => ({
  missionFindMany: vi.fn(),
  userProgressFindMany: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getServerAuthSession: vi.fn(async () => ({ user: { id: 'student-1' } })),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    mission: {
      findMany: mocks.missionFindMany,
    },
    userProgress: {
      findMany: mocks.userProgressFindMany,
    },
  },
}));

function mission(order: number) {
  return {
    id: `mission-${order}`,
    title: `任务 ${order}`,
    description: null,
    difficulty: 'MEDIUM',
    order,
    objectives: [],
    seaStateConfig: {},
    unlockCriteria: {},
  };
}

function request(query: string) {
  return new Request(`http://localhost/api/missions${query}`);
}

describe('/api/missions feedback scope', () => {
  beforeEach(() => {
    mocks.missionFindMany.mockReset();
    mocks.userProgressFindMany.mockReset();
    mocks.missionFindMany.mockResolvedValue([1, 2, 3, 4].map(mission));
    mocks.userProgressFindMany.mockResolvedValue([]);
  });

  it('unlocks the first targeted mission for dynamic document feedback assignments', async () => {
    const response = await GET(request(
      '?assignment=report-1&criterion=validation&source=document-feedback&status=returned',
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feedbackTask).toMatchObject({
      assignmentId: 'report-1',
      criterionId: 'validation',
      source: 'document-feedback',
      supported: true,
    });
    expect(body.feedbackMissionTarget).toMatchObject({
      missionOrders: [2, 3, 4],
    });
    expect(body.missions.map((item: { order: number }) => item.order)).toEqual([2, 3, 4]);
    expect(body.missions[0]).toMatchObject({
      order: 2,
      status: 'UNLOCKED',
    });
    expect(body.statistics.unlocked).toBe(1);
  });

  it('does not scope unknown non-document feedback assignments to mission targets', async () => {
    const response = await GET(request(
      '?assignment=report-1&criterion=validation&source=batch59&status=returned',
    ));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feedbackTask).toMatchObject({
      assignmentId: 'report-1',
      supported: false,
      lifecycleState: 'missing',
    });
    expect(body.feedbackMissionTarget).toBeNull();
    expect(body.missions).toEqual([]);
    expect(body.statistics.total).toBe(0);
  });

  it('keeps the normal unscoped mission hall unlocked from the first mission only', async () => {
    const response = await GET(request(''));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feedbackTask).toBeNull();
    expect(body.missions.map((item: { order: number; status: string }) => ({
      order: item.order,
      status: item.status,
    }))).toEqual([
      { order: 1, status: 'UNLOCKED' },
      { order: 2, status: 'LOCKED' },
      { order: 3, status: 'LOCKED' },
      { order: 4, status: 'LOCKED' },
    ]);
    expect(body.statistics).toMatchObject({
      total: 4,
      unlocked: 1,
    });
  });
});
