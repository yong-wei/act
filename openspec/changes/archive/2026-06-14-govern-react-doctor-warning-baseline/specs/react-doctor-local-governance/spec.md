## ADDED Requirements

### Requirement: React Doctor warning baseline is classified before remediation
The system SHALL classify owned-surface React Doctor warning diagnostics before treating them as remediation work.

#### Scenario: Developer runs the warning baseline
- **WHEN** a developer runs the owned-surface React Doctor warning summary
- **THEN** the report SHALL preserve total warning counts by rule, category, owned surface, and file
- **AND** each high-volume rule family SHALL be classified as product-risk, mechanical-cleanup, tool-noise, or deferred before implementation changes are proposed.

### Requirement: Advisory warning cleanup does not weaken blocker gates
React Doctor warning remediation SHALL keep error and Security blocker channels clean.

#### Scenario: Warning remediation is validated
- **WHEN** a warning remediation change records its final evidence
- **THEN** the owned-surface error gate SHALL still report zero selected diagnostics
- **AND** the owned-surface Security gate SHALL still report zero selected diagnostics
- **AND** any remaining warning count SHALL be reported as advisory evidence rather than a CI blocker.
