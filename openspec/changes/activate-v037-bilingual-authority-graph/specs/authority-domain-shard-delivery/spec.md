## ADDED Requirements

### Requirement: Every public shard binds one qualified locale profile
Each localized public shard SHALL carry a locale-profile identity derived from the same immutable qualification package as its Authority and catalog envelope. Objects, relations, boundaries, details, formulas and accessible labels in one response MUST resolve from that single requested locale.

#### Scenario: English neighborhood is returned
- **WHEN** a qualified English neighborhood is requested
- **THEN** every localized record and formula accessibility label SHALL match the English receipt and shard envelope
- **AND** no Chinese, raw or cross-release fallback SHALL enter the response

#### Scenario: Locale profile drifts between responses
- **WHEN** a response's locale-profile identity differs from the active refresh generation
- **THEN** the response SHALL be rejected before client merge
- **AND** the prior complete locale frame SHALL remain authoritative
