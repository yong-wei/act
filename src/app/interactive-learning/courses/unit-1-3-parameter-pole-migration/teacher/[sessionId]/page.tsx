import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_1_3TeacherPage } from '@/features/interactive/unit-1-3-parameter-pole-migration/teacher-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_3TeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user || !['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(session.user.role ?? '').toUpperCase())) {
    redirect('/login');
  }

  const lessonRuntime = await loadLessonRuntimeEntry('1-3');
  return <UNIT_1_3TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
