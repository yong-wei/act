import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { authOptions } from '@/lib/auth';
import { L2BStudentPage } from '@/features/interactive/l2b-root-locus/student-page';

export default async function L2BStudentRoute({
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
      redirect('/interactive-learning/courses/l2b-root-locus-fasttrack');
    }

    if (role === 'TEACHER' || role === 'ADMIN') {
      redirect(`/interactive-learning/courses/l2b-root-locus-fasttrack/teacher/${params.sessionId}`);
    }
  }

  return <L2BStudentPage sessionId={params.sessionId} />;
}
