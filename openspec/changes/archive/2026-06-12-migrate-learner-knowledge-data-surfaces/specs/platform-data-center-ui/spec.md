## ADDED Requirements

### Requirement: Knowledge and data surfaces share evidence map semantics
Knowledge graph, evidence browser, learner record, and data center surfaces SHALL share source quality, freshness, privacy, confidence, and status semantics when migrated to the knowledge-data-map archetype.

#### Scenario: Evidence-backed data is shown
- **WHEN** a migrated knowledge or data surface displays evidence, graph, source, freshness, privacy, confidence, or unsupported state information
- **THEN** the UI SHALL use shared evidence map semantics and platform shell navigation
- **AND** it SHALL not introduce page-local status vocabularies or unmanaged visual palettes.
