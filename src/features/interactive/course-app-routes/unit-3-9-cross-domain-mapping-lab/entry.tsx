import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/auth';
import { loadLessonRuntimeEntry } from '@/lib/course-bundle';
import { UNIT_3_9CourseEntryPage } from '@/features/interactive/unit-3-9-cross-domain-mapping-lab/entry-page';

export default async function UNIT_3_9FrequencyDomainTranslationJudgmentEntryRoute() {
  const session = await getServerSession(authOptions);
  const lessonRuntime = await loadLessonRuntimeEntry('3-9');
  return <UNIT_3_9CourseEntryPage initialRole={session?.user?.role} lessonRuntime={lessonRuntime} />;
}
