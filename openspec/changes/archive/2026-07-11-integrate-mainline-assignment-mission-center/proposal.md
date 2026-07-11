## Why

Students currently see legacy missions and feedback tasks, but teacher-published coursework has no coherent destination, per-question submission lifecycle, or visible return path. The personal center and `/missions` need to become the operational entry for formal coursework while preserving existing progression tasks.

## What Changes

- Replace the student profile name-card `加入课堂/班级` action with a `任务中心` action while preserving class-join access in the class card.
- Make `/missions` default to `主线作业` for teacher-published assignments and rename the existing mission collection to `任务进阶`.
- Add compact mainline-assignment lists with deadline, progress, submission, grading, overdue, and resubmission states.
- Add assignment detail and response surfaces where every question has an independent text or attachment answer, draft, formal submit action, submitted attempt, and history.
- Derive the assignment state from required question submissions; do not require one assignment-level sealing action and do not accept or segment one whole-assignment document.
- Establish a private S3-compatible submission object-store contract, signed upload/finalization flow, immutable asset versions, and a local test adapter.

## Capabilities

### New Capabilities
- `student-assignment-mission-center`: Defines student task-center entry, mainline assignment presentation, per-question answer storage and formal submission, aggregate assignment state, and protected immutable assets.

### Modified Capabilities

None.

## Impact

- Affects `/profile`, `/missions`, new student assignment routes, response APIs, upload authorization, and assignment progress queries.
- Adds durable assignment envelope, question answer attempt, and asset records bound to an immutable assignment revision.
- Preserves existing Mission/UserProgress and feedback-task behavior under `任务进阶`.
- Depends on `establish-assignment-authoring-domain` and does not implement document conversion, grading, teacher return commands, or feedback.
