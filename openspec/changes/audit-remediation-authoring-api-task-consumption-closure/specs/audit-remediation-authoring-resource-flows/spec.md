## ADDED Requirements

### Requirement: Authoring API data shall be consumed as tasks
Authoring UI surfaces that consume lesson plan, resource, ResourceNode, or knowledge-node APIs SHALL organize returned data into actionable tasks rather than inert long lists.

#### Scenario: authoring API data is available
- **WHEN** lesson plan, resource, ResourceNode, or knowledge-node APIs return records
- **THEN** the UI SHALL expose object-appropriate tasks such as edit, validate, preview, attach, inspect usage, resolve blocked state, cite, save, or archive.
- **AND** each task SHALL show whether it is available, disabled with reason, pending, saved, failed, rolled back, or not reversible.

#### Scenario: an authoring task cannot be executed
- **WHEN** a task is unavailable because of missing metadata, invalid reference, blocked ResourceNode state, permission, or unsupported rollback
- **THEN** the UI SHALL explain the reason and provide the nearest recovery action when one exists.

### Requirement: Authoring API task closure shall avoid archived flow scope
Authoring API-consumption findings SHALL be closed only for taskized API-backed lesson plan, resource, ResourceNode, and knowledge-node behavior.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference API-consumption task evidence and SHALL NOT re-close playlist save/play, graph filter, mobile builder, or button-name scope covered by `audit-remediation-authoring-knowledge-flow-polish`.
