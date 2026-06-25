import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';
import { LessonPlanMissingRecovery } from '@/features/lesson-engine/lesson-plan-missing-recovery';
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
  const returnTarget = resolveScopedReturnTarget(query?.returnTo, '/admin/lesson-plans', ['/admin', '/playlists']);
  const plan = await prisma.lessonPlan.findUnique({
    where: { id: params.id },
    include: {
      items: {
        include: { resource: true, knowledgeNode: true },
        orderBy: [{ stage: 'asc' }, { order: 'asc' }]
      }
    }
  });

  if (!plan) {
    return (
      <LessonPlanMissingRecovery
        planId={params.id}
        listHref="/admin/lesson-plans"
        createHref="/admin/lesson-plans/new?returnTo=%2Fadmin%2Flesson-plans"
        sourceRoute="/admin/lesson-plans/[id]/edit"
        title="未找到教案记录"
        description="该教案 ID 当前不存在，可能已经删除或来自过期链接。请返回教案管理列表重新选择，或创建新的 BOPPPS 教案。"
      />
    );
  }

  return (
    <OrchestratorBuilder
      initialData={plan as any}
      returnPath={returnTarget}
      workbenchReturnUrl={returnTarget}
      workbenchReturnLabel="返回教案管理"
    />
  );
}
