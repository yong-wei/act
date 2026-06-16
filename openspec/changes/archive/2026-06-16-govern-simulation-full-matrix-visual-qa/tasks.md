## 1. Matrix Definition

- [x] 1.1 Define the active simulation route source for the QA matrix.
- [x] 1.2 Require all seven current detail routes in desktop/mobile and light/dark themes.
- [x] 1.3 Include requested route, final URL, theme, viewport, auth/role state, screenshot path, runtime errors, tracked warnings, and visual checklist fields in the manifest.

## 2. Checklist Enforcement

- [x] 2.1 Add checklist fields for scene-first geometry, theme parity, panel top alignment, duplicate scene chrome absence, mobile reachability, dock non-overlap, and contrast.
- [x] 2.2 Add explicit checks for `/simulations/cruise` geometry against at least two non-cruise routes.
- [x] 2.3 Add explicit checks that in-scene `返回上一层` and simulation abbreviations are absent.

## 3. Design Review Gate

- [x] 3.1 Provide reviewers with `design-handoff.md`, concept images, 2026-06-15 `audit.md`, contact sheets, and implementation screenshots.
- [x] 3.2 Run independent browser-capable design review or subagent visual verification.
- [x] 3.3 Fail the gate on unresolved blocking findings and record final result as passed only when all routes pass.

## 4. Governance Validation

- [x] 4.1 Ensure this final QA change depends on internal theme, command-deck layout, and runtime-noise remediation changes.
- [x] 4.2 Run the local simulation visual QA matrix against the repaired baseline.
- [x] 4.3 Run `rtk openspec validate govern-simulation-full-matrix-visual-qa --strict`.
