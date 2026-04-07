import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_3_6TeacherPage } from '@/features/interactive/unit-3-6-zero-design-workshop/teacher-page';

export default async function UNIT_3_6TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-3-6-zero-design-workshop');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-3-6-zero-design-workshop/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('3-6');
  return <UNIT_3_6TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
