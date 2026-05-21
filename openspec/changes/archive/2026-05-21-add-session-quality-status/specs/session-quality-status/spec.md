## ADDED Requirements

### Requirement: Session quality status is computed centrally
The system SHALL compute green, yellow, or red session quality status from canonical evidence and sync metrics.

#### Scenario: Healthy session is green
- **WHEN** a session has high durable rich or partial coverage, fresh reports, fresh snapshots, and no severe unresolved sync incidents
- **THEN** the status is green with supporting metrics

#### Scenario: Weak evidence session is red
- **WHEN** a session has high legacy or missing evidence or unresolved high severity sync incidents
- **THEN** the status is red with reason codes

### Requirement: Reports expose the quality decision
Session data-quality and class reports SHALL expose the same quality status and reasons.

#### Scenario: CLI and report agree
- **WHEN** the same session is processed by the CLI report and class session report generation
- **THEN** both surfaces return the same quality status
