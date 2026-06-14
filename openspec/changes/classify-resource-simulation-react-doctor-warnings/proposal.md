## Why

React Doctor reports many resource and simulation warnings, including 186 `no-unknown-property` diagnostics concentrated in R3F/Three JSX. Some resource warnings are real state/effect or accessibility issues, but R3F intrinsic elements such as `<group>`, `<mesh>`, `<boxGeometry>`, and custom shader materials are not DOM elements. Mechanical cleanup could damage simulation scenes.

## What Changes

- Classify resource and simulation warning diagnostics into real remediation, R3F/Three scanner noise, and explicit exceptions.
- Establish evidence requirements before suppressing or ignoring R3F/Three warnings.
- Remediate high-confidence resource accessibility/state warnings without changing numerical model semantics.

## Capabilities

### Modified Capabilities

- `resource-simulation-state-effect-safety`: extend resource/simulation React Doctor governance to warning classification and R3F evidence.

## Impact

- Affects `src/resources/**`, simulation scene components, resource widgets, and React Doctor warning evidence.
- Does not alter physics/control model semantics, simulation clock contracts, or course scoring.
