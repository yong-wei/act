import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { TeacherClassroomWaitingRoute } from '@/features/interactive/shared/teacher-classroom-waiting-route';
import { authOptions } from '@/lib/auth';
import { buildLoginRedirectForPath } from '@/lib/auth-redirect';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function UNIT_1_4TeacherWaitingRoute({ params: routeParams }: PageProps) {
  const params = await routeParams;
  const session = await getServerSession(authOptions);
  if (!session?.user || !['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(session.user.role ?? '').toUpperCase())) {
    redirect(buildLoginRedirectForPath(
      `/interactive-learning/courses/unit-1-4-time-frequency-views/teacher/${params.sessionId}/waiting`,
    ));
  }

  return <TeacherClassroomWaitingRoute routeSegment="unit-1-4-time-frequency-views" sessionId={params.sessionId} />;
}
