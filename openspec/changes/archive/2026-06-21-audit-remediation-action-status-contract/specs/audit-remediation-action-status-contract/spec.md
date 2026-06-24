## ADDED Requirements

### Requirement: Audited actions must expose a shared status lifecycle
The system SHALL represent audited user actions with explicit idle, pending, succeeded, failed, blocked, and unsupported states.

#### Scenario: Action succeeds with visible and accessible status
- **WHEN** an audited action such as save, export, approve, or writeback succeeds
- **THEN** the page shows the result, exposes a status/live announcement, and offers the next relevant action

#### Scenario: Action fails without losing context
- **WHEN** an audited action fails because of missing object, unsupported method, authorization, validation, or network error
- **THEN** the page remains in the originating workflow and shows a recoverable failure state

#### Scenario: Download action is observable
- **WHEN** an audited download or export action is triggered
- **THEN** the system either starts a browser download with a meaningful filename or shows an explicit blocked/failed state with recovery

### Requirement: Audit remediation must not rely on silent visual changes
The system SHALL verify each closed action-state audit finding with DOM or browser evidence that captures visible status and accessible announcement behavior.

#### Scenario: Alert/live gap is closed
- **WHEN** a finding previously recorded `alerts=0` for an action state
- **THEN** the remediation evidence records the new status/live behavior and the audit report references that evidence
