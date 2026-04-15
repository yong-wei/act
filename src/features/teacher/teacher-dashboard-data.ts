import { UserRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { isDatabaseConnectivityError } from '@/lib/service-availability';

export type TeacherDashboardMode = 'ready' | 'degraded';

export interface TeacherDashboardUser {
  id: string;
  role: UserRole;
  name?: string | null;
  email?: string | null;
}

export interface TeacherDashboardData {
  mode: TeacherDashboardMode;
  stats: {
    totalClasses: number;
    totalStudents: number;
    totalPlans: number;
    activeSessions: number;
    finishedSessions: number;
  };
  recentClasses: Array<{
    id: string;
    name: string;
    code: string;
    studentCount: number;
    createdAt: string;
  }>;
  recentPlans: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  activeSessions: Array<{
    id: string;
    planTitle: string;
    joinCode: string;
    studentCount: number;
    className?: string;
    classId?: string;
  }>;
}

const EMPTY_DASHBOARD_DATA: TeacherDashboardData = {
  mode: 'degraded',
  stats: {
    totalClasses: 0,
    totalStudents: 0,
    totalPlans: 0,
    activeSessions: 0,
    finishedSessions: 0,
  },
  recentClasses: [],
  recentPlans: [],
  activeSessions: [],
};

const DASHBOARD_CONNECTIVITY_RETRY_ATTEMPTS = 3;
const DASHBOARD_CONNECTIVITY_RETRY_DELAY_MS = 250;

function getSettledValue<T>(result: PromiseSettledResult<T>): T {
  if (result.status !== 'fulfilled') {
    throw result.reason;
  }

  return result.value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchTeacherDashboardResults(user: TeacherDashboardUser) {
  return Promise.allSettled([
    prisma.class.findMany({
      where: { teacherId: user.id },
      include: {
        _count: { select: { students: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.lessonPlan.findMany({
      where: { authorId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.classSession.findMany({
      where: {
        teacherId: user.id,
        status: 'ACTIVE',
      },
      include: {
        plan: { select: { title: true } },
        class: { select: { id: true, name: true } },
        _count: { select: { studentStates: true } },
      },
    }),
    prisma.classSession.count({
      where: {
        teacherId: user.id,
        status: 'FINISHED',
      },
    }),
    prisma.class.count({
      where: { teacherId: user.id },
    }),
    prisma.studentProfile.count({
      where: {
        class: { teacherId: user.id },
      },
    }),
    prisma.lessonPlan.count({
      where: { authorId: user.id },
    }),
  ]);
}

export async function loadTeacherDashboardData(user: TeacherDashboardUser): Promise<TeacherDashboardData> {
  for (let attempt = 1; attempt <= DASHBOARD_CONNECTIVITY_RETRY_ATTEMPTS; attempt += 1) {
    const results = await fetchTeacherDashboardResults(user);

    const connectivityFailure = results.find(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected' && isDatabaseConnectivityError(result.reason)
    );

    if (!connectivityFailure) {
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected && rejected.status === 'rejected') {
        throw rejected.reason;
      }

      const classes = getSettledValue(results[0]);
      const lessonPlans = getSettledValue(results[1]);
      const activeSessions = getSettledValue(results[2]);
      const finishedSessions = getSettledValue(results[3]);
      const totalClasses = getSettledValue(results[4]);
      const totalStudents = getSettledValue(results[5]);
      const totalPlans = getSettledValue(results[6]);

      return {
        mode: 'ready',
        stats: {
          totalClasses,
          totalStudents,
          totalPlans,
          activeSessions: activeSessions.length,
          finishedSessions,
        },
        recentClasses: classes.map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          studentCount: item._count.students,
          createdAt: item.createdAt.toISOString(),
        })),
        recentPlans: lessonPlans.map((item) => ({
          id: item.id,
          title: item.title,
          updatedAt: item.updatedAt.toISOString(),
        })),
        activeSessions: activeSessions.map((item) => ({
          id: item.id,
          planTitle: item.plan.title,
          joinCode: item.joinCode,
          studentCount: item._count.studentStates,
          className: item.class?.name,
          classId: item.class?.id,
        })),
      };
    }

    if (attempt < DASHBOARD_CONNECTIVITY_RETRY_ATTEMPTS) {
      await sleep(DASHBOARD_CONNECTIVITY_RETRY_DELAY_MS * attempt);
      continue;
    }

    console.error('[TeacherDashboard] Database unavailable, returning degraded payload', {
      userId: user.id,
      role: user.role,
      reason: connectivityFailure.reason,
      attempts: attempt,
    });
    return EMPTY_DASHBOARD_DATA;
  }

  return EMPTY_DASHBOARD_DATA;
}
