# audit-remediation-admin-operations-ledger Specification

## Purpose
TBD - created by archiving change audit-remediation-admin-operations-ledger. Update Purpose after archive.
## Requirements
### Requirement: Admin operations shall produce durable operation states
Admin import, download, export, refresh, configuration save, and model/provider test operations SHALL expose operation identity, outcome, audit summary, and recovery state.

#### Scenario: User import batch
- **WHEN** an admin previews and confirms a user import
- **THEN** the UI SHALL show batch id, created/updated/failed counts, failed-row download, notification state, and rollback availability or no-rollback rationale.
- **AND** the batch record SHALL include actor id or role, source file hash, idempotency key, timestamps, operation scope, redacted artifact refs, retention policy, and audit outcome.
- **AND** failed-row downloads SHALL minimize personally identifiable information, SHALL be role-scoped to authorized admins, and SHALL expire or be revocable according to the retention policy.

#### Scenario: Configuration save
- **WHEN** an admin saves provider, model, or system configuration
- **THEN** the UI SHALL show diff summary, affected runtime scope, audit output, completion state, and recovery actions.
- **AND** duplicate saves/tests with the same idempotency key SHALL not create duplicate operation records.

#### Scenario: Upload control naming
- **WHEN** an admin reaches the user import upload control by screen reader or keyboard
- **THEN** the control SHALL expose an import-specific accessible name
- **AND** it SHALL NOT reuse unrelated labels such as search or generic admin function names.

### Requirement: Admin mobile surfaces shall keep key operations reachable
Admin governance and user/configuration pages SHALL expose primary actions and operation status without horizontal page overflow.

#### Scenario: Mobile import and governance
- **WHEN** an admin uses the page at 320px or 390px width
- **THEN** import, export, refresh, and configuration actions SHALL remain reachable
- **AND** operation status SHALL remain associated with the initiating action.
