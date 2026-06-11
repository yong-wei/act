## 1. Baseline and Scope

- [ ] 1.1 Re-run React Doctor `0.5.1` error-only scan and filter state/effect diagnostics under `src/features/interactive`.
- [ ] 1.2 Classify each finding by course identity boundary: step, module, activity, resource, viewer role, or non-identity parent re-render.
- [ ] 1.3 Identify touched units and their existing manifest/runtime validation commands before editing.

## 2. Implementation

- [ ] 2.1 Fix `src/features/interactive/shared/*` findings, including media hub and teacher join dialog behavior.
- [ ] 2.2 Fix manifest runtime activity renderer findings without changing module payload or activity state contracts.
- [ ] 2.3 Fix unit-specific `src/features/interactive/unit-*` state/effect findings.
- [ ] 2.4 Add representative tests or browser checks for step change reset, same-step answer preservation, teacher view state, and media panel state.

## 3. Verification

- [ ] 3.1 Run relevant interactive manifest and runtime contract gates for touched units.
- [ ] 3.2 Run targeted unit/component tests or browser checks for touched student and teacher flows.
- [ ] 3.3 Run `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .` and confirm no state/effect diagnostics remain for `src/features/interactive`.
