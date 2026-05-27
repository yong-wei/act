## ADDED Requirements

### Requirement: ResourceNode registry builder covers supplied path-plannable resource records
The system SHALL provide ResourceNode contracts and a registry builder that represent supplied path-plannable resource records independently from their rendering implementation.

#### Scenario: ResourceNode types are registered
- **WHEN** supplied resource records are mapped and audited
- **THEN** it SHALL support `lesson_step`, `knowledge_node`, `knowledge_card`, `video`, `audio`, `handout`, `quiz`, `simulation`, `arena_task`, `reflection`, `ai_intervention`, and `project` node types
- **AND** each node SHALL include stable id, title, resource type, `sourceKind`, `sourceRef`, render target field, launch target field, and eligibility status.
- **AND** the builder SHALL NOT invent a render or launch target when the source record does not provide a verified target.

### Requirement: ResourceNode metadata follows source-of-record ownership
The system SHALL keep planning metadata separate from records that own renderable content and teacher-editable resource metadata.

#### Scenario: Runtime lesson media is mapped
- **WHEN** authored video, audio, handout, or media index content is mapped
- **THEN** ResourceNode SHALL store planning metadata and a `sourceKind`/`sourceRef` pointer
- **AND** runtime lesson media SHALL remain the authored source until promoted into managed TeachingResource metadata.

#### Scenario: TeachingResource and runtime source overlap
- **WHEN** the same asset has both a TeachingResource record and a runtime lesson media reference
- **THEN** teacher-editable catalog metadata SHALL be owned by TeachingResource
- **AND** ResourceNode SHALL link to both references without copying raw content or claiming duplicate ownership.

### Requirement: ResourceNode graph supports planning constraints
The system SHALL expose graph edges and metadata needed by downstream adaptive path planning.

#### Scenario: Planner reads the resource graph
- **WHEN** the planner reads ResourceNodes
- **THEN** it SHALL be able to access prerequisites, estimated time, cognitive load, knowledge coverage, ability impact, cost, availability, teacher policy, privacy level, terminal constraints, and prerequisite/remedial/extension/alternative/related edges.

### Requirement: Registry audits protect path quality
The system SHALL audit path-eligible resources.

#### Scenario: Resource is incomplete
- **WHEN** a ResourceNode lacks render target, launch target, knowledge mapping, valid prerequisites, availability, or privacy policy
- **THEN** the audit SHALL mark it as not path-eligible
- **AND** it SHALL provide a reason suitable for teacher or admin management.
