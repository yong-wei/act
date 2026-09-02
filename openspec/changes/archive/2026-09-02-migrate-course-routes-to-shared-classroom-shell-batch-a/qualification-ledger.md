# Batch-A qualification ledger

Canonical ids: `1-1` … `3-9` (18 lessons). Public URL family `/interactive-learning/courses/[routeSegment]/{student,teacher,waiting,demo}` unchanged.

| Old private authority | Replacement | Deletion |
| --- | --- | --- |
| `course-app-routes/unit-{1,2,3}-*/{entry,student,teacher,waiting,demo}.tsx` | `batch-a-classroom-pages.tsx` + catch-all App Router | Deleted this change |
| Per-lesson session wiring | `loadLessonRuntimeEntry` / `loadSessionBoundLessonRuntime` / `TeacherClassroomWaitingRoute` | Deleted this change |

Content pages under `src/features/interactive/unit-*` remain. Units 4/5 and Cruise stay on private adapters.

Accepted route-visible deltas vs some private adapters (shared shell follows the 1-2/1-4 predecessor, not a second shell):
- Unauthenticated teacher/waiting uses `buildLoginRedirectForPath` with callback, not bare `/login`.
- Shared student handler does not copy 3-8/3-9 teacher-on-student redirects.

Focused tests: `batch-a-shared-classroom-shell`, `student-route-query-boundary`, `retire-private-course-session-route-bridges`, `expired-session-redirect`, unit 1-2/1-3/1-4/1-5/2-1/2-2/2-3/2-4/3-1/3-8/3-9, AppShell/UI contracts, layered-graph consumers. `npm run typecheck` passed (no `tsc-type-errors`). Browser journey not executed in this worktree (no live app on :3000/:3001). Implementation revision: `1417b99fe1487e23350595411b40eb7fa15d71a7`.

Rollback: restore the deleted adapters and loader keys before this revision.
