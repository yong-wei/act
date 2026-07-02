# audit-remediation-platform-error-status-a11y Specification

## Purpose
Define product-owned recovery states, status announcements, and transient-surface accessibility expectations for platform error and permission boundaries.
## Requirements
### Requirement: Platform errors shall render product recovery states
Invalid ids, stale links, missing objects, unauthorized role access, and classroom-code failures SHALL render product-owned recovery UI instead of raw Next errors, raw object ids, or silent redirects.

#### Scenario: Invalid object route
- **WHEN** a user opens a known platform route with an invalid object id
- **THEN** the page SHALL identify the object type and safe display reference
- **AND** it SHALL offer recovery actions such as return, search, retry, or request access
- **AND** it SHALL emit `role="alert"` or `role="status"` according to severity.

#### Scenario: Permission boundary
- **WHEN** a user reaches a route that belongs to another role
- **THEN** the UI SHALL explain the role boundary without exposing private object data
- **AND** the event SHALL be inspectable as an auditable permission state.

### Requirement: Platform transient surfaces shall have consistent focus behavior
Menus, dialogs, floating tool panels, and recovery actions SHALL expose semantic roles, keyboard order, Escape behavior, and opener focus restoration.

#### Scenario: Floating tool menu
- **WHEN** a user opens and closes a global floating tool menu by keyboard
- **THEN** focus SHALL remain inside the transient surface while it is open
- **AND** focus SHALL return to the opener after close
- **AND** mobile safe-area behavior SHALL prevent primary content obstruction.

### Requirement: P0 stability closures shall remain guarded
Registration short-password errors and prep-pack storage absence SHALL stay product recovery states.

#### Scenario: Regression check
- **WHEN** remediation validation runs
- **THEN** it SHALL prove registration validation errors do not render React child objects
- **AND** prep-pack routes do not return a raw 500 for missing storage.

### Requirement: Known bad routes shall render product recovery states
Known platform routes with invalid ids, missing context, unsupported methods, stale objects, or unauthorized role access SHALL render product-owned recovery states.

#### Scenario: a user opens a bad id, missing object, bad path, invalid lesson/session, or unauthorized role route
- **WHEN** a user opens a bad id, missing object, bad path, invalid lesson/session, or unauthorized role route
- **THEN** the page SHALL identify the safe object type, show a recovery action, and avoid raw Next 404, raw JSON, public-home redirection, or silent normal-state rendering.

#### Scenario: a classroom code, callback, returnTo, or query intent is invalid
- **WHEN** a classroom code, callback, returnTo, or query intent is invalid
- **THEN** the UI SHALL distinguish malformed input, not found, unauthorized, expired, and unsupported states.

### Requirement: API UI error semantics shall align
API routes and UI pages SHALL use aligned no-match, bad-id, missing-context, and unsupported-method semantics.

#### Scenario: UI search/filter query returns no records
- **WHEN** UI search/filter query returns no records
- **THEN** the API SHALL return the same no-match result set that the UI displays.

#### Scenario: an API rejects bad input or unsupported method
- **WHEN** an API rejects bad input or unsupported method
- **THEN** related UI SHALL render the same recovery category and status announcement.
