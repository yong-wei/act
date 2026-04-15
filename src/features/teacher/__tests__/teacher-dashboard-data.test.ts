import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '@prisma/client';

const mocks = vi.hoisted(() => ({
  prisma: {
    class: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    lessonPlan: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    classSession: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    studentProfile: {
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: mocks.prisma,
}));

import { loadTeacherDashboardData } from '../teacher-dashboard-data';

describe('teacher dashboard server data', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.prisma.class.findMany.mockResolvedValue([]);
    mocks.prisma.lessonPlan.findMany.mockResolvedValue([]);
    mocks.prisma.classSession.findMany.mockResolvedValue([]);
    mocks.prisma.classSession.count.mockResolvedValue(0);
    mocks.prisma.class.count.mockResolvedValue(0);
    mocks.prisma.studentProfile.count.mockResolvedValue(0);
    mocks.prisma.lessonPlan.count.mockResolvedValue(0);
  });

  it('retries transient database connectivity failures before recovering the dashboard payload', async () => {
    mocks.prisma.class.findMany
      .mockRejectedValueOnce(
        Object.assign(new Error('db offline'), {
          code: 'P1001',
          name: 'PrismaClientKnownRequestError',
        })
      )
      .mockResolvedValueOnce([]);
    mocks.prisma.lessonPlan.findMany
      .mockRejectedValueOnce(
        Object.assign(new Error('db offline'), {
          code: 'P1001',
          name: 'PrismaClientKnownRequestError',
        })
      )
      .mockResolvedValueOnce([]);
    mocks.prisma.classSession.findMany
      .mockRejectedValueOnce(
        Object.assign(new Error('db offline'), {
          code: 'P1001',
          name: 'PrismaClientKnownRequestError',
        })
      )
      .mockResolvedValueOnce([]);
    mocks.prisma.classSession.count
      .mockRejectedValueOnce(
        Object.assign(new Error('db offline'), {
          code: 'P1001',
          name: 'PrismaClientKnownRequestError',
        })
      )
      .mockResolvedValueOnce(0);
    mocks.prisma.class.count
      .mockRejectedValueOnce(
        Object.assign(new Error('db offline'), {
          code: 'P1001',
          name: 'PrismaClientKnownRequestError',
        })
      )
      .mockResolvedValueOnce(0);
    mocks.prisma.studentProfile.count
      .mockRejectedValueOnce(
        Object.assign(new Error('db offline'), {
          code: 'P1001',
          name: 'PrismaClientKnownRequestError',
        })
      )
      .mockResolvedValueOnce(0);
    mocks.prisma.lessonPlan.count
      .mockRejectedValueOnce(
        Object.assign(new Error('db offline'), {
          code: 'P1001',
          name: 'PrismaClientKnownRequestError',
        })
      )
      .mockResolvedValueOnce(0);

    const result = await loadTeacherDashboardData({
      id: 'teacher-1',
      role: UserRole.TEACHER,
      name: '李老师',
      email: 'teacher@example.com',
    });

    expect(result.mode).toBe('ready');
    expect(mocks.prisma.class.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.lessonPlan.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.classSession.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.classSession.count).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.class.count).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.studentProfile.count).toHaveBeenCalledTimes(2);
    expect(mocks.prisma.lessonPlan.count).toHaveBeenCalledTimes(2);
  });

  it('falls back to a degraded dashboard payload when prisma cannot reach the database', async () => {
    mocks.prisma.lessonPlan.findMany.mockRejectedValue(
      Object.assign(new Error('db offline'), {
        code: 'P1001',
        name: 'PrismaClientKnownRequestError',
      })
    );

    const result = await loadTeacherDashboardData({
      id: 'teacher-1',
      role: UserRole.TEACHER,
      name: '李老师',
      email: 'teacher@example.com',
    });

    expect(result.mode).toBe('degraded');
    expect(result.stats).toEqual({
      totalClasses: 0,
      totalStudents: 0,
      totalPlans: 0,
      activeSessions: 0,
      finishedSessions: 0,
    });
    expect(result.recentClasses).toEqual([]);
    expect(result.recentPlans).toEqual([]);
    expect(result.activeSessions).toEqual([]);
    expect(mocks.prisma.lessonPlan.findMany).toHaveBeenCalledTimes(3);
  });

  it('does not swallow non-connectivity failures', async () => {
    const error = new Error('unexpected');
    mocks.prisma.lessonPlan.findMany.mockRejectedValue(error);

    await expect(
      loadTeacherDashboardData({
        id: 'teacher-1',
        role: UserRole.TEACHER,
        name: '李老师',
        email: 'teacher@example.com',
      })
    ).rejects.toBe(error);

    expect(mocks.prisma.lessonPlan.findMany).toHaveBeenCalledTimes(1);
  });
});
