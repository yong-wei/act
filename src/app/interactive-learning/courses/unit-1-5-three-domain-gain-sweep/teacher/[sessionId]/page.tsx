import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_1_5TeacherPage } from '@/features/interactive/unit-1-5-three-domain-gain-sweep/teacher-page';
import { authOptions } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_5TeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user || !['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(session.user.role ?? '').toUpperCase())) {
    redirect(buildLoginRedirectForPath(
      `/interactive-learning/courses/unit-1-5-three-domain-gain-sweep/teacher/${params.sessionId}`,
    ));
  }

  const lessonRuntime = await loadLessonRuntimeEntry('1-5');
  return <UNIT_1_5TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
