## ADDED Requirements

### Requirement: Simulation visual QA covers every active detail route
Commercial UI governance SHALL require every active simulation detail route to be included in simulation visual QA after the simulation UI remediation series.

#### Scenario: Simulation visual QA matrix is planned
- **WHEN** a PR changes simulation detail shell, internal theme, local controls, scene parameters, or simulation runtime noise handling
- **THEN** the requested visual QA matrix SHALL include `/simulations/destroyer`, `/simulations/lng`, `/simulations/container`, `/simulations/cruise`, `/simulations/drilling`, `/simulations/icebreaker`, and `/simulations/dredger`
- **AND** each route SHALL include desktop and mobile viewports in light and dark themes.

### Requirement: Simulation visual QA compares against handoff and audit evidence
Commercial UI governance SHALL require simulation visual QA to compare implementation evidence against the accepted handoff and current audit baseline.

#### Scenario: Simulation evidence is reviewed
- **WHEN** visual evidence is reviewed for a simulation UI change
- **THEN** the review SHALL reference `artifacts/product-design-audits/virtual-simulation-2026-06-13/design-handoff.md`
- **AND** it SHALL reference the relevant concept image, especially `concepts/concept-2-command-deck-shell.png` for detail routes
- **AND** it SHALL compare against `artifacts/product-design-audits/virtual-simulation-2026-06-15-audit/audit.md` and contact sheets to prove audited regressions were removed rather than preserved.

### Requirement: Simulation full-matrix QA blocks unresolved visual failures
Commercial UI governance SHALL block acceptance when full-matrix simulation QA reports unresolved visual or runtime failures.

#### Scenario: Full-matrix QA is evaluated
- **WHEN** the full simulation matrix is evaluated
- **THEN** unresolved failures for scene-first geometry, theme parity, panel top alignment, duplicate scene chrome, mobile reachability, dock overlap, text contrast, or tracked runtime noise SHALL prevent the change from being accepted
- **AND** the final result SHALL state `passed` only when all active routes meet the checklist.

### Requirement: Simulation design review is independent
Commercial UI governance SHALL require an independent browser-capable design review for simulation remediation acceptance.

#### Scenario: Implementation evidence is ready
- **WHEN** screenshots, manifests, and runtime-noise reports are ready for simulation remediation
- **THEN** an independent reviewer or subagent SHALL compare them to the handoff, concept images, and audit evidence
- **AND** unresolved blocking findings SHALL prevent proposal tasks from being marked complete.
