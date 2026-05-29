## Why

The active simulation, Arena, evidence, ResourceNode, learner-state, path, Konling, teacher-management, and experiment changes all expose state that must be understood by users: source coverage, confidence, privacy, replay status, official versus preview evaluation, mapping readiness, and fallback reasons. Without shared UI primitives every product area will invent incompatible status language.

## What Changes

- Define shared UI primitives for confidence, source coverage, privacy scope, replay/checksum, protocol version, official/preview boundary, readiness, missing context, and fallback state.
- Provide status layouts for compact chips, inline explanations, detail panels, audit rows, and empty/error states.
- Align status semantics with active OpenSpec contracts without redefining their data ownership.

## Capabilities

### New Capabilities
- `platform-status-and-evidence-ui`: Defines common display semantics for evidence, confidence, privacy, replay, protocol, evaluation, and readiness states.

## Impact

- Affects shared UI primitives and downstream simulation, Arena, ResourceNode, adaptive, teacher, and admin surfaces.
- Depends on `unify-platform-design-system-and-shell` and consumes future contracts from active evidence and adaptive changes.
