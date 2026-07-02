## ADDED Requirements

### Requirement: Governance risks shall be actionable objects
Admin governance risk rows SHALL support evidence review, assignment, disposition, reversible follow-up where allowed, and audit trail inspection.

#### Scenario: an admin opens a risk row
- **WHEN** an admin selects a governance risk
- **THEN** the UI SHALL show the safe risk identity, affected object, evidence action, assignment state, available disposition actions, and audit trail access.

#### Scenario: an admin assigns, resolves, ignores, reopens, or undoes a risk disposition
- **WHEN** an admin performs a supported risk governance action
- **THEN** the system SHALL persist the action result, show status and recovery, and record actor, previous state, new state, note, and affected object.

### Requirement: Governance URL intents shall resolve to action context
Governance risk URL intents SHALL open the relevant action context or a product recovery state.

#### Scenario: a governance action URL is opened
- **WHEN** an admin opens `tab=risks` with action or risk identifiers
- **THEN** the page SHALL load the target risk action context, or distinguish missing, unauthorized, already handled, and unavailable states.
- **AND** it SHALL NOT remain indefinitely in loading or fall back to an inert risk list.

### Requirement: Admin risk audit closure shall avoid archived operation-state scope
Admin risk-governance findings SHALL be closed only for row-level evidence, assignment, disposition, undo, audit, and URL intent behavior.

#### Scenario: audit report is updated
- **WHEN** this change updates the Product Design audit report
- **THEN** every closed finding id SHALL reference risk-governance evidence and SHALL NOT re-close import, config, export, no-match, or mobile table findings covered by `audit-remediation-admin-governance-operation-states`.
