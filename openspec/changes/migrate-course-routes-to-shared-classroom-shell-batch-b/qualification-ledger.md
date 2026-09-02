# Batch-B qualification ledger

Canonical ids: `4-1` … `5-6` plus `cruise-comfort-boppps` (14 lessons). Public URL family `/interactive-learning/courses/[routeSegment]/{student,teacher,waiting,demo}` unchanged.

| Old private authority | Replacement | Deletion |
| --- | --- | --- |
| `course-app-routes/{unit-4-*,unit-5-*,cruise-comfort-boppps}/{entry,student,teacher,waiting}.tsx` | existing `batch-a-classroom-pages.tsx` renderers + `BATCH_B_LESSONS` | Deleted this change |
| `unit-5-4` entry `ArenaWorkbenchSubmissionMount` | `unit-5-4-data-driven-mpc-transition/entry-page.tsx` | Deleted with adapter |

Content pages under `src/features/interactive/unit-4-*`, `unit-5-*`, and `cruise-comfort-standard-course` remain. Batch A denominator is unchanged (`resolveBatchALesson` still returns null for Batch B).

Accepted route-visible deltas vs some private adapters (shared shell follows the qualified Batch A path):
- Unauthenticated teacher/waiting uses `buildLoginRedirectForPath` with callback, not a bare course-entry redirect.
- Waiting routes now authenticate before `TeacherClassroomWaitingRoute`.

Focused tests: `batch-b-shared-classroom-shell`, `retire-private-course-session-route-bridges`, `expired-session-redirect`, unit 4-4/4-5/4-6/4-7/5-1…5-6, cruise, AppShell/UI contracts, arena entry. Browser journey not executed in this worktree.

Rollback: restore the deleted adapters and leftover loaders before this revision.
