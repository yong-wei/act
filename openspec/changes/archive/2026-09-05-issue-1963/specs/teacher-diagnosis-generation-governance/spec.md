## ADDED Requirements

### Requirement: Class report generation freezes deterministic metric snapshots

Class-scope diagnosis report generation SHALL compute a versioned, privacy-safe structured metric snapshot server-side inside the generation task's frozen evidence cutoff and persist it in the same successful persistence boundary as the report. Model output SHALL NOT generate or mutate metric values.

#### Scenario: Snapshot is persisted with the report

- **WHEN** a new class diagnosis report is successfully persisted
- **THEN** a metric snapshot SHALL be written in the same successful boundary, traceable to the same generation job and evidence cutoff
- **AND** the snapshot SHALL carry metric schema version, computation version, report scope, a class member-set identity that does not expose learner ids, evidence cutoff time, seven ability-dimension means with average confidence and included/missing counts, assignment and assessment means with their own included/missing counts, current risk distribution, weak knowledge point identities with weak-student counts and covered counts, and per-metric availability or limitation status.

#### Scenario: Missing dimensions stay unavailable

- **WHEN** a metric dimension lacks governed evidence at the frozen cutoff
- **THEN** the snapshot SHALL record it as unavailable or null
- **AND** it SHALL NOT be zero-filled or derived from report summary or findings text.

#### Scenario: Model text cannot mutate metrics

- **WHEN** the provider returns narrative or findings content
- **THEN** that content SHALL only populate report prose fields
- **AND** metric snapshot values SHALL come from the deterministic server computation alone.

#### Scenario: Historical reports are never recomputed

- **WHEN** reports generated before this capability are read
- **THEN** no snapshot SHALL be backfilled or recalculated for them
- **AND** they SHALL remain queryable through the existing report history contract.
