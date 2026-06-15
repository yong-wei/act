## 1. Diagnose Shared Error

- [ ] 1.1 Reproduce `Cannot read properties of null (reading 'classList')` on at least two simulation routes.
- [ ] 1.2 Locate the shared effect, shell, dock, theme, or local-tool code path producing the null access.
- [ ] 1.3 Fix the root cause with targeted behavior preservation, not a broad silent catch.

## 2. Clear Three.js Warnings

- [ ] 2.1 Locate `THREE.Clock` usage or wrapper usage that produces the deprecation warning.
- [ ] 2.2 Replace it with the supported timing API for the installed Three.js version.
- [ ] 2.3 Locate `PCFSoftShadowMap` usage and replace or configure the supported shadow map setting.

## 3. QA Instrumentation

- [ ] 3.1 Extend local simulation screenshot capture to record page errors and tracked console warnings.
- [ ] 3.2 Add local route checks or React Doctor-compatible commands for affected simulation routes without adding GitHub Actions.
- [ ] 3.3 Confirm all seven simulation details produce clean tracked runtime-noise reports.

## 4. Validation

- [ ] 4.1 Run relevant unit or integration tests for changed shell/effect code.
- [ ] 4.2 Run browser capture for all seven routes and verify page errors/tracked warnings are absent.
- [ ] 4.3 Run `rtk openspec validate clear-simulation-runtime-noise --strict`.
