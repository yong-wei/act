## Why

Concrete interactive course entry pages still use `PremiumLessonEntryPage` and local premium lesson shell styling. This breaks platform navigation continuity and leaves the accepted CourseEntryShell direction unimplemented.

## What Changes

- Migrate `/interactive-learning/courses/unit-*` entry pages into a unified CourseEntryShell under the shared platform shell.
- Preserve course identity, BOPPPS structure, teacher start, student join, guest/demo browsing, self-study materials, resource lists, and knowledge-path actions.
- Remove the long-term dependency on `premium-lesson-*` as the course entry page frame.
- Require design QA against `design-handoff.md` and `concepts/02-course-entry-shell.png`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-workspace-surface-system`: define CourseEntryShell as an interactive course entry workspace.
- `platform-design-system-and-shell`: require concrete course entry routes to remain inside the shared shell.

## Impact

- Affects all concrete interactive course entry routes.
- Does not change runtime lesson manifests, scoring, classroom session behavior, or course content truth.
- Blocked by `unify-interactive-learning-atlas-shell` so concrete course pages inherit the accepted atlas shell and breadcrumb baseline.
- Unlocks `standardize-interactive-classroom-entry` and contributes to `standardize-lesson-runtime-shell`.
