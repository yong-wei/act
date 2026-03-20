'use client';

import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import { LessonEntryRuntimeSections } from '@/features/interactive/shared/lesson-entry-runtime-sections';

export function L2BEntryRuntimeSections({
  runtime,
}: {
  runtime: RuntimeLessonEntryBundle;
}) {
  return <LessonEntryRuntimeSections runtime={runtime} />;
}
