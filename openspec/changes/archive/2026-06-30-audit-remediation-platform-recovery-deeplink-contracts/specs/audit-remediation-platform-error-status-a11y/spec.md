## ADDED Requirements

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
