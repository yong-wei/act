## 1. Shared Local Tool Layer

- [x] 1.1 Add a shared simulation-local workspace layer for side panels, hints, and bottom toolbar.
- [x] 1.2 Define local-tool templates for heading-control, DP/positioning, comfort/frequency, and ice-propulsion families.
- [x] 1.3 Keep simulation runtime children inside the primary instrument area without changing runtime imports.

## 2. Route Adoption

- [x] 2.1 Apply heading-control tooling to Destroyer, LNG, and Container.
- [x] 2.2 Apply DP/positioning tooling to Drilling and Dredger.
- [x] 2.3 Apply comfort/frequency tooling to Cruise while preserving Arena submission context.
- [x] 2.4 Apply ice-propulsion tooling to Icebreaker.

## 3. Verification

- [x] 3.1 Update source contracts for local panel, mobile secondary-control, hint, and bottom-toolbar markers.
- [x] 3.2 Update representative route smoke coverage for the local tool workspace.
- [x] 3.3 Run focused tests and `rtk openspec validate standardize-simulation-local-tools-and-panels --strict`.
