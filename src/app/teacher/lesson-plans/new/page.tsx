import { getServerAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { OrchestratorBuilder } from '@/features/lesson-engine/orchestrator-builder';

export default async function TeacherNewLessonPlanPage() {
  const session = await getServerAuthSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'TEACHER') redirect('/');

  return (
    <OrchestratorBuilder workbenchReturnUrl="/teacher" />
  );
}
