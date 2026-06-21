## ADDED Requirements

### Requirement: UI and API filters must share one result contract
The system SHALL ensure audited list and search pages use the same filter, pagination, and no-match semantics as their backing APIs.

#### Scenario: No-match search does not show unrelated records
- **WHEN** an audited page is opened with a no-match query
- **THEN** the visible list and API result both represent the no-match state and do not show unrelated real records

#### Scenario: Pagination is scoped to the active filter
- **WHEN** a user opens a filtered page with a page parameter
- **THEN** counts, page controls, and export/reset actions apply to the same filtered result set

### Requirement: Bad IDs and unsupported parameters must be product states
The system SHALL present missing object, invalid parameter, unauthorized, and unsupported method states as role-aware product recovery states.

#### Scenario: Missing object preserves workflow context
- **WHEN** an audited deep link references a missing student, risk, grading run, path, lesson, or resource
- **THEN** the page explains the missing object and offers recovery without silently redirecting to an unrelated home or list page

#### Scenario: Unsupported action is explicit
- **WHEN** an audited route receives an unsupported action or method
- **THEN** the UI marks the action unsupported and preserves the original task context

### Requirement: Contract fixes must update audit evidence
The system SHALL record each API/UI contract fix in the audit report with the exact source chapter and new verification evidence.

#### Scenario: Contract mismatch is closed
- **WHEN** a mismatch from batches 44-59 is fixed
- **THEN** the remediation entry cites the original finding number and the new route/API evidence
