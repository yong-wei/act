## Why

The latest React Doctor error-only scan reports 14 error diagnostics under `src/features/interactive`. These are active interactive-course runtime surfaces, so stale prop-synced state or unstable effect dependencies can affect students and teachers directly.

This change clears interactive-course React Doctor error diagnostics while preserving manifest runtime contracts, learner draft state, teacher release behavior, and route-level interaction semantics.

## What Changes

- Repair React Doctor error diagnostics in `src/features/interactive/**`, including shared lesson media, manifest activity renderers, teacher join QR dialog, multi-representation linkage, and Unit 3 interactive workspaces.
- Replace effect-driven prop-to-state synchronization with derived state, keyed identity boundaries, or render-safe adjustment patterns.
- Preserve user-edited answers and teacher state across same-identity parent re-renders.
- Add focused regression tests for representative state reset and draft preservation behavior.
- Validate against the owned-surface React Doctor error gate introduced by `react-doctor-owned-surface-gates`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `interactive-course-state-effect-safety`: Extends the interactive course state/effect contract to require the current `src/features/interactive` React Doctor error set to be cleared.

## Impact

- Affects interactive course runtime and unit workspace code under `src/features/interactive/**`.
- Does not change legacy resource decks, reusable widgets, or simulation resources; those are handled by `eliminate-resource-react-doctor-errors`.
- Depends on `react-doctor-owned-surface-gates` for stable local validation scope.
