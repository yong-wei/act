## Why

The adaptive learning center exposes an adjustment action for generated candidates, but the current revision path does not persist a new candidate batch or refresh the comparison workspace. It can compute revised data while leaving the student on the original candidates, and it records the revision as a path switch even though the student has not selected anything. This makes adjustment visibly ineffective and corrupts the distinction between generating alternatives and choosing an active path.

## What Changes

- Treat adjustment as a derivation from one persisted source candidate rather than an in-place path mutation.
- Persist each materially changed adjustment result as a new immutable candidate batch linked to its source batch, source candidate, request snapshot, and active-progress version.
- Return an explicit `no_material_difference` outcome when governed facts cannot produce a real path change.
- Invalidate stale adjustment requests when their batch, candidate, request identity, or active-progress version no longer matches.
- Refresh the existing comparison workspace with the authorized derived batch while preserving the current active path and execution state.
- Apply an adjusted candidate only after an explicit student selection through the existing path-choice endpoint.
- Stop recording adjustment completion as `action: switch` or other path-selection evidence.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-path-candidate-batches`: Define immutable derived batches, source identity, adjustment snapshots, material-difference outcomes, and stale-result handling.
- `adaptive-learning-center-ui`: Make candidate adjustment produce a visible derived comparison without changing the active path until explicit selection.
- `konling-agent-runtime`: Separate audited adjustment execution from path-choice evidence and return the persisted derived batch identity.
- `adaptive-learning-path-planning`: Require adjusted alternatives to be grounded in a stable source candidate and to differ materially in governed path facts.

## Impact

- Candidate-batch persistence metadata and server projection.
- Path-advisor revision lifecycle and structured result contracts.
- Adaptive learning center adjustment controls, route state, stale-request handling, and comparison refresh.
- Path-choice audit semantics and regression coverage.
- No database migration, planner ranking redesign, active-path mutation, or changes to existing generation, comparison, deep-link, resume, selection, and execution behavior.
