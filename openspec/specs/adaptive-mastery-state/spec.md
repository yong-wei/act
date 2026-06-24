## Purpose

Define reproducible assessment-backed knowledge mastery state and conservative confidence handling for contextual evidence.
## Requirements
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

### Requirement: Mastery state is traceable to knowledge capability evidence
Adaptive mastery state SHALL expose traceability from knowledge nodes and capability targets to governed supporting evidence.

#### Scenario: Mastery state is read
- **WHEN** a learner mastery state is requested for a knowledge node or capability target
- **THEN** the response SHALL include mastery level or state, confidence, freshness, supporting evidence refs, source coverage, and limitations
- **AND** it SHALL distinguish target capability requirement from observed mastery evidence.

#### Scenario: Supporting evidence is weak
- **WHEN** supporting evidence is missing, stale, partial, preview-only, low-confidence, or not teacher-approved where required
- **THEN** the mastery state SHALL expose the limitation
- **AND** downstream path planning or Konling responses SHALL NOT present the state as fully verified.
