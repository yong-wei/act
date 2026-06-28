# structured-associative-retrieval Specification

## Purpose
TBD - created by archiving change define-structured-associative-retrieval-contract. Update Purpose after archive.
## Requirements
### Requirement: SAR contract defines governed associative events and entities
The system SHALL define a structured associative retrieval contract over existing platform identifiers without copying raw governed content.

#### Scenario: Retrieval event is created
- **WHEN** a SAR event is created from course content, resource governance, learner evidence, grading, simulation, Arena, path, diagnosis, teacher report, Konling, or prep-pack data
- **THEN** the event SHALL include stable id, event type, title, safe summary, source owner, source ref, authority level, privacy scope, freshness, and content hash where available
- **AND** it SHALL NOT include restricted raw content, hidden evaluation internals, private Konling memory, raw learner submissions, or audit-only traces.

#### Scenario: Retrieval entity is created
- **WHEN** a SAR entity is created
- **THEN** it SHALL include entity type, canonical platform ref, label, aliases, and privacy scope
- **AND** platform stable ids SHALL be preferred over LLM-extracted free text.

### Requirement: SAR relations preserve role, confidence, and provenance
The system SHALL represent event/entity associations as auditable relations.

#### Scenario: Event is associated with an entity
- **WHEN** a SAR event references a graph node, objective, resource, citation, path node, learner evidence, class, or student
- **THEN** the relation SHALL include role, confidence in the range 0 to 1, and source provenance such as deterministic id, metadata projection, teacher approval, or LLM extraction.

### Requirement: SAR does not verify final citations
SAR SHALL provide associative candidates and traces but SHALL NOT be the final citation verifier.

#### Scenario: A downstream consumer needs verified citations
- **WHEN** a SAR result includes citation target refs or retrieval chunk refs
- **THEN** final citation verification, address resolution, and CitationChip payload construction SHALL remain owned by the governed citation layer or Source Pack consumer
- **AND** SAR SHALL expose limitations rather than presenting candidates as verified citations.

