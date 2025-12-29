import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminSession } from '@/lib/admin';

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalStudents,
    totalTeachers,
    totalAdmins,
    newUsers7d,
    activeSessions,
    totalMissions,
    totalSimulations,
    totalLlmSessions,
    totalEthicalLogs,
    simulations7d,
    violations7d,
    recentViolations,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.session.count({ where: { expires: { gt: now } } }),
    prisma.mission.count(),
    prisma.simulationSession.count(),
    prisma.llmSession.count(),
    prisma.ethicalLog.count(),
    prisma.simulationSession.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.ethicalLog.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.ethicalLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            profile: {
              select: {
                studentNumber: true,
              },
            },
          },
        },
      },
    }),
  ]);

  return NextResponse.json({
    totals: {
      users: totalUsers,
      students: totalStudents,
      teachers: totalTeachers,
      admins: totalAdmins,
      missions: totalMissions,
      simulations: totalSimulations,
      llmSessions: totalLlmSessions,
      ethicalLogs: totalEthicalLogs,
    },
    activity: {
      newUsers7d,
      activeSessions,
      simulations7d,
      violations7d,
    },
    recentViolations: recentViolations.map((log) => ({
      id: log.id,
      violationType: log.violationType,
      createdAt: log.createdAt,
      isResolved: log.isResolved,
      student: {
        id: log.user.id,
        name: log.user.name,
        email: log.user.email,
        studentNumber: log.user.profile?.studentNumber ?? null,
      },
    })),
  });
}
