import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { L2AStudentPage } from '@/features/interactive/l2a-time-domain/student-page';

export default async function L2AStudentRoute({
  params,
}: {
  params: {
    sessionId: string;
  };
}) {
  if (params.sessionId !== 'demo') {
    const session = await getServerSession(authOptions);
    const role = session?.user?.role;

    if (!session) {
      redirect('/interactive-learning/courses/l2a-time-domain-fasttrack');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/l2a-time-domain-fasttrack/teacher/${params.sessionId}`);
    }
  }

  return <L2AStudentPage sessionId={params.sessionId} />;
}
