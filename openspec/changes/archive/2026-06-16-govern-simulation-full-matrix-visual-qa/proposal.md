## Why

Previous virtual-simulation governance allowed representative screenshots and route markers to pass while the 2026-06-15 audit still found route-specific failures, especially `/simulations/cruise`. Final acceptance must therefore require every active simulation detail route to be visually audited against the handoff and current audit evidence.

## What Changes

- Establish a full simulation visual QA matrix covering all seven active detail routes in desktop/mobile and light/dark themes.
- Require comparison against the accepted 2026-06-13 design handoff, concept 2 command-deck reference, and 2026-06-15 audit contact sheets.
- Require independent browser-capable design review before a virtual-simulation UI change can be accepted.
- Add explicit checks for scene-first geometry, dark/light parity, panel top alignment, absence of duplicate scene chrome, dock non-overlap, mobile reachability, and runtime-noise status.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `commercial-ui-governance-gates`: strengthen simulation visual QA from representative sampling to full active-route matrix acceptance.
- `simulation-scene-shell-architecture`: require all simulation detail routes to satisfy the command-deck visual contract, not only representative pilots.

## Impact

- Affects local visual QA scripts, evidence manifests, reviewer checklists, OpenSpec acceptance for simulation UI changes, and any future simulation detail route migration.
- Depends on `harden-simulation-internal-theme-system`, `normalize-simulation-command-deck-layout`, and `clear-simulation-runtime-noise`; final QA must validate the repaired baseline instead of the current audited failure state.
- Does not implement visual fixes directly; it prevents incomplete fixes from being accepted.
