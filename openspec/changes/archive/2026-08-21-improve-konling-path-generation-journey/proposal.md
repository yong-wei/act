## Why

The adaptive path center currently opens Konling and starts generation as separate actions, while retries and rapid repeated activation can create more than one path-generation run. Issue #1140 PR A needs one reliable primary action with a stable request identity and visible progress before the later journey improvements are split into separate PRs.

## What Changes

- Make the primary path-generation action open Konling and immediately start one generation request.
- Preserve one `generationRequestId` across rerenders, callbacks, duplicate activation, and retries whose outcome is unknown.
- Create a new request identity only after an explicit regeneration following a definitive terminal result.
- Expose pending, running, succeeded, and failed generation states, lock the selected goal while work is active, and show status in the Konling sidebar.
- Add route, interaction, responsive browser, and evidence records for this PR A scope.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `adaptive-learning-center-ui`: Define the one-click generation interaction, synchronous duplicate-activation guard, target lock, terminal-state behavior, and responsive status visibility.
- `konling-agent-runtime`: Define stable path-generation request identity and idempotent handling when a response is lost or the result remains unknown.

## Impact

The change affects the adaptive path advisor API, adaptive-practice generation controls, Konling sidebar status rendering, focused tests, and PR verification evidence. It adds no dependency, database migration, or public route.
