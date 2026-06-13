import { UserRole } from '@prisma/client';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';
import { getServerAuthSession } from '@/lib/auth';
import { resolveScopedReturnTarget, type ReturnTargetParam } from '@/lib/navigation-return-target';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: ReturnTargetParam }>;
}

export default async function EditLessonPlanPage(props: PageProps) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.ADMIN) redirect('/');

  const params = await props.params;
  const query = await props.searchParams;
  const returnTarget = resolveScopedReturnTarget(query?.returnTo, '/admin/lesson-plans', ['/admin']);
  const plan = await prisma.lessonPlan.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { resource: true, knowledgeNode: true },
        orderBy: [{ stage: 'asc' }, { order: 'asc' }]
      }
    }
  });

  if (!plan) notFound();

  return (
    <OrchestratorBuilder
      initialData={plan as any}
      returnPath={returnTarget}
      workbenchReturnUrl={returnTarget}
      workbenchReturnLabel="返回教案管理"
    />
  );
}
