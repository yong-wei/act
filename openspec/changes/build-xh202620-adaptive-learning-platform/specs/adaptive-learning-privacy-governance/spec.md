## ADDED Requirements

### Requirement: Adaptive-learning payloads classify sensitive fields
The system SHALL classify privacy level and access scope for learner state, assessment, ResourceNode, path, Konling memory, intervention, teacher management, and evaluation payload fields.

#### Scenario: Payload contract is declared
- **WHEN** an adaptive-learning API or persisted payload is introduced
- **THEN** each field family SHALL declare whether it is student-visible, teacher-scoped, admin-scoped, audit-only, or system-internal
- **AND** sensitive raw text, raw answer bodies, private dialogue, hidden official evaluation internals, and raw traces SHALL default to restricted scopes.

### Requirement: Adaptive-learning APIs redact by role
The system SHALL redact or omit sensitive fields according to requester role and relationship scope.

#### Scenario: Teacher reads adaptive-learning data
- **WHEN** a teacher requests learner state, path explanation, intervention outcome, assessment evidence, or ResourceNode governance data
- **THEN** the response SHALL include only scoped summaries and safe references for students they teach
- **AND** it SHALL omit raw dialogue text, raw answer bodies, hidden Arena evaluation internals, private memory payloads, and raw high-frequency traces.

#### Scenario: Student reads own adaptive-learning data
- **WHEN** a student requests their own adaptive path, learner state, or Konling memory summary
- **THEN** the response SHALL expose understandable explanations and confidence markers
- **AND** it SHALL not expose teacher-only policy internals or hidden official evaluation details.

### Requirement: Privileged access is audited
The system SHALL audit privileged access to adaptive-learning data.

#### Scenario: Teacher or admin opens restricted drilldown
- **WHEN** a teacher or admin opens learner-state, assessment, path, memory, or intervention drilldown beyond public/student-visible summaries
- **THEN** the system SHALL record actor id, target user id when applicable, resource/path/session reference, access reason or surface, timestamp, and payload category
- **AND** the audit record SHALL avoid storing the sensitive raw payload itself.

### Requirement: Evaluation exports are privacy-safe
The system SHALL protect privacy in adaptive-learning evaluation and experiment exports.

#### Scenario: Metrics are exported
- **WHEN** adaptive-learning metrics are exported for evaluation
- **THEN** exported data SHALL use aggregation, pseudonymous identifiers, or scoped references as appropriate
- **AND** it SHALL include evidence completeness and low-confidence markers so privacy redaction is not misread as missing learning activity.
