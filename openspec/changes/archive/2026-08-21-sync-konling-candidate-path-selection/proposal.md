## Why

Phase B made planner candidates durable and addressable, but a student still cannot complete path selection through Konling. Phase C closes that loop without allowing assistant prose or a fresh model inference to replace the persisted candidate batch as the authority.

## What Changes

- Add a governed Konling action that resolves a student's natural-language choice only against one authorized persisted candidate batch.
- Select a path through the existing path-choice API only when the request identifies exactly one candidate; preserve structured alternatives and ask a bounded clarification question when the request is ambiguous.
- Keep candidate order, labels, snapshots, and recommendation provenance unchanged; Konling explains planner output but does not rerank or rewrite it.
- After selection, synchronize the adaptive path center to the selected batch and candidate while leaving learning execution idle until the student explicitly starts it.
- Add consistency tests spanning conversation action, choice persistence, path-center refresh, ambiguity handling, authorization, idempotency, and no-auto-start behavior.

## Capabilities

### New Capabilities

- `konling-candidate-path-selection`: Governs natural-language resolution, clarification, selection, and path-center synchronization over immutable adaptive-path candidate batches.

### Modified Capabilities

- `konling-agent-runtime`: Expose candidate-selection actions and clarification turns backed by persisted candidate identities.
- `adaptive-learning-center-ui`: Refresh the selected candidate state from the same batch without automatically launching path execution.

## Impact

- Konling runtime action contracts and server-side candidate resolution.
- Existing adaptive path choice route and authorized candidate-batch reads.
- Global assistant/path-center client synchronization and deep-link state.
- Unit, route, integration, and browser evidence for Issue #1140 Phase C.
