import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import type { AdaptivePathCandidateBatchView } from '@/lib/adaptive-path-candidate-batches';
import type { LearningPathRequester } from '../route-helpers';

export type VersionedAdaptivePathCandidateBatch = AdaptivePathCandidateBatchView & {
  sourcePathVersion: string;
};

export async function attachCandidateBatchSourcePathVersion(
  batch: AdaptivePathCandidateBatchView,
): Promise<VersionedAdaptivePathCandidateBatch | null> {
  const sourcePath = await prisma.learningPath.findFirst({
    where: {
      id: batch.sourcePathId,
      userId: batch.userId,
      goalId: batch.goalId,
    },
    select: { updatedAt: true },
  });
  return sourcePath?.updatedAt
    ? { ...batch, sourcePathVersion: sourcePath.updatedAt.toISOString() }
    : null;
}

export async function assertCanReadCandidateBatch(
  requester: LearningPathRequester,
  batch: Pick<AdaptivePathCandidateBatchView, 'userId' | 'classId'>,
): Promise<NextResponse | null> {
  if (requester.role === 'admin') return null;
  if (requester.role === 'student') {
    return requester.userId === batch.userId
      ? null
      : NextResponse.json({ error: '无权访问该候选路径批次' }, { status: 403 });
  }
  if (!batch.classId) {
    return NextResponse.json({ error: '无权访问该候选路径批次' }, { status: 403 });
  }
  const classData = await prisma.class.findUnique({
    where: { id: batch.classId },
    select: { teacherId: true },
  });
  return classData?.teacherId === requester.userId
    ? null
    : NextResponse.json({ error: '无权访问该候选路径批次' }, { status: 403 });
}

export async function resolveCandidateBatchClassScope(
  requester: LearningPathRequester,
  requestedUserId: string,
): Promise<string | null | NextResponse> {
  if (requester.role === 'admin' || requester.userId === requestedUserId) return null;
  if (requester.role !== 'teacher') {
    return NextResponse.json({ error: '无权访问该候选路径批次' }, { status: 403 });
  }
  const profile = await prisma.studentProfile.findUnique({
    where: { userId: requestedUserId },
    select: { classId: true },
  });
  if (!profile?.classId) {
    return NextResponse.json({ error: '无权访问该候选路径批次' }, { status: 403 });
  }
  const classData = await prisma.class.findUnique({
    where: { id: profile.classId },
    select: { teacherId: true },
  });
  return classData?.teacherId === requester.userId
    ? profile.classId
    : NextResponse.json({ error: '无权访问该候选路径批次' }, { status: 403 });
}
