## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: ResourceNode registry builder covers supplied path-plannable resource records
The system SHALL provide ResourceNode contracts and a registry builder that represent supplied path-plannable resource records independently from their rendering implementation.

#### Scenario: ResourceNode types are registered
- **WHEN** supplied resource records are mapped and audited
- **THEN** it SHALL support existing resource node types and the adaptive path semantics required by the path center
- **AND** each node SHALL include stable id, title, resource type, path display semantics, `sourceKind`, `sourceRef`, render target field, launch target field, and eligibility status.
- **AND** the builder SHALL NOT invent a render or launch target when the source record does not provide a verified target.
