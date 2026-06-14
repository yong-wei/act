## Why

Teacher classroom creation needs a dedicated waiting state before projection starts. The accepted design separates QR/class-code waiting from the runtime teaching page so teachers can see joined student counts and start class intentionally.

## What Changes

- Standardize the teacher classroom QR/waiting page for interactive courses.
- Show QR code, class code, joined student count, and a clear `开始上课` action.
- Keep the page inside AppShell and aligned with the course entry and runtime shell.
- Require design QA against `design-handoff.md` and `concepts/revised/02-teacher-classroom-qr-waiting.png`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-workspace-surface-system`: define pre-class waiting as an interactive course workspace state.

## Impact

- Affects teacher course start flow and classroom session waiting UI.
- Does not change session creation semantics, join code generation, or attendance truth.
- Blocked by `migrate-interactive-course-entry-shell` so the waiting page inherits CourseEntryShell route continuity and role entry semantics.
- Blocks final `govern-interactive-learning-product-qa`.
