import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerAuthSession: vi.fn(),
  prisma: {
    growthRecord: { findMany: vi.fn(), count: vi.fn() },
    learningMilestone: { findMany: vi.fn() },
    simulationLog: { findMany: vi.fn() },
    studentRiskFlag: { findMany: vi.fn() },
    achievement: { findMany: vi.fn() },
    learningFact: { findMany: vi.fn() },
  },
}));

vi.mock('@/lib/auth', () => ({ getServerAuthSession: mocks.getServerAuthSession }));
vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/nextjs-dynamic-error', () => ({ rethrowIfNextDynamicError: vi.fn() }));

import { GET } from '@/app/api/student/growth-records/route';

describe('student growth records route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerAuthSession.mockResolvedValue({ user: { id: 'student-1' } });
    mocks.prisma.growthRecord.findMany.mockResolvedValue([]);
    mocks.prisma.growthRecord.count.mockResolvedValue(0);
    mocks.prisma.learningMilestone.findMany.mockResolvedValue([]);
    mocks.prisma.simulationLog.findMany.mockResolvedValue([]);
    mocks.prisma.studentRiskFlag.findMany.mockResolvedValue([]);
    mocks.prisma.achievement.findMany.mockResolvedValue([]);
  });

  it('projects a generic learning activity when historical facts have no growth record', async () => {
    mocks.prisma.learningFact.findMany.mockResolvedValue([{
      id: 'context-only-fact',
      startedAt: new Date('2026-05-01T08:00:00.000Z'),
    }]);

    const response = await GET(new NextRequest('http://localhost/api/student/growth-records?limit=10'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      records: [{
        id: 'learning-activity-context-only-fact',
        type: 'learning_activity',
        title: '已记录学习活动',
        description: '系统已记录一项学习活动；该活动暂未形成可展示的能力画像证据。',
        date: '2026-05-01T08:00:00.000Z',
        metadata: { source: 'learning-fact' },
        icon: 'BookOpen',
      }],
      total: 1,
      hasMore: false,
    });
    expect(mocks.prisma.learningFact.findMany).toHaveBeenCalledWith({
      where: { userId: 'student-1' },
      select: { id: true, startedAt: true },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });
  });
});
