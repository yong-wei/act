import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

import { CruiseStandardTeacherPage } from '@/features/interactive/cruise-comfort-standard-course/teacher-page';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

interface PageProps {
  params: Promise<{
    sessionId: string;
  }>;
}

export default async function CruiseTeacherRoute(props: PageProps) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session) {
    redirect('/interactive-learning/courses/cruise-comfort-boppps');
  }

  if (role !== 'TEACHER' && role !== 'ADMIN') {
    redirect(`/interactive-learning/courses/cruise-comfort-boppps/student/${params.sessionId}`);
  }

  const lessonRuntime = await loadLessonRuntimeEntry('cruise-comfort-boppps');
  return <CruiseStandardTeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
