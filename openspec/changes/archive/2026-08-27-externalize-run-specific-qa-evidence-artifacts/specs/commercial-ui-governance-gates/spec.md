# Commercial UI Governance Gates (Delta)

## ADDED Requirements

### Requirement: Commercial UI capture uses the externalized evidence lifecycle

Commercial UI capture SHALL continue to honor the explicit service URL,
development revision probe, Dock readiness, temporary staging, transactional
publication, and existing route/theme/viewport/role/browser gate matrix. Its
accepted source-controlled inputs SHALL be deterministic fixtures and portable
manifests; run-specific outputs SHALL be external references verified by hash.
Missing, stale, mismatched, or privacy-unsafe evidence SHALL fail closed. This
requirement SHALL NOT change product selectors, UI state semantics, or the
existing commercial gate matrix.

#### Scenario: The stabilized capture runner publishes evidence

- **WHEN** the runner passes its explicit URL, revision, readiness, and capture
  checks
- **THEN** it publishes a portable manifest and external references for the
  run-specific outputs
- **AND** the existing commercial route/state/theme/viewport/role assertions
  remain the gate's source of truth

#### Scenario: A run output is missing or stale

- **WHEN** a manifest cannot fetch its external output or its hash/revision does
  not match
- **THEN** the commercial UI governance gate fails closed
- **AND** it does not substitute an arbitrary local screenshot or change the
  product gate state

#### Scenario: A product review uses stable evidence

- **WHEN** a product review page is built or tested
- **THEN** it consumes an approved representative fixture or validated manifest
  package
- **AND** it does not import a timestamped run-specific artifact

