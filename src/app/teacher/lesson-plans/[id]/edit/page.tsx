import { notFound, redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerAuthSession } from '@/lib/auth';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TeacherEditLessonPlanPage({ params }: PageProps) {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'TEACHER') redirect('/');

  const { id } = await params;

  const plan = await prisma.lessonPlan.findUnique({
    where: { id },
    include: {
      items: {
        include: { resource: true, knowledgeNode: true },
        orderBy: [{ stage: 'asc' }, { order: 'asc' }]
      }
    }
  });

  if (!plan) notFound();

  // 确保教师只能编辑自己的教案
  if (plan.authorId !== session.user.id) {
    redirect('/teacher/lesson-plans');
  }

  return <OrchestratorBuilder initialData={plan as any} />;
}
