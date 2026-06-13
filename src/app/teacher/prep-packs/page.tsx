import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { getServerAuthSession } from '@/lib/auth';
import { loadCourseEnhancementPack } from '@/lib/data-governance/teacher-prep-pack-generation';
import { prisma } from '@/lib/prisma';
import { TeacherPrepPackReviewSurface } from '@/features/teacher/teacher-prep-pack-review-surface';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function TeacherPrepPacksPage({
  searchParams,
}: {
  searchParams?: Promise<{ packId?: string }>;
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
  const recordRef = params?.packId
    ? await prisma.courseEnhancementPack.findFirst({
      where: { id: params.packId, teacherId: session.user.id },
      select: { id: true },
    })
    : await prisma.courseEnhancementPack.findFirst({
      where: { teacherId: session.user.id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true },
    });
  const pack = recordRef ? await loadCourseEnhancementPack(prisma, recordRef.id) : null;

  return <TeacherPrepPackReviewSurface pack={pack} />;
}
