## ADDED Requirements

### Requirement: Full-feature arm assembles multi-source evidence with production parity

The fair experiment full-feature arm SHALL assemble its citation context through the same per-unit source allocation used by the production path, instead of a single frozen citation or a static pre-orchestrated binding, and SHALL freeze the resulting citations with the answer record.

#### Scenario: Runtime context carries the allocation

- **WHEN** a full-feature task generates an answer
- **THEN** the runtime context SHALL include a citation context built by the production allocation module with per-unit mappings
- **AND** the frozen record SHALL contain the real citation snapshot instead of an undefined placeholder.

#### Scenario: Fixture assembly goes through the same module

- **WHEN** the fixture entry generates full-feature answers
- **THEN** evidence assembly SHALL use the same allocation module with multiple sources rather than a static citation list with pre-bound markers.

#### Scenario: Frozen inputs stay revision-bound

- **WHEN** evidence assembly is added to the experiment
- **THEN** provenance closure SHALL be preserved: per-record git revision, manifest payload hash, and mixed-configuration rejection continue to apply
- **AND** the plain and enhanced baselines SHALL keep zero citation capability with 0/0 metrics reported as N/A.

#### Scenario: Per-intent coverage failures are visible

- **WHEN** the official summary reports citation coverage
- **THEN** miss-reason buckets SHALL be exported by intent, including code-debug, open-explain, and normative
- **AND** a failing intent SHALL be identifiable without relying on the overall average.
