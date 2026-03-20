import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_1TeacherPage } from '@/features/interactive/unit-1-1-laplace/teacher-page';

export default async function UNIT_1_1TeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/unit-1-1-laplace-transfer-function');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/unit-1-1-laplace-transfer-function/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('1-1');
  return <UNIT_1_1TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
