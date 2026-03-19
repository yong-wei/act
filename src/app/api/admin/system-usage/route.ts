import { NextResponse } from 'next/server';

import { requireAdminSession } from '@/lib/admin';
import { prisma } from '@/lib/prisma';
import { buildSystemUsageData } from '@/features/admin/states/system-usage-data';

export async function GET() {
  const session = await requireAdminSession();

  if (!session) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const [
    students,
    teachers,
    admins,
    interactionLogs,
    simulationSessions,
    simulationLogs,
    learningFacts,
    llmSessions,
    ethicalLogCount,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'STUDENT' } }),
    prisma.user.count({ where: { role: 'TEACHER' } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.interactionLog.findMany({
      where: { createdAt: { gte: start } },
      select: {
        userId: true,
        eventType: true,
        resourceKey: true,
        lessonKey: true,
        createdAt: true,
      },
    }),
    prisma.simulationSession.findMany({
      where: { createdAt: { gte: start } },
      select: {
        userId: true,
        simType: true,
        createdAt: true,
      },
    }),
    prisma.simulationLog.findMany({
      where: { createdAt: { gte: start } },
      select: {
        duration: true,
        inputParams: true,
        createdAt: true,
      },
    }),
    prisma.learningFact.findMany({
      where: { createdAt: { gte: start } },
      select: {
        factType: true,
        outcome: true,
        createdAt: true,
      },
    }),
    prisma.llmSession.findMany({
      where: { createdAt: { gte: start } },
      select: {
        userId: true,
        module: true,
        createdAt: true,
      },
    }),
    prisma.ethicalLog.count({
      where: { createdAt: { gte: start } },
    }),
  ]);

  const payload = buildSystemUsageData({
    now,
    users: {
      students,
      teachers,
      admins,
    },
    interactionLogs,
    simulationSessions,
    simulationLogs,
    learningFacts,
    llmSessions,
    ethicalLogCount,
  });

  return NextResponse.json(payload);
}
