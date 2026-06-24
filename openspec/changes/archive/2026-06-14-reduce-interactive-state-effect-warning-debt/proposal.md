## Why

React Doctor warning diagnostics still identify effect-driven state synchronization in interactive course and shared runtime files. These warnings are lower severity than the cleared error diagnostics, but many map to real risks: stale intermediate renders, parent callbacks fired from effects, local draft resets, and step-owned reveal state being overwritten.

## What Changes

- Reduce warning-level state/effect debt in `src/features/interactive/**` and shared interactive runtime surfaces.
- Preserve course, step, module, activity, resource, and viewer identity semantics.
- Convert effect-driven parent synchronization to event-driven or derived-state models where safe.

## Capabilities

### Modified Capabilities

- `interactive-course-state-effect-safety`: extend the existing error-cleanup contract to warning-level state/effect remediation.
- `shared-react-state-effect-safety`: apply warning-level state/effect constraints to shared active surfaces touched by this change.

## Impact

- Affects interactive course student/teacher pages, manifest runtime renderers, shared lesson entry surfaces, and selected classroom/lesson-engine components.
- Does not change manifest payload contracts, scoring definitions, or lesson content.
