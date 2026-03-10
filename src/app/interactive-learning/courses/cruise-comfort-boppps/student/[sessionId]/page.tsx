import { CruiseStudentPage } from '@/features/interactive/cruise-classroom/student-page';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

interface PageProps {
  params: {
    sessionId: string;
  };
}

export default async function CruiseStudentRoute({ params }: PageProps) {
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

  return <CruiseStudentPage sessionId={params.sessionId} />;
}
