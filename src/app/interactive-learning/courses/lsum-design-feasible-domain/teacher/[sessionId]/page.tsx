import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { LSUMTeacherPage } from '@/features/interactive/lsum-design-feasible-domain/teacher-page';

export default async function LSUMTeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/lsum-design-feasible-domain');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/lsum-design-feasible-domain/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('L-sum');
  return <LSUMTeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
