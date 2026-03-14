import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { L2CStudentPage } from '@/features/interactive/l2c-frequency-bode/student-page';

export default async function L2CStudentRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/l2c-frequency-bode-fasttrack');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/l2c-frequency-bode-fasttrack/teacher/${params.sessionId}`);
    }
  }

  const lessonRuntime = await loadLessonRuntimeEntry('L-2c');
  return <L2CStudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
