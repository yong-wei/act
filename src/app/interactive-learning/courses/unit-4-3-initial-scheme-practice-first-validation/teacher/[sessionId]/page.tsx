import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_4_3TeacherPage } from '@/features/interactive/unit-4-3-initial-scheme-practice-first-validation/teacher-page';

export default async function UNIT_4_3TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-4-3-initial-scheme-practice-first-validation/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('4-3');
  return <UNIT_4_3TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
