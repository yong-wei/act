import { CruiseStandardStudentPage } from '@/features/interactive/cruise-comfort-standard-course/student-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';
import { redirectInactiveStudentSessionToLessonEntry } from '@/lib/interactive-session-access';

interface PageProps {
  params: {
    sessionId: string;
  };
}

export default async function CruiseStudentRoute({ params }: PageProps) {
  await redirectInactiveStudentSessionToLessonEntry(params.sessionId, '/interactive-learning/courses/cruise-comfort-boppps');

  const lessonRuntime = await loadLessonRuntimeEntry('cruise-comfort-boppps');
  return <CruiseStandardStudentPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
