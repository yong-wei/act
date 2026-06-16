# resource-node-registry Specification

## Purpose
Defines the ResourceNode planning contract and audit builder used to map verified platform resource records into adaptive-learning path candidates without copying renderable content or teacher-owned catalog metadata.
## Requirements
### Requirement: ResourceNode registry builder covers supplied path-plannable resource records
The system SHALL provide ResourceNode contracts and a registry builder that represent supplied path-plannable resource records independently from their rendering implementation.

#### Scenario: ResourceNode types are registered
- **WHEN** supplied resource records are mapped and audited
- **THEN** it SHALL support existing resource node types and the adaptive path semantics required by the path center
- **AND** each node SHALL include stable id, title, resource type, path display semantics, `sourceKind`, `sourceRef`, render target field, launch target field, and eligibility status.
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

### Requirement: Registry provides an audited control-correction seed graph
The system SHALL provide a versioned ResourceNode seed graph for the `control-correction` goal.

#### Scenario: Seed graph is loaded
- **WHEN** the ResourceNode registry loads the control-correction seed graph
- **THEN** it SHALL expose path-eligible nodes for knowledge card, handout or lecture, video, quiz, simulation, Arena task, reflection, and AI intervention resources
- **AND** each node SHALL include stable id, source reference, launch target, knowledge coverage, estimated time, prerequisite edges, evidence instrumentation, privacy policy, and eligibility status.

#### Scenario: Seed node is incomplete
- **WHEN** a control-correction seed node lacks a verified launch target, knowledge mapping, evidence instrumentation, prerequisite validity, or privacy policy
- **THEN** the registry audit SHALL mark the node as not path-eligible
- **AND** it SHALL expose an audit reason suitable for teacher or admin review.

#### Scenario: Terminal validation node is registered
- **WHEN** a simulation or Arena seed node is intended to validate transfer
- **THEN** the registry SHALL mark its terminal or validation role explicitly
- **AND** downstream planners SHALL be able to require that role without hard-coding node ids.

### Requirement: ResourceNode registry supports adaptive path node semantics
The ResourceNode registry SHALL expose stable path node semantics for the adaptive learning path center.

#### Scenario: Path node types are registered
- **WHEN** supplied resource records are mapped for adaptive paths
- **THEN** the registry SHALL support `interactive_lesson`, `knowledge_card`, `adaptive_quiz`, `control_workbench`, `simulation`, `arena_task`, `external_resource`, `reflection`, `checkpoint`, and `konling` path node semantics
- **AND** each node SHALL include stable id, title, display name, icon key, launch target when applicable, evidence behavior, and eligibility status.

#### Scenario: Checkpoint node is mapped
- **WHEN** a checkpoint is added to a path
- **THEN** it SHALL include assessment purpose, criteria, required evidence, pass/fail or review state, and remediation behavior
- **AND** it SHALL be distinguishable from ordinary learning resources in downstream payloads.

### Requirement: External resources are governed before path eligibility
External resources SHALL be audited before they can appear as path-eligible nodes.

#### Scenario: External resource is complete
- **WHEN** an external resource is registered for path use
- **THEN** it SHALL include title, source, URL, estimated time, knowledge coverage, applicable goal, evidence-use status, and privacy policy
- **AND** it MAY become path-eligible after audit.

#### Scenario: External resource is incomplete
- **WHEN** an external resource lacks required metadata, safe URL policy, knowledge coverage, or evidence-use status
- **THEN** the audit SHALL mark it as not path-eligible
- **AND** teacher/admin diagnostics SHALL explain the missing governance field.

### Requirement: Path icon semantics are centralized
Path resource icons and visual shape hints SHALL be generated from a central contract rather than page-local mapping.

#### Scenario: Path payload is consumed by UI
- **WHEN** path comparison, execution, or history UI renders a path node
- **THEN** the node SHALL provide stable type, display name, icon key, shape hint, and evidence status
- **AND** each surface SHALL render the same type with the same core visual semantics.

### Requirement: Resource nodes expose adaptive path readiness metadata
ResourceNodes that can appear in adaptive learning paths SHALL expose readiness metadata when their execution depends on prior competency, evidence, completed nodes, or external outcomes.

#### Scenario: Heavy node is registered for path planning
- **WHEN** a ResourceNode represents Arena, advanced simulation, control workbench validation, terminal validation, or another high-complexity path node
- **THEN** its path metadata SHALL declare minimum competency, minimum evidence count, required completed node ids, required outcome references, unlock message, and fallback node ids where applicable
- **AND** the metadata SHALL be available to the adaptive path planner without requiring the student UI to infer readiness from display text.

#### Scenario: Readiness metadata is missing
- **WHEN** a high-complexity ResourceNode lacks audited readiness metadata
- **THEN** the planner SHALL treat the node as not immediately executable
- **AND** the node MAY appear only as a locked future milestone with a student-facing preparation message.
