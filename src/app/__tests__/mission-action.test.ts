import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  prisma: {
    mission: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    userProgress: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    simulationLog: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    studentProfile: {
      upsert: vi.fn(),
    },
  },
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

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { completeMission, initializeUserProgress } from '../actions/mission';

describe('mission server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getServerSession.mockResolvedValue({ user: { id: 'student-1', role: 'STUDENT' } });
    mocks.prisma.mission.findUnique.mockResolvedValue({
      id: 'mission-1',
      order: 1,
      difficulty: 'EASY',
    });
    mocks.prisma.userProgress.findUnique.mockResolvedValue({
      userId: 'student-1',
      missionId: 'mission-1',
      status: 'UNLOCKED',
      bestScore: 60,
      completedAt: null,
    });
    mocks.prisma.simulationLog.findFirst.mockResolvedValue({ id: 'log-1' });
    mocks.prisma.mission.findMany.mockResolvedValue([]);
    mocks.prisma.userProgress.upsert.mockResolvedValue({});
    mocks.prisma.studentProfile.upsert.mockResolvedValue({});
  });

  it('rejects unauthenticated completion before reading mission state', async () => {
    mocks.getServerSession.mockResolvedValueOnce(null);

    const result = await completeMission('mission-1', 90);

    expect(result).toEqual({ success: false, message: '未授权' });
    expect(mocks.prisma.mission.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.userProgress.upsert).not.toHaveBeenCalled();
  });

  it('denies simulation log association outside the authenticated user scope', async () => {
    mocks.prisma.simulationLog.findFirst.mockResolvedValueOnce(null);

    const result = await completeMission('mission-1', 90, 'other-log');

    expect(result).toEqual({ success: false, message: '无权关联该仿真记录' });
    expect(mocks.prisma.simulationLog.findFirst).toHaveBeenCalledWith({
      where: { id: 'other-log', userId: 'student-1' },
      select: { id: true },
    });
    expect(mocks.prisma.userProgress.upsert).not.toHaveBeenCalled();
    expect(mocks.prisma.simulationLog.update).not.toHaveBeenCalled();
  });

  it('does not initialize another user progress from a student action session', async () => {
    await initializeUserProgress('student-2');

    expect(mocks.prisma.userProgress.findFirst).not.toHaveBeenCalled();
    expect(mocks.prisma.userProgress.create).not.toHaveBeenCalled();
  });

  it('allows admins to initialize a target user progress record', async () => {
    mocks.getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } });
    mocks.prisma.userProgress.findFirst.mockResolvedValueOnce(null);
    mocks.prisma.mission.findFirst.mockResolvedValueOnce({ id: 'first-mission' });

    await initializeUserProgress('student-2');

    expect(mocks.prisma.userProgress.create).toHaveBeenCalledWith({
      data: {
        userId: 'student-2',
        missionId: 'first-mission',
        status: 'UNLOCKED',
      },
    });
  });
});
