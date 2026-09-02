'use client';

import { CourseEntryShell } from '@/features/interactive/shared/course-entry-shell';
import type { RuntimeLessonEntryBundle } from '@/lib/course-bundle';
import {
  UNIT_1_3_COURSE_DESCRIPTION,
  UNIT_1_3_COURSE_TITLE,
  UNIT_1_3_PRESET_KEY,
  UNIT_1_3_ROUTE_SEGMENT,
} from '@/lib/unit-1-3-course';

export function UNIT_1_3CourseEntryPage({
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
        title: UNIT_1_3_COURSE_TITLE,
        description: UNIT_1_3_COURSE_DESCRIPTION,
        presetKey: UNIT_1_3_PRESET_KEY,
        routeSegment: UNIT_1_3_ROUTE_SEGMENT,
        overviewKicker: `${lessonRuntime.lesson.lesson_id} · 参数迁移主线课程`,
        mediaCourseLabel: `${lessonRuntime.lesson.lesson_id} · 课前材料`,
        estimatedDuration: '90 分钟',
      }}
    />
  );
}
