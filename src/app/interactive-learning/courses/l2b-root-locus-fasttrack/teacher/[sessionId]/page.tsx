import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { L2BTeacherPage } from '@/features/interactive/l2b-root-locus/teacher-page';

export default async function L2BTeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/l2b-root-locus-fasttrack');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/l2b-root-locus-fasttrack/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('L-2b');
  return <L2BTeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
