import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_3TeacherPage } from '@/features/interactive/unit-3-3-root-locus-rules/teacher-page';

export default async function UNIT_3_3TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-3-3-root-locus-rules');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-3-3-root-locus-rules/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-3');
  return <UNIT_3_3TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
