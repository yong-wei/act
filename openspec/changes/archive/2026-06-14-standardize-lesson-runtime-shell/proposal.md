## Why

Interactive lesson runtime pages remain fragmented across course-local headers and `premium-lesson-main` layouts. The accepted Product Design direction requires a unified LessonRuntimeShell that distinguishes student, guest, and teacher projection modes while preserving runtime manifest truth.

## What Changes

- Create a unified LessonRuntimeShell for student, guest/demo, teacher projection, and invalid-session states.
- Align student/guest runtime with `concepts/revised/03-student-guest-runtime.png`.
- Align teacher projection runtime with `concepts/revised/06-teacher-projection-runtime-compact-navigation.png`.
- Keep teacher content dominant, tools collapsed by default, bottom navigation compact, page-jump dropdown available, and Konling as the shared floating dock.
- Require design QA against the handoff and both accepted runtime concepts.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-workspace-surface-system`: define LessonRuntimeShell mode, projection, local tool, and bottom navigation behavior.
- `platform-design-system-and-shell`: require runtime routes to preserve AppShell continuity and route breadcrumbs.

## Impact

- Affects interactive course student, teacher, guest/demo, and invalid-session runtime pages.
- Does not change manifest content truth, scoring, classroom synchronization semantics, or student submission contracts.
- Blocked by `migrate-interactive-course-entry-shell` for route continuity and by `define-interactive-module-visual-standards` for module chrome and teacher-control placement.
- Blocks final `govern-interactive-learning-product-qa`.
