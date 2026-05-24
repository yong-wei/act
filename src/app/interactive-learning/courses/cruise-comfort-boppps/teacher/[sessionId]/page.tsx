import { CruiseStandardTeacherPage } from '@/features/interactive/cruise-comfort-standard-course/teacher-page';
import { loadLessonRuntimeEntry } from '@/lib/course-runtime';

interface PageProps {
  params: {
    sessionId: string;
  };
}

export default async function CruiseTeacherRoute({ params }: PageProps) {
  const lessonRuntime = await loadLessonRuntimeEntry('cruise-comfort-boppps');
  return <CruiseStandardTeacherPage sessionId={params.sessionId} lessonRuntime={lessonRuntime} />;
}
