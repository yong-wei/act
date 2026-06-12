## 1. Baseline and Classification

- [ ] 1.1 Re-run the owned-surface React Doctor error gate after `react-doctor-owned-surface-gates` is available.
- [ ] 1.2 Filter diagnostics for resource, widget, simulation, and control-system paths and confirm the expected files and counts.
- [ ] 1.3 Classify each finding as identity reset, derived display state, timer/subscription cleanup, mutable dependency, async envelope, or user-editable state before editing.

## 2. Implementation

- [ ] 2.1 Fix `src/resources/interactive-learning/**` deck and Control Odyssey state/effect findings.
- [ ] 2.2 Fix `src/resources/simulations/**` findings, including cleanup and ship model preview identity reset behavior.
- [ ] 2.3 Fix `src/resources/widgets/**` findings in analogy, argument, and physics widgets.
- [ ] 2.4 Fix the `src/resources/control-system/**` control analysis panel finding without changing chart semantics.
- [ ] 2.5 Add focused tests or route/component smoke checks for high-risk resource and simulation behavior touched by the fixes.

## 3. Verification

- [ ] 3.1 Run targeted tests or smoke checks for modified resources, widgets, simulations, and control-system panels.
- [ ] 3.2 Run the owned-surface React Doctor error gate and confirm zero diagnostics under the resource paths covered by this change.
- [ ] 3.3 Run any existing simulation/control tests affected by modified files.
