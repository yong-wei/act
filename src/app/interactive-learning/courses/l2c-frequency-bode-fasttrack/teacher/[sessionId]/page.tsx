import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { L2CTeacherPage } from '@/features/interactive/l2c-frequency-bode/teacher-page';

export default async function L2CTeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/l2c-frequency-bode-fasttrack');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/l2c-frequency-bode-fasttrack/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('L-2c');
  return <L2CTeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
