'use client';

import { CourseEntryShell } from '@/features/interactive/shared/course-entry-shell';
import type { RuntimeLessonEntryBundle } from '@/lib/course-runtime';
import {
  UNIT_2_4_COURSE_DESCRIPTION,
  UNIT_2_4_COURSE_TITLE,
  UNIT_2_4_PRESET_KEY,
  UNIT_2_4_ROUTE_SEGMENT,
} from '@/lib/unit-2-4-course';

export function UNIT_2_4CourseEntryPage({
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
        title: UNIT_2_4_COURSE_TITLE,
        description: UNIT_2_4_COURSE_DESCRIPTION,
        presetKey: UNIT_2_4_PRESET_KEY,
        routeSegment: UNIT_2_4_ROUTE_SEGMENT,
        overviewKicker: lessonRuntime.lesson.lesson_id + ' · Course Entry',
        mediaCourseLabel: lessonRuntime.lesson.lesson_id + ' · Pre-study',
      }}
    />
  );
}
