'use client';

import { PremiumLessonEntryPage } from '@/features/interactive/shared/premium-lesson-entry-page';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_5_4_COURSE_DESCRIPTION,
  UNIT_5_4_COURSE_TITLE,
  UNIT_5_4_PRESET_KEY,
  UNIT_5_4_ROUTE_SEGMENT,
} from '@/lib/unit-5-4-course';

export function UNIT_5_4CourseEntryPage({
  initialRole,
  lessonRuntime,
}: {
  initialRole?: string | null;
  lessonRuntime: RuntimeLessonEntryBundle;
}) {
  return (
    <PremiumLessonEntryPage
      initialRole={initialRole}
      lessonRuntime={lessonRuntime}
      config={{
        title: UNIT_5_4_COURSE_TITLE,
        description: UNIT_5_4_COURSE_DESCRIPTION,
        presetKey: UNIT_5_4_PRESET_KEY,
        routeSegment: UNIT_5_4_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
