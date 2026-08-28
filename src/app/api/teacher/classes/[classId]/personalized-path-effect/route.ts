import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  evaluatePersonalizedPathEffects,
  recordsFromPathAndBatchSources,
} from '@/lib/personalized-path-effect-evaluation';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }
    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { classId } = await params;
    const requestedGoalId = new URL(request.url).searchParams.get('goalId')?.trim() || null;
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        teacherId: true,
        students: { select: { userId: true } },
      },
    });
    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    if (session.user.role !== 'ADMIN' && classData.teacherId !== session.user.id) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const studentIds = classData.students.map((student) => student.userId);
    const [paths, batches] = studentIds.length
      ? await Promise.all([
        prisma.learningPath.findMany({
          where: { classId, userId: { in: studentIds } },
          orderBy: { createdAt: 'asc' },
          include: { executions: { orderBy: { createdAt: 'asc' } } },
        }),
        prisma.adaptivePathCandidateBatch.findMany({
          where: { classId, userId: { in: studentIds } },
          orderBy: { createdAt: 'desc' },
          include: { candidates: { orderBy: { ordinal: 'asc' } } },
        }),
      ])
      : [[], []];

    const records = recordsFromPathAndBatchSources({ paths, batches });
    const goalCounts = new Map<string, number>();
    for (const record of records) {
      goalCounts.set(record.goalId, (goalCounts.get(record.goalId) ?? 0) + 1);
    }
    const defaultGoalId = [...goalCounts.entries()]
      .sort((left, right) => right[1] - left[1])[0]?.[0]
      ?? 'control-correction';
    const goalId = requestedGoalId ?? defaultGoalId;

    const evaluation = evaluatePersonalizedPathEffects({
      classId,
      goalId,
      evaluatedAt: new Date().toISOString(),
      records,
    });
    return NextResponse.json({ evaluation });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse('个性化路径效果评估');
    }
    console.error('[PersonalizedPathEffectEvaluation] Error:', error);
    return NextResponse.json({ error: '读取个性化路径效果评估失败' }, { status: 500 });
  }
}
