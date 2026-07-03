## ADDED Requirements

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
