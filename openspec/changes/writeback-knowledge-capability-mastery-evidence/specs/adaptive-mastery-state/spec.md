## ADDED Requirements

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
