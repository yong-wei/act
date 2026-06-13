import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';
import { resolveScopedReturnTarget, type ReturnTargetParam } from '@/lib/navigation-return-target';

interface PageProps {
  searchParams?: Promise<{ returnTo?: ReturnTargetParam }>;
}

function getTeacherReturnLabel(returnTarget: string) {
  if (returnTarget === '/teacher') return '返回教师工作台';
  if (returnTarget.startsWith('/teacher/classes/')) return '返回班级详情';
  return '返回教案列表';
}

export default async function TeacherNewLessonPlanPage({ searchParams }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'TEACHER') redirect('/');

  const query = await searchParams;
  const returnTarget = resolveScopedReturnTarget(query?.returnTo, '/teacher/lesson-plans', ['/teacher']);

  return (
    <OrchestratorBuilder
      returnPath={returnTarget}
      workbenchReturnUrl={returnTarget}
      workbenchReturnLabel={getTeacherReturnLabel(returnTarget)}
    />
  );
}
