import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { isRegisteredAdaptiveLearningPathGoal } from '@/lib/adaptive-learning-path-planner';
import {
  readControlCorrectionPathRound,
  toControlCorrectionPathRoundView,
} from '@/lib/control-correction-path-rounds';
import {
  assertCanReadPath,
  ensureControlCorrectionPathRoutesEnabled,
  getLearningPathRequester,
  type LearningPathRequester,
} from '../route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const featureDisabled = ensureControlCorrectionPathRoutesEnabled();
    if (featureDisabled) return featureDisabled;

    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;

    const url = new URL(request.url);
    const goalId = url.searchParams.get('goal');
    const requestedUserId = url.searchParams.get('userId') || requester.userId;
    if (!goalId || !isRegisteredAdaptiveLearningPathGoal(goalId)) {
      return NextResponse.json({ error: '学习路径目标未注册' }, { status: 400 });
    }
    if (requester.role === 'student' && requestedUserId !== requester.userId) {
      return NextResponse.json({ error: '无权访问该学习路径' }, { status: 403 });
    }
    const authorizedClassId = await resolveLatestPathClassScope(requester, requestedUserId);
    if (authorizedClassId instanceof NextResponse) return authorizedClassId;

    const latest = await prisma.learningPath.findFirst({
      where: {
        userId: requestedUserId,
        goalId,
        isAiGenerated: true,
        pathStatus: { in: ['active', 'fallback', 'completed'] },
        ...(authorizedClassId ? { classId: authorizedClassId } : {}),
      },
      select: {
        id: true,
        userId: true,
        classId: true,
        goalId: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
    if (!latest) {
      return NextResponse.json({ path: null });
    }

    const denied = await assertCanReadPath(requester, latest);
    if (denied) return denied;

    const round = await readControlCorrectionPathRound(prisma as any, {
      pathId: latest.id,
      userId: latest.userId,
    });

    return NextResponse.json({ path: toControlCorrectionPathRoundView(round) });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathLatest] Error:', error);
    return NextResponse.json({ error: '读取最新学习路径失败' }, { status: 500 });
  }
}

async function resolveLatestPathClassScope(
  requester: LearningPathRequester,
  requestedUserId: string,
): Promise<string | null | NextResponse> {
  if (requester.role === 'admin' || requester.userId === requestedUserId) return null;
  if (requester.role !== 'teacher') {
    return NextResponse.json({ error: '无权访问该学习路径' }, { status: 403 });
  }

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: requestedUserId },
    select: { userId: true, classId: true },
  });
  if (!profile?.classId) {
    return NextResponse.json({ error: '无权访问该学习路径' }, { status: 403 });
  }

  const classData = await prisma.class.findUnique({
    where: { id: profile.classId },
    select: { id: true, teacherId: true },
  });
  if (!classData || classData.teacherId !== requester.userId) {
    return NextResponse.json({ error: '无权访问该学习路径' }, { status: 403 });
  }

  return profile.classId;
}
