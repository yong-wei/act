import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { createAuditedActionState } from '@/lib/action-status-contract';
import { loadCourseEnhancementPack } from '@/lib/data-governance/teacher-prep-pack-generation';
import { prisma } from '@/lib/prisma';
import { TeacherPrepPackReviewSurface } from '@/features/teacher/teacher-prep-pack-review-surface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type TeacherPrepPacksSearchParams = {
  packId?: string;
  cluster?: string;
  classId?: string;
  graphNodeId?: string;
  learningGoalId?: string;
  resourceGapStatus?: string;
  status?: string;
  error?: string;
};

export default async function TeacherPrepPacksPage({
  searchParams,
}: {
  searchParams?: Promise<TeacherPrepPacksSearchParams>;
}) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role !== UserRole.TEACHER) {
    if (session.user.role === UserRole.ADMIN) {
      redirect('/admin');
    }
    redirect('/dashboard');
  }

  const params = await searchParams;
  let recordRef: { id: string } | null = null;
  let pack = null;
  try {
    recordRef = params?.packId
      ? await prisma.courseEnhancementPack.findFirst({
        where: { id: params.packId, teacherId: session.user.id },
        select: { id: true },
      })
      : params?.cluster
        ? await prisma.courseEnhancementPack.findFirst({
          where: {
            teacherId: session.user.id,
            source: { path: ['sourceEvidenceRefs'], array_contains: [`role-diagnosis:${params.cluster}`] },
          },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      : params?.graphNodeId
        ? await prisma.courseEnhancementPack.findFirst({
          where: {
            teacherId: session.user.id,
            ...(params.classId ? { classId: params.classId } : {}),
            source: { path: ['sourceEvidenceRefs'], array_contains: [`graph-node:${params.graphNodeId}`] },
          },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      : params?.classId
        ? await prisma.courseEnhancementPack.findFirst({
          where: { teacherId: session.user.id, classId: params.classId },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        })
      : await prisma.courseEnhancementPack.findFirst({
        where: { teacherId: session.user.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      });
    pack = recordRef ? await loadCourseEnhancementPack(prisma, recordRef.id) : null;
  } catch (error) {
    if (isMissingCourseEnhancementPackStorage(error)) {
      return (
        <TeacherPrepPackReviewSurface
          pack={null}
          recovery={{ reason: 'storage-missing' }}
          entryContext={buildPrepPackEntryContext(params)}
          actionReceipt={buildPrepPackActionReceipt(params)}
        />
      );
    }
    throw error;
  }

  return <TeacherPrepPackReviewSurface pack={pack} entryContext={buildPrepPackEntryContext(params)} actionReceipt={buildPrepPackActionReceipt(params)} />;
}

function buildPrepPackEntryContext(params: TeacherPrepPacksSearchParams | undefined) {
  return {
    classId: params?.classId ?? null,
    clusterId: params?.cluster ?? null,
    graphNodeId: params?.graphNodeId ?? null,
    learningGoalId: params?.learningGoalId ?? null,
    resourceGapStatus: params?.resourceGapStatus ?? null,
  };
}

function buildPrepPackActionReceipt(params: TeacherPrepPacksSearchParams | undefined) {
  if (!params?.status) return null;
  const displayReference = params.packId ?? params.graphNodeId ?? params.classId ?? undefined;
  const status = params.status;
  const successfulStatuses = new Set(['preview', 'activate', 'rollback', 'archive', 'impact-evidence']);
  const blockedStatuses = new Set(['unauthorized', 'forbidden', 'not-found', 'invalid-action', 'invalid-lifecycle']);
  const isSuccess = successfulStatuses.has(status);
  const isBlocked = blockedStatuses.has(status);
  const message = isSuccess
    ? prepPackActionSuccessMessage(status)
    : status === 'action-failed'
      ? `课前包动作执行失败：${params.error ?? '请稍后重试或联系管理员核查日志。'}`
      : prepPackActionBlockedMessage(status);

  return createAuditedActionState({
    identity: {
      id: `teacher-prep-pack:${displayReference ?? 'unknown'}:${status}`,
      category: 'governance-resolve',
      label: '课前包动作回执',
      sourceRoute: '/teacher/prep-packs',
      targetId: displayReference,
      requestedAction: status,
    },
    status: isSuccess ? 'succeeded' : isBlocked ? 'blocked' : 'failed',
    message,
    recoveryAction: isSuccess ? undefined : '确认课前包、班级和生命周期状态后重新执行动作',
    nextAction: isSuccess ? '继续复核课前包或返回教师工作台' : undefined,
    displayReference,
  });
}

function prepPackActionSuccessMessage(status: string): string {
  if (status === 'preview') return '课前包预览请求已返回复核页，基础 runtime manifest 未被修改。';
  if (status === 'activate') return '课前包 overlay 已激活，复核页已刷新当前包状态。';
  if (status === 'rollback') return '课前包 overlay 回滚动作已完成，复核页已刷新当前包状态。';
  if (status === 'archive') return '课前包归档动作已完成，复核页已刷新当前包状态。';
  if (status === 'impact-evidence') return '课前包影响证据已记录，复核页已刷新当前包状态。';
  return '课前包动作已完成，复核页已刷新当前包状态。';
}

function prepPackActionBlockedMessage(status: string): string {
  if (status === 'unauthorized') return '请登录教师账号后再执行课前包动作。';
  if (status === 'forbidden') return '当前账号无权执行教师课前包生命周期动作。';
  if (status === 'not-found') return '未找到当前教师可操作的课前包。';
  if (status === 'invalid-action') return '课前包动作参数无效，未执行生命周期变更。';
  if (status === 'invalid-lifecycle') return '当前课前包生命周期状态不允许执行该动作。';
  return '课前包动作未完成，请核对回执状态后重试。';
}

function isMissingCourseEnhancementPackStorage(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2021');
}
