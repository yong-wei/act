import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';
import { getServerAuthSession } from '@/lib/auth';
import { resolveScopedReturnTarget, type ReturnTargetParam } from '@/lib/navigation-return-target';

interface PageProps {
  searchParams?: Promise<{ returnTo?: ReturnTargetParam }>;
}

export default async function NewLessonPlanPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session?.user) redirect('/login');
  if (session.user.role !== UserRole.ADMIN) redirect('/');

  const query = await searchParams;
  const returnTarget = resolveScopedReturnTarget(query?.returnTo, '/admin/lesson-plans', ['/admin']);

  return (
    <OrchestratorBuilder
      returnPath={returnTarget}
      workbenchReturnUrl={returnTarget}
      workbenchReturnLabel="返回教案管理"
    />
  );
}
