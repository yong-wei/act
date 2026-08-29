import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { CruiseStandardStudentPage } from '@/features/interactive/cruise-comfort-standard-course/student-page';
import { authOptions } from '@/lib/auth';
import { loadSessionBoundLessonRuntime } from '@/lib/course-bundle/session-reader';
import { CourseBundleDriftState } from '@/features/lesson-engine/course-bundle-drift-state';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

interface PageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export default async function CruiseStudentRoute(props: PageProps) {
  const params = await props.params;
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/cruise-comfort-boppps');

  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/cruise-comfort-boppps');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/cruise-comfort-boppps/teacher/${params.sessionId}`);
    }
  }

  const runtimeResult = await loadSessionBoundLessonRuntime({
    sessionId: params.sessionId,
    expectedCanonicalId: 'cruise-comfort-boppps',
    role: 'student',
  });
  if (runtimeResult.status === 'drift') {
    return <CourseBundleDriftState code={runtimeResult.code} sessionId={runtimeResult.sessionId} />;
  }
  if (runtimeResult.status === 'route-mismatch') {
    redirect(runtimeResult.redirectHref);
  }
  const lessonRuntime = runtimeResult.lessonRuntime;
  return <CruiseStandardStudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
