# Behavior matrix and qualification notes

Capture revision: `10577fdf59a884c5d452d0a62af17a04df83dcb2`.

## Preserved

| Behavior | Evidence |
| --- | --- |
| Canonical id `1-2`, runtime manifest under `course-content/runtime/lessons/1-2` | `unit-1-2-shared-classroom-shell.test.ts`, `loadLessonRuntimeEntry('1-2')` |
| Bound sessions ignore `LessonPlan.title` | `classroom-session-route-bundle.test.ts` |
| Student/teacher share session id and `loadSessionBoundLessonRuntime` | App Router student/teacher pages |
| Waiting uses `TeacherClassroomWaitingRoute` | waiting `page.tsx` |
| Entry uses `CourseEntryShell` / teacher launcher | `entry-page.tsx`; class-choice owned by `add-default-teacher-class-launch-selection` |
| Submit/resubmit via `useManifestSubmissionController` | student-page |
| Teacher reveal/release/browse via shared activity registry | `UNIT_1_2TeacherActivitySummary` |
| Optional knowledge-card drawer | `StepKnowledgeDrawer` |
| Demo/preview does not write student state | `readOnly={isDemo}` |
| Plugin lookup for compute/visual modules | `createManifestContentModuleRegistry` |

## Accepted deltas (unified shell contract, same as 1-1 / 4-1)

| Before | After |
| --- | --- |
| Private `UNIT_1_2CourseHeader` / `premium-lesson-topbar` | `LessonRuntimeShell` AppShell chrome |
| `aria-label="选择课程环节"` | Shell `aria-label="跳转课程页"` |
| Legacy AppShell exception for this slug | Removed from `LEGACY_LESSON_RUNTIME_ROUTE_SLUGS` |

## Deleted private authorities

- `src/features/interactive/unit-1-2-modeling-from-object-to-system/course-header.tsx`

App Router files remain thin identity wrappers for `retire-private-course-session-route-bridges`. They are not a second session policy.

## Not claimed

No deployment, no production selector change, no other course-family migration.
