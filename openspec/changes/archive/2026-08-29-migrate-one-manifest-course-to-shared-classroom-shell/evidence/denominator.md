# Pilot denominator

Canonical identity: `1-2`  
Route segment: `unit-1-2-modeling-from-object-to-system`  
Runtime root: `course-content/runtime/lessons/1-2/`

## Routes (thin identity wrappers after migration)

| Path | Shared authority |
| --- | --- |
| `src/app/interactive-learning/courses/unit-1-2-modeling-from-object-to-system/page.tsx` | `CourseEntryShell` via `UNIT_1_2CourseEntryPage`; `loadLessonRuntimeEntry('1-2')` |
| `.../student/[sessionId]/page.tsx` | `loadSessionBoundLessonRuntime({ expectedCanonicalId: '1-2', role: 'student' })` |
| `.../teacher/[sessionId]/page.tsx` | same reader, `role: 'teacher'` |
| `.../teacher/[sessionId]/waiting/page.tsx` | `TeacherClassroomWaitingRoute` |

## Feature composition (course-owned config, shared shell)

| File | Role after migration |
| --- | --- |
| `entry-page.tsx` | CourseEntryShell config only |
| `student-page.tsx` | LessonRuntimeShell + shared session hook + manifest panels |
| `teacher-page.tsx` | LessonRuntimeShell + shared session hook + manifest panels |
| `step-panels.tsx` | Thin wiring to shared module/activity registries |
| `course-header.tsx` | **Deleted.** Private topbar authority. |

## Direct session / evidence callers

Classroom HTTP remains `/api/session*` owned by the application-service adapters. Pilot pages use `useStudentLessonSession` / `useTeacherLessonSession` and `useManifestSubmissionController`. No `/api/session` imports and no `course-content/authoring/**` imports in the feature or App Router files.

## Catalog / identity

`src/lib/unit-1-2-course.ts` remains the course configuration (steps, adapter, titles). Session route resolution for bound sessions uses bundle canonical id, not `LessonPlan.title`.
