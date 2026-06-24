import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_2_1TeacherPage } from '@/features/interactive/unit-2-1-modeling-language/teacher-page';

export const dynamic = 'force-dynamic';

export default async function UNIT_2_1ModelingLanguageTeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user || !['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(session.user.role ?? '').toUpperCase())) {
    redirect('/login');
  }

  const lessonRuntime = await loadLessonRuntimeEntry('2-1');
  return <UNIT_2_1TeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
