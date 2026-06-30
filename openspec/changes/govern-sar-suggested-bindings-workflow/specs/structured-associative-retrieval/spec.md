## MODIFIED Requirements

### Requirement: SAR resource gap suggestions remain draft-only
SAR SHALL provide resource gap candidates without automatically mutating graph bindings or ResourceNode governance state.

#### Scenario: Resource coverage is missing
- **WHEN** a graph node lacks RAG-indexed, citation-ready, assessment, simulation, Arena, path-eligible, or terminal validation coverage
- **THEN** Graph Center MAY request SAR candidate resources or evidence
- **AND** all candidates SHALL be marked suggested or draft until reviewed by the resource governance workflow.

#### Scenario: Suggested binding is reviewed
- **WHEN** an authorized teacher or administrator reviews a SAR suggested binding
- **THEN** the system SHALL preserve candidate provenance, trace summary, missing coverage type, reviewer decision, rationale, and audit timestamp
- **AND** only accepted suggestions SHALL be eligible to update ResourceNode or graph binding metadata through existing governance validation.

#### Scenario: Suggested binding is rejected or deferred
- **WHEN** a SAR suggested binding is rejected, deferred, invalidated, or left unreviewed
- **THEN** the system SHALL NOT mutate ResourceNode governance state or K/A/Q graph bindings
- **AND** downstream consumers SHALL continue to treat the candidate as non-authoritative.
