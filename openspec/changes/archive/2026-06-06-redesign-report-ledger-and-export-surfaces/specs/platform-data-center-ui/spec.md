## ADDED Requirements

### Requirement: Data snapshots support report-ledger export semantics
Data center and governance snapshots SHALL support report-ledger presentation for review and export contexts.

#### Scenario: Snapshot is shared or exported
- **WHEN** a data center or governance snapshot is captured for review
- **THEN** it SHALL show source quality, freshness, privacy scope, evidence/status legend, and timestamp or run context
- **AND** interactive controls SHALL not replace the required report context.

### Requirement: Report-ledger presentation does not own source page shells
Report-ledger presentation SHALL remain separate from the operational or knowledge shell that produces the report data unless route ownership is explicitly transferred.

#### Scenario: Snapshot originates from another route family
- **WHEN** a snapshot originates from data center, admin governance, teacher analytics, learner record, or Arena surfaces
- **THEN** report-ledger presentation SHALL preserve report/export semantics without replacing the source route's owning shell
- **AND** any shell ownership transfer SHALL be declared in the route ledger.
