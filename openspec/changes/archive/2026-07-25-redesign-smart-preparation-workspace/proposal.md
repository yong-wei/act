## Why

The current smart-preparation page exposes one long form and raw job records, so teachers cannot reliably understand the preparation sequence, task state, deletion boundary, or the next required action. The workspace needs one commercial-quality task model that makes the complete preparation path visible without multiplying pages or cards.

## What Changes

- Replace the current page with two top-level views: `备课任务` and `课程依据`.
- Render a searchable, archivable task list beside one active task workspace.
- Present the active task as a five-stage accordion: course basis, topic and goals, class learning state, lesson generation and review, and courseware generation.
- Compute stage completion from valid persisted data plus required teacher confirmation; remove completion when a relevant edit invalidates the stage.
- Localize all task, draft, job, and stage labels and expose a concise current state and recovery action.
- Allow hard deletion before formal publication or classroom reference; afterwards allow archive only and explain the blocking references and resolution path.
- Migrate existing readable tasks into the new workspace, rendering valid structured results and resumable failures without raw JSON.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `smart-lesson-plan-authoring`: adds the task-workspace information architecture, stage completion rules, task lifecycle actions, localized status presentation, and existing-task migration contract.
- `commercial-workspace-surface-system`: adds the teacher preparation operations-console layout and responsive usability contract.

## Impact

- Affects the teacher smart-preparation route, task list and detail projections, deletion/archive APIs, localized status mapping, and migration adapters.
- Reuses the existing `SmartLessonTask`, generation jobs, approved revisions, publication references, and platform shell.
- Does not redesign the document editor, provider retry mechanics, retrieval infrastructure, or global Konling shell.
