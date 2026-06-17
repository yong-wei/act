import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { UNIT_1_2TeacherPage } from '@/features/interactive/unit-1-2-modeling-from-object-to-system/teacher-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_2TeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user || !['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(session.user.role ?? '').toUpperCase())) {
    redirect('/login');
  }

  const lessonRuntime = await loadLessonRuntimeEntry('1-2');
  return <UNIT_1_2TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
