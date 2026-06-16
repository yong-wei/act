## Why

The 2026-06-15 simulation audit captured the same page error on every simulation detail route: `Cannot read properties of null (reading 'classList')`. It also captured repeated Three.js deprecation warnings for `THREE.Clock` and `PCFSoftShadowMap`; these are not acceptable as the baseline for a commercial simulation workspace.

## What Changes

- Diagnose and fix the shared `classList` null page error across all simulation detail routes.
- Replace or wrap deprecated Three.js usage that produces `THREE.Clock` and `PCFSoftShadowMap` warnings.
- Add local browser/React Doctor or equivalent route checks so simulation detail pages cannot regress to error-level noise.
- Keep visual QA focused on real design differences by removing recurring runtime noise from the audit baseline.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `resource-simulation-state-effect-safety`: extend simulation resource safety requirements to include runtime page-error and Three.js deprecation cleanup.
- `commercial-ui-governance-gates`: require local simulation visual QA to report runtime console/page-error status alongside screenshots.

## Impact

- Affects simulation scene components, Three.js integration helpers, R3F timing/shadow configuration, and local visual QA capture scripts.
- Does not introduce CI React Doctor integration and does not change simulation physics or scoring semantics.
