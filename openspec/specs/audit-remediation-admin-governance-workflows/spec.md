## Purpose

Administrator governance remediation records the operational contracts added from the full-system product-design audit for data-governance risk actions, user imports, exports, configuration tests, and audit-report closeout.
## Requirements
### Requirement: Governance risks must support object-level actions
The system SHALL let administrators inspect, assign, resolve, export, and audit individual governance risks while reporting rollback availability explicitly.

#### Scenario: Resolve risk with missing object
- **WHEN** a governance URL references a missing risk id
- **THEN** the page shows a missing-risk recovery state and does not fall back to a generic long dashboard

#### Scenario: Resolve risk records audit trail
- **WHEN** an administrator resolves a valid risk
- **THEN** the system records actor, risk id, action, timestamp, outcome, and available follow-up or rollback status

### Requirement: User import must be batch-governed
The system SHALL expose user import preview, success count, failed rows, duplicate updates, notifications, batch audit states, and an explicit state when automatic rollback is unavailable.

#### Scenario: Mixed import result is inspectable
- **WHEN** an import contains valid rows and failed rows
- **THEN** the administrator can inspect the batch, export failures, and understand which records changed

### Requirement: Admin exports and tests must be scoped and observable
The system SHALL scope user exports, governance exports, statistics exports, and model/provider tests to the current visible target and show success or failure state.

#### Scenario: No-match user export
- **WHEN** an administrator exports a no-match user filter
- **THEN** the export state reflects an empty filtered set and does not export unrelated users

#### Scenario: Missing model test is explicit
- **WHEN** a configuration test references a missing provider or model
- **THEN** the page shows a missing-object or unsupported-test state with audit feedback

### Requirement: Admin remediation must update audit findings
The system SHALL mark administrator audit findings remediated only after object-level action, import, export, and configuration evidence exists.

#### Scenario: Governance finding is closed
- **WHEN** a governance or import finding is fixed
- **THEN** the audit report links the old finding and new evidence for the exact route/action

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

