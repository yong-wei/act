## Purpose

Define how release-readiness signals are cataloged, classified, and owned before broad dependency or framework upgrades.
## Requirements
### Requirement: Release signal noise baseline classifies every known noisy signal
The project SHALL maintain a release signal noise baseline before broad dependency or framework upgrades.

#### Scenario: Baseline is created
- **WHEN** the baseline change is prepared
- **THEN** it SHALL record the branch, commit, command, failing summary, affected surface, classification lane, owner change, and expected disposition for each known noisy signal
- **AND** it SHALL distinguish stale noise from real blocking debt.

### Requirement: Noise baseline preserves implementation boundaries
The baseline change SHALL NOT modify application code, verification scripts, package versions, lockfiles, runtime logs, or test fixtures.

#### Scenario: Baseline is reviewed
- **WHEN** the baseline change is validated
- **THEN** it SHALL contain only OpenSpec planning artifacts
- **AND** implementation work SHALL be delegated to follow-up changes.

### Requirement: Validation commands only scan owned project surfaces
Release validation commands SHALL avoid scanning embedded sample repositories, vendored examples, or unrelated evaluation fixtures unless a command explicitly targets them.

#### Scenario: Lint validation runs
- **WHEN** the default lint command is executed
- **THEN** it SHALL scan project-owned application, script, config, and test files
- **AND** it SHALL exclude `evaluate/**/*` and other non-project sample repositories.

### Requirement: Standalone validation scripts resolve repository modules deterministically
Standalone validation scripts SHALL resolve repository modules from the repository root or a stable alias rather than from the script directory by accident.

#### Scenario: Model render policy validation runs
- **WHEN** `test:model-render-policy` is executed from the repository root
- **THEN** it SHALL import the intended `src/lib/model-render-policy` module
- **AND** it SHALL not fail with a path-derived `MODULE_NOT_FOUND` error.
