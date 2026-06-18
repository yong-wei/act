## MODIFIED Requirements

### Requirement: ResourceNode metadata follows source-of-record ownership
The system SHALL keep planning metadata, semantic resource mappings, and projection status separate from records that own renderable content and teacher-editable resource metadata.

#### Scenario: Unified resource semantics are mapped
- **WHEN** a runtime lesson, TeachingResource, knowledge card, media asset, simulation, Arena task, grading artifact, or external resource is mapped into unified resource semantics
- **THEN** the semantic layer SHALL store stable identity, source references, content hash where available, knowledge mapping, ability mapping, citation target references, projection status, and governance metadata
- **AND** the original source record SHALL remain the source of record for raw content, renderable payload, teacher-editable catalog fields, hidden evaluation internals, and raw learner submissions.

#### Scenario: Planning unit is path eligible
- **WHEN** a PlanningUnit is considered for adaptive path generation
- **THEN** it SHALL be represented through an audited ResourceNode or generated checkpoint contract before it can become a PathNode
- **AND** ResourceNode audit, eligibility, launch target, privacy policy, evidence instrumentation, readiness metadata, and path semantics SHALL remain authoritative.

#### Scenario: Retrieval chunk is indexed
- **WHEN** a ResourceSegment produces a RetrievalChunk
- **THEN** the chunk SHALL reference the ResourceSegment and CitationTarget
- **AND** the chunk SHALL NOT become a path-plannable node unless a separate PlanningUnit and ResourceNode audit exist.
