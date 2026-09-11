import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import type { AdaptivePathCandidateBatchView } from '@/features/personalization/path-planning/public-api';
import {
  batchHasInsufficientCandidateDiversity,
  buildAdaptivePathBatchComparisonView,
  stripInternalBatchMetadata,
} from '@/features/personalization/path-planning/adaptive-path-batch-comparison-view';
import type { LearningPathRequester } from '../route-helpers';

export type VersionedAdaptivePathCandidateBatch = AdaptivePathCandidateBatchView & {
  sourcePathVersion: string;
};

/**
 * 学生 API 面：剥离 metadata 中的内部字段（对象键读取记录、区分度原始指标与规则名），
 * 并从候选快照 planNodes 剥离 runtime 绑定原文（对象键/内容校验值，#2055），改以
 * 学生安全投影 `comparison` 下发，防止授权学生从原始 metadata 绕过投影。
 */
export function sanitizeCandidateBatchForStudentResponse<T extends VersionedAdaptivePathCandidateBatch>(
  batch: T,
): T {
  const comparison = buildAdaptivePathBatchComparisonView(batch.metadata);
  return {
    ...batch,
    metadata: stripInternalBatchMetadata(batch.metadata),
    comparison,
    candidates: batchHasInsufficientCandidateDiversity({ metadata: batch.metadata, comparison })
      ? []
      : batch.candidates.map(redactCandidateSnapshotRuntimeBinding),
  };
}

/** 快照 planNodes 中的 runtimeResourceBinding 含原始对象键：学生面整体剥除，状态经 comparison 呈现。 */
function redactCandidateSnapshotRuntimeBinding(
  candidate: VersionedAdaptivePathCandidateBatch['candidates'][number],
): VersionedAdaptivePathCandidateBatch['candidates'][number] {
  const snapshot = candidate.snapshot as Record<string, unknown> | null;
  const planNodes = Array.isArray(snapshot?.planNodes) ? snapshot.planNodes : null;
  if (!planNodes?.some((node) => node && typeof node === 'object' && 'runtimeResourceBinding' in node)) {
    return candidate;
  }
  return {
    ...candidate,
    snapshot: {
      ...snapshot,
      planNodes: planNodes.map((node) => node && typeof node === 'object' && 'runtimeResourceBinding' in node
        ? Object.fromEntries(Object.entries(node).filter(([key]) => key !== 'runtimeResourceBinding'))
        : node),
    },
  };
}

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
