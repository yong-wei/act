## ADDED Requirements

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
