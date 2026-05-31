/**
 * Risk Students API
 *
 * Returns at-risk students with their risk flags for teacher intervention.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ classId: string }> }) {
  const params = await props.params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { classId } = params;
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') || undefined;
    const unresolvedOnly = searchParams.get('unresolved') === 'true';

    // Verify teacher
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true },
    });

    if (!classData || (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get students in class
    const students = await prisma.studentProfile.findMany({
      where: { classId },
      select: { userId: true },
    });

    const studentIds = students.map(s => s.userId);

    // Get risk flags
    const where: Prisma.StudentRiskFlagWhereInput = {
      userId: { in: studentIds },
    };

    if (severity) {
      where.severity = severity;
    }

    if (unresolvedOnly) {
      where.isResolved = false;
    }

    const riskFlags = await prisma.studentRiskFlag.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { triggeredAt: 'desc' },
    });

    // Group by student
    const byStudent = riskFlags.reduce((acc, flag) => {
      if (!acc[flag.userId]) {
        acc[flag.userId] = {
          userId: flag.userId,
          name: flag.user.name,
          avatar: flag.user.image,
          riskFlags: [],
        };
      }
      acc[flag.userId].riskFlags.push({
        type: flag.flagType,
        severity: flag.severity,
        description: flag.description,
        triggeredAt: flag.triggeredAt.toISOString(),
        isResolved: flag.isResolved,
      });
      return acc;
    }, {} as Record<string, { userId: string; name: string | null; avatar: string | null; riskFlags: Array<{ type: string; severity: string; description: string; triggeredAt: string; isResolved: boolean }> }>);

    const students_list = Object.values(byStudent).map((s) => ({
      userId: s.userId,
      name: s.name,
      avatar: s.avatar,
      riskFlags: s.riskFlags,
      overallRisk: calculateOverallRisk(s.riskFlags),
    }));

    return NextResponse.json({ students: students_list });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[RiskStudents] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function calculateOverallRisk(flags: Array<{ severity: string }>): string {
  if (flags.some(f => f.severity === 'high')) return 'high';
  if (flags.some(f => f.severity === 'medium')) return 'medium';
  return 'low';
}
