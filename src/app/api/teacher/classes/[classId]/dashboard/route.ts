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
import { buildTeacherScopedLearningFactScopeFilters } from '@/lib/data-governance/teacher-evidence-governance';
import { CLASS_COMPETENCY_MATERIALIZATION_VERSION } from '@/lib/data-governance/class-scoped-learning-materialization';

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

    const classSessionIds = (await prisma.classSession.findMany({ where: { classId }, select: { id: true } })).map((row) => row.id);
    const currentEvidenceSince = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const classEvidence = await prisma.learningFact.findFirst({
      where: { startedAt: { gte: currentEvidenceSince }, OR: buildTeacherScopedLearningFactScopeFilters(classId, classSessionIds) },
      select: { id: true },
    });
    // Get latest class snapshot
    const snapshot = await prisma.classCompetencySnapshot.findFirst({
      where: { classId, materializationVersion: CLASS_COMPETENCY_MATERIALIZATION_VERSION },
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
        OR: buildTeacherScopedLearningFactScopeFilters(classId, classSessionIds),
      },
    });

    // Get risk summary
    const riskFlags: Array<{ flagType: string; severity: string }> = [];

    const riskSummary = riskFlags.reduce((acc, flag) => {
      acc[flag.flagType] = (acc[flag.flagType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const snapshotState = !classEvidence || (snapshot?.trendJson as any)?._derivation?.state === 'no-evidence' ? 'no-evidence' : 'ready';

    return NextResponse.json({
      class: {
        id: classId,
        name: classData.name,
        studentCount,
        activeToday: activeStudents.length,
      },
      competency: snapshot
        ? {
            state: snapshotState,
            activeStudentCount: snapshot.activeStudentCount,
            aggregate: snapshotState === 'no-evidence' ? null : snapshot.aggregateJson,
            distribution: snapshot.distributionJson,
            levelDistribution: snapshot.levelDistribution,
            lastUpdated: snapshot.snapshotAt,
          }
        : null,
      riskSummary: {
        totalFlags: snapshotState === 'no-evidence' ? 0 : riskFlags.length,
        byType: snapshotState === 'no-evidence' ? {} : riskSummary,
        highPriorityCount: snapshotState === 'no-evidence' ? 0 : riskFlags.filter(f => f.severity === 'high').length,
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
