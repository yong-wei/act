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

