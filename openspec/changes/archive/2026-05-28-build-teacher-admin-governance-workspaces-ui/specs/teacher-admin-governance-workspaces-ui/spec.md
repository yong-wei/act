## ADDED Requirements

### Requirement: Teacher governance workspace consumes authorized ResourceNode management
The system SHALL provide teacher governance UI that presents authorized ResourceNode browse, search, review, warning inspection, and permitted single-node edit affordances from the `teacher-resource-node-management` capability.

#### Scenario: Teacher opens ResourceNode management
- **WHEN** a teacher opens the ResourceNode management workspace
- **THEN** the UI SHALL surface the `teacher-resource-node-management` browse/filter/review affordances for node type, course/module, knowledge mapping, availability, privacy level, teacher policy, evidence instrumentation, and path eligibility
- **AND** this change SHALL own the governance shell, status display, action placement, and redaction behavior rather than redefining ResourceNode edit rules or teacher homepage behavior.

### Requirement: Governance views protect restricted payloads
The system SHALL prevent teacher and admin governance UI from exposing restricted payloads outside their permitted role scope.

#### Scenario: Restricted evidence exists
- **WHEN** a ResourceNode, learner-state, path, Arena, simulation, or Konling record references restricted data
- **THEN** the UI SHALL show an allowed summary, restricted marker, or audit-only reference without exposing hidden official evaluation internals, raw high-frequency traces, raw answers, or private memory.

### Requirement: Admin data center distinguishes readiness from presentation metrics
The system SHALL provide admin/data-center UI that separates product presentation metrics from governance readiness and audit status.

#### Scenario: Admin reviews evidence source health
- **WHEN** an admin opens governance status
- **THEN** the UI SHALL show source coverage, readiness, unsupported states, missing context, privacy status, replay confidence, and evaluation-event health where available.
