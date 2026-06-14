'use client';

import { CourseEntryShell } from '@/features/interactive/shared/course-entry-shell';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_4_2_COURSE_DESCRIPTION,
  UNIT_4_2_COURSE_TITLE,
  UNIT_4_2_PRESET_KEY,
  UNIT_4_2_ROUTE_SEGMENT,
} from '@/lib/unit-4-2-course';

export function UNIT_4_2CourseEntryPage({
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
        title: UNIT_4_2_COURSE_TITLE,
        description: UNIT_4_2_COURSE_DESCRIPTION,
        presetKey: UNIT_4_2_PRESET_KEY,
        routeSegment: UNIT_4_2_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
