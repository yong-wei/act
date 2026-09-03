## Why

Direct interactive resources opened from the resource library are rendered through the same shared renderer as classroom resources, but the renderer currently forces `embedded=true`. The shared runtime therefore misses the standalone launch context, keeps authenticated events in browser storage, and classifies them as classroom activity instead of durable standalone learning evidence.

This breaks the learning-process companion loop for students who study from an independent resource: their views, interactions, and completions cannot reliably enter the governed learning record after refresh, device changes, or later profile analysis.

## What Changes

- Pass an explicit launch context from the independent resource page through the shared resource renderer into `InteractiveProvider`.
- Preserve the distinction between classroom and standalone interactive resources at the runtime boundary; do not infer learning provenance from a presentation-only `embedded` flag.
- Persist authenticated standalone-resource events through the existing interactive event ingestion path, including view, interaction, and completion events.
- Classify direct-resource events with the canonical standalone surface and event types, including `interactive_resource` and `resource_view`, while preserving classroom behavior.
- Keep unauthenticated, demo, and classroom-session behavior unchanged; do not treat views or completion participation as mastery without the existing evidence policy.
- Add regression coverage for direct-resource launch, event classification, authenticated persistence, and classroom compatibility.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `interactive-governance-evidence`: standalone interactive resources must preserve explicit launch provenance and produce durable, correctly classified learner events before downstream learning-record consumers use them.

## Impact

- `src/app/interactive-learning/resources/[id]/page.tsx` and `src/features/lesson-engine/resource-renderer.tsx` launch-context propagation.
- `src/features/interactive/InteractiveProvider.tsx` and related tracking types/hooks.
- Existing `/api/interactive/events` ingestion and learning-record projections, only as required to consume the corrected standalone context.
- Interactive runtime, route, and persistence regression tests.
- No changes to official grades, leaderboard calculations, mastery claims, or classroom session semantics.
