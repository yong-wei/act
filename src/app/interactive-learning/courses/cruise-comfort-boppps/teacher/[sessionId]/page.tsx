import { CruiseTeacherPage } from '@/features/interactive/cruise-classroom/teacher-page';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';

interface PageProps {
  params: {
    sessionId: string;
  };
}

export default async function CruiseTeacherRoute({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/cruise-comfort-boppps');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/cruise-comfort-boppps/student/${params.sessionId}`);
  }

  return <CruiseTeacherPage sessionId={params.sessionId} />;
}
