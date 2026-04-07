import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_4TeacherPage } from '@/features/interactive/unit-3-4-root-locus-reading-validation/teacher-page';

export default async function UNIT_3_4TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-3-4-root-locus-reading-validation');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-3-4-root-locus-reading-validation/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-4');
  return <UNIT_3_4TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
