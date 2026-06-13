# react-doctor-local-governance Specification

## Purpose
Define the local-only React Doctor governance boundary for owned project surfaces, including pinned execution, fixture-root exclusion, blocker channels for errors and Security diagnostics, and advisory warning evidence that remains outside CI by default.

## Requirements
### Requirement: React Doctor scans owned project surfaces
The system SHALL run local React Doctor validation against project-owned application, script, configuration, and test surfaces while excluding embedded sample repositories, generated fixtures, and unrelated evaluation corpora.

#### Scenario: Error-only scan runs
- **WHEN** a developer runs the local React Doctor error gate
- **THEN** the scan SHALL exclude `evaluate/**/*` and other declared non-product fixture roots
- **AND** the report SHALL identify the command, React Doctor version, included roots, excluded roots, and diagnostic summary

#### Scenario: Full advisory scan runs
- **WHEN** a developer runs the local React Doctor warning summary
- **THEN** warning diagnostics SHALL be grouped by severity, category, rule, and owned surface
- **AND** sample repository findings SHALL NOT be mixed into product warning counts

### Requirement: React Doctor blocker channels are explicit
The system SHALL expose separate local React Doctor channels for error-level blockers and Security category warnings.

#### Scenario: Error channel is clean
- **WHEN** the error-only React Doctor gate completes with zero diagnostics
- **THEN** the command SHALL exit successfully and produce machine-readable evidence

#### Scenario: Security warning channel is clean
- **WHEN** the Security category React Doctor gate completes with zero diagnostics
- **THEN** the command SHALL exit successfully and produce machine-readable evidence

### Requirement: React Doctor local gate remains CI-free
The system SHALL keep React Doctor execution local-only until CI quota and project policy explicitly allow CI wiring.

#### Scenario: Governance tests inspect workflows
- **WHEN** project governance tests inspect GitHub Actions workflows
- **THEN** React Doctor commands SHALL NOT be required in CI workflows
- **AND** local documentation SHALL remain the source for running the gate manually
