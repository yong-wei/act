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

### Requirement: ResourceNode graph supports planning constraints
The system SHALL expose graph edges and metadata needed by downstream adaptive path planning.

#### Scenario: Planner reads upgraded ResourceNode graph profile
- **WHEN** the planner reads ResourceNodes for a graph-driven LearningGoal
- **THEN** it SHALL be able to access graph node refs, scene availability, citation readiness, evidence capability, prerequisites, estimated time, cognitive load, availability, teacher policy, privacy level, terminal constraints, readiness, and governance limitations
- **AND** it SHALL continue to expose planner-readable `knowledgeCoverage`, `abilityImpact`, `cost`, and remedial, extension, alternative, and related edge semantics used by path scoring and PathNode conversion.
- **AND** these fields SHALL come from audited ResourceNode or ResourceSemanticProjection metadata rather than raw source content.

### Requirement: Registry audits protect path quality
The system SHALL audit path-eligible resources.

#### Scenario: Segment is retrievable but not path eligible
- **WHEN** a resource segment or retrieval chunk has graph binding or citation readiness but lacks ResourceNode path audit approval
- **THEN** the audit SHALL keep it out of path generation
- **AND** diagnostics SHALL distinguish retrieval readiness from path eligibility.

#### Scenario: ResourceNode is incomplete
- **WHEN** a ResourceNode lacks a verified render or launch target, knowledge mapping, valid prerequisite references, availability, privacy policy, or evidence instrumentation required for path execution
- **THEN** the audit SHALL mark the node as not path-eligible
- **AND** diagnostics SHALL identify the missing governance field rather than treating segment or chunk readiness as a substitute for ResourceNode path audit approval.

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

### Requirement: Resource field completion audit protects path quality
The system SHALL audit path-eligible resources.

#### Scenario: Resource field completion is audited
- **WHEN** a resource candidate is inventoried for future path planning
- **THEN** the audit SHALL record missing identity, source, graph binding, path profile, evidence, readiness, grounding, version, and review-state fields
- **AND** it SHALL classify each missing field by completion method: manual, local-model-assisted, external-tool-assisted, generated-provisional, already-governed, or blocked.
- **AND** it SHALL record evidence-contract completeness, including event source, event type, client event id policy, attempt key, source log id, dedupe key, timestamps, LearningFact materialization policy, confidence policy, and privacy scope.

#### Scenario: Generated metadata is provisional
- **WHEN** local model, vision model, transcript tooling, OCR, prompt extraction, or another automated process supplies resource semantics
- **THEN** the resulting fields SHALL remain provisional until a human-confirmed review state is recorded
- **AND** provisional fields SHALL NOT make a ResourceNode path-eligible, mastery-affecting, or terminal-validation-capable.

#### Scenario: Human confirmation is audited
- **WHEN** a provisional or manually completed field set is promoted to human-confirmed
- **THEN** the audit SHALL record reviewer id, reviewer role, reviewed time, review batch id, reviewed source hash, reviewed version ref, generation tool or model where applicable, prompt or manifest hash where applicable, confidence, and stale invalidation rules
- **AND** a source hash, version, prompt hash, or generation-tool version change SHALL make the confirmed field set stale until it is reviewed again.

#### Scenario: Evidence contract is incomplete
- **WHEN** a ResourceNode lacks event attribution, dedupe, attempt, timestamp, LearningFact policy, confidence, or privacy fields required by its evidence behavior
- **THEN** the ResourceNode SHALL be blocked from path eligibility or mastery effect according to policy
- **AND** diagnostics SHALL identify the missing evidence-contract field.

#### Scenario: Completion audit feeds diagnostics
- **WHEN** a ResourceNode or resource segment is blocked from PlanningUnit creation
- **THEN** diagnostics SHALL expose the exact missing field codes and review state
- **AND** it SHALL distinguish path eligibility from retrieval, citation, and authoring-triage readiness.
