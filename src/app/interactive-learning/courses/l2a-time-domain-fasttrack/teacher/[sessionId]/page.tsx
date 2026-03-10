import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { L2ATeacherPage } from '@/features/interactive/l2a-time-domain/teacher-page';

export default async function L2ATeacherRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/l2a-time-domain-fasttrack');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/l2a-time-domain-fasttrack/student/${params.sessionId}`);
  }

  return <L2ATeacherPage sessionId={params.sessionId} />;
}
