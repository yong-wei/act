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

### Requirement: Runtime logs distinguish current failures from historical residue
Runtime verification SHALL distinguish errors produced during the current check from historical log entries.

#### Scenario: A fixed runtime error remains in old logs
- **WHEN** a route smoke check succeeds and `.logs/error.log` contains older errors
- **THEN** the verification result SHALL report whether new error bytes or timestamped current-run errors appeared
- **AND** old entries SHALL NOT be treated as active failures without reproduction.

### Requirement: Environment signal is reproducible across machines
The project SHALL declare enough runtime and package-manager metadata for dependency validation to be reproducible across local worktrees, CI, and deployment hosts.

#### Scenario: Dependency hygiene is checked
- **WHEN** a clean install is performed
- **THEN** the expected Node range, package-manager version, lockfile behavior, Browserslist data state, and extraneous-package result SHALL be known
- **AND** deviations SHALL be reported as environment drift rather than mixed with application test failures.

### Requirement: Typecheck signal is restored before dependency upgrades
The project SHALL restore the TypeScript no-emit gate before using it to validate dependency or framework upgrades.

#### Scenario: Typecheck gate is run on the migration branch
- **WHEN** `npx tsc --noEmit --pretty false` is executed
- **THEN** stale route parameter fixtures, runtime field fixtures, mock generic signatures, and compiler target/lib mismatches SHALL be repaired or classified as real blockers
- **AND** the command SHALL provide a meaningful regression signal for future package changes.

### Requirement: Unit contract signal is restored before dependency upgrades
The project SHALL restore the unit-test contract gate before using it to validate dependency or framework upgrades.

#### Scenario: Unit gate is run on the migration branch
- **WHEN** `npm run test:unit` is executed
- **THEN** existing interactive manifest, module taxonomy, data-governance, lesson-map, and dynamic-route contract drift SHALL be repaired or classified as real blockers
- **AND** the command SHALL provide a meaningful runtime regression signal for future package changes.
