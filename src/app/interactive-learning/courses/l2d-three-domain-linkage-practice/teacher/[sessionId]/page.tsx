import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { L2DTeacherPage } from '@/features/interactive/l2d-three-domain-linkage/teacher-page';

export default async function L2DTeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/l2d-three-domain-linkage-practice');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/l2d-three-domain-linkage-practice/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('L-2d');
  return <L2DTeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
