## ADDED Requirements

### Requirement: ResourceNode registry covers all path-plannable resources
The system SHALL maintain a ResourceNode registry that represents every eligible path-plannable resource independently from its rendering implementation.

#### Scenario: ResourceNode types are registered
- **WHEN** the registry is audited
- **THEN** it SHALL support `lesson_step`, `knowledge_node`, `knowledge_card`, `video`, `audio`, `handout`, `quiz`, `simulation`, `arena_task`, `reflection`, `ai_intervention`, and `project` node types
- **AND** each node SHALL include a stable id, title, resource type, `sourceKind`, `sourceRef`, render target or launch target, and eligibility status.

#### Scenario: Existing resources are backfilled
- **WHEN** the ResourceNode backfill runs
- **THEN** it SHALL create or update nodes for existing TeachingResources, registered interactive components, knowledge nodes/cards, runtime lesson media, handouts, quizzes, eligible simulations, Arena tasks, reflections, AI interventions, and projects
- **AND** it SHALL report resources that cannot be safely mapped.

### Requirement: ResourceNode metadata follows source-of-record ownership
The system SHALL keep ResourceNode planning metadata separate from the source records that own renderable content and teacher-editable resource metadata.

#### Scenario: Runtime lesson media is mapped
- **WHEN** a video, audio file, handout, or authored media index is mapped from runtime lesson content
- **THEN** the ResourceNode SHALL store planning metadata and a `sourceKind`/`sourceRef` pointer
- **AND** the runtime lesson media index SHALL remain the source of record for authored media references until that asset is promoted into managed `TeachingResource` metadata.

#### Scenario: TeachingResource and runtime source overlap
- **WHEN** the same asset has both a managed `TeachingResource` record and a runtime lesson media reference
- **THEN** teacher-editable catalog metadata SHALL be owned by `TeachingResource`
- **AND** ResourceNode SHALL link to both references without copying raw content or making duplicate ownership claims.

### Requirement: ResourceNode graph carries planning metadata
The system SHALL store planning metadata needed by the adaptive path planner.

#### Scenario: Node metadata supports constraints
- **WHEN** a ResourceNode is used for path planning
- **THEN** it SHALL expose prerequisites, estimated time, cognitive load, knowledge coverage, ability impact, cost, availability, teacher policy, privacy level, and terminal environment constraints where available.

#### Scenario: Edges support prerequisite and related-resource traversal
- **WHEN** the path planner reads the resource graph
- **THEN** it SHALL be able to traverse prerequisite, remedial, extension, alternative, and related edges
- **AND** edge provenance SHALL indicate whether the edge came from the knowledge graph, teacher policy, resource metadata, or system backfill.

### Requirement: Registry audits protect path quality
The system SHALL provide registry audits for path-eligible resources.

#### Scenario: Ineligible resource is reported
- **WHEN** a resource lacks a render target, launch target, knowledge mapping, valid prerequisites, availability, or privacy policy
- **THEN** the audit SHALL mark the ResourceNode as not path-eligible
- **AND** it SHALL provide a reason suitable for teacher/admin management.
