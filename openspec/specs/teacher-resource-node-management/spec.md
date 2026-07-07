## Purpose

Provide the teacher-facing ResourceNode management surface for browsing unified resource nodes, inspecting governance warnings, and applying scoped planning metadata edits within authorized resource boundaries.
## Requirements
### Requirement: Teachers manage path-plannable ResourceNodes
The system SHALL provide a teacher-facing ResourceNode management entrance for categorized access and scoped management.

#### Scenario: Teacher browses unified resources
- **WHEN** a teacher opens the ResourceNode management entrance
- **THEN** the teacher SHALL be able to browse and search resources by node type, course/module, knowledge mapping, availability, teacher policy, privacy level, and path eligibility
- **AND** resources SHALL include registered interactive components, knowledge nodes/cards, media, handouts, quizzes, simulations, Arena tasks, reflections, AI interventions, and projects when registered.

### Requirement: Resource management shows governance quality
The system SHALL show mapping and evidence quality states for ResourceNodes.

#### Scenario: Resource has missing mappings
- **WHEN** a ResourceNode lacks required knowledge mapping, renderer/launcher binding, policy, or evidence instrumentation
- **THEN** the management entrance SHALL show a warning state
- **AND** the node SHALL be excluded from adaptive paths unless explicitly allowed by policy.

### Requirement: Stage 1 management is scoped
The system SHALL keep Stage 1 teacher management focused on single-node review and permitted edits.

#### Scenario: Teacher edits planning metadata
- **WHEN** a teacher updates an authorized ResourceNode
- **THEN** the system SHALL allow editing teacher policy, availability, display metadata, prerequisites, knowledge mappings, estimated time, cognitive load, and path eligibility where the resource type permits it
- **AND** immutable system-owned fields such as source id, protocol version, and hidden evaluation internals SHALL remain protected.

### Requirement: Teacher scope is enforced
The system SHALL restrict teacher management operations to authorized courses, classes, and resources.

#### Scenario: Teacher tries to manage unauthorized resource
- **WHEN** a teacher attempts to edit a ResourceNode outside their authorized scope
- **THEN** the system SHALL reject the operation
- **AND** it SHALL NOT reveal private student evidence, hidden Arena evaluation details, or private Konling memory.

### Requirement: Resource management audits knowledge capability readiness
The teacher-facing ResourceNode management surface SHALL expose read-only readiness for knowledge mapping, capability mapping, citation readiness, and evidence capability.

#### Scenario: Teacher reviews resource readiness
- **WHEN** a teacher or administrator opens the ResourceNode management entrance
- **THEN** each visible resource SHALL identify whether it has knowledge coverage, capability target mapping, citation target readiness, evidence instrumentation, and path eligibility
- **AND** missing required fields SHALL appear as governance warnings or blocking issues.

#### Scenario: Resource lacks capability mapping
- **WHEN** a resource lacks required capability mapping or evidence instrumentation for high-confidence adaptive path use
- **THEN** the management surface SHALL explain the missing field
- **AND** the resource SHALL be excluded from high-confidence path planning unless an explicit fallback policy permits limited use.

### Requirement: Resource governance reviews SAR suggested bindings
The ResourceNode management workflow SHALL provide an auditable review path for SAR suggested resource bindings.

#### Scenario: Reviewer opens a SAR suggested binding
- **WHEN** an authorized teacher or administrator opens a SAR suggested binding candidate
- **THEN** the workflow SHALL show the target graph node or objective, candidate resource, missing coverage type, safe SAR trace summary, provenance, limitations, and available review actions.

#### Scenario: Reviewer accepts a SAR suggested binding
- **WHEN** an authorized reviewer accepts a SAR suggested binding
- **THEN** the resulting ResourceNode or graph metadata update SHALL pass existing resource governance validation
- **AND** the audit record SHALL identify reviewer, decision, rationale, candidate id, trace summary, and affected resource or graph refs.

#### Scenario: Reviewer lacks scope
- **WHEN** a user without resource or class authorization attempts to review a SAR suggested binding
- **THEN** the system SHALL reject the action
- **AND** it SHALL NOT reveal teacher-scoped candidate evidence or restricted SAR trace details.
