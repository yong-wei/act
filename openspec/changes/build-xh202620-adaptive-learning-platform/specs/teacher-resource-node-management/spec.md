## ADDED Requirements

### Requirement: Teachers manage path-plannable ResourceNodes
The system SHALL provide a teacher-facing ResourceNode management entrance for categorized access and management of resources that may participate in adaptive paths.

#### Scenario: Teacher browses unified resources
- **WHEN** a teacher opens the ResourceNode management entrance
- **THEN** the teacher SHALL be able to browse and search resources by node type, course/module, knowledge mapping, availability, teacher policy, privacy level, and path eligibility
- **AND** resources SHALL include existing interactive components, knowledge nodes/cards, media, handouts, quizzes, simulations, Arena tasks, reflections, AI interventions, and projects when registered.

#### Scenario: Teacher edits planning metadata
- **WHEN** a teacher updates a ResourceNode they are authorized to manage
- **THEN** the system SHALL allow editing teacher policy, availability, display metadata, prerequisites, knowledge mappings, estimated time, cognitive load, and path eligibility where the resource type permits it
- **AND** immutable system-owned fields such as source id, protocol version, and hidden evaluation internals SHALL remain protected.

### Requirement: Resource management shows governance quality
The system SHALL show mapping and evidence quality states for ResourceNodes.

#### Scenario: Resource has missing mappings
- **WHEN** a ResourceNode lacks required knowledge mapping, renderer/launcher binding, policy, or evidence instrumentation
- **THEN** the management entrance SHALL show a warning state
- **AND** the node SHALL be excluded from adaptive paths unless explicitly allowed by policy.

#### Scenario: Stage 1 management stays focused
- **WHEN** the Stage 1 MVP teacher entrance is enabled
- **THEN** it SHALL support categorized browse/search, single-node review, warning visibility, availability, privacy level, teacher policy, and path eligibility controls
- **AND** bulk import, bulk remapping, automatic metadata repair, and deep analytics MAY be deferred to Stage 2.

### Requirement: Teacher scope is enforced
The system SHALL restrict teacher management operations to authorized courses, classes, and resources.

#### Scenario: Teacher tries to manage unauthorized resource
- **WHEN** a teacher attempts to edit a ResourceNode outside their authorized scope
- **THEN** the system SHALL reject the operation
- **AND** it SHALL NOT reveal private student evidence, hidden Arena evaluation details, or private Konling memory.
