/**
 * Teacher Dashboard API
 *
 * Provides class-level analytics from pre-calculated snapshots.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ classId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = params;

    // Verify teacher owns this class
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true, name: true },
    });

    if (!classData) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const isTeacher = classData.teacherId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isTeacher && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get latest class snapshot
    const snapshot = await prisma.classCompetencySnapshot.findFirst({
      where: { classId },
      orderBy: { snapshotAt: 'desc' },
    });

    // Get student count
    const studentCount = await prisma.studentProfile.count({
      where: { classId },
    });

    // Get active students (had activity in last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const activeStudents = await prisma.learningFact.groupBy({
      by: ['userId'],
      where: {
        userId: {
          in: await prisma.studentProfile
            .findMany({ where: { classId }, select: { userId: true } })
            .then(profiles => profiles.map(p => p.userId)),
        },
        startedAt: { gte: sevenDaysAgo },
      },
    });

    // Get risk summary
    const riskFlags = await prisma.studentRiskFlag.findMany({
      where: {
        userId: {
          in: await prisma.studentProfile
            .findMany({ where: { classId }, select: { userId: true } })
            .then(profiles => profiles.map(p => p.userId)),
        },
        isResolved: false,
      },
    });

    const riskSummary = riskFlags.reduce((acc, flag) => {
      acc[flag.flagType] = (acc[flag.flagType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      class: {
        id: classId,
        name: classData.name,
        studentCount,
        activeToday: activeStudents.length,
      },
      competency: snapshot
        ? {
            aggregate: snapshot.aggregateJson,
            distribution: snapshot.distributionJson,
            levelDistribution: snapshot.levelDistribution,
            lastUpdated: snapshot.snapshotAt,
          }
        : null,
      riskSummary: {
        totalFlags: riskFlags.length,
        byType: riskSummary,
        highPriorityCount: riskFlags.filter(f => f.severity === 'high').length,
      },
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[TeacherDashboard] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
