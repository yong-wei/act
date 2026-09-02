import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
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

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: '1-1',
    role: 'teacher',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
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
