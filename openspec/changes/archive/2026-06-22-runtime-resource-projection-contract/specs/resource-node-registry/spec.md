## ADDED Requirements

### Requirement: Runtime ResourceNode projections preserve source-of-record ownership
The system SHALL keep planning metadata, semantic resource mappings, and projection status separate from records that own renderable content and teacher-editable resource metadata.

#### Scenario: Runtime projection sidecar is consumed
- **WHEN** a runtime lesson, knowledge card collection, infograph manifest, handout, or media asset has a projection sidecar
- **THEN** the ResourceNode registry SHALL consume only stable identity, source refs, graph bindings, path profile, evidence, readiness, review, and version metadata from the sidecar
- **AND** it SHALL keep the runtime manifest, markdown, media file, and generated image as the content source of record.

#### Scenario: Runtime step becomes a PlanningUnit
- **WHEN** a runtime lesson step is projected as a path resource
- **THEN** it SHALL have a verified route target, LearningGoal or graph bindings, knowledge coverage, ability impact, evidence instrumentation, evidence contract, estimated time, privacy, teacher policy, and human-confirmed review state
- **AND** missing or provisional fields SHALL prevent PlanningUnit creation.
- **AND** runtime projection blockers SHALL also make the base ResourceNode eligibility path-ineligible.

#### Scenario: Runtime projection evidence contract is missing
- **WHEN** a projected runtime resource lacks event source, event type, client event id policy, attempt key, source log id, dedupe key, timestamps, LearningFact policy, confidence policy, or privacy scope
- **THEN** it SHALL NOT create a PlanningUnit or mastery-affecting path node
- **AND** it MAY remain available for retrieval, citation, or authoring diagnostics according to scene policy.

#### Scenario: Runtime module is only a segment
- **WHEN** a module inside a lesson step lacks its own launch target and evidence contract
- **THEN** it MAY be projected as a ResourceSegment or CitationTarget
- **AND** it SHALL NOT become a PathNode without an audited ResourceNode projection.
