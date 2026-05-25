## ADDED Requirements

### Requirement: Knowledge mastery is reproducible
The system SHALL compute knowledge-node mastery from persisted assessment inputs and versioned algorithms.

#### Scenario: Mastery is rebuilt
- **WHEN** mastery state is rebuilt from persisted assessment records
- **THEN** the same inputs and algorithm version SHALL produce the same mastery posterior and confidence metadata
- **AND** the rebuild SHALL expose missing or stale prerequisite evidence.

### Requirement: Assessment-backed mastery uses conservative confidence
The system SHALL distinguish assessment-backed mastery from contextual evidence.

#### Scenario: Non-assessment evidence is present
- **WHEN** browsing, media progress, graph exploration, simulation context, or Konling interaction evidence exists without calibrated assessment evidence
- **THEN** it MAY contribute context confidence or remediation signals
- **AND** it SHALL NOT by itself create high-confidence mastery.
