import { NextResponse } from 'next/server';

import { isRegisteredAdaptiveLearningPathGoal } from '@/lib/adaptive-learning-path-planner';
import { readLatestAdaptivePathCandidateBatch } from '@/lib/adaptive-path-candidate-batches';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { getLearningPathRequester } from '../../route-helpers';
import {
  attachCandidateBatchSourcePathVersion,
  resolveCandidateBatchClassScope,
} from '../route-helpers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const url = new URL(request.url);
    const goalId = url.searchParams.get('goal') ?? '';
    const requestedUserId = url.searchParams.get('userId') || requester.userId;
    if (!isRegisteredAdaptiveLearningPathGoal(goalId)) {
      return NextResponse.json({ error: '学习路径目标未注册' }, { status: 400 });
    }
    if (requester.role === 'student' && requestedUserId !== requester.userId) {
      return NextResponse.json({ error: '无权访问该候选路径批次' }, { status: 403 });
    }
    const classId = await resolveCandidateBatchClassScope(requester, requestedUserId);
    if (classId instanceof NextResponse) return classId;
    const batch = await readLatestAdaptivePathCandidateBatch(prisma as any, {
      userId: requestedUserId,
      goalId,
      classId,
    });
    if (!batch) return NextResponse.json({ batch: null });
    const versionedBatch = await attachCandidateBatchSourcePathVersion(batch);
    if (!versionedBatch) {
      return NextResponse.json({ error: '候选路径批次的来源路径已失效' }, { status: 409 });
    }
    return NextResponse.json({ batch: versionedBatch });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[AdaptivePathCandidateBatchLatest] Error:', error);
    return NextResponse.json({ error: '读取最新候选路径批次失败' }, { status: 500 });
  }
}
