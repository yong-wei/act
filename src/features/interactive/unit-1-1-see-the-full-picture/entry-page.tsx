'use client';

import { CourseEntryShell } from '@/features/interactive/shared/course-entry-shell';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import { UNIT_1_1_PREMIUM_LESSON_CARD, UNIT_1_1_PRESET_KEY } from '@/lib/unit-1-1-course';

export function UNIT_1_1CourseEntryPage({
  initialRole,
  lessonRuntime,
}: {
  initialRole?: string | null;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  return (
    <CourseEntryShell
      initialRole={initialRole}
      lessonRuntime={lessonRuntime}
      config={{
        title: UNIT_1_1_PREMIUM_LESSON_CARD.title,
        description: UNIT_1_1_PREMIUM_LESSON_CARD.description,
        presetKey: UNIT_1_1_PRESET_KEY,
        routeSegment: UNIT_1_1_PREMIUM_LESSON_CARD.id,
        overviewKicker: UNIT_1_1_PREMIUM_LESSON_CARD.lessonId + ' · Course Entry',
        mediaCourseLabel: UNIT_1_1_PREMIUM_LESSON_CARD.lessonId + ' · Pre-study',
      }}
    />
  );
}
