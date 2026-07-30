## ADDED Requirements

### Requirement: Current student risks use deterministic transitions

The system SHALL scan only `constraint`, `stagnation`, and `cross_domain` as current diagnosis risks. A governed evaluation SHALL deterministically create, update, resolve, or preserve each current flag. Legacy `participation` and `ai_misuse` records SHALL remain excluded from current diagnosis output.

#### Scenario: A current risk rule becomes true

- **WHEN** governed evidence satisfies a current risk rule and no active flag exists
- **THEN** the scanner SHALL create the corresponding current risk flag with severity, summary, evidence cutoff, and governed references.

#### Scenario: A current risk rule changes or clears

- **WHEN** governed evidence changes the supported severity or summary
- **THEN** the scanner SHALL update the active flag
- **AND WHEN** governed evidence clears the rule
- **THEN** the scanner SHALL resolve the active flag with a deterministic resolution reason.

#### Scenario: No relevant governed fact changes

- **WHEN** the evidence used by a current rule is unchanged
- **THEN** the scanner SHALL preserve the current flag state.

### Requirement: Risk scanning is executable and bounded

The system SHALL provide a scheduled queue consumer and a standalone scan command. Population scanning SHALL use bounded cursor pages and SHALL isolate rule failures so one failure does not prevent other rules or students from being processed.

#### Scenario: Scheduled population scan runs

- **WHEN** the risk scan scheduler dispatches a job
- **THEN** a registered worker SHALL consume the job
- **AND** it SHALL report scanned, created, updated, resolved, unchanged, and failure counts.
