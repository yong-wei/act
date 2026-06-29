import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
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
      return <TeacherPrepPackReviewSurface pack={null} recovery={{ reason: 'storage-missing' }} entryContext={buildPrepPackEntryContext(params)} />;
    }
    throw error;
  }

  return <TeacherPrepPackReviewSurface pack={pack} entryContext={buildPrepPackEntryContext(params)} />;
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

function isMissingCourseEnhancementPackStorage(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2021');
}
