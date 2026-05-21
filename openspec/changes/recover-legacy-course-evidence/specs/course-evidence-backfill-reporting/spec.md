## ADDED Requirements

### Requirement: Legacy recovery is dry-run first
The system SHALL report recoverable and unrecoverable legacy evidence before writing derived enrichment.

#### Scenario: Dry-run writes nothing
- **WHEN** legacy course evidence recovery runs without apply
- **THEN** it reports candidate, recoverable, unrecoverable, affected session, and affected user counts without data writes

### Requirement: Recovered evidence is traceable and honest
The system SHALL enrich only evidence recoverable from durable or final-state sources and SHALL mark final-state recovery distinctly.

#### Scenario: Unrecoverable evidence remains legacy
- **WHEN** no source contains a submitted answer for a legacy row
- **THEN** the row remains legacy or unrecoverable and no answer, score, or correctness is fabricated
