import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { buildLoginRedirectFromRequest } from '@/lib/auth-request-redirect';
import { TeacherClassroomWaitingPage } from './teacher-classroom-waiting-page';

interface TeacherClassroomWaitingRouteProps {
  routeSegment: string;
  sessionId: string;
}

function isTeacherOrAdminRole(role: unknown) {
  return ['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(role ?? '').toUpperCase());
}

export async function TeacherClassroomWaitingRoute({
  routeSegment,
  sessionId,
}: TeacherClassroomWaitingRouteProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(await buildLoginRedirectFromRequest());
  }

  if (!isTeacherOrAdminRole(session.user.role)) {
    redirect(`/interactive-learning/courses/${routeSegment}/student/${sessionId}`);
  }

  return <TeacherClassroomWaitingPage routeSegment={routeSegment} sessionId={sessionId} />;
}
