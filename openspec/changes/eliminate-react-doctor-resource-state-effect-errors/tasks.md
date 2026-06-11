## 1. Baseline and Scope

- [ ] 1.1 Re-run React Doctor `0.5.1` error-only scan and filter state/effect diagnostics under `src/resources/interactive-learning`, `src/resources/widgets`, `src/resources/simulations`, and `src/resources/control-system`.
- [ ] 1.2 Classify each finding as resource identity reset, user interaction preservation, cleanup, mutable dependency, or simulation UI/model coupling.
- [ ] 1.3 Identify representative resource, widget, and simulation smoke paths before editing.

## 2. Implementation

- [ ] 2.1 Fix legacy `src/resources/interactive-learning/lesson-*` state/effect findings with minimal local changes.
- [ ] 2.2 Fix `src/resources/widgets/*` state/effect findings while preserving widget interaction behavior.
- [ ] 2.3 Fix `src/resources/simulations/*` and `src/resources/control-system/*` state/effect findings without changing numerical model semantics.
- [ ] 2.4 Add representative tests or smoke checks for one touched legacy resource, one touched widget, and one touched simulation cluster.

## 3. Verification

- [ ] 3.1 Run targeted unit/component tests or smoke checks for touched resource, widget, and simulation files.
- [ ] 3.2 Run any existing simulation validation relevant to touched simulation components if model state handling changes.
- [ ] 3.3 Run `npx --yes react-doctor@0.5.1 --no-score --no-telemetry --no-warnings --json .` and confirm no state/effect diagnostics remain for this change's files.
