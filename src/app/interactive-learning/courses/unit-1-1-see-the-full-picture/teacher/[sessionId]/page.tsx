import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { UNIT_1_1TeacherPage } from '@/features/interactive/unit-1-1-see-the-full-picture/teacher-page';
import {
  buildCoursePackageLayeredScope,
  resolveCoursePageLayeredGraphContext,
} from '@/lib/layered-graph';

export const dynamic = 'force-dynamic';

export default async function UNIT_1_1SeeTheFullPictureTeacherRoute(
  props: {
    params: Promise<{ sessionId: string }>;
  }
) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user || !['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(session.user.role ?? '').toUpperCase())) {
    redirect('/login');
  }

  const lessonRuntime = await loadLessonRuntimeEntry('1-1');
  const layeredGraphContext = resolveCoursePageLayeredGraphContext({
    scope: buildCoursePackageLayeredScope({
      packageCanonicalId: '1-1',
      lessonKey: '1-1',
    }),
    lessonRuntime,
  });

  return (
    <UNIT_1_1TeacherPage
      sessionId={params.sessionId}
      lessonRuntime={lessonRuntime}
      layeredGraphPayload={layeredGraphContext.payload}
      layeredResourceLaunchTargets={layeredGraphContext.resourceLaunchTargets}
      layeredResourceRegistryIds={layeredGraphContext.resourceRegistryIds}
    />
  );
}
