import { CruiseStandardCourseEntryPage } from '@/features/interactive/cruise-comfort-standard-course/entry-page';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';

export const dynamic = 'force-dynamic';

export default async function CruiseComfortBopppsEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('cruise-comfort-boppps');
  return <CruiseStandardCourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
