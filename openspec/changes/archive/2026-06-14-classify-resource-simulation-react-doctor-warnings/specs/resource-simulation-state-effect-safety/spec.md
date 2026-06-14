## ADDED Requirements

### Requirement: R3F and Three warnings are classified before remediation
Resource simulation React Doctor warning remediation SHALL classify R3F/Three JSX diagnostics before code changes are made.

#### Scenario: Scanner reports unknown properties in a Three scene
- **WHEN** React Doctor reports `no-unknown-property` for R3F intrinsic elements or custom shader materials
- **THEN** the finding SHALL be classified as scanner-noise candidate, real DOM defect, or implementation defect
- **AND** scanner-noise candidates SHALL require representative scene evidence before being accepted.

### Requirement: Resource warning remediation preserves simulation semantics
Resource and simulation warning cleanup SHALL preserve model, scene, and metric semantics.

#### Scenario: Simulation resource code is touched
- **WHEN** a simulation component changes because of warning remediation
- **THEN** R3F scanner-noise classifications SHALL include representative nonblank scene evidence and no new console or runtime errors
- **AND** any change touching model, metric, clock, scenario, controller, or physics semantics SHALL include numerical or metric regression evidence proving the displayed metric meaning is unchanged.
