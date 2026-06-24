import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_1StudentPage } from '@/features/interactive/unit-1-1-see-the-full-picture/student-page';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';
import { resolveStudentRouteDemoStepId, type StudentRouteSearchParams } from '@/features/interactive/shared/student-route-query';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: '看见控制全貌 - 学生互动课',
  description: '进入看见控制全貌互动课程的学生学习页面',
};

export default async function UNIT_1_1SeeTheFullPictureStudentRoute(
  props: {
    params: Promise<{ sessionId: string }>;
    searchParams?: Promise<StudentRouteSearchParams>;
  }
) {
  const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
  const demoStepId = resolveStudentRouteDemoStepId(searchParams);
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/unit-1-1-see-the-full-picture');

  const [session, lessonRuntime] = await Promise.all([
    getServerSession(authOptions),
    loadLessonRuntimeEntry('1-1'),
  ]);

  if (!session?.user) {
    return <UNIT_1_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} demoStepId={demoStepId} />;
  }

  return <UNIT_1_1StudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} demoStepId={demoStepId} />;
}
