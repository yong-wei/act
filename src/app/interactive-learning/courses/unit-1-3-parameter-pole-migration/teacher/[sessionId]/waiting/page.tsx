import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { TeacherClassroomWaitingRoute } from '@/features/interactive/shared/teacher-classroom-waiting-route';
import { authOptions } from '@/lib/auth';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

export default async function UNIT_1_3TeacherWaitingRoute({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['TEACHER', 'ADMIN', '教师', '管理员'].includes(String(session.user.role ?? '').toUpperCase())) {
    redirect('/login');
  }

  const { sessionId } = await params;
  return <TeacherClassroomWaitingRoute routeSegment="unit-1-3-parameter-pole-migration" sessionId={sessionId} />;
}
