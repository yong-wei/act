## Why

The latest React Doctor error-only scan reports 48 error diagnostics across legacy interactive resources, reusable widgets, simulations, and control-system charts. These surfaces are still used by course pages, control workbench previews, and teaching resources, so state/effect defects can show stale models, stale deck state, or leaking callbacks.

This change clears resource and simulation React Doctor error diagnostics while preserving numerical model semantics and legacy resource behavior.

## What Changes

- Repair React Doctor error diagnostics under:
  - `src/resources/interactive-learning/**`
  - `src/resources/simulations/**`
  - `src/resources/widgets/**`
  - `src/resources/control-system/**`
- Replace effect-based prop state synchronization with derived values, keyed state envelopes, or safe render-time adjustment patterns.
- Clean up timers, animation callbacks, subscriptions, and mutable dependencies reported by React Doctor.
- Add focused regression tests or smoke checks for high-risk resource, widget, and simulation repairs.
- Validate against the owned-surface React Doctor error gate introduced by `react-doctor-owned-surface-gates`.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-simulation-state-effect-safety`: Extends resource and simulation state/effect safety to require the current React Doctor error set to be cleared.

## Impact

- Affects legacy resource decks, widgets, simulations, ship model preview, control analysis panels, and Control Odyssey resource components.
- Does not change `src/features/interactive/**`; that is handled by `eliminate-interactive-react-doctor-errors`.
- Depends on `react-doctor-owned-surface-gates` for stable local validation scope.
