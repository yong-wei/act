import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';
import { LessonPlanMissingRecovery } from '@/features/lesson-engine/lesson-plan-missing-recovery';
import { resolveScopedReturnTarget, type ReturnTargetParam } from '@/lib/navigation-return-target';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: ReturnTargetParam }>;
}

function getTeacherReturnLabel(returnTarget: string) {
  if (returnTarget === '/teacher') return '返回教师工作台';
  if (returnTarget === '/teacher/preset-lessons') return '返回预置教案';
  if (returnTarget.startsWith('/teacher/classes/')) return '返回班级详情';
  return '返回教案列表';
}

export default async function TeacherEditLessonPlanPage({ params, searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) redirect(await buildLoginRedirectFromRequest());
  if (session.user.role !== 'TEACHER') redirect('/');

  const { id } = await params;
  const query = await searchParams;
  const returnTarget = resolveScopedReturnTarget(query?.returnTo, '/teacher/lesson-plans', ['/teacher', '/playlists']);

  const plan = await prisma.lessonPlan.findUnique({
    where: { id },
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
        planId={id}
        listHref="/teacher/lesson-plans"
        createHref="/teacher/lesson-plans/new?returnTo=%2Fteacher%2Flesson-plans"
        sourceRoute="/teacher/lesson-plans/[id]/edit"
        title="未找到可编辑教案"
        description="该教案可能已被删除、归档，或不属于当前教师。请返回列表选择仍可编辑的教案，或新建一个教案继续编排。"
      />
    );
  }

  // 确保教师只能编辑自己的教案
  if (plan.authorId !== session.user.id) {
    redirect('/teacher/lesson-plans');
  }

  return (
    <OrchestratorBuilder
      initialData={plan as any}
      returnPath={returnTarget}
      workbenchReturnUrl={returnTarget}
      workbenchReturnLabel={getTeacherReturnLabel(returnTarget)}
    />
  );
}
