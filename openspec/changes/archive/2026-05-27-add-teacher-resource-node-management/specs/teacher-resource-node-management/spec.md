## ADDED Requirements

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
