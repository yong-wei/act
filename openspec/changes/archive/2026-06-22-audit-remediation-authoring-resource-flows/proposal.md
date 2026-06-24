## Why

The audit shows authoring, resource, playlist, knowledge-node, course-flow, ResourceNode, lesson-plan, and prep workflows often expose huge lists or generic pages instead of task-specific creation, preview, edit, clone, quality-report, and recovery states. These areas need a scoped remediation after P0 prep-pack stability is restored.

## What Changes

- Make teacher/admin lesson-plan create/edit/clone/search flows task-specific and recoverable.
- Turn ResourceNode and authoring governance surfaces into actionable worklists with quality report entry points.
- Fix playlist and course-flow direct links so they preserve play/start/create intent.
- Add knowledge-node selection and large-list handling suitable for course-flow authoring.
- Require audit-report remediation markers after verified authoring/resource fixes.

## Capabilities

### New Capabilities
- `audit-remediation-authoring-resource-flows`: audit remediation contract for lesson authoring, resource governance, playlists, course flows, and knowledge-node task states.

### Modified Capabilities
- None. Existing resource and teacher management specs remain the base capabilities.

## Impact

- Affects teacher lesson plans, admin lesson management, ResourceNode management, teacher resources, playlists, course-flow builder, knowledge node links, and authoring governance report routes.
- Evidence references include `chapters/60-function-state-flows-batch52.md`, `chapters/61-function-state-flows-batch53.md`, and related resource/playlist findings in `report.md`.
